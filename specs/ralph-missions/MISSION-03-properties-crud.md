# Mission 03: Properties CRUD

## Overview
**Goal**: Enable owners to add, view, edit, and delete their rental properties.
**Dependencies**: Mission 02 (Auth & Profiles)
**Estimated Complexity**: Medium

## Success Criteria

### Phase A: Database Schema
- [ ] Create `properties` table with all fields
- [ ] Create `property_images` table for photos
- [ ] Set up RLS policies (owners see only their properties)
- [ ] Create Supabase Storage bucket for property images
- [ ] Generate TypeScript types from schema

### Phase B: Property List
- [ ] Create PropertiesScreen with FlatList
- [ ] Show property cards with image, address, status, rent
- [ ] Add pull-to-refresh
- [ ] Add empty state with "Add Property" CTA
- [ ] Implement property status badge (vacant/occupied)

### Phase C: Add Property
- [ ] Create AddPropertyScreen with multi-step form
- [ ] Step 1: Basic info (address, type, bedrooms, bathrooms)
- [ ] Step 2: Financials (rent amount, bond, payment frequency)
- [ ] Step 3: Photos (upload multiple images)
- [ ] Step 4: Review and save
- [ ] Address autocomplete using Google Places API
- [ ] Image compression before upload

### Phase D: Edit Property
- [ ] Create EditPropertyScreen (reuse form components)
- [ ] Pre-populate all fields
- [ ] Handle image additions/removals
- [ ] Optimistic UI updates

### Phase E: Property Details
- [ ] Create PropertyDetailScreen
- [ ] Show all property information
- [ ] Photo gallery with full-screen view
- [ ] Quick actions (edit, delete, create listing)
- [ ] Show current tenant (if occupied) - placeholder for now

### Phase F: Delete Property
- [ ] Add delete confirmation modal
- [ ] Soft delete (set deleted_at, don't remove)
- [ ] Cascade handling for related records (warn if has active tenancy)

### Phase G: Agent Infrastructure Foundation
- [ ] Create `packages/agent-core/` with shared types, tool catalog, and resilience configs
- [ ] Deploy agent database migration (all 9 agent tables + pgvector extension)
- [ ] Create `agent_preferences` defaults on property creation (auto-approve threshold, inspection frequency)
- [ ] Update `pnpm-workspace.yaml` and `turbo.json` for new package
- [ ] Generate TypeScript types for agent tables
- [ ] **No visible AI yet** — this phase is purely data infrastructure

**`packages/agent-core/` provides the foundation for ALL future agent operations:**
- 87 tool definitions with complete resilience configs (retry, circuit breaker, timeout, fallback, idempotency)
- 5 workflow compositions with checkpoint/resume/compensation
- 12 background task definitions (cron + event triggers)
- 6-category error taxonomy for failure classification
- Execution types (ToolExecutionRequest, ToolExecutionResult, SSE events, AgentRequest/Response)
- Autonomy resolution (NEVER_AUTO_EXECUTE, GRADUATED_AUTO_EXECUTE, risk matrix)
- Circuit breaker configs for 13 external services

These types are consumed by `workers/agent/` (M14) and `@casa/agent-client` (M14) to implement:
- Tool routing (which tools available at current mission level)
- Tool execution pipeline (autonomy → idempotency → circuit breaker → retry → fallback)
- Workflow orchestration (checkpoint, gate, compensation stack)
- Background task scheduling (cron triggers, event handlers)
- Client streaming (SSE events for real-time UI updates)

The agent tables deployed here store all runtime state:
- `agent_pending_actions` — approval queue (populated when tools are autonomy-gated)
- `agent_decisions` — audit trail with pgvector embeddings (for precedent search)
- `agent_trajectories` — recorded execution paths (for learning + optimization)
- `agent_rules` — learned constraints injected into system prompt
- `agent_corrections` — owner corrections (input for rule generation pipeline)
- `agent_background_tasks` — scheduled/triggered task status tracking

### Phase H: Testing
- [ ] Unit tests for property hooks and utilities
- [ ] Integration tests for CRUD operations
- [ ] E2E test: Add property → Edit → View → Delete
- [ ] Verify agent tables created with correct RLS policies

## Database Schema

```sql
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_properties_owner ON properties(owner_id) WHERE deleted_at IS NULL;
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
```

## Files to Create/Modify

### Agent Core Package (NEW) — Foundation for All Agent Operations
```
packages/agent-core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                       # All exports (types + constants)
│   ├── types/
│   │   ├── autonomy.ts                # AutonomyLevel, RiskLevel, ErrorCategory
│   │   ├── tools.ts                   # ToolDefinition (with resilience field)
│   │   ├── decisions.ts               # AgentDecision, AgentTrajectory
│   │   ├── rules.ts                   # AgentCorrection, GeneratedRule
│   │   ├── preferences.ts             # PropertyDefaults
│   │   ├── resilience.ts              # RetryConfig, CircuitBreakerConfig, TimeoutConfig, FallbackConfig, IdempotencyConfig
│   │   ├── workflows.ts               # WorkflowStep, WorkflowDefinition, WorkflowCheckpoint
│   │   └── execution.ts               # ToolExecutionRequest, ToolRouter, SSE events, AgentRequest/Response
│   └── constants/
│       ├── autonomy-defaults.ts       # NEVER_AUTO_EXECUTE, GRADUATED_AUTO_EXECUTE
│       ├── risk-matrix.ts             # ACTION_RISK_MATRIX (87 tools)
│       ├── tool-catalog.ts            # TOOL_CATALOG (87 complete tool definitions with resilience)
│       ├── circuit-breakers.ts        # CIRCUIT_BREAKER_CONFIGS (13 services)
│       ├── workflows.ts               # 5 workflow compositions (find tenant, onboard, etc.)
│       └── background-tasks.ts        # 12 background task definitions (cron + event)
```

### Database Migration (NEW)
```
supabase/migrations/
└── 20240101000004_agent_system.sql  # All 9 agent tables + pgvector
```

### Packages (API)
```
packages/api/src/
├── queries/
│   └── properties.ts           # Property CRUD functions
├── hooks/
│   ├── useProperties.ts        # List properties hook
│   ├── useProperty.ts          # Single property hook
│   └── usePropertyMutations.ts # Create/update/delete
└── types/
    └── database.ts             # Update with property + agent types
```

### Owner App
```
apps/owner/app/(app)/
├── properties/
│   ├── index.tsx               # Properties list
│   ├── [id].tsx                # Property details
│   ├── add.tsx                 # Add property (redirects to wizard)
│   ├── add/
│   │   ├── _layout.tsx         # Wizard layout
│   │   ├── basic-info.tsx      # Step 1
│   │   ├── financials.tsx      # Step 2
│   │   ├── photos.tsx          # Step 3
│   │   └── review.tsx          # Step 4
│   └── [id]/
│       └── edit.tsx            # Edit property

apps/owner/components/
├── PropertyCard.tsx            # Property list item
├── PropertyForm.tsx            # Shared form fields
├── ImagePicker.tsx             # Multi-image picker
├── AddressAutocomplete.tsx     # Google Places input
└── DeleteConfirmModal.tsx      # Confirmation dialog
```

### Shared UI
```
packages/ui/src/components/
├── Select.tsx                  # Dropdown select
├── NumberInput.tsx             # Numeric input with stepper
├── ImageGallery.tsx            # Photo gallery component
├── Badge.tsx                   # Status badge
├── Modal.tsx                   # Modal/dialog component
└── StepIndicator.tsx           # Multi-step progress
```

## Environment Variables
```
# Add to .env.local
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
```

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(properties): <description>

Mission-03: Properties CRUD
```

## Notes
- Use soft delete (deleted_at) to preserve data integrity
- Compress images client-side before upload (max 1MB)
- Primary image is shown in list view and as hero image
- Address autocomplete improves data quality and UX
- Consider adding property import from CSV in future mission

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`properties`, `property_images`, agent tables)
- [ ] RLS policies verified: owner can only CRUD own properties
- [ ] RLS policies verified: owner can only CRUD own property images
- [ ] `update_updated_at()` trigger works on properties table
- [ ] Foreign key `properties.owner_id` references `profiles(id)` with CASCADE delete
- [ ] Foreign key `property_images.property_id` references `properties(id)` with CASCADE delete
- [ ] Indexes created: `idx_properties_owner`, `idx_property_images_property`
- [ ] Soft delete (`deleted_at`) filters work correctly in queries
- [ ] Agent tables created with correct RLS policies (9 tables + pgvector)
- [ ] `agent_preferences` defaults created on property creation

### Feature Verification (Mission-Specific)
- [ ] Owner can add a new property via multi-step wizard (basic info, financials, photos, review)
- [ ] Address autocomplete returns suggestions from Google Places API
- [ ] Owner can upload multiple property images with compression
- [ ] Owner can set a primary image for the property
- [ ] Properties list displays all owner's properties with image, address, status, rent
- [ ] Pull-to-refresh works on properties list
- [ ] Empty state shows "Add Property" CTA when no properties exist
- [ ] Owner can view property details with photo gallery
- [ ] Owner can edit property fields and save changes
- [ ] Owner can delete a property (soft delete with confirmation modal)
- [ ] Delete warns if property has active tenancy
- [ ] Property status badge shows correctly (vacant/occupied)
- [ ] `packages/agent-core/` builds and exports all types correctly

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
