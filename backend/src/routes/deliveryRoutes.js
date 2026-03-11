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

// PATCH /api/delivery/assignments/:assignmentId/status  { status }
router.patch(
  '/assignments/:assignmentId/status',
  validateBody('updateAssignmentStatus'),
  deliveryController.updateAssignmentStatus
);

// GET /api/delivery/history  — completed deliveries for this partner
router.get('/history', deliveryController.getDeliveryHistory);

// POST /api/delivery/orders/:orderId/accept
router.post('/orders/:orderId/accept', deliveryController.acceptOrder);

// POST /api/delivery/orders/:orderId/picked-up
router.post('/orders/:orderId/picked-up', deliveryController.pickedUp);

// POST /api/delivery/orders/:orderId/out-for-delivery
router.post('/orders/:orderId/out-for-delivery', deliveryController.outForDelivery);

// POST /api/delivery/orders/:orderId/delivered
router.post('/orders/:orderId/delivered', deliveryController.delivered);

module.exports = router;
