import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { pool, rows, verifyPassword } from './database';
import type { RowDataPacket } from 'mysql2/promise';

export interface SessionUser {
  id: string;
  employeeId: string;
  organizationId: string;
  displayName: string;
  username: string;
  role: 'worker' | 'admin';
  industry: 'construction' | 'campus';
  organizationName: string;
  team: string;
}
type UserRow = RowDataPacket & SessionUser & { passwordHash?: string };
declare global { namespace Express { interface Request { user?: SessionUser } } }

const loginSchema = z.object({ username: z.string().trim().min(3).max(80), password: z.string().min(8).max(100), industry: z.enum(['construction', 'campus']) });
const demoSchema = z.object({ role: z.enum(['worker', 'admin']), industry: z.enum(['construction', 'campus']) });
const attempts = new Map<string, { count: number; reset: number }>();
const cookieName = 'fairshift_session';

function parseCookie(req: Request) {
  const raw = req.headers.cookie ?? '';
  const item = raw.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  return item ? decodeURIComponent(item.slice(cookieName.length + 1)) : '';
}
function setSessionCookie(res: Response, value: string, maxAge: number) {
  const localHttp = process.env.FAIRSHIFT_LOCAL_HTTP === 'true';
  const attributes = [`${cookieName}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `SameSite=${localHttp ? 'Lax' : 'None'}`, `Max-Age=${maxAge}`];
  if (!localHttp) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}
function clearSessionCookie(res: Response) {
  const localHttp = process.env.FAIRSHIFT_LOCAL_HTTP === 'true';
  res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=${localHttp ? 'Lax' : 'None'}; Max-Age=0${localHttp ? '' : '; Secure'}`);
}
async function findBySession(token: string): Promise<SessionUser | null> {
  if (!pool || !token) return null;
  const found = await rows<UserRow[]>(
    `SELECT u.id AS id, u.employee_id AS employeeId, e.organization_id AS organizationId,
      e.display_name AS displayName, u.username AS username, u.role AS role, o.industry AS industry,
      o.name AS organizationName, e.team AS team
     FROM sessions s JOIN users u ON u.id = s.user_id JOIN employees e ON e.id = u.employee_id
     JOIN organizations o ON o.id = e.organization_id WHERE s.id = ? AND s.expires_at > NOW() LIMIT 1`, [token],
  );
  const user = found[0];
  if (!user) return null;
  return { id: user.id, employeeId: user.employeeId, organizationId: user.organizationId, displayName: user.displayName, username: user.username, role: user.role, industry: user.industry, organizationName: user.organizationName, team: user.team };
}

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    req.user = (await findBySession(parseCookie(req))) ?? undefined;
    next();
  } catch (error) { next(error); }
}
export function requireUser(req: Request, res: Response, roles?: Array<'worker' | 'admin'>): SessionUser | null {
  if (!req.user) { res.status(401).json({ error: 'Please sign in to continue.' }); return null; }
  if (roles && !roles.includes(req.user.role)) { res.status(403).json({ error: 'This view is for a different FairShift role.' }); return null; }
  return req.user;
}

export function attachAuthRoutes(app: import('express').Express) {
  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: 'Enter a demo username and password to continue.' }); return; }
      const key = String(req.ip ?? 'local');
      const current = attempts.get(key);
      const now = Date.now();
      if (current && current.reset > now && current.count >= 8) { res.status(429).json({ error: 'Too many tries. Please wait a minute and try again.' }); return; }
      const nextAttempt = current && current.reset > now ? { count: current.count + 1, reset: current.reset } : { count: 1, reset: now + 60_000 };
      attempts.set(key, nextAttempt);
      const { username, password, industry } = parsed.data;
      const found = await rows<UserRow[]>(
        `SELECT u.id AS id, u.employee_id AS employeeId, e.organization_id AS organizationId,
          e.display_name AS displayName, u.username AS username, u.role AS role, o.industry AS industry,
          o.name AS organizationName, e.team AS team, u.password_hash AS passwordHash
         FROM users u JOIN employees e ON e.id = u.employee_id JOIN organizations o ON o.id = e.organization_id
         WHERE u.username = ? AND o.industry = ? LIMIT 1`, [username, industry],
      );
      const account = found[0];
      if (!account || !account.passwordHash || !verifyPassword(password, account.passwordHash)) { res.status(401).json({ error: 'That sign-in did not match. Try one of the demo accounts below.' }); return; }
      const sessionId = randomBytes(32).toString('base64url');
      const maxAge = 60 * 60 * 10;
      await pool!.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 HOUR))', [sessionId, account.id]);
      setSessionCookie(res, sessionId, maxAge);
      attempts.delete(key);
      const user: SessionUser = { id: account.id, employeeId: account.employeeId, organizationId: account.organizationId, displayName: account.displayName, username: account.username, role: account.role, industry: account.industry, organizationName: account.organizationName, team: account.team };
      res.json({ user });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/demo', async (req, res, next) => {
    try {
      const parsed = demoSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: 'Choose a valid demo role and organisation.' }); return; }
      const { industry, role } = parsed.data;
      const suffix = industry === 'construction' ? 'build' : 'campus';
      const username = `${role}.${suffix}`;
      const found = await rows<UserRow[]>(
        `SELECT u.id AS id, u.employee_id AS employeeId, e.organization_id AS organizationId,
          e.display_name AS displayName, u.username AS username, u.role AS role, o.industry AS industry,
          o.name AS organizationName, e.team AS team
         FROM users u JOIN employees e ON e.id = u.employee_id JOIN organizations o ON o.id = e.organization_id
         WHERE u.username = ? LIMIT 1`, [username],
      );
      const account = found[0];
      if (!account) { res.status(503).json({ error: 'Demo data is still being prepared. Please try again shortly.' }); return; }
      const sessionId = randomBytes(32).toString('base64url');
      const maxAge = 60 * 60 * 10;
      await pool!.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 HOUR))', [sessionId, account.id]);
      setSessionCookie(res, sessionId, maxAge);
      const user: SessionUser = { id: account.id, employeeId: account.employeeId, organizationId: account.organizationId, displayName: account.displayName, username: account.username, role: account.role, industry: account.industry, organizationName: account.organizationName, team: account.team };
      res.json({ user });
    } catch (error) { next(error); }
  });

  app.get('/api/auth/me', (req, res) => res.json({ user: req.user ?? null }));
  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      const token = parseCookie(req);
      if (token && pool) await pool.execute('DELETE FROM sessions WHERE id = ?', [token]);
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (error) { next(error); }
  });
}
