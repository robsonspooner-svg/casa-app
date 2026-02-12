-- Performance Indexes Migration
-- Adds composite and partial indexes for high-frequency query patterns
-- Each index targets a specific query path used by the agent, dashboard, or API hooks

-- =====================================================
-- 1. PROPERTY & TENANCY QUERY PERFORMANCE
-- Covers: dashboard loading, agent context gathering
-- =====================================================

-- Fast lookup of active properties for a given owner
-- Used by: useProperties hook, agent context, dashboard
CREATE INDEX IF NOT EXISTS idx_properties_owner_active
  ON properties(owner_id) WHERE status = 'active';

-- Fast lookup of active tenancies for a property
-- Used by: useTenancies hook, agent lease management
CREATE INDEX IF NOT EXISTS idx_tenancies_property_active
  ON tenancies(property_id) WHERE status = 'active';

-- =====================================================
-- 2. ARREARS QUERY PERFORMANCE
-- Covers: arrears dashboard, agent proactive monitoring
-- =====================================================

-- Unresolved arrears per tenancy for agent arrears checks
-- Used by: useArrears hook, agent-heartbeat arrears scan
CREATE INDEX IF NOT EXISTS idx_arrears_tenancy_unresolved
  ON arrears_records(tenancy_id) WHERE is_resolved = false;

-- =====================================================
-- 3. MAINTENANCE REQUEST PERFORMANCE
-- Covers: maintenance dashboard, agent triage
-- =====================================================

-- Open maintenance requests per property
-- Used by: useMaintenance hook, agent maintenance triage
CREATE INDEX IF NOT EXISTS idx_maintenance_property_open
  ON maintenance_requests(property_id) WHERE status IN ('submitted', 'acknowledged', 'awaiting_quote', 'approved', 'scheduled', 'in_progress');

-- =====================================================
-- 4. PAYMENT PERFORMANCE
-- Covers: payment history, rent collection tracking
-- =====================================================

-- Composite index for payment lookups by tenancy and status
-- Used by: usePayments hook, agent rent collection monitoring
CREATE INDEX IF NOT EXISTS idx_payments_tenancy_status
  ON payments(tenancy_id, status);

-- =====================================================
-- 5. INSPECTION PERFORMANCE
-- Covers: inspection scheduling, history views
-- =====================================================

-- Composite index for inspections by property ordered by date
-- Used by: useInspections hook, inspection scheduling
CREATE INDEX IF NOT EXISTS idx_inspections_property_date
  ON inspections(property_id, scheduled_date DESC);

-- =====================================================
-- 6. DOCUMENT PERFORMANCE
-- Covers: document hub, property document listings
-- =====================================================

-- Composite index for documents by property and type
-- Used by: useDocuments hook, DocumentsTab component
CREATE INDEX IF NOT EXISTS idx_documents_property_type
  ON documents(property_id, document_type);

-- =====================================================
-- 7. AGENT LEARNING PERFORMANCE
-- Covers: rule lookup, preference resolution, tool selection
-- =====================================================

-- Active rules per user (uses 'active' column, not 'is_active')
-- Used by: agent rule matching during decision-making
CREATE INDEX IF NOT EXISTS idx_agent_rules_user_active
  ON agent_rules(user_id) WHERE active = true;

-- Preferences by user and category for fast category-scoped lookups
-- Used by: agent preference resolution
CREATE INDEX IF NOT EXISTS idx_agent_preferences_user_cat
  ON agent_preferences(user_id, category);

-- Tool genome by user and tool name for per-tool performance lookup
-- Used by: agent tool selection, confidence calibration
CREATE INDEX IF NOT EXISTS idx_tool_genome_user_tool
  ON tool_genome(user_id, tool_name);
