import apiClient from './apiClient';

export const deliveryService = {
  login: (creds) => apiClient.post('/delivery/login', creds),

  getProfile: () => apiClient.get('/delivery/profile').then((r) => r.data.data),

  updateDeliveryStatus: (delivery_status) =>
    apiClient.patch('/delivery/status', { delivery_status }).then((r) => r.data.data),

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
  getNotifications: () => {
    console.log('[deliveryService] 🔔 Calling getNotifications API...');
    return apiClient.get('/delivery/notifications').then((r) => {
      console.log('[deliveryService] ✅ API Response:', r.data);
      console.log('[deliveryService] ✅ Notifications data:', r.data.data);
      return r.data.data;
    }).catch((err) => {
      console.error('[deliveryService] ❌ API Error:', err.message);
      throw err;
    });
  },

  getUnreadCount:  () => {
    console.log('[deliveryService] 📊 Calling getUnreadCount API...');
    return apiClient.get('/delivery/notifications/unread-count').then((r) => {
      console.log('[deliveryService] ✅ Unread count response:', r.data.data);
      return r.data.data.count;
    }).catch((err) => {
      console.error('[deliveryService] ❌ Unread count error:', err.message);
      throw err;
    });
  },

  markAsRead:      (id) => {
    console.log('[deliveryService] 📝 Marking notification as read:', id);
    return apiClient.patch(`/delivery/notifications/${id}/read`).then((r) => {
      console.log('[deliveryService] ✅ Marked as read');
      return r.data.data;
    });
  },

  markAllNotificationsRead: () => {
    console.log('[deliveryService] 📝 Marking all notifications as read...');
    return apiClient.patch('/delivery/notifications/read-all').then((r) => {
      console.log('[deliveryService] ✅ All marked as read');
      return r.data.data;
    });
  },
};

