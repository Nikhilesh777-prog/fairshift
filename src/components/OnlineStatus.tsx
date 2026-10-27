import { useEffect, useState } from 'react';
import { CloudOff, LoaderCircle, Wifi } from 'lucide-react';
import { pendingCount } from '@/data/api';

export function OnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(pendingCount);
  useEffect(() => {
    const on = () => { setOnline(navigator.onLine); setPending(pendingCount()); };
    const synced = () => setPending(pendingCount());
    window.addEventListener('online', on); window.addEventListener('offline', on);
    window.addEventListener('fairshift:queued', synced); window.addEventListener('fairshift:sync', synced);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); window.removeEventListener('fairshift:queued', synced); window.removeEventListener('fairshift:sync', synced); };
  }, []);
  const title = !online ? `${pending} action${pending === 1 ? '' : 's'} saved on this device until you reconnect.` : pending ? `${pending} saved action${pending === 1 ? '' : 's'} waiting for the signed-in demo account.` : 'Connected to the FairShift service.';
  return <span className={`online-status ${online ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite" title={title}>
    {online ? pending ? <LoaderCircle size={14}/> : <Wifi size={14}/> : <CloudOff size={14}/>}
    <span>{online ? pending ? `${pending} saved` : 'Online' : pending ? `Offline · ${pending} saved` : 'Offline'}</span>
  </span>;
}
