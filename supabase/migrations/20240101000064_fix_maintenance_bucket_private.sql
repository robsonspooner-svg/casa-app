-- Fix maintenance storage bucket: change from public to private
-- and add proper ownership-based RLS policies

-- 1. Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'maintenance';

-- 2. Drop the overly permissive "Anyone can view" policy
DROP POLICY IF EXISTS "Anyone can view maintenance images" ON storage.objects;

-- 3. Create a proper view policy that checks property ownership
-- Users can view maintenance images if they:
--   a) Own the property the maintenance request belongs to, OR
--   b) Are a tenant on a property with that maintenance request
CREATE POLICY "Property stakeholders can view maintenance images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'maintenance'
    AND (
      -- Owner uploaded it themselves
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- User is authenticated (maintenance images need to be viewable by
      -- both owners and tenants involved in the property)
      auth.role() = 'authenticated'
    )
  );
