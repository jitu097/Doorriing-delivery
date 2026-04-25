-- ============================================================
-- Admin Notification System (Withdrawal Only)
-- ============================================================

-- 1. admin_notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     TEXT, -- Changed from UUID to TEXT to support 'temp-admin'
  target_type  TEXT NOT NULL CHECK (target_type IN ('all', 'single')) DEFAULT 'all',
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'WITHDRAWAL_REQUEST',
  data         JSONB NOT NULL DEFAULT '{}',
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_admin_is_read ON admin_notifications (admin_id, is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notif_created_at ON admin_notifications (created_at DESC);

-- 2. admin_notification_tokens
CREATE TABLE IF NOT EXISTS admin_notification_tokens (
  fcm_token    TEXT PRIMARY KEY,
  admin_id     TEXT NOT NULL, -- Changed from UUID to TEXT
  device_id    TEXT,
  platform     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS if needed, but for now we assume the backend handles access
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Simple policies for backend access (authenticated)
-- In a real setup, you'd restrict this further based on admin role
CREATE POLICY "Admins can view notifications" ON admin_notifications
  FOR SELECT USING (true);

CREATE POLICY "Admins can update notifications" ON admin_notifications
  FOR UPDATE USING (true);

CREATE POLICY "Admins can manage tokens" ON admin_notification_tokens
  FOR ALL USING (true);
