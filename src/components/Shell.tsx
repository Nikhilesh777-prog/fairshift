import { useEffect, useState } from 'react';
import { Bell, BriefcaseBusiness, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, FileText, Home, Menu, Moon, Search, ShieldAlert, Sparkles, Sun, UserRound, Users, X } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { DemoSwitcher } from './DemoSwitcher';
import { OnlineStatus } from './OnlineStatus';
import { LanguageToggle } from './LanguageToggle';
import { SpeechHelp } from './SpeechHelp';
import { useSession } from '@/lib/session';
import { translate } from '@/lib/i18n';
import { api } from '@/data/api';
import type { Industry } from '@/lib/types';
import { INDUSTRIES } from '@/lib/industry';
import toast from 'react-hot-toast';

const workerNav = [
  { to: '/worker', key: 'nav.home', icon: Home, end: true }, { to: '/worker/shifts', key: 'nav.shifts', icon: BriefcaseBusiness },
  { to: '/worker/pay', key: 'nav.pay', icon: FileText }, { to: '/worker/safety', key: 'nav.safety', icon: ShieldAlert }, { to: '/worker/me', key: 'nav.me', icon: UserRound },
];
const adminNav = [
  { to: '/admin', key: 'nav.dashboard', icon: Home, end: true }, { to: '/admin/people', key: 'nav.people', icon: Users },
  { to: '/admin/safety', key: 'nav.reports', icon: ShieldAlert }, { to: '/admin/feedback', key: 'nav.feedback', icon: Sparkles }, { to: '/admin/skills', key: 'nav.skills', icon: ClipboardCheck },
];
export function AppShell({ children }: { children?: React.ReactNode }) {
  const { user, setUser, industry, setIndustry, language, dark, setDark } = useSession();
  const navigate = useNavigate(); const location = useLocation();
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [notifications, setNotifications] = useState(0); const [search, setSearch] = useState('');
  const isAdmin = user?.role === 'admin'; const nav = isAdmin ? adminNav : workerNav;
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { if (isAdmin) api.notifications().then(value => setNotifications(value.notifications.length)).catch(() => setNotifications(0)); }, [isAdmin, user?.industry]);
  const changeSector = async (value: Industry) => {
    if (!user || value === user.industry) return;
    const mappedRole = user.role;
    try { const result = await api.demoSwitch(mappedRole, value); setUser(result.user); setIndustry(value); navigate(mappedRole === 'admin' ? '/admin' : '/worker'); toast.success(`Switched to ${INDUSTRIES[value].shortLabel}`); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Sector could not be switched.'); }
  };
  const logout = async () => { try { await api.logout(); } finally { setUser(null); navigate('/'); toast.success('You are signed out.'); } };
  const shellClass = `${isAdmin ? 'shell shell-admin' : 'shell shell-worker'} ${collapsed && isAdmin ? 'sidebar-collapsed' : ''}`;
  return <div className={shellClass}>
    {isAdmin && <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><Logo/>{mobileOpen && <button className="icon-button mobile-menu-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20}/></button>}</div><div className="side-org"><span className="org-dot"/><span><small>{INDUSTRIES[industry].label}</small><strong>{user?.organizationName}</strong></span></div><nav className="side-nav" aria-label="Admin navigation">{nav.map(item => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><item.icon size={19}/><span>{translate(language, item.key)}</span>{item.key === 'nav.reports' && notifications > 0 && <small className="nav-count">{notifications}</small>}</NavLink>)}</nav><div className="sidebar-bottom"><div className="sdg-note"><div><span>8</span><strong>Decent work<br/> & growth</strong></div><p>Clear signals. Better shifts.</p></div><button type="button" className="nav-link" onClick={() => navigate('/admin#team-wellbeing')}><CircleHelp size={19}/><span>Team wellbeing</span></button><button type="button" className="nav-link" onClick={logout}><UserRound size={19}/><span>Sign out</span></button><button className="collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}<span>Collapse</span></button></div></aside>}
    {mobileOpen && isAdmin && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <div className="shell-main">
      <header className="topbar"><div className="topbar-left">{isAdmin && <button className="icon-button mobile-menu-open" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={21}/></button>}{!isAdmin && <Logo/>}<div className="topbar-title"><span className="role-label">{isAdmin ? 'FairShift for teams' : 'Your FairShift'}</span><strong>{user?.organizationName}</strong></div></div>
        <div className="topbar-actions"><OnlineStatus/>{isAdmin && <label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team, person, reports…" aria-label="Search" onKeyDown={e => { if (e.key === 'Enter') navigate(`/admin/people?q=${encodeURIComponent(search)}`); }}/></label>}<label className="org-select"><span className="sr-only">Organisation type</span><select aria-label="Organisation type" value={industry} onChange={e => changeSector(e.target.value as Industry)}><option value="construction">Construction</option><option value="campus">Campus</option></select></label><LanguageToggle/><button className="icon-button" type="button" aria-label={dark ? 'Use light mode' : 'Use dark mode'} onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>{isAdmin && <button className="icon-button notification-button" type="button" aria-label={`${notifications} notifications`} onClick={() => navigate('/admin/safety')}><Bell size={18}/>{notifications > 0 && <i>{notifications}</i>}</button>}</div>
      </header>
      {!isAdmin && <div className="worker-banner"><span className="live-dot"/><span>{INDUSTRIES[industry].shortLabel}</span><span className="banner-divider"/><span>{user?.team}</span><button type="button" onClick={logout}>Sign out</button></div>}
      <main className={`page-content ${isAdmin ? 'admin-page-content' : 'worker-page-content'}`}>{children ?? <Outlet/>}</main>
      {!isAdmin && <nav className="bottom-nav" aria-label="Worker navigation">{workerNav.map(item => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}><item.icon size={21}/><span>{translate(language, item.key)}</span></NavLink>)}</nav>}
      {!isAdmin && <SpeechHelp/>}
      <DemoSwitcher/>
    </div>
  </div>;
}
