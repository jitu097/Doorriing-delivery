import axios from 'axios';
import { API_BASE_URL } from './constants';

const apiClient = axios.create({ baseURL: API_BASE_URL });

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

export { apiClient };
