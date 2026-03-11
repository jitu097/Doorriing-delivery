import apiClient from './apiClient';

export const adminService = {
  login:   (creds)   => apiClient.post('/api/admin/login', creds),

  getDashboard: () => apiClient.get('/api/admin/dashboard').then((r) => r.data.data),

  getShops:  ()       => apiClient.get('/api/admin/shops').then((r) => r.data.data),
  getShopById:      (id)          => apiClient.get(`/api/admin/shops/${id}`).then((r) => r.data.data),
  getShopAnalytics: (id)          => apiClient.get(`/api/admin/shops/${id}/analytics`).then((r) => r.data.data),
  getShopOrders:    (id, params)  => apiClient.get(`/api/admin/shops/${id}/orders`, { params }).then((r) => r.data.data),
  getShopStats: (id)  => apiClient.get(`/api/admin/shops/${id}/stats`).then((r) => r.data.data),
  setShopBlock: (id, is_blocked) =>
    apiClient.patch(`/api/admin/shops/${id}/block`, { is_blocked }).then((r) => r.data.data),

  getShopWithdrawals: (id) =>
    apiClient.get(`/api/admin/shops/${id}/withdrawals`).then((r) => r.data.data),
  approveWithdrawal: (withdrawId) =>
    apiClient.post(`/api/admin/withdrawals/${withdrawId}/approve`).then((r) => r.data.data),
  rejectWithdrawal: (withdrawId, admin_note = '') =>
    apiClient.post(`/api/admin/withdrawals/${withdrawId}/reject`, { admin_note }).then((r) => r.data.data),

  getUsers:    ()  => apiClient.get('/api/admin/users').then((r) => r.data.data),
  blockUser:   (id) => apiClient.patch(`/api/admin/users/${id}/block`).then((r) => r.data.data),
  unblockUser: (id) => apiClient.patch(`/api/admin/users/${id}/unblock`).then((r) => r.data.data),

  getOrderAnalytics: () => apiClient.get('/api/admin/orders/analytics').then((r) => r.data.data),
  getOrders: (params)    => apiClient.get('/api/admin/orders', { params }).then((r) => r.data.data?.orders ?? r.data.data ?? []),
  getOrder:  (id)        => apiClient.get(`/api/admin/orders/${id}`).then((r) => r.data.data),

  getDeliveryPartners: () => apiClient.get('/api/admin/delivery-partners').then((r) => r.data.data),
  createDeliveryPartner: (payload) =>
    apiClient.post('/api/admin/delivery-partners', payload).then((r) => r.data.data),
  togglePartnerStatus: (id, is_active) =>
    apiClient.patch(`/api/admin/delivery-partners/${id}/status`, { is_active }).then((r) => r.data.data),

  assignDelivery: (order_id, delivery_partner_id) =>
    apiClient.post('/api/admin/assignments', { order_id, delivery_partner_id }).then((r) => r.data.data),

  getSettings:    ()        => apiClient.get('/api/admin/settings').then((r) => r.data.data),
  updateSettings: (payload) => apiClient.put('/api/admin/settings', payload).then((r) => r.data.data),
};
