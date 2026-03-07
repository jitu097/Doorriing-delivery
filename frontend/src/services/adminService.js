import { apiClient } from '../config/api';

export const adminService = {
  login:   (creds)   => apiClient.post('/admin/login', creds),

  getDashboard: () => apiClient.get('/admin/dashboard').then((r) => r.data.data),

  getShops:  ()       => apiClient.get('/admin/shops').then((r) => r.data.data),
  getShopStats: (id)  => apiClient.get(`/admin/shops/${id}/stats`).then((r) => r.data.data),
  setShopBlock: (id, is_blocked) =>
    apiClient.patch(`/admin/shops/${id}/block`, { is_blocked }).then((r) => r.data.data),

  getUsers: ()            => apiClient.get('/admin/users').then((r) => r.data.data),
  setUserBlock: (id, is_blocked) =>
    apiClient.patch(`/admin/users/${id}/block`, { is_blocked }).then((r) => r.data.data),

  getOrderAnalytics: () => apiClient.get('/admin/orders/analytics').then((r) => r.data.data),
  getOrders: (params)    => apiClient.get('/admin/orders', { params }).then((r) => r.data.data?.orders ?? r.data.data ?? []),
  getOrder:  (id)        => apiClient.get(`/admin/orders/${id}`).then((r) => r.data.data),

  getDeliveryPartners: () => apiClient.get('/admin/delivery-partners').then((r) => r.data.data),
  createDeliveryPartner: (payload) =>
    apiClient.post('/admin/delivery-partners', payload).then((r) => r.data.data),
  togglePartnerStatus: (id, is_active) =>
    apiClient.patch(`/admin/delivery-partners/${id}/status`, { is_active }).then((r) => r.data.data),

  assignDelivery: (order_id, delivery_partner_id) =>
    apiClient.post('/admin/assignments', { order_id, delivery_partner_id }).then((r) => r.data.data),

  getSettings:    ()        => apiClient.get('/admin/settings').then((r) => r.data.data),
  updateSettings: (payload) => apiClient.put('/admin/settings', payload).then((r) => r.data.data),
};
