-- Migration: Add tenant renewal response columns to tenancies table
-- These columns are required by the tenant renewal response screen
-- (apps/tenant/app/(app)/tenancy/renew.tsx) which writes to them on submit.

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS proposed_rent_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS renewal_response TEXT CHECK (renewal_response IN ('accept', 'decline', 'negotiate')),
  ADD COLUMN IF NOT EXISTS renewal_response_notes TEXT,
  ADD COLUMN IF NOT EXISTS renewal_response_date TIMESTAMPTZ;

-- Add index for quick lookup of tenancies pending renewal response
CREATE INDEX IF NOT EXISTS idx_tenancies_renewal_response
  ON tenancies (renewal_response)
  WHERE renewal_response IS NOT NULL;

COMMENT ON COLUMN tenancies.proposed_rent_amount IS 'Proposed rent amount for lease renewal, set by owner/agent';
COMMENT ON COLUMN tenancies.renewal_response IS 'Tenant response to renewal offer: accept, decline, or negotiate';
COMMENT ON COLUMN tenancies.renewal_response_notes IS 'Tenant notes accompanying their renewal response';
COMMENT ON COLUMN tenancies.renewal_response_date IS 'Timestamp when tenant submitted their renewal response';
