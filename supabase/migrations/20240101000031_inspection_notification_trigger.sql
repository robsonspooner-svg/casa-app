-- Mission 12 Fix: Notify tenants when inspection is scheduled
-- Creates a trigger that queues an email notification when an inspection is scheduled

CREATE OR REPLACE FUNCTION notify_tenant_inspection_scheduled()
RETURNS TRIGGER AS $$
DECLARE
  v_tenancy RECORD;
  v_tenant RECORD;
  v_property RECORD;
  v_inspection_date TEXT;
  v_inspection_time TEXT;
BEGIN
  -- Only fire on new scheduled inspections
  IF NEW.status != 'scheduled' OR NEW.tenancy_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get property details
  SELECT address_line_1, suburb, state
  INTO v_property
  FROM properties
  WHERE id = NEW.property_id;

  -- Format date
  v_inspection_date := TO_CHAR(NEW.scheduled_date::DATE, 'DD Mon YYYY');
  v_inspection_time := COALESCE(NEW.scheduled_time::TEXT, 'TBC');

  -- Get tenants linked to this tenancy
  FOR v_tenant IN
    SELECT p.email, p.full_name
    FROM tenancy_tenants tt
    JOIN profiles p ON p.id = tt.tenant_id
    WHERE tt.tenancy_id = NEW.tenancy_id
  LOOP
    -- Queue email notification
    INSERT INTO email_notifications (
      notification_type,
      recipient_email,
      recipient_name,
      template_data,
      status
    ) VALUES (
      'inspection_scheduled',
      v_tenant.email,
      v_tenant.full_name,
      jsonb_build_object(
        'inspection_id', NEW.id,
        'inspection_type', NEW.inspection_type,
        'property_address', COALESCE(v_property.address_line_1, '') || ', ' || COALESCE(v_property.suburb, '') || ' ' || COALESCE(v_property.state, ''),
        'scheduled_date', v_inspection_date,
        'scheduled_time', v_inspection_time
      ),
      'pending'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on inspections table
DROP TRIGGER IF EXISTS trigger_inspection_scheduled_notify ON inspections;
CREATE TRIGGER trigger_inspection_scheduled_notify
  AFTER INSERT ON inspections
  FOR EACH ROW
  WHEN (NEW.status = 'scheduled')
  EXECUTE FUNCTION notify_tenant_inspection_scheduled();
