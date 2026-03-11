import axios from 'axios';
import { API_URL } from '../config/constants';

const apiClient = axios.create({
  baseURL: API_URL,
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
