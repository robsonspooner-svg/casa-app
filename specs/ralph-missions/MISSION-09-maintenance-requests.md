# Mission 09: Maintenance Requests

## Overview
**Goal**: Enable tenants to submit maintenance requests and owners to manage repairs efficiently.
**Dependencies**: Mission 06 (Tenancies)
**Estimated Complexity**: Medium

## Success Criteria

### Phase A: Database Schema
- [ ] Create `maintenance_requests` table
- [ ] Create `maintenance_images` table
- [ ] Create `maintenance_comments` table
- [ ] Set up RLS policies

### Phase B: Submit Request (Tenant App)
- [ ] Create MaintenanceRequestScreen
- [ ] Category selection (plumbing, electrical, appliance, etc.)
- [ ] Urgency level (emergency, urgent, routine)
- [ ] Description with rich text
- [ ] Photo/video upload
- [ ] Location in property (room selection)
- [ ] Preferred contact times
- [ ] Submit and track

### Phase C: My Requests (Tenant App)
- [ ] Create MyMaintenanceScreen
- [ ] List all requests with status
- [ ] Filter by status (open, in progress, completed)
- [ ] View request details and updates
- [ ] Add comments/photos to existing requests

### Phase D: Request Management (Owner App)
- [ ] Create MaintenanceScreen (all requests)
- [ ] Filter by property, status, urgency
- [ ] Sort by date, urgency
- [ ] Quick actions (assign, update status)
- [ ] Emergency request alerts

### Phase E: Request Details (Owner App)
- [ ] Create MaintenanceDetailScreen
- [ ] View full request with all media
- [ ] Communication thread with tenant
- [ ] Status updates with timestamps
- [ ] Assign to tradesperson (links to Mission 10)
- [ ] Record costs and receipts

### Phase F: Status Workflow
- [ ] Status flow: submitted → acknowledged → in_progress → completed
- [ ] Notifications on status change
- [ ] Completion confirmation from tenant
- [ ] Satisfaction rating

### Phase G: Emergency Handling
- [ ] Emergency request flagging
- [ ] Immediate notification to owner
- [ ] Emergency contact escalation
- [ ] After-hours handling guidance

### Phase H: Testing
- [ ] Unit tests for request hooks
- [ ] Integration tests for request flow
- [ ] E2E test: Submit request → Owner responds → Mark complete

## Database Schema

```sql
-- Maintenance category enum
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

-- Urgency level enum
CREATE TYPE maintenance_urgency AS ENUM (
  'emergency',   -- Immediate attention (water leak, no power, etc.)
  'urgent',      -- Within 24-48 hours
  'routine'      -- Standard timeframe
);

-- Request status enum
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

-- Maintenance requests
CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Request details
  category maintenance_category NOT NULL,
  urgency maintenance_urgency NOT NULL DEFAULT 'routine',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_in_property TEXT, -- e.g., "Master bathroom", "Kitchen"

  -- Contact preferences
  preferred_contact_method TEXT DEFAULT 'app' CHECK (preferred_contact_method IN ('app', 'phone', 'email')),
  preferred_times TEXT, -- e.g., "Weekday mornings"
  access_instructions TEXT,

  -- Status
  status maintenance_status NOT NULL DEFAULT 'submitted',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_changed_by UUID REFERENCES profiles(id),

  -- Assignment
  assigned_to UUID REFERENCES profiles(id), -- Owner or tradesperson
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

-- Request images/videos
CREATE TABLE maintenance_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),

  -- File details
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image' or 'video'
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,

  -- Metadata
  caption TEXT,
  is_before BOOLEAN NOT NULL DEFAULT TRUE, -- Before vs after repair
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments/communication thread
CREATE TABLE maintenance_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),

  -- Comment content
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE, -- Owner-only notes

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

-- Status history for audit trail
CREATE TABLE maintenance_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  old_status maintenance_status,
  new_status maintenance_status NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_maintenance_tenancy ON maintenance_requests(tenancy_id);
CREATE INDEX idx_maintenance_property ON maintenance_requests(property_id);
CREATE INDEX idx_maintenance_tenant ON maintenance_requests(tenant_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_maintenance_urgency ON maintenance_requests(urgency, created_at) WHERE status = 'submitted';
CREATE INDEX idx_maintenance_images ON maintenance_images(request_id);
CREATE INDEX idx_maintenance_comments ON maintenance_comments(request_id, created_at);

-- RLS Policies
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_status_history ENABLE ROW LEVEL SECURITY;

-- Tenants can create and view own requests
CREATE POLICY "Tenants can create requests"
  ON maintenance_requests FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Tenants can view own requests"
  ON maintenance_requests FOR SELECT
  USING (auth.uid() = tenant_id);

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

-- Images follow request permissions
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

CREATE POLICY "Users can upload images to own requests"
  ON maintenance_images FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- Comments: tenants see non-internal, owners see all
CREATE POLICY "Tenants can view non-internal comments"
  ON maintenance_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM maintenance_requests
      WHERE maintenance_requests.id = maintenance_comments.request_id
      AND maintenance_requests.tenant_id = auth.uid()
    )
  );

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

CREATE POLICY "Users can add comments"
  ON maintenance_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Status history follows request permissions
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

-- Trigger to log status changes
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

-- Updated_at trigger
CREATE TRIGGER maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── maintenance.ts          # Request CRUD
│   └── maintenanceComments.ts  # Comments CRUD
├── hooks/
│   ├── useMaintenance.ts       # List requests
│   ├── useMaintenanceRequest.ts # Single request
│   ├── useMyMaintenance.ts     # Tenant's requests
│   └── useMaintenanceMutations.ts
└── types/
    └── maintenance.ts          # Maintenance types
```

### Tenant App
```
apps/tenant/app/(app)/
├── maintenance/
│   ├── index.tsx               # My requests list
│   ├── new.tsx                 # Submit new request
│   └── [id]/
│       ├── index.tsx           # Request details
│       └── add-media.tsx       # Add photos/video

apps/tenant/components/
├── MaintenanceCard.tsx         # Request list item
├── MaintenanceForm.tsx         # Submit form
├── CategoryPicker.tsx          # Category selection
├── UrgencyPicker.tsx           # Urgency selection
├── MediaUploader.tsx           # Photo/video upload
└── CommentThread.tsx           # Communication thread
```

### Owner App
```
apps/owner/app/(app)/
├── maintenance/
│   ├── index.tsx               # All requests
│   └── [id]/
│       ├── index.tsx           # Request details
│       ├── assign.tsx          # Assign tradesperson
│       └── complete.tsx        # Mark complete

apps/owner/components/
├── MaintenanceList.tsx         # Request list with filters
├── MaintenanceFilters.tsx      # Filter controls
├── StatusUpdater.tsx           # Change status
├── CostRecorder.tsx            # Record costs
├── EmergencyAlert.tsx          # Emergency notification
└── InternalNotes.tsx           # Owner-only notes
```

### Shared UI
```
packages/ui/src/components/
├── UrgencyBadge.tsx            # Urgency indicator
├── StatusBadge.tsx             # Status indicator
├── MediaGallery.tsx            # Photo/video gallery
├── CommentInput.tsx            # Comment composer
└── RatingInput.tsx             # Star rating input
```

## Emergency Contact Flow

```
1. Tenant submits emergency request
   ↓
2. Push notification to owner (immediate)
   ↓
3. If no response in 15 mins → SMS alert
   ↓
4. If no response in 30 mins → Show emergency contacts
   - After-hours plumber
   - Electrician
   - Property manager (if applicable)
```

## Agent Integration (Mission 14)

This mission's data is consumed by Mission 14's AI agent. The following tools in `agent-core/src/constants/tool-catalog.ts` interact with this mission's tables:

| Tool | Table | Action | Notes |
|------|-------|--------|-------|
| `get_maintenance` | maintenance_requests | Query | Status enum must match `maintenance_status` |
| `get_maintenance_detail` | maintenance_requests + images + comments | Query | Deep join |
| `create_maintenance_request` | maintenance_requests | Insert | Agent can create on behalf of tenant |
| `update_maintenance_status` | maintenance_requests | Update | Status transitions must match enum |
| `triage_maintenance` | maintenance_requests | Update | AI categorization and urgency assessment |

**Circular FK Note**: The `trade_id` column has no FK constraint in this migration. Mission 10 adds the `trades` table and a separate `ALTER TABLE` to add the FK constraint. Do NOT add `REFERENCES trades(id)` in this migration.

**Status Enum Alignment**: The `maintenance_status` enum values (`submitted`, `acknowledged`, `awaiting_quote`, `approved`, `scheduled`, `in_progress`, `completed`, `cancelled`, `on_hold`) are the source of truth. The agent-core tool catalog has been aligned to match.

---

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(maintenance): <description>

Mission-09: Maintenance Requests
```

### Agent Tools Available at This Mission

The following tools from the tool catalog become available at Mission 09:

| Name | Category | Autonomy | Risk | Description |
|------|----------|----------|------|-------------|
| `get_maintenance` | query | L4 Autonomous | None | Get maintenance requests filtered by property/status/urgency |
| `get_maintenance_detail` | query | L4 Autonomous | None | Full maintenance request: quotes, photos, comments, timeline |
| `create_maintenance` | action | L2 Draft | Low | Create new maintenance request |
| `update_maintenance_status` | action | L2 Draft | Low | Update maintenance request status |
| `triage_maintenance` | generate | L1 Execute | None | Categorize urgency, estimate cost, suggest action |
| `estimate_cost` | generate | L1 Execute | None | Estimate maintenance cost from description + market rates |
| `workflow_maintenance_lifecycle` | workflow | L2 Draft | Medium | Full maintenance: report -> triage -> quote -> approve -> complete |

#### Background Tasks Triggered at This Mission

| Task | Schedule | Description |
|------|----------|-------------|
| `maintenance_triage` | Event-driven | Triggers on new maintenance request submission, auto-triages urgency and suggests initial actions |

## Agent-Driven Maintenance Workflow (How Casa Handles It)

> This section describes the full conversational workflow the agent follows when a maintenance request is submitted. See `specs/AGENT-SPEC.md` Section 5 for the detailed lifecycle. This mission must build the database, UI, and hooks that enable this workflow.

### First Maintenance Issue — Owner Preference Gathering

When the **first ever** maintenance request is submitted for a property, the agent asks the owner how they want to handle maintenance:

```
[Casa] A maintenance request has been submitted for [property]:
  Category: [category] | Urgency: [urgency]
  Issue: "[description]"
  Tenant preferred times: [times]

How would you like to handle maintenance for this property?

  [Find me a trade]    [I'll handle it myself]    [I have a preferred trade]
```

**Three owner response paths:**

1. **"Find me a trade"** → Agent asks for budget threshold, then triggers trade discovery (Mission 10 `find_local_trades` → `create_service_provider` → `send_work_order`). Agent remembers threshold via `remember` tool.

2. **"I'll handle it myself"** → Agent acknowledges the request, notifies tenant that owner is looking into it, asks if future maintenance should be agent-managed. Stores preference.

3. **"I have a preferred trade"** → Agent collects trade details (name, phone, email), calls `create_service_provider` + `add_trade_to_network`, sets as default for that category on this property. Offers to contact trade immediately.

### Subsequent Maintenance Requests

For subsequent requests, the agent uses stored preferences:
- Recalls preferred trade for category + property via `recall`
- If preferred trade exists: offers to contact them directly
- If no preferred trade but "find me a trade" preference: auto-starts discovery
- If "handle myself" preference: notifies owner with details and stands by
- Always surfaces the request with category, urgency, description, tenant availability

### Tenant Availability Integration

The `preferred_times` and `access_instructions` fields on `maintenance_requests` are critical for scheduling. When the agent coordinates with trades (Mission 10), it uses these fields to:
- Filter trade availability against tenant availability
- Include access details in work order communications
- Confirm scheduled times with both parties

### Emergency Handling

Emergency requests bypass the normal flow:
- Owner immediately notified (push notification + chat message)
- If emergency trade preference exists: agent contacts trade immediately (even on Hands-off autonomy)
- If no emergency trade: agent provides emergency contact list and offers to search
- Tenant advised of emergency procedures

### Schema Requirements for Agent Workflow

The following columns are critical for agent operation:
- `preferred_times TEXT` — Tenant's availability (used for scheduling)
- `access_instructions TEXT` — How the trade accesses the property
- `urgency maintenance_urgency` — Drives agent triage and escalation timing
- `status maintenance_status` — Agent transitions through the full lifecycle
- `trade_id UUID` — Populated by Mission 10 when trade is assigned
- `cost_estimate DECIMAL` — From `estimate_cost` tool, compared against owner threshold
- `actual_cost DECIMAL` — From completed work order, feeds into financial tracking

## Notes
- Emergency requests need immediate owner notification
- Tenants cannot set cost responsibility (owner-only field)
- Internal notes help owners track without tenant visibility
- Photo evidence critical for insurance claims
- Integration with trade scheduling (Mission 10) enables full autonomous lifecycle
- Status history important for compliance documentation
- Satisfaction ratings feed into property analytics
- AI-transparent: external communication to trades must appear from owner, never AI

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`maintenance_requests`, `maintenance_images`, `maintenance_comments`, `maintenance_status_history`)
- [ ] RLS policies verified: tenants can create and view own requests
- [ ] RLS policies verified: owners can manage requests for their properties
- [ ] RLS policies verified: internal comments hidden from tenants
- [ ] `log_maintenance_status_change()` trigger creates status history entries
- [ ] `update_updated_at()` trigger works on maintenance_requests
- [ ] Indexes created for property, tenant, status, and urgency queries
- [ ] Foreign keys correct: tenancy_id, property_id, tenant_id (CASCADE)
- [ ] Storage bucket for maintenance images configured with correct access policies

### Feature Verification (Mission-Specific)
- [ ] Tenant can submit a new maintenance request with category and urgency
- [ ] Tenant can add description, photos, and preferred contact times
- [ ] Tenant can specify location in property (room selection)
- [ ] Photo/video upload works with preview
- [ ] Tenant can view all their requests with status filter
- [ ] Tenant can add comments/photos to existing requests
- [ ] Owner sees all maintenance requests with property/status/urgency filters
- [ ] Owner can acknowledge a request (status: submitted -> acknowledged)
- [ ] Owner can update request status through full workflow
- [ ] Owner can add internal notes (not visible to tenant)
- [ ] Owner can record estimated and actual costs
- [ ] Emergency requests trigger immediate push notification to owner
- [ ] Emergency escalation flow works (15 min -> SMS, 30 min -> emergency contacts)
- [ ] Tenant receives notification on status changes
- [ ] Tenant can confirm completion and rate satisfaction (1-5 stars)
- [ ] Status history audit trail displays correctly

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


---

## Gateway Implementation (Pre-Built)

> The following gateway infrastructure was created in Mission 07 to facilitate this mission:

### Files Created
- `packages/api/src/hooks/gateways/useMaintenanceGateway.ts` — Hook with navigation entry points and placeholder state
- `packages/api/src/types/gateways.ts` — Type definitions for `MaintenanceRequest`, `MaintenanceImage`, `MaintenanceComment`, etc.

### What's Already Done
1. **Types defined**: All TypeScript interfaces for maintenance entities including:
   - `MaintenanceRequest` with full field definitions
   - `MaintenanceCategory` (plumbing, electrical, appliance, hvac, structural, pest, locks, garden, cleaning, other)
   - `MaintenanceUrgency` (emergency, urgent, routine)
   - `MaintenanceStatus` (submitted → acknowledged → awaiting_quote → approved → scheduled → in_progress → completed)
2. **Gateway hook**: `useMaintenanceGateway(tenancyId?)` provides:
   - Navigation functions: `navigateToMaintenanceList()`, `navigateToMaintenanceDetail()`, `navigateToCreateMaintenance()`
   - Action stubs: `submitRequest()`, `acknowledgeRequest()`, `updateStatus()`
   - Placeholder state with categories and urgency levels
3. **Exported from `@casa/api`**: Import directly in components

### What This Mission Needs to Do
1. Create database migration with tables defined in this spec
2. Implement the real Supabase queries in the gateway hook
3. Replace placeholder returns with actual data fetching
4. Connect navigation functions to real Expo Router routes
5. Build the UI screens using the pre-defined types and hook interface

### Usage Example (Already Works)
```typescript
import { useMaintenanceGateway, MaintenanceCategory } from '@casa/api';

function MaintenanceScreen() {
  const { items, categories, navigateToCreateMaintenance } = useMaintenanceGateway(tenancyId);
  // Currently returns empty array, but categories and navigation are ready
}
```
