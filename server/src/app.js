import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { isDatabaseReady } from './config/database.js';
import { protectOrigin } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cookieParser());
app.use('/api', protectOrigin);
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', authRouter);

// Liveness: the API process can respond, independently of the database.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Helpdesk backend is running' });
});

// Readiness: database operations can be served right now.
app.get('/api/ready', async (_req, res) => {
  const ready = await isDatabaseReady();
  res.set('Cache-Control', 'no-store');
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'error',
    database: ready ? 'connected' : 'disconnected',
  });
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

app.use((error, _req, res, _next) => {
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  res.status(status).json({ message: status === 500 ? 'Internal server error' : 'Invalid request' });
});
