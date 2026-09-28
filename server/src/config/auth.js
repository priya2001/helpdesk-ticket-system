export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const COOKIE_NAME = 'helpdesk_session';

export function getAuthConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.includes('replace-with')) {
    throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in server/.env.');
  }
  const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:5173';
  if (new URL(origin).origin !== origin) throw new Error('APP_ORIGIN must be an origin without a trailing slash or path.');
  return { secret, origin, production: process.env.NODE_ENV === 'production' };
}

export function cookieOptions() {
  return { httpOnly: true, secure: getAuthConfig().production, sameSite: 'lax', path: '/' };
}
