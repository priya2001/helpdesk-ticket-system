import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateBackendOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Use the HTTPS backend origin, for example https://your-api.onrender.com'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname.endsWith('.invalid') || !url.hostname.includes('.')) {
    throw new Error('Use a real HTTPS backend origin without credentials, an API path, query, or fragment.');
  }
  return url.origin;
}

export function configureVercel(config, origin) {
  const backend = validateBackendOrigin(origin);
  const result = structuredClone(config);
  const rewrite = result.rewrites.find(rule => rule.source === '/api/:path*');
  if (!rewrite) throw new Error('Missing API rewrite in vercel.json.');
  rewrite.destination = `${backend}/api/:path*`;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const file = new URL('../vercel.json', import.meta.url);
    const config = JSON.parse(readFileSync(file, 'utf8'));
    const argument = process.argv[2];
    if (argument === '--check') {
      const destination = config.rewrites.find(rule => rule.source === '/api/:path*')?.destination;
      if (!destination?.endsWith('/api/:path*')) throw new Error('Missing API destination.');
      validateBackendOrigin(destination.slice(0, -'/api/:path*'.length));
      console.log('Vercel backend URL configured.');
    } else {
      if (!argument || process.argv.length !== 3) throw new Error('Usage: npm run configure:vercel -- https://your-api.onrender.com');
      writeFileSync(file, JSON.stringify(configureVercel(config, argument), null, 2) + '\n');
      console.log('Updated vercel.json. Commit and push this public backend URL before deploying Vercel.');
    }
  } catch (error) {
    console.error(`${error.message}\nConfigure the real Render URL with npm run configure:vercel -- https://your-api.onrender.com`);
    process.exitCode = 1;
  }
}
