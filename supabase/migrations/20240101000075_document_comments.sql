-- =====================================================
-- DOCUMENT COMMENTS & REVISION REQUESTS
-- Enables collaborative review of documents between
-- owners and tenants, with comment threads and
-- revision request tracking.
-- =====================================================

-- Document comments table
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'comment' CHECK (comment_type IN ('comment', 'revision_request')),
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_author_id ON document_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_type ON document_comments(comment_type);

-- RLS
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Document participants can view comments
CREATE POLICY "Users can view comments on their documents" ON document_comments
  FOR SELECT USING (
    author_id = auth.uid()
    OR document_id IN (
      SELECT d.id FROM documents d
      JOIN properties p ON d.property_id = p.id
      WHERE p.owner_id = auth.uid()
    )
    OR document_id IN (
      SELECT d.id FROM documents d
      JOIN tenancies t ON d.tenancy_id = t.id
      JOIN tenancy_tenants tt ON tt.tenancy_id = t.id
      WHERE tt.tenant_id = auth.uid()
    )
  );

-- Users can insert their own comments
CREATE POLICY "Users can insert own comments" ON document_comments
  FOR INSERT WITH CHECK (author_id = auth.uid());

-- Document owner can update comments (to mark as resolved)
CREATE POLICY "Document owners can update comments" ON document_comments
  FOR UPDATE USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN properties p ON d.property_id = p.id
      WHERE p.owner_id = auth.uid()
    )
    OR author_id = auth.uid()
  );
