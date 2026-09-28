import express from 'express';

const app = express();
const port = 4000;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Helpdesk backend is running' });
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

app.use((error, _req, res, _next) => {
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  res.status(status).json({ message: status === 500 ? 'Internal server error' : 'Invalid request' });
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Helpdesk API running at http://127.0.0.1:${port}`);
});

server.on('error', (error) => {
  console.error(`Unable to start backend: ${error.message}`);
  process.exit(1);
});
