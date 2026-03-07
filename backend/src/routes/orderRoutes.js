'use strict';

const { Router } = require('express');
const orderController = require('../controllers/orderController');
const { adminAuthMiddleware } = require('../middleware/adminAuthMiddleware');

const router = Router();

// All order endpoints require admin authentication
router.use(adminAuthMiddleware);

router.get('/', orderController.listOrders);
router.get('/:orderId', orderController.getOrder);

module.exports = router;
