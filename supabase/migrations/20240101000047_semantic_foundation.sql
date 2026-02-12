-- Semantic Foundation: Embeddings, Outcome Tracking, Data Lifecycle
-- Enables true semantic search, auto-memory, rule conflict detection
-- Part of 10/10 Agent Intelligence improvements

-- =====================================================
-- 1A. ALTER embedding column from 1536-dim to 384-dim (Supabase gte-small)
-- =====================================================

-- Drop the existing IVFFlat index (requires specific dimension)
DROP INDEX IF EXISTS idx_agent_decisions_embedding;

-- Alter the embedding column to 384 dimensions
-- NOTE: Any existing 1536-dim data will be dropped (column was never populated)
ALTER TABLE agent_decisions DROP COLUMN IF EXISTS embedding;
ALTER TABLE agent_decisions ADD COLUMN embedding vector(384);

-- Recreate the IVFFlat index for 384-dim vectors
CREATE INDEX idx_agent_decisions_embedding ON agent_decisions
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =====================================================
-- 1B. Add embedding columns to agent_rules and agent_preferences
-- =====================================================

ALTER TABLE agent_rules ADD COLUMN IF NOT EXISTS embedding vector(384);
ALTER TABLE agent_preferences ADD COLUMN IF NOT EXISTS embedding vector(384);
ALTER TABLE agent_corrections ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Indexes for similarity search on rules and preferences
CREATE INDEX IF NOT EXISTS idx_agent_rules_embedding ON agent_rules
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_agent_preferences_embedding ON agent_preferences
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_agent_corrections_embedding ON agent_corrections
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- =====================================================
-- 1C. Update search_similar_decisions() to use vector(384)
-- =====================================================

CREATE OR REPLACE FUNCTION search_similar_decisions(
  query_embedding vector(384),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  decision_type TEXT,
  tool_name TEXT,
  input_data JSONB,
  output_data JSONB,
  reasoning TEXT,
  owner_feedback TEXT,
  owner_correction TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id,
    ad.decision_type,
    ad.tool_name,
    ad.input_data,
    ad.output_data,
    ad.reasoning,
    ad.owner_feedback,
    ad.owner_correction,
    (1 - (ad.embedding <=> query_embedding))::FLOAT AS similarity,
    ad.created_at
  FROM agent_decisions ad
  WHERE ad.user_id = match_user_id
    AND ad.owner_feedback IS NOT NULL
    AND ad.embedding IS NOT NULL
    AND 1 - (ad.embedding <=> query_embedding) > match_threshold
  ORDER BY ad.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- 1D. Semantic search function for rules
-- =====================================================

CREATE OR REPLACE FUNCTION search_similar_rules(
  query_embedding vector(384),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  rule_text TEXT,
  category TEXT,
  confidence DECIMAL,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.rule_text,
    ar.category,
    ar.confidence,
    ar.source,
    (1 - (ar.embedding <=> query_embedding))::FLOAT AS similarity
  FROM agent_rules ar
  WHERE ar.user_id = match_user_id
    AND ar.active = true
    AND ar.embedding IS NOT NULL
    AND 1 - (ar.embedding <=> query_embedding) > match_threshold
  ORDER BY ar.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- 1E. Semantic search function for preferences
-- =====================================================

CREATE OR REPLACE FUNCTION search_similar_preferences(
  query_embedding vector(384),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  preference_key TEXT,
  preference_value JSONB,
  source TEXT,
  confidence DECIMAL,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ap.id,
    ap.category,
    ap.preference_key,
    ap.preference_value,
    ap.source,
    ap.confidence,
    (1 - (ap.embedding <=> query_embedding))::FLOAT AS similarity
  FROM agent_preferences ap
  WHERE ap.user_id = match_user_id
    AND ap.embedding IS NOT NULL
    AND 1 - (ap.embedding <=> query_embedding) > match_threshold
  ORDER BY ap.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- 2. OUTCOME TRACKING TABLE
-- Records downstream results of agent decisions
-- =====================================================

CREATE TABLE agent_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES agent_decisions(id) ON DELETE SET NULL,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  tool_name TEXT,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('success', 'partial', 'failure', 'timeout', 'user_override')),
  outcome_details JSONB,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_outcomes_decision ON agent_outcomes(decision_id);
CREATE INDEX idx_agent_outcomes_user ON agent_outcomes(user_id, created_at DESC);
CREATE INDEX idx_agent_outcomes_tool ON agent_outcomes(user_id, tool_name, outcome_type);

ALTER TABLE agent_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own outcomes"
  ON agent_outcomes FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to agent_outcomes"
  ON agent_outcomes FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 3. TEMPORAL DECAY FUNCTION FOR RULES
-- Called by heartbeat to decay stale rule confidence
-- =====================================================

CREATE OR REPLACE FUNCTION decay_stale_rules(
  p_user_id UUID,
  p_days_threshold INTEGER DEFAULT 30,
  p_decay_amount DECIMAL DEFAULT 0.02
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- Reduce confidence for rules not applied recently
  WITH stale_rules AS (
    SELECT id, confidence
    FROM agent_rules
    WHERE user_id = p_user_id
      AND active = true
      AND updated_at < NOW() - (p_days_threshold || ' days')::interval
  )
  UPDATE agent_rules ar
  SET
    confidence = GREATEST(0, sr.confidence - p_decay_amount),
    active = CASE WHEN sr.confidence - p_decay_amount < 0.3 THEN false ELSE true END,
    updated_at = NOW()
  FROM stale_rules sr
  WHERE ar.id = sr.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- =====================================================
-- 4. DATA LIFECYCLE CLEANUP FUNCTION
-- Called by heartbeat once per day to prune old data
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_learning_data(p_retention_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_trajectories_deleted INTEGER := 0;
  v_decisions_deleted INTEGER := 0;
  v_outcomes_deleted INTEGER := 0;
  v_rules_deactivated INTEGER := 0;
  v_genome_reset INTEGER := 0;
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := NOW() - (p_retention_days || ' days')::interval;

  -- 1. Delete non-golden trajectories older than retention period
  DELETE FROM agent_trajectories
  WHERE created_at < v_cutoff
    AND (is_golden IS NULL OR is_golden = false);
  GET DIAGNOSTICS v_trajectories_deleted = ROW_COUNT;

  -- 2. Delete old decisions without feedback and without embeddings
  DELETE FROM agent_decisions
  WHERE created_at < v_cutoff
    AND owner_feedback IS NULL
    AND embedding IS NULL;
  GET DIAGNOSTICS v_decisions_deleted = ROW_COUNT;

  -- 3. Delete old outcomes (longer retention: 2x)
  DELETE FROM agent_outcomes
  WHERE created_at < NOW() - (p_retention_days * 2 || ' days')::interval;
  GET DIAGNOSTICS v_outcomes_deleted = ROW_COUNT;

  -- 4. Deactivate rules with very low confidence
  UPDATE agent_rules
  SET active = false, updated_at = NOW()
  WHERE active = true AND confidence < 0.2;
  GET DIAGNOSTICS v_rules_deactivated = ROW_COUNT;

  -- 5. Reset tool genome EMA for tools not executed recently
  UPDATE tool_genome
  SET success_rate_ema = 0.9, updated_at = NOW()
  WHERE updated_at < NOW() - (p_retention_days || ' days')::interval;
  GET DIAGNOSTICS v_genome_reset = ROW_COUNT;

  RETURN jsonb_build_object(
    'trajectories_deleted', v_trajectories_deleted,
    'decisions_deleted', v_decisions_deleted,
    'outcomes_deleted', v_outcomes_deleted,
    'rules_deactivated', v_rules_deactivated,
    'genome_reset', v_genome_reset,
    'cutoff_date', v_cutoff
  );
END;
$$;

-- =====================================================
-- 5. Add was_auto_executed column to agent_decisions if missing
-- Used for outcome tracking correlation
-- =====================================================

ALTER TABLE agent_decisions
  ADD COLUMN IF NOT EXISTS was_auto_executed BOOLEAN DEFAULT false;
