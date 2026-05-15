/**
 * useOrderValidation.js
 *
 * React hook for User App — combines global app status + shop status
 * into a single "canOrder" flag using the backend's combined validation endpoint.
 *
 * This is the RECOMMENDED hook to use for:
 *   - Add to Cart buttons
 *   - Checkout page guard
 *   - Order placement confirmation
 *
 * Usage:
 * ------
 *   import { useOrderValidation } from '@/hooks/useOrderValidation';
 *
 *   // In a product listing component:
 *   const { canOrder, isLoading, reason, blockedBy } = useOrderValidation(shopId);
 *
 *   <button
 *     disabled={!canOrder || isLoading}
 *     onClick={handleAddToCart}
 *   >
 *     {!canOrder ? (reason || 'Unavailable') : 'Add to Cart'}
 *   </button>
 *
 *   // In checkout:
 *   if (!canOrder) {
 *     return <UnavailableBanner message={reason} />;
 *   }
 *
 * Why use this over useAppAvailability + useShopAvailability separately?
 * -----------------------------------------------------------------------
 *   - Single API call instead of two
 *   - Backend returns the combined result (app + shop)
 *   - Less polling overhead
 *   - Clean single `canOrder` boolean for UI decisions
 *
 * API Contract:
 * -------------
 *   POST /api/platform/validate-order
 *   Body: { shop_id: "<uuid>" }
 *   Response: {
 *     success: true,
 *     data: {
 *       canOrder:  boolean,
 *       reason:    string | null,
 *       blockedBy: "toggle" | "time_window" | "shop_closed" | "admin_blocked" | "inactive" | null
 *     }
 *   }
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/** Base API URL — adjust to match your app's API base. */
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.replace(/\/api\/?$/, '') + '/api') ||
  'https://doorriing-delivery-3.onrender.com/api';

/** Poll interval: 30 seconds */
const POLL_INTERVAL_MS = 30_000;

/**
 * @typedef {Object} OrderValidationState
 * @property {boolean}      canOrder   - True if both app and shop are open
 * @property {boolean}      isLoading  - True on the initial check only
 * @property {string|null}  reason     - Human-readable reason why ordering is blocked
 * @property {string|null}  blockedBy  - Machine-readable block cause
 * @property {string|null}  error      - Error message if the check request failed
 */

/**
 * Hook: checks if orders are allowed for the given shop, polling every 30s.
 *
 * @param {string|null|undefined} shopId  UUID of the shop (can be null for global-only check)
 * @returns {OrderValidationState}
 */
export const useOrderValidation = (shopId) => {
  const [state, setState] = useState({
    canOrder:  true,   // Optimistic default
    isLoading: true,
    reason:    null,
    blockedBy: null,
    error:     null,
  });

  const abortControllerRef = useRef(null);
  const intervalRef        = useRef(null);
  const isMountedRef       = useRef(true);

  const validate = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/platform/validate-order`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId || null }),
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
          canOrder:  data.canOrder  ?? true,
          isLoading: false,
          reason:    data.reason    ?? null,
          blockedBy: data.blockedBy ?? null,
          error:     null,
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;

      console.warn('[useOrderValidation] Check failed — keeping last known state:', err.message);

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message,
          // Fail open on transient errors — DB trigger is the safety net
          canOrder: prev.canOrder ?? true,
        }));
      }
    }
  }, [shopId]);

  useEffect(() => {
    isMountedRef.current = true;

    validate();
    intervalRef.current = setInterval(validate, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [validate]);

  return state;
};

export default useOrderValidation;
