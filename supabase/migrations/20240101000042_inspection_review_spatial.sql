-- Inspection Review System + Spatial Metadata
-- Adds tenant submission/review workflow, per-room acknowledgments,
-- item-level disputes, and spatial metadata for compass-guided photo capture.

-- ============================================================
-- NEW TABLE: Tenant Submissions (additions/alterations during review)
-- ============================================================

CREATE TABLE inspection_tenant_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES inspection_rooms(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,
  submitted_by UUID NOT NULL REFERENCES profiles(id),

  -- What kind of submission
  submission_type TEXT NOT NULL CHECK (submission_type IN ('new_photo', 'description_alteration', 'new_item', 'query')),

  -- Content
  description TEXT,
  original_description TEXT,
  image_url TEXT,
  storage_path TEXT,

  -- Review status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NEW TABLE: Per-Room Acknowledgments
-- ============================================================

CREATE TABLE inspection_room_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES inspection_rooms(id) ON DELETE CASCADE,
  acknowledged_by UUID NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL CHECK (role IN ('tenant', 'owner')),
  signature_url TEXT,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, acknowledged_by)
);

-- ============================================================
-- NEW TABLE: Item-Level Disputes
-- ============================================================

CREATE TABLE inspection_item_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inspection_items(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES profiles(id),

  -- Dispute content
  dispute_reason TEXT NOT NULL,
  proposed_condition condition_rating,

  -- Resolution
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'owner_responded', 'resolved', 'escalated')),
  owner_response TEXT,
  resolution_notes TEXT,
  resolved_condition condition_rating,
  resolved_at TIMESTAMPTZ,

  -- Linked conversation for back-and-forth
  conversation_id UUID REFERENCES conversations(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ALTER: Add spatial metadata to inspection_images
-- ============================================================

ALTER TABLE inspection_images ADD COLUMN IF NOT EXISTS compass_bearing DECIMAL(5,2);
ALTER TABLE inspection_images ADD COLUMN IF NOT EXISTS device_pitch DECIMAL(5,2);
ALTER TABLE inspection_images ADD COLUMN IF NOT EXISTS device_roll DECIMAL(5,2);
ALTER TABLE inspection_images ADD COLUMN IF NOT EXISTS capture_sequence INTEGER;
ALTER TABLE inspection_images ADD COLUMN IF NOT EXISTS is_wide_shot BOOLEAN DEFAULT FALSE;
ALTER TABLE inspection_images ADD COLUMN IF NOT EXISTS is_closeup BOOLEAN DEFAULT FALSE;

-- ============================================================
-- ALTER: Add room layout sketch columns to inspection_rooms
-- ============================================================

ALTER TABLE inspection_rooms ADD COLUMN IF NOT EXISTS layout_sketch_url TEXT;
ALTER TABLE inspection_rooms ADD COLUMN IF NOT EXISTS layout_sketch_data JSONB;
ALTER TABLE inspection_rooms ADD COLUMN IF NOT EXISTS ar_room_data JSONB;
ALTER TABLE inspection_rooms ADD COLUMN IF NOT EXISTS tenant_reviewed_at TIMESTAMPTZ;
ALTER TABLE inspection_rooms ADD COLUMN IF NOT EXISTS owner_review_completed_at TIMESTAMPTZ;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_tenant_submissions_inspection ON inspection_tenant_submissions(inspection_id);
CREATE INDEX idx_tenant_submissions_room ON inspection_tenant_submissions(room_id);
CREATE INDEX idx_tenant_submissions_status ON inspection_tenant_submissions(status) WHERE status = 'pending';
CREATE INDEX idx_room_acknowledgments_inspection ON inspection_room_acknowledgments(inspection_id);
CREATE INDEX idx_room_acknowledgments_room ON inspection_room_acknowledgments(room_id);
CREATE INDEX idx_item_disputes_inspection ON inspection_item_disputes(inspection_id);
CREATE INDEX idx_item_disputes_item ON inspection_item_disputes(item_id);
CREATE INDEX idx_item_disputes_status ON inspection_item_disputes(status) WHERE status IN ('open', 'owner_responded');
CREATE INDEX idx_inspection_images_bearing ON inspection_images(compass_bearing) WHERE compass_bearing IS NOT NULL;
CREATE INDEX idx_inspection_images_sequence ON inspection_images(capture_sequence) WHERE capture_sequence IS NOT NULL;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE inspection_tenant_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_room_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_item_disputes ENABLE ROW LEVEL SECURITY;

-- TENANT SUBMISSIONS: Owner full access
CREATE POLICY "Owners can manage tenant submissions"
  ON inspection_tenant_submissions FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_owner(inspection_tenant_submissions.inspection_id)
  );

-- TENANT SUBMISSIONS: Tenant can view + insert for own inspections
CREATE POLICY "Tenants can view tenant submissions"
  ON inspection_tenant_submissions FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_tenant_submissions.inspection_id)
  );

CREATE POLICY "Tenants can create submissions"
  ON inspection_tenant_submissions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_tenant_submissions.inspection_id) AND
    submitted_by = auth.uid()
  );

-- ROOM ACKNOWLEDGMENTS: Owner full access
CREATE POLICY "Owners can manage room acknowledgments"
  ON inspection_room_acknowledgments FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_owner(inspection_room_acknowledgments.inspection_id)
  );

-- ROOM ACKNOWLEDGMENTS: Tenant can view + insert own
CREATE POLICY "Tenants can view room acknowledgments"
  ON inspection_room_acknowledgments FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_room_acknowledgments.inspection_id)
  );

CREATE POLICY "Tenants can create room acknowledgments"
  ON inspection_room_acknowledgments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_room_acknowledgments.inspection_id) AND
    acknowledged_by = auth.uid()
  );

-- ITEM DISPUTES: Owner full access
CREATE POLICY "Owners can manage item disputes"
  ON inspection_item_disputes FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_owner(inspection_item_disputes.inspection_id)
  );

-- ITEM DISPUTES: Tenant can view + insert for own inspections
CREATE POLICY "Tenants can view item disputes"
  ON inspection_item_disputes FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_item_disputes.inspection_id)
  );

CREATE POLICY "Tenants can create item disputes"
  ON inspection_item_disputes FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_item_disputes.inspection_id) AND
    raised_by = auth.uid()
  );

-- TENANT SUBMISSIONS: Tenant can also insert images to storage
CREATE POLICY "Tenants can upload inspection images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection-images' AND
    auth.uid() IS NOT NULL
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER inspection_item_disputes_updated_at
  BEFORE UPDATE ON inspection_item_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
