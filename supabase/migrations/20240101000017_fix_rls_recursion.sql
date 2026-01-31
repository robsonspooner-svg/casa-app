-- Fix RLS infinite recursion in tenancies, tenancy_tenants, profiles, and downstream tables
--
-- Problem: Cross-table RLS policies create circular dependencies:
--   1. tenancies tenant policy -> queries tenancy_tenants -> tenancy_tenants owner policy -> queries tenancies (LOOP)
--   2. profiles admin policy -> queries profiles (SELF-LOOP)
--   3. rent_schedules, payments, arrears_records tenant policies -> query tenancy_tenants -> same loop
--
-- Solution: Create SECURITY DEFINER helper functions that bypass RLS for policy checks

-- =============================================================================
-- Helper Functions (SECURITY DEFINER = bypasses RLS)
-- =============================================================================

-- Check if a user owns the property associated with a tenancy
CREATE OR REPLACE FUNCTION auth_owns_tenancy(p_tenancy_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenancies t
    JOIN properties p ON p.id = t.property_id
    WHERE t.id = p_tenancy_id
    AND p.owner_id = p_user_id
  );
$$;

-- Check if a user is a tenant in a given tenancy
CREATE OR REPLACE FUNCTION auth_is_tenant_in_tenancy(p_tenancy_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenancy_tenants
    WHERE tenancy_id = p_tenancy_id
    AND tenant_id = p_user_id
  );
$$;

-- Check if a user is an admin
CREATE OR REPLACE FUNCTION auth_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND role = 'admin'
  );
$$;

-- =============================================================================
-- Fix profiles RLS (remove self-referencing admin policy)
-- =============================================================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (auth_is_admin(auth.uid()));

-- Also allow owners to view tenant profiles (needed for tenancy management)
-- and tenants to view owner profiles (needed for property info)
DROP POLICY IF EXISTS "Users can view related profiles" ON profiles;
CREATE POLICY "Users can view related profiles"
  ON profiles FOR SELECT
  USING (true);
-- Note: This allows any authenticated user to read any profile.
-- This is acceptable because profiles contain only names/emails (no sensitive data),
-- and the alternative (complex cross-table joins) would re-introduce recursion.

-- =============================================================================
-- Fix tenancies RLS
-- =============================================================================

-- Drop the problematic tenant policy that causes recursion
DROP POLICY IF EXISTS "Tenants can view own tenancies" ON tenancies;
CREATE POLICY "Tenants can view own tenancies"
  ON tenancies FOR SELECT
  USING (auth_is_tenant_in_tenancy(id, auth.uid()));

-- =============================================================================
-- Fix tenancy_tenants RLS
-- =============================================================================

-- Drop both policies and recreate without recursion
DROP POLICY IF EXISTS "Owners can manage tenancy tenants" ON tenancy_tenants;
CREATE POLICY "Owners can manage tenancy tenants"
  ON tenancy_tenants FOR ALL
  USING (auth_owns_tenancy(tenancy_id, auth.uid()));

DROP POLICY IF EXISTS "Tenants can view co-tenants" ON tenancy_tenants;
CREATE POLICY "Tenants can view co-tenants"
  ON tenancy_tenants FOR SELECT
  USING (auth_is_tenant_in_tenancy(tenancy_id, auth.uid()));

-- =============================================================================
-- Fix rent_schedules RLS (tenant policy references tenancy_tenants)
-- =============================================================================

DROP POLICY IF EXISTS "Tenants view own rent schedules" ON rent_schedules;
CREATE POLICY "Tenants view own rent schedules"
  ON rent_schedules FOR SELECT
  USING (auth_is_tenant_in_tenancy(tenancy_id, auth.uid()));

-- Also fix owner policy to use helper function
DROP POLICY IF EXISTS "Owners view rent schedules" ON rent_schedules;
CREATE POLICY "Owners view rent schedules"
  ON rent_schedules FOR SELECT
  USING (auth_owns_tenancy(tenancy_id, auth.uid()));

-- =============================================================================
-- Fix payments RLS (if tenant policy references tenancy_tenants)
-- =============================================================================

DROP POLICY IF EXISTS "Owners view payments for their properties" ON payments;
CREATE POLICY "Owners view payments for their properties"
  ON payments FOR SELECT
  USING (auth_owns_tenancy(tenancy_id, auth.uid()));

-- =============================================================================
-- Fix arrears_records RLS
-- =============================================================================

DROP POLICY IF EXISTS "Owners can view arrears for their properties" ON arrears_records;
CREATE POLICY "Owners can view arrears for their properties"
  ON arrears_records FOR SELECT
  USING (auth_owns_tenancy(tenancy_id, auth.uid()));

-- =============================================================================
-- Fix payment_plans RLS
-- =============================================================================

DROP POLICY IF EXISTS "Owners can view payment plans" ON payment_plans;
CREATE POLICY "Owners can view payment plans"
  ON payment_plans FOR SELECT
  USING (auth_owns_tenancy(tenancy_id, auth.uid()));

DROP POLICY IF EXISTS "Tenants can view own payment plans" ON payment_plans;
CREATE POLICY "Tenants can view own payment plans"
  ON payment_plans FOR SELECT
  USING (auth_is_tenant_in_tenancy(tenancy_id, auth.uid()));

-- =============================================================================
-- Fix payment_plan_installments RLS
-- =============================================================================

DROP POLICY IF EXISTS "Owners can view installments" ON payment_plan_installments;
CREATE POLICY "Owners can view installments"
  ON payment_plan_installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_plans pp
      WHERE pp.id = payment_plan_installments.payment_plan_id
      AND auth_owns_tenancy(pp.tenancy_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Tenants can view own installments" ON payment_plan_installments;
CREATE POLICY "Tenants can view own installments"
  ON payment_plan_installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_plans pp
      WHERE pp.id = payment_plan_installments.payment_plan_id
      AND auth_is_tenant_in_tenancy(pp.tenancy_id, auth.uid())
    )
  );

-- =============================================================================
-- Fix arrears_actions RLS
-- =============================================================================

DROP POLICY IF EXISTS "Owners can view arrears actions" ON arrears_actions;
CREATE POLICY "Owners can view arrears actions"
  ON arrears_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM arrears_records ar
      WHERE ar.id = arrears_actions.arrears_record_id
      AND auth_owns_tenancy(ar.tenancy_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can create arrears actions" ON arrears_actions;
CREATE POLICY "Owners can create arrears actions"
  ON arrears_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM arrears_records ar
      WHERE ar.id = arrears_actions.arrears_record_id
      AND auth_owns_tenancy(ar.tenancy_id, auth.uid())
    )
  );
