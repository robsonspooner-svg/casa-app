-- Fix: maintenance status change trigger needs to bypass RLS
-- The trigger inserts into maintenance_status_history when status changes,
-- but it runs in the calling user's context which has no INSERT policy.
-- Solution: Make the trigger function SECURITY DEFINER to bypass RLS.

CREATE OR REPLACE FUNCTION log_maintenance_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO maintenance_status_history (request_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.status_changed_by);

    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
