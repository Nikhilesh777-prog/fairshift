import { useState } from 'react';
import { MapPin, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/data/api';
import { useSession } from '@/lib/session';
import type { Shift } from '@/lib/types';
import { Button } from './ui';
import { QrScanner } from './QrScanner';

export function ShiftAction({ shift, onUpdated, large = false }: { shift: Shift; onUpdated: () => void; large?: boolean }) {
  const [open, setOpen] = useState(false); const [checkLocation, setCheckLocation] = useState(false); const [busy, setBusy] = useState(false);
  const { user } = useSession();
  const action = shift.state === 'working' ? 'out' : 'in';
  const submit = async (code: string) => {
    setBusy(true);
    try {
      let position: GeolocationPosition | undefined;
      if (checkLocation) {
        if (!navigator.geolocation) throw new Error('Location is not available in this browser. Try again without the optional location check.');
        position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })).catch(() => { throw new Error('Location could not be checked. Try again without the optional location check.'); });
      }
      const qrToken = code === 'SIMULATE' ? `fairshift:${user?.industry ?? 'construction'}` : code;
      await api.shiftEvent(shift.id, action, qrToken, position);
      toast.success(action === 'in' ? 'You’re checked in. Have a good shift.' : 'You’re checked out. Your hours are saved.');
      if (position) toast.success('Location permission confirmed.');
      setOpen(false); onUpdated();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update this shift.'); }
    finally { setBusy(false); }
  };
  return <><div className="shift-action-block"><label className="location-option"><input type="checkbox" checked={checkLocation} onChange={event => setCheckLocation(event.target.checked)}/><MapPin size={15}/><span>Also check my location</span></label><Button size={large ? 'lg' : 'md'} onClick={() => setOpen(true)} disabled={busy} className={large ? 'full-width' : ''}><QrCode size={18}/>{action === 'in' ? 'Check in' : 'Check out'}</Button></div>{open && <QrScanner title={action === 'in' ? 'Scan to check in' : 'Scan to check out'} onScan={code => { void submit(code); }} onClose={() => setOpen(false)}/>}</>;
}
