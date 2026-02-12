-- Mission 18 Phase A: MFA Infrastructure & Field-Level Encryption
-- Creates tables for TOTP-based MFA, recovery codes, and tracks encrypted fields

-- =============================================================================
-- MFA Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_mfa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  totp_secret TEXT NOT NULL, -- Encrypted TOTP secret (enc: prefixed)
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS user_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, -- Hashed recovery code (bcrypt or SHA-256)
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON user_recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_unused ON user_recovery_codes(user_id) WHERE used_at IS NULL;

-- Triggers for updated_at
CREATE TRIGGER set_user_mfa_updated_at
  BEFORE UPDATE ON user_mfa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own MFA settings"
  ON user_mfa FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own MFA settings"
  ON user_mfa FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own recovery codes"
  ON user_recovery_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own recovery codes"
  ON user_recovery_codes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- Rate Limiting Enhancement
-- =============================================================================

-- Function to enforce login rate limiting (called from auth hooks)
CREATE OR REPLACE FUNCTION enforce_login_rate_limit(p_email TEXT, p_ip_address TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_failures INTEGER;
  v_lockout_until TIMESTAMPTZ;
BEGIN
  -- Count failed attempts in the last 15 minutes
  SELECT COUNT(*), MAX(
    CASE WHEN attempt_count >= 5 THEN created_at + INTERVAL '15 minutes' END
  )
  INTO v_recent_failures, v_lockout_until
  FROM login_attempts
  WHERE email = p_email
    AND success = false
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- If locked out, check if lockout has expired
  IF v_lockout_until IS NOT NULL AND v_lockout_until > NOW() THEN
    RETURN false; -- Still locked out
  END IF;

  -- Allow if fewer than 5 failures
  IF v_recent_failures < 5 THEN
    RETURN true;
  END IF;

  -- Create security alert for repeated failures
  IF v_recent_failures = 5 THEN
    INSERT INTO security_alerts (user_id, alert_type, severity, title, description)
    SELECT id, 'brute_force_detected', 'high',
      'Unusual Login Activity',
      'Multiple failed login attempts detected for your account. Your account has been temporarily locked for 15 minutes.'
    FROM profiles WHERE email = p_email
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN false;
END;
$$;

-- =============================================================================
-- Session Timeout Configuration
-- =============================================================================

-- Add session timeout preferences to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'session_timeout_minutes'
  ) THEN
    ALTER TABLE profiles ADD COLUMN session_timeout_minutes INTEGER DEFAULT 1440; -- 24 hours default
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'mfa_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN mfa_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- =============================================================================
-- Data Lifecycle & Audit Retention
-- =============================================================================

-- Function to enforce audit log retention (7 years for financial, 2 years for general)
CREATE OR REPLACE FUNCTION cleanup_audit_logs(p_general_retention_days INTEGER DEFAULT 730)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_general_deleted INTEGER;
  v_sessions_deleted INTEGER;
BEGIN
  -- Delete general audit logs older than retention period (but keep financial forever)
  DELETE FROM audit_log
  WHERE created_at < NOW() - (p_general_retention_days || ' days')::INTERVAL
    AND resource_type NOT IN ('payment', 'rent', 'bond', 'arrears', 'subscription')
  RETURNING 1;
  GET DIAGNOSTICS v_general_deleted = ROW_COUNT;

  -- Clean up old sessions (keep last 90 days)
  DELETE FROM user_sessions
  WHERE last_active_at < NOW() - INTERVAL '90 days'
  RETURNING 1;
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'general_audit_deleted', v_general_deleted,
    'sessions_deleted', v_sessions_deleted,
    'executed_at', NOW()
  );
END;
$$;

-- =============================================================================
-- Consent Versioning
-- =============================================================================

-- Add consent version tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_consents' AND column_name = 'consent_version'
  ) THEN
    ALTER TABLE user_consents ADD COLUMN consent_version TEXT DEFAULT '1.0';
  END IF;
END $$;

-- Required consent check function (for signup flow)
CREATE OR REPLACE FUNCTION check_required_consents(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check that user has accepted terms_of_service and privacy_policy
  RETURN EXISTS (
    SELECT 1 FROM user_consents
    WHERE user_id = p_user_id
      AND consent_type = 'terms_of_service'
      AND granted = true
  ) AND EXISTS (
    SELECT 1 FROM user_consents
    WHERE user_id = p_user_id
      AND consent_type = 'privacy_policy'
      AND granted = true
  );
END;
$$;
