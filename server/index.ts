import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createServer as createViteServer } from 'vite';
import apiRouter from './routes';
import { attachAuthRoutes, sessionMiddleware } from './auth';

const app = express();
const port = Number(process.env.PORT) || 3000;
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '700kb' }));
app.use(sessionMiddleware);

app.get('/health', (_req, res) => res.status(200).json({ ok: true, service: 'fairshift' }));
attachAuthRoutes(app);
app.use('/api', apiRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'That FairShift action was not found.' }));

if (existsSync(path.resolve('dist/index.html'))) {
  app.use(express.static(path.resolve('dist'), { index: false, maxAge: '1h' }));
  app.get(/.*/, (_req, res) => res.sendFile(path.resolve('dist/index.html')));
  app.listen(port, '0.0.0.0', () => console.log(`FairShift listening on ${port}`));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true, host: '0.0.0.0' }, appType: 'custom' });
  app.use(vite.middlewares);
  app.get(/.*/, async (_req, res, next) => {
    try {
      const html = await vite.transformIndexHtml('/', await import('node:fs/promises').then(fs => fs.readFile('index.html', 'utf8')));
      res.status(200).type('html').send(html);
    } catch (error) { next(error); }
  });
  app.listen(port, '0.0.0.0', () => console.log(`FairShift preview listening on ${port}`));
}
