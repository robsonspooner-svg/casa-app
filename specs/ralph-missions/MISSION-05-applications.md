# Mission 05: Tenant Applications

## Overview
**Goal**: Enable tenants to apply for listings and owners to review/approve applications.
**Dependencies**: Mission 04 (Listings)
**Estimated Complexity**: Medium-High

## Success Criteria

### Phase A: Database Schema
- [ ] Create `applications` table
- [ ] Create `application_documents` table
- [ ] Create `application_references` table
- [ ] Set up RLS policies (tenants see own, owners see for their listings)
- [ ] Create storage bucket for application documents

### Phase B: Application Form (Tenant App)
- [ ] Create ApplicationScreen with multi-step form
- [ ] Step 1: Personal details (name, phone, email, current address)
- [ ] Step 2: Employment (employer, income, employment type)
- [ ] Step 3: Rental history (current landlord, reason for moving)
- [ ] Step 4: References (2 references with contact info)
- [ ] Step 5: Documents (ID, payslips, rental ledger)
- [ ] Step 6: Review and submit
- [ ] Save draft functionality
- [ ] Document upload with preview

### Phase C: My Applications (Tenant App)
- [ ] Create MyApplicationsScreen
- [ ] Show all applications with status
- [ ] Link to view application details
- [ ] Show property/listing info

### Phase D: Application Review (Owner App)
- [ ] Create ApplicationsScreen (list for a listing)
- [ ] Show application cards with key info
- [ ] Filter by status (pending, shortlisted, approved, rejected)
- [ ] Bulk actions (shortlist multiple)

### Phase E: Application Details (Owner App)
- [ ] Create ApplicationDetailScreen
- [ ] Show all applicant information
- [ ] View uploaded documents
- [ ] Contact references (one-tap call/email)
- [ ] Approve/reject with reason
- [ ] Send to shortlist

### Phase F: Notifications
- [ ] Email tenant when application status changes
- [ ] Email owner when new application received
- [ ] In-app notification (placeholder for Mission 17)

### Phase G: Testing
- [ ] Unit tests for application hooks
- [ ] Integration tests for application flow
- [ ] E2E test: Submit application → Review → Approve

## Database Schema

```sql
-- Application status enum
CREATE TYPE application_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'shortlisted',
  'approved',
  'rejected',
  'withdrawn'
);

-- Employment type enum
CREATE TYPE employment_type AS ENUM (
  'full_time',
  'part_time',
  'casual',
  'self_employed',
  'unemployed',
  'retired',
  'student'
);

-- Applications table
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Personal details
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_of_birth DATE,
  current_address TEXT NOT NULL,

  -- Employment
  employment_type employment_type NOT NULL,
  employer_name TEXT,
  job_title TEXT,
  annual_income DECIMAL(10,2),
  employment_start_date DATE,

  -- Rental history
  current_landlord_name TEXT,
  current_landlord_phone TEXT,
  current_landlord_email TEXT,
  current_rent DECIMAL(10,2),
  tenancy_start_date DATE,
  reason_for_moving TEXT,
  has_pets BOOLEAN NOT NULL DEFAULT FALSE,
  pet_description TEXT,

  -- Application
  move_in_date DATE NOT NULL,
  lease_term_preference lease_term,
  additional_occupants INTEGER NOT NULL DEFAULT 0,
  occupant_details TEXT,
  additional_notes TEXT,

  -- Status
  status application_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One application per tenant per listing
  UNIQUE(listing_id, tenant_id)
);

-- Application references
CREATE TABLE application_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('personal', 'professional', 'landlord')),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  contacted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Application documents
CREATE TABLE application_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'id_primary',      -- Passport, driver's license
    'id_secondary',    -- Medicare card, etc.
    'proof_of_income', -- Payslips, tax return
    'rental_ledger',   -- Current rental history
    'bank_statement',
    'employment_letter',
    'other'
  )),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_applications_listing ON applications(listing_id);
CREATE INDEX idx_applications_tenant ON applications(tenant_id);
CREATE INDEX idx_applications_status ON applications(listing_id, status);
CREATE INDEX idx_application_refs ON application_references(application_id);
CREATE INDEX idx_application_docs ON application_documents(application_id);

-- RLS Policies
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

-- Tenants can manage own applications
CREATE POLICY "Tenants can CRUD own applications"
  ON applications FOR ALL
  USING (auth.uid() = tenant_id);

-- Owners can view applications for their listings
CREATE POLICY "Owners can view applications for their listings"
  ON applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = applications.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Owners can update status
CREATE POLICY "Owners can update application status"
  ON applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = applications.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

-- References follow application permissions
CREATE POLICY "Tenants can CRUD own application references"
  ON application_references FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_references.application_id
      AND applications.tenant_id = auth.uid()
    )
  );

CREATE POLICY "Owners can view application references"
  ON application_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      JOIN listings ON listings.id = applications.listing_id
      WHERE applications.id = application_references.application_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Documents follow same pattern
CREATE POLICY "Tenants can CRUD own application documents"
  ON application_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_documents.application_id
      AND applications.tenant_id = auth.uid()
    )
  );

CREATE POLICY "Owners can view application documents"
  ON application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      JOIN listings ON listings.id = applications.listing_id
      WHERE applications.id = application_documents.application_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Trigger to update listing application count
CREATE OR REPLACE FUNCTION update_application_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'submitted' THEN
    UPDATE listings SET application_count = application_count + 1
    WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'submitted' AND NEW.status = 'submitted' THEN
      UPDATE listings SET application_count = application_count + 1
      WHERE id = NEW.listing_id;
    ELSIF OLD.status = 'submitted' AND NEW.status != 'submitted' THEN
      UPDATE listings SET application_count = application_count - 1
      WHERE id = NEW.listing_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'submitted' THEN
    UPDATE listings SET application_count = application_count - 1
    WHERE id = OLD.listing_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER applications_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_application_count();

-- Updated_at trigger
CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   └── applications.ts         # Application CRUD
├── hooks/
│   ├── useApplications.ts      # List applications
│   ├── useApplication.ts       # Single application
│   ├── useMyApplications.ts    # Tenant's applications
│   └── useApplicationMutations.ts
└── services/
    └── email.ts                # Email notification service
```

### Tenant App
```
apps/tenant/app/(app)/
├── applications/
│   ├── index.tsx               # My applications list
│   ├── [id].tsx                # Application details/status
│   └── apply/
│       ├── _layout.tsx         # Wizard layout
│       ├── [listingId]/
│       │   ├── personal.tsx    # Step 1
│       │   ├── employment.tsx  # Step 2
│       │   ├── rental.tsx      # Step 3
│       │   ├── references.tsx  # Step 4
│       │   ├── documents.tsx   # Step 5
│       │   └── review.tsx      # Step 6

apps/tenant/components/
├── ApplicationCard.tsx         # Application list item
├── ApplicationStatus.tsx       # Status badge with details
├── DocumentUploader.tsx        # File upload component
└── ReferenceForm.tsx           # Reference input form
```

### Owner App
```
apps/owner/app/(app)/
├── listings/[id]/
│   └── applications/
│       ├── index.tsx           # Applications for listing
│       └── [appId].tsx         # Application detail

apps/owner/components/
├── ApplicationCard.tsx         # Applicant summary card
├── ApplicationDetail.tsx       # Full application view
├── DocumentViewer.tsx          # View uploaded docs
├── ReferenceList.tsx           # Reference contact list
└── StatusActions.tsx           # Approve/reject buttons
```

### Shared UI
```
packages/ui/src/components/
├── FileUpload.tsx              # File upload with preview
├── ProgressSteps.tsx           # Application wizard steps
├── ContactButton.tsx           # Call/email button
└── StatusTimeline.tsx          # Application status history
```

## Email Templates

### New Application (to Owner)
```
Subject: New application for {property_address}

Hi {owner_name},

You've received a new application for your property at {property_address}.

Applicant: {applicant_name}
Proposed move-in: {move_in_date}
Employment: {employment_type} at {employer_name}

View the full application in your Casa app.

[View Application]
```

### Status Update (to Tenant)
```
Subject: Application update for {property_address}

Hi {tenant_name},

Your application for {property_address} has been updated.

Status: {new_status}
{rejection_reason if rejected}

{next_steps based on status}

[View in App]
```

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(applications): <description>

Mission-05: Tenant Applications
```

### Agent Tools Available at This Mission

The following tools from the tool catalog become available at Mission 05:

| Name | Category | Autonomy | Risk | Description |
|------|----------|----------|------|-------------|
| `get_applications` | query | L4 Autonomous | None | Get applications for a listing with scores and screening |
| `get_application_detail` | query | L4 Autonomous | None | Full application: documents, references, checks, score |
| `score_application` | generate | L1 Execute | None | AI-score application (0-100) with reasoning |
| `rank_applications` | generate | L2 Draft | None | Rank and compare multiple applications |
| `shortlist_application` | action | L2 Draft | Medium | Move application to shortlist |
| `accept_application` | action | L3 Suggest | High | Approve tenant application (triggers onboarding workflow) |
| `reject_application` | action | L3 Suggest | High | Reject tenant application with reason |
| `run_credit_check` | integration | L3 Suggest | Medium | Run Equifax credit check on applicant |
| `run_tica_check` | integration | L3 Suggest | Medium | Run TICA tenancy database check |

## Implementation Status

### Completed
- Phase A: Database schema (applications, references, documents, background_checks, consents, RLS, triggers, indexes, storage bucket)
- Phase B: Multi-step application form with documents upload (6 steps: Personal, Employment, Rental, References, Documents, Review)
- Phase C: My Applications screen (tenant) with status and pull-to-refresh
- Phase D: Application review list (owner) with status filters and bulk shortlist
- Phase E: Application detail (owner) with approve/reject/shortlist, contact references, view documents, status timeline
- Phase G: Unit tests (17 tests covering hooks and mutations)

### Email Notifications — IMPLEMENTED (January 2026)

**Supabase Edge Functions** created:
- `supabase/functions/send-email/index.ts` — Generic email sending with template support
- `supabase/functions/process-email-queue/index.ts` — Processes queued notifications (for cron)
- `supabase/functions/_shared/sendgrid.ts` — SendGrid client with email templates:
  - `applicationReceived` — Notify owner of new application
  - `applicationStatusUpdate` — Notify tenant of status changes (under_review, shortlisted, approved, rejected)
  - `paymentReceived` — Notify owner of rent payment (Mission 07)
  - `paymentReminder` — Remind tenant of upcoming rent (Mission 07)
  - `leaseExpiringSoon` — Notify owner of lease expiry (Mission 06)

**Database Migration** created:
- `20240101000015_email_notification_triggers.sql`:
  - `email_notifications` table (queue for email processing)
  - `queue_application_received_notification()` trigger function
  - `queue_application_status_notification()` trigger function
  - `queue_payment_received_notification()` trigger function (for Mission 07)

**Pre-Launch Requirements** (external accounts needed):
1. ⬜ Create SendGrid account and verify sender domain
2. ⬜ Set environment variables: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`
3. ⬜ Set up pg_cron or external scheduler to call `process-email-queue` every minute
4. ⬜ Deploy Edge Functions to production Supabase

### Deferred Items

| Item | Deferred To | Reason |
|------|-------------|--------|
| Background checks (Equifax/TICA) | Pre-launch | Requires business verification + third-party API accounts |
| Background check consent flow | Pre-launch | Depends on Equifax/TICA API access |

## Notes
- Store sensitive documents securely in Supabase Storage with signed URLs
- Documents should be encrypted at rest
- Draft applications allow tenants to complete over multiple sessions
- Email notifications use SendGrid or Resend (configure in env)
- Application data feeds into tenancy creation (Mission 06)

---

## Third-Party Integrations (CRITICAL FOR LAUNCH)

### Background Check Services
**Why**: Professional landlords require verified tenant screening. Background checks reduce risk and are standard in the Australian rental market.

#### Equifax Integration
| Aspect | Details |
|--------|---------|
| **API** | Equifax Australia Identity & Credit API |
| **Purpose** | Credit checks and identity verification |
| **Data Retrieved** | Credit score, defaults, bankruptcies, identity verification |
| **Consent Required** | YES - tenant must explicitly consent |
| **Pricing** | Per-check fee (~$20-50 per check) |

**API Functions (from STEAD-BIBLE.md)**:
```typescript
// packages/integrations/src/equifax/client.ts
interface EquifaxService {
  // Run a credit check on an applicant
  runCreditCheck(params: {
    applicantId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    address: Address;
    consentToken: string; // Required proof of consent
  }): Promise<CreditCheckResult>;

  // Verify applicant identity
  verifyIdentity(params: {
    applicantId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    licenseNumber?: string;
    passportNumber?: string;
    medicareNumber?: string;
  }): Promise<IdentityVerificationResult>;
}

interface CreditCheckResult {
  score: number;           // Credit score (0-1200)
  riskGrade: 'low' | 'medium' | 'high';
  defaults: Default[];     // Payment defaults
  bankruptcies: Bankruptcy[];
  enquiries: CreditEnquiry[];
  reportUrl: string;       // PDF report download URL
}

interface IdentityVerificationResult {
  verified: boolean;
  matchLevel: 'full' | 'partial' | 'none';
  verifiedDocuments: string[];
  flags: string[];
}
```

**Implementation Tasks**:
- [ ] Apply for Equifax API access (requires business verification)
- [ ] Create `packages/integrations/src/equifax/` service module
- [ ] Implement consent flow (tenant must agree before check runs)
- [ ] Store consent tokens for audit trail
- [ ] Create secure result storage (encrypted at rest)
- [ ] Build owner-facing credit report viewer
- [ ] Handle API errors gracefully (fallback to manual verification)

**Database Addition**:
```sql
-- Background check consent and results
CREATE TABLE background_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('credit', 'identity', 'tenancy')),
  provider TEXT NOT NULL, -- 'equifax', 'tica'

  -- Consent
  consent_given_at TIMESTAMPTZ NOT NULL,
  consent_token TEXT NOT NULL, -- Proof of consent

  -- Result (encrypted)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  result_encrypted BYTEA, -- AES-256 encrypted result
  summary_score INTEGER, -- For quick filtering
  summary_risk_level TEXT, -- 'low', 'medium', 'high'
  report_url TEXT, -- Signed URL to PDF report

  -- Metadata
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Results expire after 30 days
  error_message TEXT
);

CREATE INDEX idx_background_checks_application ON background_checks(application_id);
```

#### TICA (Tenancy Information Centre Australia) Integration
| Aspect | Details |
|--------|---------|
| **API** | TICA Tenancy Database API |
| **Purpose** | Check tenancy history and blacklist status |
| **Data Retrieved** | Previous tenancy issues, blacklist status, debt records |
| **Consent Required** | YES - tenant must consent |
| **Pricing** | Subscription + per-check fee |

**API Functions (from STEAD-BIBLE.md)**:
```typescript
// packages/integrations/src/tica/client.ts
interface TICAService {
  // Check if tenant is in database
  checkTenant(params: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    previousAddresses: Address[];
    consentToken: string;
  }): Promise<TICACheckResult>;
}

interface TICACheckResult {
  found: boolean;
  listings: TICAListing[];
  debtAmount: number;
  lastUpdated: Date;
}

interface TICAListing {
  listingId: string;
  listingType: 'debt' | 'breach' | 'damage' | 'other';
  amount: number;
  date: Date;
  propertyType: string;
  state: string;
  status: 'active' | 'paid' | 'disputed';
}
```

**Implementation Tasks**:
- [ ] Apply for TICA API access (requires real estate credentials)
- [ ] Create `packages/integrations/src/tica/` service module
- [ ] Implement consent flow with proper disclosure
- [ ] Handle TICA listing disputes process
- [ ] Build owner-facing TICA result viewer
- [ ] Implement result caching (valid for 7 days)

### Consent Flow Implementation

**Critical**: Background checks require explicit tenant consent under Australian Privacy Act.

```typescript
// apps/tenant/components/BackgroundCheckConsent.tsx
// Must include:
// 1. Clear explanation of what data will be accessed
// 2. Who will see the results
// 3. How long results are retained
// 4. Tenant's right to dispute
// 5. Checkbox acknowledgment (not pre-checked)
// 6. Digital signature capture
```

**Database for Consent**:
```sql
CREATE TABLE background_check_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  -- Consent details
  equifax_consent BOOLEAN NOT NULL DEFAULT FALSE,
  tica_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_text_version TEXT NOT NULL, -- Track consent form version

  -- Digital signature
  signature_data TEXT, -- Base64 encoded signature image
  ip_address INET NOT NULL,
  user_agent TEXT NOT NULL,

  -- Timestamps
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Environment Variables
```bash
# Equifax
EQUIFAX_API_KEY=xxx
EQUIFAX_CLIENT_ID=xxx
EQUIFAX_CLIENT_SECRET=xxx
EQUIFAX_ENVIRONMENT=sandbox # or 'production'

# TICA
TICA_API_KEY=xxx
TICA_AGENCY_ID=xxx
TICA_ENVIRONMENT=sandbox # or 'production'
```

### Files to Create for Integrations
```
packages/integrations/          # New package (or extend existing)
├── src/
│   ├── equifax/
│   │   ├── client.ts          # Equifax API client
│   │   ├── types.ts           # Equifax response types
│   │   └── mapper.ts          # Map to internal format
│   ├── tica/
│   │   ├── client.ts          # TICA API client
│   │   ├── types.ts           # TICA response types
│   │   └── mapper.ts          # Map to internal format
│   └── encryption/
│       └── results.ts         # Encrypt/decrypt sensitive results

supabase/functions/
├── run-background-check/      # Edge function to run checks
│   └── index.ts
└── background-check-webhook/  # Handle async results
    └── index.ts

apps/owner/app/(app)/
├── listings/[id]/
│   └── applications/
│       └── [appId]/
│           └── background-check.tsx  # View check results

apps/tenant/app/(app)/
└── applications/
    └── apply/[listingId]/
        └── consent.tsx        # Background check consent step
```

### Integration Priority
| Integration | Priority | MVP Required | Notes |
|-------------|----------|--------------|-------|
| Equifax Credit | P2 | Recommended | Standard for professional landlords |
| Equifax Identity | P2 | Recommended | Reduces fraud risk |
| TICA Check | P2 | Recommended | Critical for risk assessment |

### Owner App UI Additions
- [ ] Add "Run Background Check" button on ApplicationDetailScreen
- [ ] Show consent status (pending/received)
- [ ] Display check results with risk summary
- [ ] Link to full PDF reports
- [ ] Show TICA listings if found

### Tenant App UI Additions
- [ ] Add consent step in application wizard (before Step 6 - Review)
- [ ] Clear explanation of each check type
- [ ] Digital signature capture
- [ ] Status indicator showing check progress

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`applications`, `application_documents`, `application_references`, `background_checks`, `background_check_consents`)
- [ ] RLS policies verified: tenants can CRUD own applications
- [ ] RLS policies verified: owners can view/update applications for their listings
- [ ] RLS policies verified: document and reference permissions follow application ownership
- [ ] `update_application_count()` trigger correctly increments/decrements listing application count
- [ ] `update_updated_at()` trigger works on applications table
- [ ] UNIQUE constraint on `(listing_id, tenant_id)` prevents duplicate applications
- [ ] Foreign keys correct with appropriate CASCADE/RESTRICT behavior
- [ ] Indexes created for all query patterns (listing, tenant, status)
- [ ] Storage bucket for application documents configured with correct access policies

### Feature Verification (Mission-Specific)
- [ ] Tenant can start a new application from a listing's "Apply Now" button
- [ ] Multi-step application wizard works (personal, employment, rental history, references, documents, review)
- [ ] Draft applications save progress and can be resumed
- [ ] Tenant can upload documents (ID, payslips, rental ledger) with preview
- [ ] Tenant can add 2+ references with contact details
- [ ] Tenant can submit completed application
- [ ] Tenant's "My Applications" screen shows all applications with status
- [ ] Owner sees new applications on their listing with notification
- [ ] Owner can view full application details including documents
- [ ] Owner can shortlist, approve, or reject applications with reason
- [ ] Owner can contact references (one-tap call/email)
- [ ] Application status changes trigger email notifications to tenant
- [ ] New application triggers email notification to owner
- [ ] Background check consent flow works (Equifax/TICA)
- [ ] Background check results display correctly for owner

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
- [ ] Application documents stored securely with signed URLs (not public)
- [ ] Background check results encrypted at rest
- [ ] Consent tokens stored for audit trail
