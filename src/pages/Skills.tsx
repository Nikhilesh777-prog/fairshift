import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, Copy, ExternalLink, Plus, Share2, ShieldCheck, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { api } from '@/data/api';
import { useSession } from '@/lib/session';
import type { Skill } from '@/lib/types';
import { dateLabel } from '@/lib/utils';
import { Button, Card, EmptyState, Field, LoadingState } from '@/components/ui';

export default function Skills() {
  const { user } = useSession();
  const [skills, setSkills] = useState<Skill[]>([]); const [shareToken, setShareToken] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(''); const [issuer, setIssuer] = useState(''); const [completedOn, setCompletedOn] = useState(new Date().toISOString().slice(0, 10)); const [shareable, setShareable] = useState(true);
  const load = useCallback(() => {
    setLoading(true); setError('');
    Promise.all([api.skills(), api.profile()]).then(([result, profile]) => { setSkills(result.skills); setShareToken(profile.shareToken); })
      .catch(problem => setError(problem instanceof Error ? problem.message : 'Your passport could not load.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, user?.industry]);
  const shareUrl = shareToken ? `${window.location.origin}/passport/${encodeURIComponent(shareToken)}` : '';
  const copy = async () => { if (!shareUrl) return; try { await navigator.clipboard.writeText(shareUrl); toast.success('Passport link copied.'); } catch { toast.error('Copy is unavailable. You can select the link below.'); } };
  const share = async () => { if (!shareUrl) return; if (navigator.share) { try { await navigator.share({ title: `${user?.displayName}'s Skill Passport`, url: shareUrl }); } catch { /* User closed the native share panel. */ } } else await copy(); };
  const add = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (title.trim().length < 3 || issuer.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(completedOn)) { setError('Add a skill, the person or organisation who taught it, and a valid date.'); return; }
    setSaving(true);
    try { await api.addSkill({ title: title.trim(), issuer: issuer.trim(), completedOn, shareable }); toast.success('Skill entry added. A manager can verify it.'); setTitle(''); setIssuer(''); setOpen(false); load(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not add your skill.'); }
    finally { setSaving(false); }
  };
  if (loading && !skills.length) return <LoadingState/>;
  return <div className="page-enter skills-page">
    <div className="section-heading"><div><p className="eyebrow">Experience that travels with you</p><h1>My Skill Passport</h1><p className="section-detail">Your training, experience and certifications — in one place you control.</p></div><span className="skills-badge"><ClipboardCheck size={22}/></span></div>
    {error && !open && <div className="inline-notice notice-amber" role="alert">{error}</div>}
    <div className="skill-passport-grid">
      <Card className="passport-card"><div className="passport-top"><div className="passport-brand"><span className="passport-brand-mark"><BadgeCheck size={20}/></span><div><small>FAIRSHIFT SKILL PASSPORT</small><strong>{user?.displayName}</strong></div></div><span className="passport-industry">{user?.organizationName}</span></div>
        <div className="passport-qr-row"><div><p className="eyebrow">Your experience, shareable</p><h2>Let your skills<br/>speak for you.</h2><p>Share a read-only view of the entries you’ve marked shareable. Your work schedule and pay stay private.</p><div className="passport-buttons"><Button onClick={share}><Share2 size={17}/>Share passport</Button><Button variant="secondary" onClick={copy}><Copy size={16}/>Copy link</Button></div></div><div className="passport-qr">{shareUrl ? <QRCodeSVG value={shareUrl} size={116} bgColor="transparent" fgColor="currentColor" includeMargin/> : <div className="qr-placeholder"><ClipboardCheck size={30}/></div>}<small>Scan to view</small></div></div>
        {shareUrl && <div className="share-url"><span>{shareUrl}</span><a href={shareUrl} target="_blank" rel="noreferrer" aria-label="Open public passport"><ExternalLink size={15}/></a></div>}
      </Card>
      <Card className="passport-privacy"><span className="privacy-shield"><ShieldCheck size={21}/></span><p className="eyebrow">Your information, your choice</p><h3>You choose what to share.</h3><ul><li><CheckCircle2 size={15}/>Only training entries marked shareable appear on the public page.</li><li><CheckCircle2 size={15}/>Your shifts, pay and safety reports are never part of the link.</li><li><CheckCircle2 size={15}/>Share links can be used by anyone who has the link.</li></ul><Button variant="secondary" onClick={() => window.print()}>Print passport</Button></Card>
    </div>
    <section className="skill-list-section"><div className="section-heading"><div><p className="eyebrow">Your learning record</p><h2>Training & experience</h2></div><div className="skill-list-actions"><span className="skill-count">{skills.length} entries</span><Button size="sm" onClick={() => { setOpen(!open); setError(''); }}><Plus size={15}/>{open ? 'Close form' : 'Add entry'}</Button></div></div>
      {open && <Card className="add-skill-form"><div className="add-form-title"><span><ClipboardCheck size={19}/></span><div><h2>Add to your passport</h2><p>Your entry will be marked unverified until a manager reviews it.</p></div><button type="button" className="icon-button" aria-label="Close entry form" onClick={() => setOpen(false)}><X size={17}/></button></div><form onSubmit={add} noValidate><Field label="Skill, training or experience" value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Working at heights" required maxLength={140}/><div className="form-row"><Field label="Taught or issued by" value={issuer} onChange={event => setIssuer(event.target.value)} placeholder="Training provider or workplace" required maxLength={140}/><Field label="Completed on" type="date" value={completedOn} onChange={event => setCompletedOn(event.target.value)} required/></div><label className="checkbox-setting"><input type="checkbox" checked={shareable} onChange={event => setShareable(event.target.checked)}/><span><strong>Include this entry in my shareable passport</strong><small>Only shareable entries appear through your public read-only link.</small></span></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add entry'}<Plus size={16}/></Button></div></form></Card>}
      {skills.length ? <div className="skills-grid">{skills.map(skill => <Card className="skill-card" key={skill.id}><div className={`skill-card-icon ${skill.verified ? 'verified' : ''}`}>{skill.verified ? <BadgeCheck size={20}/> : <BookOpen size={20}/>}</div><div className="skill-card-body"><div className="skill-card-heading"><h3>{skill.title}</h3>{skill.verified && <span className="verified-label"><CheckCircle2 size={13}/>Verified</span>}</div><p>{skill.issuer}</p><span className="skill-date"><CalendarDays size={14}/>{dateLabel(skill.completedOn)}</span></div><span className={`share-indicator ${skill.shareable ? 'shared' : ''}`}>{skill.shareable ? 'Shareable' : 'Private'}</span></Card>)}</div> : <EmptyState title="Your passport is ready for its first entry" detail="Add training or experience here. Your manager can verify it." icon={<ClipboardCheck size={22}/>}/>}</section>
  </div>;
}
