import { createContext, useState, useMemo, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

export const AuthContext = createContext(null);

const ADMIN_STORAGE_KEY    = 'bz_admin_token';
const DELIVERY_STORAGE_KEY = 'bz_delivery_token';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely decode a JWT payload without throwing.
 * Returns null on any error (malformed token, etc.).
 */
function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    // Pad base64 string to a multiple of 4
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json   = atob(padded.padEnd(padded.length + (4 - (padded.length % 4)) % 4, '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Return true if the token is present AND not expired.
 * A token with no `exp` claim is treated as permanently valid.
 */
function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  // No exp → treat as never-expiring (some backends do this intentionally)
  if (!payload.exp) return true;
  return payload.exp * 1000 > Date.now();
}

/**
 * Notify Android bridge after login (best-effort, never throws).
 * 1. saveAuthToken — persists JWT in SharedPreferences
 * 2. syncToken     — immediately sends any cached FCM token to the backend
 */
function notifyAndroidLogin(token) {
  try {
    if (window.AndroidBridge && typeof window.AndroidBridge.saveAuthToken === 'function') {
      window.AndroidBridge.saveAuthToken(token);
      console.log('[LOGIN_PERSIST] AndroidBridge.saveAuthToken called ✓');
    }
    // syncToken is a no-op if no FCM token is cached yet; harmless to call always
    if (window.AndroidBridge && typeof window.AndroidBridge.syncToken === 'function') {
      window.AndroidBridge.syncToken();
      console.log('[LOGIN_PERSIST] AndroidBridge.syncToken called ✓');
    }
  } catch (e) {
    console.warn('[LOGIN_PERSIST] AndroidBridge error (non-fatal):', e);
  }
}

/**
 * Notify Android bridge on manual logout (best-effort, never throws).
 */
function notifyAndroidLogout() {
  try {
    if (window.AndroidBridge && typeof window.AndroidBridge.onLogout === 'function') {
      window.AndroidBridge.onLogout();
      console.log('[LOGIN_PERSIST] AndroidBridge.onLogout called ✓');
    }
  } catch (e) {
    console.warn('[LOGIN_PERSIST] AndroidBridge.onLogout error (non-fatal):', e);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  // Start as LOADING so the router shows a spinner while we check localStorage.
  // This prevents a flash-redirect to /login before the token is read.
  const [user, setUser]           = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  // ── Restore persisted session on mount ──────────────────────────────────────
  const restoreSession = useCallback(() => {
    const adminToken    = localStorage.getItem(ADMIN_STORAGE_KEY);
    const deliveryToken = localStorage.getItem(DELIVERY_STORAGE_KEY);

    // Prefer delivery token if both somehow exist; admin otherwise
    const token     = deliveryToken || adminToken;
    const tokenType = deliveryToken ? 'delivery' : 'admin';

    if (!token) {
      console.log('[LOGIN_PERSIST] No stored token — redirecting to login');
      setIsLoading(false);
      return;
    }

    if (!isTokenValid(token)) {
      // Token is present but expired → clear and redirect
      console.warn('[LOGIN_PERSIST] Token expired — clearing session');
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      localStorage.removeItem(DELIVERY_STORAGE_KEY);
      setIsLoading(false);
      return;
    }

    // Token is valid — restore the user object from its payload
    const payload = decodeJwtPayload(token);
    const role    = tokenType === 'delivery' ? 'delivery' : (payload?.role || 'admin');

    console.log(`[LOGIN_PERSIST] Auto login success — role=${role}`);
    setUser({ id: payload?.id, email: payload?.email, role, token });

    // Keep Android bridge in sync (token may have been set before bridge loaded)
    notifyAndroidLogin(token);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password, type }) => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint   = type === 'admin' ? '/admin/login' : '/delivery/login';
      const storageKey = type === 'admin' ? ADMIN_STORAGE_KEY : DELIVERY_STORAGE_KEY;

      const { data } = await apiClient.post(endpoint, { email, password });
      const { token, admin, partner } = data.data;

      const userData = admin || partner;
      const role     = type === 'admin' ? 'admin' : 'delivery';

      // Persist token in localStorage (survives refresh, app restart, WebView reload)
      localStorage.setItem(storageKey, token);
      console.log(`[LOGIN_PERSIST] Token saved — role=${role}`);

      setUser({ ...userData, role, token });

      // Notify Android native bridge so it can register the FCM token
      notifyAndroidLogin(token);

      return { success: true, role };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Logout (manual only) ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    console.log('[LOGIN_PERSIST] Manual logout — clearing session');

    // Best-effort: delete FCM push token from backend before clearing creds
    if (user?.role === 'delivery' && user?.token) {
      try {
        const fcmToken = localStorage.getItem('fcm_token');
        if (fcmToken) {
          await apiClient.delete('/delivery/push-token', { data: { token: fcmToken } });
        }
      } catch (err) {
        console.warn('[LOGIN_PERSIST] Failed to delete push token on logout (non-fatal):', err);
      }
    }

    // Clear all auth tokens from persistent storage
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    localStorage.removeItem(DELIVERY_STORAGE_KEY);
    // Note: do NOT remove fcm_token here — it will be re-registered on next login

    // Notify Android bridge to clear its SharedPreferences cache
    notifyAndroidLogout();

    setUser(null);
    setError(null);
  }, [user]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(() => ({
    user,
    adminUser : user?.role === 'admin'    ? user : null,
    courier   : user?.role === 'delivery' ? user : null,
    isLoading,
    error,
    login,
    logout,
    clearError,
  }), [user, isLoading, error, login, logout, clearError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
