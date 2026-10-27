import { Check } from 'lucide-react';
export function Logo({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark" aria-hidden="true"><span>F</span><Check size={15} strokeWidth={3} /></span>{!compact && <span className="brand-name">Fair<span>Shift</span></span>}</span>;
}
