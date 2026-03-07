import { apiClient } from '../config/api';

export const deliveryService = {
  login: (creds) => apiClient.post('/delivery/login', creds),

  getAssignedOrders: () => apiClient.get('/delivery/orders').then((r) => r.data.data),

  updateAssignmentStatus: (assignmentId, status) =>
    apiClient
      .patch(`/delivery/assignments/${assignmentId}/status`, { status })
      .then((r) => r.data.data),

  getHistory: () => apiClient.get('/delivery/history').then((r) => r.data.data),
};
