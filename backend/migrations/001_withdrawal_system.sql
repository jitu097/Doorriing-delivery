-- ============================================================
-- Doorriing — Withdrawal Request Approval System
-- Run this in the Supabase SQL Editor (once)
-- ============================================================

-- ── 1. withdraw_requests ──────────────────────────────────
CREATE TABLE IF NOT EXISTS withdraw_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL,
  amount              NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  method              TEXT NOT NULL CHECK (method IN ('bank', 'upi')),
  bank_account_name   TEXT,
  bank_account_number TEXT,
  bank_ifsc           TEXT,
  upi_id              TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_swr_shop_id ON withdraw_requests (shop_id);
CREATE INDEX IF NOT EXISTS idx_swr_status  ON withdraw_requests (status);

-- ── 2. seller_wallet_transactions ──────────────────────────
CREATE TABLE IF NOT EXISTS seller_wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reference   TEXT,            -- e.g. withdrawal request id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swt_shop_id ON seller_wallet_transactions (shop_id);

-- ── 3. seller_wallets (balance store) ─────────────────────
-- Only create if it does not already exist
CREATE TABLE IF NOT EXISTS seller_wallets (
  shop_id    UUID PRIMARY KEY,
  balance    NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. notifications ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID,
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_shop_id ON notifications (shop_id);
