import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { 50: '#edf7f2', 100: '#d7eee2', 500: '#258264', 600: '#176b52', 700: '#125640', 900: '#10382d' },
        amber: { 50: '#fff8e8', 100: '#ffefc2', 500: '#e6a02b', 600: '#bb7810' },
        sky: { 50: '#eff7ff', 100: '#d9edff', 600: '#2872ad' },
        ink: '#172a24',
        canvas: '#f7f8f5',
      },
      boxShadow: { soft: '0 12px 34px rgba(24, 54, 43, .07)' },
      borderRadius: { '2xl': '1.25rem' },
      fontFamily: { sans: ['Inter', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
