'use strict';

/**
 * checkAppAvailability.js
 *
 * Server-side middleware that blocks NEW order creation when:
 *   1. The global app toggle is OFF, OR
 *   2. The current IST time is outside the configured delivery window
 *
 * SAFETY GUARANTEE:
 *   - Only intercepts POST requests to the order creation endpoint.
 *   - Has ZERO effect on: GET (read), PATCH (status updates), payment callbacks,
 *     existing order flows, delivery assignments, or any other route.
 *   - If the availability DB is unreachable, fails OPEN (safe default) with a
 *     warning log — so a DB hiccup never blocks all orders permanently.
 *
 * Usage: apply ONLY to the User App's "create order" POST route.
 */

const createError = require('http-errors');
const { logger } = require('../utils/logger');
const { checkIsOpen } = require('../services/appAvailability.service');

const checkAppAvailability = async (req, res, next) => {
  try {
    const { isOpen, reason, blockedBy } = await checkIsOpen();

    if (!isOpen) {
      logger.info(
        `[AppAvailability] Order creation blocked. blockedBy=${blockedBy} reason="${reason}"`
      );

      // Return a structured 503 so the User App can display the right message
      return res.status(503).json({
        success:   false,
        message:   reason || 'Service temporarily unavailable',
        code:      'APP_UNAVAILABLE',
        blockedBy, // 'toggle' | 'time_window'
      });
    }

    // App is open — allow the request to proceed
    return next();
  } catch (err) {
    // Fail open: if we cannot read availability settings (e.g., DB outage),
    // we allow the order to proceed rather than silently blocking all orders.
    // This is logged prominently so ops can detect the issue.
    logger.error(
      `[AppAvailability] Availability check FAILED — failing open to prevent outage: ${err.message}`
    );
    return next();
  }
};

module.exports = { checkAppAvailability };
