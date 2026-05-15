/**
 * useShopAvailability.js
 *
 * React hook for User App — polls a specific shop's open/closed status.
 *
 * Usage:
 * ------
 *   import { useShopAvailability } from '@/hooks/useShopAvailability';
 *
 *   const { isOrderable, isLoading, reason, blockedBy } = useShopAvailability(shopId);
 *
 *   // Disable "Add to Cart" based on shop status:
 *   <button disabled={!isOrderable || !appIsOpen}>Add to Cart</button>
 *
 * Combined usage with useAppAvailability:
 * ----------------------------------------
 *   const app  = useAppAvailability();
 *   const shop = useShopAvailability(shopId);
 *
 *   const canOrder = app.isOpen && shop.isOrderable;
 *   const blockReason = !app.isOpen ? app.reason : !shop.isOrderable ? shop.reason : null;
 *
 * API Contract:
 * -------------
 *   GET /api/platform/shops/:shopId
 *   Response: {
 *     success: true,
 *     data: {
 *       shop_id:       string,
 *       shop_name:     string,
 *       business_type: string,
 *       city:          string,
 *       isOrderable:   boolean,
 *       reason:        string | null,
 *       blockedBy:     "admin_blocked" | "inactive" | "shop_closed" | "not_found" | null
 *     }
 *   }
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/** Base API URL — adjust to match your app's API base. */
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.replace(/\/api\/?$/, '') + '/api') ||
  'https://doorriing-delivery-3.onrender.com/api';

/** Poll interval: 60 seconds (shop status changes less frequently than global toggle) */
const POLL_INTERVAL_MS = 60_000;

/**
 * @typedef {Object} ShopAvailabilityState
 * @property {boolean}      isOrderable  - Whether items from this shop can be added to cart
 * @property {boolean}      isLoading    - True on the initial fetch only
 * @property {string|null}  reason       - Human-readable closed reason (null if open)
 * @property {string|null}  blockedBy    - "admin_blocked" | "inactive" | "shop_closed" | "not_found" | null
 * @property {object|null}  shopStatus   - Full raw status object from API
 * @property {string|null}  error        - Error message if fetch failed
 */

/**
 * Hook: polls /api/platform/shops/:shopId every 60 seconds.
 * Returns null-safe defaults — safe to use even if shopId is undefined.
 *
 * @param {string|null|undefined} shopId  UUID of the shop to check
 * @returns {ShopAvailabilityState}
 */
export const useShopAvailability = (shopId) => {
  const [state, setState] = useState({
    isOrderable: true,   // Optimistic default — assume open until first fetch
    isLoading:   !!shopId, // Only loading if we have a shopId to fetch
    reason:      null,
    blockedBy:   null,
    shopStatus:  null,
    error:       null,
  });

  const abortControllerRef = useRef(null);
  const intervalRef        = useRef(null);
  const isMountedRef       = useRef(true);

  const fetchShopStatus = useCallback(async () => {
    if (!shopId) {
      // No shop to check → assume orderable
      setState({
        isOrderable: true,
        isLoading:   false,
        reason:      null,
        blockedBy:   null,
        shopStatus:  null,
        error:       null,
      });
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/platform/shops/${shopId}`, {
        signal: abortControllerRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      if (!json?.success || !json?.data) {
        throw new Error('Invalid API response format');
      }

      const data = json.data;

      if (isMountedRef.current) {
        setState({
          isOrderable: data.isOrderable ?? true,
          isLoading:   false,
          reason:      data.reason    ?? null,
          blockedBy:   data.blockedBy ?? null,
          shopStatus:  data,
          error:       null,
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;

      console.warn('[useShopAvailability] Fetch failed — keeping last known state:', err.message);

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message,
          // Keep isOrderable as true on transient errors — don't block cart due to poll failure
          // The DB trigger is the final safety net
          isOrderable: prev.isOrderable ?? true,
        }));
      }
    }
  }, [shopId]);

  useEffect(() => {
    isMountedRef.current = true;

    // Reset to loading state when shopId changes
    setState((prev) => ({
      ...prev,
      isLoading: !!shopId,
      isOrderable: !shopId ? true : prev.isOrderable,
    }));

    fetchShopStatus();

    // Start polling
    intervalRef.current = setInterval(fetchShopStatus, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchShopStatus, shopId]);

  return state;
};

export default useShopAvailability;
