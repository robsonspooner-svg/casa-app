-- Mission 18: Security & Data Protection
-- Database foundation for audit logging, session management, login tracking,
-- security alerts, consent management, data deletion requests, and sensitive
-- data access logging.
--
-- All tables use CREATE TABLE IF NOT EXISTS for idempotency.
-- All triggers use DROP TRIGGER IF EXISTS before creation.

-- ============================================================
-- 1. AUDIT_LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),

  -- Action details
  action TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'read', 'update', 'delete', 'login', 'logout')),
  resource_type TEXT,
  resource_id UUID,

  -- Context
  ip_address TEXT,
  user_agent TEXT,

  -- Data changes
  old_values JSONB,
  new_values JSONB,

  -- Result
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'error')),
  error_message TEXT,

  -- Agent-specific fields (Mission 14 integration)
  agent_execution BOOLEAN DEFAULT FALSE,
  agent_tool_name TEXT,
  agent_autonomy_level TEXT,
  agent_conversation_id UUID,
  agent_was_auto_executed BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. LOGIN_ATTEMPTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,

  -- Result
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  user_id UUID REFERENCES profiles(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. USER_SESSIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Session details
  session_token TEXT NOT NULL UNIQUE,

  -- Device info
  device_id TEXT,
  device_name TEXT,
  device_type TEXT CHECK (device_type IS NULL OR device_type IN ('ios', 'android', 'web')),
  ip_address TEXT,
  user_agent TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. SECURITY_ALERTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),

  -- Alert details
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB,

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. USER_CONSENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Consent details
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms', 'privacy', 'marketing', 'analytics')),
  version TEXT NOT NULL,
  consented BOOLEAN NOT NULL,

  -- Context
  ip_address TEXT,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, consent_type, version)
);

-- ============================================================
-- 6. DATA_DELETION_REQUESTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Request details
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete', 'rectify')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),

  -- Data scope
  data_types TEXT[],

  -- Processing
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  notes TEXT,

  -- Output
  export_url TEXT,
  export_expires_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. SENSITIVE_DATA_ACCESS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS sensitive_data_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Access details
  data_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download', 'export')),

  -- Context
  ip_address TEXT,
  purpose TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. INDEXES
-- ============================================================

-- audit_log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_resource
  ON audit_log(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_type
  ON audit_log(action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_agent
  ON audit_log(agent_execution, created_at DESC)
  WHERE agent_execution = TRUE;

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log(created_at DESC);

-- login_attempts indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_email
  ON login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip
  ON login_attempts(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user
  ON login_attempts(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- user_sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON user_sessions(user_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_sessions_token
  ON user_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
  ON user_sessions(expires_at)
  WHERE is_active = TRUE;

-- security_alerts indexes
CREATE INDEX IF NOT EXISTS idx_security_alerts_user
  ON security_alerts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_status
  ON security_alerts(status)
  WHERE status IN ('open', 'investigating');

CREATE INDEX IF NOT EXISTS idx_security_alerts_severity
  ON security_alerts(severity, created_at DESC)
  WHERE status IN ('open', 'investigating');

-- user_consents indexes
CREATE INDEX IF NOT EXISTS idx_user_consents_user
  ON user_consents(user_id, consent_type);

-- data_deletion_requests indexes
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user
  ON data_deletion_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status
  ON data_deletion_requests(status)
  WHERE status IN ('pending', 'processing');

-- sensitive_data_access indexes
CREATE INDEX IF NOT EXISTS idx_sensitive_data_access_user
  ON sensitive_data_access(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensitive_data_access_resource
  ON sensitive_data_access(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_sensitive_data_access_type
  ON sensitive_data_access(data_type, created_at DESC);

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensitive_data_access ENABLE ROW LEVEL SECURITY;

-- audit_log: users can view their own entries (insert-only for service role)
CREATE POLICY "Users view own audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- login_attempts: users can view their own entries (insert-only for service role)
CREATE POLICY "Users view own login attempts"
  ON login_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- user_sessions: users can view their own sessions
CREATE POLICY "Users view own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- user_sessions: users can update (terminate) their own sessions
CREATE POLICY "Users terminate own sessions"
  ON user_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- security_alerts: users can view their own alerts
CREATE POLICY "Users view own security alerts"
  ON security_alerts FOR SELECT
  USING (auth.uid() = user_id);

-- security_alerts: users can update (dismiss) their own alerts
CREATE POLICY "Users update own security alerts"
  ON security_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_consents: users can view their own consents
CREATE POLICY "Users view own consents"
  ON user_consents FOR SELECT
  USING (auth.uid() = user_id);

-- user_consents: users can insert new consents
CREATE POLICY "Users insert own consents"
  ON user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- data_deletion_requests: users can view their own requests
CREATE POLICY "Users view own data requests"
  ON data_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

-- data_deletion_requests: users can insert new requests
CREATE POLICY "Users insert own data requests"
  ON data_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- sensitive_data_access: users can view their own access logs (insert-only for service role)
CREATE POLICY "Users view own sensitive data access"
  ON sensitive_data_access FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 10. FUNCTIONS
-- ============================================================

-- Rate limiting function: checks if identifier has exceeded the action limit within the time window
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM audit_log
  WHERE (user_id::TEXT = p_identifier OR ip_address = p_identifier)
    AND action = p_action
    AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Returns TRUE if under the limit (action is allowed), FALSE if limit exceeded
  RETURN recent_count < p_limit;
END;
$$;

-- Suspicious activity detection trigger function
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for multiple failed login attempts (brute force detection)
  IF NEW.success = FALSE THEN
    IF (
      SELECT COUNT(*) FROM login_attempts
      WHERE email = NEW.email
        AND success = FALSE
        AND created_at > NOW() - INTERVAL '15 minutes'
    ) >= 5 THEN
      INSERT INTO security_alerts (alert_type, severity, title, description, data)
      VALUES (
        'multiple_failed_logins',
        'high',
        'Multiple Failed Login Attempts',
        'More than 5 failed login attempts in 15 minutes for ' || NEW.email,
        jsonb_build_object(
          'email', NEW.email,
          'ip_address', NEW.ip_address,
          'user_agent', NEW.user_agent
        )
      );
    END IF;
  END IF;

  -- Detect login from a previously unseen IP address for this user
  IF NEW.success = TRUE AND NEW.user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM login_attempts
      WHERE user_id = NEW.user_id
        AND ip_address = NEW.ip_address
        AND success = TRUE
        AND created_at < NEW.created_at
    ) THEN
      INSERT INTO security_alerts (user_id, alert_type, severity, title, description, data)
      VALUES (
        NEW.user_id,
        'new_login_location',
        'low',
        'Login from New Location',
        'Login detected from a new IP address',
        jsonb_build_object(
          'ip_address', NEW.ip_address,
          'user_agent', NEW.user_agent
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Log sensitive data access helper function
CREATE OR REPLACE FUNCTION log_sensitive_access(
  p_user_id UUID,
  p_data_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_access_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO sensitive_data_access (
    user_id,
    data_type,
    resource_type,
    resource_id,
    access_type
  ) VALUES (
    p_user_id,
    p_data_type,
    p_resource_type,
    p_resource_id,
    p_access_type
  );
END;
$$;

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

-- Suspicious activity detection on login attempts
DROP TRIGGER IF EXISTS login_security_check ON login_attempts;
CREATE TRIGGER login_security_check
  AFTER INSERT ON login_attempts
  FOR EACH ROW EXECUTE FUNCTION detect_suspicious_activity();
