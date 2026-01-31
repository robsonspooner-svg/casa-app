-- =============================================================================
-- SECURITY FIX MIGRATION
-- Addresses all critical, high, and medium vulnerabilities found during audit
-- =============================================================================

-- =============================================================================
-- 1. PROFILES RLS: Restrict UPDATE to safe columns only
--    VULNERABILITY: Users could change their own role, subscription_tier,
--    subscription_status, stripe_customer_id via PATCH /profiles
-- =============================================================================

-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create a trigger that prevents modification of privileged columns
-- This is the PostgreSQL way to enforce column-level restrictions since
-- RLS only works at the row level
CREATE OR REPLACE FUNCTION prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If called by service_role or via trigger (not direct user request), allow all changes
  -- auth.uid() returns NULL for service role calls and trigger invocations
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block changes to privileged columns for regular users
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Permission denied: cannot modify role';
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Permission denied: cannot modify subscription_tier';
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Permission denied: cannot modify subscription_status';
  END IF;

  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Permission denied: cannot modify stripe_customer_id';
  END IF;

  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Permission denied: cannot modify trial_ends_at';
  END IF;

  RETURN NEW;
END;
$$;

-- Apply the trigger
DROP TRIGGER IF EXISTS enforce_profile_privilege_guard ON profiles;
CREATE TRIGGER enforce_profile_privilege_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_privilege_escalation();

-- Recreate the update policy (row-level check remains: user can only update own row)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- =============================================================================
-- 2. PROFILES RLS: Restrict SELECT to related profiles only
--    VULNERABILITY: USING(true) exposed all profile data to everyone,
--    including unauthenticated users
-- =============================================================================

-- Drop the overly permissive read policy
DROP POLICY IF EXISTS "Users can view related profiles" ON profiles;

-- Create a scoped policy: users can see profiles of people they share a tenancy with
-- This covers: owners seeing their tenants, tenants seeing their owner
CREATE POLICY "Users can view related profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Own profile
      auth.uid() = id
      OR
      -- Owner viewing tenant profiles (tenants in properties they own)
      EXISTS (
        SELECT 1 FROM tenancy_tenants tt
        JOIN tenancies t ON t.id = tt.tenancy_id
        JOIN properties p ON p.id = t.property_id
        WHERE tt.tenant_id = profiles.id
        AND p.owner_id = auth.uid()
      )
      OR
      -- Tenant viewing owner profile (owner of property they rent)
      EXISTS (
        SELECT 1 FROM tenancy_tenants tt
        JOIN tenancies t ON t.id = tt.tenancy_id
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = profiles.id
        AND tt.tenant_id = auth.uid()
      )
      OR
      -- Tenant viewing co-tenant profiles
      EXISTS (
        SELECT 1 FROM tenancy_tenants tt1
        JOIN tenancy_tenants tt2 ON tt1.tenancy_id = tt2.tenancy_id
        WHERE tt1.tenant_id = auth.uid()
        AND tt2.tenant_id = profiles.id
      )
      OR
      -- Owner viewing applicant profiles
      EXISTS (
        SELECT 1 FROM applications a
        JOIN listings l ON l.id = a.listing_id
        JOIN properties p ON p.id = l.property_id
        WHERE a.tenant_id = profiles.id
        AND p.owner_id = auth.uid()
      )
    )
  );

-- Note: The "Users can view own profile" and "Admins can view all profiles" policies
-- from earlier migrations remain in place and still work correctly.


-- =============================================================================
-- 3. CONNECTION_CODES RLS: Restrict read access
--    VULNERABILITY: USING(true) made all connection codes readable by everyone,
--    including unauthenticated users
-- =============================================================================

-- Drop the overly permissive system read policy
DROP POLICY IF EXISTS "System can read codes for validation" ON connection_codes;

-- Connection codes should only be readable by the owner who created them.
-- The use_connection_code() function is SECURITY DEFINER and can read codes
-- regardless of RLS, so we don't need a public SELECT policy.
-- No replacement policy needed — the "Owners manage own connection codes" policy
-- already grants SELECT to owners for their own codes.


-- =============================================================================
-- 4. FIX: connect_tenant_to_property() — Add auth check + SET search_path
--    VULNERABILITY: No validation that p_tenant_id = auth.uid()
--    A malicious user could connect ANY tenant to ANY property
-- =============================================================================

CREATE OR REPLACE FUNCTION connect_tenant_to_property(
  p_property_id UUID,
  p_tenant_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  tenancy_id UUID,
  tenancy_tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenancy_id UUID;
  v_tenancy_tenant_id UUID;
  v_existing_count INTEGER;
BEGIN
  -- SECURITY: Verify the caller is the tenant being connected
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() != p_tenant_id THEN
    RAISE EXCEPTION 'Permission denied: can only connect yourself';
  END IF;

  -- Check if tenant is already connected to this property
  SELECT COUNT(*) INTO v_existing_count
  FROM tenancies t
  JOIN tenancy_tenants tt ON tt.tenancy_id = t.id
  WHERE t.property_id = p_property_id
  AND tt.tenant_id = p_tenant_id;

  IF v_existing_count > 0 THEN
    RETURN QUERY SELECT FALSE, 'You are already connected to this property'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Create the tenancy with all required fields
  INSERT INTO tenancies (
    property_id,
    status,
    lease_start_date,
    lease_end_date,
    lease_type,
    rent_amount,
    rent_frequency,
    rent_due_day,
    bond_amount
  )
  VALUES (
    p_property_id,
    'active',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '12 months',
    '12_months',
    0,
    'weekly',
    1,
    0
  )
  RETURNING id INTO v_tenancy_id;

  -- Add tenant to the tenancy
  INSERT INTO tenancy_tenants (tenancy_id, tenant_id, is_primary, is_leaseholder)
  VALUES (v_tenancy_id, p_tenant_id, TRUE, TRUE)
  RETURNING id INTO v_tenancy_tenant_id;

  -- Update connection attempt to success
  UPDATE connection_attempts
  SET status = 'success',
      processed_at = NOW(),
      created_tenancy_tenant_id = v_tenancy_tenant_id
  WHERE code_text = UPPER(TRIM(p_code))
  AND user_id = p_tenant_id
  AND status = 'pending';

  RETURN QUERY SELECT TRUE, 'Connected successfully'::TEXT, v_tenancy_id, v_tenancy_tenant_id;
END;
$$;


-- =============================================================================
-- 5. FIX: use_connection_code() — Validate p_user_id = auth.uid() + SET search_path
--    VULNERABILITY: p_user_id not validated against auth.uid()
-- =============================================================================

CREATE OR REPLACE FUNCTION use_connection_code(
  p_code TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  connection_type TEXT,
  property_id UUID,
  tenancy_id UUID,
  owner_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_record connection_codes%ROWTYPE;
  v_attempt_id UUID;
BEGIN
  -- SECURITY: Verify the caller is the user being passed
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Permission denied: can only use codes for yourself';
  END IF;

  -- Normalize code to uppercase
  p_code := UPPER(TRIM(p_code));

  -- Find the code
  SELECT * INTO v_code_record
  FROM connection_codes
  WHERE code = p_code
  AND is_active = TRUE
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (max_uses IS NULL OR use_count < max_uses);

  IF NOT FOUND THEN
    -- Log failed attempt
    INSERT INTO connection_attempts (code_text, user_id, status, failure_reason)
    VALUES (p_code, p_user_id, 'failed', 'Code not found, expired, or max uses reached');

    RETURN QUERY SELECT FALSE, 'Invalid or expired code'::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Check if user is not the owner (can't connect to own property)
  IF v_code_record.owner_id = p_user_id THEN
    INSERT INTO connection_attempts (code_id, code_text, user_id, status, failure_reason)
    VALUES (v_code_record.id, p_code, p_user_id, 'failed', 'Cannot use own connection code');

    RETURN QUERY SELECT FALSE, 'You cannot use your own connection code'::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Log successful validation (actual connection creation happens in application code)
  INSERT INTO connection_attempts (code_id, code_text, user_id, status)
  VALUES (v_code_record.id, p_code, p_user_id, 'pending')
  RETURNING id INTO v_attempt_id;

  -- Increment use count
  UPDATE connection_codes SET use_count = use_count + 1 WHERE id = v_code_record.id;

  -- Return success with connection details
  RETURN QUERY SELECT
    TRUE,
    'Code validated successfully'::TEXT,
    v_code_record.connection_type,
    v_code_record.property_id,
    v_code_record.tenancy_id,
    v_code_record.owner_id;
END;
$$;


-- =============================================================================
-- 6. FIX: process_arrears_payment() — Add authorization + SET search_path
--    VULNERABILITY: Any authenticated user could forge payments for any arrears
-- =============================================================================

CREATE OR REPLACE FUNCTION process_arrears_payment(
  p_arrears_id UUID,
  p_amount DECIMAL,
  p_payment_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arrears arrears_records%ROWTYPE;
  v_plan payment_plans%ROWTYPE;
  v_installment payment_plan_installments%ROWTYPE;
  v_remaining DECIMAL := p_amount;
  v_is_authorized BOOLEAN;
BEGIN
  -- SECURITY: Verify the caller is the property owner for this arrears record
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get the arrears record
  SELECT * INTO v_arrears FROM arrears_records WHERE id = p_arrears_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arrears record not found';
  END IF;

  -- Check authorization: must be property owner
  SELECT EXISTS (
    SELECT 1 FROM tenancies t
    JOIN properties p ON p.id = t.property_id
    WHERE t.id = v_arrears.tenancy_id
    AND p.owner_id = auth.uid()
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Permission denied: not the property owner';
  END IF;

  -- Update total overdue
  UPDATE arrears_records
  SET
    total_overdue = GREATEST(0, total_overdue - p_amount),
    updated_at = NOW()
  WHERE id = p_arrears_id;

  -- If there's a payment plan, mark installments as paid
  IF v_arrears.has_payment_plan AND v_arrears.payment_plan_id IS NOT NULL THEN
    FOR v_installment IN
      SELECT * FROM payment_plan_installments
      WHERE payment_plan_id = v_arrears.payment_plan_id
      AND NOT is_paid
      ORDER BY due_date ASC
    LOOP
      IF v_remaining >= v_installment.amount THEN
        UPDATE payment_plan_installments
        SET is_paid = TRUE, paid_at = NOW(), payment_id = p_payment_id
        WHERE id = v_installment.id;

        v_remaining := v_remaining - v_installment.amount;

        UPDATE payment_plans
        SET
          amount_paid = amount_paid + v_installment.amount,
          installments_paid = installments_paid + 1,
          next_due_date = (
            SELECT MIN(due_date) FROM payment_plan_installments
            WHERE payment_plan_id = v_arrears.payment_plan_id AND NOT is_paid
          )
        WHERE id = v_arrears.payment_plan_id;
      ELSE
        EXIT;
      END IF;
    END LOOP;

    -- Check if plan is completed
    UPDATE payment_plans
    SET status = 'completed'
    WHERE id = v_arrears.payment_plan_id
    AND NOT EXISTS (
      SELECT 1 FROM payment_plan_installments
      WHERE payment_plan_id = v_arrears.payment_plan_id AND NOT is_paid
    );
  END IF;

  -- Log the payment action
  INSERT INTO arrears_actions (
    arrears_record_id,
    action_type,
    description,
    is_automated,
    metadata
  ) VALUES (
    p_arrears_id,
    'payment_received',
    'Payment of $' || p_amount || ' received',
    TRUE,
    jsonb_build_object('amount', p_amount, 'payment_id', p_payment_id)
  );

  -- Check if arrears are fully resolved
  IF (SELECT total_overdue FROM arrears_records WHERE id = p_arrears_id) <= 0 THEN
    UPDATE arrears_records
    SET
      is_resolved = TRUE,
      resolved_at = NOW(),
      resolved_reason = 'Paid in full'
    WHERE id = p_arrears_id;
  END IF;
END;
$$;


-- =============================================================================
-- 7. FIX: mark_rent_paid() — Add authorization + SET search_path
--    VULNERABILITY: Any user could mark any rent schedule as paid
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_rent_paid(
  p_schedule_id UUID,
  p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenancy_id UUID;
  v_is_authorized BOOLEAN;
BEGIN
  -- SECURITY: Verify the caller is authorized
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get the tenancy for this schedule
  SELECT tenancy_id INTO v_tenancy_id
  FROM rent_schedules WHERE id = p_schedule_id;

  IF v_tenancy_id IS NULL THEN
    RAISE EXCEPTION 'Rent schedule not found';
  END IF;

  -- Check authorization: must be property owner
  SELECT EXISTS (
    SELECT 1 FROM tenancies t
    JOIN properties p ON p.id = t.property_id
    WHERE t.id = v_tenancy_id
    AND p.owner_id = auth.uid()
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Permission denied: not the property owner';
  END IF;

  UPDATE rent_schedules
  SET is_paid = TRUE, paid_at = NOW(), payment_id = p_payment_id
  WHERE id = p_schedule_id;
END;
$$;


-- =============================================================================
-- 8. FIX: generate_rent_schedule() — Add authorization + SET search_path
--    VULNERABILITY: Any user could create rent schedules for any tenancy
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_rent_schedule(
  p_tenancy_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_amount DECIMAL,
  p_frequency payment_frequency
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_due DATE := p_start_date;
  interval_days INTEGER;
  v_is_authorized BOOLEAN;
BEGIN
  -- SECURITY: Verify the caller is authorized
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check authorization: must be property owner
  SELECT EXISTS (
    SELECT 1 FROM tenancies t
    JOIN properties p ON p.id = t.property_id
    WHERE t.id = p_tenancy_id
    AND p.owner_id = auth.uid()
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Permission denied: not the property owner';
  END IF;

  CASE p_frequency
    WHEN 'weekly' THEN interval_days := 7;
    WHEN 'fortnightly' THEN interval_days := 14;
    WHEN 'monthly' THEN interval_days := 0;
  END CASE;

  WHILE current_due <= p_end_date LOOP
    INSERT INTO rent_schedules (tenancy_id, due_date, amount)
    VALUES (p_tenancy_id, current_due, p_amount)
    ON CONFLICT (tenancy_id, due_date) DO NOTHING;

    IF p_frequency = 'monthly' THEN
      current_due := current_due + INTERVAL '1 month';
    ELSE
      current_due := current_due + (interval_days || ' days')::INTERVAL;
    END IF;
  END LOOP;
END;
$$;


-- =============================================================================
-- 9. FIX: generate_payment_plan_installments() — Add authorization + SET search_path
--    VULNERABILITY: Any user could generate installments for any payment plan
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_payment_plan_installments(
  p_plan_id UUID,
  p_total_amount DECIMAL,
  p_installment_amount DECIMAL,
  p_frequency payment_frequency,
  p_start_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_date DATE := p_start_date;
  v_remaining DECIMAL := p_total_amount;
  v_installment_num INTEGER := 1;
  v_interval INTERVAL;
  v_tenancy_id UUID;
  v_is_authorized BOOLEAN;
BEGIN
  -- SECURITY: Verify the caller is authorized
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get tenancy from payment plan
  SELECT tenancy_id INTO v_tenancy_id
  FROM payment_plans WHERE id = p_plan_id;

  IF v_tenancy_id IS NULL THEN
    RAISE EXCEPTION 'Payment plan not found';
  END IF;

  -- Check authorization: must be property owner
  SELECT EXISTS (
    SELECT 1 FROM tenancies t
    JOIN properties p ON p.id = t.property_id
    WHERE t.id = v_tenancy_id
    AND p.owner_id = auth.uid()
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Permission denied: not the property owner';
  END IF;

  -- Determine interval based on frequency
  v_interval := CASE p_frequency
    WHEN 'weekly' THEN INTERVAL '1 week'
    WHEN 'fortnightly' THEN INTERVAL '2 weeks'
    WHEN 'monthly' THEN INTERVAL '1 month'
    ELSE INTERVAL '1 week'
  END;

  -- Generate installments until total is covered
  WHILE v_remaining > 0 LOOP
    INSERT INTO payment_plan_installments (
      payment_plan_id,
      installment_number,
      due_date,
      amount
    ) VALUES (
      p_plan_id,
      v_installment_num,
      v_current_date,
      LEAST(p_installment_amount, v_remaining)
    );

    v_remaining := v_remaining - p_installment_amount;
    v_current_date := v_current_date + v_interval;
    v_installment_num := v_installment_num + 1;
  END LOOP;

  -- Update payment plan with total installments and next due date
  UPDATE payment_plans
  SET
    total_installments = v_installment_num - 1,
    next_due_date = p_start_date,
    expected_end_date = v_current_date - v_interval
  WHERE id = p_plan_id;
END;
$$;


-- =============================================================================
-- 10. FIX: RLS helper functions — Add SET search_path
--     These were missing SET search_path = public which could allow
--     search_path hijacking attacks
-- =============================================================================

CREATE OR REPLACE FUNCTION auth_owns_tenancy(p_tenancy_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenancies t
    JOIN properties p ON p.id = t.property_id
    WHERE t.id = p_tenancy_id
    AND p.owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION auth_is_tenant_in_tenancy(p_tenancy_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenancy_tenants
    WHERE tenancy_id = p_tenancy_id
    AND tenant_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION auth_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND role = 'admin'
  );
$$;


-- =============================================================================
-- 11. FIX: handle_new_user() — Ensure SET search_path = public
--     Migration 000005 dropped it; restore it
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, subscription_tier, subscription_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'owner'),
    CASE
      WHEN COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'owner') = 'owner' THEN 'starter'::subscription_tier
      ELSE NULL
    END,
    CASE
      WHEN COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'owner') = 'owner' THEN 'active'::subscription_status
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
