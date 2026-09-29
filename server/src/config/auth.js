export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const COOKIE_NAME = 'helpdesk_session';

export function getAuthConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.includes('replace-with')) {
    throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in server/.env.');
  }
  const production = process.env.NODE_ENV === 'production';
  const origin = process.env.APP_ORIGIN || (production ? '' : 'http://127.0.0.1:5173');
  let parsed;
  try { parsed = new URL(origin); } catch { throw new Error('APP_ORIGIN must be a valid frontend origin. Set the Vercel production URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || (production && parsed.protocol !== 'https:')) {
    throw new Error('APP_ORIGIN must be an origin without credentials, a trailing slash, or a path; production requires HTTPS.');
  }
  return { secret, origin, production };
}

export function cookieOptions() {
  return { httpOnly: true, secure: getAuthConfig().production, sameSite: 'lax', path: '/' };
}
