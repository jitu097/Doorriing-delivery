'use strict';

const { Router } = require('express');
const shopController = require('../controllers/shopController');
const { adminAuthMiddleware } = require('../middleware/adminAuthMiddleware');

const router = Router();

// All shop endpoints require admin authentication
router.use(adminAuthMiddleware);

router.get('/', shopController.listShops);
router.get('/:shopId', shopController.getShop);

module.exports = router;
