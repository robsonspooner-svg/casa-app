-- Migration: Document Hub, E-Signing & Document Management
-- Creates tables for generated documents, electronic signatures, and saved signatures

-- ============================================================
-- Document type enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE document_type AS ENUM (
    'financial_report',
    'tax_report',
    'lease',
    'notice',
    'condition_report',
    'compliance_certificate',
    'property_summary',
    'portfolio_report',
    'cash_flow_forecast',
    'evidence_report',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'draft',
    'pending_owner_signature',
    'pending_tenant_signature',
    'signed',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Documents table
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,
  document_type document_type NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  html_content TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'draft',
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  storage_path TEXT,
  file_url TEXT,
  created_by TEXT NOT NULL DEFAULT 'agent',
  conversation_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON documents(property_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenancy_id ON documents(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- ============================================================
-- Document signatures table
-- ============================================================
CREATE TABLE IF NOT EXISTS document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signer_role TEXT NOT NULL CHECK (signer_role IN ('owner', 'tenant')),
  signer_name TEXT NOT NULL,
  signature_image TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_signer_id ON document_signatures(signer_id);

-- ============================================================
-- Saved signatures table (one per user for reuse)
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signature_image TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Updated_at trigger for saved_signatures
CREATE OR REPLACE FUNCTION update_saved_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_saved_signatures_updated_at ON saved_signatures;
CREATE TRIGGER trigger_saved_signatures_updated_at
  BEFORE UPDATE ON saved_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_signatures_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_signatures ENABLE ROW LEVEL SECURITY;

-- Documents: owners see their own documents
CREATE POLICY documents_owner_select ON documents
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Documents: tenants see documents where they are the tenant
CREATE POLICY documents_tenant_select ON documents
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

-- Documents: owners can insert their own documents
CREATE POLICY documents_owner_insert ON documents
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Documents: owners can update their own documents
CREATE POLICY documents_owner_update ON documents
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Document signatures: viewable by document participants (owner or tenant)
CREATE POLICY document_signatures_select ON document_signatures
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_signatures.document_id
      AND (d.owner_id = auth.uid() OR d.tenant_id = auth.uid())
    )
  );

-- Document signatures: participants can insert their own signatures
CREATE POLICY document_signatures_insert ON document_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    signer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_signatures.document_id
      AND (d.owner_id = auth.uid() OR d.tenant_id = auth.uid())
    )
  );

-- Saved signatures: users can only manage their own
CREATE POLICY saved_signatures_select ON saved_signatures
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_signatures_insert ON saved_signatures
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_signatures_update ON saved_signatures
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_signatures_delete ON saved_signatures
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- Service role bypass for edge functions
-- ============================================================
CREATE POLICY documents_service_all ON documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY document_signatures_service_all ON document_signatures
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY saved_signatures_service_all ON saved_signatures
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
