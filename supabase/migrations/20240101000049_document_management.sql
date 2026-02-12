-- Migration: Document Management — Mission 16
-- Adds folder system, sharing, access logging, file upload support,
-- lease templates, and full-text search for the document hub.

-- ============================================================
-- 1. EXTEND DOCUMENTS TABLE — add file upload & folder columns
-- ============================================================

-- Add columns for file uploads and folder organisation
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_extension TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES profiles(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_text TEXT;

-- Partial index for non-archived documents
CREATE INDEX IF NOT EXISTS idx_documents_not_archived ON documents(owner_id) WHERE NOT is_archived;

-- Full-text search index across title, description, and OCR text
CREATE INDEX IF NOT EXISTS idx_documents_fts ON documents
  USING GIN (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(ocr_text, '')));

-- Tags index
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN (tags);

-- Expiry date index (for agent scanning)
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- ============================================================
-- 2. DOCUMENT FOLDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  icon TEXT,
  color TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_folders_owner ON document_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_property ON document_folders(property_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent ON document_folders(parent_id);

-- Add FK from documents → document_folders (now that table exists)
DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT fk_documents_folder
    FOREIGN KEY (folder_id) REFERENCES document_folders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_document_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_folders_updated_at ON document_folders;
CREATE TRIGGER trigger_document_folders_updated_at
  BEFORE UPDATE ON document_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_document_folders_updated_at();

-- RLS
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_folders_owner_all ON document_folders
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY document_folders_service_all ON document_folders
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 3. DOCUMENT SHARES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('user', 'link')),
  shared_with_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE,
  can_download BOOLEAN NOT NULL DEFAULT TRUE,
  can_print BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  shared_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (share_type = 'user' AND shared_with_id IS NOT NULL) OR
    (share_type = 'link' AND share_token IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_document_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_with ON document_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(share_token) WHERE share_token IS NOT NULL;

-- RLS
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- Owners manage shares they created
CREATE POLICY document_shares_owner_all ON document_shares
  FOR ALL TO authenticated
  USING (shared_by = auth.uid())
  WITH CHECK (shared_by = auth.uid());

-- Recipients can view their own shares
CREATE POLICY document_shares_recipient_select ON document_shares
  FOR SELECT TO authenticated
  USING (shared_with_id = auth.uid());

CREATE POLICY document_shares_service_all ON document_shares
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add RLS policy for shared documents (SELECT) — users who have an active share can view the document
CREATE POLICY documents_shared_select ON documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_shares ds
      WHERE ds.document_id = documents.id
      AND ds.shared_with_id = auth.uid()
      AND (ds.expires_at IS NULL OR ds.expires_at > now())
    )
  );

-- ============================================================
-- 4. DOCUMENT ACCESS LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES profiles(id),
  share_id UUID REFERENCES document_shares(id),
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'print', 'share')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_access_log_document ON document_access_log(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_access_log_user ON document_access_log(accessed_by);

-- RLS
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

-- Owners can view access logs for their documents
CREATE POLICY document_access_log_owner_select ON document_access_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_access_log.document_id
      AND d.owner_id = auth.uid()
    )
  );

-- Insert allowed for authenticated users (viewing shared docs logs access)
CREATE POLICY document_access_log_insert ON document_access_log
  FOR INSERT TO authenticated
  WITH CHECK (accessed_by = auth.uid());

CREATE POLICY document_access_log_service_all ON document_access_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. FOLDER TEMPLATES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS folder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  folders JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Insert default folder template for residential properties
INSERT INTO folder_templates (name, description, folders) VALUES
('Standard Property', 'Default folder structure for residential properties', '[
  {"name": "Leases", "icon": "file-text"},
  {"name": "Inspection Reports", "icon": "clipboard"},
  {"name": "Insurance", "icon": "shield"},
  {"name": "Compliance", "icon": "check-circle"},
  {"name": "Maintenance Records", "icon": "tool"},
  {"name": "Financial", "icon": "dollar-sign"},
  {"name": "Tenant Documents", "icon": "users"},
  {"name": "Correspondence", "icon": "mail"}
]')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. LEASE TEMPLATES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS lease_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  html_template TEXT NOT NULL,
  required_fields TEXT[] NOT NULL,
  optional_clauses JSONB,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  superseded_at DATE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_templates_state ON lease_templates(state, is_current) WHERE is_current;

-- Insert placeholder templates for each state (HTML templates populated by the agent)
INSERT INTO lease_templates (state, version, name, html_template, required_fields) VALUES
(
  'NSW', '2024.1',
  'NSW Standard Residential Tenancy Agreement',
  '{{AGENT_GENERATED}}',
  ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end']
),
(
  'VIC', '2024.1',
  'VIC Standard Residential Tenancy Agreement',
  '{{AGENT_GENERATED}}',
  ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end']
),
(
  'QLD', '2024.1',
  'QLD General Tenancy Agreement (Form 18a)',
  '{{AGENT_GENERATED}}',
  ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end']
),
(
  'SA', '2024.1',
  'SA Residential Tenancy Agreement',
  '{{AGENT_GENERATED}}',
  ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end']
),
(
  'WA', '2024.1',
  'WA Residential Tenancy Agreement',
  '{{AGENT_GENERATED}}',
  ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end']
),
(
  'TAS', '2024.1',
  'TAS Residential Tenancy Agreement',
  '{{AGENT_GENERATED}}',
  ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end']
),
(
  'NT', '2024.1',
  'NT Residential Tenancy Agreement',
  '{{AGENT_GENERATED}}',
  ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end']
),
(
  'ACT', '2024.1',
  'ACT Residential Tenancy Agreement',
  '{{AGENT_GENERATED}}',
  ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end']
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. DOCUMENTS STORAGE BUCKET
-- ============================================================

-- Private bucket for document file uploads (PDFs, images, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Owners can upload documents (folder = user id)
CREATE POLICY "Owners can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Owners can view their own documents
CREATE POLICY "Owners can view own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Owners can update their documents
CREATE POLICY "Owners can update own documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Owners can delete their documents
CREATE POLICY "Owners can delete own documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- 8. TRIGGER: Create default folders for new properties
-- ============================================================

CREATE OR REPLACE FUNCTION create_property_folders()
RETURNS TRIGGER AS $$
DECLARE
  template JSONB;
  folder JSONB;
BEGIN
  SELECT folders INTO template FROM folder_templates
    WHERE name = 'Standard Property' AND is_active
    LIMIT 1;

  IF template IS NOT NULL THEN
    FOR folder IN SELECT * FROM jsonb_array_elements(template)
    LOOP
      INSERT INTO document_folders (owner_id, property_id, name, icon, is_system)
      VALUES (NEW.owner_id, NEW.id, folder->>'name', folder->>'icon', TRUE);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create if trigger doesn't already exist
DROP TRIGGER IF EXISTS property_folders_init ON properties;
CREATE TRIGGER property_folders_init
  AFTER INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION create_property_folders();

-- ============================================================
-- 9. FULL-TEXT SEARCH FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION search_documents(
  p_user_id UUID,
  p_query TEXT,
  p_property_id UUID DEFAULT NULL,
  p_document_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  document_type document_type,
  property_id UUID,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      d.id,
      d.title,
      d.document_type,
      d.property_id,
      d.created_at,
      ts_rank(
        to_tsvector('english', COALESCE(d.title, '') || ' ' || COALESCE(d.description, '') || ' ' || COALESCE(d.ocr_text, '')),
        plainto_tsquery('english', p_query)
      ) AS rank
    FROM documents d
    WHERE d.owner_id = p_user_id
      AND NOT d.is_archived
      AND to_tsvector('english', COALESCE(d.title, '') || ' ' || COALESCE(d.description, '') || ' ' || COALESCE(d.ocr_text, ''))
          @@ plainto_tsquery('english', p_query)
      AND (p_property_id IS NULL OR d.property_id = p_property_id)
      AND (p_document_type IS NULL OR d.document_type::text = p_document_type)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
