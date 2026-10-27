import { ArrowRight, BadgeCheck, Banknote, Bell, ChevronRight, Heart, Languages, LogOut, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSession } from '@/lib/session';
import { INDUSTRIES } from '@/lib/industry';
import { initials } from '@/lib/utils';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button, Card } from '@/components/ui';
import { api } from '@/data/api';

const links = [
  { to: '/worker/pay', icon: Banknote, title: 'My pay', detail: 'See each part of your payslip', tint: 'honey' },
  { to: '/worker/skills', icon: BadgeCheck, title: 'Skill passport', detail: 'Training and experience', tint: 'mint' },
  { to: '/worker/feedback', icon: Sparkles, title: 'Anonymous feedback', detail: 'Share what could improve', tint: 'lavender' },
  { to: '/worker/wellbeing', icon: Heart, title: 'Wellbeing hub', detail: 'A private check-in and support', tint: 'coral' },
  { to: '/worker/safety', icon: ShieldCheck, title: 'My safety reports', detail: 'Follow your updates', tint: 'blue' },
];
export default function Me() {
  const { user, setUser, dark, setDark } = useSession(); const navigate = useNavigate();
  const signOut = async () => { try { await api.logout(); } finally { setUser(null); navigate('/'); toast.success('You are signed out.'); } };
  return <div className="page-enter me-page"><div className="section-heading"><div><p className="eyebrow">Your FairShift</p><h1>Me</h1></div></div><Card className="profile-card"><div className="profile-avatar">{initials(user?.displayName ?? 'FS')}</div><div className="profile-info"><p className="eyebrow">Worker demo · {INDUSTRIES[user?.industry ?? 'construction'].shortLabel}</p><h2>{user?.displayName}</h2><span>{user?.team} · {user?.organizationName}</span></div><span className="profile-verified"><BadgeCheck size={16}/>Demo profile</span></Card><div className="profile-links">{links.map(item => <Link to={item.to} className="profile-link" key={item.to}><span className={`quick-link-icon ${item.tint}`}><item.icon size={19}/></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={18}/></Link>)}</div><Card className="settings-card"><div className="settings-row"><span className="settings-icon"><Languages size={19}/></span><span><strong>Language</strong><small>English · हिन्दी · தமிழ்</small></span><LanguageToggle/></div><div className="settings-row"><span className="settings-icon"><Bell size={19}/></span><span><strong>Display</strong><small>{dark ? 'Dark mode' : 'Light mode'}</small></span><Button variant="secondary" size="sm" onClick={() => setDark(!dark)}>{dark ? 'Use light mode' : 'Use dark mode'}</Button></div><Link to="/sectors" className="settings-row"><span className="settings-icon"><UserRound size={19}/></span><span><strong>How FairShift works</strong><small>Construction and campus</small></span><ArrowRight size={16}/></Link></Card><Button variant="ghost" className="signout-button" onClick={() => void signOut()}><LogOut size={17}/> Sign out of this demo</Button><p className="profile-disclaimer">This is sample demo data. It is not a payroll or emergency service.</p></div>;
}
