import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { COOKIE_NAME, SESSION_SECONDS, cookieOptions, getAuthConfig } from '../config/auth.js';
import { readToken, requireAuth } from '../middleware/auth.js';
import { validateAuth } from '../validation/auth.js';

export const authRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
});
// A missing account still incurs a bcrypt comparison, reducing timing differences.
const dummyHash = bcrypt.hash('unused-' + randomUUID(), 12);

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function startSession(req, res, user) {
  const jti = randomUUID();
  const token = jwt.sign({}, getAuthConfig().secret, {
    algorithm: 'HS256', subject: user.id, jwtid: jti,
    expiresIn: SESSION_SECONDS, issuer: 'helpdesk', audience: 'helpdesk-web',
  });
  await Session.create({ _id: jti, user: user._id, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
  // Replace any prior session in this browser instead of leaving it reusable.
  const old = readToken(req.cookies[COOKIE_NAME]);
  if (old) await Session.deleteOne({ _id: old.jti, user: old.sub });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_SECONDS * 1000 });
}

authRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

authRouter.post('/register', authLimiter, async (req, res) => {
  const { errors, value } = validateAuth(req.body, true);
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the form.', errors });
  const passwordHash = await bcrypt.hash(value.password, 12);
  let user;
  try {
    // Never pass req.body to the model: public registration always creates a user.
    user = await User.create({ name: value.name, email: value.email, passwordHash, role: 'user' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.', errors: { email: 'This email is already registered.' } });
    throw error;
  }
  await startSession(req, res, user);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { errors, value } = validateAuth(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the form.', errors });
  const user = await User.findOne({ email: value.email }).select('+passwordHash');
  const matches = await bcrypt.compare(value.password, user?.passwordHash || await dummyHash);
  if (!user || !matches) return res.status(401).json({ message: 'Email or password is incorrect.' });
  await startSession(req, res, user);
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', async (req, res) => {
  const payload = readToken(req.cookies[COOKIE_NAME]);
  if (payload) await Session.deleteOne({ _id: payload.jti, user: payload.sub });
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ message: 'Logged out successfully.' });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
