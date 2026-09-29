import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';

const email = process.argv[2]?.trim().toLowerCase();
if (process.argv.length !== 3 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run make-admin --workspace=server -- registered-email@example.com');
  process.exitCode = 1;
} else {
  const envPath = fileURLToPath(new URL('../.env', import.meta.url));
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  try {
    await connectDatabase(process.env.MONGODB_URI);
    const user = await User.findOneAndUpdate({ email }, { $set: { role: 'admin' } }, { returnDocument: 'after', runValidators: true });
    if (!user) {
      console.error('No registered account found for that email. Register first; no account was created.');
      process.exitCode = 1;
    } else {
      console.log(`Admin access enabled for ${user.email}. Refresh the app to load the updated role.`);
    }
  } catch {
    console.error('Unable to enable admin access. Check the database connection and permissions.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
