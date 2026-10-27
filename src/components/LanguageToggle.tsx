import { Globe2 } from 'lucide-react';
import { useSession } from '@/lib/session';
import type { Language } from '@/lib/types';
export function LanguageToggle() {
  const { language, setLanguage } = useSession();
  return <label className="language-toggle"><Globe2 size={17} aria-hidden="true"/><span className="sr-only">Language</span><select aria-label="Language" value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option></select></label>;
}
