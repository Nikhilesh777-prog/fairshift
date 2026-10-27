export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');
export const money = (minorUnits: number, currency = 'INR', locale = 'en-IN') => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(minorUnits / 100);
export const dayLabel = (value: string, locale = 'en-US') => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
export const dateLabel = (value: string, locale = 'en-US') => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
export const hoursBetween = (start: string, end: string) => Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
export const cleanText = (value: string, max = 600) => value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
export const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase();
