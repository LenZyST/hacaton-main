import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

type User = { login: string; email: string; phone: string; role: string };

const STORAGE_KEY = 'city_portal_user';

const AuthContext = createContext<{
  user: { login: string } | null;
  userFull: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  setUserLogin: (login: string) => void;
  refreshUser: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ login: string } | null>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [userFull, setUserFull] = useState<User | null>(null);

  const refreshUser = useCallback(async () => {
    if (!user?.login) {
      setUserFull(null);
      return;
    }
    try {
      const users = await api.getUsers();
      const u = users.find((x) => x.login.toLowerCase() === user.login.toLowerCase());
      setUserFull(u ? { login: u.login, email: u.email, phone: u.phone, role: u.role ?? 'user' } : null);
    } catch {
      setUserFull(null);
    }
  }, [user?.login]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (login: string, password: string) => {
    await api.login({ login, password });
    const payload = { login };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setUser(payload);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setUserFull(null);
  }, []);

  const setUserLogin = useCallback((login: string) => {
    setUser({ login });
  }, []);

  const isAdmin = userFull?.role === 'admin' || userFull?.role === 'superadmin';
  const isSuperAdmin = userFull?.role === 'superadmin';

  return (
    <AuthContext.Provider value={{ user, userFull, isAdmin, isSuperAdmin, login, logout, setUserLogin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
