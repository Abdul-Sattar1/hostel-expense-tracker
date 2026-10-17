import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { dbState } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { sameOrigin } from './middleware/security.js';
import authRoutes from './routes/authRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.isProd) app.set('trust proxy', 1);
  // Google Identity Services needs its script, iframe and sign-in popup; nothing else is relaxed.
  app.use(helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],
        'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
        'connect-src': ["'self'", 'https://accounts.google.com/gsi/'],
        'frame-src': ['https://accounts.google.com/gsi/'],
      },
    },
  }));
  if (!env.isProd) app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use('/api', sameOrigin);

  app.get('/api/health', (_req, res) => {
    const database = dbState();
    const ok = database !== 'disconnected';
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/budgets', budgetRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));

  if (env.isProd) {
    app.use(express.static(clientDist));
    // React routes get index.html; a missing file (anything with an extension, e.g. a stale /assets/*.js)
    // must be a real 404, not HTML that the browser would try to run.
    app.use((req, res) => (path.extname(req.path) ? res.status(404).type('text/plain').send('Not found') : res.sendFile(path.join(clientDist, 'index.html'))));
  }

  app.use(errorHandler);
  return app;
}
