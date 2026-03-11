import apiClient from './apiClient';

export const orderService = {
  list:   (params) => apiClient.get('/admin/orders', { params }).then((r) => r.data.data?.orders ?? r.data.data ?? []),
  get:    (id)     => apiClient.get(`/admin/orders/${id}`).then((r) => r.data.data),
  analytics: ()   => apiClient.get('/admin/orders/analytics').then((r) => r.data.data),
};
