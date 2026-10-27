import type { DashboardData, FeedbackSummary, Industry, Payslip, SafetyReport, Shift, Skill, User, WorkerHomeData } from '@/lib/types';

const CACHE_PREFIX = 'fairshift-cache:';
const QUEUE_KEY = 'fairshift-pending-actions';
const OFFLINE_USER_KEY = 'fairshift-offline-user';
const DEMO_USERS: Record<string, User> = {
  'worker.build': { id: 'demo-worker-build', employeeId: 'org-construction-emp-01', organizationId: 'org-construction', displayName: 'Asha Patel', username: 'worker.build', role: 'worker', industry: 'construction', organizationName: 'Northstar Construction Site', team: 'Team A' },
  'admin.build': { id: 'demo-admin-build', employeeId: 'org-construction-emp-12', organizationId: 'org-construction', displayName: 'Jordan Lee', username: 'admin.build', role: 'admin', industry: 'construction', organizationName: 'Northstar Construction Site', team: 'Team B' },
  'worker.campus': { id: 'demo-worker-campus', employeeId: 'org-campus-emp-07', organizationId: 'org-campus', displayName: 'Arun Kumar', username: 'worker.campus', role: 'worker', industry: 'campus', organizationName: 'Meadowview College Campus', team: 'Team B' },
  'admin.campus': { id: 'demo-admin-campus', employeeId: 'org-campus-emp-06', organizationId: 'org-campus', displayName: 'Grace Mensah', username: 'admin.campus', role: 'admin', industry: 'campus', organizationName: 'Meadowview College Campus', team: 'Team A' },
};
const expectedPassword = (role: 'worker' | 'admin') => role === 'worker' ? 'ShiftReady8!' : 'FairTeam8!';
export const demoAccount = (role: 'worker' | 'admin', industry: Industry) => DEMO_USERS[`${role}.${industry === 'construction' ? 'build' : 'campus'}`]!;
function isOffline(error: unknown) { return error instanceof Error && /offline|failed to fetch|networkerror|load failed/i.test(error.message); }
function readOfflineUser(): User | null { try { const raw = localStorage.getItem(OFFLINE_USER_KEY); return raw ? JSON.parse(raw) as User : null; } catch { return null; } }
function userScope(user: User | null) { return user ? `${user.industry}:${user.role}:${user.employeeId}` : 'public'; }
function cacheScope(path: string) { return path.startsWith('/api/passports/') ? 'public' : userScope(readOfflineUser()); }
export function persistOfflineUser(user: User | null) { try { if (user) localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user)); else localStorage.removeItem(OFFLINE_USER_KEY); } catch { /* Offline identity is an optional convenience. */ } }
function cached<T>(key: string): T | null { try { const value = localStorage.getItem(CACHE_PREFIX + key); return value ? JSON.parse(value) as T : null; } catch { return null; } }
function saveCache<T>(key: string, value: T) { try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); } catch { /* Device storage is optional. */ } }
type PendingAction = { path: string; method: string; body: unknown; scope?: string };
function pendingQueue(): PendingAction[] { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as PendingAction[]; } catch { return []; } }
function queueAction(path: string, method: string, body: unknown) {
  if (path.startsWith('/api/auth/')) return; // Never persist passwords or session actions offline.
  try { const queue = pendingQueue(); if (queue.length < 50) { queue.push({ path, method, body, scope: cacheScope(path) }); localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fairshift:queued')); } } catch { /* The UI explains when device storage is unavailable. */ }
}
export function pendingCount() { return pendingQueue().length; }

export async function syncPendingActions() {
  if (typeof navigator === 'undefined' || !navigator.onLine) return 0;
  const activeUser = readOfflineUser(); if (!activeUser) return 0;
  try { const sessionResponse = await fetch('/api/auth/me', { credentials: 'include' }); if (!sessionResponse.ok) return 0; const session = await sessionResponse.json() as { user?: User | null }; if (!session.user || userScope(session.user) !== userScope(activeUser)) return 0; } catch { return 0; }
  const queue = pendingQueue(); const remaining: PendingAction[] = []; let sent = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index]!;
    if (item.scope && item.scope !== userScope(activeUser)) { remaining.push(item); continue; }
    try {
      const response = await fetch(item.path, { method: item.method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: item.method === 'GET' ? undefined : JSON.stringify(item.body) });
      if (response.status === 401 || response.status >= 500) { remaining.push(...queue.slice(index)); break; }
      sent += 1; // Drop invalid 4xx work rather than retrying it forever.
    } catch { remaining.push(...queue.slice(index)); break; }
  }
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining)); } catch { /* Best effort. */ }
  if (sent && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fairshift:sync', { detail: { count: sent } }));
  return sent;
}
if (typeof window !== 'undefined') window.addEventListener('online', () => { void syncPendingActions(); });

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET'; const key = `${cacheScope(path)}:${method}:${path}`;
  try {
    const response = await fetch(path, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init.headers } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
    if (method === 'GET') saveCache(key, payload);
    return payload as T;
  } catch (error) {
    if (!isOffline(error)) throw error;
    const fallback = method === 'GET' ? cached<T>(key) : null;
    if (fallback !== null) return fallback;
    if (method !== 'GET') queueAction(path, method, init.body ? JSON.parse(String(init.body)) : null);
    throw new Error(method === 'GET' ? 'You are offline and this screen has not been saved on this device yet.' : 'You are offline. This action is saved on this device and will sync when you reconnect.');
  }
}

export const api = {
  getSession: async () => {
    try { return await request<{ user: User | null }>('/api/auth/me'); }
    catch (error) { if (isOffline(error)) return { user: readOfflineUser() }; throw error; }
  },
  signIn: async (username: string, password: string, industry: Industry) => {
    try { return await request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password, industry }) }); }
    catch (error) {
      const user = DEMO_USERS[username];
      if (isOffline(error) && user?.industry === industry && password === expectedPassword(user.role)) return { user };
      throw error;
    }
  },
  demoSwitch: async (role: 'worker' | 'admin', industry: Industry) => {
    try { return await request<{ user: User }>('/api/auth/demo', { method: 'POST', body: JSON.stringify({ role, industry }) }); }
    catch (error) { if (isOffline(error)) return { user: demoAccount(role, industry) }; throw error; }
  },
  logout: async () => {
    try { return await request<{ ok: true }>('/api/auth/logout', { method: 'POST' }); }
    catch (error) { if (isOffline(error)) return { ok: true as const }; throw error; }
  },
  profile: () => request<{ shareToken: string }>('/api/profile'),
  home: () => request<WorkerHomeData>('/api/home'),
  shifts: () => request<{ shifts: Shift[] }>('/api/shifts'),
  shiftEvent: (id: string, action: 'in' | 'out', qrToken: string, position?: GeolocationPosition) => request<{ shift: Shift; locationChecked: boolean }>(`/api/shifts/${encodeURIComponent(id)}/event`, { method: 'POST', body: JSON.stringify({ action, qrToken, latitude: position?.coords.latitude, longitude: position?.coords.longitude }) }),
  payslips: () => request<{ payslips: Payslip[] }>('/api/pay'),
  reports: () => request<{ reports: SafetyReport[] }>('/api/safety'),
  createReport: (body: { category: string; title: string; details: string; location: string; photoData?: string }) => request<{ ok: boolean; id: string }>('/api/safety', { method: 'POST', body: JSON.stringify(body) }),
  updateReport: (id: string, body: { status?: string; assignee?: string; comment?: string }) => request<{ ok: boolean }>(`/api/safety/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  submitFeedback: (body: { managerRating: number; conditionsRating: number; comment?: string }) => request<{ ok: boolean }>('/api/feedback', { method: 'POST', body: JSON.stringify(body) }),
  feedback: () => request<{ summary: FeedbackSummary }>('/api/feedback'),
  mood: (mood: string) => request<{ ok: boolean }>('/api/mood', { method: 'POST', body: JSON.stringify({ mood }) }),
  skills: () => request<{ skills: Skill[] }>('/api/skills'),
  addSkill: (body: { employeeId?: string; title: string; issuer: string; completedOn: string; shareable: boolean }) => request<{ ok: boolean }>('/api/skills', { method: 'POST', body: JSON.stringify(body) }),
  verifySkill: (id: string) => request<{ ok: boolean }>(`/api/skills/${encodeURIComponent(id)}/verify`, { method: 'PATCH', body: '{}' }),
  passport: (token: string) => request<{ displayName: string; skills: Array<{ title: string; issuer: string; completedOn: string; verified: boolean }> }>(`/api/passports/${encodeURIComponent(token)}`),
  dashboard: () => request<DashboardData>('/api/admin/dashboard'),
  people: (q = '') => request<{ people: Array<{ id: string; name: string; team: string; weeklyHours: number; absences: number; shareToken: string }> }>(`/api/admin/people?q=${encodeURIComponent(q)}`),
  notifications: () => request<{ notifications: Array<{ id: string; title: string; status: string; createdAt: string }> }>('/api/admin/notifications'),
};

export function createDemoUser(username: string): User | null { return DEMO_USERS[username] ?? null; }
