-- Mission 11: Add missing columns to inspection_ai_comparisons
-- These columns are used by the compare-inspections edge function

ALTER TABLE inspection_ai_comparisons
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS comparison_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tenant_responsible_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wear_and_tear_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bond_deduction_recommended DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS raw_response JSONB;

-- Add display_order to ai issues if missing
ALTER TABLE inspection_ai_issues
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Index on property_id for comparison lookups
CREATE INDEX IF NOT EXISTS idx_ai_comparisons_property ON inspection_ai_comparisons(property_id);
