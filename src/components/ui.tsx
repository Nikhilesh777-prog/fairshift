import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { cx } from '@/lib/utils';
import type { SafetyStatus } from '@/lib/types';

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  return <button className={cx('btn', `btn-${variant}`, `btn-${size}`, className)} {...props}>{children}</button>;
}
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cx('card', className)} {...props}>{children}</div>; }
export function SectionTitle({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{detail && <p className="section-detail">{detail}</p>}</div>{action}</div>;
}
export function StatusPill({ status }: { status: SafetyStatus }) {
  const labels: Record<SafetyStatus, string> = { submitted: 'Submitted', seen: 'Seen', in_progress: 'In progress', resolved: 'Resolved' };
  return <span className={`status-pill status-${status}`}><span aria-hidden="true" className="status-dot" />{labels[status]}</span>;
}
export function EmptyState({ title, detail, icon }: { title: string; detail: string; icon?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon" aria-hidden="true">{icon ?? <Sparkles size={22} />}</div><strong>{title}</strong><p>{detail}</p></div>;
}
export function LoadingState({ label = 'Loading your FairShift…' }: { label?: string }) { return <div className="loading-state"><LoaderCircle size={23} className="spin" aria-hidden="true"/><span>{label}</span></div>; }
export function Field({ label, hint, error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return <label className={cx('field', className)}><span>{label}</span><input {...props} aria-invalid={Boolean(error)} />{hint && !error && <small>{hint}</small>}{error && <small className="field-error">{error}</small>}</label>;
}
export function TextArea({ label, hint, error, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  return <label className={cx('field', className)}><span>{label}</span><textarea {...props} aria-invalid={Boolean(error)} />{hint && !error && <small>{hint}</small>}{error && <small className="field-error">{error}</small>}</label>;
}
export function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}>×</button><h2>{title}</h2>{description && <p>{description}</p>}{children}</section></div>;
}
