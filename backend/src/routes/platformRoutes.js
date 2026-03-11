'use strict';

/**
 * Public platform routes — no authentication required.
 * Used by the User App (checkout) to fetch live fee settings.
 */

const { Router } = require('express');
const { formatResponse } = require('../utils/responseFormatter');
const adminService = require('../services/adminService');

const router = Router();

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

module.exports = router;
