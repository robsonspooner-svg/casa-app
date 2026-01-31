-- Mission 04 Enhancement: Marketplace Features
-- Saved searches, favourites, and direct invitations

-- =============================================================================
-- Saved Searches (tenant saves a filter set and gets notified on new matches)
-- =============================================================================
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  -- filters shape: { suburb?, minRent?, maxRent?, minBedrooms?, propertyType?, pets?, furnished? }
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved searches"
  ON saved_searches
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

-- =============================================================================
-- Favourite Listings (tenant saves individual listings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS favourite_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE favourite_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favourites"
  ON favourite_listings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_favourite_listings_user ON favourite_listings(user_id);
CREATE INDEX idx_favourite_listings_listing ON favourite_listings(listing_id);

-- =============================================================================
-- Direct Invitations (owner invites tenant by email with lease terms)
-- =============================================================================
CREATE TABLE IF NOT EXISTS direct_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_email TEXT NOT NULL,
  tenant_name TEXT,
  rent_amount NUMERIC(10,2) NOT NULL,
  rent_frequency TEXT NOT NULL DEFAULT 'weekly',
  lease_start_date DATE,
  lease_end_date DATE,
  bond_weeks INTEGER NOT NULL DEFAULT 4,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE direct_invitations ENABLE ROW LEVEL SECURITY;

-- Owners can manage their invitations
CREATE POLICY "Owners can manage their invitations"
  ON direct_invitations
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Tenants can view invitations sent to their email
CREATE POLICY "Tenants can view invitations to their email"
  ON direct_invitations
  FOR SELECT
  USING (
    tenant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR auth.uid() = owner_id
  );

-- Tenants can accept/decline invitations sent to them
CREATE POLICY "Tenants can respond to invitations"
  ON direct_invitations
  FOR UPDATE
  USING (
    tenant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    tenant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE INDEX idx_direct_invitations_owner ON direct_invitations(owner_id);
CREATE INDEX idx_direct_invitations_email ON direct_invitations(tenant_email);
CREATE INDEX idx_direct_invitations_status ON direct_invitations(status);

-- =============================================================================
-- Add sort/filter helper columns to listings (if missing)
-- =============================================================================

-- Add view_count and application_count if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'view_count') THEN
    ALTER TABLE listings ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'application_count') THEN
    ALTER TABLE listings ADD COLUMN application_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'is_featured') THEN
    ALTER TABLE listings ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Updated_at trigger for saved_searches
CREATE OR REPLACE FUNCTION update_saved_search_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_search_updated_at();

-- Updated_at trigger for direct_invitations
CREATE OR REPLACE FUNCTION update_direct_invitation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER direct_invitations_updated_at
  BEFORE UPDATE ON direct_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_direct_invitation_updated_at();
