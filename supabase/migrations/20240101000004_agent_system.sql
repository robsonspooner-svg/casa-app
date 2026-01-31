-- =====================================================
-- AGENT SYSTEM: 9 Tables + pgvector
-- Deployed at Mission 03 as infrastructure foundation.
-- Used progressively from Mission 04 onwards.
-- Full conversation UI at Mission 14.
-- =====================================================

-- Enable pgvector extension for precedent search
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. AGENT CONVERSATIONS
-- Chat sessions with context summaries
-- =====================================================
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  title TEXT,
  context_summary TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. AGENT MESSAGES
-- Messages with tool calls/results and feedback
-- =====================================================
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  feedback TEXT CHECK (feedback IN ('positive', 'negative', 'correction')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. AGENT DECISIONS
-- Audit trail + pgvector embedding for precedent search
-- =====================================================
CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB,
  reasoning TEXT,
  confidence DECIMAL(3,2),
  autonomy_level INTEGER NOT NULL DEFAULT 1,
  owner_feedback TEXT CHECK (owner_feedback IN ('approved', 'rejected', 'corrected')),
  owner_correction TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. AGENT TRAJECTORIES
-- Recorded execution paths (tool sequences + outcomes)
-- =====================================================
CREATE TABLE agent_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  tool_sequence JSONB NOT NULL,
  total_duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  efficiency_score DECIMAL(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 5. AGENT RULES
-- Learned constraints (from corrections or explicit)
-- =====================================================
CREATE TABLE agent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  rule_text TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  source TEXT NOT NULL CHECK (source IN ('correction_pattern', 'explicit', 'inferred')),
  correction_ids UUID[] DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 6. AGENT CORRECTIONS
-- Owner corrections (input for rule generation)
-- =====================================================
CREATE TABLE agent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES agent_decisions(id) ON DELETE SET NULL,
  original_action TEXT NOT NULL,
  correction TEXT NOT NULL,
  context_snapshot JSONB NOT NULL,
  pattern_matched BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 7. AGENT PREFERENCES
-- Owner settings + inferred preferences
-- =====================================================
CREATE TABLE agent_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('explicit', 'inferred', 'default')),
  confidence DECIMAL(3,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, property_id, category, preference_key)
);

-- =====================================================
-- 8. AGENT PENDING ACTIONS
-- Actions awaiting approval with preview data
-- =====================================================
CREATE TABLE agent_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  preview_data JSONB,
  tool_name TEXT NOT NULL,
  tool_params JSONB NOT NULL,
  autonomy_level INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 9. AGENT BACKGROUND TASKS
-- Scheduled/triggered tasks with progress tracking
-- =====================================================
CREATE TABLE agent_background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron', 'webhook', 'event')),
  schedule TEXT,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  result_data JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Conversations
CREATE INDEX idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_property ON agent_conversations(property_id);
CREATE INDEX idx_agent_conversations_status ON agent_conversations(status, updated_at DESC);

-- Messages
CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id, created_at);

-- Decisions
CREATE INDEX idx_agent_decisions_user ON agent_decisions(user_id, created_at DESC);
CREATE INDEX idx_agent_decisions_property ON agent_decisions(property_id);
CREATE INDEX idx_agent_decisions_tool ON agent_decisions(tool_name);
-- pgvector index for precedent search (IVFFlat for performance)
CREATE INDEX idx_agent_decisions_embedding ON agent_decisions
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Trajectories
CREATE INDEX idx_agent_trajectories_user ON agent_trajectories(user_id, created_at DESC);
CREATE INDEX idx_agent_trajectories_success ON agent_trajectories(success, efficiency_score);

-- Rules
CREATE INDEX idx_agent_rules_user ON agent_rules(user_id, active);
CREATE INDEX idx_agent_rules_category ON agent_rules(category) WHERE active = true;

-- Corrections
CREATE INDEX idx_agent_corrections_user ON agent_corrections(user_id, created_at DESC);
CREATE INDEX idx_agent_corrections_pattern ON agent_corrections(pattern_matched)
  WHERE pattern_matched = false;

-- Preferences
CREATE INDEX idx_agent_preferences_user ON agent_preferences(user_id);
CREATE INDEX idx_agent_preferences_property ON agent_preferences(property_id);

-- Pending Actions
CREATE INDEX idx_agent_pending_actions_user ON agent_pending_actions(user_id, status);
CREATE INDEX idx_agent_pending_actions_pending ON agent_pending_actions(status, expires_at)
  WHERE status = 'pending';

-- Background Tasks
CREATE INDEX idx_agent_background_tasks_user ON agent_background_tasks(user_id, status);
CREATE INDEX idx_agent_background_tasks_next ON agent_background_tasks(next_run_at, status)
  WHERE status = 'active';

-- =====================================================
-- ROW LEVEL SECURITY
-- All tables: auth.uid() = user_id
-- Worker uses service-role key with app-level ownership checks
-- =====================================================

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_background_tasks ENABLE ROW LEVEL SECURITY;

-- Conversations: users access only their own
CREATE POLICY "Users manage own conversations"
  ON agent_conversations FOR ALL
  USING (auth.uid() = user_id);

-- Messages: users access messages in their conversations
CREATE POLICY "Users access own conversation messages"
  ON agent_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE agent_conversations.id = agent_messages.conversation_id
      AND agent_conversations.user_id = auth.uid()
    )
  );

-- Decisions: users access only their own
CREATE POLICY "Users access own decisions"
  ON agent_decisions FOR ALL
  USING (auth.uid() = user_id);

-- Trajectories: users access only their own
CREATE POLICY "Users access own trajectories"
  ON agent_trajectories FOR ALL
  USING (auth.uid() = user_id);

-- Rules: users manage only their own
CREATE POLICY "Users manage own rules"
  ON agent_rules FOR ALL
  USING (auth.uid() = user_id);

-- Corrections: users access only their own
CREATE POLICY "Users access own corrections"
  ON agent_corrections FOR ALL
  USING (auth.uid() = user_id);

-- Preferences: users manage only their own
CREATE POLICY "Users manage own preferences"
  ON agent_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Pending Actions: users manage only their own
CREATE POLICY "Users manage own pending actions"
  ON agent_pending_actions FOR ALL
  USING (auth.uid() = user_id);

-- Background Tasks: users access only their own
CREATE POLICY "Users access own background tasks"
  ON agent_background_tasks FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER agent_conversations_updated_at
  BEFORE UPDATE ON agent_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agent_rules_updated_at
  BEFORE UPDATE ON agent_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agent_preferences_updated_at
  BEFORE UPDATE ON agent_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agent_background_tasks_updated_at
  BEFORE UPDATE ON agent_background_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- DEFAULT PREFERENCES ON PROPERTY CREATION
-- When a property is created, seed default agent preferences
-- =====================================================
CREATE OR REPLACE FUNCTION seed_agent_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-approve threshold
  INSERT INTO agent_preferences (user_id, property_id, category, preference_key, preference_value, source)
  VALUES (NEW.owner_id, NEW.id, 'maintenance', 'auto_approve_threshold', '200'::jsonb, 'default')
  ON CONFLICT (user_id, property_id, category, preference_key) DO NOTHING;

  -- Inspection frequency
  INSERT INTO agent_preferences (user_id, property_id, category, preference_key, preference_value, source)
  VALUES (NEW.owner_id, NEW.id, 'inspection', 'frequency_months', '3'::jsonb, 'default')
  ON CONFLICT (user_id, property_id, category, preference_key) DO NOTHING;

  -- Rent reminder days before
  INSERT INTO agent_preferences (user_id, property_id, category, preference_key, preference_value, source)
  VALUES (NEW.owner_id, NEW.id, 'financial', 'rent_reminder_days_before', '3'::jsonb, 'default')
  ON CONFLICT (user_id, property_id, category, preference_key) DO NOTHING;

  -- Auto-send receipts
  INSERT INTO agent_preferences (user_id, property_id, category, preference_key, preference_value, source)
  VALUES (NEW.owner_id, NEW.id, 'financial', 'auto_send_receipts', 'true'::jsonb, 'default')
  ON CONFLICT (user_id, property_id, category, preference_key) DO NOTHING;

  -- Preferred communication channel
  INSERT INTO agent_preferences (user_id, property_id, category, preference_key, preference_value, source)
  VALUES (NEW.owner_id, NEW.id, 'communication', 'preferred_channel', '"in_app"'::jsonb, 'default')
  ON CONFLICT (user_id, property_id, category, preference_key) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER property_seed_agent_preferences
  AFTER INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION seed_agent_preferences();
