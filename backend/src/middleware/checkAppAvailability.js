'use strict';

/**
 * checkAppAvailability.js
 *
 * Server-side middleware that blocks NEW order creation when:
 *   1. The global app toggle is OFF, OR
 *   2. The current IST time is outside the configured delivery window, OR
 *   3. The target shop is closed / inactive / blocked (when shop_id is provided)
 *
 * SAFETY GUARANTEE:
 *   - Only intended for POST requests to order creation endpoints.
 *   - Has ZERO effect on: GET (read), PATCH (status updates), payment callbacks,
 *     existing order flows, delivery assignments, or any other route.
 *   - If the availability DB is unreachable, fails OPEN (safe default) with a
 *     warning log — so a DB hiccup never blocks all orders permanently.
 *
 * Usage: apply ONLY to the User App's "create order" POST route.
 */

const { logger } = require('../utils/logger');
const { checkIsOpen } = require('../services/appAvailability.service');
const { validateOrderAllowed } = require('../services/userAvailability.service');

/**
 * checkAppAvailability — validates global app open state.
 * Does NOT check shop status (shop check is in checkShopAvailability below).
 */
const checkAppAvailability = async (req, res, next) => {
  try {
    const { isOpen, reason, blockedBy } = await checkIsOpen();

    if (!isOpen) {
      logger.info(
        `[AppAvailability] Order creation blocked. blockedBy=${blockedBy} reason="${reason}"`
      );

      return res.status(503).json({
        success:   false,
        message:   reason || 'Service temporarily unavailable',
        code:      'APP_UNAVAILABLE',
        blockedBy,
      });
    }

    return next();
  } catch (err) {
    logger.error(
      `[AppAvailability] Availability check FAILED — failing open to prevent outage: ${err.message}`
    );
    return next();
  }
};

/**
 * checkOrderAllowed — validates BOTH global app state AND shop availability.
 * Reads shop_id from req.body, req.params, or req.query (in that priority order).
 *
 * Use this as a combined middleware when you need both checks in one pass.
 */
const checkOrderAllowed = async (req, res, next) => {
  try {
    const shopId =
      req.body?.shop_id ||
      req.params?.shopId ||
      req.query?.shop_id ||
      null;

    const { canOrder, reason, blockedBy } = await validateOrderAllowed(shopId);

    if (!canOrder) {
      logger.info(
        `[AppAvailability] Order blocked. shopId=${shopId} blockedBy=${blockedBy} reason="${reason}"`
      );

      const statusCode = blockedBy === 'app_unavailable' || blockedBy === 'toggle' || blockedBy === 'time_window'
        ? 503
        : 422;

      return res.status(statusCode).json({
        success:   false,
        message:   reason || 'Order not allowed right now',
        code:      blockedBy?.toUpperCase() || 'ORDER_BLOCKED',
        blockedBy,
      });
    }

    return next();
  } catch (err) {
    logger.error(
      `[AppAvailability] Combined order check FAILED — failing open: ${err.message}`
    );
    return next();
  }
};

module.exports = { checkAppAvailability, checkOrderAllowed };

