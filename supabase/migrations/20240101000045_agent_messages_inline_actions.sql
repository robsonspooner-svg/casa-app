-- Mission 15: Add inline_actions column to agent_messages
-- This column stores navigation/approval actions attached to agent responses
-- (e.g. "View Document", "Approve Action") so they persist across reloads.

ALTER TABLE agent_messages
  ADD COLUMN IF NOT EXISTS inline_actions JSONB;
