-- Mission 11: Inspection Reports Storage Bucket
-- Creates the 'inspection-reports' bucket for generated HTML condition reports.
-- Reports are stored at: {owner_id}/{inspection_id}/report.html

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-reports', 'inspection-reports', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- Service role (Edge Functions) can upload reports
-- This is handled automatically by the service role key.

-- Owners can read their own inspection reports
CREATE POLICY "Owners can view their inspection reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'inspection-reports' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Tenants can view inspection reports for their tenancies
CREATE POLICY "Tenants can view inspection reports for their tenancies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'inspection-reports' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1
      FROM inspections i
      JOIN properties p ON p.id = i.property_id
      JOIN tenancy_tenants tt ON tt.tenancy_id = i.tenancy_id
      WHERE (storage.foldername(name))[1] = p.owner_id::text
        AND (storage.foldername(name))[2] = i.id::text
        AND tt.tenant_id = auth.uid()
    )
  );

-- Owners can delete their own reports (for regeneration)
CREATE POLICY "Owners can delete their inspection reports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'inspection-reports' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can upload (Edge Function uses service role, but allow owner uploads too)
CREATE POLICY "Authenticated users can upload inspection reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection-reports' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
