import { useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api.js';

export function useAuthApi() {
  const { setUser } = useAuth();
  return useCallback(async (path, options) => {
    try { return await api(path, options); }
    catch (error) {
      if (error.status === 401) setUser(null);
      throw error;
    }
  }, [setUser]);
}
