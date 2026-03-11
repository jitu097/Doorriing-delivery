import apiClient from './apiClient';

export const orderService = {
  list:   (params) => apiClient.get('/api/admin/orders', { params }).then((r) => r.data.data?.orders ?? r.data.data ?? []),
  get:    (id)     => apiClient.get(`/api/admin/orders/${id}`).then((r) => r.data.data),
  analytics: ()   => apiClient.get('/api/admin/orders/analytics').then((r) => r.data.data),
};
