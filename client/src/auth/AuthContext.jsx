import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setError('');
    api('/auth/me', { signal: controller.signal })
      .then(data => { if (active) setUser(data.user); })
      .catch(err => {
        if (!active) return;
        if (err.status === 401) setUser(null);
        else setError(err.message);
      })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  return <AuthContext.Provider value={{ user, setUser, loading, error, retry: () => setAttempt(n => n + 1) }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
