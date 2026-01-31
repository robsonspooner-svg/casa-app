-- Mission 07+: Tenant-Owner Connection System
-- Provides multiple methods for connecting tenants with property owners:
-- 1. Invite codes (owner generates, tenant enters)
-- 2. Direct links (QR/deep link)
-- 3. AI matching (future - tenants register interest, AI matches to properties)

-- ============================================================
-- CONNECTION CODES TABLE
-- ============================================================

CREATE TABLE connection_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner who created the code
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Optional: specific property/tenancy this code is for
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE CASCADE,

  -- The actual code (6 character alphanumeric, uppercase)
  code TEXT NOT NULL UNIQUE,

  -- What type of connection this creates
  connection_type TEXT NOT NULL DEFAULT 'tenancy' CHECK (connection_type IN (
    'tenancy',      -- Connect to existing tenancy
    'application',  -- Fast-track application to property
    'property'      -- General property connection (for maintenance etc)
  )),

  -- Usage limits
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER NOT NULL DEFAULT 0,

  -- Validity
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metadata
  label TEXT,  -- Optional description for owner's reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONNECTION ATTEMPTS (AUDIT LOG)
-- ============================================================

CREATE TABLE connection_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The code that was attempted
  code_id UUID REFERENCES connection_codes(id) ON DELETE SET NULL,
  code_text TEXT NOT NULL,  -- Store the actual code for audit even if code deleted

  -- Who attempted the connection
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Result
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',   -- Attempt made, awaiting processing
    'success',   -- Connection established
    'failed',    -- Code invalid, expired, or max uses reached
    'rejected'   -- Owner rejected the connection
  )),
  failure_reason TEXT,

  -- If successful, what was created
  created_tenancy_tenant_id UUID REFERENCES tenancy_tenants(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ============================================================
-- TENANT AVAILABILITY (FOR AI MATCHING)
-- ============================================================

CREATE TABLE tenant_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The tenant looking for a property
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Search preferences
  preferred_suburbs TEXT[],  -- Array of suburb names
  min_bedrooms INTEGER DEFAULT 1,
  max_rent_weekly DECIMAL(10,2),
  move_in_date DATE,

  -- Tenant profile for matching
  has_pets BOOLEAN DEFAULT FALSE,
  pet_details TEXT,
  employment_status TEXT CHECK (employment_status IN (
    'employed_full_time', 'employed_part_time', 'self_employed',
    'student', 'retired', 'other'
  )),
  rental_history_years INTEGER DEFAULT 0,
  has_references BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,  -- Still looking
  matched_at TIMESTAMPTZ,  -- When they were successfully matched

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI MATCH SUGGESTIONS
-- ============================================================

CREATE TABLE match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The property/listing being matched
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,

  -- The tenant being suggested
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_availability_id UUID REFERENCES tenant_availability(id) ON DELETE SET NULL,

  -- Match details
  match_score DECIMAL(3,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 1),  -- 0.00-1.00
  match_reasons JSONB,  -- {"location": 0.9, "budget": 0.85, "bedrooms": 1.0}

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Suggested but not acted upon
    'viewed',     -- Owner viewed the suggestion
    'invited',    -- Owner sent invite to tenant
    'applied',    -- Tenant submitted application
    'rejected',   -- Owner dismissed suggestion
    'expired'     -- Suggestion expired without action
  )),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days')
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_connection_codes_owner ON connection_codes(owner_id);
CREATE INDEX idx_connection_codes_code ON connection_codes(code) WHERE is_active;
CREATE INDEX idx_connection_codes_property ON connection_codes(property_id);
CREATE INDEX idx_connection_codes_tenancy ON connection_codes(tenancy_id);

CREATE INDEX idx_connection_attempts_user ON connection_attempts(user_id);
CREATE INDEX idx_connection_attempts_code ON connection_attempts(code_id);

CREATE INDEX idx_tenant_availability_active ON tenant_availability(tenant_id) WHERE is_active;
CREATE INDEX idx_tenant_availability_suburbs ON tenant_availability USING GIN(preferred_suburbs);

CREATE INDEX idx_match_suggestions_property ON match_suggestions(property_id);
CREATE INDEX idx_match_suggestions_tenant ON match_suggestions(tenant_id);
CREATE INDEX idx_match_suggestions_pending ON match_suggestions(property_id, status) WHERE status = 'pending';

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE connection_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_suggestions ENABLE ROW LEVEL SECURITY;

-- Connection codes: owners manage their own
CREATE POLICY "Owners manage own connection codes"
  ON connection_codes FOR ALL
  USING (auth.uid() = owner_id);

-- Connection codes: anyone can read active codes (for validation)
-- But this is done via RPC function for security
CREATE POLICY "System can read codes for validation"
  ON connection_codes FOR SELECT
  USING (TRUE);

-- Connection attempts: users see their own attempts
CREATE POLICY "Users view own connection attempts"
  ON connection_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Connection attempts: owners see attempts on their codes
CREATE POLICY "Owners view attempts on their codes"
  ON connection_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM connection_codes
      WHERE connection_codes.id = connection_attempts.code_id
      AND connection_codes.owner_id = auth.uid()
    )
  );

-- Connection attempts: users can create attempts
CREATE POLICY "Users can create connection attempts"
  ON connection_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Tenant availability: tenants manage their own
CREATE POLICY "Tenants manage own availability"
  ON tenant_availability FOR ALL
  USING (auth.uid() = tenant_id);

-- Tenant availability: owners can view active availability (for matching)
CREATE POLICY "Owners view tenant availability for matching"
  ON tenant_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
    AND is_active = TRUE
  );

-- Match suggestions: tenants see suggestions for them
CREATE POLICY "Tenants view own match suggestions"
  ON match_suggestions FOR SELECT
  USING (auth.uid() = tenant_id);

-- Match suggestions: owners see suggestions for their properties
CREATE POLICY "Owners view suggestions for their properties"
  ON match_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = match_suggestions.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Match suggestions: owners can update (view, invite, reject)
CREATE POLICY "Owners can update suggestions for their properties"
  ON match_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = match_suggestions.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Generate a unique 6-character connection code
CREATE OR REPLACE FUNCTION generate_connection_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- Exclude similar chars (0/O, 1/I)
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Validate and use a connection code
-- Returns: success boolean, message text, created_connection_id uuid
CREATE OR REPLACE FUNCTION use_connection_code(
  p_code TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  connection_type TEXT,
  property_id UUID,
  tenancy_id UUID,
  owner_id UUID
) AS $$
DECLARE
  v_code_record connection_codes%ROWTYPE;
  v_attempt_id UUID;
BEGIN
  -- Normalize code to uppercase
  p_code := UPPER(TRIM(p_code));

  -- Find the code
  SELECT * INTO v_code_record
  FROM connection_codes
  WHERE code = p_code
  AND is_active = TRUE
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (max_uses IS NULL OR use_count < max_uses);

  IF NOT FOUND THEN
    -- Log failed attempt
    INSERT INTO connection_attempts (code_text, user_id, status, failure_reason)
    VALUES (p_code, p_user_id, 'failed', 'Code not found, expired, or max uses reached');

    RETURN QUERY SELECT FALSE, 'Invalid or expired code'::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Check if user is not the owner (can't connect to own property)
  IF v_code_record.owner_id = p_user_id THEN
    INSERT INTO connection_attempts (code_id, code_text, user_id, status, failure_reason)
    VALUES (v_code_record.id, p_code, p_user_id, 'failed', 'Cannot use own connection code');

    RETURN QUERY SELECT FALSE, 'You cannot use your own connection code'::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Log successful validation (actual connection creation happens in application code)
  INSERT INTO connection_attempts (code_id, code_text, user_id, status)
  VALUES (v_code_record.id, p_code, p_user_id, 'pending')
  RETURNING id INTO v_attempt_id;

  -- Increment use count
  UPDATE connection_codes SET use_count = use_count + 1 WHERE id = v_code_record.id;

  -- Return success with connection details
  RETURN QUERY SELECT
    TRUE,
    'Code validated successfully'::TEXT,
    v_code_record.connection_type,
    v_code_record.property_id,
    v_code_record.tenancy_id,
    v_code_record.owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Connect a tenant to a property by creating a tenancy
-- This function runs with elevated privileges to bypass RLS
CREATE OR REPLACE FUNCTION connect_tenant_to_property(
  p_property_id UUID,
  p_tenant_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  tenancy_id UUID,
  tenancy_tenant_id UUID
) AS $$
DECLARE
  v_tenancy_id UUID;
  v_tenancy_tenant_id UUID;
  v_existing_count INTEGER;
BEGIN
  -- Check if tenant is already connected to this property
  SELECT COUNT(*) INTO v_existing_count
  FROM tenancies t
  JOIN tenancy_tenants tt ON tt.tenancy_id = t.id
  WHERE t.property_id = p_property_id
  AND tt.tenant_id = p_tenant_id;

  IF v_existing_count > 0 THEN
    RETURN QUERY SELECT FALSE, 'You are already connected to this property'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Create the tenancy
  INSERT INTO tenancies (property_id, status, start_date, rent_amount, rent_frequency)
  VALUES (p_property_id, 'active', CURRENT_DATE, 0, 'weekly')
  RETURNING id INTO v_tenancy_id;

  -- Add tenant to the tenancy
  INSERT INTO tenancy_tenants (tenancy_id, tenant_id, is_primary, is_leaseholder)
  VALUES (v_tenancy_id, p_tenant_id, TRUE, TRUE)
  RETURNING id INTO v_tenancy_tenant_id;

  -- Update connection attempt to success
  UPDATE connection_attempts
  SET status = 'success',
      processed_at = NOW(),
      created_tenancy_tenant_id = v_tenancy_tenant_id
  WHERE code_text = UPPER(TRIM(p_code))
  AND user_id = p_tenant_id
  AND status = 'pending';

  RETURN QUERY SELECT TRUE, 'Connected successfully'::TEXT, v_tenancy_id, v_tenancy_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER tenant_availability_updated_at
  BEFORE UPDATE ON tenant_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
