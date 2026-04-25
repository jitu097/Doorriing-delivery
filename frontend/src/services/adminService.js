import apiClient from './apiClient';

export const adminService = {
  login:   (creds)   => apiClient.post('/admin/login', creds),

  getDashboard: () => apiClient.get('/admin/dashboard').then((r) => r.data.data),

  getShops:  ()       => apiClient.get('/admin/shops').then((r) => r.data.data),
  getShopById:      (id)          => apiClient.get(`/admin/shops/${id}`).then((r) => r.data.data),
  getShopAnalytics: (id)          => apiClient.get(`/admin/shops/${id}/analytics`).then((r) => r.data.data),
  getShopOrders:    (id, params)  => apiClient.get(`/admin/shops/${id}/orders`, { params }).then((r) => r.data.data),
  getShopStats: (id)  => apiClient.get(`/admin/shops/${id}/stats`).then((r) => r.data.data),
  setShopBlock: (id, is_blocked) =>
    apiClient.patch(`/admin/shops/${id}/block`, { is_blocked }).then((r) => r.data.data),

  getShopWithdrawals: (id) =>
    apiClient.get(`/admin/shops/${id}/withdrawals`).then((r) => r.data.data),
  approveWithdrawal: (withdrawId) =>
    apiClient.post(`/admin/withdrawals/${withdrawId}/approve`).then((r) => r.data.data),
  rejectWithdrawal: (withdrawId, admin_note = '') =>
    apiClient.post(`/admin/withdrawals/${withdrawId}/reject`, { admin_note }).then((r) => r.data.data),

  getUsers:    ()  => apiClient.get('/admin/users').then((r) => r.data.data),
  blockUser:   (id) => apiClient.patch(`/admin/users/${id}/block`).then((r) => r.data.data),
  unblockUser: (id) => apiClient.patch(`/admin/users/${id}/unblock`).then((r) => r.data.data),

  getOrderAnalytics: () => apiClient.get('/admin/orders/analytics').then((r) => r.data.data),
  getOrders: (params)    => apiClient.get('/admin/orders', { params }).then((r) => r.data.data?.orders ?? r.data.data ?? []),
  getOrder:  (id)        => apiClient.get(`/admin/orders/${id}`).then((r) => r.data.data),

  getDeliveryPartners: () => apiClient.get('/admin/delivery-partners').then((r) => r.data.data),
  createDeliveryPartner: (payload) =>
    apiClient.post('/admin/delivery-partners', payload).then((r) => r.data.data),
  togglePartnerStatus: (id, is_active) =>
    apiClient.patch(`/admin/delivery-partners/${id}/status`, { is_active }).then((r) => r.data.data),

  getPartnerCash: (id) => apiClient.get(`/admin/delivery-partners/${id}/cash`).then((r) => r.data.data),
  settlePartnerCash: (id) => apiClient.post(`/admin/delivery-partners/${id}/settle-cash`).then((r) => r.data.data),

  assignDelivery: (order_id, delivery_partner_id) =>
    apiClient.post('/admin/assignments', { order_id, delivery_partner_id }).then((r) => r.data.data),

  getSettings:    ()        => apiClient.get('/admin/settings').then((r) => r.data.data),
  updateSettings: (payload) => apiClient.put('/admin/settings', payload).then((r) => r.data.data),

  // Notifications
  getNotifications: () => apiClient.get('/admin/notifications').then((r) => r.data.data),
  markAsRead: (id) => apiClient.patch(`/admin/notifications/${id}/read`).then((r) => r.data.data),
  registerPushToken: (payload) => apiClient.post('/admin/notifications/tokens', payload).then((r) => r.data.data),
  removePushToken: (token) => apiClient.delete(`/admin/notifications/tokens/${token}`).then((r) => r.data.data),
};
