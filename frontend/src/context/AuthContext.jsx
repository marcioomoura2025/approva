import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api('/me')
      .then(d => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const d = await api('/login', { method: 'POST', body: { email, password } });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const register = async (name, email, password) => {
    const d = await api('/register', { method: 'POST', body: { name, email, password } });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const logout = () => { setToken(null); setUser(null); };

  // Atualização parcial do usuário em memória (ex.: meta de aprovação)
  const updateUser = (patch) => setUser(u => (u ? { ...u, ...patch } : u));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
