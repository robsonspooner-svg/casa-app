-- =====================================================
-- AGENT ENHANCEMENTS: Tasks, Autonomy Settings, Proactive Actions
-- Extends the agent infrastructure from Mission 03 (migration 000004)
-- with Mission 14 requirements for proactive autonomous management.
-- =====================================================

-- =====================================================
-- 1. AGENT TASKS — Rich decision surface for Tasks tab
-- Timeline-driven task cards with reasoning and actions
-- =====================================================
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'tenant_finding', 'lease_management', 'rent_collection',
    'maintenance', 'compliance', 'general'
  )),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
    'pending_input', 'in_progress', 'scheduled', 'paused', 'completed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  deep_link TEXT,
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timeline entry format (stored in agent_tasks.timeline JSONB):
-- {
--   "timestamp": "2024-01-28T10:30:00Z",
--   "action": "Created listing draft ($650/wk, 3BR)",
--   "status": "completed",  -- 'completed', 'current', 'pending'
--   "tool_name": "create_listing",
--   "reasoning": "Property has 3BR, 2BA in Bondi. Comparable rents are $620-$680/wk.",
--   "data": { ... }
-- }

CREATE INDEX idx_agent_tasks_user_status ON agent_tasks(user_id, status);
CREATE INDEX idx_agent_tasks_pending ON agent_tasks(user_id) WHERE status = 'pending_input';
CREATE INDEX idx_agent_tasks_scheduled ON agent_tasks(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON agent_tasks FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 2. AGENT AUTONOMY SETTINGS — User-adjustable threshold
-- Preset selector + per-category overrides
-- =====================================================
CREATE TABLE agent_autonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  preset TEXT NOT NULL DEFAULT 'balanced' CHECK (preset IN ('cautious', 'balanced', 'hands_off', 'custom')),
  category_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- category_overrides format:
  -- {
  --   "messages": "L3",
  --   "financial": "L1",
  --   "legal": "L0",
  --   "maintenance": "L2",
  --   "listings": "L2",
  --   "tenant_finding": "L2"
  -- }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE agent_autonomy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own autonomy settings" ON agent_autonomy_settings FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER agent_autonomy_settings_updated_at
  BEFORE UPDATE ON agent_autonomy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. AGENT PROACTIVE ACTIONS — Heartbeat engine log
-- Records what the agent proactively did or suggested
-- =====================================================
CREATE TABLE agent_proactive_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  trigger_source TEXT,
  action_taken TEXT NOT NULL,
  tool_name TEXT,
  tool_params JSONB,
  result JSONB,
  was_auto_executed BOOLEAN NOT NULL DEFAULT FALSE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_proactive_user ON agent_proactive_actions(user_id, created_at DESC);
CREATE INDEX idx_agent_proactive_trigger ON agent_proactive_actions(trigger_type, created_at DESC);

ALTER TABLE agent_proactive_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own proactive actions" ON agent_proactive_actions FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 4. ALTER EXISTING TABLES — Add new columns for Mission 14
-- =====================================================

-- Add 'proactive' role to agent_messages (for heartbeat-generated messages)
ALTER TABLE agent_messages DROP CONSTRAINT IF EXISTS agent_messages_role_check;
ALTER TABLE agent_messages ADD CONSTRAINT agent_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system', 'proactive'));

-- Add tokens_used and model tracking to conversations
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'claude-sonnet-4-20250514';
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER DEFAULT 0;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add tokens_used to messages
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER;

-- Add task_id reference to pending_actions for linking to tasks
ALTER TABLE agent_pending_actions ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL;

-- Add recommendation and confidence to pending_actions
ALTER TABLE agent_pending_actions ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE agent_pending_actions ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2);

-- Add resolved_by to pending_actions
ALTER TABLE agent_pending_actions ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id);

-- Add task_id to decisions for linking decisions to tasks
ALTER TABLE agent_decisions ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL;
ALTER TABLE agent_decisions ADD COLUMN IF NOT EXISTS was_auto_executed BOOLEAN DEFAULT FALSE;
ALTER TABLE agent_decisions ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Add goal to trajectories
ALTER TABLE agent_trajectories ADD COLUMN IF NOT EXISTS goal TEXT;

-- =====================================================
-- 5. HELPER FUNCTION — Get autonomy level for a category
-- Used by the agent Edge Function to check autonomy
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_autonomy_level(
  p_user_id UUID,
  p_category TEXT
) RETURNS TEXT AS $$
DECLARE
  v_preset TEXT;
  v_overrides JSONB;
  v_level TEXT;
BEGIN
  SELECT preset, category_overrides
  INTO v_preset, v_overrides
  FROM agent_autonomy_settings
  WHERE user_id = p_user_id;

  -- If no settings, default to balanced
  IF NOT FOUND THEN
    v_preset := 'balanced';
    v_overrides := '{}'::jsonb;
  END IF;

  -- Check for category override first
  IF v_overrides ? p_category THEN
    RETURN v_overrides ->> p_category;
  END IF;

  -- Return preset-based defaults
  CASE v_preset
    WHEN 'cautious' THEN
      CASE p_category
        WHEN 'query' THEN RETURN 'L4';
        WHEN 'messages' THEN RETURN 'L1';
        WHEN 'financial' THEN RETURN 'L0';
        WHEN 'legal' THEN RETURN 'L0';
        WHEN 'maintenance' THEN RETURN 'L1';
        WHEN 'listings' THEN RETURN 'L1';
        WHEN 'tenant_finding' THEN RETURN 'L1';
        ELSE RETURN 'L1';
      END CASE;
    WHEN 'balanced' THEN
      CASE p_category
        WHEN 'query' THEN RETURN 'L4';
        WHEN 'messages' THEN RETURN 'L3';
        WHEN 'financial' THEN RETURN 'L1';
        WHEN 'legal' THEN RETURN 'L0';
        WHEN 'maintenance' THEN RETURN 'L2';
        WHEN 'listings' THEN RETURN 'L2';
        WHEN 'tenant_finding' THEN RETURN 'L2';
        ELSE RETURN 'L2';
      END CASE;
    WHEN 'hands_off' THEN
      CASE p_category
        WHEN 'query' THEN RETURN 'L4';
        WHEN 'messages' THEN RETURN 'L4';
        WHEN 'financial' THEN RETURN 'L3';
        WHEN 'legal' THEN RETURN 'L1';
        WHEN 'maintenance' THEN RETURN 'L3';
        WHEN 'listings' THEN RETURN 'L3';
        WHEN 'tenant_finding' THEN RETURN 'L3';
        ELSE RETURN 'L3';
      END CASE;
    WHEN 'custom' THEN
      -- Custom with no override for this category defaults to balanced
      CASE p_category
        WHEN 'query' THEN RETURN 'L4';
        WHEN 'messages' THEN RETURN 'L3';
        WHEN 'financial' THEN RETURN 'L1';
        WHEN 'legal' THEN RETURN 'L0';
        WHEN 'maintenance' THEN RETURN 'L2';
        WHEN 'listings' THEN RETURN 'L2';
        WHEN 'tenant_finding' THEN RETURN 'L2';
        ELSE RETURN 'L2';
      END CASE;
    ELSE
      RETURN 'L2'; -- Safe default
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. SEED DEFAULT AUTONOMY — On profile creation
-- =====================================================
CREATE OR REPLACE FUNCTION seed_autonomy_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_autonomy_settings (user_id, preset)
  VALUES (NEW.id, 'balanced')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER profile_seed_autonomy_settings
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION seed_autonomy_settings();
