-- Fix connection_codes RLS policy to properly allow INSERT
-- The FOR ALL policy needs WITH CHECK for INSERT operations

-- Drop and recreate the policy with proper WITH CHECK
DROP POLICY IF EXISTS "Owners manage own connection codes" ON connection_codes;

CREATE POLICY "Owners manage own connection codes"
  ON connection_codes FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
