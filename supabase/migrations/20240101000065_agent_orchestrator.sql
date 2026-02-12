-- =====================================================
-- AGENT ORCHESTRATOR: Events, Workflows, Event Queue
-- Infrastructure for the intelligent agent orchestrator
-- that manages autonomous property management decisions.
--
-- Tables:
--   1. agent_events       - Audit trail for every autonomous decision
--   2. agent_workflows    - Multi-step workflow tracking
--   3. agent_event_queue  - Instant event processing queue
--
-- Triggers:
--   - payment completed    -> agent_event_queue
--   - maintenance submitted -> agent_event_queue
--   - tenancy created      -> agent_event_queue
--   - inspection finalized -> agent_event_queue
-- =====================================================


-- =====================================================
-- 1. AGENT EVENTS
-- Every autonomous decision is logged for audit trail,
-- learning, and compliance.
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  event_source TEXT NOT NULL,       -- 'heartbeat_daily', 'heartbeat_weekly', 'trigger_payment', 'trigger_maintenance', 'trigger_tenancy', 'trigger_inspection'
  event_type TEXT NOT NULL,         -- 'property_review', 'action_taken', 'notification_sent', 'workflow_advanced'
  model_used TEXT,                  -- 'claude-3-5-haiku-20241022', 'claude-sonnet-4-20250514'
  context_snapshot JSONB,           -- Property state at time of decision
  reasoning TEXT,                   -- Claude's reasoning for the decision
  tools_called JSONB,              -- [{tool, input, result}]
  autonomy_level INT,
  confidence DECIMAL(3,2),
  outcome TEXT DEFAULT 'pending',   -- 'success', 'pending', 'failed', 'owner_override'
  tokens_used INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_events_user_id ON agent_events(user_id);
CREATE INDEX idx_agent_events_property_id ON agent_events(property_id);
CREATE INDEX idx_agent_events_source ON agent_events(event_source);
CREATE INDEX idx_agent_events_created ON agent_events(created_at DESC);


-- =====================================================
-- 2. AGENT WORKFLOWS
-- Multi-step workflow tracking: lease renewal, arrears
-- escalation, maintenance lifecycle, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,
  workflow_type TEXT NOT NULL,       -- 'lease_renewal', 'arrears_escalation', 'maintenance_lifecycle', 'tenant_onboarding', 'tenant_exit', 'inspection_lifecycle', 'compliance_renewal', 'listing_lifecycle'
  current_step INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{step_number, name, status, started_at, completed_at, result, next_action_at}]
  status TEXT DEFAULT 'active',     -- 'active', 'completed', 'paused', 'cancelled', 'failed'
  next_action_at TIMESTAMPTZ,       -- When orchestrator should check this workflow next
  metadata JSONB DEFAULT '{}'::jsonb,  -- Workflow-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_workflows_user_id ON agent_workflows(user_id);
CREATE INDEX idx_agent_workflows_status ON agent_workflows(status) WHERE status = 'active';
CREATE INDEX idx_agent_workflows_next_action ON agent_workflows(next_action_at) WHERE status = 'active';
CREATE INDEX idx_agent_workflows_type ON agent_workflows(workflow_type);


-- =====================================================
-- 3. AGENT EVENT QUEUE
-- For instant event processing (DB trigger -> queue -> orchestrator).
-- Edge Functions poll this queue and process events.
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,          -- 'payment_completed', 'maintenance_submitted', 'tenancy_created', 'inspection_finalized'
  priority TEXT DEFAULT 'normal',    -- 'instant', 'normal', 'low'
  payload JSONB NOT NULL,            -- Event-specific data
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_event_queue_unprocessed ON agent_event_queue(created_at) WHERE processed = FALSE;
CREATE INDEX idx_agent_event_queue_priority ON agent_event_queue(priority, created_at) WHERE processed = FALSE;


-- =====================================================
-- 4. DB TRIGGER FUNCTIONS FOR INSTANT EVENTS
-- These insert into agent_event_queue when key events
-- happen in the system.
-- =====================================================

-- -------------------------------------------------
-- 4a. Payment completed trigger
-- Fires when a payment status transitions to 'completed'.
-- The payments table uses payment_status enum where
-- 'completed' represents a successful payment.
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_agent_payment_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
    SELECT
      'payment_completed', 'instant',
      jsonb_build_object(
        'payment_id', NEW.id,
        'tenancy_id', NEW.tenancy_id,
        'amount', NEW.amount,
        'payment_type', NEW.payment_type,
        'paid_at', NEW.paid_at
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


-- -------------------------------------------------
-- 4b. Maintenance submitted trigger
-- Fires when a new maintenance request is created.
-- Emergency requests get 'instant' priority.
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_agent_maintenance_submitted()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
    SELECT
      'maintenance_submitted',
      CASE WHEN NEW.urgency = 'emergency' THEN 'instant' ELSE 'normal' END,
      jsonb_build_object(
        'request_id', NEW.id,
        'property_id', NEW.property_id,
        'tenancy_id', NEW.tenancy_id,
        'tenant_id', NEW.tenant_id,
        'title', NEW.title,
        'urgency', NEW.urgency,
        'category', NEW.category,
        'description', NEW.description
      ),
      p.owner_id,
      NEW.property_id
    FROM properties p
    WHERE p.id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------
-- 4c. Tenancy created trigger
-- Fires when a new tenancy is created, allowing the
-- orchestrator to kick off onboarding workflows.
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_agent_tenancy_created()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
    SELECT
      'tenancy_created', 'normal',
      jsonb_build_object(
        'tenancy_id', NEW.id,
        'property_id', NEW.property_id,
        'lease_start_date', NEW.lease_start_date,
        'lease_end_date', NEW.lease_end_date,
        'rent_amount', NEW.rent_amount,
        'rent_frequency', NEW.rent_frequency,
        'status', NEW.status
      ),
      p.owner_id,
      NEW.property_id
    FROM properties p
    WHERE p.id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------
-- 4d. Inspection finalized trigger
-- Fires when an inspection is marked as finalized,
-- allowing the orchestrator to generate reports and
-- track follow-up actions.
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_agent_inspection_finalized()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finalized' AND (OLD.status IS NULL OR OLD.status != 'finalized') THEN
    INSERT INTO agent_event_queue (event_type, priority, payload, user_id, property_id)
    SELECT
      'inspection_finalized', 'normal',
      jsonb_build_object(
        'inspection_id', NEW.id,
        'property_id', NEW.property_id,
        'tenancy_id', NEW.tenancy_id,
        'inspection_type', NEW.inspection_type,
        'overall_condition', NEW.overall_condition,
        'completed_at', NEW.completed_at
      ),
      p.owner_id,
      NEW.property_id
    FROM properties p
    WHERE p.id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 5. CREATE THE TRIGGERS
-- Apply trigger functions to the relevant tables.
-- Uses DROP IF EXISTS to be idempotent.
-- =====================================================

-- Payment completed -> queue
DROP TRIGGER IF EXISTS trg_agent_payment_completed ON payments;
CREATE TRIGGER trg_agent_payment_completed
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_payment_completed();

-- Maintenance submitted -> queue
DROP TRIGGER IF EXISTS trg_agent_maintenance_submitted ON maintenance_requests;
CREATE TRIGGER trg_agent_maintenance_submitted
  AFTER INSERT ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_maintenance_submitted();

-- Tenancy created -> queue
DROP TRIGGER IF EXISTS trg_agent_tenancy_created ON tenancies;
CREATE TRIGGER trg_agent_tenancy_created
  AFTER INSERT ON tenancies
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_tenancy_created();

-- Inspection finalized -> queue
DROP TRIGGER IF EXISTS trg_agent_inspection_finalized ON inspections;
CREATE TRIGGER trg_agent_inspection_finalized
  AFTER INSERT OR UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION trigger_agent_inspection_finalized();


-- =====================================================
-- 6. ROW LEVEL SECURITY
-- agent_events and agent_workflows: users can read
-- their own; service role has full access for the
-- orchestrator Edge Functions.
-- agent_event_queue: service role only (internal).
-- =====================================================

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_event_queue ENABLE ROW LEVEL SECURITY;

-- Users can read their own agent events
CREATE POLICY agent_events_select ON agent_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role has full access to agent events (orchestrator writes)
CREATE POLICY agent_events_service ON agent_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users can read their own workflows
CREATE POLICY agent_workflows_select ON agent_workflows
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role has full access to workflows (orchestrator manages)
CREATE POLICY agent_workflows_service ON agent_workflows
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Event queue is only accessible by service role (internal processing)
CREATE POLICY agent_event_queue_service ON agent_event_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- =====================================================
-- 7. UPDATED TIMESTAMP TRIGGER FOR WORKFLOWS
-- Automatically maintains updated_at on agent_workflows.
-- =====================================================

CREATE OR REPLACE FUNCTION update_agent_workflow_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_workflow_updated ON agent_workflows;
CREATE TRIGGER trg_agent_workflow_updated
  BEFORE UPDATE ON agent_workflows
  FOR EACH ROW EXECUTE FUNCTION update_agent_workflow_timestamp();
