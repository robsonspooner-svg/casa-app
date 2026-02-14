-- Medium Severity Fixes Migration
-- Fix #6: Add property existence check to use_connection_code()

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

  -- Verify the linked property still exists and is not deleted
  IF v_code_record.property_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM properties
      WHERE id = v_code_record.property_id
      AND deleted_at IS NULL
    ) THEN
      INSERT INTO connection_attempts (code_id, code_text, user_id, status, failure_reason)
      VALUES (v_code_record.id, p_code, p_user_id, 'failed', 'Property no longer exists');

      RETURN QUERY SELECT FALSE, 'The property associated with this code no longer exists'::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  -- Log successful validation
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
