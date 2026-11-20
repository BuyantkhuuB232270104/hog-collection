import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = ачаалж байна, null = нэвтрээгүй
  const refresh = useCallback(async () => {
    try { setUser(await api('/auth/me')); } catch { setUser(null); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (login, password) => { await api('/auth/login', { method: 'POST', body: { login, password } }); await refresh(); };
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); };
  return <AuthCtx.Provider value={{ user, refresh, login, logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
export const has = (user, ...codes) => !!user?.roles?.some(r => codes.includes(r.code));
/** Үүрэг бүрийн нүүр хуудас */
export function homeFor(user) {
  if (has(user, 'coordinator')) return '/coordinator';
  if (has(user, 'driver')) return '/driver';
  if (has(user, 'manager')) return '/reports';
  if (has(user, 'admin')) return '/admin';
  return '/my';
}
