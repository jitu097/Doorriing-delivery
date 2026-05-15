'use strict';

/**
 * Public platform routes — no authentication required.
 * Used by the User App to fetch live fee settings, availability, and shop status.
 */

const { Router } = require('express');
const { formatResponse } = require('../utils/responseFormatter');
const adminService = require('../services/adminService');
const appAvailabilityController = require('../controllers/appAvailabilityController');
const userAvailabilityController = require('../controllers/userAvailabilityController');

const router = Router();

// ─── Fee Settings ──────────────────────────────────────────────────────────────
// GET /api/platform/settings
// Returns current fee configuration for checkout calculation.
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await adminService.getPlatformSettings();
    return res.json(formatResponse(settings));
  } catch (err) {
    return next(err);
  }
});

// ─── Global App Availability ───────────────────────────────────────────────────
// GET /api/platform/availability
// Returns live app open/closed state, delivery window, and reason.
// Polled by the User App every 30 s to show banners and disable checkout.
router.get('/availability', appAvailabilityController.getAvailability);

// ─── Shop Availability (User App) ─────────────────────────────────────────────
// IMPORTANT: route '/shops/open' must be defined BEFORE '/shops/:shopId'
// to prevent Express matching "open" as a shopId parameter.

// GET /api/platform/shops/open
// Returns ONLY shops that are currently open and orderable.
// Use this to populate the user app's shop listing screen.
router.get('/shops/open', userAvailabilityController.listOpenShops);

// GET /api/platform/shops
// Returns ALL shops with computed availability metadata.
// Useful for user app screens that show open + closed shops differently.
router.get('/shops', userAvailabilityController.listShopsWithAvailability);

// GET /api/platform/shops/:shopId
// Returns availability status for a single shop.
// Call before showing "Add to Cart" to know if the shop is open.
router.get('/shops/:shopId', userAvailabilityController.getShopAvailability);

// ─── Combined Pre-Order Validation ────────────────────────────────────────────
// POST /api/platform/validate-order
// Body: { shop_id: "<uuid>" }
// Validates BOTH global app status AND shop status in one request.
// Returns { canOrder: bool, reason: string|null, blockedBy: string|null }
// Use this before add-to-cart and before checkout.
router.post('/validate-order', userAvailabilityController.validateOrderAllowed);

module.exports = router;
