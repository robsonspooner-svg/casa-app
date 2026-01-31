-- Mission 11: Property Inspections & Condition Reports
-- Creates inspection tracking tables, templates, rooms, items, images, voice notes, AI comparison tables
-- Adds inspection scheduling columns to properties
-- Sets up RLS policies, indexes, triggers, storage bucket

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE inspection_type AS ENUM (
  'routine',
  'entry',
  'exit',
  'pre_listing',
  'maintenance',
  'complaint'
);

CREATE TYPE inspection_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'tenant_review',
  'disputed',
  'finalized'
);

CREATE TYPE condition_rating AS ENUM (
  'excellent',
  'good',
  'fair',
  'poor',
  'damaged',
  'missing',
  'not_applicable'
);

-- ============================================================
-- INSPECTIONS TABLE
-- ============================================================

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,
  inspector_id UUID NOT NULL REFERENCES profiles(id),

  -- Type and scheduling
  inspection_type inspection_type NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  actual_date DATE,
  actual_time TIME,
  duration_minutes INTEGER,

  -- Status
  status inspection_status NOT NULL DEFAULT 'scheduled',
  completed_at TIMESTAMPTZ,

  -- Entry/Exit specific
  compare_to_inspection_id UUID REFERENCES inspections(id),

  -- Summary
  overall_condition condition_rating,
  summary_notes TEXT,
  action_items TEXT[],

  -- Tenant acknowledgment
  tenant_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  tenant_acknowledged_at TIMESTAMPTZ,
  tenant_signature_url TEXT,
  tenant_disputes TEXT,

  -- Owner signature
  owner_signature_url TEXT,
  owner_signed_at TIMESTAMPTZ,

  -- Report
  report_url TEXT,
  report_generated_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INSPECTION TEMPLATES
-- ============================================================

CREATE TABLE inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inspection_template_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES inspection_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  display_order INTEGER NOT NULL DEFAULT 0,
  items TEXT[] NOT NULL DEFAULT '{}'
);

-- ============================================================
-- INSPECTION ROOMS (per inspection instance)
-- ============================================================

CREATE TABLE inspection_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  display_order INTEGER NOT NULL DEFAULT 0,
  overall_condition condition_rating,
  notes TEXT,
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- INSPECTION ITEMS (per room instance)
-- ============================================================

CREATE TABLE inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES inspection_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Condition
  condition condition_rating,
  notes TEXT,
  action_required BOOLEAN NOT NULL DEFAULT FALSE,
  action_description TEXT,
  estimated_cost DECIMAL(10,2),

  -- For exit reports: compare to entry
  entry_condition condition_rating,
  condition_changed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  checked_at TIMESTAMPTZ
);

-- ============================================================
-- INSPECTION IMAGES
-- ============================================================

CREATE TABLE inspection_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  room_id UUID REFERENCES inspection_rooms(id) ON DELETE SET NULL,
  item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,

  -- File details
  storage_path TEXT NOT NULL CHECK (trim(storage_path) <> ''),
  url TEXT NOT NULL CHECK (trim(url) <> ''),
  thumbnail_url TEXT,

  -- Annotations
  caption TEXT,
  annotations JSONB,

  -- Metadata
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VOICE NOTES
-- ============================================================

CREATE TABLE inspection_voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  room_id UUID REFERENCES inspection_rooms(id) ON DELETE SET NULL,

  -- Audio
  storage_path TEXT NOT NULL CHECK (trim(storage_path) <> ''),
  url TEXT NOT NULL CHECK (trim(url) <> ''),
  duration_seconds INTEGER NOT NULL,

  -- Transcription
  transcript TEXT,
  transcribed_at TIMESTAMPTZ,

  -- Metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI COMPARISON TABLES
-- ============================================================

CREATE TABLE inspection_ai_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  entry_inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,

  -- Results
  total_issues INTEGER NOT NULL DEFAULT 0,
  tenant_responsible_issues INTEGER NOT NULL DEFAULT 0,
  wear_and_tear_issues INTEGER NOT NULL DEFAULT 0,
  total_estimated_cost DECIMAL(10,2) DEFAULT 0,

  -- Bond recommendation
  bond_deduction_amount DECIMAL(10,2) DEFAULT 0,
  bond_deduction_reasoning TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inspection_ai_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID NOT NULL REFERENCES inspection_ai_comparisons(id) ON DELETE CASCADE,
  room_id UUID REFERENCES inspection_rooms(id) ON DELETE SET NULL,
  item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,

  -- Issue details
  room_name TEXT NOT NULL CHECK (trim(room_name) <> ''),
  item_name TEXT NOT NULL CHECK (trim(item_name) <> ''),
  description TEXT NOT NULL CHECK (trim(description) <> ''),
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major')),
  change_type TEXT NOT NULL CHECK (change_type IN ('wear_and_tear', 'minor_damage', 'major_damage', 'missing')),
  is_tenant_responsible BOOLEAN NOT NULL DEFAULT FALSE,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  estimated_cost DECIMAL(10,2),
  evidence_notes TEXT,

  -- Photo references
  entry_image_id UUID REFERENCES inspection_images(id),
  exit_image_id UUID REFERENCES inspection_images(id),

  -- Owner review
  owner_agreed BOOLEAN,
  owner_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADD INSPECTION COLUMNS TO PROPERTIES
-- ============================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS inspection_interval_months INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_inspection_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS next_inspection_due DATE;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_inspections_property ON inspections(property_id);
CREATE INDEX idx_inspections_tenancy ON inspections(tenancy_id);
CREATE INDEX idx_inspections_status ON inspections(status) WHERE status NOT IN ('completed', 'finalized', 'cancelled');
CREATE INDEX idx_inspections_inspector ON inspections(inspector_id);
CREATE INDEX idx_inspections_scheduled_date ON inspections(scheduled_date);
CREATE INDEX idx_inspections_type ON inspections(inspection_type);
CREATE INDEX idx_inspection_rooms_inspection ON inspection_rooms(inspection_id);
CREATE INDEX idx_inspection_items_room ON inspection_items(room_id);
CREATE INDEX idx_inspection_images_inspection ON inspection_images(inspection_id);
CREATE INDEX idx_inspection_images_room ON inspection_images(room_id);
CREATE INDEX idx_inspection_images_item ON inspection_images(item_id);
CREATE INDEX idx_inspection_voice_notes_inspection ON inspection_voice_notes(inspection_id);
CREATE INDEX idx_inspection_templates_owner ON inspection_templates(owner_id);
CREATE INDEX idx_ai_comparisons_exit ON inspection_ai_comparisons(exit_inspection_id);
CREATE INDEX idx_ai_comparisons_entry ON inspection_ai_comparisons(entry_inspection_id);
CREATE INDEX idx_ai_issues_comparison ON inspection_ai_issues(comparison_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_template_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_ai_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_ai_issues ENABLE ROW LEVEL SECURITY;

-- Helper function to check inspection ownership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION is_inspection_owner(p_inspection_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM inspections i
    JOIN properties p ON p.id = i.property_id
    WHERE i.id = p_inspection_id
    AND p.owner_id = auth.uid()
  );
END;
$$;

-- Helper function to check inspection tenant access
CREATE OR REPLACE FUNCTION is_inspection_tenant(p_inspection_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM inspections i
    JOIN tenancy_tenants tt ON tt.tenancy_id = i.tenancy_id
    WHERE i.id = p_inspection_id
    AND tt.tenant_id = auth.uid()
  );
END;
$$;

-- INSPECTIONS: Owner CRUD
CREATE POLICY "Owners can manage inspections"
  ON inspections FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = inspections.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- INSPECTIONS: Tenant SELECT
CREATE POLICY "Tenants can view own inspections"
  ON inspections FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM tenancy_tenants tt
      WHERE tt.tenancy_id = inspections.tenancy_id
      AND tt.tenant_id = auth.uid()
    )
  );

-- INSPECTIONS: Tenant UPDATE (acknowledgment only)
CREATE POLICY "Tenants can acknowledge inspections"
  ON inspections FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM tenancy_tenants tt
      WHERE tt.tenancy_id = inspections.tenancy_id
      AND tt.tenant_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM tenancy_tenants tt
      WHERE tt.tenancy_id = inspections.tenancy_id
      AND tt.tenant_id = auth.uid()
    )
  );

-- TEMPLATES: View system defaults + own
CREATE POLICY "View templates"
  ON inspection_templates FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    (owner_id IS NULL OR owner_id = auth.uid())
  );

-- TEMPLATES: Manage own
CREATE POLICY "Manage own templates"
  ON inspection_templates FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    owner_id = auth.uid()
  );

-- TEMPLATE ROOMS: View via template access
CREATE POLICY "View template rooms"
  ON inspection_template_rooms FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM inspection_templates t
      WHERE t.id = inspection_template_rooms.template_id
      AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

-- TEMPLATE ROOMS: Manage own template rooms
CREATE POLICY "Manage own template rooms"
  ON inspection_template_rooms FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM inspection_templates t
      WHERE t.id = inspection_template_rooms.template_id
      AND t.owner_id = auth.uid()
    )
  );

-- INSPECTION ROOMS: Owner CRUD
CREATE POLICY "Owners can manage inspection rooms"
  ON inspection_rooms FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_owner(inspection_rooms.inspection_id)
  );

-- INSPECTION ROOMS: Tenant view
CREATE POLICY "Tenants can view inspection rooms"
  ON inspection_rooms FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_rooms.inspection_id)
  );

-- INSPECTION ITEMS: Owner CRUD
CREATE POLICY "Owners can manage inspection items"
  ON inspection_items FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM inspection_rooms r
      WHERE r.id = inspection_items.room_id
      AND is_inspection_owner(r.inspection_id)
    )
  );

-- INSPECTION ITEMS: Tenant view
CREATE POLICY "Tenants can view inspection items"
  ON inspection_items FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM inspection_rooms r
      WHERE r.id = inspection_items.room_id
      AND is_inspection_tenant(r.inspection_id)
    )
  );

-- INSPECTION IMAGES: Owner CRUD
CREATE POLICY "Owners can manage inspection images"
  ON inspection_images FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_owner(inspection_images.inspection_id)
  );

-- INSPECTION IMAGES: Tenant view
CREATE POLICY "Tenants can view inspection images"
  ON inspection_images FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_images.inspection_id)
  );

-- VOICE NOTES: Owner CRUD
CREATE POLICY "Owners can manage voice notes"
  ON inspection_voice_notes FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_owner(inspection_voice_notes.inspection_id)
  );

-- VOICE NOTES: Tenant view
CREATE POLICY "Tenants can view voice notes"
  ON inspection_voice_notes FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_voice_notes.inspection_id)
  );

-- AI COMPARISONS: Owner CRUD
CREATE POLICY "Owners can manage ai comparisons"
  ON inspection_ai_comparisons FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_owner(inspection_ai_comparisons.exit_inspection_id)
  );

-- AI COMPARISONS: Tenant view
CREATE POLICY "Tenants can view ai comparisons"
  ON inspection_ai_comparisons FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_inspection_tenant(inspection_ai_comparisons.exit_inspection_id)
  );

-- AI ISSUES: Owner CRUD
CREATE POLICY "Owners can manage ai issues"
  ON inspection_ai_issues FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM inspection_ai_comparisons c
      WHERE c.id = inspection_ai_issues.comparison_id
      AND is_inspection_owner(c.exit_inspection_id)
    )
  );

-- AI ISSUES: Tenant view
CREATE POLICY "Tenants can view ai issues"
  ON inspection_ai_issues FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM inspection_ai_comparisons c
      WHERE c.id = inspection_ai_issues.comparison_id
      AND is_inspection_tenant(c.exit_inspection_id)
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Updated at trigger for inspections
CREATE TRIGGER inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-calculate next inspection date after completion
CREATE OR REPLACE FUNCTION update_next_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'finalized') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE properties
    SET last_inspection_at = COALESCE(NEW.completed_at, NOW()),
        next_inspection_due = (COALESCE(NEW.completed_at, NOW()))::date + (COALESCE(properties.inspection_interval_months, 6) || ' months')::INTERVAL
    WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER inspection_completed_tracking
  AFTER UPDATE OF status ON inspections
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'finalized'))
  EXECUTE FUNCTION update_next_inspection();

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-images', 'inspection-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for inspection images bucket
CREATE POLICY "Authenticated users can upload inspection images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection-images' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view their own inspection images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'inspection-images' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own inspection images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'inspection-images' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- DEFAULT TEMPLATE DATA
-- ============================================================

INSERT INTO inspection_templates (name, description, is_default) VALUES
('Standard Residential', 'Default template for houses and apartments', TRUE);

INSERT INTO inspection_template_rooms (template_id, name, display_order, items)
SELECT
  t.id,
  room_data.room_name,
  room_data.room_order,
  room_data.items
FROM inspection_templates t
CROSS JOIN (
  VALUES
    ('Entry/Hallway', 0, ARRAY['Front door', 'Door locks', 'Flooring', 'Walls', 'Ceiling', 'Light fixtures', 'Power points', 'Smoke detector']),
    ('Living Room', 1, ARRAY['Flooring', 'Walls', 'Ceiling', 'Windows', 'Window coverings', 'Light fixtures', 'Power points', 'Air conditioning']),
    ('Kitchen', 2, ARRAY['Flooring', 'Walls', 'Ceiling', 'Benchtops', 'Sink', 'Tap/mixer', 'Oven', 'Cooktop', 'Rangehood', 'Dishwasher', 'Cupboards', 'Drawers']),
    ('Bathroom', 3, ARRAY['Flooring', 'Walls', 'Ceiling', 'Toilet', 'Vanity', 'Mirror', 'Shower', 'Bath', 'Tap/mixer', 'Exhaust fan', 'Towel rails']),
    ('Bedroom 1', 4, ARRAY['Flooring', 'Walls', 'Ceiling', 'Windows', 'Window coverings', 'Wardrobe', 'Light fixtures', 'Power points']),
    ('Bedroom 2', 5, ARRAY['Flooring', 'Walls', 'Ceiling', 'Windows', 'Window coverings', 'Wardrobe', 'Light fixtures', 'Power points']),
    ('Laundry', 6, ARRAY['Flooring', 'Walls', 'Ceiling', 'Tub', 'Tap', 'Cupboards', 'Dryer connection']),
    ('Outdoor/Garage', 7, ARRAY['Driveway', 'Garage door', 'Garden', 'Lawn', 'Fencing', 'Letterbox', 'Clothesline'])
) AS room_data(room_name, room_order, items)
WHERE t.is_default = TRUE;
