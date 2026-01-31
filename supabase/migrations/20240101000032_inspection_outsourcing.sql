-- Mission 11 Phase K: Professional Inspection Outsourcing
-- Creates inspection_assignments and inspector_access_tokens tables

-- ============================================================
-- INSPECTION ASSIGNMENTS
-- Tracks outsourced inspection bookings with professional inspectors
-- Uses the existing `trades` table from Mission 10 (inspectors are trades with category 'inspection')
-- ============================================================

CREATE TABLE IF NOT EXISTS inspection_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES trades(id),

  -- Assignment
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by TEXT NOT NULL DEFAULT 'agent', -- 'agent' | 'owner'

  -- Inspector response
  accepted BOOLEAN,
  accepted_at TIMESTAMPTZ,
  declined_reason TEXT,

  -- Scheduling
  proposed_date DATE,
  proposed_time_start TIME,
  proposed_time_end TIME,
  confirmed_date DATE,
  confirmed_time TIME,

  -- Completion
  completed_at TIMESTAMPTZ,

  -- Payment
  fee_amount DECIMAL(10,2) NOT NULL,
  fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_id UUID, -- Reference to payments table if using Stripe

  -- Rating (by owner)
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_assignments_inspection ON inspection_assignments(inspection_id);
CREATE INDEX idx_inspection_assignments_inspector ON inspection_assignments(inspector_id);
CREATE INDEX idx_inspection_assignments_status ON inspection_assignments(accepted) WHERE accepted IS NULL;

-- ============================================================
-- INSPECTOR ACCESS TOKENS
-- One-time access links for professional inspectors to conduct inspections
-- ============================================================

CREATE TABLE IF NOT EXISTS inspector_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES inspection_assignments(id) ON DELETE CASCADE,

  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL, -- Inspector's email

  -- Access control
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Revocation
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_inspector_tokens_lookup ON inspector_access_tokens(token) WHERE NOT revoked;
CREATE INDEX idx_inspector_tokens_inspection ON inspector_access_tokens(inspection_id);

-- ============================================================
-- ADD OUTSOURCING FIELDS TO INSPECTIONS
-- ============================================================

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS is_outsourced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS outsource_mode TEXT CHECK (outsource_mode IN ('self', 'professional', 'auto_managed'));
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS report_url TEXT; -- URL to generated PDF report

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE inspection_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspector_access_tokens ENABLE ROW LEVEL SECURITY;

-- Owners can manage inspection assignments for their properties
CREATE POLICY "Owners manage inspection assignments"
  ON inspection_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM inspections i
      JOIN properties p ON p.id = i.property_id
      WHERE i.id = inspection_assignments.inspection_id
      AND p.owner_id = auth.uid()
    )
  );

-- Service account / agent can manage assignments (for automated booking)
CREATE POLICY "Service role manages inspection assignments"
  ON inspection_assignments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Owners can manage access tokens for their inspections
CREATE POLICY "Owners manage inspector access tokens"
  ON inspector_access_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM inspections i
      JOIN properties p ON p.id = i.property_id
      WHERE i.id = inspector_access_tokens.inspection_id
      AND p.owner_id = auth.uid()
    )
  );

-- Service account / agent can manage tokens
CREATE POLICY "Service role manages inspector tokens"
  ON inspector_access_tokens FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER set_inspection_assignments_updated_at
  BEFORE UPDATE ON inspection_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ADD INSPECTION CATEGORY TO MAINTENANCE_CATEGORY ENUM
-- This lets trades register as property inspectors using the existing trade network
-- ============================================================

-- Check if 'inspection' value exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'inspection'
    AND enumtypid = 'maintenance_category'::regtype
  ) THEN
    ALTER TYPE maintenance_category ADD VALUE 'inspection';
  END IF;
END$$;
