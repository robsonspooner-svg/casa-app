-- Email Notification Triggers
-- Casa - Mission 05: Tenant Applications
-- Automatically send emails when application status changes

-- Create notification queue table
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  template_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0
);

-- Index for processing pending notifications
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_notifications_created_at ON email_notifications(created_at);

-- RLS: Only service role can access
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Function to queue application received notification
CREATE OR REPLACE FUNCTION queue_application_received_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_email TEXT;
  v_owner_name TEXT;
  v_property_address TEXT;
  v_applicant_name TEXT;
BEGIN
  -- Only trigger on initial submission (status changes to 'submitted')
  IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status = 'draft') THEN
    -- Get listing and property info
    SELECT
      p.email,
      p.full_name,
      CONCAT(prop.address_line_1, ', ', prop.suburb, ' ', prop.state, ' ', prop.postcode)
    INTO v_owner_email, v_owner_name, v_property_address
    FROM listings l
    JOIN properties prop ON prop.id = l.property_id
    JOIN profiles p ON p.id = l.owner_id
    WHERE l.id = NEW.listing_id;

    v_applicant_name := NEW.full_name;

    -- Queue the notification
    INSERT INTO email_notifications (
      notification_type,
      recipient_email,
      recipient_name,
      template_data
    ) VALUES (
      'application_received',
      v_owner_email,
      v_owner_name,
      jsonb_build_object(
        'ownerName', v_owner_name,
        'propertyAddress', v_property_address,
        'applicantName', v_applicant_name,
        'applicationUrl', CONCAT('casa://applications/', NEW.id)
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue application status update notification
CREATE OR REPLACE FUNCTION queue_application_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_email TEXT;
  v_tenant_name TEXT;
  v_property_address TEXT;
  v_status_message TEXT;
BEGIN
  -- Only trigger on status changes (not draft)
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status != 'draft' AND OLD.status != 'draft' THEN
    -- Get tenant info
    SELECT email, full_name
    INTO v_tenant_email, v_tenant_name
    FROM profiles
    WHERE id = NEW.tenant_id;

    -- Get property address
    SELECT CONCAT(prop.address_line_1, ', ', prop.suburb)
    INTO v_property_address
    FROM listings l
    JOIN properties prop ON prop.id = l.property_id
    WHERE l.id = NEW.listing_id;

    -- Determine status message
    CASE NEW.status
      WHEN 'under_review' THEN v_status_message := 'Your application is now being reviewed by the property owner.';
      WHEN 'shortlisted' THEN v_status_message := 'Great news! Your application has been shortlisted.';
      WHEN 'approved' THEN v_status_message := 'Congratulations! Your application has been approved.';
      WHEN 'rejected' THEN v_status_message := NEW.rejection_reason;
      WHEN 'withdrawn' THEN v_status_message := 'Your application has been withdrawn.';
      ELSE v_status_message := NULL;
    END CASE;

    -- Queue the notification
    INSERT INTO email_notifications (
      notification_type,
      recipient_email,
      recipient_name,
      template_data
    ) VALUES (
      'application_status_update',
      v_tenant_email,
      v_tenant_name,
      jsonb_build_object(
        'tenantName', v_tenant_name,
        'propertyAddress', v_property_address,
        'status', NEW.status,
        'message', v_status_message
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue payment received notification
CREATE OR REPLACE FUNCTION queue_payment_received_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_email TEXT;
  v_owner_name TEXT;
  v_property_address TEXT;
  v_tenant_name TEXT;
  v_amount_formatted TEXT;
BEGIN
  -- Only trigger when payment completes
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Get tenancy and property info
    SELECT
      o.email,
      o.full_name,
      CONCAT(prop.address_line_1, ', ', prop.suburb),
      t.full_name
    INTO v_owner_email, v_owner_name, v_property_address, v_tenant_name
    FROM tenancies ten
    JOIN properties prop ON prop.id = ten.property_id
    JOIN profiles o ON o.id = prop.owner_id
    JOIN profiles t ON t.id = NEW.tenant_id
    WHERE ten.id = NEW.tenancy_id;

    -- Format amount (cents to dollars)
    v_amount_formatted := '$' || (NEW.amount::decimal / 100)::text;

    -- Queue the notification
    INSERT INTO email_notifications (
      notification_type,
      recipient_email,
      recipient_name,
      template_data
    ) VALUES (
      'payment_received',
      v_owner_email,
      v_owner_name,
      jsonb_build_object(
        'ownerName', v_owner_name,
        'propertyAddress', v_property_address,
        'amount', v_amount_formatted,
        'tenantName', v_tenant_name,
        'paymentDate', to_char(NEW.paid_at, 'DD Mon YYYY')
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_application_received ON applications;
CREATE TRIGGER trigger_application_received
  AFTER INSERT OR UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION queue_application_received_notification();

DROP TRIGGER IF EXISTS trigger_application_status_change ON applications;
CREATE TRIGGER trigger_application_status_change
  AFTER UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION queue_application_status_notification();

DROP TRIGGER IF EXISTS trigger_payment_received ON payments;
CREATE TRIGGER trigger_payment_received
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION queue_payment_received_notification();

-- Add comments
COMMENT ON TABLE email_notifications IS 'Queue for email notifications to be processed by Edge Function';
COMMENT ON FUNCTION queue_application_received_notification() IS 'Queues email to owner when new application is submitted';
COMMENT ON FUNCTION queue_application_status_notification() IS 'Queues email to tenant when application status changes';
COMMENT ON FUNCTION queue_payment_received_notification() IS 'Queues email to owner when payment is completed';
