import { createContext, useState, useMemo, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

export const AuthContext = createContext(null);

const ADMIN_STORAGE_KEY = 'bz_admin_token';
const DELIVERY_STORAGE_KEY = 'bz_delivery_token';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { id, email, role, ... }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const restoreSession = useCallback(() => {
    const adminToken = localStorage.getItem(ADMIN_STORAGE_KEY);
    const deliveryToken = localStorage.getItem(DELIVERY_STORAGE_KEY);

    // Prioritize delivery if both exist (though unlikely in a shared session)
    const token = deliveryToken || adminToken;
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) {
        setUser({ 
          id: payload.id, 
          email: payload.email, 
          role: payload.role, 
          token 
        });
      } else {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        localStorage.removeItem(DELIVERY_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      localStorage.removeItem(DELIVERY_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async ({ email, password, type }) => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = type === 'admin' ? '/admin/login' : '/delivery/login';
      const storageKey = type === 'admin' ? ADMIN_STORAGE_KEY : DELIVERY_STORAGE_KEY;
      
      const { data } = await apiClient.post(endpoint, { email, password });
      const { token, admin, partner } = data.data;
      
      const userData = admin || partner;
      const role = type === 'admin' ? 'admin' : 'delivery';

      localStorage.setItem(storageKey, token);
      setUser({ ...userData, role, token });
      return { success: true, role };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // If delivery, try to clean up push token (best effort)
    if (user?.role === 'delivery' && user?.token) {
      try {
        const tokenStr = localStorage.getItem('fcm_token'); // We'll store this in NotificationProvider
        if (tokenStr) {
          await apiClient.delete('/delivery/push-token', { data: { token: tokenStr } });
        }
      } catch (err) {
        console.warn('Failed to delete push token on logout:', err);
      }
    }

    localStorage.removeItem(ADMIN_STORAGE_KEY);
    localStorage.removeItem(DELIVERY_STORAGE_KEY);
    setUser(null);
    setError(null);
  }, [user]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(() => ({
    user,
    adminUser: user?.role === 'admin' ? user : null,
    courier: user?.role === 'delivery' ? user : null,
    isLoading,
    error,
    login,
    logout,
    clearError
  }), [user, isLoading, error, login, logout, clearError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
