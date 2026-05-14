'use strict';

/**
 * appAvailability.service.js
 *
 * Single source of truth for User App availability settings.
 * Uses an in-memory cache (30 s TTL) to prevent hammering Supabase
 * on every user-app poll request.
 *
 * Table: app_availability (always a single row with id=1)
 */

const createError = require('http-errors');
const { getSupabaseClient } = require('../config/db');
const { logger } = require('../utils/logger');

// ---------------------------------------------------------------------------
// IST Timezone Helpers
// ---------------------------------------------------------------------------

/** India Standard Time offset: UTC+5:30 = 330 minutes */
const IST_OFFSET_MINUTES = 330;

/**
 * Returns the current time in IST as { hours, minutes, totalMinutes }.
 * Avoids relying on server TZ configuration — always computes from UTC.
 */
const getCurrentISTTime = () => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const istMs = utcMs + IST_OFFSET_MINUTES * 60_000;
  const istDate = new Date(istMs);

  const hours   = istDate.getHours();
  const minutes = istDate.getMinutes();
  return { hours, minutes, totalMinutes: hours * 60 + minutes };
};

/**
 * Parses an "HH:MM" string into total minutes from midnight.
 * Returns null if the string is invalid.
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

/**
 * Formats minutes-from-midnight as a human-readable "9:00 AM" style string.
 */
const formatMinutesToDisplay = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
};

// ---------------------------------------------------------------------------
// In-Memory Cache
// ---------------------------------------------------------------------------

/** Cache TTL in milliseconds (30 seconds) */
const CACHE_TTL_MS = 30_000;

let _cache = null;
let _cacheExpiresAt = 0;

const getCached = () => {
  if (_cache && Date.now() < _cacheExpiresAt) return _cache;
  return null;
};

const setCache = (data) => {
  _cache = data;
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
};

const bustCache = () => {
  _cache = null;
  _cacheExpiresAt = 0;
};

// ---------------------------------------------------------------------------
// Core DB Operations
// ---------------------------------------------------------------------------

/**
 * Fetches the single row from app_availability.
 * Returns cached data if fresh; otherwise hits Supabase.
 */
const getAvailability = async () => {
  const cached = getCached();
  if (cached) {
    logger.debug('[AppAvailability] Returning cached settings');
    return cached;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('app_availability')
    .select('id, is_app_enabled, delivery_start_time, delivery_end_time, maintenance_message, updated_by, updated_at')
    .eq('id', 1)
    .single();

  if (error) {
    logger.error(`[AppAvailability] DB fetch error: ${error.code} — ${error.message}`);
    throw createError(500, 'Failed to fetch app availability settings');
  }

  if (!data) {
    // Row missing — return safe defaults (app is OPEN) so production is never broken
    logger.warn('[AppAvailability] No row found — returning safe defaults');
    return buildDefaultSettings();
  }

  setCache(data);
  logger.debug('[AppAvailability] Fetched fresh from DB');
  return data;
};

/**
 * Updates the app_availability row. Busts cache after success.
 * @param {object} payload  — partial or full update fields
 * @param {string} adminEmail — who made the change (audit trail)
 */
const updateAvailability = async (payload, adminEmail = 'admin') => {
  const supabase = getSupabaseClient();

  // Whitelist allowed fields to prevent injection of arbitrary columns
  const allowed = ['is_app_enabled', 'delivery_start_time', 'delivery_end_time', 'maintenance_message'];
  const update = { updated_at: new Date().toISOString(), updated_by: adminEmail };

  allowed.forEach((key) => {
    if (payload[key] !== undefined) update[key] = payload[key];
  });

  // Upsert: always write to row id=1
  const { data, error } = await supabase
    .from('app_availability')
    .upsert({ id: 1, ...update }, { onConflict: 'id' })
    .select('id, is_app_enabled, delivery_start_time, delivery_end_time, maintenance_message, updated_by, updated_at')
    .single();

  if (error) {
    logger.error(`[AppAvailability] DB update error: ${error.code} — ${error.message}`);
    throw createError(500, 'Failed to update app availability settings');
  }

  bustCache();
  logger.info(`[AppAvailability] Settings updated by ${adminEmail}: ${JSON.stringify(update)}`);
  return data;
};

// ---------------------------------------------------------------------------
// Availability Check Logic
// ---------------------------------------------------------------------------

/**
 * Computes whether the User App is currently open for new orders.
 * Checks BOTH the global toggle and the delivery time window.
 *
 * Supports OVERNIGHT windows where end < start.
 * Example: Start=09:00 End=03:00 → open 9AM→midnight→3AM (next day).
 *
 * @param {object} settings - from getAvailability() or buildDefaultSettings()
 * @returns {{ isOpen: boolean, reason: string | null, blockedBy: string | null }}
 */
const computeIsOpen = (settings) => {
  // 1. Global toggle
  if (!settings.is_app_enabled) {
    return {
      isOpen: false,
      reason: settings.maintenance_message || 'We are currently not accepting orders. Please try again later.',
      blockedBy: 'toggle',
    };
  }

  // 2. Delivery time window
  const startMinutes = parseTimeToMinutes(settings.delivery_start_time);
  const endMinutes   = parseTimeToMinutes(settings.delivery_end_time);

  if (startMinutes !== null && endMinutes !== null) {
    const { totalMinutes } = getCurrentISTTime();

    let withinWindow;
    const isOvernightWindow = endMinutes < startMinutes;

    if (isOvernightWindow) {
      // Overnight: e.g. Start=09:00 (540), End=03:00 (180)
      // Window spans midnight. Open if: now >= start OR now <= end
      // Closed only in the gap: 03:01 AM – 08:59 AM
      withinWindow = totalMinutes >= startMinutes || totalMinutes <= endMinutes;
    } else {
      // Same-day: e.g. Start=09:00 (540), End=23:00 (1380)
      // Open if: start <= now <= end
      withinWindow = totalMinutes >= startMinutes && totalMinutes <= endMinutes;
    }

    if (!withinWindow) {
      const startDisplay = formatMinutesToDisplay(startMinutes);
      const endDisplay   = formatMinutesToDisplay(endMinutes);
      const windowLabel  = isOvernightWindow
        ? `${startDisplay} – ${endDisplay} (next day)`
        : `${startDisplay} – ${endDisplay}`;
      return {
        isOpen: false,
        reason: `Orders are available between ${windowLabel}`,
        blockedBy: 'time_window',
      };
    }
  }

  // 3. All checks passed — app is open
  return { isOpen: true, reason: null, blockedBy: null };
};

/**
 * Convenience function: fetches settings and returns computed open state.
 * Used by the server-side order guard middleware.
 */
const checkIsOpen = async () => {
  const settings = await getAvailability();
  return computeIsOpen(settings);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildDefaultSettings = () => ({
  id: 1,
  is_app_enabled: true,
  delivery_start_time: '09:00',
  delivery_end_time: '23:00',
  maintenance_message: 'We are currently not accepting orders. Please try again later.',
  updated_by: 'system',
  updated_at: new Date().toISOString(),
});

module.exports = {
  getAvailability,
  updateAvailability,
  computeIsOpen,
  checkIsOpen,
  getCurrentISTTime,
  buildDefaultSettings,
};
