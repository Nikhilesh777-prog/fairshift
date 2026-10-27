import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, persistOfflineUser, syncPendingActions } from '@/data/api';
import { readLanguage } from './i18n';
import type { Industry, Language, User } from './types';

interface SessionContextValue {
  user: User | null; setUser: (user: User | null) => void; ready: boolean;
  language: Language; setLanguage: (language: Language) => void;
  dark: boolean; setDark: (dark: boolean) => void;
  industry: Industry; setIndustry: (industry: Industry) => void;
}
const SessionContext = createContext<SessionContextValue | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [userState, setUserState] = useState<User | null>(null);
  const setUser = useCallback((user: User | null) => { persistOfflineUser(user); setUserState(user); }, []);
  const [ready, setReady] = useState(false);
  const [language, setLanguageState] = useState<Language>(readLanguage);
  const [dark, setDarkState] = useState(() => localStorage.getItem('fairshift-theme') === 'dark');
  const [industry, setIndustryState] = useState<Industry>(() => (localStorage.getItem('fairshift-industry') as Industry) || 'construction');
  useEffect(() => {
    api.getSession().then(result => { setUser(result.user); if (result.user) setIndustryState(result.user.industry); }).catch(() => setUser(null)).finally(() => { setReady(true); void syncPendingActions(); });
  }, [setUser]);
  useEffect(() => {
    const reconnect = async () => {
      if (!userState || !navigator.onLine) return;
      try {
        const current = await api.getSession();
        const sameDemo = current.user && current.user.employeeId === userState.employeeId && current.user.role === userState.role && current.user.industry === userState.industry;
        const restored = sameDemo ? current.user! : (await api.demoSwitch(userState.role, userState.industry)).user;
        setUser(restored); setIndustryState(restored.industry); await syncPendingActions();
      } catch { /* Keep the cached demo open; its pending actions remain local. */ }
    };
    window.addEventListener('online', reconnect); return () => window.removeEventListener('online', reconnect);
  }, [userState, setUser]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('fairshift-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { localStorage.setItem('fairshift-language', language); document.documentElement.lang = language; }, [language]);
  useEffect(() => { localStorage.setItem('fairshift-industry', industry); }, [industry]);
  const value = useMemo(() => ({ user: userState, setUser, ready, language, setLanguage: setLanguageState, dark, setDark: setDarkState, industry, setIndustry: setIndustryState }), [userState, setUser, ready, language, dark, industry]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
