import apiClient from './apiClient';

export const shopService = {
  list:  ()   => apiClient.get('/admin/shops').then((r) => r.data.data),
  get:   (id) => apiClient.get(`/admin/shops/${id}`).then((r) => r.data.data),
  stats: (id) => apiClient.get(`/admin/shops/${id}/stats`).then((r) => r.data.data),
  block: (id, is_blocked) =>
    apiClient.patch(`/admin/shops/${id}/block`, { is_blocked }).then((r) => r.data.data),
};
