import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/data/api';
import { dayLabel } from '@/lib/utils';
import { useSession } from '@/lib/session';
import type { Shift } from '@/lib/types';
import { Button, Card, EmptyState, LoadingState, StatusPill } from '@/components/ui';
import { ShiftAction } from '@/components/ShiftAction';

export default function Shifts() {
  const [shifts, setShifts] = useState<Shift[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const { language, industry } = useSession();
  const refresh = useCallback(() => { setLoading(true); api.shifts().then(result => setShifts(result.shifts)).catch(problem => setError(problem instanceof Error ? problem.message : 'Could not load your shifts.')).finally(() => setLoading(false)); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const visible = shifts.filter(item => item.state !== 'complete' || new Date(item.startsAt).getTime() > Date.now() - 8 * 86400000);
  const next = useMemo(() => visible.find(item => item.state === 'working') ?? visible.find(item => item.state === 'scheduled'), [visible]);
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recordedThisWeek = shifts.filter(item => item.checkedInAt && new Date(item.checkedInAt).getTime() >= weekStart);
  const total = recordedThisWeek.reduce((sum, item) => sum + item.regularHours + item.overtimeHours, 0);
  const overtime = recordedThisWeek.reduce((sum, item) => sum + item.overtimeHours, 0);
  if (loading && !shifts.length) return <LoadingState/>;
  return <div className="page-enter"><div className="section-heading"><div><p className="eyebrow">Your time, clearly counted</p><h1>My shifts</h1><p className="section-detail">Check in, see what’s ahead, and know when overtime begins.</p></div><Button variant="secondary" onClick={refresh}><CalendarDays size={17}/>Refresh</Button></div>{error && <div className="inline-notice notice-amber" role="alert">{error}</div>}
    <div className="shift-summary-row"><Card className="shift-summary-card"><span><Clock3 size={19}/></span><div><small>Recorded this week</small><strong>{total.toFixed(1)} hrs</strong></div></Card><Card className="shift-summary-card"><span className="summary-amber"><QrCode size={19}/></span><div><small>Overtime hours</small><strong>{overtime.toFixed(1)} hrs</strong></div></Card><Card className="shift-summary-card"><span className="summary-blue"><CheckCircle2 size={19}/></span><div><small>Next shift</small><strong>{next ? dayLabel(next.startsAt, language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-US') : 'Not scheduled'}</strong></div></Card></div>
    {next && <Card className="shift-action-card"><div className="shift-action-info"><span className="shift-icon"><MapPin size={20}/></span><div><p className="eyebrow">{next.state === 'working' ? 'Currently on shift' : 'Next scheduled shift'}</p><h2>{dayLabel(next.startsAt, language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-US')} · {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(next.startsAt))}</h2><span>{next.locationLabel} · {industry === 'construction' ? 'Site zone' : 'Department'}</span></div></div><ShiftAction shift={next} onUpdated={refresh}/></Card>}
    <section className="timeline-section"><div className="timeline-title"><div><p className="eyebrow">A simple weekly timeline</p><h2>Recent and upcoming</h2></div><span className="timeline-legend"><i/>Regular <i className="legend-overtime"/>Overtime</span></div>{visible.length ? <div className="timeline-list">{visible.map((shift, index) => { const day = new Date(shift.startsAt); const duration = Math.max(1, (new Date(shift.endsAt).getTime() - day.getTime()) / 3600000); const worked = shift.state === 'complete' ? shift.regularHours + shift.overtimeHours : shift.state === 'working' ? Math.max(0, (Date.now() - new Date(shift.checkedInAt ?? shift.startsAt).getTime()) / 3600000) : duration; const pct = Math.min(100, (worked / Math.max(duration, 8)) * 100); return <Card className="timeline-card" key={shift.id}><div className="timeline-date"><strong>{day.toLocaleDateString(undefined, { weekday: 'short' })}</strong><small>{day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></div><div className="timeline-details"><div className="timeline-detail-head"><strong>{shift.locationLabel}</strong><StatusPill status={shift.state === 'complete' ? 'resolved' : shift.state === 'working' ? 'in_progress' : 'submitted'}/></div><p>{new Date(shift.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – {new Date(shift.endsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}<span> · </span>{shift.state === 'complete' ? `${shift.regularHours.toFixed(1)} regular${shift.overtimeHours ? ` · ${shift.overtimeHours.toFixed(1)} overtime` : ''}` : shift.state === 'working' ? 'Clock is running' : 'Scheduled'}</p><div className="timeline-track"><span style={{ width: `${pct}%` }} className={shift.overtimeHours ? 'has-overtime' : ''}/></div></div>{index === 0 && shift.state !== 'complete' && <ShiftAction shift={shift} onUpdated={refresh}/>}</Card>; })}</div> : <EmptyState title="No shifts in this window" detail="Your upcoming shifts will appear here when they’re scheduled." icon={<CalendarDays size={22}/>}/>}</section>
    <div className="timeline-footnote"><Clock3 size={16}/><span>Regular hours are counted up to 8 hours per shift. Any hours above that are shown separately as overtime.</span><Link to="/worker/pay">See pay details <ArrowRight size={14}/></Link></div>
  </div>;
}
