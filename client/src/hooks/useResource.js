import { useEffect, useState } from 'react';
import { useAuthApi } from './useAuthApi.js';

export function useResource(path) {
  const request = useAuthApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setError(null);
    setData(null);
    request(path, { signal: controller.signal })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [path, attempt, request]);
  return { data, setData, error, loading, retry: () => setAttempt(value => value + 1) };
}
