import { useState } from 'react';
import { ArrowRightLeft, Building2, ChevronDown, LoaderCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '@/data/api';
import { useSession } from '@/lib/session';
import type { Industry, Role } from '@/lib/types';
export function DemoSwitcher() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setUser, industry, setIndustry, user } = useSession();
  const [role, setRole] = useState<Role>(user?.role ?? 'worker');
  const [sector, setSector] = useState<Industry>(industry);
  const navigate = useNavigate();
  const switchDemo = async () => {
    setBusy(true);
    try {
      const result = await api.demoSwitch(role, sector);
      setUser(result.user); setIndustry(sector); navigate(role === 'admin' ? '/admin' : '/worker'); setOpen(false);
      toast.success(`Now viewing ${sector === 'construction' ? 'Construction' : 'Campus'} ${role} demo`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not switch demos.'); }
    finally { setBusy(false); }
  };
  return <div className="demo-switcher"><button type="button" className="demo-switcher-trigger" aria-expanded={open} onClick={() => setOpen(!open)}><ArrowRightLeft size={17}/><span>Demo switcher</span><ChevronDown size={14}/></button>{open && <div className="demo-popover" role="dialog" aria-label="Switch demo"><div className="demo-popover-head"><strong>Jump to a view</strong><button type="button" aria-label="Close demo switcher" onClick={() => setOpen(false)}><X size={16}/></button></div><label className="field"><span>Organisation</span><select value={sector} onChange={e => setSector(e.target.value as Industry)}><option value="construction">Construction Site</option><option value="campus">College-Campus</option></select></label><label className="field"><span>Role</span><select value={role} onChange={e => setRole(e.target.value as Role)}><option value="worker">Worker</option><option value="admin">Admin</option></select></label><button className="btn btn-primary btn-md demo-go" type="button" onClick={switchDemo} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Building2 size={17}/>}Switch view</button></div>}</div>;
}
