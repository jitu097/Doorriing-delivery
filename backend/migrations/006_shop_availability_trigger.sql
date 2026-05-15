-- ============================================================
-- Migration 006: Shop-Level Order Availability Enforcement
-- VERSION 1 — Safe to run, uses CREATE OR REPLACE + DROP IF EXISTS
--
-- WHAT THIS DOES:
--   Adds a second BEFORE INSERT trigger on the orders table that
--   validates the SHOP's own open/close status before allowing
--   any new order to be inserted.
--
--   This works IN ADDITION TO the global app availability trigger
--   (migration 005). Both triggers must pass for an order to succeed.
--
-- BLOCKS orders when:
--   1. The shop does not exist
--   2. The shop is blocked by admin (is_blocked = true)
--   3. The shop is inactive (is_active = false)
--   4. The shop has is_open = false (seller manually closed shop)
--      NOTE: is_open column is added by this migration if it doesn't exist.
--
-- SAFE for:
--   • Existing active orders (trigger is BEFORE INSERT only)
--   • Order status updates (PATCH/UPDATE — not touched)
--   • Payment flows (no changes)
--   • Admin/delivery flows (no changes)
-- ============================================================


-- ── 0. Add is_open column to shops table (if not already present) ───────────
-- This column lets sellers toggle their shop open/closed from the Seller App.
-- Defaults to TRUE so all existing shops remain open after migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'is_open'
  ) THEN
    ALTER TABLE shops ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT true;
    COMMENT ON COLUMN shops.is_open IS
      'Seller-controlled open/close toggle. When false, no new orders can be placed for this shop.';
  END IF;
END;
$$;


-- ── 1. Helper function: validate shop is orderable ─────────────────────────
--
-- Returns TRUE  → shop is open and can accept orders
-- Returns FALSE → shop is closed, blocked, or inactive
-- Returns TRUE  → if shop_id is NULL (safe default — let other checks fail)
--
CREATE OR REPLACE FUNCTION check_shop_is_open(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_is_active  BOOLEAN;
  v_is_blocked BOOLEAN;
  v_is_open    BOOLEAN;
BEGIN
  -- If no shop_id provided, fail open (let DB constraints handle it)
  IF p_shop_id IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT
    is_active,
    is_blocked,
    COALESCE(is_open, true)   -- default true if column somehow null
  INTO
    v_is_active,
    v_is_blocked,
    v_is_open
  FROM shops
  WHERE id = p_shop_id
  LIMIT 1;

  -- Shop not found → block order (shop doesn't exist)
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Shop is blocked by admin
  IF v_is_blocked = true THEN
    RETURN FALSE;
  END IF;

  -- Shop is deactivated
  IF v_is_active = false THEN
    RETURN FALSE;
  END IF;

  -- Seller has closed their shop
  IF v_is_open = false THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant execute permissions to all roles that insert orders
GRANT EXECUTE ON FUNCTION check_shop_is_open(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_shop_is_open(UUID) TO anon;
GRANT EXECUTE ON FUNCTION check_shop_is_open(UUID) TO service_role;


-- ── 2. Trigger function: block order if shop is closed ────────────────────
--
CREATE OR REPLACE FUNCTION trg_block_order_when_shop_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_open    BOOLEAN;
  v_shop_name  TEXT;
  v_is_blocked BOOLEAN;
  v_is_active  BOOLEAN;
  v_seller_open BOOLEAN;
BEGIN
  -- Run the shop availability check
  v_is_open := check_shop_is_open(NEW.shop_id);

  IF NOT v_is_open THEN
    -- Fetch shop details for a helpful error message
    SELECT
      shop_name,
      is_blocked,
      is_active,
      COALESCE(is_open, true)
    INTO
      v_shop_name,
      v_is_blocked,
      v_is_active,
      v_seller_open
    FROM shops
    WHERE id = NEW.shop_id
    LIMIT 1;

    -- Compose user-friendly error based on the specific block reason
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SHOP_UNAVAILABLE: This shop is no longer available.'
        USING ERRCODE = 'P0001';
    ELSIF v_is_blocked THEN
      RAISE EXCEPTION 'SHOP_UNAVAILABLE: This shop is currently unavailable. Please try another shop.'
        USING ERRCODE = 'P0001';
    ELSIF NOT v_is_active THEN
      RAISE EXCEPTION 'SHOP_UNAVAILABLE: This shop is currently not accepting orders.'
        USING ERRCODE = 'P0001';
    ELSIF NOT v_seller_open THEN
      RAISE EXCEPTION 'SHOP_CLOSED: % is currently closed. Please try again when the shop opens.'
        , COALESCE(v_shop_name, 'This shop')
        USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION 'SHOP_UNAVAILABLE: This shop is not accepting orders right now.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION trg_block_order_when_shop_closed() TO authenticated;
GRANT EXECUTE ON FUNCTION trg_block_order_when_shop_closed() TO anon;
GRANT EXECUTE ON FUNCTION trg_block_order_when_shop_closed() TO service_role;


-- ── 3. Attach trigger to orders table ─────────────────────────────────────
--
-- This trigger fires AFTER the global app availability trigger (005),
-- so if the app is closed, the 005 trigger already blocks it.
-- Trigger names sort alphabetically: trg_block_order_when_closed fires first,
-- then trg_block_shop_closed. Both must pass.
--
DROP TRIGGER IF EXISTS trg_check_shop_availability ON orders;

CREATE TRIGGER trg_check_shop_availability
  BEFORE INSERT
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_block_order_when_shop_closed();


-- ── 4. Verify triggers are active ──────────────────────────────────────────
--
-- Run after migration to confirm both triggers exist:
--
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'orders'
-- ORDER BY trigger_name;
--
-- Expected:
--   trg_check_app_availability  | INSERT | BEFORE   ← from migration 005
--   trg_check_shop_availability | INSERT | BEFORE   ← this migration


-- ── 5. Test queries (run manually to verify) ──────────────────────────────
--
-- Test 1: Close a specific shop and attempt an order → should FAIL
-- UPDATE shops SET is_open = false WHERE id = '<your-shop-id>';
-- INSERT INTO orders (shop_id, ...) VALUES ('<your-shop-id>', ...); -- FAILS
-- UPDATE shops SET is_open = true WHERE id = '<your-shop-id>';
--
-- Test 2: Verify is_open column exists
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'shops' AND column_name = 'is_open';
--
-- Test 3: Check shop function directly
-- SELECT check_shop_is_open('<your-shop-id>');  → should return t (true)
