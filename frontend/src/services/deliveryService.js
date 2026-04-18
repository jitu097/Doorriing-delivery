import apiClient from './apiClient';

export const deliveryService = {
  login: (creds) => apiClient.post('/delivery/login', creds),

  getAssignedOrders: () => apiClient.get('/delivery/orders').then((r) => r.data.data),

  getAssignedOnly: () => apiClient.get('/delivery/assigned-orders?status=assigned').then((r) => r.data.data),

  // Legacy generic status patch — kept for backward compatibility
  updateAssignmentStatus: (assignmentId, status) =>
    apiClient
      .patch(`/delivery/assignments/${assignmentId}/status`, { status })
      .then((r) => r.data.data),

  // Dedicated order-action endpoints
  acceptOrder:     (assignmentId) => apiClient.post(`/delivery/assignments/${assignmentId}/accept`).then((r) => r.data.data),
  declineOrder:    (assignmentId) => apiClient.post(`/delivery/assignments/${assignmentId}/decline`).then((r) => r.data.data),
  pickedUp:        (orderId) => apiClient.post(`/delivery/orders/${orderId}/picked-up`).then((r) => r.data.data),
  outForDelivery:  (orderId) => apiClient.post(`/delivery/orders/${orderId}/out-for-delivery`).then((r) => r.data.data),
  markDelivered:   (orderId) => apiClient.post(`/delivery/orders/${orderId}/delivered`).then((r) => r.data.data),

  getHistory: () => apiClient.get('/delivery/history').then((r) => r.data.data),

  // Notifications
  getNotifications: () => apiClient.get('/delivery/notifications').then((r) => r.data.data),
  getUnreadCount:  () => apiClient.get('/delivery/notifications/unread-count').then((r) => r.data.data.count),
  markAsRead:      (id) => apiClient.patch(`/delivery/notifications/${id}/read`).then((r) => r.data.data),
  markAllNotificationsRead: () => apiClient.patch('/delivery/notifications/read-all').then((r) => r.data.data),
};

