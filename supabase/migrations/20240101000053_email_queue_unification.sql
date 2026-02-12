-- Migration: Unify email pipeline + Beyond-PM Intelligence Tables
-- The agent heartbeat and tool handlers write to email_queue which didn't exist.
-- Also creates the 4 beyond-PM intelligence tables used by scanners 44-48 and tools.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. EMAIL QUEUE TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_data JSONB DEFAULT '{}',
  html_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status ON email_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_email_queue_created ON email_queue(created_at DESC);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages email queue"
  ON email_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PROPERTY HEALTH SCORES
-- Composite 0-100 health score per property, calculated weekly by Scanner 44
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS property_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  maintenance_score INTEGER CHECK (maintenance_score >= 0 AND maintenance_score <= 100),
  financial_score INTEGER CHECK (financial_score >= 0 AND financial_score <= 100),
  compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
  tenant_score INTEGER CHECK (tenant_score >= 0 AND tenant_score <= 100),
  market_position_score INTEGER CHECK (market_position_score >= 0 AND market_position_score <= 100),
  risk_factors JSONB DEFAULT '[]',
  opportunities JSONB DEFAULT '[]',
  predicted_maintenance_cost_12m DECIMAL(10,2),
  predicted_vacancy_risk DECIMAL(5,4),
  roi_annual DECIMAL(5,2),
  capital_growth_estimate DECIMAL(5,2),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id)
);

CREATE INDEX idx_health_scores_owner ON property_health_scores(owner_id);
CREATE INDEX idx_health_scores_property ON property_health_scores(property_id);
CREATE INDEX idx_health_scores_overall ON property_health_scores(overall_score);

ALTER TABLE property_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own property health scores"
  ON property_health_scores FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Service role manages health scores"
  ON property_health_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PORTFOLIO SNAPSHOTS
-- Monthly portfolio wealth snapshots, calculated by Scanner 45
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_properties INTEGER NOT NULL DEFAULT 0,
  total_value_estimate DECIMAL(12,2),
  total_equity_estimate DECIMAL(12,2),
  total_annual_rent DECIMAL(10,2),
  total_annual_expenses DECIMAL(10,2),
  net_yield DECIMAL(5,2),
  occupancy_rate DECIMAL(5,2),
  average_health_score DECIMAL(5,1),
  average_days_to_let DECIMAL(5,1),
  total_maintenance_ytd DECIMAL(10,2),
  insights JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, snapshot_date)
);

CREATE INDEX idx_portfolio_owner ON portfolio_snapshots(owner_id, snapshot_date DESC);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own portfolio snapshots"
  ON portfolio_snapshots FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Service role manages portfolio snapshots"
  ON portfolio_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. TENANT SATISFACTION
-- Satisfaction/retention scores per tenancy, calculated fortnightly by Scanner 46
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenant_satisfaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  satisfaction_score INTEGER CHECK (satisfaction_score >= 0 AND satisfaction_score <= 100),
  response_time_avg_hours DECIMAL(8,2),
  maintenance_resolution_avg_days DECIMAL(8,2),
  communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
  rent_payment_reliability DECIMAL(5,2),
  renewal_probability DECIMAL(5,2),
  risk_flags JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenancy_id)
);

CREATE INDEX idx_satisfaction_owner ON tenant_satisfaction(owner_id);
CREATE INDEX idx_satisfaction_property ON tenant_satisfaction(property_id);
CREATE INDEX idx_satisfaction_tenancy ON tenant_satisfaction(tenancy_id);

ALTER TABLE tenant_satisfaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view tenant satisfaction for own properties"
  ON tenant_satisfaction FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Service role manages tenant satisfaction"
  ON tenant_satisfaction FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. MARKET INTELLIGENCE
-- Suburb-level rental market data, calculated weekly by Scanner 48
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS market_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suburb TEXT NOT NULL,
  state TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'all',
  bedrooms INTEGER,
  median_rent_weekly DECIMAL(8,2),
  rent_growth_annual DECIMAL(5,2),
  vacancy_rate DECIMAL(5,4),
  days_on_market_avg DECIMAL(5,1),
  demand_score INTEGER CHECK (demand_score >= 0 AND demand_score <= 100),
  supply_score INTEGER CHECK (supply_score >= 0 AND supply_score <= 100),
  yield_estimate DECIMAL(5,2),
  data_sources JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (suburb, state, property_type, bedrooms)
);

CREATE INDEX idx_market_suburb ON market_intelligence(suburb, state);
CREATE INDEX idx_market_calculated ON market_intelligence(calculated_at DESC);

ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;

-- Market intelligence is read-only for authenticated users (shared data)
CREATE POLICY "Authenticated users can view market intelligence"
  ON market_intelligence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages market intelligence"
  ON market_intelligence FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
