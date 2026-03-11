import apiClient from './apiClient';

export const deliveryService = {
  login: (creds) => apiClient.post('/delivery/login', creds),

  getAssignedOrders: () => apiClient.get('/delivery/orders').then((r) => r.data.data),

  // Legacy generic status patch — kept for backward compatibility
  updateAssignmentStatus: (assignmentId, status) =>
    apiClient
      .patch(`/delivery/assignments/${assignmentId}/status`, { status })
      .then((r) => r.data.data),

  // Dedicated order-action endpoints (by order_id)
  acceptOrder:     (orderId) => apiClient.post(`/delivery/orders/${orderId}/accept`).then((r) => r.data.data),
  pickedUp:        (orderId) => apiClient.post(`/delivery/orders/${orderId}/picked-up`).then((r) => r.data.data),
  outForDelivery:  (orderId) => apiClient.post(`/delivery/orders/${orderId}/out-for-delivery`).then((r) => r.data.data),
  markDelivered:   (orderId) => apiClient.post(`/delivery/orders/${orderId}/delivered`).then((r) => r.data.data),

  getHistory: () => apiClient.get('/delivery/history').then((r) => r.data.data),
};

