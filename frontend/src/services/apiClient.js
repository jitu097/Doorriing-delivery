import axios from 'axios';
import { API_URL } from '../config/constants';

// Strip any accidental trailing /api from the env value, then append /api once.
// This prevents double /api/api/... regardless of how VITE_API_URL is set.
const baseURL = API_URL.replace(/\/api\/?$/, '') + '/api';

const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('bz_admin_token') ||
    localStorage.getItem('bz_delivery_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg =
      error.response?.data?.message || error.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export default apiClient;
