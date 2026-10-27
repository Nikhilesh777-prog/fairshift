import { useState } from 'react';
import { ArrowDownRight, ArrowRight, BadgeCheck, Banknote, HardHat, HeartHandshake, Leaf, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Logo } from '@/components/Logo';
import { DemoSwitcher } from '@/components/DemoSwitcher';
import { Button, Card, Modal } from '@/components/ui';
import { useSession } from '@/lib/session';
import { api } from '@/data/api';

const features = [
  { icon: BadgeCheck, title: 'Hours you can trust', text: 'Simple shift records show regular time, overtime, and rest in one place.', tint: 'mint' },
  { icon: Banknote, title: 'Pay without guesswork', text: 'See what you earned, how overtime is counted, and what changed this month.', tint: 'amber' },
  { icon: ShieldCheck, title: 'Safer, together', text: 'Raise a concern in a few taps and follow it from sent to resolved.', tint: 'blue' },
  { icon: HeartHandshake, title: 'A voice with dignity', text: 'Share anonymous feedback, build your skills, and check in on wellbeing.', tint: 'rose' },
];
const tour = [
  { title: 'Start with one clear view', text: 'Try a worker or admin account. No setup or real staff data is needed to explore the demos.' },
  { title: 'Follow a worker’s shift', text: 'Check in with a simulated site QR, review a transparent payslip, or send a safety concern.' },
  { title: 'See the team signals', text: 'Switch to Admin to review attendance, safety status, team-level feedback, and gentle fatigue alerts.' },
];
export default function Landing() {
  const [tourOpen, setTourOpen] = useState(false); const [tourStep, setTourStep] = useState(0); const [busy, setBusy] = useState(false);
  const { setUser, setIndustry, dark, setDark } = useSession(); const navigate = useNavigate();
  const enterDemo = async (role: 'worker' | 'admin') => {
    setBusy(true);
    try { const result = await api.demoSwitch(role, 'construction'); setUser(result.user); setIndustry('construction'); navigate(role === 'admin' ? '/admin' : '/worker'); toast.success(`${role === 'admin' ? 'Admin' : 'Worker'} demo is ready.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start the demo.'); navigate('/login'); }
    finally { setBusy(false); }
  };
  return <div className="landing-page">
    <header className="public-header"><Link to="/" aria-label="FairShift home"><Logo/></Link><nav aria-label="Main navigation"><Link to="/sectors">Across sectors</Link><a href="#how-it-works">How it works</a></nav><div className="public-actions"><LanguageToggle/><button className="icon-button" type="button" onClick={() => setDark(!dark)} aria-label={dark ? 'Use light mode' : 'Use dark mode'}>{dark ? '☀' : '◐'}</button><Link className="login-link" to="/login">Sign in</Link></div></header>
    <main>
      <section className="hero-wrap">
        <div className="hero-content"><p className="hero-kicker"><span className="kicker-dot"/>Built for people who keep the day moving</p><h1>Your work.<br/><span>Clearly valued.</span></h1><p className="hero-copy">FairShift brings hours, pay, safety and wellbeing into one clear place — for every shift, across every team.</p><div className="hero-actions"><Button size="lg" onClick={() => enterDemo('worker')} disabled={busy}>Try Worker Demo <ArrowRight size={18}/></Button><Button variant="secondary" size="lg" onClick={() => enterDemo('admin')} disabled={busy}>Try Admin Demo <ArrowRight size={18}/></Button></div><button className="tour-link" type="button" onClick={() => { setTourStep(0); setTourOpen(true); }}><Sparkles size={16}/>Take the 2-minute tour <ArrowDownRight size={15}/></button>
          <div className="hero-trust"><div className="avatar-stack"><span>AP</span><span>MK</span><span>JL</span></div><p>Built around clarity, fairness<br/>and a safer shift.</p></div></div>
        <div className="hero-art" aria-label="FairShift example dashboard illustration"><div className="sun-orb"/><div className="hero-card-mini"><div className="mini-top"><span>YOUR SHIFT</span><span className="mini-live"><i/>ON TRACK</span></div><div className="mini-date">Today · North scaffolding</div><div className="mini-hours">7.5 <small>hrs</small></div><div className="mini-bar"><span/></div><div className="mini-foot"><span><i className="status-good"/>Regular hours</span><strong>5.5 h</strong></div><div className="mini-foot"><span><i className="status-amber"/>Overtime</span><strong>2.0 h</strong></div><div className="mini-pay"><span className="mini-pay-icon"><Banknote size={19}/></span><div><small>PAY THIS MONTH</small><strong>$3,185</strong></div><span className="mini-pay-check"><BadgeCheck size={18}/></span></div></div><div className="float-note note-safety"><span><ShieldCheck size={17}/></span><div><strong>Concern tracked</strong><small>Update: in progress</small></div></div><div className="float-note note-rest"><span><Leaf size={17}/></span><div><strong>Rest matters</strong><small>Next shift · 14 hrs away</small></div></div><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/></div>
      </section>
      <section className="impact-strip" aria-label="UN Sustainable Development Goal 8"><div className="sdg-eight"><span>8</span><div><strong>Decent work</strong><small>& economic growth</small></div></div><p>Small signals that support safer, fairer work.</p><div className="impact-tags"><span>Clear hours</span><span>Transparent pay</span><span>Worker voice</span></div></section>
      <section className="features-section" id="how-it-works"><div className="section-intro"><p className="eyebrow">One app. A better workday.</p><h2>Fairness should be<br/><span>easy to see.</span></h2><p>Give every person the same clear picture — and give teams a kinder way to act on what they learn.</p></div><div className="feature-cards">{features.map(item => <Card className="feature-card" key={item.title}><div className={`feature-icon ${item.tint}`}><item.icon size={21}/></div><h3>{item.title}</h3><p>{item.text}</p><span className="feature-arrow"><ArrowRight size={17}/></span></Card>)}</div></section>
      <section className="sectors-teaser"><div className="sectors-copy"><p className="eyebrow">One fair standard. Different workdays.</p><h2>Designed to fit<br/>the work <em>you do.</em></h2><p>Construction teams and campus crews have different shifts, zones and risks. FairShift adapts the language and safety categories without changing the promise: clear, dignified work.</p><Link className="text-link" to="/sectors">See how it works across sectors <ArrowRight size={16}/></Link></div><div className="sector-cards"><Card className="sector-card"><span className="sector-icon construction"><HardHat size={23}/></span><div><strong>Construction site</strong><p>Zones · daily-wage shifts · site safety</p></div><span>01</span></Card><Card className="sector-card"><span className="sector-icon campus"><Users size={23}/></span><div><strong>College campus</strong><p>Departments · staff shifts · campus safety</p></div><span>02</span></Card></div></section>
      <section className="closing-cta"><div><p className="eyebrow">Make every shift count.</p><h2>A clearer day starts<br/>with one small step.</h2></div><div className="closing-buttons"><Button size="lg" onClick={() => enterDemo('worker')}>Explore as a worker <ArrowRight size={18}/></Button><Button variant="ghost" onClick={() => enterDemo('admin')}>View the team dashboard <ArrowRight size={17}/></Button></div><div className="cta-mark" aria-hidden="true"><Leaf size={76}/></div></section>
    </main>
    <footer className="public-footer"><Logo compact/><p>FairShift · Decent work, made visible.</p><Link to="/sectors">Across sectors</Link><span>Built for SDG 8</span></footer>
    <DemoSwitcher/>
    {tourOpen && <Modal title="Try the demo" description={`Step ${tourStep + 1} of ${tour.length}`} onClose={() => setTourOpen(false)}><div className="tour-content"><span className="tour-step">0{tourStep + 1}</span><h3>{tour[tourStep]?.title}</h3><p>{tour[tourStep]?.text}</p><div className="tour-progress">{tour.map((_, index) => <i key={index} className={index <= tourStep ? 'active' : ''}/>)}</div><div className="modal-actions"><Button variant="ghost" onClick={() => setTourOpen(false)}>Close tour</Button>{tourStep < tour.length - 1 ? <Button onClick={() => setTourStep(tourStep + 1)}>Next <ArrowRight size={16}/></Button> : <Button onClick={() => { setTourOpen(false); void enterDemo('worker'); }}>Try Worker Demo <ArrowRight size={16}/></Button>}</div></div></Modal>}
  </div>;
}
