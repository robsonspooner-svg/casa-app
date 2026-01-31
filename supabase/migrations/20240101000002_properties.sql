-- Migration: Create properties and property_images tables
-- Mission 03: Properties CRUD

-- Property types enum
CREATE TYPE property_type AS ENUM (
  'house',
  'apartment',
  'townhouse',
  'unit',
  'studio',
  'other'
);

-- Payment frequency enum
CREATE TYPE payment_frequency AS ENUM (
  'weekly',
  'fortnightly',
  'monthly'
);

-- Properties table
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Address
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  suburb TEXT NOT NULL,
  state TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Australia',

  -- Property details
  property_type property_type NOT NULL,
  bedrooms INTEGER NOT NULL DEFAULT 1,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  parking_spaces INTEGER NOT NULL DEFAULT 0,
  land_size_sqm INTEGER,
  floor_size_sqm INTEGER,
  year_built INTEGER,

  -- Financials
  rent_amount DECIMAL(10,2) NOT NULL,
  rent_frequency payment_frequency NOT NULL DEFAULT 'weekly',
  bond_amount DECIMAL(10,2),

  -- Status
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'maintenance')),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Property images table
CREATE TABLE property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_properties_owner ON properties(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_status ON properties(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_property_images_property ON property_images(property_id);

-- RLS Policies
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can CRUD own properties"
  ON properties FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can CRUD own property images"
  ON property_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket for property images (commented for reference - run in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true);

-- Storage policies for property images
-- CREATE POLICY "Property images are publicly accessible"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'property-images');

-- CREATE POLICY "Owners can upload property images"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Owners can update property images"
--   ON storage.objects FOR UPDATE
--   USING (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Owners can delete property images"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);
