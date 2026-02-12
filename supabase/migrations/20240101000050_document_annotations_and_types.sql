-- Migration: Document annotations table + additional document type values
-- Fills gaps in Mission 16 Document Management

-- ============================================================
-- 1. ADD MISSING DOCUMENT TYPES TO ENUM
-- ============================================================

-- Add new types one at a time (IF NOT EXISTS isn't available for ALTER TYPE, so use DO block)
DO $$ BEGIN
  ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'inspection_report';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'insurance_certificate';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'identity_document';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'financial_statement';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'correspondence';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'photo';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'receipt';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. DOCUMENT ANNOTATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS document_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  page_number INTEGER NOT NULL DEFAULT 1,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('highlight', 'note', 'drawing', 'stamp')),
  content TEXT,
  position JSONB NOT NULL,
  style JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_annotations_document ON document_annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_document_annotations_user ON document_annotations(created_by);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_document_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_annotations_updated_at ON document_annotations;
CREATE TRIGGER trigger_document_annotations_updated_at
  BEFORE UPDATE ON document_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_document_annotations_updated_at();

-- RLS
ALTER TABLE document_annotations ENABLE ROW LEVEL SECURITY;

-- Document owners can manage annotations on their documents
CREATE POLICY document_annotations_owner_all ON document_annotations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_annotations.document_id
      AND d.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_annotations.document_id
      AND d.owner_id = auth.uid()
    )
  );

-- Users can manage their own annotations
CREATE POLICY document_annotations_creator_all ON document_annotations
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY document_annotations_service_all ON document_annotations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
