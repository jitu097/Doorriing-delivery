'use strict';

/**
 * appAvailabilityController.js
 *
 * Handles HTTP layer for App Availability API.
 *
 * GET  /api/platform/availability  → public (no auth) — used by User App polling
 * GET  /api/admin/app-availability → admin auth — used by Admin Panel page
 * PUT  /api/admin/app-availability → admin auth — update settings
 */

const { formatResponse } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');
const availabilityService = require('../services/appAvailability.service');

// ---------------------------------------------------------------------------
// GET — fetch current settings + computed open state
// Used by both the public endpoint (User App) and admin endpoint (Admin Panel)
// ---------------------------------------------------------------------------

const getAvailability = async (req, res, next) => {
  try {
    const settings = await availabilityService.getAvailability();
    const { isOpen, reason, blockedBy } = availabilityService.computeIsOpen(settings);

    return res.json(
      formatResponse({
        ...settings,
        // Computed fields for convenience — not stored in DB
        isCurrentlyOpen: isOpen,
        closedReason:    reason,
        blockedBy,
      })
    );
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// PUT — update settings (admin-only, validated by validateBody middleware)
// ---------------------------------------------------------------------------

const updateAvailability = async (req, res, next) => {
  try {
    const adminEmail = req.admin?.email || req.admin?.id || 'admin';
    const updated    = await availabilityService.updateAvailability(req.body, adminEmail);

    // Return updated row + recomputed open state
    const { isOpen, reason, blockedBy } = availabilityService.computeIsOpen(updated);

    logger.info(`[AppAvailability] Updated by admin ${adminEmail} — isOpen=${isOpen}`);

    return res.json(
      formatResponse(
        {
          ...updated,
          isCurrentlyOpen: isOpen,
          closedReason:    reason,
          blockedBy,
        },
        'App availability settings updated successfully'
      )
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { getAvailability, updateAvailability };
