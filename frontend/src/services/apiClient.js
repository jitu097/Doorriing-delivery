import axios from 'axios';
import { API_URL } from '../config/constants';

// Strip any accidental trailing /api from the env value, then append /api once.
// This prevents double /api/api/... regardless of how VITE_API_URL is set.
const baseURL = API_URL.replace(/\/api\/?$/, '') + '/api';

const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

// ── Request interceptor: attach JWT from localStorage ─────────────────────────
apiClient.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('bz_admin_token') ||
    localStorage.getItem('bz_delivery_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: surface errors clearly ──────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    // Log 401s explicitly so they appear in devtools/logcat — but do NOT
    // automatically redirect. Session management is AuthProvider's responsibility.
    // This prevents a race condition where a 401 on a background poll clears auth.
    if (error.response?.status === 401) {
      console.warn(
        '[LOGIN_PERSIST] 401 received from',
        error.config?.url,
        '— check if token is expired'
      );
    }

    const msg =
      error.response?.data?.message || error.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export default apiClient;
