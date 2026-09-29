export function getServerConfig(env = process.env) {
  const rawPort = env.PORT ?? '4000';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const rawHops = env.TRUST_PROXY_HOPS ?? '0';
  if (!/^[0-5]$/.test(rawHops)) throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
  return {
    port: Number(rawPort),
    host: env.HOST || (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    trustProxy: Number(rawHops),
  };
}
