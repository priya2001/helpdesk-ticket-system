import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { User } from './models/User.js';
import { Ticket } from './models/Ticket.js';
import { Session } from './models/Session.js';
import { getAuthConfig } from './config/auth.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
const port = 4000;

try {
  getAuthConfig();
  await connectDatabase(process.env.MONGODB_URI);
  // Ensure the unique email index exists before accepting requests.
  await Promise.all([User.init(), Ticket.init(), Session.init()]);
  console.log('MongoDB connected');

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('error', () => console.error('MongoDB connection error. Check database availability.'));

  const server = app.listen(port, '127.0.0.1', (error) => {
    if (!error) console.log(`Helpdesk API running at http://127.0.0.1:${port}`);
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
  console.error(error.message.startsWith('MongoDB connection failed') || error.message.startsWith('Set a valid MONGODB_URI') || error.message.startsWith('Set JWT_SECRET') || error.message.startsWith('APP_ORIGIN must')
    ? error.message
    : 'Database initialization failed. Check database permissions and indexes.');
  await mongoose.disconnect();
  process.exit(1);
}
