# Mission 06: Tenancies & Leases

## Overview
**Goal**: Create tenancies from approved applications and manage lease lifecycle.
**Dependencies**: Mission 05 (Applications)
**Estimated Complexity**: High

## Success Criteria

### Phase A: Database Schema
- [ ] Create `tenancies` table
- [ ] Create `tenancy_tenants` table (multiple tenants per lease)
- [ ] Create `lease_documents` table
- [ ] Set up RLS policies
- [ ] Create tenancy status workflow

### Phase B: Create Tenancy (Owner App)
- [ ] Create tenancy from approved application
- [ ] Auto-populate tenant and property details
- [ ] Set lease start/end dates
- [ ] Set rent amount and frequency
- [ ] Add bond details
- [ ] Add additional tenants (occupants from application)

### Phase C: Lease Document Generation
- [ ] Create lease template system
- [ ] Generate PDF lease document
- [ ] Include all required NSW/VIC/QLD clauses
- [ ] Digital signature placeholders (future: DocuSign)
- [ ] Upload signed lease document

### Phase D: Tenancy Management
- [ ] Create TenanciesScreen (list all)
- [ ] Filter by status (active, ending soon, ended)
- [ ] Show key dates (start, end, next rent due)
- [ ] Quick actions (extend, terminate, message tenant)

### Phase E: Tenancy Details
- [ ] Create TenancyDetailScreen
- [ ] Show all tenancy information
- [ ] List all tenants
- [ ] Show lease documents
- [ ] Payment summary (links to Mission 07)
- [ ] Maintenance history (links to Mission 09)

### Phase F: Tenant View
- [ ] Create MyTenancyScreen in tenant app
- [ ] Show current lease details
- [ ] Download lease document
- [ ] See rent due dates
- [ ] Quick links to pay rent, request maintenance

### Phase G: Lease Lifecycle & Rent Increases
- [ ] Lease renewal workflow (auto-renewal for Pro/Hands-Off, prompt for Starter)
- [ ] Lease expiry alerts at 90, 60, and 30 days before end date
- [ ] Rent increase workflow with state-compliant notice periods
- [ ] Auto-calculate minimum notice period by state (NSW: 60 days, VIC: 60 days, QLD: 60 days)
- [ ] Rent increase notice generation (PDF with required statutory format)
- [ ] Tenant notification of proposed rent increase via in-app + email
- [ ] Lease termination (notice periods by state)
- [ ] End of tenancy checklist
- [ ] Bond return process
- [ ] For Pro/Hands-Off: "AUTO-MANAGED" section showing automated actions (bond lodged, renewal sent, compliant templates)
- [ ] For Starter: Show which actions require manual handling vs upgrade prompt

### Phase H: Lease Lifecycle Alerts & Reminders
- [ ] Create `lease_lifecycle_alerts` Edge Function (runs daily)
- [ ] Alert owner 90 days before lease end: "Lease ending soon — renew or relist?"
- [ ] Alert owner 60 days before lease end: "Renewal notice due — [Send Now] or [Let Expire]"
- [ ] Alert owner 30 days before lease end: "Lease expires in 30 days — final reminder"
- [ ] For periodic tenancies: Annual rent review reminder (12 months since last increase)
- [ ] Track rent increase history per tenancy
- [ ] CPI-based rent increase suggestions (fetch ABS CPI data)
- [ ] Comparable rent analysis from listing data (if available)

### Phase I: Testing
- [ ] Unit tests for tenancy hooks
- [ ] Unit tests for rent increase calculations
- [ ] Integration tests for tenancy creation
- [ ] Integration tests for lease lifecycle alerts
- [ ] E2E test: Approve application → Create tenancy → View as tenant
- [ ] E2E test: Lease approaching expiry → Owner receives alerts → Sends renewal

## Database Schema

```sql
-- Tenancy status enum
CREATE TYPE tenancy_status AS ENUM (
  'pending',      -- Created but not started
  'active',       -- Currently active
  'ending',       -- Notice given, ending soon
  'ended',        -- Lease ended
  'terminated'    -- Early termination
);

-- Bond status enum
CREATE TYPE bond_status AS ENUM (
  'pending',      -- Bond not yet lodged
  'lodged',       -- Lodged with rental bond board
  'claimed',      -- Claim in progress
  'returned',     -- Fully returned
  'partial'       -- Partially returned
);

-- Tenancies table
CREATE TABLE tenancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,

  -- Lease details
  lease_start_date DATE NOT NULL,
  lease_end_date DATE NOT NULL,
  lease_type lease_term NOT NULL,
  is_periodic BOOLEAN NOT NULL DEFAULT FALSE, -- Month-to-month after fixed term

  -- Rent
  rent_amount DECIMAL(10,2) NOT NULL,
  rent_frequency payment_frequency NOT NULL,
  rent_due_day INTEGER NOT NULL DEFAULT 1, -- Day of week (1=Mon) or month

  -- Bond
  bond_amount DECIMAL(10,2) NOT NULL,
  bond_lodgement_number TEXT,
  bond_status bond_status NOT NULL DEFAULT 'pending',
  bond_lodged_date DATE,

  -- Status
  status tenancy_status NOT NULL DEFAULT 'pending',
  notice_given_date DATE,
  notice_period_days INTEGER DEFAULT 14,
  actual_end_date DATE,
  end_reason TEXT,

  -- Documents
  lease_document_url TEXT,
  lease_signed_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Multiple tenants per tenancy
CREATE TABLE tenancy_tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE, -- Primary contact
  is_leaseholder BOOLEAN NOT NULL DEFAULT TRUE, -- On the lease
  moved_in_date DATE,
  moved_out_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenancy_id, tenant_id)
);

-- Lease and other documents
CREATE TABLE tenancy_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'lease',
    'condition_report_entry',
    'condition_report_exit',
    'notice_to_vacate',
    'notice_to_leave',
    'bond_lodgement',
    'bond_claim',
    'other'
  )),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenancies_property ON tenancies(property_id);
CREATE INDEX idx_tenancies_status ON tenancies(status) WHERE status IN ('active', 'ending');
CREATE INDEX idx_tenancy_tenants_tenant ON tenancy_tenants(tenant_id);
CREATE INDEX idx_tenancy_tenants_tenancy ON tenancy_tenants(tenancy_id);
CREATE INDEX idx_tenancy_documents ON tenancy_documents(tenancy_id);

-- RLS Policies
ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy_documents ENABLE ROW LEVEL SECURITY;

-- Owners can manage tenancies for their properties
CREATE POLICY "Owners can CRUD own tenancies"
  ON tenancies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = tenancies.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view their tenancies
CREATE POLICY "Tenants can view own tenancies"
  ON tenancies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = tenancies.id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Tenancy tenants policies
CREATE POLICY "Owners can manage tenancy tenants"
  ON tenancy_tenants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = tenancy_tenants.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view co-tenants"
  ON tenancy_tenants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants AS tt
      WHERE tt.tenancy_id = tenancy_tenants.tenancy_id
      AND tt.tenant_id = auth.uid()
    )
  );

-- Documents policies
CREATE POLICY "Owners can manage tenancy documents"
  ON tenancy_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = tenancy_documents.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view tenancy documents"
  ON tenancy_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = tenancy_documents.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Update property status when tenancy changes
CREATE OR REPLACE FUNCTION update_property_status_on_tenancy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE properties SET status = 'occupied' WHERE id = NEW.property_id;
  ELSIF NEW.status IN ('ended', 'terminated') THEN
    UPDATE properties SET status = 'vacant' WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tenancy_status_change
  AFTER UPDATE OF status ON tenancies
  FOR EACH ROW EXECUTE FUNCTION update_property_status_on_tenancy();

-- Also on insert
CREATE TRIGGER tenancy_created
  AFTER INSERT ON tenancies
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION update_property_status_on_tenancy();

-- Updated_at trigger
CREATE TRIGGER tenancies_updated_at
  BEFORE UPDATE ON tenancies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── tenancies.ts            # Tenancy CRUD
│   └── tenancyDocuments.ts     # Document management
├── hooks/
│   ├── useTenancies.ts         # List tenancies
│   ├── useTenancy.ts           # Single tenancy
│   ├── useMyTenancy.ts         # Tenant's current tenancy
│   └── useTenancyMutations.ts
└── services/
    └── leaseGenerator.ts       # PDF lease generation
```

### Owner App
```
apps/owner/app/(app)/
├── tenancies/
│   ├── index.tsx               # Tenancies list
│   ├── create.tsx              # Create from application
│   └── [id]/
│       ├── index.tsx           # Tenancy details
│       ├── edit.tsx            # Edit tenancy
│       ├── documents.tsx       # Manage documents
│       └── terminate.tsx       # End tenancy flow

apps/owner/components/
├── TenancyCard.tsx             # Tenancy list item
├── TenancyForm.tsx             # Create/edit form
├── LeasePreview.tsx            # Preview generated lease
├── TenantList.tsx              # List tenants on lease
├── BondManager.tsx             # Bond lodgement UI
└── TerminationWizard.tsx       # End of tenancy flow
```

### Tenant App
```
apps/tenant/app/(app)/
├── tenancy/
│   ├── index.tsx               # My tenancy dashboard
│   ├── lease.tsx               # View/download lease
│   └── documents.tsx           # All tenancy documents

apps/tenant/components/
├── TenancySummary.tsx          # Current tenancy overview
├── RentDueCard.tsx             # Next rent due
├── LeaseDetails.tsx            # Lease information
└── DocumentList.tsx            # Available documents
```

### Shared Packages
```
packages/pdf/                   # New package for PDF generation
├── package.json
├── src/
│   ├── index.ts
│   ├── templates/
│   │   └── lease.ts            # Lease template
│   └── generator.ts            # PDF generation logic
```

## Lease Template Considerations

The lease generator should include:
- Standard residential tenancy agreement format
- State-specific clauses (NSW, VIC, QLD variations)
- All required statutory disclosures
- Special conditions section
- Signature blocks

For MVP, generate a standard template. In future, integrate with:
- DocuSign/HelloSign for digital signatures
- State rental bond board APIs for lodgement

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(tenancies): <description>

Mission-06: Tenancies & Leases
```

### Agent Tools Available at This Mission

The following tools from the tool catalog become available at Mission 06:

| Name | Category | Autonomy | Risk | Description |
|------|----------|----------|------|-------------|
| `search_tenants` | query | L4 Autonomous | None | Search tenants by name, email, phone, or property |
| `get_tenancy` | query | L4 Autonomous | None | Get active tenancy: tenants, lease dates, rent, bond status |
| `generate_lease` | generate | L3 Suggest | Medium | Generate state-compliant lease document |
| `send_docusign_envelope` | integration | L3 Suggest | High | Send lease for e-signing via DocuSign |
| `lodge_bond_state` | integration | L3 Suggest | High | Lodge bond with state authority (NSW/VIC/QLD) |
| `lodge_bond` | action | L3 Suggest | High | Lodge bond with state authority |
| `claim_bond` | action | L0 Inform | Critical | Initiate bond claim (partial or full) |
| `terminate_lease` | action | L0 Inform | Critical | Initiate lease termination |
| `workflow_find_tenant` | workflow | L3 Suggest | Medium | Full workflow: list -> syndicate -> screen -> recommend |
| `workflow_onboard_tenant` | workflow | L3 Suggest | High | Onboard workflow: lease -> sign -> bond -> inspection |
| `workflow_end_tenancy` | workflow | L3 Suggest | High | End tenancy: exit inspection -> bond -> relist |

#### Background Tasks Triggered at This Mission

| Task | Schedule | Description |
|------|----------|-------------|
| `lease_lifecycle_alerts` | Daily 8am | Checks for leases expiring within 90/60/30 days, rent reviews due, and sends tier-appropriate notifications |
| `rent_increase_effective` | Daily 6am | Applies rent increases on their effective date (updates tenancy rent_amount, regenerates rent schedule) |

## Rent Increase Workflow

### Database Addition
```sql
-- Rent increase tracking
CREATE TABLE rent_increases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,

  -- Amounts
  current_amount DECIMAL(10,2) NOT NULL,
  new_amount DECIMAL(10,2) NOT NULL,
  increase_percentage DECIMAL(5,2), -- Calculated: (new-current)/current * 100

  -- Dates
  notice_date DATE NOT NULL,           -- When notice was issued
  effective_date DATE NOT NULL,        -- When increase takes effect
  minimum_notice_days INTEGER NOT NULL, -- State-specific

  -- Notice
  notice_document_url TEXT,            -- Generated PDF notice
  notice_sent_at TIMESTAMPTZ,
  notice_method TEXT,                  -- 'in_app', 'email', 'post'

  -- Tenant response
  tenant_acknowledged_at TIMESTAMPTZ,
  tenant_disputed BOOLEAN DEFAULT FALSE,
  tenant_dispute_reason TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'notice_sent', 'acknowledged', 'disputed', 'applied', 'cancelled'
  )),

  -- Justification
  justification TEXT,                  -- Owner's reason
  cpi_rate DECIMAL(5,2),              -- ABS CPI at time of increase
  comparable_rents JSONB,             -- Market data snapshot

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rent_increases_tenancy ON rent_increases(tenancy_id);
CREATE INDEX idx_rent_increases_effective ON rent_increases(effective_date) WHERE status = 'notice_sent';

-- RLS
ALTER TABLE rent_increases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage rent increases"
  ON rent_increases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = rent_increases.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view rent increases"
  ON rent_increases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = rent_increases.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );
```

### State-Specific Notice Requirements
```typescript
// packages/api/src/constants/rentIncreaseRules.ts

export const RENT_INCREASE_RULES = {
  NSW: {
    minimumNoticeDays: 60,
    maxFrequency: '12_months',  // Cannot increase more than once per 12 months
    fixedTermRestriction: true,  // Cannot increase during fixed term
    periodicOnly: false,         // Can increase if lease allows
    excessiveIncrease: 'ncat',   // Tenant can challenge at NCAT
    noticeForm: 'no_prescribed_form', // But must be in writing
  },
  VIC: {
    minimumNoticeDays: 60,
    maxFrequency: '12_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'vcat',
    noticeForm: 'prescribed_form', // Must use prescribed form
  },
  QLD: {
    minimumNoticeDays: 60,
    maxFrequency: '6_months',   // Every 6 months for periodic
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'qcat',
    noticeForm: 'form_10',      // Must use Form 10
  },
} as const;
```

### Lease Lifecycle Edge Function
```typescript
// supabase/functions/lease-lifecycle-alerts/index.ts

/**
 * Runs daily at 8:00 AM AEST
 * Checks all active tenancies for lifecycle events
 */
async function processLeaseLifecycleAlerts() {
  const today = new Date();

  // 1. Leases expiring in 90 days
  const expiring90 = await getExpiringLeases(today, 90);
  for (const tenancy of expiring90) {
    await createNotification({
      userId: tenancy.ownerId,
      type: 'lease_expiry_90',
      title: 'Lease ending in 90 days',
      body: `${tenancy.property.address} — consider renewal or relisting`,
      actionUrl: `/tenancies/${tenancy.id}`,
    });
  }

  // 2. Leases expiring in 60 days (renewal notice due)
  const expiring60 = await getExpiringLeases(today, 60);
  for (const tenancy of expiring60) {
    if (tenancy.ownerTier === 'pro' || tenancy.ownerTier === 'hands_off') {
      // Auto-generate renewal offer for Pro/Hands-Off
      await generateRenewalOffer(tenancy);
    } else {
      // Prompt Starter user
      await createNotification({
        userId: tenancy.ownerId,
        type: 'lease_expiry_60',
        title: 'Renewal notice due now',
        body: `Send renewal to tenant or let the lease convert to periodic`,
        actionUrl: `/tenancies/${tenancy.id}/renew`,
        ctaLabel: 'Send Renewal',
      });
    }
  }

  // 3. Leases expiring in 30 days (final reminder)
  const expiring30 = await getExpiringLeases(today, 30);
  // ... similar pattern

  // 4. Annual rent review reminders (12 months since last increase)
  const rentReviewDue = await getTenanciesDueRentReview(today);
  for (const tenancy of rentReviewDue) {
    const cpiRate = await fetchCPIRate(); // ABS CPI data
    await createNotification({
      userId: tenancy.ownerId,
      type: 'rent_review_due',
      title: 'Annual rent review due',
      body: `Current CPI: ${cpiRate}%. Review rent for ${tenancy.property.address}`,
      actionUrl: `/tenancies/${tenancy.id}/rent-increase`,
    });
  }
}
```

### Owner App UI Additions (Lease Lifecycle)
```
apps/owner/app/(app)/tenancies/[id]/
├── renew.tsx              # Renewal offer screen
├── rent-increase.tsx      # Rent increase wizard
└── terminate.tsx          # End tenancy flow (existing)

apps/owner/components/
├── LeaseExpiryBanner.tsx  # Shows countdown to lease end
├── RentIncreaseForm.tsx   # New amount + justification + notice preview
├── RenewalOfferForm.tsx   # New terms for renewal
├── AutoManagedSection.tsx # Shows automated actions (Pro/Hands-Off)
└── LeaseStatusCard.tsx    # Card showing lease status with pills
```

### Lease Status Card UI (matching website mockup)
```
┌─────────────────────────────────────────┐
│  42 Smith St, Bondi                      │
│  ┌──────────┐                            │
│  │ Active   │  $670/week                 │
│  └──────────┘                            │
│  Tenant: Sarah Johnson                   │
│  Lease: 1 Mar 2024 → 28 Feb 2025        │
│                                          │
│  ─────────────────────────────────────   │
│  ✓ AUTO-MANAGED                          │
│  ✓ Bond lodged with NSW Fair Trading     │
│  ✓ Renewal notice sent (60 days)         │
│  ✓ NSW compliant templates used          │
└─────────────────────────────────────────┘
```

## Deferred from Mission 04: Vacancy Detection UI

The following items were deferred from Mission 04 (Property Listings) because they depend on the tenancy lifecycle triggers created in this mission. They MUST be implemented as part of Mission 06.

### VacancyBanner Component
When a tenancy ends and `update_property_status_on_tenancy()` sets `properties.status = 'vacant'`, the owner app must show a vacancy banner on the property card:

**Files to create**:
```
apps/owner/components/VacancyBanner.tsx
packages/api/src/hooks/useVacancyPrompt.ts
```

**useVacancyPrompt hook** returns:
```typescript
interface VacancyPrompt {
  isVacant: boolean;
  daysSinceVacant: number;        // Calculated from properties.vacant_since
  canCreateListing: boolean;      // Pro/Hands-Off: true, Starter: needs add-on
  addOnAvailable: boolean;        // Starter: can purchase tenant finding
  previousTenancy?: Tenancy;      // For context in AI-generated listing
}
```

**VacancyBanner** displays differently per tier:
- **Starter tier**: Shows upgrade prompt with "Purchase Tenant Finding — $79" and "Upgrade to Pro" buttons
- **Pro/Hands-Off tier**: Shows "Create Listing with AI" button that navigates to create listing screen

The banner should appear on:
- Property detail screen (when property status is 'vacant')
- Properties list (as a card overlay or badge with days-since-vacant count)

### TenantFindingAddOn Purchase Flow
For Starter users who want to find a tenant without upgrading:
- Purchase flow charges $79 one-time fee via Stripe (links to Mission 07 Stripe integration)
- On successful purchase, grants access to create listing + AI generation for that specific property
- Track add-on purchases in a `tenant_finding_purchases` table or similar

### Testing Requirements (add to Phase I)
- [ ] E2E test: Tenancy ends → Property status becomes 'vacant' → VacancyBanner appears
- [ ] Starter user sees upgrade prompt with correct pricing
- [ ] Pro/Hands-Off user sees "Create Listing with AI" CTA
- [ ] Days-since-vacant counter increments correctly (uses `properties.vacant_since`)

### Database Context
The `properties.vacant_since` and `properties.total_vacancy_days` columns and the `track_vacancy_start()` trigger were already created in Mission 04's migration. The `update_property_status_on_tenancy()` function created here will set `properties.status = 'vacant'` when a tenancy ends, which triggers `track_vacancy_start()` to set `vacant_since = CURRENT_DATE`.

---

## Implementation Status

| Item | Status | Destination | Reason |
|------|--------|-------------|--------|
| DocuSign integration | Deferred | Mission 19 Pre-Launch | Requires DocuSign developer account (not yet created) |
| State Bond Authority APIs | Deferred | Mission 19 Pre-Launch | Requires registration with NSW/VIC/QLD bond authorities |
| Lease lifecycle alerts Edge Function | Deferred | Mission 17 | Depends on notification infrastructure |
| TenantFindingAddOn purchase flow | Deferred | Mission 07 | Depends on Stripe integration |
| VacancyBanner + useVacancyPrompt | Implemented | N/A | Completed as part of Mission 06 |
| Owner tenancy screens (list, create, detail, edit, terminate, rent-increase, renew, documents) | Implemented | N/A | All screens created |
| Tenant tenancy screens (dashboard, lease, documents) | Implemented | N/A | All screens created |
| Navigation flows (approved application → create tenancy, tenant home → tenancy) | Implemented | N/A | All wired up |
| Rent increase state-specific rules | Implemented | N/A | All 8 states/territories covered |
| Unit tests | Implemented | N/A | 42 new tests (175 total) |

---

## Phase 2: Compliance Document System (Post-Mission 14)

When a tenancy is created (by any path — marketplace, Domain/REA, connection code, direct invite, or personal arrangement), the compliance system activates.

### Phase 2A: Compliance Checklist (State-Specific)

**File**: `packages/api/src/constants/complianceChecklist.ts` (new)
**File**: `apps/owner/app/(app)/tenancies/[id]/compliance.tsx` (new)

Auto-generated compliance checklist per tenancy based on the property's state. The agent proactively tracks incomplete items via heartbeat.

```typescript
// packages/api/src/constants/complianceChecklist.ts

export interface ComplianceItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  category: 'pre_tenancy' | 'during_tenancy' | 'end_tenancy';
  documentType?: string;   // Links to tenancy_documents.document_type
  automatable: boolean;     // Can the agent handle this?
  states: string[];         // Which states require this
}

export const COMPLIANCE_CHECKLISTS: Record<string, ComplianceItem[]> = {
  NSW: [
    { id: 'nsw_condition_report', label: 'Condition Report', description: 'Complete entry condition report with photos', required: true, category: 'pre_tenancy', documentType: 'condition_report_entry', automatable: true, states: ['NSW'] },
    { id: 'nsw_bond_lodge', label: 'Bond Lodgement', description: 'Lodge bond with NSW Fair Trading within 10 business days', required: true, category: 'pre_tenancy', automatable: true, states: ['NSW'] },
    { id: 'nsw_lease_signed', label: 'Lease Agreement Signed', description: 'NSW standard residential tenancy agreement', required: true, category: 'pre_tenancy', documentType: 'lease', automatable: true, states: ['NSW'] },
    { id: 'nsw_strata_bylaws', label: 'Strata By-Laws Attached', description: 'Attach strata by-laws if applicable', required: false, category: 'pre_tenancy', automatable: false, states: ['NSW'] },
    { id: 'nsw_smoke_alarms', label: 'Smoke Alarm Compliance', description: 'Working smoke alarms on every level', required: true, category: 'pre_tenancy', automatable: false, states: ['NSW'] },
    // ... more items
  ],
  VIC: [
    { id: 'vic_condition_report', label: 'Condition Report', description: 'Complete entry condition report', required: true, category: 'pre_tenancy', documentType: 'condition_report_entry', automatable: true, states: ['VIC'] },
    { id: 'vic_bond_lodge', label: 'Bond Lodgement', description: 'Lodge bond with RTBA', required: true, category: 'pre_tenancy', automatable: true, states: ['VIC'] },
    { id: 'vic_lease_signed', label: 'Lease Agreement Signed', description: 'VIC standard residential tenancy agreement', required: true, category: 'pre_tenancy', documentType: 'lease', automatable: true, states: ['VIC'] },
    { id: 'vic_minimum_standards', label: 'Minimum Standards Met', description: 'Property meets VIC rental minimum standards', required: true, category: 'pre_tenancy', automatable: false, states: ['VIC'] },
    { id: 'vic_gas_safety', label: 'Gas Safety Check', description: 'Gas appliance safety check certificate', required: true, category: 'pre_tenancy', automatable: false, states: ['VIC'] },
    { id: 'vic_electrical_safety', label: 'Electrical Safety Check', description: 'Electrical safety check every 2 years', required: true, category: 'pre_tenancy', automatable: false, states: ['VIC'] },
    // ... more items
  ],
  QLD: [
    { id: 'qld_condition_report', label: 'Condition Report', description: 'Complete entry condition report', required: true, category: 'pre_tenancy', documentType: 'condition_report_entry', automatable: true, states: ['QLD'] },
    { id: 'qld_bond_lodge', label: 'Bond Lodgement', description: 'Lodge bond with RTA within 10 days', required: true, category: 'pre_tenancy', automatable: true, states: ['QLD'] },
    { id: 'qld_form_18a', label: 'Form 18a Signed', description: 'QLD General Tenancy Agreement (Form 18a)', required: true, category: 'pre_tenancy', documentType: 'lease', automatable: true, states: ['QLD'] },
    { id: 'qld_smoke_alarms', label: 'Smoke Alarm Compliance', description: 'Interconnected photoelectric smoke alarms', required: true, category: 'pre_tenancy', automatable: false, states: ['QLD'] },
    { id: 'qld_pool_safety', label: 'Pool Safety Certificate', description: 'Valid pool safety certificate if applicable', required: false, category: 'pre_tenancy', automatable: false, states: ['QLD'] },
    // ... more items
  ],
};
```

**Compliance Screen**: Shows checklist with completion status, links to upload documents, and agent can auto-mark items as complete when it detects the relevant action has been taken.

### Phase 2B: Lease Agreement Generator

**File**: `packages/api/src/services/leaseGenerator.ts` (new)
**File**: `apps/owner/app/(app)/tenancies/[id]/generate-lease.tsx` (new)

HTML template → PDF via expo-print. State-specific templates for NSW, VIC, QLD.

```typescript
// packages/api/src/services/leaseGenerator.ts

interface LeaseData {
  // Parties
  ownerName: string;
  ownerAddress: string;
  tenantNames: string[];

  // Property
  propertyAddress: string;
  propertyType: string;

  // Terms
  leaseStartDate: string;
  leaseEndDate: string;
  rentAmount: number;
  rentFrequency: string;
  bondAmount: number;

  // Policies
  petsAllowed: boolean;
  smokingAllowed: boolean;

  // State-specific
  state: 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';
  specialConditions: string[];
}

export async function generateLeaseHTML(data: LeaseData): Promise<string> {
  // Returns state-specific HTML lease template populated with data
  // Includes all required statutory clauses for the state
}

export async function generateLeasePDF(data: LeaseData): Promise<string> {
  // Uses expo-print to convert HTML to PDF
  // Returns file URI for upload/sharing
}
```

### Phase 2C: Condition Report

**File**: `packages/api/src/services/conditionReportGenerator.ts` (new)
**File**: `apps/owner/app/(app)/tenancies/[id]/condition-report.tsx` (new)

Room-by-room condition report with photo capture:

```typescript
interface ConditionReportRoom {
  name: string;              // 'Living Room', 'Kitchen', 'Bedroom 1', etc.
  items: ConditionReportItem[];
}

interface ConditionReportItem {
  name: string;              // 'Walls', 'Ceiling', 'Floor', 'Windows', etc.
  condition: 'new' | 'good' | 'fair' | 'poor' | 'damaged';
  notes: string;
  photos: string[];          // Storage URIs
}

interface ConditionReport {
  tenancyId: string;
  type: 'entry' | 'exit';
  rooms: ConditionReportRoom[];
  overallNotes: string;
  completedAt: string;
  completedBy: string;       // Owner or tenant ID
}
```

- Room-by-room entry with predefined item templates
- Camera integration for photos
- Entry and exit versions (compare at end of tenancy)
- PDF generation for records
- Stored as `tenancy_documents` with type `condition_report_entry` or `condition_report_exit`

### Phase 2D: Direct Invitation Path

**File**: `apps/owner/app/(app)/connections/invite.tsx` (new)
**File**: `packages/api/src/hooks/useDirectInvite.ts` (new)

Owner can invite a tenant by email/phone with pre-set lease terms. Tenant accepts and tenancy is created with compliance flow activated.

```sql
-- Add to marketplace_enhancements migration
CREATE TABLE direct_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Invitee
  invitee_email TEXT,
  invitee_phone TEXT,
  invitee_name TEXT,

  -- Pre-set terms
  rent_amount DECIMAL(10,2) NOT NULL,
  rent_frequency payment_frequency NOT NULL DEFAULT 'weekly',
  lease_start_date DATE NOT NULL,
  lease_end_date DATE NOT NULL,
  bond_amount DECIMAL(10,2),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  accepted_by UUID REFERENCES auth.users(id),
  tenancy_id UUID REFERENCES tenancies(id),

  -- Metadata
  invite_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_direct_invitations_owner ON direct_invitations(owner_id);
CREATE INDEX idx_direct_invitations_code ON direct_invitations(invite_code);

ALTER TABLE direct_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage invitations" ON direct_invitations FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Invitees can view" ON direct_invitations FOR SELECT USING (auth.uid() = accepted_by OR status = 'pending');
```

Flow:
1. Owner enters invitee details + lease terms
2. System sends email/SMS with invite link
3. Tenant opens app, enters invite code (or clicks deep link)
4. Tenant reviews terms and accepts
5. Tenancy created → compliance checklist activated
6. Agent orchestrates remaining steps (lease signing, bond lodgement, condition report)

### Testing for Phase 2
- [ ] Compliance checklist generates correctly for NSW, VIC, QLD
- [ ] Agent tracks incomplete compliance items via heartbeat
- [ ] Lease PDF generates with correct state-specific clauses
- [ ] Condition report captures room-by-room data with photos
- [ ] Condition report generates as PDF
- [ ] Direct invitation sends email/SMS correctly
- [ ] Tenant can accept invitation and tenancy is created
- [ ] Compliance flow activates regardless of tenancy entry path

## Notes
- Tenancies link property, tenant(s), and financial records
- Multiple tenants supported via junction table
- Bond lodgement tracking important for compliance
- Lease documents should be versioned (keep history)
- Property status auto-updates when tenancy status changes
- End of tenancy triggers condition report flow (Mission 11)
- Rent increases must comply with state-specific notice periods and frequency limits
- Lease lifecycle alerts drive proactive owner engagement and reduce vacancy
- Pro/Hands-Off tiers get automated renewal offers; Starter users get prompts to act manually
- Multiple tenancy entry paths (marketplace, Domain/REA, connection codes, direct invites, personal arrangements) all converge through the same compliance flow

---

## Third-Party Integrations (CRITICAL FOR LAUNCH)

### Digital Signatures (DocuSign)
**Why**: Legal lease agreements require signatures. DocuSign provides legally binding e-signatures compliant with Australian Electronic Transactions Act.

#### DocuSign Integration
| Aspect | Details |
|--------|---------|
| **API** | DocuSign eSignature REST API |
| **Purpose** | Digital lease signing by all parties |
| **Features** | Sequential signing, reminders, audit trail, mobile signing |
| **Compliance** | Australian Electronic Transactions Act compliant |
| **Pricing** | Per-envelope fee or subscription plans |

**API Functions (from STEAD-BIBLE.md)**:
```typescript
// packages/integrations/src/docusign/client.ts
interface DocuSignService {
  // Create a signing envelope
  createEnvelope(params: {
    templateId: string;        // State-specific lease template
    signers: Signer[];
    data: LeaseData;           // Merge fields
    webhookUrl: string;        // Status callback URL
  }): Promise<EnvelopeResult>;

  // Get envelope status
  getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus>;

  // Download signed document
  downloadDocument(envelopeId: string): Promise<Buffer>;

  // Send reminder to pending signers
  sendReminder(envelopeId: string): Promise<void>;

  // Void an envelope (cancel before completion)
  voidEnvelope(envelopeId: string, reason: string): Promise<void>;
}

interface Signer {
  name: string;
  email: string;
  role: 'owner' | 'tenant' | 'co_tenant' | 'witness';
  order: number;             // Signing order (1 = first)
  tabs: SignatureTab[];      // Where to sign
}

interface LeaseData {
  propertyAddress: string;
  rentAmount: number;
  rentFrequency: string;
  bondAmount: number;
  leaseStartDate: string;
  leaseEndDate: string;
  tenantNames: string[];
  ownerName: string;
  specialConditions: string[];
  // ... other merge fields
}

interface EnvelopeResult {
  envelopeId: string;
  status: 'created' | 'sent' | 'delivered' | 'completed' | 'declined' | 'voided';
  signingUrl?: string;       // For embedded signing
}
```

**Implementation Tasks**:
- [ ] Create DocuSign developer account
- [ ] Create state-specific lease templates in DocuSign
  - [ ] NSW Residential Tenancy Agreement template
  - [ ] VIC Residential Tenancy Agreement template
  - [ ] QLD Form 18a General Tenancy Agreement template
- [ ] Create `packages/integrations/src/docusign/` service module
- [ ] Implement embedded signing (in-app experience)
- [ ] Handle webhook events for signing status
- [ ] Store completed documents in Supabase Storage
- [ ] Generate audit trail PDF

**State-Specific Templates**:
```typescript
// packages/integrations/src/docusign/templates.ts
export const LEASE_TEMPLATES = {
  NSW: {
    templateId: 'docusign_template_nsw',
    requiredFields: [
      'landlord_name', 'tenant_name', 'property_address',
      'rent_amount', 'rent_frequency', 'bond_amount',
      'lease_start', 'lease_end', 'water_usage_charges',
      'strata_bylaws_attached', 'condition_report_date'
    ],
    specialClauses: ['nsw_strata_bylaw_clause', 'nsw_water_efficiency']
  },
  VIC: {
    templateId: 'docusign_template_vic',
    requiredFields: [
      'landlord_name', 'tenant_name', 'property_address',
      'rent_amount', 'rent_frequency', 'bond_amount',
      'lease_start', 'lease_end', 'gas_safety_check',
      'electrical_safety_check', 'pool_registration'
    ],
    specialClauses: ['vic_minimum_standards', 'vic_renting_reforms']
  },
  QLD: {
    templateId: 'docusign_template_qld',
    requiredFields: [
      'landlord_name', 'tenant_name', 'property_address',
      'rent_amount', 'rent_frequency', 'bond_amount',
      'lease_start', 'lease_end', 'approved_form_18a',
      'smoke_alarm_compliance', 'pool_safety_certificate'
    ],
    specialClauses: ['qld_domestic_violence_provisions', 'qld_ending_tenancy_reforms']
  }
};
```

**Database Additions**:
```sql
-- DocuSign envelope tracking
ALTER TABLE tenancies ADD COLUMN docusign_envelope_id TEXT;
ALTER TABLE tenancies ADD COLUMN docusign_status TEXT DEFAULT 'not_sent';
ALTER TABLE tenancies ADD COLUMN lease_sent_at TIMESTAMPTZ;
ALTER TABLE tenancies ADD COLUMN all_signed_at TIMESTAMPTZ;

-- Signing events for audit
CREATE TABLE lease_signing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  envelope_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided'
  signer_email TEXT,
  signer_name TEXT,
  signer_role TEXT,
  ip_address INET,
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_lease_signing_events_tenancy ON lease_signing_events(tenancy_id);
```

### State Bond Authority APIs
**Why**: Bond lodgement is legally required. Automated lodgement reduces admin burden and ensures compliance.

#### NSW Fair Trading Rental Bond Online
| Aspect | Details |
|--------|---------|
| **System** | Rental Bonds Online (RBO) |
| **Integration** | API or Web automation |
| **Purpose** | Lodge/claim bonds with NSW Fair Trading |
| **Requirements** | Licensed agent or landlord registration |

**API Functions (from STEAD-BIBLE.md)**:
```typescript
// packages/integrations/src/bond-authorities/nsw.ts
interface NSWBondService {
  // Lodge a new bond
  lodgeBond(params: {
    tenancyId: string;
    amount: number;
    propertyAddress: Address;
    landlord: BondParty;
    tenants: BondParty[];
    paymentMethod: 'eft' | 'bpay' | 'direct_debit';
  }): Promise<BondLodgementResult>;

  // Claim bond at end of tenancy
  claimBond(params: {
    bondNumber: string;
    claimType: 'full_refund' | 'partial_refund' | 'landlord_claim';
    tenantAmount: number;
    landlordAmount: number;
    reason?: string;
  }): Promise<BondClaimResult>;

  // Check bond status
  getBondStatus(bondNumber: string): Promise<BondStatus>;
}

interface BondLodgementResult {
  bondNumber: string;
  lodgementDate: Date;
  amount: number;
  status: 'pending' | 'lodged' | 'active';
  receiptUrl: string;
}

interface BondClaimResult {
  claimId: string;
  status: 'pending' | 'approved' | 'disputed';
  tenantConsent: boolean;
  expectedPaymentDate?: Date;
}
```

**Implementation Tasks**:
- [ ] Register for NSW RBO API access (or implement web automation)
- [ ] Create `packages/integrations/src/bond-authorities/nsw.ts`
- [ ] Implement bond lodgement flow
- [ ] Implement bond claim/refund flow
- [ ] Handle tenant consent for bond claims
- [ ] Store bond numbers and receipts
- [ ] Set up status polling for pending lodgements

**VIC RTBA (Residential Tenancies Bond Authority)**:
```typescript
// packages/integrations/src/bond-authorities/vic.ts
interface VICBondService {
  lodgeBond(params: LodgementParams): Promise<BondLodgementResult>;
  claimBond(params: ClaimParams): Promise<BondClaimResult>;
  getBondStatus(bondNumber: string): Promise<BondStatus>;
}
```

**QLD RTA (Residential Tenancies Authority)**:
```typescript
// packages/integrations/src/bond-authorities/qld.ts
interface QLDBondService {
  lodgeBond(params: LodgementParams): Promise<BondLodgementResult>;
  claimBond(params: ClaimParams): Promise<BondClaimResult>;
  getBondStatus(bondNumber: string): Promise<BondStatus>;
  // QLD-specific: Dispute resolution
  lodgeDispute(bondNumber: string, details: DisputeDetails): Promise<DisputeResult>;
}
```

**Database Additions**:
```sql
-- Enhanced bond tracking
CREATE TABLE bond_lodgements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,

  -- Bond authority details
  state TEXT NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),
  bond_number TEXT UNIQUE,
  lodgement_reference TEXT,

  -- Amounts
  amount DECIMAL(10,2) NOT NULL,
  lodgement_fee DECIMAL(10,2),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'lodged', 'active', 'claim_pending', 'claimed', 'refunded', 'disputed'
  )),

  -- Payment
  payment_method TEXT,
  payment_reference TEXT,
  payment_date DATE,

  -- Lodgement receipt
  receipt_url TEXT,
  receipt_number TEXT,

  -- Timestamps
  lodged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bond_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bond_lodgement_id UUID NOT NULL REFERENCES bond_lodgements(id),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),

  -- Claim details
  claim_type TEXT NOT NULL CHECK (claim_type IN ('full_tenant', 'full_landlord', 'partial', 'disputed')),
  tenant_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  landlord_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  reason TEXT,

  -- Consent tracking
  tenant_consent_at TIMESTAMPTZ,
  landlord_consent_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending_consent', 'submitted', 'approved', 'disputed', 'paid'
  )),

  -- Dispute
  dispute_lodged_at TIMESTAMPTZ,
  dispute_reference TEXT,
  tribunal_date DATE,

  -- Payment
  payment_date DATE,
  payment_reference TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bond_lodgements_tenancy ON bond_lodgements(tenancy_id);
CREATE INDEX idx_bond_claims_lodgement ON bond_claims(bond_lodgement_id);
```

### Environment Variables
```bash
# DocuSign
DOCUSIGN_INTEGRATION_KEY=xxx
DOCUSIGN_USER_ID=xxx
DOCUSIGN_ACCOUNT_ID=xxx
DOCUSIGN_BASE_URL=https://demo.docusign.net  # or https://www.docusign.net
DOCUSIGN_PRIVATE_KEY=xxx  # RSA private key for JWT auth
DOCUSIGN_WEBHOOK_SECRET=xxx

# NSW Fair Trading
NSW_RBO_API_KEY=xxx
NSW_RBO_AGENT_ID=xxx

# VIC RTBA
VIC_RTBA_API_KEY=xxx
VIC_RTBA_AGENT_ID=xxx

# QLD RTA
QLD_RTA_API_KEY=xxx
QLD_RTA_AGENT_ID=xxx
```

### Files to Create for Integrations
```
packages/integrations/
├── src/
│   ├── docusign/
│   │   ├── client.ts          # DocuSign API client
│   │   ├── templates.ts       # State-specific templates
│   │   ├── types.ts           # DocuSign types
│   │   └── webhooks.ts        # Webhook event handlers
│   └── bond-authorities/
│       ├── index.ts           # Factory for state-specific
│       ├── nsw.ts             # NSW Fair Trading
│       ├── vic.ts             # VIC RTBA
│       ├── qld.ts             # QLD RTA
│       └── types.ts           # Shared types

supabase/functions/
├── docusign-webhook/          # Handle signing events
│   └── index.ts
├── send-lease-for-signing/    # Create and send envelope
│   └── index.ts
├── lodge-bond/                # Lodge bond with authority
│   └── index.ts
└── claim-bond/                # Process bond claim
    └── index.ts
```

### Owner App UI Additions
- [ ] "Send for Signing" button on TenancyDetailScreen
- [ ] Signing status tracker (who has signed, who hasn't)
- [ ] "Send Reminder" button for unsigned parties
- [ ] "Lodge Bond" button with state detection
- [ ] Bond lodgement status display
- [ ] "Claim Bond" flow at end of tenancy
- [ ] Bond dispute tracking

### Tenant App UI Additions
- [ ] In-app lease signing experience (embedded DocuSign)
- [ ] Signing reminder notifications
- [ ] Bond lodgement confirmation
- [ ] Bond claim consent flow
- [ ] Dispute response option

### Integration Priority
| Integration | Priority | MVP Required | Notes |
|-------------|----------|--------------|-------|
| DocuSign | P1 | Yes | Essential for remote lease signing |
| NSW Bond API | P2 | Recommended | High volume state |
| VIC Bond API | P2 | Recommended | High volume state |
| QLD Bond API | P2 | Recommended | High volume state |

### Compliance Notes
- DocuSign signatures meet Australian Electronic Transactions Act requirements
- Lease templates must be reviewed by legal for each state
- Bond lodgement deadlines vary by state (typically within 10 working days)
- Bond claim disputes may require tribunal attendance

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`tenancies`, `tenancy_tenants`, `tenancy_documents`, `rent_increases`, `bond_lodgements`, `bond_claims`, `lease_signing_events`)
- [ ] RLS policies verified: owners can CRUD tenancies for their properties
- [ ] RLS policies verified: tenants can view their own tenancies
- [ ] RLS policies verified: document and tenant permissions follow tenancy ownership
- [ ] `update_property_status_on_tenancy()` trigger updates property status on tenancy changes
- [ ] `tenancy_created` trigger sets property to occupied on active insert
- [ ] `update_updated_at()` trigger works on tenancies table
- [ ] UNIQUE constraint on `(tenancy_id, tenant_id)` in tenancy_tenants
- [ ] Foreign keys correct: property_id (RESTRICT), listing_id (SET NULL), application_id (SET NULL)
- [ ] Indexes created for all query patterns (property, status, tenant)
- [ ] `rent_increases` table RLS allows owners to manage, tenants to view

### Feature Verification (Mission-Specific)
- [ ] Owner can create a tenancy from an approved application (auto-populates details)
- [ ] Lease start/end dates, rent amount, frequency, and bond are configurable
- [ ] Multiple tenants can be added to a tenancy (primary + co-tenants)
- [ ] Lease document generates as PDF with state-specific clauses
- [ ] DocuSign integration sends lease for e-signing (sequential signing order)
- [ ] Signing status tracks which parties have signed
- [ ] Bond lodgement can be initiated with state authority
- [ ] Bond status displays correctly (pending, lodged, claimed, returned)
- [ ] Tenancies list shows all with status filter (active, ending, ended)
- [ ] Tenancy detail screen shows all information, tenants, documents, payment summary
- [ ] Tenant app shows current lease details and rent due dates
- [ ] Lease lifecycle alerts fire at 90/60/30 days before expiry
- [ ] Rent increase wizard calculates notice period by state
- [ ] Rent increase notice generates as PDF in correct statutory format
- [ ] Lease renewal workflow works (auto for Pro/Hands-Off, prompt for Starter)
- [ ] End of tenancy checklist and bond return process works
- [ ] AUTO-MANAGED section displays for Pro/Hands-Off tiers

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
