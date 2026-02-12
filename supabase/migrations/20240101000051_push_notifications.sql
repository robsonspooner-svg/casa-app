-- Mission 17: Push Notifications & Alerts
-- Comprehensive notification infrastructure: push tokens, notification center,
-- global settings, scheduled notifications, and dispatch helpers.
--
-- Pre-existing tables (from migration 035): notification_preferences, notification_logs, scheduled_messages
-- Pre-existing tables (from migration 015): email_notifications
-- This migration adds new tables that complement the existing schema without conflicts.

-- ============================================================
-- 1. PUSH TOKENS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_token_unique
  ON push_tokens(token);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active
  ON push_tokens(user_id)
  WHERE is_active = TRUE;

-- ============================================================
-- 2. NOTIFICATIONS TABLE (user-facing notification center)
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  related_type TEXT,
  related_id UUID,
  push_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  sms_sent BOOLEAN NOT NULL DEFAULT FALSE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_related
  ON notifications(related_type, related_id)
  WHERE related_type IS NOT NULL;

-- ============================================================
-- 3. NOTIFICATION SETTINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_start TIME DEFAULT '22:00',
  quiet_end TIME DEFAULT '07:00',
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  email_digest TEXT NOT NULL DEFAULT 'immediate'
    CHECK (email_digest IN ('immediate', 'daily', 'weekly', 'none')),
  email_digest_time TIME DEFAULT '09:00',
  do_not_disturb_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. SCHEDULED NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  scheduled_for TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT,
  related_type TEXT,
  related_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
  ON scheduled_notifications(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user
  ON scheduled_notifications(user_id, status);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_related
  ON scheduled_notifications(related_type, related_id, status)
  WHERE status = 'pending';

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own notification settings"
  ON notification_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own scheduled notifications"
  ON scheduled_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users cancel own scheduled notifications"
  ON scheduled_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS push_tokens_updated_at ON push_tokens;
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS notification_settings_updated_at ON notification_settings;
CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. send_notification() — dispatch helper function
-- ============================================================

CREATE OR REPLACE FUNCTION send_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, type, title, body, data,
    related_type, related_id,
    push_sent, email_sent, sms_sent
  ) VALUES (
    p_user_id, p_type, p_title, p_body, p_data,
    p_related_type, p_related_id,
    FALSE, FALSE, FALSE
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- ============================================================
-- 8. should_notify() — channel preference check
-- ============================================================

CREATE OR REPLACE FUNCTION should_notify(
  p_user_id UUID,
  p_notification_type TEXT,
  p_channel TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
  v_settings notification_settings%ROWTYPE;
  v_enabled BOOLEAN := FALSE;
BEGIN
  SELECT push_enabled, email_enabled, sms_enabled,
         quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    INTO v_prefs
    FROM notification_preferences
    WHERE user_id = p_user_id;

  IF v_prefs IS NULL THEN
    IF p_channel IN ('push', 'email') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  CASE p_channel
    WHEN 'push'  THEN v_enabled := v_prefs.push_enabled;
    WHEN 'email' THEN v_enabled := v_prefs.email_enabled;
    WHEN 'sms'   THEN v_enabled := v_prefs.sms_enabled;
    ELSE RETURN FALSE;
  END CASE;

  IF NOT v_enabled THEN
    RETURN FALSE;
  END IF;

  IF p_channel IN ('push', 'sms') THEN
    SELECT * INTO v_settings
      FROM notification_settings
      WHERE user_id = p_user_id;

    IF v_settings IS NOT NULL AND v_settings.quiet_hours_enabled THEN
      IF (CURRENT_TIME AT TIME ZONE COALESCE(v_settings.timezone, 'Australia/Sydney'))
         BETWEEN v_settings.quiet_start AND v_settings.quiet_end THEN
        RETURN FALSE;
      END IF;
    ELSIF v_prefs.quiet_hours_enabled THEN
      IF CURRENT_TIME BETWEEN v_prefs.quiet_hours_start AND v_prefs.quiet_hours_end THEN
        RETURN FALSE;
      END IF;
    END IF;

    IF v_settings IS NOT NULL
       AND v_settings.do_not_disturb_until IS NOT NULL
       AND NOW() < v_settings.do_not_disturb_until THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 9. init_notification_settings() — new profile trigger
-- ============================================================

CREATE OR REPLACE FUNCTION init_notification_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO notification_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_notification_settings_init ON profiles;
CREATE TRIGGER user_notification_settings_init
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION init_notification_settings();

-- ============================================================
-- 10. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
