import en from '@/locales/en.json';
import hi from '@/locales/hi.json';
import ta from '@/locales/ta.json';
import type { Language } from './types';
const catalogs: Record<Language, Record<string, string>> = { en, hi, ta };
export const readLanguage = (): Language => (localStorage.getItem('fairshift-language') as Language) || 'en';
export function translate(language: Language, key: string): string { return catalogs[language][key] ?? catalogs.en[key] ?? key; }
