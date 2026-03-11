import apiClient from './apiClient';

export const shopService = {
  list:  ()   => apiClient.get('/api/admin/shops').then((r) => r.data.data),
  get:   (id) => apiClient.get(`/api/admin/shops/${id}`).then((r) => r.data.data),
  stats: (id) => apiClient.get(`/api/admin/shops/${id}/stats`).then((r) => r.data.data),
  block: (id, is_blocked) =>
    apiClient.patch(`/api/admin/shops/${id}/block`, { is_blocked }).then((r) => r.data.data),
};
