import jwt from 'jsonwebtoken';
import { COOKIE_NAME, getAuthConfig } from '../config/auth.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

export function readToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getAuthConfig().secret, {
      algorithms: ['HS256'], issuer: 'helpdesk', audience: 'helpdesk-web',
    });
    if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub) || typeof payload.jti !== 'string') return null;
    return payload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return null;
    throw error;
  }
}

export async function requireAuth(req, res, next) {
  const payload = readToken(req.cookies[COOKIE_NAME]);
  if (!payload) return res.status(401).json({ message: 'Please log in to continue.' });
  const session = await Session.findOne({ _id: payload.jti, user: payload.sub, expiresAt: { $gt: new Date() } });
  if (!session) return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  const user = await User.findById(payload.sub);
  if (!user) return res.status(401).json({ message: 'Please log in to continue.' });
  req.user = user;
  next();
}

// Cookie-based writes must come from the configured frontend. Non-browser API
// clients without Origin are allowed; browsers cannot forge Origin/Fetch Metadata.
export function protectOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if ((origin && origin !== getAuthConfig().origin) || req.get('Sec-Fetch-Site') === 'cross-site') {
    return res.status(403).json({ message: 'Request origin is not allowed.' });
  }
  next();
}
