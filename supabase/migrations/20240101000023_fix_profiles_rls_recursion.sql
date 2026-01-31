-- =============================================================================
-- Fix profiles RLS policy that can't traverse RLS-protected tables
-- The cross-table JOINs in the policy fail because tenancies/properties tables
-- have their own RLS policies. Solution: use SECURITY DEFINER helper functions.
-- =============================================================================

-- Helper: Check if user_a and user_b share a tenancy relationship
-- (either as owner-tenant or co-tenants)
CREATE OR REPLACE FUNCTION auth_users_share_tenancy(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    -- user_a is owner, user_b is tenant
    SELECT 1 FROM tenancy_tenants tt
    JOIN tenancies t ON t.id = tt.tenancy_id
    JOIN properties p ON p.id = t.property_id
    WHERE tt.tenant_id = p_user_b
    AND p.owner_id = p_user_a
  )
  OR EXISTS (
    -- user_a is tenant, user_b is owner
    SELECT 1 FROM tenancy_tenants tt
    JOIN tenancies t ON t.id = tt.tenancy_id
    JOIN properties p ON p.id = t.property_id
    WHERE tt.tenant_id = p_user_a
    AND p.owner_id = p_user_b
  )
  OR EXISTS (
    -- co-tenants
    SELECT 1 FROM tenancy_tenants tt1
    JOIN tenancy_tenants tt2 ON tt1.tenancy_id = tt2.tenancy_id
    WHERE tt1.tenant_id = p_user_a
    AND tt2.tenant_id = p_user_b
    AND p_user_a != p_user_b
  );
$$;

-- Helper: Check if owner can see applicant's profile
CREATE OR REPLACE FUNCTION auth_owner_has_applicant(p_owner_id UUID, p_applicant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM applications a
    JOIN listings l ON l.id = a.listing_id
    JOIN properties p ON p.id = l.property_id
    WHERE a.tenant_id = p_applicant_id
    AND p.owner_id = p_owner_id
  );
$$;

-- Replace the profiles policy with one using helper functions
DROP POLICY IF EXISTS "Users can view related profiles" ON profiles;

CREATE POLICY "Users can view related profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Own profile (handled by other policy too, but included for clarity)
      auth.uid() = id
      OR
      -- Users who share a tenancy relationship (owner<->tenant, co-tenants)
      auth_users_share_tenancy(auth.uid(), id)
      OR
      -- Owner viewing applicant profiles
      auth_owner_has_applicant(auth.uid(), id)
    )
  );
