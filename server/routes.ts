import { Router, type Request } from 'express';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import { anonymousParticipantKey, exec, inTransaction, rows } from './database';
import { requireUser } from './auth';
import { splitShiftHours } from '../src/features/shifts/hours';

const router = Router();
const clean = (value: string, max = 600) => value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max).replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email removed]').replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[number removed]');
const dateISO = (value: unknown) => value instanceof Date ? value.toISOString() : value ? new Date(String(value)).toISOString() : '';
const rowUser = (req: Request, res: import('express').Response, roles?: Array<'worker' | 'admin'>) => requireUser(req, res, roles);
const safetySchema = z.object({ category: z.string().min(2).max(60), title: z.string().trim().min(3).max(160), details: z.string().trim().min(5).max(1200), location: z.string().trim().min(2).max(120), photoData: z.string().max(500_000).optional() });
const feedbackSchema = z.object({ managerRating: z.number().int().min(1).max(5), conditionsRating: z.number().int().min(1).max(5), comment: z.string().max(500).optional() });
const moodSchema = z.object({ mood: z.enum(['great', 'good', 'okay', 'tired', 'low']) });
const safetyUpdateSchema = z.object({ status: z.enum(['submitted', 'seen', 'in_progress', 'resolved']).optional(), assignee: z.string().max(120).optional(), comment: z.string().trim().max(600).optional() });
const skillSchema = z.object({ employeeId: z.string().min(1).optional(), title: z.string().trim().min(3).max(140), issuer: z.string().trim().min(2).max(140), completedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shareable: z.boolean().default(true) });

function mapReport(row: RowDataPacket) {
  let comments: Array<{ id: string; text: string; author: string; createdAt: string }> = [];
  try { comments = typeof row.commentsJson === 'string' ? JSON.parse(row.commentsJson) : row.commentsJson ?? []; } catch { comments = []; }
  return {
    id: String(row.id), category: String(row.category), title: String(row.title), details: String(row.details), status: String(row.status),
    team: String(row.team), location: String(row.location), createdAt: dateISO(row.createdAt), assignee: row.assignee ? String(row.assignee) : null, comments,
  };
}
function mapShift(row: RowDataPacket) {
  const checkedIn = row.checkedInAt ? dateISO(row.checkedInAt) : null;
  const checkedOut = row.checkedOutAt ? dateISO(row.checkedOutAt) : null;
  return {
    id: String(row.id), employeeId: String(row.employeeId), startsAt: dateISO(row.startsAt), endsAt: dateISO(row.endsAt), checkedInAt: checkedIn,
    checkedOutAt: checkedOut, locationLabel: String(row.locationLabel), state: checkedOut ? 'complete' : checkedIn ? 'working' : 'scheduled',
    regularHours: Number(row.regularHours ?? 0), overtimeHours: Number(row.overtimeHours ?? 0),
  };
}
async function feedbackSummary(organizationId: string) {
  const groups = await rows<RowDataPacket[]>(`SELECT team, period, COUNT(DISTINCT participant_key) AS participants
    FROM feedback_participant_receipts WHERE organization_id = ? AND period >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 MONTH), '%Y-%m')
    GROUP BY team, period ORDER BY period`, [organizationId]);
  const safePeriods = new Set(groups.filter(group => Number(group.participants) >= 5).map(group => `${String(group.team)}|${String(group.period)}`));
  const allParticipants = await rows<RowDataPacket[]>(`SELECT team, COUNT(DISTINCT participant_key) AS participants FROM feedback_participant_receipts
    WHERE organization_id = ? AND period >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 MONTH), '%Y-%m') GROUP BY team`, [organizationId]);
  const teamCounts = allParticipants.map(group => Number(group.participants));
  const safeTeams = [...new Set([...safePeriods].map(key => key.split('|')[0]!))];
  if (!safeTeams.length) return { sampleSize: Math.max(0, ...teamCounts), averageManager: null, averageConditions: null, themes: [], monthly: [] };
  const found = await rows<RowDataPacket[]>(`SELECT team, DATE_FORMAT(created_at, '%Y-%m') AS period, manager_rating AS manager,
    conditions_rating AS conditions, comment FROM feedback WHERE organization_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)`, [organizationId]);
  const visible = found.filter(item => safePeriods.has(`${String(item.team)}|${String(item.period)}`));
  if (visible.length < 5) return { sampleSize: Math.max(0, ...teamCounts), averageManager: null, averageConditions: null, themes: [], monthly: [] };
  const average = (key: 'manager' | 'conditions') => visible.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / visible.length;
  const themeRules: Array<[string, RegExp]> = [['Rest & hydration', /water|rest|break|heat/i], ['Shift planning', /shift|handover|earlier|schedule/i], ['Safety follow-through', /safe|concern|hazard|safety/i], ['Training & tools', /tool|training|equipment/i], ['Team communication', /clear|support|team|check/i]];
  const themes = themeRules.map(([label, pattern]) => ({ label, count: visible.filter(item => pattern.test(String(item.comment ?? ''))).length })).filter(item => item.count >= 2).sort((a, b) => b.count - a.count).slice(0, 4);
  const months = new Map<string, { manager: number; conditions: number; count: number }>();
  for (const item of visible) { const period = String(item.period); const current = months.get(period) ?? { manager: 0, conditions: 0, count: 0 }; current.manager += Number(item.manager); current.conditions += Number(item.conditions); current.count += 1; months.set(period, current); }
  const monthly = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({
    month: new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${period}-01T00:00:00Z`)),
    manager: Number((value.manager / value.count).toFixed(1)), conditions: Number((value.conditions / value.count).toFixed(1)),
  }));
  const safeTeamKeys = [...safeTeams];
  const safeParticipantRows = await rows<RowDataPacket[]>(`SELECT COUNT(DISTINCT participant_key) AS participants FROM feedback_participant_receipts
    WHERE organization_id = ? AND period >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 MONTH), '%Y-%m') AND team IN (${safeTeamKeys.map(() => '?').join(',')})`, [organizationId, ...safeTeamKeys]);
  return { sampleSize: Number(safeParticipantRows[0]?.participants ?? 0), averageManager: Number(average('manager').toFixed(1)), averageConditions: Number(average('conditions').toFixed(1)), themes, monthly };
}

router.get('/profile', async (req, res, next) => {
  try {
    const user = rowUser(req, res); if (!user) return;
    const found = await rows<RowDataPacket[]>('SELECT share_token AS shareToken FROM employees WHERE id = ? AND organization_id = ? LIMIT 1', [user.employeeId, user.organizationId]);
    res.json({ shareToken: String(found[0]?.shareToken ?? '') });
  } catch (error) { next(error); }
});

router.get('/home', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['worker']); if (!user) return;
    const [shifts, pays, reports, skills, totals] = await Promise.all([
      rows<RowDataPacket[]>(`SELECT id, employee_id AS employeeId, starts_at AS startsAt, ends_at AS endsAt, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt, location_label AS locationLabel, regular_hours AS regularHours, overtime_hours AS overtimeHours
        FROM shifts WHERE employee_id = ? AND ends_at >= DATE_SUB(NOW(), INTERVAL 2 DAY) ORDER BY starts_at LIMIT 12`, [user.employeeId]),
      rows<RowDataPacket[]>(`SELECT id, period_start AS periodStart, period_end AS periodEnd, base_cents AS baseCents, overtime_hours AS overtimeHours, overtime_rate_cents AS overtimeRateCents, deductions_cents AS deductionsCents, net_cents AS netCents, change_cents AS changeCents
        FROM payslips WHERE employee_id = ? ORDER BY period_end DESC LIMIT 1`, [user.employeeId]),
      rows<RowDataPacket[]>(`SELECT id, category, title, details, status, team, location, created_at AS createdAt, assignee, comments_json AS commentsJson
        FROM safety_reports WHERE employee_id = ? ORDER BY created_at DESC LIMIT 8`, [user.employeeId]),
      rows<RowDataPacket[]>(`SELECT id, title, issuer, completed_on AS completedOn, verified, shareable FROM skills WHERE employee_id = ? ORDER BY completed_on DESC`, [user.employeeId]),
      rows<RowDataPacket[]>(`SELECT COALESCE(SUM(regular_hours + overtime_hours), 0) AS hours FROM shifts WHERE employee_id = ? AND checked_in_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`, [user.employeeId]),
    ]);
    const history = await rows<RowDataPacket[]>(`SELECT starts_at AS startsAt, ends_at AS endsAt FROM shifts WHERE employee_id = ? AND checked_out_at IS NOT NULL ORDER BY ends_at DESC LIMIT 12`, [user.employeeId]);
    const recentShift = history[0];
    const nextShift = shifts.map(mapShift).filter(shift => shift.state === 'scheduled' && new Date(shift.startsAt).getTime() > Date.now()).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
    const restBeforeNext = recentShift && nextShift ? (new Date(nextShift.startsAt).getTime() - new Date(dateISO(recentShift.endsAt)).getTime()) / 3_600_000 : Infinity;
    const fatigueMessage = Number(totals[0]?.hours ?? 0) >= 42
      ? 'You have had a full week. If you can, take time to rest between shifts.'
      : restBeforeNext >= 0 && restBeforeNext < 11
        ? 'There may be less than 11 hours to rest before your next shift. If you can, let your team know what support would help.'
        : null;
    let restDays = 0; let previous = new Date(); previous.setHours(23, 59, 59, 999);
    const workedDays = new Set(history.map(item => new Date(String(item.startsAt)).toDateString()));
    while (restDays < 30) { previous.setDate(previous.getDate() - 1); if (workedDays.has(previous.toDateString())) break; restDays += 1; }
    res.json({ upcoming: shifts.map(mapShift), recentPayslip: pays[0] ? { ...pays[0], periodStart: dateISO(pays[0].periodStart), periodEnd: dateISO(pays[0].periodEnd), baseCents: Number(pays[0].baseCents), overtimeHours: Number(pays[0].overtimeHours), overtimeRateCents: Number(pays[0].overtimeRateCents), deductionsCents: Number(pays[0].deductionsCents), netCents: Number(pays[0].netCents), changeCents: Number(pays[0].changeCents) } : null,
      reports: reports.map(mapReport), skills: skills.map(item => ({ id: String(item.id), title: String(item.title), issuer: String(item.issuer), completedOn: dateISO(item.completedOn), verified: Boolean(item.verified), shareable: Boolean(item.shareable) })),
      weeklyHours: Number(totals[0]?.hours ?? 0), consecutiveRestDays: restDays, fatigueMessage });
  } catch (error) { next(error); }
});

router.get('/shifts', async (req, res, next) => {
  try {
    const user = rowUser(req, res); if (!user) return;
    const isAdmin = user.role === 'admin';
    const found = isAdmin
      ? await rows<RowDataPacket[]>(`SELECT s.id, s.employee_id AS employeeId, s.starts_at AS startsAt, s.ends_at AS endsAt, s.checked_in_at AS checkedInAt, s.checked_out_at AS checkedOutAt, s.location_label AS locationLabel, s.regular_hours AS regularHours, s.overtime_hours AS overtimeHours, e.display_name AS employeeName, e.team FROM shifts s JOIN employees e ON e.id = s.employee_id JOIN organizations o ON o.id = e.organization_id WHERE e.organization_id = ? AND s.starts_at >= DATE_SUB(NOW(), INTERVAL 6 DAY) AND s.starts_at < DATE_ADD(NOW(), INTERVAL 7 DAY) ORDER BY s.starts_at LIMIT 180`, [user.organizationId])
      : await rows<RowDataPacket[]>(`SELECT id, employee_id AS employeeId, starts_at AS startsAt, ends_at AS endsAt, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt, location_label AS locationLabel, regular_hours AS regularHours, overtime_hours AS overtimeHours FROM shifts WHERE employee_id = ? AND starts_at >= DATE_SUB(NOW(), INTERVAL 6 DAY) AND starts_at < DATE_ADD(NOW(), INTERVAL 7 DAY) ORDER BY starts_at`, [user.employeeId]);
    res.json({ shifts: found.map(mapShift) });
  } catch (error) { next(error); }
});

router.post('/shifts/:id/event', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['worker']); if (!user) return;
    const body = z.object({ action: z.enum(['in', 'out']), qrToken: z.string().max(120), latitude: z.number().optional(), longitude: z.number().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: 'Choose check in or check out and scan a site QR.' }); return; }
    if (body.data.qrToken !== `fairshift:${user.industry}`) { res.status(400).json({ error: 'That QR code is not for this organisation.' }); return; }
    const shiftRows = await rows<RowDataPacket[]>(`SELECT id, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt, starts_at AS startsAt, ends_at AS endsAt
      FROM shifts WHERE id = ? AND employee_id = ? LIMIT 1`, [req.params.id, user.employeeId]);
    const shift = shiftRows[0];
    if (!shift) { res.status(404).json({ error: 'That shift could not be found.' }); return; }
    if (body.data.action === 'in') {
      if (shift.checkedInAt) { res.status(409).json({ error: 'You are already checked in for this shift.' }); return; }
      await exec('UPDATE shifts SET checked_in_at = NOW() WHERE id = ?', [req.params.id]);
    } else {
      if (!shift.checkedInAt) { res.status(409).json({ error: 'Check in before you check out.' }); return; }
      if (shift.checkedOutAt) { res.status(409).json({ error: 'This shift is already complete.' }); return; }
      const actual = Math.max(0, (Date.now() - new Date(dateISO(shift.checkedInAt)).getTime()) / 3_600_000);
      const scheduledHours = Math.max(0, (new Date(dateISO(shift.endsAt)).getTime() - new Date(dateISO(shift.startsAt)).getTime()) / 3_600_000);
      const split = splitShiftHours(actual, scheduledHours);
      await exec('UPDATE shifts SET checked_out_at = NOW(), regular_hours = ?, overtime_hours = ? WHERE id = ?', [split.regularHours, split.overtimeHours, req.params.id]);
    }
    const updated = await rows<RowDataPacket[]>(`SELECT id, employee_id AS employeeId, starts_at AS startsAt, ends_at AS endsAt, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt, location_label AS locationLabel, regular_hours AS regularHours, overtime_hours AS overtimeHours FROM shifts WHERE id = ?`, [req.params.id]);
    res.json({ shift: mapShift(updated[0]!), locationChecked: Number.isFinite(body.data.latitude) && Number.isFinite(body.data.longitude) });
  } catch (error) { next(error); }
});

router.get('/pay', async (req, res, next) => {
  try {
    const user = rowUser(req, res); if (!user) return;
    const employeeId = user.role === 'worker' ? user.employeeId : String(req.query.employeeId ?? user.employeeId);
    if (user.role === 'admin') {
      const allowed = await rows<RowDataPacket[]>('SELECT id FROM employees WHERE id = ? AND organization_id = ?', [employeeId, user.organizationId]);
      if (!allowed.length) { res.status(404).json({ error: 'No payslips were found for this person.' }); return; }
    }
    const found = await rows<RowDataPacket[]>(`SELECT id, period_start AS periodStart, period_end AS periodEnd, base_cents AS baseCents, overtime_hours AS overtimeHours, overtime_rate_cents AS overtimeRateCents, deductions_cents AS deductionsCents, net_cents AS netCents, change_cents AS changeCents FROM payslips WHERE employee_id = ? ORDER BY period_end DESC LIMIT 12`, [employeeId]);
    res.json({ payslips: found.map(item => ({ id: String(item.id), periodStart: dateISO(item.periodStart), periodEnd: dateISO(item.periodEnd), baseCents: Number(item.baseCents), overtimeHours: Number(item.overtimeHours), overtimeRateCents: Number(item.overtimeRateCents), deductionsCents: Number(item.deductionsCents), netCents: Number(item.netCents), changeCents: Number(item.changeCents) })) });
  } catch (error) { next(error); }
});

router.get('/safety', async (req, res, next) => {
  try {
    const user = rowUser(req, res); if (!user) return;
    const found = user.role === 'admin'
      ? await rows<RowDataPacket[]>(`SELECT id, category, title, details, status, team, location, created_at AS createdAt, assignee, comments_json AS commentsJson FROM safety_reports WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100`, [user.organizationId])
      : await rows<RowDataPacket[]>(`SELECT id, category, title, details, status, team, location, created_at AS createdAt, assignee, comments_json AS commentsJson FROM safety_reports WHERE employee_id = ? ORDER BY created_at DESC`, [user.employeeId]);
    res.json({ reports: found.map(mapReport) });
  } catch (error) { next(error); }
});
router.post('/safety', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['worker']); if (!user) return;
    const parsed = safetySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Add a short title, choose a category and tell us a little more before sending.' }); return; }
    const { category, title, details, location } = parsed.data;
    const photo = parsed.data.photoData?.startsWith('data:image/') ? parsed.data.photoData : null;
    const id = crypto.randomUUID();
    await exec(`INSERT INTO safety_reports (id, organization_id, employee_id, category, title, details, status, team, location, assignee, photo_data, comments_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?, NULL, ?, JSON_ARRAY(), NOW())`, [id, user.organizationId, user.employeeId, clean(category, 60), clean(title, 160), clean(details, 1200), user.team, clean(location, 120), photo]);
    res.status(201).json({ ok: true, id });
  } catch (error) { next(error); }
});
router.patch('/safety/:id', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['admin']); if (!user) return;
    const parsed = safetyUpdateSchema.safeParse(req.body);
    if (!parsed.success || !Object.values(parsed.data ?? {}).some(value => value !== undefined)) { res.status(400).json({ error: 'Choose a status, assignee or add a comment.' }); return; }
    const found = await rows<RowDataPacket[]>(`SELECT id, status, assignee, comments_json AS commentsJson FROM safety_reports WHERE id = ? AND organization_id = ?`, [req.params.id, user.organizationId]);
    if (!found[0]) { res.status(404).json({ error: 'Safety report not found.' }); return; }
    const current = found[0]!;
    let comments: Array<Record<string, string>> = [];
    try { comments = typeof current.commentsJson === 'string' ? JSON.parse(current.commentsJson) : current.commentsJson ?? []; } catch { comments = []; }
    if (parsed.data.comment) comments.push({ id: crypto.randomUUID(), text: clean(parsed.data.comment), author: user.displayName, createdAt: new Date().toISOString() });
    await exec('UPDATE safety_reports SET status = ?, assignee = ?, comments_json = ? WHERE id = ?', [parsed.data.status ?? current.status, parsed.data.assignee === undefined ? current.assignee : clean(parsed.data.assignee, 120) || null, JSON.stringify(comments), req.params.id]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/feedback', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['worker']); if (!user) return;
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Choose both ratings before sending feedback.' }); return; }
    // A keyed one-way receipt is separate from the response to block repeat submissions per worker/month.
    // Feedback rows themselves contain no employee, account, session, IP, or receipt identifier.
    const periods = await rows<RowDataPacket[]>("SELECT DATE_FORMAT(CURDATE(), '%Y-%m') AS period");
    const period = String(periods[0]?.period ?? new Date().toISOString().slice(0, 7));
    const participantKey = anonymousParticipantKey('feedback', user.organizationId, '', user.employeeId);
    try {
      await inTransaction(async connection => {
        await connection.execute('INSERT INTO feedback_participant_receipts (participant_key, organization_id, team, period) VALUES (?, ?, ?, ?)', [participantKey, user.organizationId, user.team, period]);
        await connection.execute('INSERT INTO feedback (id, organization_id, team, manager_rating, conditions_rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())', [crypto.randomUUID(), user.organizationId, user.team, parsed.data.managerRating, parsed.data.conditionsRating, clean(parsed.data.comment ?? '', 500) || null]);
      });
    } catch (error) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') { res.status(409).json({ error: 'You have already shared feedback this month. Thank you — your earlier response is still anonymous.' }); return; } throw error; }
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});
router.get('/feedback', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['admin']); if (!user) return;
    res.json({ summary: await feedbackSummary(user.organizationId) });
  } catch (error) { next(error); }
});
router.post('/mood', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['worker']); if (!user) return;
    const parsed = moodSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Choose a feeling to save your check-in.' }); return; }
    // Mood rows contain no person/account/session identifier; a separate keyed receipt blocks daily repeats.
    const days = await rows<RowDataPacket[]>("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS checkinDay");
    const checkinDay = String(days[0]?.checkinDay ?? new Date().toISOString().slice(0, 10));
    const participantKey = anonymousParticipantKey('mood', user.organizationId, '', user.employeeId);
    try {
      await inTransaction(async connection => {
        await connection.execute('INSERT INTO mood_participant_receipts (participant_key, organization_id, team, checkin_day) VALUES (?, ?, ?, ?)', [participantKey, user.organizationId, user.team, checkinDay]);
        await connection.execute('INSERT INTO mood_checkins (id, organization_id, team, mood, checkin_day) VALUES (?, ?, ?, ?, ?)', [crypto.randomUUID(), user.organizationId, user.team, parsed.data.mood, checkinDay]);
      });
    } catch (error) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') { res.status(409).json({ error: 'You have already checked in today. Your mood remains private.' }); return; } throw error; }
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/skills', async (req, res, next) => {
  try {
    const user = rowUser(req, res); if (!user) return;
    const found = user.role === 'admin'
      ? await rows<RowDataPacket[]>(`SELECT s.id, s.employee_id AS employeeId, e.display_name AS employeeName, e.team, s.title, s.issuer, s.completed_on AS completedOn, s.verified, s.shareable FROM skills s JOIN employees e ON e.id = s.employee_id WHERE e.organization_id = ? ORDER BY s.completed_on DESC LIMIT 100`, [user.organizationId])
      : await rows<RowDataPacket[]>(`SELECT id, employee_id AS employeeId, title, issuer, completed_on AS completedOn, verified, shareable FROM skills WHERE employee_id = ? ORDER BY completed_on DESC`, [user.employeeId]);
    res.json({ skills: found.map(item => ({ id: String(item.id), employeeId: String(item.employeeId), employeeName: item.employeeName ? String(item.employeeName) : undefined, team: item.team ? String(item.team) : undefined, title: String(item.title), issuer: String(item.issuer), completedOn: dateISO(item.completedOn), verified: Boolean(item.verified), shareable: Boolean(item.shareable) })) });
  } catch (error) { next(error); }
});
router.post('/skills', async (req, res, next) => {
  try {
    const user = rowUser(req, res); if (!user) return;
    const parsed = skillSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Add the staff member, skill, issuer and completion date.' }); return; }
    const employeeId = user.role === 'worker' ? user.employeeId : parsed.data.employeeId;
    if (!employeeId) { res.status(400).json({ error: 'Choose a team member for this entry.' }); return; }
    const employee = await rows<RowDataPacket[]>('SELECT id FROM employees WHERE id = ? AND organization_id = ?', [employeeId, user.organizationId]);
    if (!employee.length) { res.status(404).json({ error: 'Choose a team member in this organisation.' }); return; }
    await exec('INSERT INTO skills (id, employee_id, title, issuer, completed_on, verified, shareable) VALUES (?, ?, ?, ?, ?, 0, ?)', [crypto.randomUUID(), employeeId, clean(parsed.data.title, 140), clean(parsed.data.issuer, 140), parsed.data.completedOn, parsed.data.shareable ? 1 : 0]);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});
router.patch('/skills/:id/verify', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['admin']); if (!user) return;
    const result = await exec('UPDATE skills s JOIN employees e ON e.id = s.employee_id SET s.verified = 1 WHERE s.id = ? AND e.organization_id = ?', [req.params.id, user.organizationId]);
    if (!result.affectedRows) { res.status(404).json({ error: 'Skill entry not found.' }); return; }
    res.json({ ok: true });
  } catch (error) { next(error); }
});
router.get('/passports/:token', async (req, res, next) => {
  try {
    const employees = await rows<RowDataPacket[]>(`SELECT e.id, e.display_name AS displayName FROM employees e WHERE e.share_token = ? LIMIT 1`, [req.params.token]);
    if (!employees[0]) { res.status(404).json({ error: 'This passport link is no longer available.' }); return; }
    const employee = employees[0]!;
    const found = await rows<RowDataPacket[]>(`SELECT title, issuer, completed_on AS completedOn, verified FROM skills WHERE employee_id = ? AND shareable = 1 ORDER BY completed_on DESC`, [employee.id]);
    res.json({ displayName: String(employee.displayName), skills: found.map(item => ({ title: String(item.title), issuer: String(item.issuer), completedOn: dateISO(item.completedOn), verified: Boolean(item.verified) })) });
  } catch (error) { next(error); }
});

async function buildDashboard(organizationId: string) {
  const [attendanceRows, overtimeRows, reportRows, shifts, people, feedback, welfareRows, teamFeedback, teamReports] = await Promise.all([
    rows<RowDataPacket[]>(`SELECT DATE_FORMAT(starts_at, '%a') AS day, COUNT(*) AS scheduled, SUM(checked_in_at IS NOT NULL) AS present FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE e.organization_id = ? AND starts_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND starts_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY) GROUP BY DATE(starts_at) ORDER BY DATE(starts_at)`, [organizationId]),
    rows<RowDataPacket[]>(`SELECT e.team, DAYOFWEEK(s.starts_at) AS weekday, SUM(s.overtime_hours) AS hours FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE e.organization_id = ? AND s.starts_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY e.team, DAYOFWEEK(s.starts_at)`, [organizationId]),
    rows<RowDataPacket[]>(`SELECT status, COUNT(*) AS count FROM safety_reports WHERE organization_id = ? GROUP BY status`, [organizationId]),
    rows<RowDataPacket[]>(`SELECT e.id AS employeeId, e.display_name AS name, e.team, s.starts_at AS startsAt, s.ends_at AS endsAt, s.regular_hours AS regularHours, s.overtime_hours AS overtimeHours, s.checked_in_at AS checkedInAt, s.checked_out_at AS checkedOutAt FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE e.organization_id = ? AND s.starts_at >= DATE_SUB(NOW(), INTERVAL 8 DAY) AND s.starts_at <= NOW() ORDER BY e.id, s.starts_at`, [organizationId]),
    rows<RowDataPacket[]>(`SELECT id, display_name AS name, team FROM employees WHERE organization_id = ? ORDER BY team, display_name`, [organizationId]),
    feedbackSummary(organizationId),
    rows<RowDataPacket[]>(`SELECT m.team, COUNT(*) AS checkins, SUM(m.mood IN ('good', 'great')) AS positive FROM mood_checkins m
      JOIN (SELECT team FROM mood_participant_receipts WHERE organization_id = ? AND checkin_day >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY team HAVING COUNT(DISTINCT participant_key) >= 5) eligible ON eligible.team = m.team
      WHERE m.organization_id = ? AND m.checkin_day >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY m.team`, [organizationId, organizationId]),
    rows<RowDataPacket[]>(`SELECT f.team, COUNT(DISTINCT r.participant_key) AS count, AVG(f.manager_rating) AS manager, AVG(f.conditions_rating) AS conditions
      FROM feedback f JOIN (SELECT organization_id, team, period FROM feedback_participant_receipts WHERE organization_id = ?
        AND period >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 MONTH), '%Y-%m') GROUP BY organization_id, team, period
        HAVING COUNT(DISTINCT participant_key) >= 5) safe ON safe.organization_id = f.organization_id AND safe.team = f.team AND safe.period = DATE_FORMAT(f.created_at, '%Y-%m')
      JOIN feedback_participant_receipts r ON r.organization_id = safe.organization_id AND r.team = safe.team AND r.period = safe.period
      WHERE f.organization_id = ? AND f.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY f.team`, [organizationId, organizationId]),
    rows<RowDataPacket[]>(`SELECT team, COUNT(*) AS openCount FROM safety_reports WHERE organization_id = ? AND status <> 'resolved' GROUP BY team`, [organizationId]),
  ]);
  const weekByEmployee = new Map<string, { name: string; team: string; hours: number; reasons: Set<string>; days: Array<{ start: string; end: string }> }>();
  for (const item of shifts) {
    const key = String(item.employeeId);
    const state = weekByEmployee.get(key) ?? { name: String(item.name), team: String(item.team), hours: 0, reasons: new Set<string>(), days: [] };
    if (item.checkedInAt) state.hours += Number(item.regularHours ?? 0) + Number(item.overtimeHours ?? 0);
    state.days.push({ start: dateISO(item.startsAt), end: dateISO(item.endsAt) });
    weekByEmployee.set(key, state);
  }
  const fatigue: Array<{ employeeId: string; name: string; team: string; weeklyHours: number; reason: string }> = [];
  for (const [employeeId, item] of weekByEmployee) {
    const reasons = new Set<string>();
    if (item.hours >= 42) reasons.add('Over 42 hours in the last 7 days');
    const days = item.days.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    for (let index = 1; index < days.length; index += 1) {
      const rest = (new Date(days[index]!.start).getTime() - new Date(days[index - 1]!.end).getTime()) / 3_600_000;
      if (rest >= 0 && rest < 11) reasons.add('Less than 11 hours between shifts');
    }
    if (reasons.size) fatigue.push({ employeeId, name: item.name, team: item.team, weeklyHours: Number(item.hours.toFixed(1)), reason: [...reasons].join(' · ') });
  }
  const byTeam = new Map<string, { score: number; reasons: string[] }>();
  for (const employee of people) byTeam.set(String(employee.team), { score: 0, reasons: [] });
  for (const [team, stats] of byTeam) {
    const teamMembers = people.filter(person => String(person.team) === team).length;
    const teamFatigue = fatigue.filter(person => person.team === team);
    const overtime = overtimeRows.filter(row => String(row.team) === team).reduce((sum, row) => sum + Number(row.hours ?? 0), 0);
    const absenceRows = await rows<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE e.organization_id = ? AND e.team = ? AND s.starts_at < NOW() AND s.starts_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND s.checked_in_at IS NULL`, [organizationId, team]);
    const absent = Number(absenceRows[0]?.n ?? 0);
    const teamFeedbackRow = teamFeedback.find(item => String(item.team) === team && Number(item.count) >= 5);
    const open = Number(teamReports.find(item => String(item.team) === team)?.openCount ?? 0);
    if (overtime / Math.max(teamMembers, 1) > 12) { stats.score += 30; stats.reasons.push('Overtime is concentrated across this team'); }
    if (teamFatigue.length >= Math.max(2, Math.ceil(teamMembers / 3))) { stats.score += 25; stats.reasons.push('Several workers have high weekly hours or short rest'); }
    if (absent > 1) { stats.score += 20; stats.reasons.push(`${absent} scheduled shifts have no check-in`); }
    if (teamFeedbackRow && (Number(teamFeedbackRow.manager) < 3.4 || Number(teamFeedbackRow.conditions) < 3.4)) { stats.score += 25; stats.reasons.push('Anonymous feedback is below 3.4 / 5'); }
    if (open >= 3) { stats.score += 20; stats.reasons.push(`${open} unresolved safety concerns remain`); }
    stats.score = Math.min(100, stats.score);
    if (!stats.reasons.length) stats.reasons.push('No elevated team-level signal this week');
  }
  const overtimeTeams = new Map<string, { hours: number; days: number[] }>();
  for (const row of overtimeRows) {
    const team = String(row.team); const item = overtimeTeams.get(team) ?? { hours: 0, days: Array(7).fill(0) as number[] };
    const weekday = Number(row.weekday); const index = weekday === 1 ? 6 : weekday - 2;
    item.days[index] = Number(Number(item.days[index] ?? 0) + Number(row.hours ?? 0)); item.hours += Number(row.hours ?? 0); overtimeTeams.set(team, item);
  }
  const statusCounts = Object.fromEntries(reportRows.map(row => [String(row.status), Number(row.count)]));
  const headcount = people.length;
  const actions = [
    ...fatigue.slice(0, 1).map(alert => `${alert.team} is trending above 42 hours this week: consider redistributing upcoming shifts.`),
    statusCounts.submitted || statusCounts.seen ? 'Review new safety reports and acknowledge the people who raised them.' : 'Safety reports are up to date. Keep the reporting channel visible.',
    Number(feedback.sampleSize) >= 5 ? 'Share one concrete response to the top team feedback theme this week.' : 'Invite a few more anonymous responses before reviewing team feedback.',
  ];
  return {
    attendance: attendanceRows.map(item => ({ day: String(item.day), present: Number(item.present ?? 0), scheduled: Number(item.scheduled ?? 0) })),
    overtime: [...overtimeTeams].map(([team, value]) => ({ team, hours: Number(value.hours.toFixed(1)), days: value.days.map(day => Number(day.toFixed(1))) })),
    safetyOpen: Number(statusCounts.submitted ?? 0) + Number(statusCounts.seen ?? 0) + Number(statusCounts.in_progress ?? 0),
    safetyResolved: Number(statusCounts.resolved ?? 0), safetyTotal: reportRows.reduce((sum, item) => sum + Number(item.count), 0), feedback,
    fatigue: fatigue.slice(0, 8), welfare: welfareRows.filter(item => Number(item.checkins) >= 5).map(item => ({ team: String(item.team), checkins: Number(item.checkins), positive: Number(item.positive ?? 0) })),
    attrition: [...byTeam].map(([team, value]) => ({ team, score: value.score, reasons: value.reasons })), actions, headcount,
  };
}
router.get('/admin/dashboard', async (req, res, next) => {
  try { const user = rowUser(req, res, ['admin']); if (!user) return; res.json(await buildDashboard(user.organizationId)); }
  catch (error) { next(error); }
});
router.get('/admin/people', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['admin']); if (!user) return;
    const search = clean(String(req.query.q ?? ''), 100);
    const found = await rows<RowDataPacket[]>(`SELECT e.id, e.display_name AS name, e.team, e.wage_cents AS wageCents, e.share_token AS shareToken,
      (SELECT COALESCE(SUM(s.regular_hours + s.overtime_hours), 0) FROM shifts s WHERE s.employee_id = e.id AND s.checked_in_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS weeklyHours,
      (SELECT COUNT(*) FROM shifts s WHERE s.employee_id = e.id AND s.starts_at < NOW() AND s.starts_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND s.checked_in_at IS NULL) AS absences
      FROM employees e WHERE e.organization_id = ? AND (e.display_name LIKE ? OR e.team LIKE ?) ORDER BY e.team, e.display_name`, [user.organizationId, `%${search}%`, `%${search}%`]);
    res.json({ people: found.map(item => ({ id: String(item.id), name: String(item.name), team: String(item.team), wageCents: Number(item.wageCents), weeklyHours: Number(Number(item.weeklyHours).toFixed(1)), absences: Number(item.absences), shareToken: String(item.shareToken) })) });
  } catch (error) { next(error); }
});
router.get('/admin/notifications', async (req, res, next) => {
  try {
    const user = rowUser(req, res, ['admin']); if (!user) return;
    const found = await rows<RowDataPacket[]>(`SELECT id, title, status, created_at AS createdAt FROM safety_reports WHERE organization_id = ? AND status <> 'resolved' ORDER BY created_at DESC LIMIT 8`, [user.organizationId]);
    res.json({ notifications: found.map(item => ({ id: String(item.id), title: String(item.title), status: String(item.status), createdAt: dateISO(item.createdAt) })) });
  } catch (error) { next(error); }
});

export default router;
