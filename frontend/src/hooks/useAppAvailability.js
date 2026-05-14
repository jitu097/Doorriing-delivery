/**
 * useAppAvailability.js
 *
 * Reusable React hook for User App and Admin Panel.
 *
 * Polls GET /api/platform/availability every 30 seconds.
 * Returns the computed open/closed state and raw settings.
 *
 * Usage in User App:
 * ------------------
 *   import { useAppAvailability } from '@/hooks/useAppAvailability';
 *
 *   const { isOpen, isLoading, reason, blockedBy, settings } = useAppAvailability();
 *
 *   // On checkout page:
 *   if (!isOpen) {
 *     return <UnavailableBanner message={reason} />;
 *   }
 *
 * API Contract:
 * -------------
 *   GET /api/platform/availability
 *   Response: {
 *     success: true,
 *     data: {
 *       is_app_enabled:       boolean,
 *       delivery_start_time:  "HH:MM",
 *       delivery_end_time:    "HH:MM",
 *       maintenance_message:  string,
 *       isCurrentlyOpen:      boolean,
 *       closedReason:         string | null,
 *       blockedBy:            "toggle" | "time_window" | null,
 *       updated_at:           ISO string
 *     }
 *   }
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/** Base API URL — adjust to match your app's API base. */
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') + '/api' ||
  'https://doorriing-delivery-3.onrender.com/api';

/** Poll interval: 30 seconds */
const POLL_INTERVAL_MS = 30_000;

/**
 * @typedef {Object} AvailabilityState
 * @property {boolean}      isOpen     - Whether new orders can be placed right now
 * @property {boolean}      isLoading  - True on the initial fetch only
 * @property {string|null}  reason     - Human-readable closed reason (null if open)
 * @property {string|null}  blockedBy  - "toggle" | "time_window" | null
 * @property {object|null}  settings   - Full raw settings object from API
 * @property {string|null}  error      - Error message if fetch failed
 */

/**
 * Hook: polls /api/platform/availability every 30 seconds.
 * Safe to use in: checkout page, home screen, cart, order placement.
 */
export const useAppAvailability = () => {
  const [state, setState] = useState({
    isOpen:    true,   // Optimistic default: assume open until first fetch
    isLoading: true,
    reason:    null,
    blockedBy: null,
    settings:  null,
    error:     null,
  });

  const abortControllerRef = useRef(null);
  const intervalRef        = useRef(null);
  const isMountedRef       = useRef(true);

  const fetchAvailability = useCallback(async () => {
    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/platform/availability`, {
        signal: abortControllerRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
        // No credentials needed — this is a public endpoint
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
          isOpen:    data.isCurrentlyOpen ?? true,
          isLoading: false,
          reason:    data.closedReason   ?? null,
          blockedBy: data.blockedBy      ?? null,
          settings:  data,
          error:     null,
        });
      }
    } catch (err) {
      // Ignore AbortError (expected on cleanup / re-fetch)
      if (err.name === 'AbortError') return;

      console.warn('[useAppAvailability] Fetch failed — keeping last known state:', err.message);

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message,
          // Keep isOpen as true on transient errors — don't block orders due to poll failure
          isOpen: prev.isOpen ?? true,
        }));
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchAvailability();

    // Start polling
    intervalRef.current = setInterval(fetchAvailability, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAvailability]);

  return state;
};

export default useAppAvailability;
