# Mission EXT-CONFIG: External Configuration & Account Setup

## Overview
**Goal**: Set up all external accounts, API keys, and configurations required before launch.
**Dependencies**: Business registration, domain ownership
**When to Complete**: After business setup, before launch
**Blocking**: This mission blocks live payment processing, email notifications, and portal syndication.

> **Note**: All code implementation is complete. This mission is purely external account setup and configuration.

---

## Prerequisites

Before starting this mission, ensure:
- [ ] Business registered (ABN/ACN)
- [ ] Business bank account opened
- [ ] Domain ownership verified (casaapp.com.au or similar)
- [ ] Business email addresses created (e.g., noreply@casaapp.com.au)

---

## Phase A: Stripe Setup (Payments)

### A1. Create Stripe Account
| Task | Status | Notes |
|------|--------|-------|
| Sign up at stripe.com | ⬜ | Use business email |
| Complete business verification | ⬜ | Requires ABN, director ID |
| Add business bank account | ⬜ | For payouts |
| Enable Stripe Connect | ⬜ | Dashboard → Connect → Get started |

### A2. Configure Stripe Connect
| Task | Status | Notes |
|------|--------|-------|
| Set up Express account type | ⬜ | For owner payouts |
| Configure platform fee (2.5%) | ⬜ | Dashboard → Connect → Settings |
| Set payout schedule | ⬜ | Daily recommended |
| Enable AU BECS Direct Debit | ⬜ | Payment Methods → BECS |

### A3. Get API Keys
| Task | Status | Notes |
|------|--------|-------|
| Copy test secret key | ⬜ | `sk_test_...` |
| Copy live secret key | ⬜ | `sk_live_...` (after go-live) |
| Store securely | ⬜ | Never commit to git |

### A4. Configure Webhooks
| Task | Status | Notes |
|------|--------|-------|
| Add webhook endpoint | ⬜ | URL: `https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/stripe-webhook` |
| Select events (see below) | ⬜ | |
| Copy webhook signing secret | ⬜ | `whsec_...` |

**Webhook Events to Enable:**
```
payment_intent.succeeded
payment_intent.payment_failed
setup_intent.succeeded
account.updated
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

### A5. Create Subscription Products (Optional - for owner subscriptions)
| Task | Status | Notes |
|------|--------|-------|
| Create "Starter" product | ⬜ | Free tier |
| Create "Pro" product & price | ⬜ | $29/month |
| Create "Hands-Off" product & price | ⬜ | $49/month |
| Note price IDs | ⬜ | `price_...` for each |

---

## Phase B: SendGrid Setup (Email)

### B1. Create SendGrid Account
| Task | Status | Notes |
|------|--------|-------|
| Sign up at sendgrid.com | ⬜ | Use business email |
| Choose plan (Free tier: 100 emails/day) | ⬜ | Upgrade as needed |

### B2. Verify Sender Domain
| Task | Status | Notes |
|------|--------|-------|
| Go to Settings → Sender Authentication | ⬜ | |
| Add domain (casaapp.com.au) | ⬜ | |
| Add DNS records to domain | ⬜ | CNAME records provided |
| Verify domain | ⬜ | May take up to 48 hours |

### B3. Create API Key
| Task | Status | Notes |
|------|--------|-------|
| Go to Settings → API Keys | ⬜ | |
| Create key with "Mail Send" permission | ⬜ | |
| Copy API key | ⬜ | `SG....` |
| Store securely | ⬜ | Only shown once |

---

## Phase C: Domain & REA Portal APIs (Listing Syndication)

> **Note**: These require partnership applications that may take 2-4 weeks. Start early.

### C1. Domain.com.au API
| Task | Status | Notes |
|------|--------|-------|
| Apply at developer.domain.com.au | ⬜ | |
| Complete agency verification | ⬜ | May require real estate license |
| Receive API credentials | ⬜ | |
| Note API key and Agent ID | ⬜ | |

### C2. REA (realestate.com.au) API
| Task | Status | Notes |
|------|--------|-------|
| Apply for API partnership | ⬜ | |
| Complete verification (licensed agent required) | ⬜ | |
| Receive API credentials | ⬜ | |
| Note API key, secret, and Agent ID | ⬜ | |

**Alternative**: If API access is denied, implement REAXML feed as fallback.

---

## Phase D: Deploy Supabase Edge Functions

### D1. Deploy Functions
```bash
# From project root
cd /Users/robbiespooner/Desktop/propbot

# Deploy all Edge Functions
supabase functions deploy create-payment-intent
supabase functions deploy create-setup-intent
supabase functions deploy create-connect-account
supabase functions deploy stripe-webhook
supabase functions deploy process-autopay
supabase functions deploy send-email
supabase functions deploy process-email-queue
supabase functions deploy sync-listing-to-portals
```

| Function | Status | Notes |
|----------|--------|-------|
| create-payment-intent | ⬜ | |
| create-setup-intent | ⬜ | |
| create-connect-account | ⬜ | |
| stripe-webhook | ⬜ | |
| process-autopay | ⬜ | |
| send-email | ⬜ | |
| process-email-queue | ⬜ | |
| sync-listing-to-portals | ⬜ | |

### D2. Set Supabase Secrets
```bash
# Stripe
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# SendGrid
supabase secrets set SENDGRID_API_KEY=SG....
supabase secrets set SENDGRID_FROM_EMAIL=noreply@casaapp.com.au
supabase secrets set SENDGRID_FROM_NAME=Casa

# Scheduled Jobs
supabase secrets set CRON_SECRET=<generate-random-32-char-string>

# Domain API (when available)
supabase secrets set DOMAIN_API_KEY=...
supabase secrets set DOMAIN_AGENT_ID=...
supabase secrets set DOMAIN_ENVIRONMENT=sandbox  # or 'production'

# REA API (when available)
supabase secrets set REA_API_KEY=...
supabase secrets set REA_API_SECRET=...
supabase secrets set REA_AGENT_ID=...
supabase secrets set REA_ENVIRONMENT=sandbox  # or 'production'
```

| Secret | Status | Notes |
|--------|--------|-------|
| STRIPE_SECRET_KEY | ⬜ | |
| STRIPE_WEBHOOK_SECRET | ⬜ | |
| SENDGRID_API_KEY | ⬜ | |
| SENDGRID_FROM_EMAIL | ⬜ | |
| SENDGRID_FROM_NAME | ⬜ | |
| CRON_SECRET | ⬜ | |
| DOMAIN_API_KEY | ⬜ | When available |
| DOMAIN_AGENT_ID | ⬜ | When available |
| REA_API_KEY | ⬜ | When available |
| REA_API_SECRET | ⬜ | When available |
| REA_AGENT_ID | ⬜ | When available |

---

## Phase E: Apply Database Migration

### E1. Apply Email Notification Triggers
```bash
# Option 1: Via Supabase CLI
supabase db push

# Option 2: Via Supabase Dashboard SQL Editor
# Copy contents of: supabase/migrations/20240101000015_email_notification_triggers.sql
# Paste and run in SQL Editor
```

| Task | Status | Notes |
|------|--------|-------|
| Apply migration | ⬜ | Creates email_notifications table + triggers |
| Verify triggers created | ⬜ | Check in Database → Triggers |

---

## Phase F: Set Up Scheduled Jobs

### F1. Enable pg_cron Extension
```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### F2. Create Scheduled Jobs
```sql
-- Process auto-pay daily at 6am AEST (8pm UTC previous day)
SELECT cron.schedule(
  'process-autopay-daily',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/process-autopay',
    headers := '{"X-Cron-Secret": "YOUR_CRON_SECRET_HERE"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- Process email queue every minute
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/process-email-queue',
    headers := '{"X-Cron-Secret": "YOUR_CRON_SECRET_HERE"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
```

| Job | Status | Notes |
|-----|--------|-------|
| process-autopay-daily | ⬜ | Runs 6am AEST |
| process-email-queue | ⬜ | Runs every minute |

### F3. Verify Jobs
```sql
-- Check scheduled jobs
SELECT * FROM cron.job;

-- Check job run history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## Phase G: Testing & Verification

### G1. Test Stripe Integration
| Test | Status | Notes |
|------|--------|-------|
| Create test owner in app | ⬜ | |
| Complete Stripe Connect onboarding | ⬜ | Use test mode |
| Create test tenant in app | ⬜ | |
| Add test payment method | ⬜ | Use Stripe test cards |
| Make test payment | ⬜ | Verify webhook received |
| Verify payment in Stripe dashboard | ⬜ | |
| Verify payment record in database | ⬜ | |

**Stripe Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- BECS: BSB `000-000`, Account `000123456`

### G2. Test Email Notifications
| Test | Status | Notes |
|------|--------|-------|
| Submit test application | ⬜ | Should trigger owner email |
| Change application status | ⬜ | Should trigger tenant email |
| Make test payment | ⬜ | Should trigger owner email |
| Check email_notifications table | ⬜ | Verify queue processing |

### G3. Test Portal Syndication (When APIs Available)
| Test | Status | Notes |
|------|--------|-------|
| Publish test listing | ⬜ | |
| Verify sync to Domain | ⬜ | Check sync status in database |
| Verify sync to REA | ⬜ | Check sync status in database |
| Update listing | ⬜ | Verify update syncs |
| Close listing | ⬜ | Verify removal syncs |

---

## Environment Variables Summary

### Local Development (apps/owner/.env.local, apps/tenant/.env.local)
```bash
# Supabase (already configured)
EXPO_PUBLIC_SUPABASE_URL=https://woxlvhzgannzhajtjnke.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Stripe (for client-side)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Supabase Secrets (server-side)
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@casaapp.com.au
SENDGRID_FROM_NAME=Casa
CRON_SECRET=<random-secret>
DOMAIN_API_KEY=...
DOMAIN_AGENT_ID=...
DOMAIN_ENVIRONMENT=sandbox
REA_API_KEY=...
REA_API_SECRET=...
REA_AGENT_ID=...
REA_ENVIRONMENT=sandbox
```

---

## Completion Checklist

Before marking this mission complete:

- [ ] Stripe account created and verified
- [ ] Stripe Connect enabled with Express accounts
- [ ] Stripe webhook configured and tested
- [ ] SendGrid account created
- [ ] SendGrid sender domain verified
- [ ] All Edge Functions deployed
- [ ] All Supabase secrets set
- [ ] Database migration applied
- [ ] Scheduled jobs created and running
- [ ] End-to-end payment flow tested
- [ ] End-to-end email notification flow tested
- [ ] Portal APIs applied for (Domain, REA)

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|---------------|
| A: Stripe Setup | 1-2 hours |
| B: SendGrid Setup | 30 minutes |
| C: Portal APIs | 2-4 weeks (application process) |
| D: Deploy Functions | 30 minutes |
| E: Database Migration | 10 minutes |
| F: Scheduled Jobs | 15 minutes |
| G: Testing | 1-2 hours |

**Total (excluding Portal API wait)**: ~4-5 hours

---

## Notes

- All code for these integrations is already written and tested
- This mission is purely configuration and account setup
- Portal APIs (Domain/REA) can be configured later without blocking other features
- Start Portal API applications early due to approval wait times
- Use test/sandbox mode for all initial setup, switch to production before launch
