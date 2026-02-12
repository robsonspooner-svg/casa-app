-- UAP Critical Subset: Learning Engine Enhancement
-- Adds: tool genome tracking, error classification, trajectory optimization, confidence calibration
-- Part of Mission 15 learning engine improvements

-- =====================================================
-- 1A. TOOL GENOME TABLE
-- Per-user per-tool performance metrics with EMA tracking
-- =====================================================

CREATE TABLE tool_genome (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  -- Exponential Moving Average stats
  success_rate_ema DECIMAL(5,4) NOT NULL DEFAULT 0.9000,
  avg_duration_ms DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_executions INTEGER NOT NULL DEFAULT 0,
  total_successes INTEGER NOT NULL DEFAULT 0,
  total_failures INTEGER NOT NULL DEFAULT 0,
  -- Failure pattern tracking: { "error_pattern": count }
  failure_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Parameter insights: { "success_params": [...], "failure_params": [...] }
  parameter_insights JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Co-occurrence: { "tool_name": { "count": N, "successes": N } }
  co_occurrence JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Last error info
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tool_name)
);

CREATE INDEX idx_tool_genome_user ON tool_genome(user_id);
CREATE INDEX idx_tool_genome_success ON tool_genome(user_id, success_rate_ema);

ALTER TABLE tool_genome ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own tool genome"
  ON tool_genome FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to tool_genome"
  ON tool_genome FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 1B. ERROR CLASSIFICATION ON agent_decisions
-- =====================================================

ALTER TABLE agent_decisions
  ADD COLUMN IF NOT EXISTS error_type TEXT
    CHECK (error_type IN ('FACTUAL_ERROR', 'REASONING_ERROR', 'TOOL_MISUSE', 'CONTEXT_MISSING'));

ALTER TABLE agent_decisions
  ADD COLUMN IF NOT EXISTS error_details JSONB;

ALTER TABLE agent_decisions
  ADD COLUMN IF NOT EXISTS confidence_factors JSONB;

-- =====================================================
-- 1C. ERROR TYPE ON agent_corrections
-- =====================================================

ALTER TABLE agent_corrections
  ADD COLUMN IF NOT EXISTS error_type TEXT
    CHECK (error_type IN ('FACTUAL_ERROR', 'REASONING_ERROR', 'TOOL_MISUSE', 'CONTEXT_MISSING'));

-- =====================================================
-- 1D. TRAJECTORY ENHANCEMENT COLUMNS
-- =====================================================

ALTER TABLE agent_trajectories
  ADD COLUMN IF NOT EXISTS intent_hash TEXT;

ALTER TABLE agent_trajectories
  ADD COLUMN IF NOT EXISTS intent_label TEXT;

ALTER TABLE agent_trajectories
  ADD COLUMN IF NOT EXISTS is_golden BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE agent_trajectories
  ADD COLUMN IF NOT EXISTS tool_count INTEGER;

CREATE INDEX idx_trajectories_intent
  ON agent_trajectories(user_id, intent_hash)
  WHERE success = true;

CREATE INDEX idx_trajectories_golden
  ON agent_trajectories(user_id, is_golden)
  WHERE is_golden = true;

-- =====================================================
-- 1E. FIX agent_rules SOURCE CONSTRAINT
-- Allow 'correction' and 'error_classification' as valid sources
-- =====================================================

ALTER TABLE agent_rules DROP CONSTRAINT IF EXISTS agent_rules_source_check;
ALTER TABLE agent_rules ADD CONSTRAINT agent_rules_source_check
  CHECK (source IN ('correction_pattern', 'explicit', 'inferred', 'correction', 'error_classification'));

-- Also fix agent_preferences source constraint to allow 'learned' (used by error classification learning)
ALTER TABLE agent_preferences DROP CONSTRAINT IF EXISTS agent_preferences_source_check;
ALTER TABLE agent_preferences ADD CONSTRAINT agent_preferences_source_check
  CHECK (source IN ('explicit', 'inferred', 'default', 'learned'));

-- =====================================================
-- 1F. REFRESH TOOL GENOME SQL FUNCTION
-- Called by agent-heartbeat to aggregate decision data into genome
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_tool_genome(p_user_id UUID, p_window_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_tool RECORD;
  v_updated INTEGER := 0;
  v_ema_alpha DECIMAL := 0.1;
BEGIN
  FOR v_tool IN
    SELECT
      tool_name,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE
        output_data IS NOT NULL
        AND output_data ? 'success'
        AND (output_data->>'success')::boolean = true
      ) as successes,
      AVG(duration_ms) FILTER (WHERE duration_ms > 0) as avg_dur
    FROM agent_decisions
    WHERE user_id = p_user_id
      AND created_at > NOW() - (p_window_days || ' days')::interval
      AND decision_type = 'tool_execution'
    GROUP BY tool_name
  LOOP
    INSERT INTO tool_genome (user_id, tool_name, total_executions, total_successes, total_failures,
                             avg_duration_ms, success_rate_ema)
    VALUES (
      p_user_id,
      v_tool.tool_name,
      v_tool.total,
      v_tool.successes,
      v_tool.total - v_tool.successes,
      COALESCE(v_tool.avg_dur, 0),
      CASE WHEN v_tool.total > 0 THEN v_tool.successes::decimal / v_tool.total ELSE 0.9 END
    )
    ON CONFLICT (user_id, tool_name) DO UPDATE SET
      total_executions = EXCLUDED.total_executions,
      total_successes = EXCLUDED.total_successes,
      total_failures = EXCLUDED.total_failures,
      avg_duration_ms = COALESCE(EXCLUDED.avg_duration_ms, tool_genome.avg_duration_ms),
      success_rate_ema = tool_genome.success_rate_ema * (1 - v_ema_alpha) +
                         EXCLUDED.success_rate_ema * v_ema_alpha,
      updated_at = NOW();

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;
