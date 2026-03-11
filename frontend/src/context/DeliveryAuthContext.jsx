import { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import './DeliveryAuthContext.css';

const STORAGE_KEY = 'bz_delivery_token';
const DeliveryAuthContext = createContext(null);

export const DeliveryAuthProvider = ({ children }) => {
  const [courier, setCourier] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) {
        setCourier({ id: payload.id, email: payload.email, role: payload.role, token });
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
      const { data } = await apiClient.post('/api/delivery/login', { email, password });
      const { token, partner } = data.data;
      localStorage.setItem(STORAGE_KEY, token);
      setCourier({ ...partner, role: 'delivery', token });
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
    setCourier(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ courier, isLoading, error, login, logout, clearError }),
    [courier, isLoading, error, login, logout, clearError]
  );

  return <DeliveryAuthContext.Provider value={value}>{children}</DeliveryAuthContext.Provider>;
};

export const useDeliveryAuthContext = () => {
  const ctx = useContext(DeliveryAuthContext);
  if (!ctx) throw new Error('useDeliveryAuthContext must be within DeliveryAuthProvider');
  return ctx;
};
