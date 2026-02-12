-- Mission 20: Support Tickets, Data Exports, Subscription Events
-- Support infrastructure for launch

-- =============================================================================
-- Support Tickets
-- =============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'priority', 'dedicated')),
  category TEXT NOT NULL CHECK (category IN ('billing', 'technical', 'property', 'general', 'urgent')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  assigned_to UUID REFERENCES profiles(id),
  response_time_target INTEGER, -- minutes
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Support Messages
-- =============================================================================

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Data Exports
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  format TEXT NOT NULL DEFAULT 'zip',
  file_url TEXT,
  file_size INTEGER,
  expires_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- =============================================================================
-- Subscription Events (audit trail for plan changes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'upgraded', 'downgraded', 'cancelled', 'reactivated')),
  from_plan TEXT,
  to_plan TEXT,
  stripe_subscription_id TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);

-- =============================================================================
-- Updated_at Triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trigger_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tickets_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Support Tickets: Users can see/create their own tickets
CREATE POLICY support_tickets_select_own ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY support_tickets_insert_own ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY support_tickets_update_own ON support_tickets
  FOR UPDATE USING (auth.uid() = user_id);

-- Support Messages: Users can see messages on their tickets, create messages on their tickets
CREATE POLICY support_messages_select_own ON support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
    AND is_internal = false
  );

CREATE POLICY support_messages_insert_own ON support_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

-- Data Exports: Users can see/create their own exports
CREATE POLICY data_exports_select_own ON data_exports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY data_exports_insert_own ON data_exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscription Events: Users can see their own events
CREATE POLICY subscription_events_select_own ON subscription_events
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all (for edge functions)
CREATE POLICY support_tickets_service ON support_tickets
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY support_messages_service ON support_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY data_exports_service ON data_exports
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY subscription_events_service ON subscription_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
