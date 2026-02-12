-- Mission 14: Expand agent_tasks category CHECK constraint
-- The original constraint (migration 000018) only allowed 6 categories.
-- Heartbeat scanners need: inspections, listings, financial, insurance, communication.

ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_category_check;

ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_category_check
  CHECK (category IN (
    'tenant_finding', 'lease_management', 'rent_collection',
    'maintenance', 'compliance', 'general',
    'inspections', 'listings', 'financial', 'insurance', 'communication'
  ));
