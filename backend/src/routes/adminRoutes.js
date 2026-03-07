'use strict';

const { Router } = require('express');
const adminController = require('../controllers/adminController');
const orderController = require('../controllers/orderController');
const { adminAuthMiddleware } = require('../middleware/adminAuthMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = Router();

// -------------------------------------------------------------------------
// Public
// -------------------------------------------------------------------------
// POST /api/admin/login
router.post('/login', validateBody('adminLogin'), adminController.login);

// -------------------------------------------------------------------------
// Protected — all routes below require a valid admin JWT
// -------------------------------------------------------------------------
router.use(adminAuthMiddleware);

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Shops
router.get('/shops', adminController.getShops);
router.get('/shops/:shopId/stats', adminController.getShopStats);
router.patch('/shops/:shopId/block', validateBody('setBlockStatus'), adminController.setShopBlockStatus);

// Users
router.get('/users', adminController.getUsers);
router.patch('/users/:userId/block', validateBody('setBlockStatus'), adminController.setUserBlockStatus);

// Orders — analytics route MUST be defined before /:orderId to avoid shadowing
router.get('/orders/analytics', adminController.getOrderAnalytics);
router.get('/orders', orderController.listOrders);
router.get('/orders/:orderId', orderController.getOrder);

// Delivery Partners
router.get('/delivery-partners', adminController.getDeliveryPartners);
router.post(
  '/delivery-partners',
  validateBody('createDeliveryPartner'),
  adminController.createDeliveryPartner
);
router.patch(
  '/delivery-partners/:partnerId/status',
  validateBody('setActiveStatus'),
  adminController.toggleDeliveryPartnerStatus
);

// Assignments (admin assigns a delivery partner to an order)
router.post('/assignments', validateBody('assignDelivery'), adminController.assignDeliveryPartner);

// Platform Settings
router.get('/settings', adminController.getPlatformSettings);
router.put('/settings', validateBody('updatePlatformSettings'), adminController.updatePlatformSettings);

module.exports = router;
