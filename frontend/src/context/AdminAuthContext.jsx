import { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import './AdminAuthContext.css';

const STORAGE_KEY = 'bz_admin_token';
const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) {
        setAdminUser({ id: payload.id, email: payload.email, role: payload.role, token });
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/api/admin/login', { email, password });
      const { token, admin } = data.data;
      localStorage.setItem(STORAGE_KEY, token);
      setAdminUser({ ...admin, token });
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAdminUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ adminUser, isLoading, error, login, logout, clearError }),
    [adminUser, isLoading, error, login, logout, clearError]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuthContext = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuthContext must be within AdminAuthProvider');
  return ctx;
};
