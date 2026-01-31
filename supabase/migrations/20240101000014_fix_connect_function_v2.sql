-- Fix connect_tenant_to_property function - use correct lease_type enum value

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
) AS $$
DECLARE
  v_tenancy_id UUID;
  v_tenancy_tenant_id UUID;
  v_existing_count INTEGER;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
