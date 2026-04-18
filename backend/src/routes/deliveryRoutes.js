'use strict';

const { Router } = require('express');
const deliveryController = require('../controllers/deliveryController');
const { deliveryAuthMiddleware } = require('../middleware/deliveryAuthMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = Router();

// -------------------------------------------------------------------------
// Public
// -------------------------------------------------------------------------
// POST /api/delivery/login
router.post('/login', validateBody('deliveryLogin'), deliveryController.login);

// -------------------------------------------------------------------------
// Protected — all routes below require a valid delivery partner JWT
// -------------------------------------------------------------------------
router.use(deliveryAuthMiddleware);

// GET  /api/delivery/orders  — list active assigned orders for this partner
router.get('/orders', deliveryController.getAssignedOrders);

// Alias for persistent card check
router.get('/assigned-orders', deliveryController.getAssignedOrders);

// PATCH /api/delivery/assignments/:assignmentId/status  { status }
router.patch(
  '/assignments/:assignmentId/status',
  validateBody('updateAssignmentStatus'),
  deliveryController.updateAssignmentStatus
);

// GET /api/delivery/history  — completed deliveries for this partner
router.get('/history', deliveryController.getDeliveryHistory);

// POST /api/delivery/assignments/:assignmentId/accept
router.post('/assignments/:assignmentId/accept', deliveryController.acceptOrder);

// POST /api/delivery/assignments/:assignmentId/decline
router.post('/assignments/:assignmentId/decline', deliveryController.declineOrder);

// POST /api/delivery/orders/:orderId/picked-up
router.post('/orders/:orderId/picked-up', deliveryController.pickedUp);

// POST /api/delivery/orders/:orderId/out-for-delivery
router.post('/orders/:orderId/out-for-delivery', deliveryController.outForDelivery);

// POST /api/delivery/push-token  — save FCM token for push notifications
router.post(
  '/push-token',
  validateBody('saveDeliveryToken'),
  deliveryController.saveDeliveryToken
);

// GET /api/delivery/notifications — fetch history
router.get('/notifications', deliveryController.getNotifications);

// GET /api/delivery/notifications/unread-count
router.get('/notifications/unread-count', deliveryController.getUnreadCount);

// PATCH /api/delivery/notifications/:id/read
router.patch('/notifications/:id/read', deliveryController.markAsRead);

// PATCH /api/delivery/notifications/read-all
router.patch('/notifications/read-all', deliveryController.markAllRead);

module.exports = router;
