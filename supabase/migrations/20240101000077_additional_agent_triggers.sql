-- Additional Agent Event Queue Triggers
-- Expands the orchestrator's event coverage beyond the original 4 triggers
-- (payment_completed, maintenance_submitted, tenancy_created, inspection_finalized)
-- to cover the full property management lifecycle.


-- =====================================================
-- 1. PAYMENT FAILED TRIGGER
-- Fires when a payment status transitions to 'failed'.
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_agent_payment_failed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
    INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
    SELECT
      'payment_failed', 'instant',
      jsonb_build_object(
        'payment_id', NEW.id,
        'tenancy_id', NEW.tenancy_id,
        'amount', NEW.amount,
        'payment_type', NEW.payment_type,
        'failure_reason', COALESCE(NEW.notes, 'unknown')
      ),
      p.owner_id,
      t.property_id
    FROM tenancies t
    JOIN properties p ON p.id = t.property_id
    WHERE t.id = NEW.tenancy_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agent_payment_failed ON payments;
CREATE TRIGGER trg_agent_payment_failed
  AFTER UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_payment_failed();


-- =====================================================
-- 2. MAINTENANCE STATUS CHANGED TRIGGER
-- Fires when a maintenance request status changes,
-- so the orchestrator can follow up on stalled or
-- completed requests.
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_agent_maintenance_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
    SELECT
      'maintenance_status_changed',
      CASE WHEN NEW.urgency = 'emergency' THEN 'instant' ELSE 'normal' END,
      jsonb_build_object(
        'request_id', NEW.id,
        'title', NEW.title,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'urgency', NEW.urgency,
        'category', NEW.category,
        'property_id', NEW.property_id
      ),
      p.owner_id,
      NEW.property_id
    FROM properties p
    WHERE p.id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agent_maintenance_status_changed ON maintenance_requests;
CREATE TRIGGER trg_agent_maintenance_status_changed
  AFTER UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_maintenance_status_changed();


-- =====================================================
-- 3. ARREARS SEVERITY CHANGE TRIGGER
-- Fires when arrears severity changes or days_overdue
-- crosses key thresholds (7, 14, 21, 28 days).
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_agent_arrears_escalation()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_id UUID;
  old_threshold INTEGER;
  new_threshold INTEGER;
BEGIN
  -- Only fire on UPDATE when severity changes or days_overdue crosses a threshold
  IF TG_OP = 'UPDATE' AND NEW.is_resolved = FALSE THEN
    -- Check if severity changed
    IF OLD.severity IS DISTINCT FROM NEW.severity THEN
      SELECT p.owner_id, t.property_id INTO v_owner_id, v_property_id
      FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE t.id = NEW.tenancy_id;

      IF v_owner_id IS NOT NULL THEN
        INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
        VALUES (
          'arrears_escalation', 'instant',
          jsonb_build_object(
            'arrears_id', NEW.id,
            'tenancy_id', NEW.tenancy_id,
            'tenant_id', NEW.tenant_id,
            'total_overdue', NEW.total_overdue,
            'days_overdue', NEW.days_overdue,
            'old_severity', OLD.severity,
            'new_severity', NEW.severity,
            'has_payment_plan', NEW.has_payment_plan
          ),
          v_owner_id,
          v_property_id
        );
      END IF;
    -- Check if days_overdue crossed a threshold (7, 14, 21, 28)
    ELSIF OLD.days_overdue IS DISTINCT FROM NEW.days_overdue THEN
      old_threshold := (OLD.days_overdue / 7) * 7;
      new_threshold := (NEW.days_overdue / 7) * 7;
      IF new_threshold > old_threshold AND new_threshold >= 7 THEN
        SELECT p.owner_id, t.property_id INTO v_owner_id, v_property_id
        FROM tenancies t
        JOIN properties p ON p.id = t.property_id
        WHERE t.id = NEW.tenancy_id;

        IF v_owner_id IS NOT NULL THEN
          INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
          VALUES (
            'arrears_escalation', 'instant',
            jsonb_build_object(
              'arrears_id', NEW.id,
              'tenancy_id', NEW.tenancy_id,
              'tenant_id', NEW.tenant_id,
              'total_overdue', NEW.total_overdue,
              'days_overdue', NEW.days_overdue,
              'severity', NEW.severity,
              'threshold_crossed', new_threshold,
              'has_payment_plan', NEW.has_payment_plan
            ),
            v_owner_id,
            v_property_id
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agent_arrears_escalation ON arrears_records;
CREATE TRIGGER trg_agent_arrears_escalation
  AFTER UPDATE ON arrears_records
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_arrears_escalation();


-- =====================================================
-- 4. APPLICATION RECEIVED TRIGGER
-- Fires when a new application is submitted.
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_agent_application_received()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'submitted' AND OLD.status = 'draft') THEN
    INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
    SELECT
      'application_received', 'normal',
      jsonb_build_object(
        'application_id', NEW.id,
        'listing_id', NEW.listing_id,
        'applicant_name', NEW.full_name,
        'email', NEW.email,
        'move_in_date', NEW.move_in_date,
        'annual_income', NEW.annual_income,
        'employment_type', NEW.employment_type
      ),
      p.owner_id,
      l.property_id
    FROM listings l
    JOIN properties p ON p.id = l.property_id
    WHERE l.id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agent_application_received ON applications;
CREATE TRIGGER trg_agent_application_received
  AFTER INSERT OR UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_application_received();


-- =====================================================
-- 5. DOCUMENT SIGNED TRIGGER
-- Fires when a signature is added to a document.
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_agent_document_signed()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
    SELECT
      'document_signed', 'normal',
      jsonb_build_object(
        'document_id', NEW.document_id,
        'signer_id', NEW.signer_id,
        'signer_role', NEW.signer_role,
        'signer_name', NEW.signer_name,
        'signed_at', NEW.signed_at
      ),
      d.owner_id,
      d.property_id
    FROM documents d
    WHERE d.id = NEW.document_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agent_document_signed ON document_signatures;
CREATE TRIGGER trg_agent_document_signed
  AFTER INSERT ON document_signatures
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_document_signed();
