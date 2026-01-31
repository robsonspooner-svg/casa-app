-- Migration: Create listings, listing_features, and feature_options tables
-- Mission 04: Property Listings

-- Listing status enum
CREATE TYPE listing_status AS ENUM (
  'draft',
  'active',
  'paused',
  'closed'
);

-- Lease term enum
CREATE TYPE lease_term AS ENUM (
  '6_months',
  '12_months',
  '24_months',
  'flexible'
);

-- Listings table
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Listing details
  title TEXT NOT NULL,
  description TEXT,
  available_date DATE NOT NULL,
  lease_term lease_term NOT NULL DEFAULT '12_months',

  -- Rent (can differ from property default)
  rent_amount DECIMAL(10,2) NOT NULL,
  rent_frequency payment_frequency NOT NULL DEFAULT 'weekly',
  bond_weeks INTEGER NOT NULL DEFAULT 4,

  -- Policies
  pets_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  pets_description TEXT,
  smoking_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  furnished BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status
  status listing_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,

  -- Stats
  view_count INTEGER NOT NULL DEFAULT 0,
  application_count INTEGER NOT NULL DEFAULT 0,

  -- Portal sync
  domain_listing_id TEXT,
  domain_sync_status TEXT DEFAULT 'not_synced',
  domain_last_synced_at TIMESTAMPTZ,
  rea_listing_id TEXT,
  rea_sync_status TEXT DEFAULT 'not_synced',
  rea_last_synced_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Features/amenities junction table
CREATE TABLE listing_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  UNIQUE(listing_id, feature)
);

-- Common features reference table
CREATE TABLE feature_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  icon TEXT
);

-- Seed common features
INSERT INTO feature_options (name, category, icon) VALUES
  ('Air Conditioning', 'climate', 'snowflake'),
  ('Heating', 'climate', 'flame'),
  ('Dishwasher', 'kitchen', 'utensils'),
  ('Gas Cooking', 'kitchen', 'flame'),
  ('Built-in Wardrobes', 'storage', 'archive'),
  ('Balcony', 'outdoor', 'sun'),
  ('Courtyard', 'outdoor', 'tree'),
  ('Pool', 'outdoor', 'swimmer'),
  ('Gym', 'building', 'dumbbell'),
  ('Security', 'building', 'shield'),
  ('Intercom', 'building', 'phone'),
  ('Lift', 'building', 'arrow-up'),
  ('NBN', 'utilities', 'wifi'),
  ('Solar Panels', 'utilities', 'sun'),
  ('Water Tank', 'utilities', 'droplet');

-- Indexes
CREATE INDEX idx_listings_property ON listings(property_id);
CREATE INDEX idx_listings_owner ON listings(owner_id);
CREATE INDEX idx_listings_status ON listings(status) WHERE status = 'active';
CREATE INDEX idx_listings_search ON listings(status, rent_amount, available_date)
  WHERE status = 'active';
CREATE INDEX idx_listing_features_listing ON listing_features(listing_id);

-- RLS Policies
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_options ENABLE ROW LEVEL SECURITY;

-- Owners can manage their listings
CREATE POLICY "Owners can CRUD own listings"
  ON listings FOR ALL
  USING (auth.uid() = owner_id);

-- Anyone can view active listings
CREATE POLICY "Anyone can view active listings"
  ON listings FOR SELECT
  USING (status = 'active');

-- Features follow listing ownership
CREATE POLICY "Owners can CRUD own listing features"
  ON listing_features FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_features.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Anyone can view features of active listings
CREATE POLICY "Anyone can view features of active listings"
  ON listing_features FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_features.listing_id
      AND listings.status = 'active'
    )
  );

-- Anyone can view feature options (reference data)
CREATE POLICY "Anyone can view feature options"
  ON feature_options FOR SELECT
  USING (true);

-- Updated_at trigger
CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_listing_views(listing_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE listings
  SET view_count = view_count + 1
  WHERE id = listing_uuid AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vacancy tracking columns on properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS vacant_since DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS total_vacancy_days INTEGER DEFAULT 0;

-- Track vacancy start/end
CREATE OR REPLACE FUNCTION track_vacancy_start()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'vacant' AND (OLD.status IS NULL OR OLD.status != 'vacant') THEN
    NEW.vacant_since = CURRENT_DATE;
  ELSIF NEW.status != 'vacant' THEN
    -- Accumulate vacancy days when property becomes occupied
    IF OLD.vacant_since IS NOT NULL THEN
      NEW.total_vacancy_days = COALESCE(OLD.total_vacancy_days, 0)
        + (CURRENT_DATE - OLD.vacant_since);
    END IF;
    NEW.vacant_since = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_vacancy_tracking
  BEFORE UPDATE OF status ON properties
  FOR EACH ROW EXECUTE FUNCTION track_vacancy_start();
