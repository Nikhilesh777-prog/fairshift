import { ArrowLeft, ArrowRight, Building2, GraduationCap, HardHat, Shield, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button, Card } from '@/components/ui';
import { INDUSTRIES } from '@/lib/industry';
import { DemoSwitcher } from '@/components/DemoSwitcher';

export default function Sectors() {
  return <div className="sectors-page">
    <header className="public-header">
      <Link to="/" aria-label="FairShift home"><Logo /></Link>
      <nav aria-label="Main navigation"><Link to="/">Home</Link><Link to="/sectors" aria-current="page">Across sectors</Link></nav>
      <div className="public-actions"><LanguageToggle /><Link className="login-link" to="/login">Sign in</Link></div>
    </header>

    <main className="sectors-main">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to FairShift</Link>
      <p className="eyebrow">One fair standard. Different workdays.</p>
      <h1>FairShift meets<br /><span>you where you work.</span></h1>
      <p className="sectors-lede">The way work is organized changes from site to campus. The need for clear hours, fair pay, a safe voice and real rest does not.</p>

      <div className="sector-compare">
        <Card className="sector-detail-card construction-sector">
          <figure className="sector-photo">
            <img src="/manus-storage/async-images/ucLYlqKQZRuojpcm6NXs5y/image-2.webp" alt="Construction supervisor and teammate coordinating safely at a job site" loading="lazy" decoding="async" />
            <figcaption><span>FIELD NOTE 01 · SITE WORK</span><strong>Safety is everyone’s shift.</strong></figcaption>
          </figure>
          <div className="sector-detail-head construction-detail"><span><HardHat size={24} /></span><div><small>INDUSTRY 01</small><h2>{INDUSTRIES.construction.label}</h2></div></div>
          <p>For crews coordinating a changing site, FairShift speaks in site zones and daily-wage shifts — with hazard categories teams recognize.</p>
          <div className="sector-detail-row"><Building2 size={18} /><div><small>Where people work</small><strong>Site zones</strong><span>{INDUSTRIES.construction.zones.slice(0, 3).join(' · ')}</span></div></div>
          <div className="sector-detail-row"><Users size={18} /><div><small>Shift patterns</small><strong>Day · evening · night crews</strong><span>{INDUSTRIES.construction.shiftTemplates[0]}</span></div></div>
          <div className="sector-detail-row"><Shield size={18} /><div><small>Safety categories</small><strong>Built around site risks</strong><span>{INDUSTRIES.construction.hazards.slice(0, 4).join(' · ')}</span></div></div>
          <div className="sector-detail-row"><Wallet size={18} /><div><small>Pay rhythm</small><strong>Daily-wage clarity</strong><span>Regular time, overtime and deductions in plain language.</span></div></div>
        </Card>

        <Card className="sector-detail-card campus-sector">
          <figure className="sector-photo">
            <img src="/manus-storage/async-images/ucLYlqKQZRuojpcm6NXs5y/image-3.webp" alt="Campus facilities colleagues coordinating a shift beside a leafy college building" loading="lazy" decoding="async" />
            <figcaption><span>FIELD NOTE 02 · CAMPUS LIFE</span><strong>Care makes the day work.</strong></figcaption>
          </figure>
          <div className="sector-detail-head campus-detail"><span><GraduationCap size={24} /></span><div><small>INDUSTRY 02</small><h2>{INDUSTRIES.campus.label}</h2></div></div>
          <p>For campus teams supporting students, labs and facilities, FairShift uses departments and staff shifts — with relevant safety prompts.</p>
          <div className="sector-detail-row"><Building2 size={18} /><div><small>Where people work</small><strong>Departments</strong><span>{INDUSTRIES.campus.zones.slice(0, 3).join(' · ')}</span></div></div>
          <div className="sector-detail-row"><Users size={18} /><div><small>Shift patterns</small><strong>Morning · day · evening staff</strong><span>{INDUSTRIES.campus.shiftTemplates[1]}</span></div></div>
          <div className="sector-detail-row"><Shield size={18} /><div><small>Safety categories</small><strong>Built around campus risks</strong><span>{INDUSTRIES.campus.hazards.slice(0, 4).join(' · ')}</span></div></div>
          <div className="sector-detail-row"><Wallet size={18} /><div><small>Pay rhythm</small><strong>Staff payslips</strong><span>Base, additional hours and deductions — all explained.</span></div></div>
        </Card>
      </div>

      <section className="sectors-bottom">
        <div><p className="eyebrow">Same promise, wherever the shift takes you</p><h2>Clear work.<br />A fairer day.</h2></div>
        <p>Switch organisation type at any time in the demo. Routes, safety examples and sample teams update together; the worker-first tools stay familiar.</p>
        <Button onClick={() => window.location.assign('/login')}>Try both demos <ArrowRight size={17} /></Button>
      </section>
    </main>

    <footer className="public-footer"><Logo compact /><p>FairShift · Decent work, made visible.</p><span>UN SDG 8</span></footer>
    <DemoSwitcher />
  </div>;
}
