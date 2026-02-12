-- Fix: Enable RLS on folder_templates and lease_templates
-- These reference tables were created in migration 049 (document_management)
-- but RLS was never enabled, leaving them unprotected.

ALTER TABLE folder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;

-- These are read-only reference tables accessible to all authenticated users.
-- Only admins (via service role) should insert/update/delete.
CREATE POLICY folder_templates_read ON folder_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lease_templates_read ON lease_templates
  FOR SELECT TO authenticated USING (true);
