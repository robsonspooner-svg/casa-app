# Mission 11: Property Inspections & Condition Reports

## Overview
**Goal**: Enable owners to conduct and document routine inspections and entry/exit condition reports.
**Dependencies**: Mission 06 (Tenancies)
**Estimated Complexity**: Medium-High

## Success Criteria

### Phase A: Database Schema
- [ ] Create `inspections` table
- [ ] Create `inspection_rooms` table
- [ ] Create `inspection_items` table
- [ ] Create `inspection_images` table
- [ ] Set up RLS policies

### Phase B: Inspection Scheduling
- [ ] Create InspectionsScreen (list all)
- [ ] Schedule new inspection
- [ ] Set inspection type (routine, entry, exit)
- [ ] Automatic tenant notification (14 days for routine)
- [ ] Calendar integration

### Phase C: Inspection Templates
- [ ] Default room templates (kitchen, bathroom, bedroom, etc.)
- [ ] Default item checklist per room
- [ ] Customizable templates per property
- [ ] Condition rating scale (excellent → poor)

### Phase D: Conduct Inspection (Mobile)
- [ ] Create InspectionScreen for conducting
- [ ] Room-by-room workflow
- [ ] Item checklist with condition rating
- [ ] Photo capture per item/room
- [ ] Voice notes (transcribed)
- [ ] Offline support (sync when connected)

### Phase E: Entry Condition Report
- [ ] Specialized entry inspection flow
- [ ] Document all existing damage
- [ ] Tenant acknowledgment
- [ ] Both parties sign digitally
- [ ] Generates official condition report

### Phase F: Exit Condition Report
- [ ] Compare to entry condition
- [ ] Highlight differences/damage
- [ ] Calculate repair costs
- [ ] Bond claim documentation
- [ ] Tenant dispute capability

### Phase G: Report Generation
- [ ] Generate PDF inspection report
- [ ] Include all photos with annotations
- [ ] Summary of condition ratings
- [ ] Comparison view (entry vs exit)
- [ ] Email report to tenant

### Phase H: Tenant View
- [ ] View scheduled inspections
- [ ] View completed inspection reports
- [ ] Acknowledge/dispute findings
- [ ] Sign condition reports

### Phase I: AI Condition Report Comparison (Entry vs Exit)
- [ ] AI-powered photo comparison (entry photos vs exit photos per room/item)
- [ ] Automated issue detection (grout deterioration, mould, damage, wear patterns)
- [ ] Wear-and-tear vs damage classification (AI determines if normal ageing or tenant damage)
- [ ] Room-by-room progress UI with photo counts, issue counts, and completion status
- [ ] AI-flagged issues panel with specific descriptions (e.g. "Grout discolouration — Bathroom")
- [ ] Side-by-side photo comparison view (entry left, exit right, with difference highlighting)
- [ ] Bond deduction suggestions with supporting photo evidence
- [ ] Severity ratings per issue (minor, moderate, major)
- [ ] Estimated repair costs per flagged issue
- [ ] Generate comparison summary PDF with entry/exit photos side-by-side

### Phase J: Testing
- [ ] Unit tests for inspection hooks
- [ ] Unit tests for AI comparison service
- [ ] Integration tests for report generation
- [ ] Integration tests for AI photo analysis pipeline
- [ ] E2E test: Schedule → Conduct → Generate report
- [ ] E2E test: Entry report → Exit report → AI comparison → Bond recommendation

## Database Schema

```sql
-- Inspection type enum
CREATE TYPE inspection_type AS ENUM (
  'routine',
  'entry',           -- Move-in condition report
  'exit',            -- Move-out condition report
  'pre_listing',     -- Before listing for rent
  'maintenance',     -- After major maintenance
  'complaint'        -- Following tenant complaint
);

-- Inspection status enum
CREATE TYPE inspection_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'tenant_review',   -- Awaiting tenant acknowledgment
  'disputed',        -- Tenant disputed findings
  'finalized'        -- Both parties agreed
);

-- Condition rating enum
CREATE TYPE condition_rating AS ENUM (
  'excellent',
  'good',
  'fair',
  'poor',
  'damaged',
  'missing',
  'not_applicable'
);

-- Inspections table
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  compare_to_inspection_id UUID REFERENCES inspections(id), -- For exit: compare to entry

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

-- Inspection templates
CREATE TABLE inspection_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id), -- NULL for system defaults
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template rooms
CREATE TABLE inspection_template_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES inspection_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  items TEXT[] NOT NULL DEFAULT '{}' -- Default items to check
);

-- Inspection rooms (instance)
CREATE TABLE inspection_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  overall_condition condition_rating,
  notes TEXT,
  completed_at TIMESTAMPTZ
);

-- Inspection items (instance)
CREATE TABLE inspection_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES inspection_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
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

-- Inspection images
CREATE TABLE inspection_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  room_id UUID REFERENCES inspection_rooms(id) ON DELETE SET NULL,
  item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,

  -- File details
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Annotations
  caption TEXT,
  annotations JSONB, -- Drawing annotations on image

  -- Metadata
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Voice notes
CREATE TABLE inspection_voice_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  room_id UUID REFERENCES inspection_rooms(id) ON DELETE SET NULL,

  -- Audio
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,

  -- Transcription
  transcript TEXT,
  transcribed_at TIMESTAMPTZ,

  -- Metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default templates
INSERT INTO inspection_templates (name, description, is_default) VALUES
('Standard Residential', 'Default template for houses and apartments', TRUE);

INSERT INTO inspection_template_rooms (template_id, name, display_order, items)
SELECT
  id,
  room_name,
  room_order,
  items
FROM inspection_templates, (VALUES
  ('Entry/Hallway', 0, ARRAY['Front door', 'Door locks', 'Flooring', 'Walls', 'Ceiling', 'Light fixtures', 'Power points', 'Smoke detector']),
  ('Living Room', 1, ARRAY['Flooring', 'Walls', 'Ceiling', 'Windows', 'Window coverings', 'Light fixtures', 'Power points', 'Air conditioning']),
  ('Kitchen', 2, ARRAY['Flooring', 'Walls', 'Ceiling', 'Benchtops', 'Sink', 'Tap/mixer', 'Oven', 'Cooktop', 'Rangehood', 'Dishwasher', 'Cupboards', 'Drawers']),
  ('Bathroom', 3, ARRAY['Flooring', 'Walls', 'Ceiling', 'Toilet', 'Vanity', 'Mirror', 'Shower', 'Bath', 'Tap/mixer', 'Exhaust fan', 'Towel rails']),
  ('Bedroom 1', 4, ARRAY['Flooring', 'Walls', 'Ceiling', 'Windows', 'Window coverings', 'Wardrobe', 'Light fixtures', 'Power points']),
  ('Bedroom 2', 5, ARRAY['Flooring', 'Walls', 'Ceiling', 'Windows', 'Window coverings', 'Wardrobe', 'Light fixtures', 'Power points']),
  ('Laundry', 6, ARRAY['Flooring', 'Walls', 'Ceiling', 'Tub', 'Tap', 'Cupboards', 'Dryer connection']),
  ('Outdoor/Garage', 7, ARRAY['Driveway', 'Garage door', 'Garden', 'Lawn', 'Fencing', 'Letterbox', 'Clothesline'])
) AS rooms(room_name, room_order, items)
WHERE inspection_templates.is_default = TRUE;

-- Indexes
CREATE INDEX idx_inspections_property ON inspections(property_id);
CREATE INDEX idx_inspections_tenancy ON inspections(tenancy_id);
CREATE INDEX idx_inspections_status ON inspections(status) WHERE status NOT IN ('completed', 'finalized', 'cancelled');
CREATE INDEX idx_inspection_rooms ON inspection_rooms(inspection_id);
CREATE INDEX idx_inspection_items ON inspection_items(room_id);
CREATE INDEX idx_inspection_images_inspection ON inspection_images(inspection_id);
CREATE INDEX idx_inspection_images_room ON inspection_images(room_id);
CREATE INDEX idx_inspection_images_item ON inspection_images(item_id);

-- RLS Policies
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_template_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_voice_notes ENABLE ROW LEVEL SECURITY;

-- Owners can manage inspections for their properties
CREATE POLICY "Owners can CRUD property inspections"
  ON inspections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = inspections.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view inspections for their tenancy
CREATE POLICY "Tenants can view own inspections"
  ON inspections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = inspections.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Tenants can update for acknowledgment
CREATE POLICY "Tenants can acknowledge inspections"
  ON inspections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = inspections.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Templates: system defaults + owner's own
CREATE POLICY "View templates"
  ON inspection_templates FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "Manage own templates"
  ON inspection_templates FOR ALL
  USING (owner_id = auth.uid());

-- Rooms, items, images follow inspection permissions
CREATE POLICY "Manage inspection rooms"
  ON inspection_rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM inspections
      JOIN properties ON properties.id = inspections.property_id
      WHERE inspections.id = inspection_rooms.inspection_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Similar for items and images...

-- Updated_at trigger
CREATE TRIGGER inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── inspections.ts          # Inspection CRUD
│   ├── inspectionTemplates.ts  # Template management
│   ├── inspectionItems.ts      # Rooms/items
│   └── inspectionComparisons.ts # AI comparison results
├── hooks/
│   ├── useInspections.ts       # List inspections
│   ├── useInspection.ts        # Single inspection
│   ├── useInspectionTemplates.ts
│   ├── useInspectionMutations.ts
│   ├── useAIComparison.ts      # AI comparison results + polling
│   └── useRoomProgress.ts      # Room completion progress
└── services/
    ├── inspectionReport.ts     # PDF generation
    ├── comparisonReport.ts     # Entry/exit comparison PDF
    ├── aiInspectionComparison.ts # AI comparison orchestrator
    └── voiceTranscription.ts   # Transcribe voice notes

packages/pdf/src/templates/
├── inspection.ts               # Standard inspection report
└── comparison.ts               # Entry vs exit comparison report

supabase/functions/
├── compare-inspection-photos/  # AI photo comparison (GPT-4 Vision / Claude Vision)
│   └── index.ts
└── estimate-repair-costs/      # Cost estimation from flagged issues
    └── index.ts
```

### Owner App
```
apps/owner/app/(app)/
├── inspections/
│   ├── index.tsx               # All inspections
│   ├── schedule.tsx            # Schedule new
│   ├── templates.tsx           # Manage templates
│   └── [id]/
│       ├── index.tsx           # Inspection details/report
│       ├── conduct.tsx         # Conduct inspection
│       └── rooms/
│           └── [roomId].tsx    # Room inspection

apps/owner/components/
├── InspectionCard.tsx          # Inspection list item
├── InspectionScheduler.tsx     # Schedule form
├── RoomChecklist.tsx           # Room items checklist
├── RoomProgressCard.tsx        # Room card: name, photos, issues, status
├── RoomProgressBar.tsx         # Overall "4/6 complete" bar
├── ConditionRating.tsx         # Rating selector
├── PhotoCapture.tsx            # Take/annotate photos
├── VoiceNote.tsx               # Record voice note
├── SignatureCapture.tsx        # Digital signature
├── ReportPreview.tsx           # Preview before sending
├── AIComparisonView.tsx        # Entry vs exit comparison screen
├── AIIssuesPanel.tsx           # "3 issues flagged by AI" warning panel
├── PhotoComparisonSlider.tsx   # Side-by-side entry/exit photos
├── BondRecommendation.tsx      # AI bond deduction suggestion
├── IssueSeverityBadge.tsx      # Minor/Moderate/Major pill badge
└── WearVsDamageBadge.tsx       # "Wear & Tear" vs "Damage" indicator
```

### Tenant App
```
apps/tenant/app/(app)/
├── inspections/
│   ├── index.tsx               # My inspections
│   └── [id]/
│       ├── index.tsx           # View report
│       └── acknowledge.tsx     # Sign/acknowledge

apps/tenant/components/
├── InspectionNotice.tsx        # Upcoming inspection alert
├── ReportViewer.tsx            # View inspection report
├── DisputeForm.tsx             # Dispute findings
└── SignatureCapture.tsx        # Digital signature
```

### Shared UI
```
packages/ui/src/components/
├── ConditionBadge.tsx          # Condition rating badge
├── ProgressTracker.tsx         # Room completion progress
├── ImageAnnotator.tsx          # Annotate images
├── SignaturePad.tsx            # Signature capture
└── ComparisonView.tsx          # Entry vs exit comparison
```

## Offline Support

The inspection conduct feature must work offline:

```typescript
// Use React Query's offline support + local storage
// 1. Cache template locally before starting
// 2. Save all data to local storage as conducting
// 3. Queue photos for upload
// 4. Sync everything when back online
```

## Voice Note Transcription

Use OpenAI Whisper or similar:

```typescript
// 1. Record audio locally
// 2. Upload to Supabase Storage
// 3. Trigger edge function to transcribe
// 4. Store transcript with voice note
```

## AI Condition Report Comparison

### Overview
The AI comparison tool is a **core differentiator** for Casa. It must be intuitive, visually polished, and match the UX shown in the marketing website mockups. The feature compares entry condition report photos with exit condition report photos, automatically flagging damage, wear, and issues — making bond disputes objective and evidence-based.

### UX Flow (matching InspectionsMockup.tsx)

The inspection conduct screen shows:
1. **Header**: Property address + unit, scheduled date, gradient background (casa-navy → casa-indigo)
2. **Room Progress**: Progress bar showing rooms completed (e.g. "4/6 complete") with gradient fill
3. **Room List**: Each room card shows:
   - Status icon: green checkmark (complete), camera (current/pending)
   - Room name (bold)
   - Photo count: "8 photos taken" for complete, "Taking photos..." for current, "Not started" for pending
   - Issue badge: amber pill showing issue count (e.g. "2 issues")
   - Active badge: navy pill showing "Active" for current room
4. **AI Issues Panel**: Warning-styled card at bottom showing:
   - Triangle alert icon + "3 issues flagged by AI"
   - Specific issue descriptions: "Kitchen grout deterioration, bathroom mould, fence damage"

### Room Order (default template)
1. Living Room
2. Kitchen
3. Bedroom 1
4. Bathroom
5. Bedroom 2
6. Exterior

### AI Photo Analysis Pipeline

```typescript
// packages/api/src/services/aiInspectionComparison.ts

interface AIComparisonService {
  // Compare entry and exit photos for a specific item
  comparePhotos(params: {
    entryPhotos: InspectionImage[];
    exitPhotos: InspectionImage[];
    itemName: string;
    roomName: string;
  }): Promise<ComparisonResult>;

  // Analyze all rooms in an exit inspection against the entry inspection
  analyzeFullInspection(params: {
    entryInspectionId: string;
    exitInspectionId: string;
  }): Promise<FullComparisonResult>;

  // Get estimated repair costs for flagged issues
  estimateRepairCosts(issues: FlaggedIssue[]): Promise<CostEstimate[]>;
}

interface ComparisonResult {
  hasChange: boolean;
  changeType: 'none' | 'wear_and_tear' | 'minor_damage' | 'major_damage' | 'missing';
  confidence: number;         // 0-1 confidence score
  description: string;        // Human-readable: "Grout discolouration detected"
  severity: 'minor' | 'moderate' | 'major';
  isTenantResponsible: boolean; // AI assessment: wear vs damage
  estimatedCost?: number;
  evidenceNotes: string;      // Why the AI flagged this
}

interface FlaggedIssue {
  id: string;
  roomName: string;
  itemName: string;
  description: string;        // "Grout discolouration — Bathroom"
  severity: 'minor' | 'moderate' | 'major';
  changeType: 'wear_and_tear' | 'minor_damage' | 'major_damage' | 'missing';
  isTenantResponsible: boolean;
  entryPhotoUrl: string;
  exitPhotoUrl: string;
  confidence: number;
  estimatedCost?: number;
}

interface FullComparisonResult {
  inspectionId: string;
  comparedToId: string;
  totalIssues: number;
  tenantResponsibleIssues: number;
  wearAndTearIssues: number;
  totalEstimatedCost: number;
  bondRecommendation: {
    deductionAmount: number;
    deductionPercentage: number; // % of bond
    reasoning: string;
    supportingEvidence: FlaggedIssue[];
  };
  roomSummaries: RoomComparisonSummary[];
  flaggedIssues: FlaggedIssue[];
}

interface RoomComparisonSummary {
  roomName: string;
  photosCompared: number;
  issuesFound: number;
  overallChange: 'none' | 'minor' | 'significant';
  items: ComparisonResult[];
}
```

### AI Implementation (Supabase Edge Function)

```typescript
// supabase/functions/compare-inspection-photos/index.ts
// Uses OpenAI GPT-4 Vision or Claude Vision for photo comparison

// Prompt structure:
// 1. Provide entry photo + exit photo of same item
// 2. Ask AI to identify differences
// 3. Classify as: no change | normal wear | tenant damage
// 4. Rate severity and estimate repair cost
// 5. Provide evidence description

// The AI should consider:
// - Age of tenancy (longer = more wear acceptable)
// - Type of surface/item (carpet vs tiles vs walls)
// - Australian tenancy law standards for "fair wear and tear"
// - Common damage patterns (scuff marks vs holes)
```

### Database Additions for AI Comparison

```sql
-- AI comparison results
CREATE TABLE inspection_ai_comparisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual AI-flagged issues
CREATE TABLE inspection_ai_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comparison_id UUID NOT NULL REFERENCES inspection_ai_comparisons(id) ON DELETE CASCADE,
  room_id UUID REFERENCES inspection_rooms(id) ON DELETE SET NULL,
  item_id UUID REFERENCES inspection_items(id) ON DELETE SET NULL,

  -- Issue details
  room_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT NOT NULL,          -- "Grout discolouration — Bathroom"
  severity TEXT NOT NULL,             -- 'minor', 'moderate', 'major'
  change_type TEXT NOT NULL,          -- 'wear_and_tear', 'minor_damage', 'major_damage', 'missing'
  is_tenant_responsible BOOLEAN NOT NULL DEFAULT FALSE,
  confidence DECIMAL(3,2) NOT NULL,   -- 0.00-1.00
  estimated_cost DECIMAL(10,2),
  evidence_notes TEXT,

  -- Photo references
  entry_image_id UUID REFERENCES inspection_images(id),
  exit_image_id UUID REFERENCES inspection_images(id),

  -- Owner review
  owner_agreed BOOLEAN,               -- NULL = not reviewed, TRUE = agreed, FALSE = dismissed
  owner_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_comparisons_exit ON inspection_ai_comparisons(exit_inspection_id);
CREATE INDEX idx_ai_issues_comparison ON inspection_ai_issues(comparison_id);
CREATE INDEX idx_ai_issues_room ON inspection_ai_issues(room_name);
```

### UI Components for AI Comparison

```
apps/owner/components/
├── AIComparisonView.tsx           # Main comparison screen
├── RoomProgressCard.tsx           # Room card with photo/issue counts
├── RoomProgressBar.tsx            # Overall progress bar (X/N complete)
├── AIIssuesPanel.tsx              # Warning panel showing flagged issues
├── PhotoComparisonSlider.tsx      # Side-by-side entry/exit with slider
├── BondRecommendation.tsx         # AI-generated bond deduction suggestion
├── IssueSeverityBadge.tsx         # Minor/Moderate/Major badge
├── WearVsDamageBadge.tsx          # Wear & Tear vs Damage indicator
└── ComparisonReportPreview.tsx    # Preview before generating PDF
```

### AI Comparison Screen Flow
1. **Start Exit Inspection**: Owner selects property → System auto-links to entry inspection
2. **Conduct Room-by-Room**: Take photos of each room/item (same order as entry)
3. **AI Processing**: After each room completion, AI compares photos in background
4. **Real-time Flagging**: Issues appear in the AI Issues Panel as they're detected
5. **Review Issues**: Owner taps each issue → sees entry/exit photos side-by-side
6. **Accept/Dismiss**: Owner can agree with AI or dismiss false positives
7. **Bond Summary**: AI generates total recommended bond deduction with evidence
8. **Generate Report**: Create comparison PDF with side-by-side photos + AI findings
9. **Send to Tenant**: Tenant receives report in-app, can acknowledge or dispute

### Comparison PDF Report Structure
- Cover page: Property address, entry date, exit date, inspector
- Per-room section:
  - Room name + overall condition change
  - Entry photo grid (thumbnails)
  - Exit photo grid (thumbnails)
  - Side-by-side comparisons for flagged items
  - AI issue descriptions with severity and cost estimates
- Summary page:
  - Total issues found
  - Wear & tear vs tenant damage breakdown
  - Bond deduction recommendation
  - Supporting evidence list
  - Disclaimer: "AI-assisted analysis — owner review recommended"

### Wear vs Damage Guidelines (Australian Tenancy Law)
```typescript
// The AI should apply these standards:
const WEAR_AND_TEAR_EXAMPLES = {
  acceptable: [
    'Faded paint from sunlight',
    'Minor scuff marks on walls from furniture',
    'Worn carpet in high-traffic areas',
    'Small nail holes from picture hanging',
    'Faded curtains/blinds from sun exposure',
    'Slightly worn kitchen benchtops',
    'Minor grout discolouration from normal use',
  ],
  tenantDamage: [
    'Large holes in walls',
    'Burns or stains on carpet',
    'Broken fixtures or fittings',
    'Mould from inadequate ventilation (tenant responsibility)',
    'Pet damage (scratches, odours)',
    'Broken windows or doors',
    'Significant grease/grime buildup beyond normal',
    'Unauthorised alterations',
  ],
};
```

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(inspections): <description>

Mission-11: Property Inspections
```

## Inspection Reminders & Tier-Aware Prompts

### State-Specific Inspection Intervals
```typescript
// packages/api/src/constants/inspectionRules.ts

export const INSPECTION_RULES = {
  NSW: {
    routineInterval: 6,     // Max frequency: every 6 months
    noticeDays: 7,          // 7 days written notice (routine)
    entryNotice: 7,         // 7 days for entry inspection
    maxInspectionsPerYear: 4,
  },
  VIC: {
    routineInterval: 6,     // Every 6 months
    noticeDays: 7,          // 7 days notice
    entryNotice: 7,
    maxInspectionsPerYear: 4,
  },
  QLD: {
    routineInterval: 3,     // Every 3 months
    noticeDays: 7,          // 7 days (entry notice)
    entryNotice: 7,
    maxInspectionsPerYear: 4, // But no more than once per 3 months
  },
} as const;
```

### Inspection Reminder Edge Function
```typescript
// supabase/functions/inspection-reminders/index.ts

/**
 * Runs daily at 8:00 AM AEST
 * Sends reminders based on tenancy duration and state requirements
 */
async function processInspectionReminders() {
  // 1. Find tenancies due for routine inspection
  //    (last inspection > state-specific interval months ago)
  const tenanciesDueInspection = await getTenanicesDueInspection();

  for (const tenancy of tenanciesDueInspection) {
    const ownerTier = tenancy.ownerProfile.subscription_tier;
    const monthsSinceLastInspection = getMonthsSince(tenancy.lastInspection?.completed_at);
    const state = tenancy.property.state;
    const interval = INSPECTION_RULES[state].routineInterval;

    // 2. Determine reminder type based on tier
    if (ownerTier === 'pro' || ownerTier === 'hands_off') {
      // Pro/Hands-Off: Auto-schedule inspection
      if (monthsSinceLastInspection >= interval) {
        await autoScheduleInspection(tenancy);
        await sendNotification({
          userId: tenancy.ownerId,
          type: 'inspection_auto_scheduled',
          title: 'Routine inspection scheduled',
          body: `${tenancy.property.address} — inspection due per ${state} regulations`,
        });
      }
    } else {
      // Starter: Show reminder + add-on purchase prompt
      if (monthsSinceLastInspection >= interval - 1) {
        // Reminder 1 month before due
        await sendNotification({
          userId: tenancy.ownerId,
          type: 'inspection_reminder',
          title: 'Routine inspection due soon',
          body: `${tenancy.property.address} — ${state} requires inspections every ${interval} months`,
          actionUrl: `/inspections/schedule?property=${tenancy.propertyId}`,
          ctaLabel: 'Schedule Inspection',
          // Add-on upsell for Starter
          addOnPrompt: {
            type: 'professional_inspection',
            message: 'Need a professional inspector? Purchase for $99',
            actionUrl: `/add-ons/professional_inspection/purchase?property=${tenancy.propertyId}`,
          },
        });
      }
    }

    // 3. Tenancy-duration-based reminders
    const tenancyMonths = getMonthsSince(tenancy.lease_start_date);

    // First inspection reminder (3 months into tenancy)
    if (tenancyMonths === 3 && !tenancy.firstInspectionDone) {
      await sendNotification({
        userId: tenancy.ownerId,
        type: 'first_inspection_prompt',
        title: 'Time for your first routine inspection',
        body: `${tenancy.property.address} — 3 months since tenancy started`,
      });
    }

    // Annual inspection summary
    if (tenancyMonths % 12 === 0 && tenancyMonths > 0) {
      await sendNotification({
        userId: tenancy.ownerId,
        type: 'annual_inspection_summary',
        title: 'Annual inspection summary',
        body: `${tenancy.property.address} — ${tenancyMonths / 12} year mark. Review property condition.`,
      });
    }
  }
}
```

### Tier-Aware Inspection UI

#### Starter Tier — Inspection Screen
```
┌─────────────────────────────────────────┐
│  Inspections                             │
│                                          │
│  ⚠️ Routine inspection due              │
│  42 Smith St — last inspected 5 months   │
│  ago (NSW requires every 6 months)       │
│                                          │
│  [Schedule Self-Inspection]              │
│                                          │
│  ─── or ───                             │
│                                          │
│  🔍 Need a professional?                │
│  A qualified inspector handles everything│
│  [Purchase Professional Inspection — $99]│
│                                          │
│  ─── or ───                             │
│                                          │
│  ⬆️ Upgrade to Pro                       │
│  Includes unlimited inspections, tenant  │
│  finding, and leasing service.           │
│  [Upgrade to Pro — $89/mo]               │
└─────────────────────────────────────────┘
```

#### Pro/Hands-Off Tier — Inspection Screen
```
┌─────────────────────────────────────────┐
│  Inspections                             │
│                                          │
│  ✓ AUTO-MANAGED                          │
│  ✓ Next inspection: 15 Mar 2025          │
│  ✓ Tenant notified (7 days notice)       │
│  ✓ NSW compliant schedule                │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  42 Smith St, Bondi              │    │
│  │  Routine — 15 Mar 2025           │    │
│  │  ┌──────────┐                    │    │
│  │  │ Scheduled│                    │    │
│  │  └──────────┘                    │    │
│  │  Inspector: Casa Pro Inspector   │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Past Inspections                        │
│  ┌──────────────────────────────────┐    │
│  │  Routine — 15 Sep 2024           │    │
│  │  ┌──────────┐                    │    │
│  │  │ Completed│  No issues         │    │
│  │  └──────────┘                    │    │
│  └──────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Database Addition
```sql
-- Track inspection schedule preferences
ALTER TABLE properties ADD COLUMN IF NOT EXISTS inspection_interval_months INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_inspection_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS next_inspection_due DATE;

-- Auto-calculate next inspection date after completion
CREATE OR REPLACE FUNCTION update_next_inspection()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' OR NEW.status = 'finalized' THEN
    UPDATE properties
    SET last_inspection_at = NEW.completed_at,
        next_inspection_due = NEW.completed_at::date + (COALESCE(inspection_interval_months, 6) || ' months')::INTERVAL
    WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER inspection_completed_tracking
  AFTER UPDATE OF status ON inspections
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'finalized'))
  EXECUTE FUNCTION update_next_inspection();
```

### Agent Tools for Inspections
| Name | Category | Autonomy | Risk | Description |
|------|----------|----------|------|-------------|
| `get_inspections` | query | L4 Autonomous | None | Get inspection history and scheduled inspections |
| `schedule_inspection` | action | L3 Suggest | Medium | Schedule a routine inspection (Pro/Hands-Off auto-approved) |
| `get_inspection_report` | query | L4 Autonomous | None | Get inspection report with photos and findings |
| `compare_inspections` | action | L3 Suggest | Medium | Trigger AI comparison between entry and exit |
| `get_inspection_reminder` | query | L4 Autonomous | None | Get next due inspection date and compliance status |

## Phase K: Professional / Outsourced Inspection System

### Overview

Owners have two choices for every inspection: **self-service** (conduct it themselves using the app) or **outsourced** (Casa arranges a professional inspector). The outsourced path is a critical revenue driver (included in Pro/Hands-Off tiers, $99 add-on for Starter) and a key differentiator — most owners don't want to physically visit their investment property.

### How Outsourced Inspections Work

#### 1. Inspector Network (Casa-Managed)

Casa maintains a curated network of professional property inspectors, similar to the trade network (Mission 10). The Casa agent discovers, vets, and manages inspector relationships.

**Database Additions:**
```sql
-- Extend service_providers to support inspectors
-- service_providers already exists from Mission 10 (tradesperson_network migration)
-- Inspectors are service_providers with category = 'inspection'

-- Inspection assignments
CREATE TABLE inspection_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES service_providers(id),

  -- Assignment
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by TEXT NOT NULL DEFAULT 'agent', -- 'agent', 'owner'

  -- Inspector response
  accepted BOOLEAN,
  accepted_at TIMESTAMPTZ,
  declined_reason TEXT,

  -- Scheduling
  proposed_date DATE,
  proposed_time_start TIME,
  proposed_time_end TIME,
  confirmed_date DATE,
  confirmed_time TIME,

  -- Completion
  completed_at TIMESTAMPTZ,

  -- Payment
  fee_amount DECIMAL(10,2) NOT NULL,
  fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_id UUID, -- Reference to payments table if using Stripe

  -- Rating (by owner)
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_assignments_inspection ON inspection_assignments(inspection_id);
CREATE INDEX idx_inspection_assignments_inspector ON inspection_assignments(inspector_id);

ALTER TABLE inspection_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage inspection assignments"
  ON inspection_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM inspections i
      JOIN properties p ON p.id = i.property_id
      WHERE i.id = inspection_assignments.inspection_id
      AND p.owner_id = auth.uid()
    )
  );
```

#### 2. The Agent's Role in Outsourced Inspections

When an owner requests a professional inspection (or it's auto-scheduled for Pro/Hands-Off tiers), the Casa agent handles the entire logistics:

**Step 1: Find Inspector**
- Agent searches its inspector network for the property's area
- If no inspector exists, agent uses `web_search` to find local property inspection services
- Agent calls `parse_business_details` to extract business info (ABN, license, insurance, contact)
- Agent creates a `service_provider` record with category = 'inspection'
- Agent checks inspector's availability, rating, proximity to property

**Step 2: Request Quote / Book**
- Agent sends outreach to inspector via `send_email_sendgrid` (AI-transparent — appears from owner)
- Template: "Hi [Inspector Name], I manage [address] and need a [routine/entry/exit] inspection. Are you available on or around [date]? The property is a [beds/baths/type]. Please confirm availability and your fee."
- Agent logs the outreach against the service_provider

**Step 3: Confirm Booking**
- When inspector responds (via email reply → incoming email hook, or manual update by owner), agent:
  - Creates `inspection_assignment` record
  - Updates inspection status to 'scheduled'
  - Sends tenant notification with inspector name, date, and access instructions
  - Sends confirmation to inspector with property access details (key lockbox code, tenant contact)

**Step 4: Day of Inspection**
- Agent sends morning reminder to inspector (if SMS enabled)
- Agent sends morning reminder to tenant
- Inspector conducts inspection and submits report (two paths):
  - **Path A: Inspector uses Casa app** (ideal) — Inspector logs in as a guest inspector, uses the room-by-room conducting flow, photos are directly in the system
  - **Path B: Inspector uploads report** — Inspector emails/uploads their report, owner or agent uploads it to the inspection record

**Step 5: Post-Inspection**
- Agent processes the report:
  - If photos from in-app: AI comparison runs automatically
  - If uploaded PDF: agent extracts key findings, stores document in documents system (Mission 16)
- Agent updates inspection status to 'completed'
- Agent sends report to tenant for acknowledgment
- Agent rates the inspector (based on timeliness, report quality)

**Step 6: Payment**
- Professional inspection fee processed via Stripe (one-off charge for Starter add-on, included in Pro/Hands-Off subscription)
- If Starter tier: $99 charged to owner, inspector paid directly by Casa
- If Pro/Hands-Off: no additional charge to owner, inspector paid from platform revenue

#### 3. Inspector Guest Access

Professional inspectors need limited access to the app to conduct inspections:

```typescript
// Inspector access model (lightweight, no full account needed)
interface InspectorAccess {
  // One-time access link sent to inspector's email
  // Links to a simplified conducting flow (no navigation to other screens)
  // Expires 24 hours after the scheduled inspection date
  accessToken: string;
  inspectionId: string;
  expiresAt: Date;

  // Inspector can:
  // - View property details (address, type, rooms)
  // - Conduct room-by-room inspection
  // - Take/upload photos per room
  // - Rate condition of items
  // - Add notes
  // - Submit completed inspection

  // Inspector CANNOT:
  // - See financial information
  // - See tenant personal details
  // - Access other properties
  // - Access chat or other features
}
```

**Database Addition:**
```sql
CREATE TABLE inspector_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES inspection_assignments(id) ON DELETE CASCADE,

  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL, -- Inspector's email

  -- Access control
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Revocation
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_inspector_tokens ON inspector_access_tokens(token) WHERE NOT revoked;
```

#### 4. Self-Service vs Outsourced UX Flow

When an owner triggers an inspection (from schedule screen or agent), they see:

```
┌─────────────────────────────────────────────────────┐
│  How would you like to handle this inspection?       │
│                                                      │
│  ┌────────────────────────────────┐                 │
│  │  🏠  I'll do it myself         │                 │
│  │  Use the room-by-room guide    │                 │
│  │  to document everything with   │                 │
│  │  your phone.                   │                 │
│  │                                │                 │
│  │  Free • Takes ~45 minutes     │                 │
│  │  [Start Self-Inspection]      │                 │
│  └────────────────────────────────┘                 │
│                                                      │
│  ┌────────────────────────────────┐                 │
│  │  👤  Get a professional        │                 │
│  │  Casa finds and books a local  │                 │
│  │  inspector. They handle        │                 │
│  │  everything and submit the     │                 │
│  │  report directly to your app.  │                 │
│  │                                │                 │
│  │  {tierLabel}                   │                 │
│  │  [Book Professional]           │                 │
│  └────────────────────────────────┘                 │
│                                                      │
│  ┌────────────────────────────────┐                 │
│  │  🤖  Let Casa handle it        │   (Pro+ only)  │
│  │  Casa will automatically       │                 │
│  │  schedule and coordinate       │                 │
│  │  the inspection. You'll get    │                 │
│  │  the report when it's done.    │                 │
│  │                                │                 │
│  │  Included in your plan        │                 │
│  │  [Auto-Manage]                │                 │
│  └────────────────────────────────┘                 │
└─────────────────────────────────────────────────────┘

// tierLabel:
// Starter: "$99 one-off"
// Pro: "Included in your plan"
// Hands-Off: "Included in your plan"
```

#### 5. Agent Tools for Outsourced Inspections

| Name | Category | Autonomy | Description |
|------|----------|----------|-------------|
| `find_inspectors` | external | L3 | Search for property inspectors in property's area |
| `book_inspector` | action | L2 Draft | Assign inspector and send booking request |
| `send_inspector_access` | action | L3 Execute | Generate and send access token to inspector |
| `check_inspector_availability` | query | L4 | Check if assigned inspector has responded |
| `process_inspector_report` | action | L3 Execute | Process uploaded report from inspector |

#### 6. Inspection Outsourcing Lifecycle (Agent-Managed)

```
Owner requests inspection OR auto-schedule trigger fires
    │
    ├── Owner chooses "I'll do it myself"
    │       → Room-by-room conducting flow (existing)
    │
    ├── Owner chooses "Get a professional"
    │       → Agent finds local inspector
    │       → Agent requests availability
    │       → Agent confirms booking
    │       → Agent sends tenant notification
    │       → Agent sends inspector access link
    │       → Inspector conducts inspection
    │       → Report appears in owner's app
    │       → AI comparison runs (if entry/exit)
    │       → Tenant receives report
    │
    └── Owner chooses "Let Casa handle it" (Pro+ only)
            → Agent auto-selects best-rated inspector from network
            → Agent coordinates everything silently
            → Owner receives summary notification when complete
            → Report available in app
```

### Phase L: Agent-Driven Inspection Workflow

The Casa agent integrates inspections into its proactive management:

**Routine Inspection Auto-Scheduling (Pro/Hands-Off):**
1. Heartbeat scanner runs weekly (Monday 8am)
2. Checks `properties.next_inspection_due` for all owner's properties
3. If due within 30 days → creates pending task for owner review
4. If autonomy L3+ → auto-schedules and books inspector
5. Notifies tenant with required notice period (state-specific)

**Entry Inspection (New Tenancy):**
1. When tenancy status changes to 'active', agent triggers entry inspection
2. Agent suggests self-service or professional based on owner preference
3. If owner prefers professional (learned from `agent_preferences`), auto-books
4. Entry report becomes baseline for future exit comparison

**Exit Inspection (Ending Tenancy):**
1. When tenancy end date approaches (30 days), agent creates exit inspection task
2. Agent schedules exit inspection for week before move-out date
3. After exit inspection, agent auto-runs AI comparison against entry
4. Agent presents bond deduction recommendation to owner
5. Owner approves/modifies, agent initiates bond claim process

**Compliance Integration:**
- Agent tracks inspection compliance per state
- If inspection overdue → escalates to owner with urgency
- If owner ignores → agent re-prompts (increasing urgency)
- Agent ensures minimum notice periods are always respected

## Notes
- Entry/exit reports are legally important for bond disputes
- 14 days notice required for routine inspections (varies by state)
- Photos are critical evidence - timestamp and geotag
- Offline support essential for properties with poor signal
- Consider integration with smoke alarm compliance tracking
- Voice notes speed up the inspection process
- AI comparison is a key marketing differentiator — must be polished and intuitive
- AI issues panel updates in real-time as rooms are completed
- Side-by-side photo comparison should use a draggable slider divider
- Bond deduction suggestions are advisory — owner makes final decision
- AI confidence scores below 70% should be flagged as "needs manual review"
- Tenancy length affects what constitutes "fair wear and tear"
- The room-by-room progress UI must match the website mockup exactly (progress bar, photo counts, issue badges, active/complete/pending states)
- Inspection reminders are tier-aware: Pro/Hands-Off get auto-scheduling, Starter gets manual prompts with add-on offers
- State-specific intervals determine reminder frequency (NSW/VIC: 6 months, QLD: 3 months)
- Tenancy duration triggers milestone reminders (3 months, annually)

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`inspections`, `inspection_rooms`, `inspection_items`, `inspection_images`)
- [ ] RLS policies verified: owners can manage inspections for their properties
- [ ] RLS policies verified: tenants can view inspections for their tenancies
- [ ] Indexes created for property, tenancy, and type/status queries
- [ ] Foreign keys correct with CASCADE on inspection_rooms/items/images
- [ ] Storage bucket for inspection images configured
- [ ] Routine inspection scheduling records created correctly

### Feature Verification (Mission-Specific)
- [ ] Owner can schedule a new inspection (routine, entry, exit)
- [ ] Tenant receives 14-day notice for routine inspections
- [ ] Inspection templates load with default rooms and item checklists
- [ ] Owner can customize inspection template per property
- [ ] Mobile inspection flow works room-by-room with condition ratings
- [ ] Photo capture works per item/room during inspection
- [ ] Entry condition report documents all existing damage
- [ ] Entry report requires tenant acknowledgment and digital signature
- [ ] Exit condition report compares against entry condition
- [ ] Differences/damage highlighted with repair cost estimates
- [ ] Inspection report generates as PDF
- [ ] Routine inspection auto-scheduling works for Pro/Hands-Off tiers
- [ ] Starter tier sees add-on prompt for professional inspection ($99)
- [ ] State-specific inspection intervals apply (NSW/VIC: 6 months, QLD: 3 months)
- [ ] Offline inspection mode syncs when connection restored

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
- `packages/api/src/hooks/gateways/useInspectionsGateway.ts` — Hook with navigation entry points and placeholder state
- `packages/api/src/types/gateways.ts` — Type definitions for all inspection entities

### What's Already Done
1. **Types defined**: All TypeScript interfaces including:
   - `Inspection` with full scheduling/status/signature fields
   - `InspectionRoom`, `InspectionItem`, `InspectionImage`
   - `InspectionType` (routine, entry, exit, pre_listing, maintenance, complaint)
   - `InspectionStatus` (scheduled → in_progress → completed/tenant_review/disputed → finalized)
   - `ConditionRating` (excellent, good, fair, poor, damaged, missing, not_applicable)
2. **Gateway hook**: `useInspectionsGateway(propertyId?)` provides:
   - Navigation: `navigateToInspectionsList()`, `navigateToInspectionDetail()`, `navigateToScheduleInspection()`, `navigateToConductInspection()`, `navigateToInspectionReport()`, `navigateToAIComparison()`
   - Actions: `scheduleInspection()`, `startInspection()`, `completeInspection()`, `generateReport()`, `acknowledgeInspection()`, `disputeInspection()`, `runAIComparison()`
3. **Exported from `@casa/api`**: Import directly in components

### What This Mission Needs to Do
1. Create database migration with tables and templates
2. Implement real Supabase queries replacing gateway placeholders
3. Build room-by-room inspection UI with photo capture
4. Implement AI comparison service (Claude Vision)
5. Create PDF report generation

### Usage Example (Already Works)
```typescript
import { useInspectionsGateway, ConditionRating } from '@casa/api';

function InspectionsScreen() {
  const { items, upcomingInspections, conditionRatings, navigateToScheduleInspection } = useInspectionsGateway(propertyId);
}
```
