-- Mission 19: Agent Performance Indexes
-- Optimizes common query patterns for agent-related tables

-- Agent decisions: fast recent lookup by user
CREATE INDEX IF NOT EXISTS idx_agent_decisions_user_recent
  ON agent_decisions(user_id, created_at DESC);

-- Messages: fast lookup for conversation context
CREATE INDEX IF NOT EXISTS idx_agent_messages_created
  ON agent_messages(conversation_id, created_at ASC);
