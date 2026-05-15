'use strict';

/**
 * userAvailabilityController.js
 *
 * HTTP handlers for user-app-facing availability endpoints.
 * All routes under this controller are PUBLIC (no auth required).
 *
 * Endpoints:
 *   GET  /api/platform/shops              → all shops with availability status
 *   GET  /api/platform/shops/open         → only currently open shops
 *   GET  /api/platform/shops/:shopId      → single shop availability
 *   POST /api/platform/validate-order     → combined app + shop pre-order check
 */

const { formatResponse } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');
const userAvailabilityService = require('../services/userAvailability.service');

// ---------------------------------------------------------------------------
// GET /api/platform/shops
// Returns ALL shops with computed availability (isOrderable + reason)
// ---------------------------------------------------------------------------
const listShopsWithAvailability = async (req, res, next) => {
  try {
    const shops = await userAvailabilityService.getPublicShops();
    return res.json(formatResponse(shops));
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/platform/shops/open
// Returns ONLY shops that are currently open and orderable
// ---------------------------------------------------------------------------
const listOpenShops = async (req, res, next) => {
  try {
    const shops = await userAvailabilityService.getOpenShops();
    return res.json(formatResponse(shops));
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/platform/shops/:shopId
// Returns availability status for a specific shop
// ---------------------------------------------------------------------------
const getShopAvailability = async (req, res, next) => {
  try {
    const { shopId } = req.params;
    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'shopId is required',
      });
    }

    const status = await userAvailabilityService.getShopAvailability(shopId);
    return res.json(formatResponse(status));
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/platform/validate-order
// Combined pre-order check: app global status + shop status
//
// Body: { shop_id: "<uuid>" }
//
// Response when allowed:
//   { success: true, data: { canOrder: true, reason: null, blockedBy: null } }
//
// Response when blocked:
//   { success: true, data: { canOrder: false, reason: "...", blockedBy: "toggle|time_window|shop_closed|..." } }
//
// NOTE: Returns 200 even when blocked — the `canOrder` field carries the result.
// A 4xx/5xx is reserved for actual server errors, not business-logic blocks.
// ---------------------------------------------------------------------------
const validateOrderAllowed = async (req, res, next) => {
  try {
    const { shop_id } = req.body || {};

    const result = await userAvailabilityService.validateOrderAllowed(shop_id || null);

    logger.debug(
      `[UserAvailability] validate-order shop=${shop_id} → canOrder=${result.canOrder} blockedBy=${result.blockedBy}`
    );

    return res.json(formatResponse(result));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listShopsWithAvailability,
  listOpenShops,
  getShopAvailability,
  validateOrderAllowed,
};
