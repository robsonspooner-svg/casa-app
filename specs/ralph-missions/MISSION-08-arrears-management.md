# Mission 08: Arrears & Late Payment Management

## Overview
**Goal**: Automatically detect overdue rent, send reminders, and help owners manage arrears compliantly.
**Dependencies**: Mission 07 (Rent Collection)
**Estimated Complexity**: Medium
**Status**: ✅ COMPLETED

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Migration | ✅ Complete | All tables, enums, triggers, indexes, RLS policies |
| API Hooks | ✅ Complete | useArrears, useArrearsDetail, useArrearsMutations, useMyArrears, usePaymentPlan, useReminderTemplates |
| Owner App Screens | ✅ Complete | Dashboard, Detail, Log Action, Create Plan, Templates |
| Tenant App Screens | ✅ Complete | Arrears Status, Payment Plan View |
| Edge Functions | ✅ Complete | process-arrears, send-arrears-reminder, send-breach-notice |
| Unit Tests | ✅ Complete | 61 tests for arrears rules and template rendering |
| Typecheck | ✅ Passing | All 7 packages pass |
| Test Suite | ✅ Passing | 270 tests pass |

### Files Created

**Database Migration:**
- `supabase/migrations/20241210000001_arrears_management.sql`

**API Hooks:**
- `packages/api/src/hooks/useArrears.ts`
- `packages/api/src/hooks/useArrearsDetail.ts`
- `packages/api/src/hooks/useArrearsMutations.ts`
- `packages/api/src/hooks/useMyArrears.ts`
- `packages/api/src/hooks/usePaymentPlan.ts`
- `packages/api/src/hooks/useReminderTemplates.ts`
- `packages/api/src/constants/arrearsRules.ts`

**Edge Functions:**
- `supabase/functions/process-arrears/index.ts`
- `supabase/functions/send-arrears-reminder/index.ts`
- `supabase/functions/send-breach-notice/index.ts`

**Owner App:**
- `apps/owner/app/(app)/arrears/index.tsx` (Dashboard)
- `apps/owner/app/(app)/arrears/[id].tsx` (Detail)
- `apps/owner/app/(app)/arrears/log-action.tsx`
- `apps/owner/app/(app)/arrears/create-plan.tsx`
- `apps/owner/app/(app)/arrears/templates.tsx`

**Tenant App:**
- `apps/tenant/app/(app)/arrears/index.tsx` (Arrears Status)
- `apps/tenant/app/(app)/arrears/payment-plan.tsx`

**Tests:**
- `packages/api/src/__tests__/arrearsRules.test.ts` (49 tests)
- `packages/api/src/__tests__/renderTemplate.test.ts` (12 tests)

## Success Criteria

### Phase A: Database Schema
- [x] Create `arrears_records` table
- [x] Create `arrears_actions` table (communication log)
- [x] Create `reminder_templates` table
- [x] Set up RLS policies

### Phase B: Arrears Detection
- [x] Scheduled job to detect overdue payments
- [x] Calculate days overdue and total arrears
- [x] Create arrears record when payment overdue
- [x] Update arrears when partial payment received

### Phase C: Automated Reminders
- [x] Day 1 overdue: Friendly reminder email
- [x] Day 7 overdue: Formal reminder with late fee notice
- [x] Day 14 overdue: Warning of further action
- [x] Customizable reminder templates per owner
- [x] Stop reminders if payment made

### Phase D: Arrears Dashboard (Owner App)
- [x] Create ArrearsScreen
- [x] List all tenants in arrears
- [x] Show days overdue, amount, last contact
- [x] Filter by severity (1-7 days, 7-14, 14+)
- [x] Bulk actions (send reminder to all)

### Phase E: Arrears Detail (Owner App)
- [x] Create ArrearsDetailScreen
- [x] Full arrears history for tenant
- [x] Communication log (all reminders sent)
- [x] Manual actions (log phone call, send custom message)
- [x] Payment arrangement recording

### Phase F: Payment Arrangements
- [x] Create payment plan for tenant in arrears
- [x] Set up installment schedule
- [x] Track adherence to plan
- [x] Automated reminders for plan payments

### Phase G: Compliance Features
- [x] NSW/VIC/QLD compliant notice templates
- [x] Track notice serving dates
- [x] Generate breach notices (14-day notice)
- [x] Tribunal application checklist

### Phase H: Tenant View
- [x] Show arrears status in tenant app
- [x] Display payment arrangement if active
- [x] Easy access to pay overdue amount
- [x] Communication history

### Phase I: Testing
- [x] Unit tests for arrears calculations
- [x] Integration tests for reminder scheduling
- [x] E2E test: Payment overdue → Reminder sent → Payment made

## Database Schema

```sql
-- Arrears severity enum
CREATE TYPE arrears_severity AS ENUM (
  'minor',      -- 1-7 days
  'moderate',   -- 8-14 days
  'serious',    -- 15-28 days
  'critical'    -- 29+ days
);

-- Action type enum
CREATE TYPE arrears_action_type AS ENUM (
  'reminder_email',
  'reminder_sms',
  'phone_call',
  'letter_sent',
  'breach_notice',
  'payment_plan_created',
  'payment_plan_updated',
  'payment_received',
  'tribunal_application',
  'note'
);

-- Arrears records
CREATE TABLE arrears_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Arrears details
  first_overdue_date DATE NOT NULL,
  total_overdue DECIMAL(10,2) NOT NULL,
  days_overdue INTEGER NOT NULL,
  severity arrears_severity NOT NULL DEFAULT 'minor',

  -- Payment plan
  has_payment_plan BOOLEAN NOT NULL DEFAULT FALSE,
  payment_plan_id UUID REFERENCES payment_plans(id),

  -- Status
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenancy_id) -- One active arrears record per tenancy
);

-- Payment plans
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  arrears_record_id UUID NOT NULL REFERENCES arrears_records(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,

  -- Plan details
  total_arrears DECIMAL(10,2) NOT NULL,
  installment_amount DECIMAL(10,2) NOT NULL,
  installment_frequency payment_frequency NOT NULL,
  start_date DATE NOT NULL,
  expected_end_date DATE NOT NULL,

  -- Progress
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  installments_paid INTEGER NOT NULL DEFAULT 0,
  next_due_date DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment plan installments
CREATE TABLE payment_plan_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Arrears actions (communication/action log)
CREATE TABLE arrears_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  arrears_record_id UUID NOT NULL REFERENCES arrears_records(id) ON DELETE CASCADE,
  action_type arrears_action_type NOT NULL,

  -- Action details
  description TEXT NOT NULL,
  template_used TEXT,

  -- Communication details
  sent_to TEXT, -- Email/phone
  sent_at TIMESTAMPTZ,
  delivered BOOLEAN,
  opened BOOLEAN,

  -- Actor
  performed_by UUID REFERENCES profiles(id), -- NULL for automated
  is_automated BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reminder templates
CREATE TABLE reminder_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL for system defaults

  -- Template details
  name TEXT NOT NULL,
  days_overdue INTEGER NOT NULL, -- When to send
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'both')),

  -- Content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Compliance
  is_breach_notice BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System default templates
INSERT INTO reminder_templates (name, days_overdue, channel, subject, body, is_breach_notice) VALUES
(
  'Friendly Reminder',
  1,
  'email',
  'Rent Payment Reminder - {{property_address}}',
  'Hi {{tenant_name}},\n\nThis is a friendly reminder that your rent payment of {{amount}} was due on {{due_date}}.\n\nPlease make payment at your earliest convenience.\n\nIf you''ve already paid, please disregard this message.\n\nKind regards,\n{{owner_name}}',
  FALSE
),
(
  'Formal Reminder',
  7,
  'email',
  'Overdue Rent Notice - {{property_address}}',
  'Dear {{tenant_name}},\n\nOur records show that your rent payment of {{amount}} is now {{days_overdue}} days overdue.\n\nTotal outstanding: {{total_arrears}}\n\nPlease make payment immediately to avoid any further action.\n\nIf you are experiencing financial difficulties, please contact us to discuss a payment arrangement.\n\nRegards,\n{{owner_name}}',
  FALSE
),
(
  'Final Warning',
  14,
  'email',
  'Urgent: Overdue Rent - Action Required',
  'Dear {{tenant_name}},\n\nDespite previous reminders, your rent remains unpaid.\n\nAmount overdue: {{total_arrears}}\nDays overdue: {{days_overdue}}\n\nIf payment is not received within 7 days, we may be required to issue a formal breach notice.\n\nPlease contact us immediately.\n\nRegards,\n{{owner_name}}',
  FALSE
),
(
  'Breach Notice (NSW)',
  21,
  'email',
  'Notice of Breach - Non-Payment of Rent',
  'NOTICE OF BREACH OF RESIDENTIAL TENANCY AGREEMENT\n\nTo: {{tenant_name}}\nProperty: {{property_address}}\n\nYou are in breach of your residential tenancy agreement for non-payment of rent.\n\nRent owing: {{total_arrears}}\nPeriod: {{overdue_period}}\n\nYou must pay the full amount within 14 days of receiving this notice to remedy the breach.\n\nIf you do not remedy the breach within 14 days, we may apply to the NSW Civil and Administrative Tribunal for termination of the tenancy.\n\nDate: {{today}}\n\n{{owner_name}}',
  TRUE
);

-- Indexes
CREATE INDEX idx_arrears_tenancy ON arrears_records(tenancy_id) WHERE NOT is_resolved;
CREATE INDEX idx_arrears_severity ON arrears_records(severity, days_overdue) WHERE NOT is_resolved;
CREATE INDEX idx_arrears_actions ON arrears_actions(arrears_record_id, created_at);
CREATE INDEX idx_payment_plans ON payment_plans(tenancy_id) WHERE status = 'active';
CREATE INDEX idx_payment_plan_installments ON payment_plan_installments(payment_plan_id, due_date);

-- RLS Policies
ALTER TABLE arrears_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrears_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_templates ENABLE ROW LEVEL SECURITY;

-- Owners can view arrears for their properties
CREATE POLICY "Owners can view arrears"
  ON arrears_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = arrears_records.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view their own arrears
CREATE POLICY "Tenants can view own arrears"
  ON arrears_records FOR SELECT
  USING (auth.uid() = tenant_id);

-- Similar policies for other tables...
CREATE POLICY "Owners can manage payment plans"
  ON payment_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = payment_plans.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view own payment plans"
  ON payment_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = payment_plans.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Reminder templates: system defaults + owner's own
CREATE POLICY "Users can view templates"
  ON reminder_templates FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "Owners can manage own templates"
  ON reminder_templates FOR ALL
  USING (owner_id = auth.uid());

-- Function to update arrears severity
CREATE OR REPLACE FUNCTION update_arrears_severity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.severity := CASE
    WHEN NEW.days_overdue <= 7 THEN 'minor'
    WHEN NEW.days_overdue <= 14 THEN 'moderate'
    WHEN NEW.days_overdue <= 28 THEN 'serious'
    ELSE 'critical'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER arrears_severity_trigger
  BEFORE INSERT OR UPDATE OF days_overdue ON arrears_records
  FOR EACH ROW EXECUTE FUNCTION update_arrears_severity();

-- Updated_at triggers
CREATE TRIGGER arrears_records_updated_at
  BEFORE UPDATE ON arrears_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_plans_updated_at
  BEFORE UPDATE ON payment_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── arrears.ts              # Arrears CRUD
│   ├── paymentPlans.ts         # Payment plan management
│   └── reminderTemplates.ts    # Template management
├── hooks/
│   ├── useArrears.ts           # List arrears
│   ├── useArrearsDetail.ts     # Single arrears record
│   ├── usePaymentPlan.ts       # Payment plan hooks
│   └── useReminderTemplates.ts
└── services/
    └── arrearsProcessor.ts     # Arrears detection logic
```

### Backend (Edge Functions)
```
supabase/functions/
├── process-arrears/
│   └── index.ts                # Scheduled: detect overdue payments
├── send-arrears-reminders/
│   └── index.ts                # Scheduled: send due reminders
└── update-arrears-status/
    └── index.ts                # Update when payment received
```

### Owner App
```
apps/owner/app/(app)/
├── arrears/
│   ├── index.tsx               # Arrears dashboard
│   ├── [id]/
│   │   ├── index.tsx           # Arrears detail
│   │   ├── payment-plan.tsx    # Create/edit plan
│   │   └── log-action.tsx      # Log manual action
│   └── templates.tsx           # Manage templates

apps/owner/components/
├── ArrearsCard.tsx             # Arrears summary card
├── ArrearsSeverityBadge.tsx    # Severity indicator
├── ArrearsTimeline.tsx         # Action history
├── PaymentPlanForm.tsx         # Plan creation
├── ReminderTemplateEditor.tsx  # Template editing
└── BulkReminderModal.tsx       # Send to multiple
```

### Tenant App
```
apps/tenant/app/(app)/
├── arrears/
│   ├── index.tsx               # My arrears status
│   └── payment-plan.tsx        # View my plan

apps/tenant/components/
├── ArrearsAlert.tsx            # Alert banner
├── PaymentPlanProgress.tsx     # Plan progress
└── PayNowButton.tsx            # Quick pay arrears
```

## Scheduled Jobs

### Daily: Process Arrears (6am AEST)
```typescript
// 1. Find all unpaid rent schedules past due date
// 2. Create/update arrears records
// 3. Calculate days overdue and total
// 4. Update severity levels
```

### Daily: Send Reminders (9am AEST)
```typescript
// 1. Find arrears matching reminder thresholds
// 2. Check if reminder already sent for this threshold
// 3. Send appropriate reminder
// 4. Log action in arrears_actions
```

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(arrears): <description>

Mission-08: Arrears & Late Payment Management
```

### Agent Tools Available at This Mission

The following tools from the tool catalog become available at Mission 08:

| Name | Category | Autonomy | Risk | Description |
|------|----------|----------|------|-------------|
| `get_arrears` | query | L4 Autonomous | None | Get all tenants in arrears with days overdue and escalation level |
| `send_rent_reminder` | action | L1 Execute | Low | Send templated rent reminder to tenant |
| `send_breach_notice` | action | L0 Inform | High | Generate and send state-compliant breach notice |
| `generate_notice` | generate | L0 Inform | High | Generate state-compliant legal notice |
| `create_payment_plan` | action | L3 Suggest | Medium | Create payment plan for tenant in arrears |
| `escalate_arrears` | action | L3 Suggest | High | Move arrears to next escalation level |
| `workflow_arrears_escalation` | workflow | L3 Suggest | High | Arrears ladder: reminder -> formal -> notice -> tribunal |

#### Background Tasks Triggered at This Mission

| Task | Schedule | Description |
|------|----------|-------------|
| `arrears_detection` | Daily 7am | Scans rent schedules for overdue payments, creates/updates arrears records |
| `arrears_escalation` | Daily 9am | Evaluates arrears records against escalation thresholds and triggers next steps |

## Notes
- Compliance is critical - follow state-specific tenancy laws
- Breach notices have specific legal requirements per state
- Always log all communications for tribunal evidence
- Payment plans should not exceed 3 months typically
- Consider integration with TICA (tenant database) in future
- SMS reminders require explicit tenant consent

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`arrears_records`, `payment_plans`, `payment_plan_installments`, `arrears_actions`, `reminder_templates`)
- [ ] RLS policies verified: owners can view arrears for their properties
- [ ] RLS policies verified: tenants can view own arrears and payment plans
- [ ] `update_arrears_severity()` trigger correctly classifies severity by days overdue
- [ ] `update_updated_at()` triggers on arrears_records and payment_plans
- [ ] UNIQUE constraint on `arrears_records(tenancy_id)` prevents duplicate active records
- [ ] System default reminder templates seeded correctly (4 templates)
- [ ] Indexes created for active arrears queries (severity, tenancy, status)
- [ ] Foreign keys correct with CASCADE on arrears_record_id

### Feature Verification (Mission-Specific)
- [ ] Scheduled job detects overdue payments and creates arrears records
- [ ] Days overdue and total arrears calculate correctly
- [ ] Severity updates automatically (minor/moderate/serious/critical)
- [ ] Day 1 friendly reminder email sends to overdue tenant
- [ ] Day 7 formal reminder email sends with late fee notice
- [ ] Day 14 warning email sends with further action notice
- [ ] Reminders stop when payment is made
- [ ] Arrears dashboard lists all tenants in arrears with filters
- [ ] Arrears detail shows full history and communication log
- [ ] Owner can log manual actions (phone calls, notes)
- [ ] Owner can create a payment plan with installment schedule
- [ ] Payment plan tracks adherence (installments paid/missed)
- [ ] Breach notice generates with state-compliant content (NSW/VIC/QLD)
- [ ] Tenant app shows arrears status and payment plan progress
- [ ] Tenant can quickly pay overdue amount from arrears screen

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
- `packages/api/src/hooks/gateways/useArrearsGateway.ts` — Hook with navigation entry points and placeholder state
- `packages/api/src/types/gateways.ts` — Type definitions for `ArrearsRecord`, `PaymentPlan`, `ArrearsAction`, `ArrearsSeverity`

### What's Already Done
1. **Types defined**: All TypeScript interfaces for arrears entities are ready
2. **Gateway hook**: `useArrearsGateway()` provides:
   - Navigation functions: `navigateToArrearsDashboard()`, `navigateToArrearsDetail()`, `navigateToPaymentPlan()`, `navigateToCreatePaymentPlan()`
   - Action stubs: `sendReminder()`, `logPhoneCall()`, `createPaymentPlan()`, `cancelPaymentPlan()`, `recordPayment()`, `generateBreachNotice()`, `sendBreachNotice()`
   - Placeholder state: `items`, `totalInArrears`, `activePaymentPlans`, `recentActions`, `severityLevels`
3. **Severity config**: `ARREARS_SEVERITY_CONFIG` with color codes and descriptions for UI badges
4. **Exported from `@casa/api`**: Import directly in components

### What This Mission Needs to Do
1. Create database migration with tables defined in this spec
2. Implement the real Supabase queries in the gateway hook
3. Replace placeholder returns with actual data fetching
4. Connect navigation functions to real Expo Router routes
5. Build the UI screens using the pre-defined types and hook interface

### Usage Example (Already Works)
```typescript
import { useArrearsGateway, ARREARS_SEVERITY_CONFIG } from '@casa/api';

function ArrearsScreen() {
  const { items, loading, navigateToArrearsDetail } = useArrearsGateway();
  // Currently returns empty array, but navigation is ready
  // After Mission 08: Returns real arrears data
}
```
