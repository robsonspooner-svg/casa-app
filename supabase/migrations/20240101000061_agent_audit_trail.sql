-- Mission 18: Agent Audit Trail Enhancement
-- The core audit_log table with agent columns was created in 20240101000052_security_audit.sql.
-- This migration adds the service-role INSERT policy for backend audit logging
-- and a composite index for user-scoped agent audit queries.

-- Service role policy for agent audit logging (allows Edge Functions to write audit entries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log'
      AND policyname = 'Service role can insert agent audit logs'
  ) THEN
    CREATE POLICY "Service role can insert agent audit logs"
      ON audit_log FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Composite index for user-scoped agent audit queries (user_id + created_at filtered by agent_execution)
CREATE INDEX IF NOT EXISTS idx_audit_log_user_agent
  ON audit_log(user_id, created_at DESC)
  WHERE agent_execution = TRUE;

-- Index for agent conversation lookup
CREATE INDEX IF NOT EXISTS idx_audit_log_agent_conversation
  ON audit_log(agent_conversation_id, created_at DESC)
  WHERE agent_conversation_id IS NOT NULL;

-- Index for agent tool usage analytics
CREATE INDEX IF NOT EXISTS idx_audit_log_agent_tool
  ON audit_log(agent_tool_name, created_at DESC)
  WHERE agent_tool_name IS NOT NULL;
