-- Migration: Add document versioning support
-- Sprint 1: "The Chain" — Document revision workflow

-- Add version column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create document_versions table for preserving previous versions
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(document_id, version_number DESC);

-- RLS
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Owners can view versions of their documents
CREATE POLICY document_versions_owner_select ON document_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d WHERE d.id = document_versions.document_id AND d.owner_id = auth.uid()
    )
  );

-- Tenants can view versions of documents shared with them
CREATE POLICY document_versions_tenant_select ON document_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_shares ds
      WHERE ds.document_id = document_versions.document_id
        AND ds.shared_with_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY document_versions_service_all ON document_versions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
