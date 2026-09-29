export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: options.signal || AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }
  let data;
  try {
    data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid JSON payload');
  } catch {
    const error = new Error('The server returned an unreadable response. Please try again.');
    error.status = response.status;
    error.fields = {};
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong. Please try again.');
    error.status = response.status;
    error.fields = data.errors || {};
    throw error;
  }
  return data;
}
