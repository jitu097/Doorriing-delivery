-- ============================================================
-- Migration 004: App Availability Control
-- Run once in Supabase SQL editor or via psql.
-- ============================================================

-- Create table
CREATE TABLE IF NOT EXISTS app_availability (
  id                   SERIAL PRIMARY KEY,
  is_app_enabled       BOOLEAN NOT NULL DEFAULT true,
  delivery_start_time  VARCHAR(5) NOT NULL DEFAULT '09:00',   -- HH:MM format (IST)
  delivery_end_time    VARCHAR(5) NOT NULL DEFAULT '23:00',   -- HH:MM format (IST)
  maintenance_message  TEXT NOT NULL DEFAULT 'We are currently not accepting orders. Please try again later.',
  updated_by           TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add descriptive comment
COMMENT ON TABLE app_availability IS
  'Single-row configuration table controlling global User App availability and delivery time windows.';

COMMENT ON COLUMN app_availability.is_app_enabled IS
  'When false, all new order placement is blocked regardless of delivery time.';

COMMENT ON COLUMN app_availability.delivery_start_time IS
  'Delivery window start time in HH:MM format (IST). Orders outside window are blocked.';

COMMENT ON COLUMN app_availability.delivery_end_time IS
  'Delivery window end time in HH:MM format (IST). Orders outside window are blocked.';

COMMENT ON COLUMN app_availability.maintenance_message IS
  'User-facing message shown when the app is disabled or outside delivery hours.';

-- Ensure exactly one row always exists (upsert-safe seed)
INSERT INTO app_availability (
  id,
  is_app_enabled,
  delivery_start_time,
  delivery_end_time,
  maintenance_message,
  updated_by,
  updated_at
)
VALUES (
  1,
  true,
  '09:00',
  '23:00',
  'We are currently not accepting orders. Please try again later.',
  'system',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Index for fast single-row lookup (optional — table has 1 row, but good practice)
CREATE INDEX IF NOT EXISTS idx_app_availability_id ON app_availability (id);
