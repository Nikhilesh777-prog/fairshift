import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
  server: { host: '0.0.0.0', port: Number(process.env.PORT) || 3000 },
});
