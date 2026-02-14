-- Migration: HIGH severity audit fixes
-- Fixes: tenant tier NULL, missing indexes, template RLS, expired actions cleanup

-- HIGH #5: Set default subscription_tier for tenants (currently NULL)
-- Feature gates default to 'starter' in code, but DB should be consistent
UPDATE profiles SET subscription_tier = 'starter' WHERE role = 'tenant' AND subscription_tier IS NULL;

-- Update handle_new_user to set tier for tenants too
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
    'starter'::subscription_tier,
    CASE
      WHEN COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'owner') = 'owner' THEN 'active'::subscription_status
      ELSE 'active'::subscription_status
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- HIGH #24: Missing index on agent_pending_actions.resolved_by
CREATE INDEX IF NOT EXISTS idx_agent_pending_actions_resolved_by
  ON agent_pending_actions(resolved_by);

-- HIGH #26: Missing index on tenancy_documents.uploaded_by
CREATE INDEX IF NOT EXISTS idx_tenancy_documents_uploaded_by
  ON tenancy_documents(uploaded_by);

-- HIGH #27: Tighten RLS on template tables - restrict to owners only
-- folder_templates: Only owners should see/use these
DROP POLICY IF EXISTS "Authenticated users can view folder templates" ON folder_templates;
CREATE POLICY "Owners can view folder templates"
  ON folder_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- lease_templates: Only owners should see/use these
DROP POLICY IF EXISTS "Authenticated users can view lease templates" ON lease_templates;
CREATE POLICY "Owners can view lease templates"
  ON lease_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- HIGH #29: Expired pending actions cleanup
-- Create a function to clean up expired pending actions
CREATE OR REPLACE FUNCTION cleanup_expired_pending_actions()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH expired AS (
    DELETE FROM agent_pending_actions
    WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
      AND status = 'pending'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM expired;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- HIGH #9: Maintenance status state machine validation
CREATE OR REPLACE FUNCTION validate_maintenance_status_transition()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate if status is actually changing
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  IF NOT (
    (OLD.status = 'submitted' AND NEW.status IN ('acknowledged', 'in_progress', 'cancelled')) OR
    (OLD.status = 'acknowledged' AND NEW.status IN ('in_progress', 'quoted', 'cancelled')) OR
    (OLD.status = 'quoted' AND NEW.status IN ('approved', 'in_progress', 'cancelled')) OR
    (OLD.status = 'approved' AND NEW.status IN ('in_progress', 'scheduled', 'cancelled')) OR
    (OLD.status = 'scheduled' AND NEW.status IN ('in_progress', 'cancelled')) OR
    (OLD.status = 'in_progress' AND NEW.status IN ('completed', 'on_hold', 'cancelled')) OR
    (OLD.status = 'on_hold' AND NEW.status IN ('in_progress', 'cancelled')) OR
    (OLD.status = 'completed' AND NEW.status = 'reopened') OR
    (OLD.status = 'reopened' AND NEW.status IN ('in_progress', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- HIGH #27: Webhook event deduplication table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
-- Auto-cleanup old events after 7 days
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Only create the trigger if maintenance_requests table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maintenance_requests') THEN
    DROP TRIGGER IF EXISTS validate_maintenance_status ON maintenance_requests;
    CREATE TRIGGER validate_maintenance_status
      BEFORE UPDATE OF status ON maintenance_requests
      FOR EACH ROW
      EXECUTE FUNCTION validate_maintenance_status_transition();
  END IF;
END
$$;
