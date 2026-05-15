'use strict';

/**
 * userAvailability.service.js
 *
 * Provides user-app-facing availability data:
 *   1. Global app open/close status (delegates to appAvailability.service)
 *   2. List of shops that are currently open and orderable
 *   3. Individual shop open/close status check
 *
 * Used by:
 *   GET /api/platform/shops          → list of open shops for user app
 *   GET /api/platform/shops/:shopId  → single shop status check
 *   POST /api/platform/validate-order → pre-order validation (optional)
 *
 * Architecture:
 *   This service intentionally does NOT cache shop data because:
 *   a) Shops are fewer in number than real-time order requests
 *   b) Shop open/close state must be near-real-time for correct UX
 *   c) The DB trigger is the final safety net regardless
 */

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');
const { logger } = require('../utils/logger');
const { checkIsOpen: checkGlobalIsOpen } = require('./appAvailability.service');

// ---------------------------------------------------------------------------
// Shop availability helpers
// ---------------------------------------------------------------------------

/**
 * Determines whether a single shop record is currently orderable.
 *
 * A shop is orderable when ALL of the following are true:
 *   - is_active = true    (admin has not deactivated the shop)
 *   - is_blocked = false  (admin has not blocked the shop)
 *   - is_open = true      (seller has not manually closed the shop)
 *
 * @param {object} shop  - Row from the shops table
 * @returns {{ isOrderable: boolean, reason: string | null, blockedBy: string | null }}
 */
const computeShopOrderable = (shop) => {
  if (!shop) {
    return { isOrderable: false, reason: 'Shop not found', blockedBy: 'not_found' };
  }

  if (shop.is_blocked) {
    return {
      isOrderable: false,
      reason: 'This shop is currently unavailable.',
      blockedBy: 'admin_blocked',
    };
  }

  if (!shop.is_active) {
    return {
      isOrderable: false,
      reason: 'This shop is not currently accepting orders.',
      blockedBy: 'inactive',
    };
  }

  // is_open defaults to true if the column doesn't exist yet (pre-migration)
  const isOpen = shop.is_open !== false; // undefined/null → true (safe default)
  if (!isOpen) {
    return {
      isOrderable: false,
      reason: `${shop.shop_name || 'This shop'} is currently closed.`,
      blockedBy: 'shop_closed',
    };
  }

  return { isOrderable: true, reason: null, blockedBy: null };
};

// ---------------------------------------------------------------------------
// Public API service functions
// ---------------------------------------------------------------------------

/**
 * Returns ALL shops with their current orderability status.
 * Used by the user app to display shop listings.
 *
 * Each shop in the returned array has an additional `availability` field:
 *   { isOrderable, reason, blockedBy }
 *
 * @returns {Promise<Array>}
 */
const getPublicShops = async () => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('shops')
    .select(
      'id, shop_name, owner_name, city, business_type, is_active, is_blocked, is_open, phone'
    )
    .order('shop_name', { ascending: true });

  if (error) {
    logger.error(`[UserAvailability] getPublicShops DB error: ${error.code} — ${error.message}`);
    throw createError(500, 'Failed to fetch shops');
  }

  const shops = data || [];

  // Attach computed availability for each shop
  return shops.map((shop) => ({
    id:            shop.id,
    shop_name:     shop.shop_name,
    owner_name:    shop.owner_name,
    city:          shop.city,
    business_type: shop.business_type,
    phone:         shop.phone,
    availability:  computeShopOrderable(shop),
  }));
};

/**
 * Returns only shops that are currently open and orderable.
 * Used when the user app wants to display only "active" shops.
 *
 * @returns {Promise<Array>}
 */
const getOpenShops = async () => {
  const supabase = getSupabaseClient();

  // Query DB for active, non-blocked shops
  // is_open check: fetch all active+unblocked, then filter by is_open in JS
  // (is_open column may not exist pre-migration — handle gracefully)
  const { data, error } = await supabase
    .from('shops')
    .select(
      'id, shop_name, owner_name, city, business_type, is_active, is_blocked, is_open, phone'
    )
    .eq('is_active', true)
    .eq('is_blocked', false)
    .order('shop_name', { ascending: true });

  if (error) {
    logger.error(`[UserAvailability] getOpenShops DB error: ${error.code} — ${error.message}`);
    throw createError(500, 'Failed to fetch open shops');
  }

  // Filter: must also have is_open != false
  const openShops = (data || []).filter((shop) => shop.is_open !== false);

  return openShops.map((shop) => ({
    id:            shop.id,
    shop_name:     shop.shop_name,
    owner_name:    shop.owner_name,
    city:          shop.city,
    business_type: shop.business_type,
    phone:         shop.phone,
    is_open:       true, // guaranteed by filter above
  }));
};

/**
 * Returns the full availability status for a single shop.
 * Used by the user app before showing "Add to Cart" for items.
 *
 * @param {string} shopId  UUID of the shop
 * @returns {Promise<object>}
 */
const getShopAvailability = async (shopId) => {
  if (!shopId) throw createError(400, 'shopId is required');

  const supabase = getSupabaseClient();

  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, shop_name, is_active, is_blocked, is_open, business_type, city')
    .eq('id', shopId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw createError(404, 'Shop not found');
    logger.error(`[UserAvailability] getShopAvailability DB error: ${error.code} — ${error.message}`);
    throw createError(500, 'Failed to fetch shop availability');
  }

  if (!shop) throw createError(404, 'Shop not found');

  const availability = computeShopOrderable(shop);

  return {
    shop_id:       shop.id,
    shop_name:     shop.shop_name,
    business_type: shop.business_type,
    city:          shop.city,
    ...availability,
  };
};

/**
 * Full pre-order validation: checks BOTH global app status AND shop status.
 * Called before add-to-cart / checkout / order placement.
 *
 * Returns a single combined result so the user app only makes one API call.
 *
 * @param {string} shopId  UUID of the shop for the order
 * @returns {Promise<{ canOrder: boolean, reason: string | null, blockedBy: string | null }>}
 */
const validateOrderAllowed = async (shopId) => {
  // Check 1: Global app availability
  const { isOpen: appIsOpen, reason: appReason, blockedBy: appBlockedBy } = await checkGlobalIsOpen();

  if (!appIsOpen) {
    return {
      canOrder:  false,
      reason:    appReason || 'We are currently not accepting orders. Please try again later.',
      blockedBy: appBlockedBy || 'app_unavailable',
    };
  }

  // Check 2: Shop-specific availability
  if (shopId) {
    const shopStatus = await getShopAvailability(shopId);
    if (!shopStatus.isOrderable) {
      return {
        canOrder:  false,
        reason:    shopStatus.reason || 'This shop is not available right now.',
        blockedBy: shopStatus.blockedBy || 'shop_unavailable',
      };
    }
  }

  return { canOrder: true, reason: null, blockedBy: null };
};

module.exports = {
  getPublicShops,
  getOpenShops,
  getShopAvailability,
  validateOrderAllowed,
  computeShopOrderable,
};
