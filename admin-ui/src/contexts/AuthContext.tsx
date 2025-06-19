import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '../services/api';
import type { AuthUser } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login(provider?: string): void;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/user');
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = (provider = 'google') => {
    window.location.href = `/auth/login/${provider}`;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const refresh = async () => {
    setLoading(true);
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
