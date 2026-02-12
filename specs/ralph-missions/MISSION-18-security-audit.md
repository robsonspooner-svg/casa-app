# Mission 18: Security & Data Protection

## Overview
**Goal**: Implement comprehensive security measures and ensure data protection compliance.
**Dependencies**: All previous missions
**Estimated Complexity**: High

## Success Criteria

### Phase A: Authentication Hardening
- [ ] Implement Google OAuth sign-in (via Supabase Auth provider)
- [ ] Configure Google Cloud Console OAuth consent screen for Casa
- [ ] Add Google Sign-In button to login/signup screens (both owner and tenant apps)
- [ ] Implement MFA (TOTP)
- [ ] Session management improvements
- [ ] Login attempt rate limiting
- [ ] Device tracking and management
- [ ] Suspicious activity detection

### Phase B: Data Protection
- [ ] Encrypt sensitive fields at rest
- [ ] Implement field-level encryption
- [ ] Secure file storage
- [ ] Data masking for support access
- [ ] PII handling compliance

### Phase C: API Security
- [ ] Rate limiting per endpoint
- [ ] Request validation
- [ ] SQL injection prevention (via Supabase)
- [ ] XSS prevention
- [ ] CORS configuration

### Phase D: Audit Logging
- [ ] User action logging
- [ ] Data access logging
- [ ] Admin action logging
- [ ] Log retention policy
- [ ] Log search and export

### Phase E: Access Control
- [ ] Review all RLS policies
- [ ] Implement role-based access
- [ ] API key management
- [ ] Service account security

### Phase F: Privacy Compliance
- [ ] Privacy policy implementation
- [ ] Data export (GDPR right to access)
- [ ] Data deletion (right to be forgotten)
- [ ] Consent management
- [ ] Cookie preferences

### Phase G: Security Testing
- [ ] Penetration testing checklist
- [ ] OWASP Top 10 review
- [ ] Dependency vulnerability scan
- [ ] Security headers audit

### Phase H: Incident Response
- [ ] Security incident procedures
- [ ] Data breach notification plan
- [ ] Account recovery process
- [ ] Security contact setup

## Database Schema

```sql
-- MFA methods
CREATE TABLE user_mfa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- MFA method
  method TEXT NOT NULL CHECK (method IN ('totp', 'sms', 'email')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- TOTP specific
  totp_secret TEXT, -- Encrypted
  totp_verified_at TIMESTAMPTZ,

  -- SMS/Email specific
  phone_number TEXT,
  email TEXT,

  -- Recovery
  recovery_codes TEXT[], -- Encrypted, hashed

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, method)
);

-- User sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Session details
  session_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT UNIQUE,

  -- Device info
  device_id TEXT,
  device_name TEXT,
  device_type TEXT, -- 'ios', 'android', 'web'
  ip_address TEXT,
  user_agent TEXT,
  location TEXT, -- Approximate

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login attempts
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),

  -- Action details
  action TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'login', 'logout', etc.
  resource_type TEXT, -- 'property', 'tenancy', 'payment', etc.
  resource_id UUID,

  -- Context
  ip_address TEXT,
  user_agent TEXT,
  session_id UUID REFERENCES user_sessions(id),

  -- Data changes
  old_values JSONB,
  new_values JSONB,

  -- Result
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'error')),
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sensitive data access log
CREATE TABLE sensitive_data_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Access details
  data_type TEXT NOT NULL, -- 'payment_info', 'identity_doc', 'bank_details', etc.
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  access_type TEXT NOT NULL, -- 'view', 'download', 'export'

  -- Context
  ip_address TEXT,
  purpose TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data deletion requests (GDPR)
CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Request details
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete', 'rectify')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),

  -- Data scope
  data_types TEXT[], -- Specific data types or NULL for all

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

-- Security alerts
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Consent records
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Consent details
  consent_type TEXT NOT NULL, -- 'terms', 'privacy', 'marketing', 'analytics'
  version TEXT NOT NULL,
  consented BOOLEAN NOT NULL,

  -- Context
  ip_address TEXT,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, consent_type, version)
);

-- Indexes
CREATE INDEX idx_user_mfa ON user_mfa(user_id);
CREATE INDEX idx_user_sessions ON user_sessions(user_id, is_active);
CREATE INDEX idx_login_attempts_email ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_security_alerts_status ON security_alerts(status) WHERE status IN ('open', 'investigating');

-- RLS Policies
ALTER TABLE user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensitive_data_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users manage own MFA
CREATE POLICY "Users manage own MFA"
  ON user_mfa FOR ALL
  USING (auth.uid() = user_id);

-- Users view own sessions
CREATE POLICY "Users view own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can terminate own sessions
CREATE POLICY "Users terminate own sessions"
  ON user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users view own login attempts
CREATE POLICY "Users view own login attempts"
  ON login_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Users view own audit log
CREATE POLICY "Users view own audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Users manage own consents
CREATE POLICY "Users manage own consents"
  ON user_consents FOR ALL
  USING (auth.uid() = user_id);

-- Users manage own data requests
CREATE POLICY "Users manage own data requests"
  ON data_deletion_requests FOR ALL
  USING (auth.uid() = user_id);

-- Rate limiting function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM audit_log
  WHERE (user_id::TEXT = p_identifier OR ip_address = p_identifier)
    AND action = p_action
    AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  RETURN recent_count < p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suspicious activity detection
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Multiple failed logins
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
        jsonb_build_object('email', NEW.email, 'ip_address', NEW.ip_address)
      );
    END IF;
  END IF;

  -- Login from new location (simplified)
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
        jsonb_build_object('ip_address', NEW.ip_address)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER login_security_check
  AFTER INSERT ON login_attempts
  FOR EACH ROW EXECUTE FUNCTION detect_suspicious_activity();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── security/
│   ├── mfa.ts                  # MFA implementation
│   ├── sessions.ts             # Session management
│   ├── rateLimit.ts            # Rate limiting
│   └── encryption.ts           # Field encryption
├── hooks/
│   ├── useMFA.ts               # MFA hooks
│   ├── useSessions.ts          # Active sessions
│   └── useSecurityAlerts.ts    # Security alerts
└── middleware/
    └── security.ts             # Security middleware

packages/security/              # New package
├── package.json
├── src/
│   ├── index.ts
│   ├── totp.ts                 # TOTP implementation
│   ├── encryption.ts           # Encryption utilities
│   ├── hashing.ts              # Password/token hashing
│   └── validation.ts           # Input validation
```

### Backend (Edge Functions)
```
supabase/functions/
├── verify-mfa/
│   └── index.ts                # Verify MFA code
├── generate-recovery-codes/
│   └── index.ts                # Generate recovery codes
├── export-user-data/
│   └── index.ts                # GDPR data export
├── delete-user-data/
│   └── index.ts                # GDPR data deletion
└── security-scan/
    └── index.ts                # Scheduled security checks
```

### Owner App & Tenant App
```
apps/[owner|tenant]/app/(app)/
├── settings/
│   ├── security.tsx            # Security settings
│   ├── mfa.tsx                 # MFA setup
│   ├── sessions.tsx            # Active sessions
│   └── privacy.tsx             # Privacy settings

apps/[owner|tenant]/components/
├── MFASetup.tsx                # MFA wizard
├── TOTPInput.tsx               # 6-digit code input
├── SessionList.tsx             # Active sessions
├── SecurityAlert.tsx           # Alert display
└── DataExportRequest.tsx       # Request data export
```

## Security Checklist

### Authentication
- [x] Password hashing (Supabase handles)
- [ ] MFA support
- [ ] Session timeout
- [ ] Secure password reset
- [ ] Account lockout after failed attempts

### Data Protection
- [ ] Encryption at rest (Supabase handles)
- [ ] Encryption in transit (HTTPS)
- [ ] Field-level encryption for sensitive data
- [ ] Secure file storage
- [ ] Data masking

### API Security
- [ ] Rate limiting
- [ ] Input validation
- [ ] SQL injection prevention (Supabase RLS)
- [ ] XSS prevention
- [ ] CSRF protection

### Access Control
- [ ] RLS policies reviewed
- [ ] Role-based access
- [ ] Principle of least privilege
- [ ] Service account security

### Compliance
- [ ] Privacy policy
- [ ] Terms of service
- [ ] Data processing agreement
- [ ] GDPR compliance
- [ ] Australian Privacy Act compliance

---

## Agent Security Requirements (Mission 14 Integration)

### Agent Edge Function Authentication
- [ ] Agent Edge Function validates JWT on every request
- [ ] JWT user_id matches the conversation owner
- [ ] Service-role key used ONLY for database mutations (never exposed to client)
- [ ] Rate limiting: max 20 agent requests per user per minute
- [ ] Rate limiting: max 100 tool executions per user per hour

### Agent Audit Trail
- [ ] All agent tool executions logged in `agent_decisions` table
- [ ] Extend `audit_log` table with agent-specific fields:
  ```sql
  ALTER TABLE audit_log ADD COLUMN agent_execution BOOLEAN DEFAULT FALSE;
  ALTER TABLE audit_log ADD COLUMN agent_tool_name TEXT;
  ALTER TABLE audit_log ADD COLUMN agent_autonomy_level TEXT;
  ```
- [ ] All L3-L4 (auto-executed) agent actions logged to audit_log
- [ ] Owner can export full agent audit trail from Settings

### Agent ↔ MFA
- [ ] L0-L2 agent actions do NOT require MFA re-authentication (user is already logged in)
- [ ] L3+ agent actions that involve financial operations (payments, bond) require MFA if user has MFA enabled
- [ ] Agent action approval in Tasks tab does NOT require MFA (it's already an explicit user action)

### Agent Data Isolation
- [ ] Agent queries scoped to authenticated user's data only
- [ ] Agent cannot access other users' conversations, tasks, or decisions
- [ ] Service-role key usage audited: agent can only write to agent_* tables and tables explicitly listed in tool definitions
- [ ] No cross-user data leakage via conversation context or precedent search

### Email Verification
- [ ] Supabase Auth email confirmation enabled
- [ ] New accounts must verify email before accessing agent features
- [ ] Unverified accounts limited to profile completion only

### Terms of Service & Privacy Policy
- [ ] ToS and Privacy Policy hosted at casapm.com.au/terms and casapm.com.au/privacy
- [ ] Users must accept ToS on first login (stored in profiles table)
- [ ] Privacy Policy includes automated decision-making disclosure (Privacy Act 2024 amendment)
- [ ] Agent's autonomy levels and decision process disclosed in privacy policy

### Phase I: Feature Gating Enforcement

Mission 02 created the feature gating infrastructure, but the gates need to be properly enforced across all features. This mission must verify and enforce gates:

```typescript
// Feature gates that must be enforced
const FEATURE_GATES = {
  // Starter tier (included)
  tenant_communications: 'all',
  rent_tracking: 'all',
  maintenance_requests: 'all',
  ai_condition_comparison: 'all',
  basic_reports: 'all',
  ai_chat: 'all',

  // Pro tier (and above)
  tenant_finding: 'pro',
  lease_management: 'pro',
  bond_handling: 'pro',
  professional_inspections: 'pro', // Included; $99 add-on for Starter
  full_automation: 'pro',
  financial_reports: 'pro',
  cash_flow_forecasting: 'pro',

  // Hands-Off tier only
  open_homes: 'hands_off',
  entry_exit_reports: 'hands_off', // Professional entry/exit included
  priority_support: 'hands_off',
  dedicated_account_manager: 'hands_off',
  custom_rules: 'hands_off', // Manual rule creation in learning engine
};
```

**Enforcement Checklist:**
- [ ] Every gated screen checks `useFeatureGate` before rendering content
- [ ] Gated features show upgrade prompt (not just blank/error)
- [ ] Agent tool execution checks feature gates before executing gated tools
- [ ] Subscription downgrades gracefully degrade access (no data loss)
- [ ] Add-on purchases (professional inspection $99) processed via Stripe one-off charge
- [ ] Feature gate checks are server-side (Edge Function) not just client-side

### Phase J: Agent Action Audit Trail

All agent actions must be auditable. Extend the audit system:

```sql
-- Agent-specific audit fields (add to existing audit_log)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS agent_execution BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS agent_tool_name TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS agent_autonomy_level TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS agent_conversation_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS agent_was_auto_executed BOOLEAN DEFAULT FALSE;
```

**Audit Requirements:**
- Every L3+ (auto-executed) agent action → logged to `audit_log` with `agent_execution = TRUE`
- Agent tool calls that modify data → logged with old/new values
- Financial agent actions (payments, bond) → additional logging to `sensitive_data_access`
- Owner can export full agent audit trail from Settings → Security → Agent Activity
- Audit log retention: 7 years (Australian tax record requirement)

### Phase K: Data Encryption Requirements

Sensitive data must be encrypted at rest beyond Supabase's default encryption:

| Data Type | Table | Column(s) | Encryption |
|-----------|-------|-----------|------------|
| Credit check results | background_checks | results | AES-256 field-level |
| Bank account details | stripe_connect_accounts | account_details | AES-256 field-level |
| Identity documents | documents | (storage bucket) | Supabase Storage encryption |
| Tenant personal info | tenancy_tenants | phone, email | AES-256 field-level |
| Agent corrections | agent_corrections | context | Standard (no additional) |
| MFA secrets | user_mfa | totp_secret | AES-256 field-level |

---

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm audit                      # Check for vulnerabilities
pnpm test:security              # Security-specific tests
```

## Commit Message Pattern
```
feat(security): <description>

Mission-18: Security & Data Protection
```

## Notes
- Use Supabase Auth's built-in security features
- Implement MFA as optional but encouraged
- Log all sensitive data access for compliance
- Regular security audits should be scheduled
- Keep dependencies updated for security patches
- Implement CSP headers for web views
- Consider bug bounty program in future
- Data retention policies must be documented
- Recovery codes should be shown once and hashed

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All RLS policies reviewed and hardened across all tables
- [ ] Audit log tables created with correct write-only policies
- [ ] No RLS policy allows cross-user data access
- [ ] Field-level encryption applied to sensitive columns (background check results, payment details)
- [ ] Data masking configured for support access queries
- [ ] Log retention policies configured (auto-cleanup of old audit logs)

### Feature Verification (Mission-Specific)
- [ ] Google OAuth sign-in works end-to-end (both owner and tenant apps)
- [ ] Google OAuth creates profile correctly on first sign-in
- [ ] Google OAuth links to existing account if email matches
- [ ] MFA (TOTP) enrollment flow works end-to-end
- [ ] MFA verification required on login when enabled
- [ ] Session management: user can view and revoke active sessions
- [ ] Login attempt rate limiting triggers after threshold (e.g., 5 attempts)
- [ ] Suspicious activity detection flags unusual login locations/devices
- [ ] Sensitive fields encrypted at rest and decrypt correctly on read
- [ ] API rate limiting enforced per endpoint
- [ ] Request validation rejects malformed/oversized inputs
- [ ] XSS prevention verified (no user input rendered as raw HTML)
- [ ] CORS configuration only allows expected origins
- [ ] User action audit log captures key events (login, data access, changes)
- [ ] Data export (right to access) generates complete user data package
- [ ] Data deletion (right to be forgotten) removes all user data
- [ ] Consent management tracks and respects user preferences
- [ ] Input sanitisation prevents injection across all user inputs
- [ ] Auth token rotation works on session refresh
- [ ] Feature gates enforced on all gated screens (Pro features inaccessible on Starter)
- [ ] Agent audit trail captures all L3+ actions with tool name and autonomy level
- [ ] Owner can export agent activity log from Settings
- [ ] Subscription tier changes correctly update feature access
- [ ] Sensitive data encrypted at rest (credit checks, bank details, MFA secrets)
- [ ] Audit log retention policy configured (7 years)
- [ ] Agent data isolation verified: no cross-user data access via agent queries

### Visual & UX
- [ ] MFA setup screens tested on physical iOS device via Expo Go
- [ ] Security settings UI matches BRAND-AND-UI.md design system
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes

### Regression (All Prior Missions)
- [ ] All prior mission critical paths still work (see TESTING-METHODOLOGY.md Section 4)
- [ ] Navigation between all existing screens works
- [ ] Previously created data still loads correctly
- [ ] No new TypeScript errors in existing code

### Auth & Security
- [ ] Authenticated routes redirect unauthenticated users
- [ ] User can only access their own data (RLS verified across ALL tables)
- [ ] Session persists across app restarts
- [ ] No sensitive data in logs or error messages
- [ ] No PII in URL parameters or query strings
- [ ] All API keys stored in environment variables (not in code)
- [ ] Supabase service role key never exposed to client
- [ ] Recovery codes hashed before storage (shown once to user)
