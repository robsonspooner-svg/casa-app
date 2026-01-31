# Mission 07: Rent Collection & Payments

## Overview
**Goal**: Enable automated rent collection via Stripe and provide payment tracking for both owners and tenants.
**Dependencies**: Mission 06 (Tenancies)
**Estimated Complexity**: High

---

## Implementation Status

> **Last Updated**: January 2026
> **Status**: ✅ CODE COMPLETE — Ready for Mission 08 (pending external configuration in MISSION-EXT-CONFIG.md)

### Completed Items ✅

| Component | Status | Details |
|-----------|--------|---------|
| **Database Schema** | ✅ Complete | All tables created: `rent_schedules`, `payments`, `payment_methods`, `owner_stripe_accounts`, `tenant_stripe_customers`, `autopay_settings`, `add_on_purchases` |
| **RLS Policies** | ✅ Complete | Full row-level security for all tables |
| **`generate_rent_schedule()` RPC** | ✅ Complete | Auto-generates rent schedule entries from tenancy dates |
| **API Hooks** | ✅ Complete | `useRentSchedule`, `usePayments`, `usePaymentMethods`, `useAutoPay`, `useOwnerPayouts`, `usePaymentMutations` |
| **Tenant UI: Rent Tab** | ✅ Complete | Shows rent schedule, amounts due, payment history |
| **Tenant UI: Pay Rent Screen** | ✅ Complete | Payment form with amount selection |
| **Tenant UI: Payment Methods** | ✅ Complete | Add/manage cards and bank accounts |
| **Tenant UI: Auto-Pay Setup** | ✅ Complete | Enable/disable auto-pay with method selection |
| **Owner UI: Payments Dashboard** | ✅ Complete | View all payments with filtering |
| **Owner UI: Payment Detail** | ✅ Complete | Individual payment details |
| **Owner UI: Stripe Onboarding** | ✅ Complete | Connect account setup flow |
| **Subscription Constants** | ✅ Complete | `STRIPE_PRODUCTS`, `STRIPE_PRICES`, tier definitions |
| **Fee Calculations** | ✅ Complete | Platform fee, Stripe fee, net amount utilities |
| **Unit Tests** | ✅ Complete | 209 tests passing including payment calculations |

### Stripe Edge Functions — IMPLEMENTED (January 2026) ✅

All Stripe Edge Functions have been implemented and are ready for deployment:

| Function | File | Purpose | Status |
|----------|------|---------|--------|
| **Create Payment Intent** | `supabase/functions/create-payment-intent/index.ts` | Creates Stripe PaymentIntent for rent/other payments with Connect split | ✅ Complete |
| **Create Setup Intent** | `supabase/functions/create-setup-intent/index.ts` | Saves payment methods (card/BECS) for future use | ✅ Complete |
| **Create Connect Account** | `supabase/functions/create-connect-account/index.ts` | Onboards owners to Stripe Express accounts | ✅ Complete |
| **Stripe Webhook** | `supabase/functions/stripe-webhook/index.ts` | Handles all Stripe events (payments, subscriptions, Connect) | ✅ Complete |
| **Process Auto-Pay** | `supabase/functions/process-autopay/index.ts` | Daily job to process scheduled auto-payments | ✅ Complete |

**Shared utilities** created:
- `supabase/functions/_shared/stripe.ts` — Stripe client, fee calculations
- `supabase/functions/_shared/cors.ts` — CORS headers for Edge Functions
- `supabase/functions/_shared/supabase.ts` — Service client for Edge Functions

**Webhook events handled**:
- `payment_intent.succeeded` — Updates payment status, marks rent schedule paid
- `payment_intent.payment_failed` — Updates payment with failure reason
- `setup_intent.succeeded` — Saves payment method to database
- `account.updated` — Updates owner Connect account status
- `customer.subscription.created/updated/deleted` — Syncs subscription tier
- `invoice.payment_succeeded/failed` — Handles subscription billing

**Pre-Launch Requirements** (external configuration needed):
1. ⬜ Create Stripe account and enable Connect
2. ⬜ Set environment variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
3. ⬜ Configure Stripe webhook endpoint in dashboard
4. ⬜ Set up pg_cron to call `process-autopay` daily
5. ⬜ Deploy Edge Functions to production Supabase

### Deferred to Pre-Launch ⏳

| Item | Reason | Target |
|------|--------|--------|
| **PDF Receipt Generation** | Document generation service selection | Mission 20 |

---

## Final Audit Summary (January 2026)

### Build Verification ✅
| Check | Status |
|-------|--------|
| `pnpm typecheck` | ✅ All 7 packages pass |
| `pnpm test` | ✅ 209 tests passing |
| No TODOs in mission code | ✅ Verified |
| No console.log debugging | ✅ Verified |

### Code Implementation ✅
| Component | Files | Status |
|-----------|-------|--------|
| **Database Schema** | `supabase/migrations/20240101000009_rent_collection.sql` | ✅ Complete |
| **API Hooks** | `packages/api/src/hooks/useRent*.ts`, `usePayment*.ts`, `useAutoPay.ts`, `useOwnerPayouts.ts` | ✅ 6 hooks |
| **Owner UI** | `apps/owner/app/(app)/payments/` | ✅ 4 screens |
| **Tenant UI** | `apps/tenant/app/(app)/payments/`, `rent/` | ✅ 7 screens |
| **Stripe Edge Functions** | `supabase/functions/create-payment-intent/`, `create-setup-intent/`, `create-connect-account/`, `stripe-webhook/`, `process-autopay/` | ✅ 5 functions |
| **Email Edge Functions** | `supabase/functions/send-email/`, `process-email-queue/` | ✅ 2 functions |
| **Shared Utilities** | `supabase/functions/_shared/stripe.ts`, `cors.ts`, `supabase.ts`, `sendgrid.ts` | ✅ 4 modules |

### External Configuration Required (See MISSION-EXT-CONFIG.md)
| Item | Blocking |
|------|----------|
| Stripe account creation & verification | Yes - payments won't work |
| Stripe Connect enablement | Yes - owner payouts won't work |
| Stripe webhook configuration | Yes - payment status won't update |
| SendGrid account & domain verification | Yes - emails won't send |
| Edge Function deployment | Yes - all server functions |
| Supabase secrets configuration | Yes - functions need API keys |
| pg_cron scheduled jobs | Yes - autopay/email processing |

### Items Deferred to Mission 20 (PDF Generation)
- Payment receipt PDF generation
- Monthly statement PDF generation
- Payment export to CSV/PDF

### Ready for Mission 08 ✅
All code implementation for Mission 07 is complete. Integration testing with real Stripe/SendGrid accounts will be performed after external configuration is complete (see MISSION-EXT-CONFIG.md).

---

### Connection Code System (Added Post-Mission 07) ✅

A tenant-owner connection system was added to enable testing flows:

| Component | Status | Details |
|-----------|--------|---------|
| **Database Migration** | ✅ Ready | `20240101000010_connection_codes.sql` (needs to be applied) |
| **API Hooks** | ✅ Complete | `useConnectionCodes`, `useConnection`, `useTenantAvailability`, `useMatchSuggestions` |
| **Owner UI: Connections Screen** | ✅ Complete | Generate/manage/share connection codes |
| **Tenant UI: Connect Screen** | ✅ Complete | Enter codes, request codes from landlord |
| **Share Integration** | ✅ Complete | Native share sheet for codes via SMS/email |

---

## Success Criteria

### Phase A: Database Schema ✅
- [x] Create `rent_schedules` table
- [x] Create `payments` table
- [x] Create `payment_methods` table
- [x] Set up RLS policies

### Phase B: Stripe Integration ✅
- [x] Set up Stripe Connect for owner payouts (Edge Function ready, needs external config)
- [x] Create Stripe customer for each tenant (Edge Function ready, needs external config)
- [x] Implement payment method collection (cards, bank accounts)
- [x] Set up webhook handling for payment events

### Phase C: Rent Schedules ✅
- [x] Auto-generate rent schedule from tenancy
- [x] Calculate due dates based on frequency
- [x] Handle pro-rata first/last payments
- [x] Support rent increases (with notice period)

### Phase D: Payment Flow (Tenant App) ✅
- [x] Create PayRentScreen
- [x] Show current and upcoming rent due
- [x] Add/manage payment methods
- [x] One-tap pay for current due amount
- [x] Pay custom amount (partial or advance)
- [x] Payment confirmation and receipt

### Phase E: Auto-Pay Setup ✅
- [x] Enable recurring payments
- [x] Choose payment method for auto-pay
- [x] Set auto-pay timing (on due date, X days before)
- [x] Notifications before auto-pay processes (via email queue)

### Phase F: Payment Tracking (Owner App) ✅
- [x] Create PaymentsScreen
- [x] Show all payments across properties
- [x] Filter by property, tenant, status
- [x] Show payment status (pending, completed, failed)
- [ ] Export payment history (Deferred to Mission 20 - PDF generation)

### Phase G: Owner Payouts ✅
- [x] Configure Stripe Connect payout schedule
- [x] Show payout history
- [x] Handle payout failures (via webhook)

### Phase H: Receipts & Statements ⏳ (Partially Complete)
- [ ] Generate payment receipts (PDF) — Deferred to Mission 20
- [ ] Generate monthly statements — Deferred to Mission 20
- [x] Email receipts to tenants (via email notification system)

### Phase I: Stripe Billing — Subscription Management ✅
- [x] Create Stripe Products for each tier (constants defined)
- [x] Create Stripe Prices (constants defined, needs Stripe dashboard config)
- [x] Implement subscription creation on signup (webhook handlers ready)
- [x] Implement plan upgrade flow (via Stripe Customer Portal)
- [x] Implement plan downgrade flow (via Stripe Customer Portal)
- [x] Implement subscription cancellation (via Stripe Customer Portal)
- [x] Handle `customer.subscription.updated` webhook to sync tier to `profiles.subscription_tier`
- [x] Handle `customer.subscription.deleted` webhook to set tier to cancelled
- [x] Handle `invoice.payment_failed` webhook to set status to `past_due`
- [x] Handle `invoice.paid` webhook to clear `past_due` status
- [x] Create SubscriptionScreen in owner app (current plan, upgrade/downgrade, cancel)
- [x] Create BillingHistoryScreen (past invoices from Stripe)
- [x] Show "Past Due" banner when subscription payment fails

### Phase J: Add-On Purchases (One-Off Charges) ✅
- [x] Create Stripe Products for each add-on (constants defined)
- [x] Implement one-off payment intent for add-on purchases
- [x] Create AddOnMarketplace screen showing available add-ons for current tier
- [x] Show add-on options contextually (e.g., inspection add-on on inspection screen)
- [x] Track add-on purchases in `add_on_purchases` table
- [x] Send purchase confirmation email (via email notification system)
- [x] Auto-schedule service after purchase
- [x] Show purchase history in billing section

### Phase K: Testing ✅
- [x] Unit tests for payment calculations (209 tests passing)
- [x] Unit tests for subscription lifecycle
- [x] Unit tests for add-on purchase flow
- [ ] Integration tests with Stripe test mode — Requires external Stripe account
- [ ] E2E test: Set up payment method → Pay rent → View receipt — Requires external Stripe account
- [ ] E2E test: Purchase add-on → Service scheduled → Confirmation received — Requires external Stripe account
- [ ] E2E test: Upgrade plan → Tier changes → Features unlocked — Requires external Stripe account
- [ ] E2E test: Payment fails → Past due banner → Retry succeeds — Requires external Stripe account

## Database Schema

```sql
-- Payment status enum
CREATE TYPE payment_status AS ENUM (
  'scheduled',    -- Future payment
  'pending',      -- Processing
  'completed',    -- Successfully paid
  'failed',       -- Payment failed
  'cancelled',    -- Cancelled before processing
  'refunded'      -- Refunded after completion
);

-- Payment type enum
CREATE TYPE payment_type AS ENUM (
  'rent',
  'bond',
  'utility',
  'maintenance',
  'fee',
  'other'
);

-- Rent schedules (expected payments)
CREATE TABLE rent_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,

  -- Schedule details
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  is_prorata BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payments(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenancy_id, due_date)
);

-- Payment methods (Stripe)
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Stripe details
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,

  -- Display info
  type TEXT NOT NULL, -- 'card', 'au_becs_debit'
  last_four TEXT NOT NULL,
  brand TEXT, -- For cards: visa, mastercard, etc.
  bank_name TEXT, -- For bank accounts

  -- Settings
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_autopay BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments (actual transactions)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  payment_method_id UUID REFERENCES payment_methods(id),

  -- Payment details
  payment_type payment_type NOT NULL DEFAULT 'rent',
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  description TEXT,

  -- Stripe details
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT, -- For Connect payouts

  -- Fees
  stripe_fee DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  net_amount DECIMAL(10,2), -- Amount after fees

  -- Status
  status payment_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,

  -- Dates
  due_date DATE,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,

  -- Receipt
  receipt_url TEXT,
  receipt_number TEXT,

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owner Stripe Connect accounts
CREATE TABLE owner_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Stripe Connect
  stripe_account_id TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'express', -- 'express' or 'standard'

  -- Status
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,

  -- Payout settings
  payout_schedule TEXT DEFAULT 'daily', -- daily, weekly, monthly

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rent_schedules_tenancy ON rent_schedules(tenancy_id);
CREATE INDEX idx_rent_schedules_due ON rent_schedules(due_date) WHERE NOT is_paid;
CREATE INDEX idx_payment_methods_user ON payment_methods(user_id) WHERE is_active;
CREATE INDEX idx_payments_tenancy ON payments(tenancy_id);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_status ON payments(status, created_at);

-- RLS Policies
ALTER TABLE rent_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Rent schedules: owners and tenants can view
CREATE POLICY "Owners can view rent schedules"
  ON rent_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = rent_schedules.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view own rent schedules"
  ON rent_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = rent_schedules.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Payment methods: users manage their own
CREATE POLICY "Users can CRUD own payment methods"
  ON payment_methods FOR ALL
  USING (auth.uid() = user_id);

-- Payments: similar to rent schedules
CREATE POLICY "Owners can view payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = payments.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "Tenants can create payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

-- Owner Stripe accounts
CREATE POLICY "Owners can manage own Stripe account"
  ON owner_stripe_accounts FOR ALL
  USING (auth.uid() = owner_id);

-- Function to generate rent schedule
CREATE OR REPLACE FUNCTION generate_rent_schedule(
  p_tenancy_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_amount DECIMAL,
  p_frequency payment_frequency
)
RETURNS VOID AS $$
DECLARE
  current_date DATE := p_start_date;
  interval_days INTEGER;
BEGIN
  -- Determine interval
  CASE p_frequency
    WHEN 'weekly' THEN interval_days := 7;
    WHEN 'fortnightly' THEN interval_days := 14;
    WHEN 'monthly' THEN interval_days := 0; -- Handle monthly separately
  END CASE;

  -- Generate schedule entries
  WHILE current_date <= p_end_date LOOP
    INSERT INTO rent_schedules (tenancy_id, due_date, amount)
    VALUES (p_tenancy_id, current_date, p_amount)
    ON CONFLICT (tenancy_id, due_date) DO NOTHING;

    IF p_frequency = 'monthly' THEN
      current_date := current_date + INTERVAL '1 month';
    ELSE
      current_date := current_date + (interval_days || ' days')::INTERVAL;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at triggers
CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── payments.ts             # Payment CRUD
│   ├── rentSchedules.ts        # Rent schedule queries
│   └── paymentMethods.ts       # Payment method management
├── hooks/
│   ├── usePayments.ts          # List payments
│   ├── useRentSchedule.ts      # Rent due dates
│   ├── usePaymentMethods.ts    # User's payment methods
│   └── usePaymentMutations.ts
└── services/
    ├── stripe.ts               # Stripe SDK wrapper
    └── receipts.ts             # Receipt generation

packages/stripe/                # New package
├── package.json
├── src/
│   ├── index.ts
│   ├── client.ts               # Stripe client setup
│   ├── connect.ts              # Stripe Connect helpers
│   ├── payments.ts             # Payment intents
│   └── webhooks.ts             # Webhook handlers
```

### Backend (Edge Functions)
```
supabase/functions/
├── stripe-webhook/
│   └── index.ts                # Handle Stripe webhooks
├── create-payment-intent/
│   └── index.ts                # Create payment intent
├── setup-connect-account/
│   └── index.ts                # Onboard owner to Connect
└── process-autopay/
    └── index.ts                # Scheduled autopay processing
```

### Tenant App
```
apps/tenant/app/(app)/
├── payments/
│   ├── index.tsx               # Payment history
│   ├── pay.tsx                 # Pay rent screen
│   ├── methods/
│   │   ├── index.tsx           # Manage payment methods
│   │   └── add.tsx             # Add payment method
│   └── autopay.tsx             # Auto-pay settings
├── receipts/
│   └── [id].tsx                # View receipt

apps/tenant/components/
├── RentDueCard.tsx             # Amount due display
├── PaymentMethodCard.tsx       # Payment method display
├── PaymentHistory.tsx          # Payment list
├── AutoPayToggle.tsx           # Auto-pay setup
└── ReceiptView.tsx             # Receipt display
```

### Owner App
```
apps/owner/app/(app)/
├── payments/
│   ├── index.tsx               # All payments
│   └── [id].tsx                # Payment details
├── payouts/
│   ├── index.tsx               # Payout history
│   └── setup.tsx               # Stripe Connect setup

apps/owner/components/
├── PaymentTable.tsx            # Payments data table
├── PaymentFilters.tsx          # Filter controls
├── PayoutHistory.tsx           # Payout list
└── ConnectSetup.tsx            # Stripe onboarding
```

### Shared UI
```
packages/ui/src/components/
├── CurrencyDisplay.tsx         # Format currency
├── PaymentStatusBadge.tsx      # Payment status
├── CardIcon.tsx                # Card brand icons
└── BankIcon.tsx                # Bank icons
```

## Environment Variables
```
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...

# For Expo
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Stripe Webhook Events to Handle
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `account.updated` (Connect)
- `payout.paid`
- `payout.failed`

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(payments): <description>

Mission-07: Rent Collection & Payments
```

### Agent Tools Available at This Mission

The following tools from the tool catalog become available at Mission 07:

| Name | Category | Autonomy | Risk | Description |
|------|----------|----------|------|-------------|
| `get_payments` | query | L4 Autonomous | None | Get payment history with amounts and statuses |
| `get_rent_schedule` | query | L4 Autonomous | None | Get upcoming rent due dates and amounts |
| `get_transactions` | query | L4 Autonomous | None | Get itemized transactions (rent, bond, maintenance, fees) |
| `get_financial_summary` | query | L4 Autonomous | None | Get income, expenses, net position for period |
| `collect_rent_stripe` | integration | L3 Suggest | High | Charge rent via Stripe Connect |
| `refund_payment_stripe` | integration | L0 Inform | High | Process refund via Stripe |
| `process_payment` | action | L3 Suggest | High | Process a rent payment charge |
| `retry_payment` | action | L1 Execute | Medium | Retry a failed rent payment (max 1 auto-retry) |
| `send_receipt` | action | L4 Autonomous | None | Send payment receipt to tenant |
| `change_rent_amount` | action | L0 Inform | High | Change rent on tenancy (requires notice period) |
| `update_autopay` | action | L2 Draft | Medium | Enable/disable auto-pay settings |

#### Background Tasks Triggered at This Mission

| Task | Schedule | Description |
|------|----------|-------------|
| `rent_due_detection` | Daily 6am | Identifies rent due today, triggers payment collection or reminders |
| `autopay_processing` | Daily 6am | Processes scheduled auto-pay charges for tenants with auto-pay enabled |
| `payment_retry` | Event-driven | Retries failed payments once after transient failures |

## Stripe Billing — Subscription Management

### Stripe Products & Prices
```typescript
// packages/integrations/src/stripe/billing.ts

export const SUBSCRIPTION_PRODUCTS = {
  starter: {
    name: 'Casa Starter',
    priceMonthly: 4900,  // $49 in cents
    features: ['Property management tools', 'Rent collection', 'AI chat', 'Maintenance requests'],
  },
  pro: {
    name: 'Casa Pro',
    priceMonthly: 8900,  // $89 in cents
    features: ['Everything in Starter', 'Tenant finding', 'Professional inspections', 'Leasing service', 'Entry/exit reports'],
  },
  hands_off: {
    name: 'Casa Hands-Off',
    priceMonthly: 14900, // $149 in cents
    features: ['Everything in Pro', 'Dedicated manager', 'Open home hosting', 'Photography', 'Emergency callout', 'Custom automation'],
  },
} as const;

// Stripe Billing Integration
interface StripeBillingService {
  // Create subscription for new user
  createSubscription(params: {
    customerId: string;
    priceId: string;         // Stripe Price ID for chosen tier
    trialDays?: number;      // Optional trial period
  }): Promise<Subscription>;

  // Upgrade plan (immediate proration)
  upgradePlan(params: {
    subscriptionId: string;
    newPriceId: string;
    proration: 'create_prorations' | 'none';
  }): Promise<Subscription>;

  // Downgrade plan (end of billing period)
  downgradePlan(params: {
    subscriptionId: string;
    newPriceId: string;
  }): Promise<Subscription>;

  // Cancel subscription (end of billing period)
  cancelSubscription(params: {
    subscriptionId: string;
    cancelAtPeriodEnd: boolean;
    feedback?: string;
  }): Promise<Subscription>;

  // Get billing portal URL (Stripe-hosted)
  createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;

  // Get invoices
  listInvoices(customerId: string, limit?: number): Promise<Invoice[]>;
}
```

### Webhook Handlers for Subscriptions
```typescript
// supabase/functions/stripe-webhook/billing-handlers.ts

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) return;

  // Determine tier from price ID
  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceIdToTier(priceId);

  // Update profile
  await supabase.from('profiles').update({
    subscription_tier: tier,
    subscription_status: subscription.status === 'active' ? 'active'
      : subscription.status === 'trialing' ? 'trialing'
      : subscription.status === 'past_due' ? 'past_due'
      : 'cancelled',
  }).eq('id', profile.id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Set user to past_due, show banner
  const customerId = invoice.customer as string;
  await supabase.from('profiles').update({
    subscription_status: 'past_due',
  }).eq('stripe_customer_id', customerId);

  // Send notification
  await createNotification({
    userId: profile.id,
    type: 'payment_failed',
    title: 'Payment failed',
    body: 'Your subscription payment could not be processed. Please update your payment method.',
    actionUrl: '/settings/billing',
    priority: 'high',
  });
}
```

## Add-On Purchases

### Add-On Price List
| Add-On | Price | Available To | Stripe Product |
|--------|-------|--------------|----------------|
| Tenant Finding | $79/listing | Starter | `prod_tenant_finding` |
| Professional Inspection | $99/inspection | Starter | `prod_inspection` |
| Open Home Hosting | $79/session | Starter, Pro | `prod_open_home` |
| Professional Photography | $149/property | Starter, Pro | `prod_photography` |
| Emergency Callout | $49/callout | Starter, Pro | `prod_emergency` |
| Routine Inspection | $99/inspection | Starter | `prod_routine_inspection` |

### Database Schema
```sql
-- Add-on purchases tracking
CREATE TABLE add_on_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  tenancy_id UUID REFERENCES tenancies(id),

  -- Purchase details
  add_on_type TEXT NOT NULL CHECK (add_on_type IN (
    'tenant_finding', 'professional_inspection', 'open_home_hosting',
    'photography', 'emergency_callout', 'routine_inspection'
  )),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',

  -- Stripe
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'scheduled', 'in_progress', 'completed', 'refunded', 'cancelled'
  )),

  -- Scheduling (after purchase)
  scheduled_date DATE,
  scheduled_time TIME,
  completed_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_add_on_purchases_owner ON add_on_purchases(owner_id);
CREATE INDEX idx_add_on_purchases_property ON add_on_purchases(property_id);
CREATE INDEX idx_add_on_purchases_status ON add_on_purchases(status) WHERE status IN ('paid', 'scheduled', 'in_progress');

-- RLS
ALTER TABLE add_on_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own add-on purchases"
  ON add_on_purchases FOR ALL
  USING (auth.uid() = owner_id);
```

### Add-On Purchase Flow
```typescript
// packages/api/src/hooks/useAddOnPurchase.ts

interface AddOnPurchaseParams {
  addOnType: string;
  propertyId?: string;
  tenancyId?: string;
  scheduledDate?: Date;
}

export function useAddOnPurchase() {
  const purchaseAddOn = async (params: AddOnPurchaseParams) => {
    // 1. Create payment intent via Edge Function
    const { clientSecret } = await fetch('/functions/v1/create-addon-payment', {
      method: 'POST',
      body: JSON.stringify(params),
    }).then(r => r.json());

    // 2. Confirm payment via Stripe SDK (in-app)
    const { paymentIntent } = await stripe.confirmPayment(clientSecret, {
      paymentMethodId: defaultPaymentMethod.id,
    });

    // 3. On success, Edge Function creates add_on_purchases record
    //    and schedules the service (if scheduledDate provided)

    return paymentIntent;
  };

  return { purchaseAddOn };
}
```

### Owner App UI — Add-On Marketplace
```
apps/owner/app/(app)/
├── add-ons/
│   ├── index.tsx              # Add-on marketplace grid
│   └── [type]/
│       └── purchase.tsx       # Purchase flow (property picker → date picker → pay)

apps/owner/components/
├── AddOnCard.tsx              # Add-on tile with price + description + CTA
├── AddOnPurchaseFlow.tsx      # Multi-step: select property → schedule → pay
├── SubscriptionCard.tsx       # Current plan display with upgrade/downgrade
└── BillingHistory.tsx         # List of invoices + add-on purchases
```

### Add-On Card UI
```
┌─────────────────────────────────────────┐
│  🔍 Professional Inspection             │
│                                          │
│  A qualified inspector will conduct a    │
│  routine inspection of your property     │
│  and provide a detailed report.          │
│                                          │
│  $99 per inspection                      │
│                                          │
│  [Purchase]                              │
└─────────────────────────────────────────┘
```

### Contextual Add-On Prompts
Add-ons are also shown contextually where relevant:
- **Inspection screen** (Mission 11): "Need a professional inspection? [Purchase — $99]"
- **Vacancy banner** (Mission 04): "Find your next tenant [Purchase — $79/listing]"
- **Maintenance urgent** (Mission 09): "Need emergency callout? [Purchase — $49]"

## Notes
- Use Stripe Connect Express for simplest owner onboarding
- AU BECS Direct Debit requires 3-day notice before charging
- Platform fee model: charge owners a % of rent collected
- Receipts must include ABN and be tax-compliant
- Consider adding PayTo for NPP instant payments in future
- Auto-pay runs via scheduled Supabase Edge Function
- Stripe Billing manages subscription lifecycle — profile tier synced via webhooks
- Add-on purchases are one-off Stripe charges separate from subscription billing
- Past-due subscriptions show banner but don't immediately lock features (grace period: 7 days)

---

## Third-Party Integrations (CRITICAL FOR LAUNCH)

### Stripe Connect - Detailed Implementation
**Why**: Stripe Connect is the core payment infrastructure. Enables tenants to pay rent, owners to receive payouts, and Casa to collect platform fees. Without this, no revenue and no rent collection.

#### Complete Stripe Connect Architecture
| Component | Purpose |
|-----------|---------|
| **Platform Account** | Casa's main Stripe account |
| **Connected Accounts** | Owner accounts (Express type) |
| **Customers** | Tenant payment profiles |
| **Payment Methods** | Cards, AU BECS Direct Debit |
| **Payment Intents** | Individual rent payments |
| **Transfers** | Money movement to owners |

**API Functions (from STEAD-BIBLE.md)**:
```typescript
// packages/integrations/src/stripe/connect.ts
interface StripeConnectService {
  // === OWNER ONBOARDING ===

  // Create a connected account for an owner
  createConnectedAccount(params: {
    ownerId: string;
    email: string;
    country: 'AU';
    businessType: 'individual' | 'company';
  }): Promise<ConnectedAccount>;

  // Generate onboarding link for owner to complete
  createAccountLink(params: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
    type: 'account_onboarding' | 'account_update';
  }): Promise<AccountLink>;

  // Check account status
  getAccountStatus(accountId: string): Promise<AccountStatus>;

  // === TENANT PAYMENT SETUP ===

  // Create a Stripe customer for a tenant
  createCustomer(params: {
    tenantId: string;
    email: string;
    name: string;
  }): Promise<Customer>;

  // Create SetupIntent for saving payment method
  createSetupIntent(params: {
    customerId: string;
    paymentMethodTypes: ('card' | 'au_becs_debit')[];
  }): Promise<SetupIntent>;

  // List saved payment methods
  listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

  // Set default payment method
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  // === RENT COLLECTION ===

  // Collect rent payment
  collectRent(params: {
    tenancyId: string;
    amount: number;                    // In cents
    currency: 'aud';
    customerId: string;
    paymentMethodId: string;
    connectedAccountId: string;        // Owner's Stripe account
    applicationFeeAmount: number;      // Platform fee in cents
    description: string;
    metadata: Record<string, string>;
  }): Promise<PaymentIntent>;

  // Process scheduled auto-pay
  processAutoPay(params: {
    rentScheduleId: string;
    tenancyId: string;
    amount: number;
    customerId: string;
    paymentMethodId: string;
    connectedAccountId: string;
    applicationFeeAmount: number;
  }): Promise<PaymentIntent>;

  // === REFUNDS ===

  // Refund a payment
  refundPayment(params: {
    paymentIntentId: string;
    amount?: number;                   // Partial refund
    reason: 'requested_by_customer' | 'duplicate' | 'fraudulent';
  }): Promise<Refund>;
}

interface ConnectedAccount {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
  };
}

interface AccountStatus {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  payoutSchedule: {
    interval: 'daily' | 'weekly' | 'monthly';
    weeklyAnchor?: string;
    monthlyAnchor?: number;
  };
}
```

#### Tenant Payment Flow (Detailed)
```typescript
// apps/tenant/services/paymentFlow.ts

/**
 * Step 1: One-time setup (first payment or new payment method)
 */
async function setupPaymentMethod(tenantId: string) {
  // 1. Create/get Stripe customer
  const customer = await stripeConnect.createCustomer({
    tenantId,
    email: tenant.email,
    name: tenant.fullName,
  });

  // 2. Create SetupIntent for secure card/bank collection
  const setupIntent = await stripeConnect.createSetupIntent({
    customerId: customer.id,
    paymentMethodTypes: ['card', 'au_becs_debit'],
  });

  // 3. Return client secret for Stripe Elements
  return { clientSecret: setupIntent.clientSecret };
}

/**
 * Step 2: Pay rent
 */
async function payRent(params: {
  tenancyId: string;
  rentScheduleId: string;
  amount: number;
  paymentMethodId: string;
}) {
  const tenancy = await getTenancy(params.tenancyId);
  const ownerStripeAccount = await getOwnerStripeAccount(tenancy.ownerId);

  // Calculate platform fee (e.g., 1.5% of rent)
  const applicationFeeAmount = Math.round(params.amount * 0.015);

  // Create payment intent on connected account
  const paymentIntent = await stripeConnect.collectRent({
    tenancyId: params.tenancyId,
    amount: params.amount * 100, // Convert to cents
    currency: 'aud',
    customerId: tenant.stripeCustomerId,
    paymentMethodId: params.paymentMethodId,
    connectedAccountId: ownerStripeAccount.stripeAccountId,
    applicationFeeAmount,
    description: `Rent payment for ${tenancy.property.address}`,
    metadata: {
      tenancy_id: params.tenancyId,
      rent_schedule_id: params.rentScheduleId,
      property_id: tenancy.propertyId,
    },
  });

  return paymentIntent;
}
```

#### Auto-Pay Implementation
```typescript
// supabase/functions/process-autopay/index.ts

/**
 * Scheduled function - runs daily at 6 AM AEST
 */
async function processScheduledAutoPay() {
  // 1. Find all rent due today with auto-pay enabled
  const duePayments = await supabase
    .from('rent_schedules')
    .select(`
      *,
      tenancy:tenancies!inner(
        *,
        tenancy_tenants!inner(
          tenant:profiles!inner(
            stripe_customer_id,
            payment_methods!inner(
              stripe_payment_method_id,
              is_autopay
            )
          )
        ),
        property:properties!inner(
          owner:profiles!inner(
            owner_stripe_accounts!inner(stripe_account_id)
          )
        )
      )
    `)
    .eq('due_date', today)
    .eq('is_paid', false)
    .eq('tenancy.tenancy_tenants.tenant.payment_methods.is_autopay', true);

  // 2. Process each payment
  for (const schedule of duePayments) {
    try {
      const paymentIntent = await stripeConnect.processAutoPay({
        rentScheduleId: schedule.id,
        tenancyId: schedule.tenancy_id,
        amount: schedule.amount * 100,
        customerId: schedule.tenancy.tenant.stripe_customer_id,
        paymentMethodId: schedule.tenancy.tenant.payment_methods[0].stripe_payment_method_id,
        connectedAccountId: schedule.tenancy.property.owner.owner_stripe_accounts.stripe_account_id,
        applicationFeeAmount: Math.round(schedule.amount * 0.015 * 100),
      });

      // 3. Record payment
      await recordPayment(schedule, paymentIntent);

      // 4. Send confirmation
      await sendPaymentConfirmation(schedule, paymentIntent);

    } catch (error) {
      // 5. Handle failure - notify tenant, mark schedule
      await handlePaymentFailure(schedule, error);
    }
  }
}
```

#### Webhook Events to Handle
```typescript
// supabase/functions/stripe-webhook/index.ts

const WEBHOOK_EVENTS = {
  // Payment events
  'payment_intent.succeeded': handlePaymentSucceeded,
  'payment_intent.payment_failed': handlePaymentFailed,
  'charge.refunded': handleRefund,
  'charge.dispute.created': handleDispute,

  // Connect events
  'account.updated': handleAccountUpdated,
  'account.application.deauthorized': handleDeauthorized,

  // Payout events
  'payout.paid': handlePayoutPaid,
  'payout.failed': handlePayoutFailed,

  // Setup events
  'setup_intent.succeeded': handleSetupSucceeded,
  'payment_method.attached': handlePaymentMethodAttached,
  'payment_method.detached': handlePaymentMethodDetached,

  // Mandate events (for BECS)
  'mandate.updated': handleMandateUpdated,
};
```

#### AU BECS Direct Debit Specifics
```typescript
// packages/integrations/src/stripe/becs.ts

/**
 * BECS-specific requirements:
 * 1. Must collect bank account + BSB
 * 2. Must display BECS Direct Debit Request (DDR) service agreement
 * 3. Must send pre-notification 14 days before first debit (or 3 days for subsequent)
 * 4. Debits take 3-4 business days to clear
 */

interface BECSSetupParams {
  customerId: string;
  accountHolderName: string;
  bsb: string;           // 6 digits, formatted as XXX-XXX
  accountNumber: string; // 6-9 digits
  // Must show DDR agreement and record acceptance
  ddrAcceptedAt: Date;
  ddrAcceptedIp: string;
}

// Pre-notification function
async function sendBECSPreNotification(params: {
  customerEmail: string;
  amount: number;
  debitDate: Date;
  description: string;
}) {
  // Required: Notify tenant X days before debit
  // Include: Amount, date, description, how to cancel
}
```

#### Database Additions for Full Stripe Integration
```sql
-- Tenant Stripe customers
CREATE TABLE tenant_stripe_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment method details (extends existing table)
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS becs_mandate_status TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS becs_mandate_id TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS autopay_days_before INTEGER DEFAULT 0;

-- Auto-pay settings per tenancy
CREATE TABLE autopay_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  days_before_due INTEGER NOT NULL DEFAULT 0, -- 0 = on due date
  max_amount DECIMAL(10,2), -- Optional limit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment disputes
CREATE TABLE payment_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_response',
  evidence_due_by TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome TEXT, -- 'won', 'lost', 'withdrawn'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_stripe_customers ON tenant_stripe_customers(tenant_id);
CREATE INDEX idx_autopay_settings_tenancy ON autopay_settings(tenancy_id);
CREATE INDEX idx_payment_disputes_payment ON payment_disputes(payment_id);
```

### Environment Variables (Complete)
```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_live_xxx               # or sk_test_xxx for testing
STRIPE_PUBLISHABLE_KEY=pk_live_xxx          # or pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Stripe Connect
STRIPE_CONNECT_CLIENT_ID=ca_xxx             # For OAuth flow (if using)
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxx     # Separate webhook for Connect events

# Platform Settings
STRIPE_PLATFORM_FEE_PERCENT=1.5             # Platform fee percentage
STRIPE_MIN_PAYOUT_AMOUNT=100                # Minimum payout in cents

# Expo Public (for mobile apps)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### Files to Create/Update
```
packages/integrations/
├── src/
│   └── stripe/
│       ├── index.ts               # Main exports
│       ├── client.ts              # Stripe client initialization
│       ├── connect.ts             # Connected accounts
│       ├── customers.ts           # Customer management
│       ├── payments.ts            # Payment intents
│       ├── paymentMethods.ts      # Payment method management
│       ├── becs.ts                # BECS-specific logic
│       ├── webhooks.ts            # Webhook handlers
│       └── types.ts               # Type definitions

supabase/functions/
├── create-stripe-customer/        # Create tenant customer
│   └── index.ts
├── create-setup-intent/           # Setup payment method
│   └── index.ts
├── create-payment-intent/         # Process payment
│   └── index.ts
├── process-autopay/               # Daily auto-pay cron
│   └── index.ts
├── stripe-webhook/                # Handle all webhooks
│   └── index.ts
├── create-connect-account/        # Owner onboarding
│   └── index.ts
└── connect-webhook/               # Connect-specific webhooks
    └── index.ts
```

### Testing Stripe Integration
```bash
# Test card numbers
4242424242424242  # Visa - succeeds
4000000000000002  # Declined
4000002500003155  # Requires authentication

# Test BECS BSB/Account
000-000 / 000123456  # Test account

# Stripe CLI for webhook testing
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
stripe trigger payment_intent.succeeded
```

### Owner App UI Additions
- [ ] Stripe Connect onboarding flow
- [ ] Payout settings (daily/weekly/monthly)
- [ ] Payout history with statuses
- [ ] Dispute management interface
- [ ] Payment method requirements alerts

### Tenant App UI Additions
- [ ] Stripe Elements for card entry
- [ ] BECS bank account setup with DDR agreement
- [ ] Auto-pay configuration screen
- [ ] Pre-notification display for BECS
- [ ] Payment history with receipts

### Integration Priority
| Feature | Priority | MVP Required | Notes |
|---------|----------|--------------|-------|
| Owner Connect Onboarding | P1 | Yes | Must have before accepting payments |
| Tenant Card Payments | P1 | Yes | Primary payment method |
| Manual Rent Payment | P1 | Yes | Core feature |
| BECS Direct Debit | P1 | Yes | Lower fees than cards |
| Auto-Pay | P2 | Recommended | Major UX improvement |
| Refunds | P2 | Recommended | Customer service need |
| Dispute Handling | P2 | Recommended | Required for chargebacks |

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`rent_schedules`, `payments`, `payment_methods`, `owner_stripe_accounts`, `tenant_stripe_customers`, `autopay_settings`, `payment_disputes`, `add_on_purchases`)
- [ ] RLS policies verified: owners can view payments/schedules for their properties
- [ ] RLS policies verified: tenants can view own payments and manage own payment methods
- [ ] RLS policies verified: owners can manage own Stripe accounts
- [ ] `generate_rent_schedule()` function correctly generates schedule entries
- [ ] `update_updated_at()` triggers on payment_methods and payments
- [ ] UNIQUE constraints on stripe IDs prevent duplicates
- [ ] Indexes created for all query patterns (tenancy, tenant, status, due dates)
- [ ] Foreign keys correct with RESTRICT on payments (prevent orphaning)

### Feature Verification (Mission-Specific)
- [ ] Owner can complete Stripe Connect onboarding (Express account)
- [ ] Tenant can add a card payment method via Stripe Elements
- [ ] Tenant can add a BECS bank account with DDR agreement display
- [ ] Tenant can view rent schedule with upcoming due dates
- [ ] Tenant can make a one-tap rent payment for current due amount
- [ ] Tenant can pay a custom amount (partial or advance)
- [ ] Payment confirmation and receipt display after successful payment
- [ ] Auto-pay can be enabled/disabled with payment method selection
- [ ] Auto-pay processes scheduled payments on due date
- [ ] Owner sees all payments across properties with filters
- [ ] Owner can view payout history and configure payout schedule
- [ ] Payment receipts generate as PDF and email to tenant
- [ ] Stripe webhook events update payment status correctly
- [ ] Failed payments show correct error and allow retry
- [ ] Subscription management works (upgrade, downgrade, cancel)
- [ ] Add-on purchases process correctly via one-off Stripe charge
- [ ] Past-due subscription shows banner in app

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
- [ ] Stripe webhook signature verification enabled
- [ ] No Stripe secret keys exposed in client-side code
- [ ] Payment method tokens (not raw card numbers) stored in database
- [ ] BECS mandate status tracked and validated before charging
