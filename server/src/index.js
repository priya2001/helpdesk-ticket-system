import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { User } from './models/User.js';
import { Ticket } from './models/Ticket.js';
import { Session } from './models/Session.js';
import { getAuthConfig } from './config/auth.js';
import { getServerConfig } from './config/server.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

try {
  getAuthConfig();
  const { port, host, trustProxy } = getServerConfig();
  app.set('trust proxy', trustProxy);
  await connectDatabase(process.env.MONGODB_URI);
  // Ensure the unique email index exists before accepting requests.
  await Promise.all([User.init(), Ticket.init(), Session.init()]);
  console.log('MongoDB connected');

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('error', () => console.error('MongoDB connection error. Check database availability.'));

  const server = app.listen(port, host, (error) => {
    if (!error) console.log(`Helpdesk API listening on ${host}:${port}`);
  });

  server.on('error', async (error) => {
    console.error(`Unable to start backend: ${error.code || 'unknown error'}`);
    await mongoose.disconnect();
    process.exit(1);
  });

  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      await mongoose.disconnect();
      clearTimeout(timeout);
      process.exit(0);
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(/^(MongoDB connection failed|Set a valid MONGODB_URI|Set JWT_SECRET|APP_ORIGIN must|PORT must|TRUST_PROXY_HOPS must)/.test(error.message)
    ? error.message
    : 'Database initialization failed. Check database permissions and indexes.');
  await mongoose.disconnect();
  process.exit(1);
}
