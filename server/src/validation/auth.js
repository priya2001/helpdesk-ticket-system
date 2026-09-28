export function validateAuth(body, registering = false) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const errors = {};
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (!password || Buffer.byteLength(password, 'utf8') > 72) errors.password = 'Enter a password of up to 72 bytes.';
  if (registering) {
    if (name.length < 2 || name.length > 80) errors.name = 'Name must be between 2 and 80 characters.';
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) errors.password = 'Use at least 8 characters and at most 72 bytes.';
    if (input.confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
  }
  return { errors, value: { name, email, password } };
}
