export type Industry = 'construction' | 'campus';
export type Role = 'worker' | 'admin';
export type Language = 'en' | 'hi' | 'ta';
export type SafetyStatus = 'submitted' | 'seen' | 'in_progress' | 'resolved';

export interface User { id: string; employeeId: string; organizationId: string; displayName: string; username: string; role: Role; industry: Industry; organizationName: string; team: string; }
export interface Shift { id: string; employeeId: string; startsAt: string; endsAt: string; checkedInAt: string | null; checkedOutAt: string | null; locationLabel: string; state: 'scheduled' | 'working' | 'complete'; regularHours: number; overtimeHours: number; }
export interface Payslip { id: string; periodStart: string; periodEnd: string; baseCents: number; overtimeHours: number; overtimeRateCents: number; deductionsCents: number; netCents: number; changeCents: number; }
export interface SafetyReport { id: string; category: string; title: string; details: string; status: SafetyStatus; team: string; location: string; createdAt: string; assignee: string | null; comments: Array<{ id: string; text: string; author: string; createdAt: string }>; }
export interface Skill { id: string; title: string; issuer: string; completedOn: string; verified: boolean; shareable: boolean; employeeId?: string; employeeName?: string; team?: string; }
export interface FatigueAlert { employeeId: string; name: string; team: string; weeklyHours: number; reason: string; }
export interface FeedbackSummary { sampleSize: number; averageManager: number | null; averageConditions: number | null; themes: Array<{ label: string; count: number }>; monthly: Array<{ month: string; manager: number; conditions: number }>; }
export interface DashboardData { attendance: Array<{ day: string; present: number; scheduled: number }>; overtime: Array<{ team: string; hours: number; days: Array<number> }>; safetyOpen: number; safetyResolved: number; safetyTotal: number; feedback: FeedbackSummary; fatigue: FatigueAlert[]; welfare: Array<{ team: string; checkins: number; positive: number }>; attrition: Array<{ team: string; score: number; reasons: string[] }>; actions: string[]; headcount: number; }
export interface WorkerHomeData { upcoming: Shift[]; recentPayslip: Payslip | null; reports: SafetyReport[]; skills: Skill[]; weeklyHours: number; consecutiveRestDays: number; fatigueMessage: string | null; }
