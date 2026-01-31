-- Mission 09: Maintenance Requests
-- Creates maintenance request tables, enums, RLS policies, triggers, and indexes

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE maintenance_category AS ENUM (
  'plumbing',
  'electrical',
  'appliance',
  'hvac',
  'structural',
  'pest',
  'locks_security',
  'garden_outdoor',
  'cleaning',
  'other'
);

CREATE TYPE maintenance_urgency AS ENUM (
  'emergency',
  'urgent',
  'routine'
);

CREATE TYPE maintenance_status AS ENUM (
  'submitted',
  'acknowledged',
  'awaiting_quote',
  'approved',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'on_hold'
);

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Request details
  category maintenance_category NOT NULL,
  urgency maintenance_urgency NOT NULL DEFAULT 'routine',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_in_property TEXT,

  -- Contact preferences
  preferred_contact_method TEXT DEFAULT 'app' CHECK (preferred_contact_method IN ('app', 'phone', 'email')),
  preferred_times TEXT,
  access_instructions TEXT,

  -- Status
  status maintenance_status NOT NULL DEFAULT 'submitted',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_changed_by UUID REFERENCES profiles(id),

  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  trade_id UUID, -- Populated by Mission 10 (trades table created there; FK constraint added in M10 migration)

  -- Scheduling
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  actual_completion_date DATE,

  -- Costs
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  cost_responsibility TEXT CHECK (cost_responsibility IN ('owner', 'tenant', 'split', 'insurance')),

  -- Resolution
  resolution_notes TEXT,
  tenant_satisfied BOOLEAN,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE maintenance_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),

  -- File details
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,

  -- Metadata
  caption TEXT,
  is_before BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE maintenance_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),

  -- Comment content
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE TABLE maintenance_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  old_status maintenance_status,
  new_status maintenance_status NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_maintenance_tenancy ON maintenance_requests(tenancy_id);
CREATE INDEX idx_maintenance_property ON maintenance_requests(property_id);
CREATE INDEX idx_maintenance_tenant ON maintenance_requests(tenant_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_maintenance_urgency ON maintenance_requests(urgency, created_at) WHERE status = 'submitted';
CREATE INDEX idx_maintenance_images ON maintenance_images(request_id);
CREATE INDEX idx_maintenance_comments ON maintenance_comments(request_id, created_at);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_status_history ENABLE ROW LEVEL SECURITY;

-- Tenants can create requests for their own tenancies
CREATE POLICY "Tenants can create requests"
  ON maintenance_requests FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

-- Tenants can view own requests
CREATE POLICY "Tenants can view own requests"
  ON maintenance_requests FOR SELECT
  USING (auth.uid() = tenant_id);

-- Tenants can update own requests (limited fields enforced at app level)
CREATE POLICY "Tenants can update own requests"
  ON maintenance_requests FOR UPDATE
  USING (auth.uid() = tenant_id);

-- Owners can manage requests for their properties
CREATE POLICY "Owners can manage property requests"
  ON maintenance_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = maintenance_requests.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Images: users can view images for requests they have access to
CREATE POLICY "Users can view request images"
  ON maintenance_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_requests
      WHERE maintenance_requests.id = maintenance_images.request_id
      AND (
        maintenance_requests.tenant_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM properties
          WHERE properties.id = maintenance_requests.property_id
          AND properties.owner_id = auth.uid()
        )
      )
    )
  );

-- Images: users can upload images to requests they have access to
CREATE POLICY "Users can upload images"
  ON maintenance_images FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- Comments: tenants see non-internal comments on their requests
CREATE POLICY "Tenants can view non-internal comments"
  ON maintenance_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM maintenance_requests
      WHERE maintenance_requests.id = maintenance_comments.request_id
      AND maintenance_requests.tenant_id = auth.uid()
    )
  );

-- Comments: owners see all comments on their property requests
CREATE POLICY "Owners can view all comments"
  ON maintenance_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_requests
      JOIN properties ON properties.id = maintenance_requests.property_id
      WHERE maintenance_requests.id = maintenance_comments.request_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Comments: authenticated users can add comments
CREATE POLICY "Users can add comments"
  ON maintenance_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Status history: follows request access permissions
CREATE POLICY "Users can view status history"
  ON maintenance_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_requests
      WHERE maintenance_requests.id = maintenance_status_history.request_id
      AND (
        maintenance_requests.tenant_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM properties
          WHERE properties.id = maintenance_requests.property_id
          AND properties.owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- Triggers
-- ============================================================================

-- Log status changes to history table
CREATE OR REPLACE FUNCTION log_maintenance_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO maintenance_status_history (request_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.status_changed_by);

    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintenance_status_change
  BEFORE UPDATE OF status ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION log_maintenance_status_change();

-- Updated_at trigger (uses existing function from profiles migration)
CREATE TRIGGER maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Storage bucket for maintenance images
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance', 'maintenance', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for maintenance bucket
CREATE POLICY "Authenticated users can upload maintenance images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'maintenance' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view maintenance images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'maintenance');

CREATE POLICY "Users can delete own maintenance images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'maintenance' AND auth.uid()::text = (storage.foldername(name))[1]);
