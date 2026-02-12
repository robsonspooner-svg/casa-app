-- Mission 15: Learning Engine & Compliance
-- Creates compliance tracking tables, learning content, regulatory updates,
-- search_similar_decisions function for pgvector retrieval, and autonomy graduation tracking

-- ============================================================
-- 1. Compliance Requirements (templates per state)
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('smoke_alarm', 'pool_safety', 'gas_safety', 'electrical_safety', 'blind_cord', 'building_insurance', 'landlord_insurance', 'energy_rating', 'asbestos_register')),
  frequency_months INTEGER NOT NULL DEFAULT 12,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  applies_to_property_types TEXT[] DEFAULT '{}',
  conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Property Compliance (tracking per property)
-- ============================================================
CREATE TABLE IF NOT EXISTS property_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'compliant', 'overdue', 'upcoming', 'exempt', 'not_applicable')),
  last_completed_at TIMESTAMPTZ,
  next_due_date TIMESTAMPTZ,
  certificate_url TEXT,
  notes TEXT,
  completed_by TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, requirement_id)
);

-- ============================================================
-- 3. Compliance Reminders (sent reminders log)
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_compliance_id UUID NOT NULL REFERENCES property_compliance(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('info', 'warning', 'critical')),
  days_before_due INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'push', 'email', 'sms')),
  acknowledged_at TIMESTAMPTZ
);

-- ============================================================
-- 4. Learning Content (articles & guides)
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content_markdown TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('getting_started', 'legal', 'financial', 'maintenance', 'tenant_relations', 'compliance', 'insurance')),
  state TEXT CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),
  tags TEXT[] DEFAULT '{}',
  reading_time_minutes INTEGER DEFAULT 5,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. User Learning Progress
-- ============================================================
CREATE TABLE IF NOT EXISTS user_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES learning_content(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  bookmarked BOOLEAN NOT NULL DEFAULT false,
  checklist_progress JSONB DEFAULT '{}',
  last_read_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, content_id)
);

-- ============================================================
-- 6. Regulatory Updates
-- ============================================================
CREATE TABLE IF NOT EXISTS regulatory_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'ALL')),
  category TEXT NOT NULL CHECK (category IN ('tenancy_law', 'safety', 'financial', 'insurance', 'building', 'environmental')),
  effective_date DATE NOT NULL,
  impact_level TEXT NOT NULL CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  action_required TEXT,
  source_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. Regulatory Update Notifications (sent to affected owners)
-- ============================================================
CREATE TABLE IF NOT EXISTS regulatory_update_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES regulatory_updates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (update_id, user_id)
);

-- ============================================================
-- 8. Autonomy Graduation Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS autonomy_graduation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  consecutive_approvals INTEGER NOT NULL DEFAULT 0,
  total_approvals INTEGER NOT NULL DEFAULT 0,
  total_rejections INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  graduation_threshold INTEGER NOT NULL DEFAULT 10,
  backoff_multiplier INTEGER NOT NULL DEFAULT 1,
  last_suggestion_at TIMESTAMPTZ,
  last_rejection_at TIMESTAMPTZ,
  last_approval_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category)
);

-- ============================================================
-- 9. Add applications_count and rejections_count to agent_rules if missing
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_rules' AND column_name = 'applications_count') THEN
    ALTER TABLE agent_rules ADD COLUMN applications_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_rules' AND column_name = 'rejections_count') THEN
    ALTER TABLE agent_rules ADD COLUMN rejections_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 10. pgvector: search_similar_decisions function
-- ============================================================
CREATE OR REPLACE FUNCTION search_similar_decisions(
  query_embedding vector(1536),
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

-- ============================================================
-- 11. RLS Policies
-- ============================================================

-- Compliance Requirements: public read (templates)
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_requirements_read" ON compliance_requirements
  FOR SELECT USING (true);

-- Property Compliance: owner can CRUD their properties' compliance
ALTER TABLE property_compliance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "property_compliance_owner_read" ON property_compliance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_compliance.property_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "property_compliance_owner_insert" ON property_compliance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_compliance.property_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "property_compliance_owner_update" ON property_compliance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_compliance.property_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "property_compliance_service_role" ON property_compliance
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Compliance Reminders: owner can read their own
ALTER TABLE compliance_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_reminders_owner_read" ON compliance_reminders
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "compliance_reminders_service_role" ON compliance_reminders
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Learning Content: public read for published
ALTER TABLE learning_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learning_content_read" ON learning_content
  FOR SELECT USING (is_published = true);

-- User Learning Progress: user can CRUD their own
ALTER TABLE user_learning_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_learning_progress_own" ON user_learning_progress
  FOR ALL USING (user_id = auth.uid());

-- Regulatory Updates: public read for published
ALTER TABLE regulatory_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regulatory_updates_read" ON regulatory_updates
  FOR SELECT USING (is_published = true);

-- Regulatory Update Notifications: user can read their own
ALTER TABLE regulatory_update_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regulatory_update_notifications_own" ON regulatory_update_notifications
  FOR ALL USING (user_id = auth.uid());

-- Autonomy Graduation Tracking: user can read/update their own, service role can manage
ALTER TABLE autonomy_graduation_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autonomy_graduation_own" ON autonomy_graduation_tracking
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "autonomy_graduation_service_role" ON autonomy_graduation_tracking
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 12. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_property_compliance_property ON property_compliance(property_id);
CREATE INDEX IF NOT EXISTS idx_property_compliance_status ON property_compliance(status);
CREATE INDEX IF NOT EXISTS idx_property_compliance_due ON property_compliance(next_due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_reminders_property ON compliance_reminders(property_compliance_id);
CREATE INDEX IF NOT EXISTS idx_learning_content_category ON learning_content(category);
CREATE INDEX IF NOT EXISTS idx_learning_content_state ON learning_content(state);
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_state ON regulatory_updates(state);
CREATE INDEX IF NOT EXISTS idx_autonomy_graduation_user ON autonomy_graduation_tracking(user_id, category);
CREATE INDEX IF NOT EXISTS idx_agent_corrections_user ON agent_corrections(user_id, pattern_matched);

-- ============================================================
-- 13. Updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_property_compliance_updated_at') THEN
    CREATE TRIGGER update_property_compliance_updated_at
      BEFORE UPDATE ON property_compliance
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_learning_progress_updated_at') THEN
    CREATE TRIGGER update_user_learning_progress_updated_at
      BEFORE UPDATE ON user_learning_progress
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_autonomy_graduation_updated_at') THEN
    CREATE TRIGGER update_autonomy_graduation_updated_at
      BEFORE UPDATE ON autonomy_graduation_tracking
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- 14. Seed compliance requirements for all Australian states
-- ============================================================
INSERT INTO compliance_requirements (state, name, description, category, frequency_months, is_mandatory, conditions) VALUES
-- NSW
('NSW', 'Smoke Alarm Annual Check', 'Annual check of all smoke alarms to ensure they are operational', 'smoke_alarm', 12, true, NULL),
('NSW', 'Pool Safety Registration', 'Pool must be registered with NSW Fair Trading and comply with safety standards', 'pool_safety', 36, true, 'Only if property has a pool or spa'),
('NSW', 'Gas Safety Check', 'Recommended annual gas safety check by licensed gasfitter', 'gas_safety', 12, false, 'Only if property has gas appliances'),
('NSW', 'Blind Cord Safety', 'All internal blind cords must comply with safety standards', 'blind_cord', 0, true, 'One-time compliance required'),
('NSW', 'Building Insurance', 'Building insurance must be maintained for the property', 'building_insurance', 12, true, NULL),
('NSW', 'Landlord Insurance', 'Recommended landlord insurance covering tenant damage and loss of rent', 'landlord_insurance', 12, false, NULL),
('NSW', 'Energy Rating Disclosure', 'Energy efficiency rating must be disclosed for new leases', 'energy_rating', 0, true, 'Required for new leases only'),
('NSW', 'Asbestos Register', 'Asbestos register required for buildings constructed before 2003', 'asbestos_register', 0, true, 'Buildings constructed before 2003'),
-- VIC
('VIC', 'Smoke Alarm Annual Check', 'Annual check of all smoke alarms', 'smoke_alarm', 12, true, NULL),
('VIC', 'Pool Safety Registration', 'Pool must be registered and inspected', 'pool_safety', 48, true, 'Only if property has a pool or spa'),
('VIC', 'Gas Safety Check', 'Mandatory biennial gas safety check by licensed gasfitter', 'gas_safety', 24, true, NULL),
('VIC', 'Blind Cord Safety', 'All internal blind cords must comply with safety standards', 'blind_cord', 0, true, 'One-time compliance required'),
('VIC', 'Building Insurance', 'Building insurance must be maintained', 'building_insurance', 12, true, NULL),
('VIC', 'Landlord Insurance', 'Recommended landlord insurance', 'landlord_insurance', 12, false, NULL),
('VIC', 'Energy Rating Disclosure', 'Energy efficiency rating must be disclosed for new leases', 'energy_rating', 0, true, 'Required for new leases only'),
('VIC', 'Asbestos Register', 'Asbestos register for pre-2003 buildings', 'asbestos_register', 0, true, 'Buildings constructed before 2003'),
-- QLD
('QLD', 'Smoke Alarm Annual Check', 'Annual check plus replacement at tenancy change', 'smoke_alarm', 12, true, 'Also required at each tenancy change'),
('QLD', 'Pool Safety Certificate', 'Triennial pool safety certificate by licensed inspector', 'pool_safety', 36, true, 'Only if property has a pool or spa'),
('QLD', 'Gas Safety Check', 'Recommended annual gas safety check', 'gas_safety', 12, false, 'Only if property has gas appliances'),
('QLD', 'Electrical Safety Switch Test', 'Mandatory biennial safety switch test', 'electrical_safety', 24, true, NULL),
('QLD', 'Blind Cord Safety', 'All internal blind cords must comply with safety standards', 'blind_cord', 0, true, 'One-time compliance required'),
('QLD', 'Building Insurance', 'Building insurance must be maintained', 'building_insurance', 12, true, NULL),
('QLD', 'Landlord Insurance', 'Recommended landlord insurance', 'landlord_insurance', 12, false, NULL),
-- SA
('SA', 'Smoke Alarm Annual Check', 'Annual check of all smoke alarms', 'smoke_alarm', 12, true, NULL),
('SA', 'Pool Fencing Compliance', 'Pool fencing must meet safety standards', 'pool_safety', 36, true, 'Only if property has a pool or spa'),
('SA', 'Building Insurance', 'Building insurance must be maintained', 'building_insurance', 12, true, NULL),
('SA', 'Landlord Insurance', 'Recommended landlord insurance', 'landlord_insurance', 12, false, NULL),
-- WA
('WA', 'Smoke Alarm Annual Check', 'Annual check of all smoke alarms', 'smoke_alarm', 12, true, NULL),
('WA', 'Pool Fencing Inspection', 'Pool fencing inspection required', 'pool_safety', 48, true, 'Only if property has a pool or spa'),
('WA', 'Building Insurance', 'Building insurance must be maintained', 'building_insurance', 12, true, NULL),
('WA', 'Landlord Insurance', 'Recommended landlord insurance', 'landlord_insurance', 12, false, NULL),
-- TAS
('TAS', 'Smoke Alarm Annual Check', 'Annual check of all smoke alarms', 'smoke_alarm', 12, true, NULL),
('TAS', 'Pool Fencing Compliance', 'Pool fencing must meet safety standards', 'pool_safety', 36, true, 'Only if property has a pool or spa'),
('TAS', 'Building Insurance', 'Building insurance must be maintained', 'building_insurance', 12, true, NULL),
('TAS', 'Landlord Insurance', 'Recommended landlord insurance', 'landlord_insurance', 12, false, NULL),
-- NT
('NT', 'Smoke Alarm Annual Check', 'Annual check of all smoke alarms', 'smoke_alarm', 12, true, NULL),
('NT', 'Pool Fencing Compliance', 'Pool fencing must comply with Building Code standards', 'pool_safety', 48, true, 'Only if property has a pool or spa'),
('NT', 'Gas Safety Check', 'Recommended annual gas safety check', 'gas_safety', 12, false, 'Only if property has gas appliances'),
('NT', 'Building Insurance', 'Building insurance must be maintained', 'building_insurance', 12, true, NULL),
('NT', 'Landlord Insurance', 'Recommended landlord insurance', 'landlord_insurance', 12, false, NULL),
-- ACT
('ACT', 'Smoke Alarm Annual Check', 'Annual check of all smoke alarms to ensure they are operational', 'smoke_alarm', 12, true, NULL),
('ACT', 'Pool Safety Registration', 'Pool and spa must be registered and comply with safety barrier standards', 'pool_safety', 36, true, 'Only if property has a pool or spa'),
('ACT', 'Gas Safety Check', 'Recommended annual gas safety check by licensed gasfitter', 'gas_safety', 12, false, 'Only if property has gas appliances'),
('ACT', 'Energy Efficiency Rating', 'Energy efficiency rating disclosure required for all rentals', 'energy_rating', 0, true, 'Required at lease commencement'),
('ACT', 'Building Insurance', 'Building insurance must be maintained', 'building_insurance', 12, true, NULL),
('ACT', 'Landlord Insurance', 'Recommended landlord insurance', 'landlord_insurance', 12, false, NULL);
