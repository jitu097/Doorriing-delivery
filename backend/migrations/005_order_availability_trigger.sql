-- ============================================================
-- Migration 005: App Availability Enforcement Trigger
-- VERSION 2 — Fixes overnight window support (e.g. 09:00–03:00)
--
-- SAFE TO RE-RUN: uses CREATE OR REPLACE + DROP TRIGGER IF EXISTS
-- Run this in Supabase SQL editor to replace the previous version.
-- ============================================================

-- ── 1. Helper function: IST-aware availability check ───────────
--
-- Correctly handles OVERNIGHT windows where end_time < start_time.
-- Example: Start=09:00, End=03:00 → open from 9AM until 3AM next day.
--
CREATE OR REPLACE FUNCTION check_app_availability_open()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_is_enabled   BOOLEAN;
  v_start_time   VARCHAR(5);
  v_end_time     VARCHAR(5);
  v_now_ist      TIME;
  v_start        TIME;
  v_end          TIME;
BEGIN
  -- Fetch single-row config (id = 1)
  SELECT
    is_app_enabled,
    delivery_start_time,
    delivery_end_time
  INTO
    v_is_enabled,
    v_start_time,
    v_end_time
  FROM app_availability
  WHERE id = 1
  LIMIT 1;

  -- If config row is missing: fail OPEN (safe default)
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- 1. Check global toggle
  IF NOT v_is_enabled THEN
    RETURN FALSE;
  END IF;

  -- 2. Check delivery time window (IST)
  v_now_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::TIME;
  v_start   := v_start_time::TIME;
  v_end     := v_end_time::TIME;

  -- ── Overnight window support ────────────────────────────────────
  -- If end < start (e.g. 09:00 → 03:00), the window spans midnight.
  -- In that case, we are OPEN if: now >= start  OR  now <= end
  -- We are CLOSED only during the gap: end < now < start
  -- (e.g. closed between 03:01 AM and 08:59 AM)
  --
  -- If end >= start (normal same-day window, e.g. 09:00 → 23:00):
  -- We are OPEN if: start <= now <= end
  -- ───────────────────────────────────────────────────────────────

  IF v_end < v_start THEN
    -- OVERNIGHT WINDOW
    -- Blocked only during the gap between end and start
    IF v_now_ist > v_end AND v_now_ist < v_start THEN
      RETURN FALSE;
    END IF;
  ELSE
    -- SAME-DAY WINDOW
    IF v_now_ist < v_start OR v_now_ist > v_end THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant execute to all roles that need it
GRANT EXECUTE ON FUNCTION check_app_availability_open() TO authenticated;
GRANT EXECUTE ON FUNCTION check_app_availability_open() TO anon;
GRANT EXECUTE ON FUNCTION check_app_availability_open() TO service_role;


-- ── 2. Trigger function ─────────────────────────────────────────
--
CREATE OR REPLACE FUNCTION trg_block_order_when_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message TEXT;
  v_is_open BOOLEAN;
BEGIN
  v_is_open := check_app_availability_open();

  IF NOT v_is_open THEN
    -- Fetch user-facing message from config
    SELECT maintenance_message
    INTO v_message
    FROM app_availability
    WHERE id = 1
    LIMIT 1;

    IF v_message IS NULL OR v_message = '' THEN
      v_message := 'We are currently not accepting orders. Please try again later.';
    END IF;

    -- Abort the INSERT. Supabase JS client receives error code P0001
    -- with the full message including the APP_UNAVAILABLE prefix.
    RAISE EXCEPTION 'APP_UNAVAILABLE: %', v_message
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION trg_block_order_when_closed() TO authenticated;
GRANT EXECUTE ON FUNCTION trg_block_order_when_closed() TO anon;
GRANT EXECUTE ON FUNCTION trg_block_order_when_closed() TO service_role;


-- ── 3. Attach trigger to orders table ──────────────────────────
--
DROP TRIGGER IF EXISTS trg_check_app_availability ON orders;

CREATE TRIGGER trg_check_app_availability
  BEFORE INSERT
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_block_order_when_closed();


-- ── 4. Verify trigger is active ─────────────────────────────────
--
-- Run this SELECT after migration to confirm:
--
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'orders'
--   AND trigger_name = 'trg_check_app_availability';
--
-- Expected: trigger_name=trg_check_app_availability | INSERT | BEFORE


-- ── 5. Test overnight window (optional) ────────────────────────
--
-- With Start=09:00 End=03:00 and current IST time = 02:11 AM:
-- SELECT check_app_availability_open();  → should return TRUE
--
-- With Start=09:00 End=03:00 and current IST time = 05:00 AM (gap):
-- UPDATE app_availability SET delivery_start_time='09:00', delivery_end_time='03:00' WHERE id=1;
-- The function will return FALSE only between 03:01 AM and 08:59 AM IST.
