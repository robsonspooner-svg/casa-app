# Mission 04: Property Listings

## Overview
**Goal**: Enable owners to create rental listings for vacant properties and receive tenant applications.
**Dependencies**: Mission 03 (Properties CRUD)
**Estimated Complexity**: Medium

## Success Criteria

### Phase A: Database Schema
- [ ] Create `listings` table
- [ ] Create `listing_features` table for amenities
- [ ] Set up RLS policies
- [ ] Create listing status workflow (draft → active → closed)

### Phase B: Create Listing
- [ ] Create CreateListingScreen from property
- [ ] Auto-populate from property data
- [ ] Add listing-specific fields (available date, lease term, pets)
- [ ] Add features/amenities checklist
- [ ] Add custom description field
- [ ] Preview listing before publishing

### Phase C: Manage Listings
- [ ] Create ListingsScreen showing all owner's listings
- [ ] Filter by status (draft, active, closed)
- [ ] Show application count on active listings
- [ ] Quick actions (edit, pause, close)

### Phase D: Listing Details
- [ ] Create ListingDetailScreen
- [ ] Show full listing with all details
- [ ] Display application count and quick stats
- [ ] Link to view applications (placeholder)

### Phase E: Public Listing View (Tenant App)
- [ ] Create ListingSearchScreen for tenants
- [ ] Basic search by location, price, bedrooms
- [ ] Listing cards with key info
- [ ] Create PublicListingScreen for full details
- [ ] "Apply Now" button (links to Mission 05)

### Phase F: Vacancy Detection & Tier-Aware Prompts
- [ ] Detect when a tenancy ends (listen to `tenancy_status_change` trigger) and mark property as vacant
- [ ] Show "Property Vacant" banner on property card with days-since-vacant count
- [ ] For Starter tier: Show upgrade prompt offering tenant finding as add-on ($79/listing) or Pro upgrade
- [ ] For Pro/Hands-Off tier: Auto-prompt to create a new listing with AI-generated description
- [ ] Track vacancy duration per property (for performance analytics in Mission 13)
- [ ] Create `VacancyBanner` component with upgrade/action CTA
- [ ] Create `TenantFindingAddOn` purchase flow (links to Mission 07 add-on Stripe charge)

### Phase G: Testing
- [ ] Unit tests for listing hooks
- [ ] Integration tests for listing CRUD
- [ ] E2E test: Create listing → View as tenant → Search
- [ ] E2E test: Tenancy ends → Vacancy detected → Starter user sees upgrade prompt

## Database Schema

```sql
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Features/amenities
CREATE TABLE listing_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  UNIQUE(listing_id, feature)
);

-- Common features reference
CREATE TABLE feature_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  icon TEXT
);

-- Insert common features
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

-- RLS Policies
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_features ENABLE ROW LEVEL SECURITY;

-- Owners can manage their listings
CREATE POLICY "Owners can CRUD own listings"
  ON listings FOR ALL
  USING (auth.uid() = owner_id);

-- Anyone can view active listings
CREATE POLICY "Anyone can view active listings"
  ON listings FOR SELECT
  USING (status = 'active');

-- Features follow listing permissions
CREATE POLICY "Owners can CRUD own listing features"
  ON listing_features FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_features.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view features of active listings"
  ON listing_features FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_features.listing_id
      AND listings.status = 'active'
    )
  );

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
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── listings.ts             # Listing CRUD functions
│   └── features.ts             # Feature options
├── hooks/
│   ├── useListings.ts          # List owner's listings
│   ├── useListing.ts           # Single listing
│   ├── useListingMutations.ts  # Create/update/close
│   ├── usePublicListings.ts    # Search public listings
│   └── useFeatureOptions.ts    # Available features
└── types/
    └── database.ts             # Update with listing types
```

### Owner App
```
apps/owner/app/(app)/
├── listings/
│   ├── index.tsx               # Listings list
│   ├── create.tsx              # Create from property
│   └── [id]/
│       ├── index.tsx           # Listing details
│       └── edit.tsx            # Edit listing

apps/owner/components/
├── ListingCard.tsx             # Listing list item
├── ListingForm.tsx             # Create/edit form
├── FeatureSelector.tsx         # Amenities checklist
└── ListingPreview.tsx          # Preview before publish
```

### Tenant App
```
apps/tenant/app/(app)/
├── search/
│   ├── index.tsx               # Search/browse listings
│   └── [id].tsx                # Public listing view

apps/tenant/components/
├── ListingCard.tsx             # Search result card
├── SearchFilters.tsx           # Filter controls
└── ListingGallery.tsx          # Photo gallery
```

### Shared UI
```
packages/ui/src/components/
├── Checkbox.tsx                # Checkbox component
├── CheckboxGroup.tsx           # Multiple checkboxes
├── DatePicker.tsx              # Date selection
├── Chip.tsx                    # Feature/tag chips
└── SearchInput.tsx             # Search with icon
```

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(listings): <description>

Mission-04: Property Listings
```

## Agent Integration (First Visible AI)

### Tool: `generate_listing` (Autonomy: L2 Draft)
The agent generates listing copy from property data. This is the **first visible AI** in the app.

**UI**: "Generate description" button on the CreateListingScreen that calls the agent to draft:
- Title (catchy, SEO-friendly)
- Description (highlights key features, neighbourhood, lifestyle)
- Rent price suggestion (based on comparable properties)

**Flow**:
1. Owner clicks "Generate description"
2. Agent receives property data (bedrooms, features, suburb, photos)
3. Claude generates listing copy
4. Owner edits/approves → trajectory recorded in `agent_trajectories`
5. Each edit teaches the agent owner's style preferences

**Files**:
```
packages/agent-client/src/   # Created if not yet existing
├── hooks/
│   └── useGenerateListing.ts  # Calls agent endpoint for listing generation
└── components/
    └── GenerateButton.tsx     # "Generate with AI" button component
```

### Agent Tools Available at This Mission

The following tools from the tool catalog become available at Mission 04:

| Name | Category | Autonomy | Risk | Description |
|------|----------|----------|------|-------------|
| `get_listings` | query | L4 Autonomous | None | Get listings with view/enquiry/application counts |
| `create_listing` | action | L2 Draft | Medium | Create new property listing (draft) |
| `publish_listing` | action | L3 Suggest | Medium | Publish draft listing to portals |
| `pause_listing` | action | L2 Draft | Low | Pause an active listing |
| `update_listing` | action | L2 Draft | Low | Update listing details |
| `generate_listing` | generate | L2 Draft | None | Generate listing copy from property data and photos |
| `suggest_rent_price` | generate | L2 Draft | None | Suggest optimal rent from comparables |
| `syndicate_listing_domain` | integration | L3 Suggest | Medium | Post/update listing on Domain.com.au |
| `syndicate_listing_rea` | integration | L3 Suggest | Medium | Post/update listing on realestate.com.au |
| `workflow_find_tenant` | workflow | L3 Suggest | Medium | Full workflow: list -> syndicate -> screen -> recommend |

#### Background Tasks Triggered at This Mission

| Task | Schedule | Description |
|------|----------|-------------|
| `listing_performance` | Friday 5pm | Reviews listing metrics (views, enquiries, applications) and suggests optimizations |

## Vacancy Detection Implementation

When a tenancy ends (status changes to `ended` or `terminated`), the existing `update_property_status_on_tenancy` trigger (Mission 06) sets `properties.status = 'vacant'`. Mission 04 adds the UI layer:

```typescript
// packages/api/src/hooks/useVacancyPrompt.ts

interface VacancyPrompt {
  isVacant: boolean;
  daysSinceVacant: number;
  canCreateListing: boolean;  // Pro/Hands-Off: true, Starter: needs add-on
  addOnAvailable: boolean;    // Starter: can purchase tenant finding
  previousTenancy?: Tenancy;  // For context in AI-generated listing
}

export function useVacancyPrompt(propertyId: string): VacancyPrompt {
  // Queries property status + last tenancy + owner's tier
  // Returns prompt data for VacancyBanner component
}
```

```typescript
// apps/owner/components/VacancyBanner.tsx

// Starter tier view:
// ┌─────────────────────────────────────────────────┐
// │  🏠 Property Vacant (14 days)                   │
// │                                                  │
// │  Find your next tenant with Casa's AI-powered    │
// │  listing service.                                │
// │                                                  │
// │  [Purchase Tenant Finding — $79]  [Upgrade to Pro]│
// └─────────────────────────────────────────────────┘

// Pro/Hands-Off tier view:
// ┌─────────────────────────────────────────────────┐
// │  🏠 Property Vacant (14 days)                   │
// │                                                  │
// │  Ready to find a new tenant? Casa AI can         │
// │  generate a listing from your property data.     │
// │                                                  │
// │  [Create Listing with AI]                        │
// └─────────────────────────────────────────────────┘
```

### Database Addition
```sql
-- Track vacancy periods for analytics
ALTER TABLE properties ADD COLUMN IF NOT EXISTS vacant_since DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS total_vacancy_days INTEGER DEFAULT 0;

-- Update vacant_since when property becomes vacant
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
```

## Phase 2: Marketplace Enhancement (Post-Mission 14)

The Casa in-app marketplace is **one of several paths** into a tenancy — alongside Domain/REA listings, personal arrangements, connection codes, and direct invitations. All paths converge through the same compliant tenancy creation flow.

### Phase 2A: Advanced Search & Filters

**File**: `apps/tenant/app/(app)/search/index.tsx` (modify existing)
**File**: `packages/api/src/hooks/usePublicListings.ts` (modify existing)

Enhanced search with:
- Filter: property type, beds, baths, parking, pets allowed, furnished, specific features
- Sort: newest first, price (low-high / high-low), distance from location
- Price range slider (min/max)
- Location autocomplete with suburb suggestions
- "Clear filters" and active filter chips

```typescript
interface ListingSearchFilters {
  suburb?: string;
  propertyType?: PropertyType;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  minParking?: number;
  minRent?: number;
  maxRent?: number;
  petsAllowed?: boolean;
  furnished?: boolean;
  features?: string[];
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'distance';
  latitude?: number;
  longitude?: number;
}
```

### Phase 2B: Saved Searches + Alerts

**File**: `packages/api/src/hooks/useSavedSearches.ts` (new)
**File**: `apps/tenant/app/(app)/search/saved.tsx` (new)

```sql
-- Add to marketplace_enhancements migration
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,        -- ListingSearchFilters
  alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_alerted_at TIMESTAMPTZ,
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own saved searches" ON saved_searches FOR ALL USING (auth.uid() = user_id);
```

- Save current search as named alert
- Heartbeat checks new listings against saved searches
- Push notification on new match
- Manage saved searches (rename, delete, toggle alerts)

### Phase 2C: Listing Detail Improvements

**File**: `apps/tenant/app/(app)/search/[id].tsx` (modify existing)

- Image carousel with pinch-to-zoom
- Save/favourite button (persisted)
- Share listing (native share sheet)
- "Similar listings" section at bottom

```sql
-- Add to marketplace_enhancements migration
CREATE TABLE listing_favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX idx_listing_favourites_user ON listing_favourites(user_id);

ALTER TABLE listing_favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own favourites" ON listing_favourites FOR ALL USING (auth.uid() = user_id);
```

### Phase 2D: Tenant Home — Featured Listings

**File**: `apps/tenant/app/(app)/(tabs)/index.tsx` (modify existing)

- "Listings for You" section on tenant home screen
- Based on tenant's availability preferences (from `tenant_availability` table)
- Shows top 3-5 matching listings
- "See All" link to filtered search results

### Testing for Phase 2
- [ ] Advanced filters work correctly (all filter combinations)
- [ ] Sort order applies correctly
- [ ] Saved search persists and alerts trigger on new matching listings
- [ ] Favourites persist across sessions
- [ ] Share generates correct deep link
- [ ] Featured listings on tenant home match availability preferences
- [ ] Image carousel renders correctly with multiple images

## Notes
- Listings are separate from properties to allow multiple listings over time
- View count helps owners gauge interest
- Application count updated via trigger in Mission 05
- Agent-generated descriptions are editable drafts, never auto-published
- Vacancy detection prompts Starter users to upgrade or purchase tenant finding add-on
- Pro/Hands-Off users get streamlined listing creation with AI
- The in-app marketplace is one of several paths into a tenancy (alongside Domain/REA, connection codes, direct invites, personal arrangements)

## Implementation Status (Mission 04 — COMPLETED)

The following phases were fully implemented:
- Phase A: Database schema (listings, listing_features, feature_options, vacancy columns, triggers, RLS, indexes)
- Phase B: Create listing (multi-step form with property selection, details, policies/features, review)
- Phase C: Manage listings (list with status filters, listing cards with stats)
- Phase D: Listing details (full detail view with publish/pause/close/delete actions)
- Phase E: Public listing view (tenant search by suburb, listing detail with view count tracking)
- Phase G: Unit tests (useListings, useListingMutations, useFeatureOptions — 13 tests)
- Portal sync columns (domain_listing_id, rea_listing_id, sync statuses) added to schema

### Portal Syndication — IMPLEMENTED (January 2026)

**packages/integrations/** created with:
- `src/domain/client.ts` — Domain.com.au API client with OAuth, listing CRUD, property type mapping
- `src/rea/client.ts` — REA (realestate.com.au) API client with OAuth2 token management, listing CRUD
- `src/shared/types.ts` — Shared portal listing types, sync result types
- `src/index.ts` — Package exports

**Supabase Edge Function** created:
- `supabase/functions/sync-listing-to-portals/index.ts` — Syncs listings to Domain and REA on publish/update
  - Authenticated via JWT
  - Maps Casa listing to portal formats
  - Updates sync status in database
  - Supports create, update, delete actions

**Pre-Launch Requirements** (external accounts needed):
1. ⬜ Register for Domain Partner API access (apply at developer.domain.com.au)
2. ⬜ Apply for REA API partnership (requires licensed agent verification)
3. ⬜ Set environment variables: `DOMAIN_API_KEY`, `DOMAIN_AGENT_ID`, `REA_API_KEY`, `REA_API_SECRET`, `REA_AGENT_ID`
4. ⬜ Deploy Edge Functions to production Supabase

### Deferred to Future Missions:
| Item | Deferred To | Reason |
|------|------------|--------|
| VacancyBanner + useVacancyPrompt | Mission 06 | Depends on tenancy lifecycle triggers |
| TenantFindingAddOn purchase | Mission 06 + 07 | Depends on tenancy status + Stripe |
| useGenerateListing + GenerateButton | Mission 14 | Depends on agent infrastructure |
| Cloudinary image hosting | Pre-Launch (Optional) | Using Supabase Storage for MVP |

---

## Third-Party Integrations (CRITICAL FOR LAUNCH)

### Portal Syndication
**Why**: Properties MUST appear on Domain and realestate.com.au to attract tenants. Without portal syndication, owners cannot find tenants.

#### Domain API Integration
| Aspect | Details |
|--------|---------|
| **API** | Domain Listings API (REST) |
| **Purpose** | Publish listings to domain.com.au |
| **Requirements** | Agency account OR XML feed setup |
| **Endpoint** | `https://api.domain.com.au/v1/listings` |
| **Auth** | OAuth 2.0 + API key |
| **Pricing** | Per-listing fee (varies by area) |

**Implementation Tasks**:
- [ ] Register for Domain Partner API access
- [ ] Create `packages/integrations/src/domain.ts` service
- [ ] Map Casa listing schema to Domain listing format
- [ ] Handle listing create/update/delete sync
- [ ] Store Domain listing ID in `listings` table
- [ ] Implement webhook for listing status updates

**Database Addition**:
```sql
ALTER TABLE listings ADD COLUMN domain_listing_id TEXT;
ALTER TABLE listings ADD COLUMN domain_sync_status TEXT DEFAULT 'not_synced';
ALTER TABLE listings ADD COLUMN domain_last_synced_at TIMESTAMPTZ;
```

#### REA (realestate.com.au) API Integration
| Aspect | Details |
|--------|---------|
| **API** | REA Group Listings API (REST) |
| **Purpose** | Publish listings to realestate.com.au |
| **Requirements** | Agent license verification required |
| **Alternative** | REAXML feed if API access denied |
| **Auth** | API key + OAuth 2.0 |

**Implementation Tasks**:
- [ ] Apply for REA API partnership (may require licensed agent)
- [ ] Create `packages/integrations/src/rea.ts` service
- [ ] Implement REAXML feed as fallback
- [ ] Map Casa listing schema to REA format
- [ ] Handle photo uploads to REA CDN
- [ ] Store REA listing ID

**Database Addition**:
```sql
ALTER TABLE listings ADD COLUMN rea_listing_id TEXT;
ALTER TABLE listings ADD COLUMN rea_sync_status TEXT DEFAULT 'not_synced';
ALTER TABLE listings ADD COLUMN rea_last_synced_at TIMESTAMPTZ;
```

### Image Hosting (Cloudinary)
| Aspect | Details |
|--------|---------|
| **API** | Cloudinary Upload API |
| **Purpose** | Optimized image hosting for listings |
| **Benefits** | CDN delivery, auto-resize, format optimization |
| **Alternative** | Supabase Storage (used initially) |

**Implementation Tasks**:
- [ ] Create Cloudinary account
- [ ] Create `packages/integrations/src/cloudinary.ts` service
- [ ] Implement image upload with transformations
- [ ] Auto-generate listing photo sizes (thumbnail, card, full)
- [ ] Update listing photo URLs to Cloudinary

**Note**: Can use Supabase Storage for MVP and migrate to Cloudinary later for cost optimization.

### Environment Variables
```bash
# Domain API
DOMAIN_API_KEY=xxx
DOMAIN_CLIENT_ID=xxx
DOMAIN_CLIENT_SECRET=xxx

# REA API
REA_API_KEY=xxx
REA_AGENCY_ID=xxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

### Files to Create for Integrations
```
packages/integrations/          # New package
├── package.json
├── src/
│   ├── index.ts
│   ├── domain/
│   │   ├── client.ts          # Domain API client
│   │   ├── types.ts           # Domain listing types
│   │   └── mapper.ts          # Casa → Domain mapping
│   ├── rea/
│   │   ├── client.ts          # REA API client
│   │   ├── types.ts           # REA listing types
│   │   ├── mapper.ts          # Casa → REA mapping
│   │   └── reaxml.ts          # XML feed generator
│   └── cloudinary/
│       ├── client.ts          # Cloudinary client
│       └── transforms.ts      # Image transformations

supabase/functions/
├── sync-listing-to-portals/   # Sync listing on publish
│   └── index.ts
└── portal-webhook/            # Handle portal callbacks
    └── index.ts
```

### Integration Priority
| Integration | Priority | MVP Required | Notes |
|-------------|----------|--------------|-------|
| Domain API | P1 | Yes | Critical for tenant acquisition |
| REA API | P1 | Yes | Critical for tenant acquisition |
| Cloudinary | P3 | No | Use Supabase Storage initially |

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`listings`, `listing_features`, `feature_options`)
- [ ] RLS policies verified: owners can CRUD own listings
- [ ] RLS policies verified: anyone can view active listings (SELECT only)
- [ ] RLS policies verified: feature permissions follow listing ownership
- [ ] `update_updated_at()` trigger works on listings table
- [ ] `increment_listing_views()` function works correctly
- [ ] `track_vacancy_start()` trigger tracks vacancy periods on status change
- [ ] Foreign keys correct: `listings.property_id`, `listings.owner_id`
- [ ] Indexes created: `idx_listings_property`, `idx_listings_owner`, `idx_listings_status`, `idx_listings_search`
- [ ] Portal sync columns added (`domain_listing_id`, `rea_listing_id`, sync statuses)
- [ ] `feature_options` seeded with default amenities

### Feature Verification (Mission-Specific)
- [ ] Owner can create a listing from an existing property (auto-populates data)
- [ ] Listing form captures: title, description, available date, lease term, rent, pets, smoking, furnished
- [ ] Features/amenities checklist works (select/deselect)
- [ ] Listing preview displays correctly before publishing
- [ ] Owner can publish listing (status: draft -> active)
- [ ] Owner can pause and close active listings
- [ ] Listings list shows all owner's listings with status filter
- [ ] Application count displays on active listings
- [ ] Tenant app can search listings by location, price, bedrooms
- [ ] Tenant app can view full listing details (public view)
- [ ] "Apply Now" button visible on active listings in tenant app
- [ ] Vacancy banner appears when property becomes vacant
- [ ] Starter tier sees upgrade prompt / add-on purchase CTA on vacancy
- [ ] Pro/Hands-Off tier sees "Create Listing with AI" CTA on vacancy
- [ ] AI-generated listing description works via agent endpoint (generate_listing tool)

### Visual & UX
- [ ] Tested on physical iOS device via Expo Go
- [ ] UI matches BRAND-AND-UI.md design system
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes

### Regression (All Prior Missions)
- [ ] All prior mission critical paths still work (see TESTING-METHODOLOGY.md Section 4)
- [ ] Navigation between all existing screens works
- [ ] Previously created data still loads correctly
- [ ] No new TypeScript errors in existing code

### Auth & Security
- [ ] Authenticated routes redirect unauthenticated users
- [ ] User can only access their own data (RLS verified)
- [ ] Session persists across app restarts
- [ ] No sensitive data in logs or error messages
