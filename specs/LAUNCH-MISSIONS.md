# Casa Launch Missions — Current State to Public Launch

> Generated from code-level audit on 2026-02-12.
> Updated with deep review findings on 2026-02-12.
> Goal: Public launch within 1 week (by 2026-02-19).

---

## Ground Truth (Verified 2026-02-12)

### Migrations
- **Applied to live DB (001-052):** All core tables exist — profiles, properties, tenancies, payments, maintenance, inspections, agent system, communications, reports, documents, push notifications, security audit.
- **NOT applied (053-062):** email_queue_unification, tenancy_law_rules, performance_indexes, mfa_and_encryption, support_and_export, agent_audit_trail, agent_performance_indexes.

### Edge Functions
- **Deployed (21 functions):** agent-chat, agent-heartbeat, compare-inspections, process-email-queue, send-email, create-connect-account, create-payment-intent, create-setup-intent, generate-inspection-report, generate-report, process-arrears, process-autopay, process-scheduled-messages, process-scheduled-reports, send-arrears-reminder, send-breach-notice, stripe-webhook, sync-listing-to-portals, agent-learning, send-compliance-reminders, dispatch-notification.
- **NOT deployed (10 functions):** analyze-inspection-photos, check-compliance, delete-user-data, export-user-data, generate-recovery-codes, manage-subscription, process-document, setup-mfa, verify-mfa.

### Secrets Configured
- `ANTHROPIC_API_KEY` ✅
- `SUPABASE_ANON_KEY` ✅
- `SUPABASE_DB_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `SUPABASE_URL` ✅

### Secrets NOT Configured
- `STRIPE_SECRET_KEY` ❌
- `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_HANDS_OFF` ❌
- `SENDGRID_API_KEY` ❌
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` ❌
- `DATA_ENCRYPTION_KEY` ❌

### Core App Status
- All core user journeys are real code (zero stubs, zero mock data).
- Owner app: 4 tabs (Home, Portfolio, Tasks, Chat) + full settings, inspections, maintenance, payments, documents, compliance, learning, notifications, support.
- Tenant app: 4 tabs (Home, Tasks, Chat, Maintenance) + inspections, rent, profile, settings.
- Agent chat is live and connected to the deployed edge function.
- TypeScript: 7/7 packages compile clean.

### Known Bugs (from initial + deep review audits)
1. `send-compliance-reminders` queries `profiles.push_token` but tokens live in separate `push_tokens` table.
2. MFA divergence: `useMFA` hook uses Supabase native MFA, edge functions implement custom TOTP — two separate systems.
3. In-memory cache (`packages/api/src/cache/memoryCache.ts`) exists but is never used by any hook.
4. `app.json` references `./assets/notification-icon.png` which doesn't exist.
5. `eas.json` has placeholder values (`"TEAM_ID"`, `"casa-owner"` as ascAppId).
6. **CRITICAL: No deep link listener for OAuth callback.** `signInWithOAuth` opens browser but app has no `Linking.addEventListener` to catch the `casa-owner://auth/callback` redirect. Google OAuth will NOT work.
7. **CRITICAL: Client-side `approveAction` in `useAgentChat` updates DB status but does NOT trigger server-side tool execution.** Approved actions never actually run.
8. **CRITICAL: No server-side subscription tier enforcement in `agent-chat`.** Users on Starter can use all Pro/Hands Off features through the agent.
9. **CRITICAL: No rate limiting on `agent-chat` edge function.** A single user could exhaust the Anthropic API budget.
10. Onboarding race condition: if `profile` is null during onboarding check, user bypasses onboarding gate entirely.
11. Chat error tap starts a new conversation instead of dismissing the error.
12. Home dashboard has no error UI — if data fetch fails, user sees nothing.
13. Portfolio has no error state for failed property loads.
14. Listing creation form has no `KeyboardAvoidingView` — keyboard covers inputs on small screens.

### Security Vulnerabilities (from deep review)
1. `cancel_inspection` has ownership bypass — fallback query drops `owner_id` filter (tool-handlers-actions.ts lines 647-662).
2. `resolve_arrears` missing ownership check — can modify any property's arrears (lines 922-930).
3. `log_arrears_action` missing ownership check (lines 932-946).
4. `record_maintenance_cost` missing ownership check (lines 532-547).
5. `send_email_sendgrid` can send to ANY email address — no validation that recipient is related to user's properties (lines 1081-1125).
6. `send_push_expo` can target any user_id (lines 1128-1179).
7. `folder_templates` and `lease_templates` tables have RLS enabled but no policies defined — effectively blocks all access.

### Feature Gating Gaps (from deep review)
The `useFeatureGate` hook and `TIER_FEATURES` config exist and are well-designed, but enforcement is nearly absent:
- **Only 2 call sites** in the entire app (inspections/schedule.tsx and useVacancyPrompt.ts).
- **No `UpgradePrompt` component** exists despite being referenced in useFeatureGate docs.
- **No enforcement** on: property creation (maxProperties limit), tenant finding, professional inspections, lease management, communications, arrears management, autonomy levels.
- **No server-side enforcement** — agent-chat never checks subscription tier before executing tools.

### Tenant App Gaps (from deep review)
- **No support system** — no support index screen, help articles, or ticket submission.
- **No settings hub** — `settings/` directory has sub-screens but no `index.tsx` entry point.
- **Payment method addition is a stub** — `payments/methods/add.tsx` shows an Alert("Stripe Integration Required") and navigates back.
- **Missing Stack.Screen registrations** in tenant `_layout.tsx` for: documents, notifications, settings routes.
- No onboarding flow for new tenant users.
- No MFA setup in tenant app.

---

## Honest Assessment: Where We Are

**Current automation level: ~50-60%** — Casa has 130 tools and 48 heartbeat scanners, but the heartbeat is a procedural cron job with hardcoded if/else rules. It never calls Claude. It never reasons about context. It checks thresholds like `daysOverdue > 3` and sends templated emails. No personalization. No multi-step workflows. No learning from outcomes. The agent-chat (when users talk to the AI) IS intelligent, but the proactive system that's supposed to make this "hands-free" is not.

**The fundamental architectural gap:** The intelligent agent-chat pipeline (Claude + 130 tools + autonomy gating + confidence scoring + learning) is never used by the heartbeat. The heartbeat has its own procedural code that bypasses all of this.

**The fix:** Build an `agent-orchestrator` that reuses the entire agent-chat pipeline for proactive decisions. Replace "if daysOverdue > 3 then sendEmail" with "give Claude the property context and let it decide what a good PM would do." Use Haiku for routine decisions ($0.02/property/month at scale), Sonnet for complex ones, with prompt caching and batch API for cost control.

**To reach 95%**, the system needs: (a) intelligent proactive decisions via the agentic loop, (b) instant DB-trigger-driven lifecycle communications, (c) multi-step workflow tracking, and (d) external integrations connected (Stripe, SendGrid, Twilio).

---

## Mission Schedule

| Mission | Name | Duration | Blocked By |
|---------|------|----------|------------|
| L1 | Infrastructure: Migrations + Edge Functions + Secrets | 2-3 hours | Owner: API keys |
| L2 | Critical Bug Fixes & Security Hardening | 3-4 hours | L1 |
| L2.5 | Feature Gating & Paywall Enforcement | 2-3 hours | L2 |
| L3 | Google OAuth + Auth Hardening | 1-2 hours | Owner: Google Cloud Console + Supabase Dashboard |
| L4 | Stripe Billing Integration | 2-3 hours | Owner: Stripe account |
| L5 | Email & SMS Integration | 1-2 hours | Owner: SendGrid + Twilio accounts |
| L5.5 | Tenant App Completion | 2-3 hours | L2 |
| **L5.7** | **Proactive Automation: Hands-Free Property Management** | **4-6 hours** | **L2, L5** |
| L6 | TestFlight Build & Device Testing | 2-3 hours | Owner: Apple Developer account |
| L7 | Real-Device QA & Polish | 1-2 days | L6 |
| L8 | App Store Submission | 1 day | L7 |

**Critical path:** L1 → L2 → L2.5 → L5.7 → L6 → L7 → L8
**Parallel track:** L3, L4, L5, L5.5 can run alongside L2/L2.5

---

## L1: Infrastructure — Migrations, Edge Functions, Secrets

**Goal:** Get the live Supabase instance fully up to date so all app features have their backing tables and functions.

### What Claude Does

#### 1. Apply pending migrations (053-062)
```bash
npx supabase db push --linked
```
This applies all 7 unapplied migrations:
- `053` email_queue_unification
- `054` tenancy_law_rules
- `055` performance_indexes (9 composite indexes)
- `056` mfa_and_encryption (user_mfa, recovery_codes tables)
- `060` support_and_export (support_tickets, data_exports tables)
- `061` agent_audit_trail (agent columns on audit_log)
- `062` agent_performance_indexes

#### 2. Deploy all undeployed edge functions
```bash
npx supabase functions deploy analyze-inspection-photos --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy check-compliance --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy delete-user-data --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy export-user-data --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy generate-recovery-codes --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy manage-subscription --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy process-document --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy setup-mfa --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy verify-mfa --project-ref woxlvhzgannzhajtjnke
```

#### 3. Re-deploy updated functions (code changed since last deploy)
```bash
npx supabase functions deploy dispatch-notification --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy send-compliance-reminders --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy agent-chat --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy agent-heartbeat --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy generate-report --project-ref woxlvhzgannzhajtjnke
npx supabase functions deploy process-email-queue --project-ref woxlvhzgannzhajtjnke
```

#### 4. Generate and set DATA_ENCRYPTION_KEY
```bash
# Generate a 256-bit key
openssl rand -hex 32
# Set it
npx supabase secrets set DATA_ENCRYPTION_KEY=<generated_key> --project-ref woxlvhzgannzhajtjnke
```

### What Owner Does
Set up accounts and provide API keys for the secrets that need to be configured in L4 and L5. This can happen in parallel.

### Verification
- `npx supabase migration list --linked` shows all migrations synced
- `npx supabase functions list --project-ref woxlvhzgannzhajtjnke` shows all 31 functions ACTIVE
- `npx supabase secrets list --project-ref woxlvhzgannzhajtjnke` shows DATA_ENCRYPTION_KEY present

---

## L2: Critical Bug Fixes & Security Hardening

**Goal:** Fix all critical bugs, security vulnerabilities, and code integrity issues for launch.

### What Claude Does

#### CRITICAL FIXES (launch blockers)

##### 1. Build deep link listener for OAuth callback
Both owner and tenant apps need `Linking.addEventListener('url')` in `_layout.tsx` to catch `casa-owner://auth/callback` and `casa-tenant://auth/callback` redirects. Without this, Google OAuth will silently fail.

Files: `apps/owner/app/_layout.tsx`, `apps/tenant/app/_layout.tsx`

##### 2. Fix approveAction to trigger server-side execution
`useAgentChat.approveAction()` currently only updates the `agent_messages.action_status` column to `'approved'` but never calls the agent-chat edge function to actually execute the approved tool. The agent needs to receive the approval and run the tool.

Files: `packages/api/src/hooks/useAgentChat.ts`, `supabase/functions/agent-chat/index.ts`

##### 3. Add rate limiting to agent-chat edge function
Implement per-user rate limiting (e.g., 30 messages per 15-minute window) to prevent API budget exhaustion. Use a simple DB counter or in-memory tracking.

Files: `supabase/functions/agent-chat/index.ts`

##### 4. Add server-side subscription tier enforcement
Before executing tools in agent-chat, check the user's `subscription_tier` and reject tools that require a higher tier. Map tool categories to required tiers.

Files: `supabase/functions/agent-chat/index.ts`

#### SECURITY FIXES

##### 5. Fix ownership bypasses in tool handlers
- `cancel_inspection`: Remove fallback that drops `owner_id` filter
- `resolve_arrears`: Add ownership check via property → user join
- `log_arrears_action`: Add ownership check
- `record_maintenance_cost`: Add ownership check

Files: `supabase/functions/_shared/tool-handlers-actions.ts`

##### 6. Restrict email/push recipients
- `send_email_sendgrid`: Validate that recipient email belongs to a tenant/owner associated with the user's properties
- `send_push_expo`: Validate that target user_id is a tenant of one of the user's properties

Files: `supabase/functions/_shared/tool-handlers-generate.ts`

##### 7. Fix RLS on folder_templates and lease_templates
Add proper RLS policies (read-only for authenticated users, or admin-only write).

Files: New migration

#### BUG FIXES

##### 8. Fix send-compliance-reminders push_token bug
The function queries `profiles.push_token` but tokens are stored in the `push_tokens` table. Fix to join against `push_tokens` table instead.

Files: `supabase/functions/send-compliance-reminders/index.ts`

##### 9. Resolve MFA divergence
Use Supabase Auth's native MFA (already what `useMFA` hook does). Repurpose the custom TOTP edge functions (setup-mfa, verify-mfa) to wrap the native MFA API.

##### 10. Fix onboarding race condition
If `profile` is null during the onboarding check in `apps/owner/app/(app)/_layout.tsx`, user can bypass onboarding. Add null-safe check that treats null profile as "needs onboarding."

Files: `apps/owner/app/(app)/_layout.tsx`

##### 11. Fix chat error tap behavior
Error bar tap in chat creates a new conversation instead of dismissing the error. Fix to dismiss.

Files: `apps/owner/app/(app)/(tabs)/chat.tsx`

#### UX POLISH

##### 12. Add error states to home dashboard and portfolio
Both screens show nothing on data fetch failure. Add error UI with retry button.

Files: `apps/owner/app/(app)/(tabs)/index.tsx`, portfolio components

##### 13. Add KeyboardAvoidingView to listing creation
Keyboard covers form inputs on smaller screens.

Files: `apps/owner/app/(app)/listings/create.tsx`

##### 14. Create notification-icon.png asset
Generate from existing icon.png, sized to 96x96 for Android notification tray.

##### 15. Integrate memory cache into high-traffic hooks
Add caching to: `useProperties`, `useNotifications`, `useAgentTasks`.

### Verification
- `pnpm typecheck` passes
- All ownership checks verified via manual tool handler review
- Rate limiting tested by sending rapid messages
- OAuth deep link tested on device (L3 dependency for full test)
- approveAction tested: approve a pending action → tool executes → result appears

---

## L2.5: Feature Gating & Paywall Enforcement

**Goal:** Ensure users on Starter/Pro tiers can only access features they've paid for, and see clear upgrade prompts for locked features.

### What Claude Does

#### 1. Build `UpgradePrompt` component
Reusable component that shows the user's current tier, the required tier for the feature, and a CTA to upgrade. Used across all gated screens.

Files: `packages/ui/src/components/UpgradePrompt.tsx`

#### 2. Enforce maxProperties limit
When creating a property, check `TIER_FEATURES[tier].maxProperties` against the user's current property count. Show UpgradePrompt if at limit.

Files: `apps/owner/app/(app)/listings/create.tsx` (or property creation flow)

#### 3. Gate tenant finding features
Starter users cannot access tenant finding. Add `useFeatureGate(profile, 'tenantFinding')` check to tenant finding screens and show UpgradePrompt.

Files: Tenant finding screens/components

#### 4. Gate professional inspections
Starter users cannot use professional inspections. Add gate check to inspection scheduling.

Files: `apps/owner/app/(app)/inspections/` screens

#### 5. Gate lease management depth
Starter users get `'basic'` lease management, Pro+ get `'full'`. Show UpgradePrompt for advanced lease features (e.g., auto-renewal, custom clauses).

Files: Lease management screens

#### 6. Gate communications features
Starter users get `'basic'` communications. Gate advanced communication features (bulk messaging, custom templates).

Files: Communication-related screens

#### 7. Gate arrears management
Starter users cannot use automated arrears management. Gate arrears auto-escalation features.

Files: Arrears management screens

#### 8. Gate autonomy levels
Starter users can only use L0-L1 autonomy. Pro gets L0-L2. Hands Off gets L0-L4. Enforce in autonomy settings screen AND in agent-chat server-side.

Files: `apps/owner/app/(app)/autonomy.tsx`, `supabase/functions/agent-chat/index.ts`

### Verification
- Starter user sees UpgradePrompt on all Pro/Hands Off features
- Starter user cannot create more than 3 properties
- Agent refuses tier-locked tools server-side (not just client-side)
- Upgrading tier immediately unlocks gated features

---

## L3: Google OAuth + Auth Hardening

**Goal:** Enable Google sign-in so users can authenticate without email/password.

### What Owner Does (Manual — Cannot Be Automated)

#### 1. Google Cloud Console (https://console.cloud.google.com)
- Navigate to: APIs & Services → Credentials
- Find OAuth client (see Google Cloud Console for client ID)
- Add Authorized Redirect URIs:
  - `https://woxlvhzgannzhajtjnke.supabase.co/auth/v1/callback`
  - `casa-owner://auth/callback`
  - `casa-tenant://auth/callback`

#### 2. Supabase Dashboard (https://supabase.com/dashboard/project/woxlvhzgannzhajtjnke)
- Go to: Authentication → Providers → Google
- Enable Google provider
- Client ID: (from Google Cloud Console)
- Client Secret: (from Google Cloud Console)
- Go to: Authentication → URL Configuration
- Add to Redirect URLs:
  - `casa-owner://auth/callback`
  - `casa-tenant://auth/callback`

### What Claude Does

#### 1. Build deep link listener for OAuth callback
Add `Linking.addEventListener('url', handler)` in both app `_layout.tsx` files. The handler must:
- Parse the URL for auth tokens
- Call `supabase.auth.setSession()` with the tokens
- Navigate to the appropriate screen

Files: `apps/owner/app/_layout.tsx`, `apps/tenant/app/_layout.tsx`

#### 2. Build profile completion flow for OAuth signups
Google OAuth creates a user but may not fill all required profile fields. Build a post-OAuth screen that asks for:
- Full name (may come from Google)
- Phone number
- Subscription tier selection

Files: New screen in onboarding flow

#### 3. Verify OAuth flow works end-to-end
Test: tap Google button → browser opens → auth → redirects back to app → logged in

### Verification
- Google sign-in works on both owner and tenant apps
- New users get correct profile created with all required fields
- Existing users can link Google account
- Deep link properly catches the callback and logs user in

---

## L4: Stripe Billing Integration

**Goal:** Enable real payment processing for subscriptions.

### What Owner Does

#### 1. Create Stripe Account
- Sign up at https://stripe.com (or use existing account)
- Complete business verification for Casa / War Dogs Holdings
- Note: Can use TEST MODE keys for initial TestFlight testing

#### 2. Create Products + Prices in Stripe Dashboard
- Product: "Casa Starter" → Price: $49/month → note the `price_xxx` ID
- Product: "Casa Pro" → Price: $89/month → note the `price_xxx` ID
- Product: "Casa Hands Off" → Price: $149/month → note the `price_xxx` ID

#### 3. Create Stripe Webhook
- Endpoint URL: `https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/stripe-webhook`
- Events to listen for:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `checkout.session.completed`
- Note the webhook signing secret

#### 4. Provide keys to Claude for secret configuration
```
STRIPE_SECRET_KEY=sk_test_xxx (or sk_live_xxx for production)
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_HANDS_OFF=price_xxx
```

### What Claude Does
```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_PRICE_STARTER=price_xxx \
  STRIPE_PRICE_PRO=price_xxx \
  STRIPE_PRICE_HANDS_OFF=price_xxx \
  --project-ref woxlvhzgannzhajtjnke
```
- Re-deploy manage-subscription and stripe-webhook functions
- Test subscription creation, upgrade, downgrade, cancellation flows

### Verification
- User can subscribe to a plan from the app
- Subscription status updates in real-time
- Stripe Dashboard shows the subscription
- Webhook events are processed correctly

---

## L5: Email & SMS Integration

**Goal:** Enable email notifications via SendGrid and SMS via Twilio.

### What Owner Does

#### 1. SendGrid Setup
- Sign up at https://sendgrid.com
- Create an API key with Mail Send permission
- Verify a sender identity (e.g., `noreply@casaapp.com.au`)
- Provide: `SENDGRID_API_KEY`, sender email

#### 2. Twilio Setup
- Sign up at https://twilio.com
- Get a phone number (Australian number recommended)
- Provide: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

### What Claude Does
```bash
npx supabase secrets set \
  SENDGRID_API_KEY=SG.xxx \
  SENDGRID_FROM_EMAIL=noreply@casaapp.com.au \
  TWILIO_ACCOUNT_SID=ACxxx \
  TWILIO_AUTH_TOKEN=xxx \
  TWILIO_PHONE_NUMBER=+61xxx \
  --project-ref woxlvhzgannzhajtjnke
```
- Re-deploy dispatch-notification, send-email, process-email-queue
- Test email delivery for each template type
- Test SMS delivery

### Verification
- Trigger a test notification → email arrives
- Trigger an SMS notification → SMS arrives
- Unsubscribe link in email footer works

---

## L5.5: Tenant App Completion

**Goal:** Bring the tenant app to parity with expected functionality so tenants have a complete experience.

### What Claude Does

#### 1. Create tenant settings hub
Build `apps/tenant/app/(app)/settings/index.tsx` — entry point for all tenant settings (profile, notification preferences, security).

Files: `apps/tenant/app/(app)/settings/index.tsx`

#### 2. Register missing routes in tenant layout
Add Stack.Screen entries for documents, notifications, and settings in the tenant `_layout.tsx`.

Files: `apps/tenant/app/(app)/_layout.tsx`

#### 3. Build tenant support system
Create support screens: help articles list, ticket submission form, ticket detail view.

Files: `apps/tenant/app/(app)/support/` (3 screens)

#### 4. Implement real payment method addition
Replace the stub in `payments/methods/add.tsx` with a real Stripe SetupIntent flow using the existing `create-setup-intent` edge function.

Files: `apps/tenant/app/(app)/payments/methods/add.tsx`

#### 5. Add tenant onboarding flow
New tenants need a guided onboarding: verify identity, link to tenancy, set notification preferences.

Files: `apps/tenant/app/(app)/onboarding/` screens

#### 6. Add Terms of Service acceptance flow
Both apps need a ToS acceptance gate during onboarding/signup. Store acceptance timestamp in profile.

Files: Both app signup/onboarding flows, profile schema

#### 7. Add privacy policy link
Display privacy policy link in onboarding, settings, and signup screens.

### Verification
- Tenant can navigate to all sections (settings, support, documents, notifications)
- Payment method can be added via real Stripe flow
- New tenant sees onboarding flow
- ToS acceptance is recorded and gates access

---

## L5.7: Agentic Property Management — From Cron Job to Autonomous AI

**Goal:** Replace the procedural heartbeat (if/else scanners that create tasks) with a truly intelligent, agentic system that uses Claude to reason about each property, make contextual decisions, and execute multi-step workflows autonomously — like a real property manager who knows each property's history.

### The Architectural Shift

**Current system:** 48 scanners, each a hardcoded `if (threshold) { sendEmail() }`. No reasoning. No context. No personalization. Same response for every tenant regardless of history.

**New system:** An agentic loop (Anthropic's recommended pattern) that reviews each property with full context, reasons about what needs attention, and executes using the existing 130-tool system — the same intelligent pipeline that powers agent-chat.

### Architecture: Event-Driven Agent with Tiered Processing

```
                     ┌──────────────────────────┐
                     │   Event Sources           │
                     │  - pg_cron (scheduled)    │
                     │  - DB triggers (instant)  │
                     │  - Webhooks (Stripe etc.) │
                     └───────────┬──────────────┘
                                 │
                     ┌───────────▼──────────────┐
                     │   Event Router            │
                     │  Classifies urgency:      │
                     │  - INSTANT (maintenance   │
                     │    emergency, payment)    │
                     │  - DAILY (compliance,     │
                     │    lease review)          │
                     │  - WEEKLY (market data,   │
                     │    financial reports)     │
                     └───────────┬──────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                     │
   ┌────────▼─────────┐  ┌──────▼────────┐  ┌────────▼─────────┐
   │  Instant Handler  │  │ Daily Batch   │  │ Weekly Batch     │
   │  (per-event)      │  │ (all props)   │  │ (all props)      │
   │  Haiku triage     │  │ Haiku review  │  │ Sonnet analysis  │
   │  → Sonnet if      │  │ per property  │  │ per user         │
   │    complex        │  │               │  │                  │
   └────────┬──────────┘  └──────┬────────┘  └────────┬─────────┘
            │                    │                     │
            └────────────────────┼─────────────────────┘
                                 │
                     ┌───────────▼──────────────┐
                     │   Tool Execution Layer    │
                     │  (reuse agent-chat's      │
                     │   tool-dispatcher +        │
                     │   tool-handlers +           │
                     │   autonomy gating +         │
                     │   confidence scoring)       │
                     └───────────┬──────────────┘
                                 │
                     ┌───────────▼──────────────┐
                     │   Event Store             │
                     │  Every decision logged    │
                     │  with context, reasoning, │
                     │  outcome tracking         │
                     └──────────────────────────┘
```

### What Claude Does

#### Part 1: The Intelligent Heartbeat (Replace Procedural Scanners)

##### 1. New Edge Function: `agent-orchestrator`
A new function that replaces the procedural heartbeat scanners with an agentic loop. For each property, it:

1. **Gathers full context** (reuse `buildSystemPrompt` from agent-chat — one call per user, cached across properties):
   - Owner preferences, rules, autonomy settings
   - Property details, tenancy status, arrears, maintenance, compliance
   - Recent agent events (what was done last cycle — prevents spam)
   - Tenant payment history (context for personalized decisions)

2. **Calls Claude Haiku** with the property context + available tools:
   ```
   "You are Casa, an autonomous property manager. Review this property's
   current state and take any actions needed. You have full access to
   the tool system. The owner's autonomy level is {level}.

   Property: {address}
   Tenant: {name}, payment history: paid on time 11/12 months
   Rent: ${amount}/week, next due: {date} (3 days away)
   Maintenance: 1 open request (leaking tap, submitted yesterday)
   Lease: expires in 58 days
   Compliance: smoke alarm cert expires in 25 days
   Last heartbeat actions: sent rent reminder 5 days ago (delivered)

   Take whatever actions a good property manager would take right now."
   ```

3. **Claude reasons and calls tools** — the same tool execution pipeline as agent-chat:
   - "Tenant usually pays on time, rent due in 3 days — no reminder needed yet."
   - "Maintenance request is routine (leaking tap). Auto-triage as routine. Owner has preferred plumber. Autonomy L3 — auto-assign and notify tenant."
   - "Lease expires in 58 days. Need to analyse market rent and prepare renewal offer."
   - "Smoke alarm cert expires in 25 days. Create maintenance request for recertification."

4. **Executes tools** via the existing `executeToolHandler` pipeline with full autonomy gating and confidence scoring.

5. **Logs everything** to an event store for audit trail and learning.

**Key difference from current heartbeat:** Claude DECIDES what to do based on context, rather than following hardcoded rules. Same tenant 3 days late but has a history of paying by day 5? Wait. Different tenant 1 day late with a history of arrears? Escalate immediately.

Files: `supabase/functions/agent-orchestrator/index.ts` (NEW)

##### 2. Model Routing for Cost Control
Not every decision needs the same model:

| Decision Type | Model | Cost | When |
|--------------|-------|------|------|
| Property review (routine) | Haiku 4.5 | $1/MTok input | Daily batch |
| Maintenance triage | Haiku 4.5 | $1/MTok input | On submission |
| Lease renewal analysis | Sonnet 4.5 | $3/MTok input | 60 days before expiry |
| Legal notice generation | Sonnet 4.5 | $3/MTok input | When needed |
| Complex dispute resolution | Opus 4.6 | $5/MTok input | Rare, escalated |

**With prompt caching** (90% hit rate on system prompts shared across properties) **+ batch API** (50% off for daily/weekly batches), estimated cost:

| Scale | Naive | With Haiku + Caching + Batching |
|-------|-------|--------------------------------|
| 100 properties | $15/month | ~$2/month |
| 1,000 properties | $150/month | ~$15/month |
| 10,000 properties | $1,500/month | ~$100/month |
| 100,000 properties | $15,000/month | ~$800/month |

Files: Model routing logic in `agent-orchestrator/index.ts`

##### 3. Tiered Event Processing

**INSTANT events** (DB triggers, process within seconds):
- Tenant submits maintenance request → Haiku triages urgency → acknowledges to tenant → assigns trade if L≥3
- Payment received → auto-send receipt to tenant → update ledger
- New tenancy created → send welcome email + entry inspection scheduling
- Inspection finalized → generate PDF report → email to both parties

**DAILY events** (batch, process overnight):
- Review all properties for: arrears status, upcoming rent due, stale maintenance, compliance deadlines
- For each property: Haiku call with full context → decide actions → execute
- Generate daily digest for owner (one notification, not per-event spam)

**WEEKLY events** (batch, Sunday night):
- Market rent analysis across portfolio
- Lease renewal pipeline (60/30/14 day windows)
- Financial performance summary
- Portfolio health scoring

**MONTHLY events** (batch, 1st of month):
- Generate + email monthly financial statement to each owner
- Annual rent review analysis
- Insurance/compliance certificate renewal reminders

Files: DB triggers (new migration), cron schedule updates

##### 4. Reuse the Entire Agent-Chat Pipeline

The `agent-orchestrator` reuses these components directly from agent-chat:

| Component | Source | Reuse |
|-----------|--------|-------|
| `buildSystemPrompt()` | agent-chat lines 444-699 | Extract to shared module, call once per user |
| `executeToolHandler()` | tool-dispatcher.ts | Use directly — all 130 tools available |
| Autonomy gating | agent-chat lines 1257-1313 | Copy logic — same autonomy checks |
| Confidence scoring | agent-chat lines 249-333 | Copy logic — same 6-factor scoring |
| Tool genome tracking | agent-chat lines 123-187 | Fire-and-forget async — same learning |
| Decision logging | agent-chat lines 1408-1458 | Same audit trail |

**Refactor needed:** Extract `buildSystemPrompt`, autonomy gating, and confidence scoring into `supabase/functions/_shared/agent-core.ts` so both agent-chat and agent-orchestrator use the same code.

Files: `supabase/functions/_shared/agent-core.ts` (NEW — extracted from agent-chat)

#### Part 2: Automated Tenant Lifecycle Communications

These are DB-trigger-driven (INSTANT), not heartbeat-driven. They fire immediately when events occur.

##### 5. Welcome email + onboarding sequence
DB trigger on `tenancies` INSERT → queue:
- Immediate: Welcome email (property address, rent details, emergency contacts, property rules)
- Day 0: Entry inspection scheduling request
- Day 1: Payment method setup reminder
- Day 3: Move-in checklist (key collection, utility transfer, meter readings)

##### 6. Rent lifecycle communications
- **5 days before due**: Reminder to tenant (only if autopay not enabled)
- **On payment**: Receipt confirmation to tenant + ledger update
- **1 day overdue**: Friendly follow-up (context-aware — if tenant usually pays by day 3, tone is light)
- **7+ days overdue**: Formal reminder (escalation handled by agentic heartbeat based on context)

##### 7. Lease lifecycle communications
- **60 days before expiry**: Renewal offer with market-adjusted rent suggestion (Sonnet generates)
- **30 days before expiry**: Follow-up if no response
- **14 days before end**: Exit checklist to tenant (cleaning standards, handover expectations, bond process)
- **On lease end**: Bond return/claim calculation (based on exit inspection comparison)

##### 8. Maintenance lifecycle communications
- **On submission**: Acknowledgment to tenant with triage result
- **On trade assignment**: Notification to tenant with trade contact + ETA
- **48h after assignment**: Follow-up to trade if no response
- **On completion**: Notification to tenant + owner with resolution + cost
- **3 days after completion**: Satisfaction check to tenant

##### 9. Inspection lifecycle communications
- **On scheduling**: Notice to tenant (state-compliant notice period)
- **24h before**: Reminder to tenant
- **On completion**: PDF report emailed to both parties
- **If issues found**: Auto-create maintenance requests

Files: New migration with DB triggers, `supabase/functions/_shared/notification-templates.ts` (expand), `process-email-queue` template additions

#### Part 3: Event Store for Audit + Learning

##### 10. Agent events table
Every autonomous decision is logged for:
- **Audit trail**: "Why did Casa send this email?" — full reasoning chain
- **Learning**: Outcome tracking feeds back into confidence scoring
- **Compliance**: Provable record of notices served, deadlines met
- **Owner visibility**: "Here's everything Casa did this month for your properties"

```sql
CREATE TABLE agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  event_source TEXT NOT NULL,  -- 'heartbeat_daily', 'trigger_payment', 'trigger_maintenance'
  model_used TEXT,             -- 'haiku-4.5', 'sonnet-4.5'
  context_snapshot JSONB,      -- Property state at time of decision
  reasoning TEXT,              -- Claude's reasoning for the decision
  tools_called JSONB,          -- [{tool, input, result}]
  autonomy_level INT,
  confidence DECIMAL(3,2),
  outcome TEXT,                -- 'success', 'pending', 'owner_override'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Files: New migration, logging in agent-orchestrator

#### Part 4: Personalisation Engine

##### 11. Context-aware decision making
The key differentiator vs. procedural scanners. Claude sees tenant history and adapts:

- **Tenant A**: Always pays 2 days late, 100% payment rate → Don't send reminder until day 5
- **Tenant B**: History of 3 arrears events → Send reminder on day 1, escalate quickly
- **Property X**: Had 4 maintenance requests this quarter → Flag for owner as potential issue
- **Owner Y**: Always approves maintenance under $300 → Auto-approve at L2 (learn from patterns)

This happens naturally when Claude has the context. No code needed — just good context engineering in the system prompt.

##### 12. Owner communication preferences
- Reduce notification noise: Daily digest instead of per-event alerts
- Critical-only mode: Only alert for things requiring owner decision
- Full transparency mode: Every action reported in real-time

Files: `agent_notification_preferences` table or extend existing notification settings

#### Part 5: Multi-Step Workflow Engine

##### 13. Stateful workflows
The current system can only do single-step actions. The new system tracks multi-step workflows:

```
LEASE_RENEWAL workflow:
  Step 1: Analyse market rent [day -60] → DONE
  Step 2: Generate renewal offer [day -60] → DONE
  Step 3: Send to tenant [day -60] → DONE
  Step 4: Wait for response [day -60 to -30] → WAITING
  Step 5: If accepted → Generate new lease [on acceptance]
  Step 6: If no response → Follow up [day -30]
  Step 7: If declined → Create listing [day -30]
  Step 8: If declined → Syndicate to portals [day -28]
```

Each heartbeat cycle, Claude checks workflow state and advances to the next step if ready.

```sql
CREATE TABLE agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  workflow_type TEXT NOT NULL,   -- 'lease_renewal', 'arrears_escalation', 'maintenance_lifecycle'
  current_step INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL,
  step_data JSONB NOT NULL,     -- [{step, status, completed_at, result}]
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused', 'cancelled'
  next_action_at TIMESTAMPTZ,   -- When to check this workflow next
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Workflow templates for: lease renewal, arrears escalation, maintenance lifecycle, tenant onboarding, tenant exit, inspection lifecycle, compliance renewal, listing lifecycle.

Files: New migration, workflow engine in agent-orchestrator

### The "Hands Off" Experience (Post-Mission)

A user on "Hands Off" tier ($149/month) with L3 autonomy who never opens the app:

**Week 1 (New Property Added):**
- Casa reviews property → creates compliance checklist → sends welcome email to tenant → schedules entry inspection → sends property rules document
- Owner receives: "Casa has onboarded your property at 123 Smith St. Entry inspection scheduled for Jan 15."

**Ongoing (Monthly):**
- Rent collected automatically (Stripe)
- Tenant gets contextual reminders (only when needed based on history)
- Tenant gets receipt after payment
- Any maintenance: auto-triaged by AI, auto-assigned to trade, auto-tracked through completion
- Owner receives monthly financial statement + portfolio health report

**Month 3 (Inspection Due):**
- Casa schedules routine inspection with state-compliant notice
- Notifies tenant 14 days ahead
- After inspection: generates PDF report, emails both parties
- Any issues: auto-creates maintenance requests with AI triage

**Month 11 (Lease Renewal):**
- Casa analyses market rent using real data
- Generates renewal offer with recommended new rent
- Sends to tenant automatically
- Tracks response → auto-generates new lease or creates listing

**Emergency (Anytime):**
- Tenant reports burst pipe at 2am → Haiku triages as EMERGENCY
- Auto-notifies owner immediately via push + SMS
- If L≥3: Auto-contacts emergency plumber from trade network
- Logs everything for insurance claim

### Cost Projection

| Scale | Properties | Haiku Calls/Day | Sonnet Calls/Week | Monthly AI Cost | Per Property |
|-------|-----------|-----------------|-------------------|-----------------|-------------|
| Early | 100 | 100 | 20 | ~$5 | $0.05 |
| Growth | 1,000 | 1,000 | 200 | ~$40 | $0.04 |
| Scale | 10,000 | 10,000 | 2,000 | ~$300 | $0.03 |
| Target | 100,000 | 50,000 (batched) | 10,000 | ~$2,000 | $0.02 |

With Anthropic Batch API (50% off) + prompt caching (90% hit rate), costs decrease as scale increases.

### Implementation Order (Within This Mission)

1. Extract `agent-core.ts` from agent-chat (shared: buildSystemPrompt, autonomy, confidence, tool execution)
2. Build `agent-orchestrator` function with agentic loop per property
3. Add DB triggers for instant events (payment received, maintenance submitted, tenancy created, inspection finalized)
4. Add notification templates for all lifecycle communications
5. Build workflow engine (agent_workflows table + step advancement logic)
6. Wire tiered cron jobs (instant/daily/weekly/monthly)
7. Add event store (agent_events table + logging)
8. Add model routing (Haiku for routine, Sonnet for complex, Opus for critical)

### Verification
- New tenancy created → welcome email arrives within 60 seconds (no landlord action)
- Rent due date approaches → tenant gets contextual reminder (adapts to payment history)
- Payment received → receipt sent instantly
- Maintenance submitted → AI triage + acknowledgment within 60 seconds
- Lease expiring → multi-step renewal workflow runs automatically over 60 days
- Inspection completed → PDF report delivered to both parties
- Monthly financial statement arrives on 1st of month
- Every autonomous action has full reasoning logged in agent_events
- Landlord on Hands Off tier can go 60 days without opening app and properties are managed
- Emergency maintenance triggers instant notification + trade dispatch

---

## L6: TestFlight Build & Device Testing

**Goal:** Get the app running on a real iPhone via TestFlight.

### What Owner Does

#### 1. Apple Developer Program
- Enroll at https://developer.apple.com/programs/enroll/ ($99 USD/year)
- Use Apple ID associated with your preferred email
- Note your **Team ID** (10-char alphanumeric from Membership Details)

#### 2. App Store Connect
- Go to https://appstoreconnect.apple.com
- Create new app:
  - Platform: iOS
  - Name: Casa Owner (and separately: Casa Tenant)
  - Bundle ID: `com.casa.owner` (register at developer.apple.com if needed)
  - SKU: `casa-owner`
- Note the **numeric Apple ID** shown on App Information page

#### 3. Provide to Claude
- Apple Team ID
- Numeric Apple ID from App Store Connect (ascAppId)
- Apple ID email (for eas.json)

### What Claude Does

#### 1. Fix eas.json with real values
Replace placeholder `TEAM_ID` and `casa-owner` ascAppId with real values.

#### 2. Fix app.json
Remove or create the missing notification-icon.png asset (done in L2).

#### 3. Initialize EAS
```bash
npm install -g eas-cli
eas login
cd apps/owner
eas init
```

#### 4. Build & Submit
```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest
```

EAS handles all code signing (certificates, provisioning profiles) automatically.

#### 5. Repeat for tenant app
Same process for `apps/tenant` with `com.casa.tenant` bundle ID.

### Verification
- Build completes on EAS servers
- App appears in TestFlight
- Owner installs via TestFlight on their iPhone
- App launches, login works, core flows functional

---

## L7: Real-Device QA & Polish

**Goal:** Systematically test every user flow on a real device and fix issues.

### Test Checklist

#### Authentication
- [ ] Email/password signup → creates account → lands on onboarding
- [ ] Email/password login → lands on home
- [ ] Google OAuth login → deep link catches callback → lands on home
- [ ] Google OAuth signup → profile completion flow → lands on home
- [ ] Password reset flow
- [ ] Logout → returns to login
- [ ] ToS acceptance gate works during signup

#### Owner Core Flows
- [ ] Home dashboard loads with real data
- [ ] Home dashboard shows error state on fetch failure (with retry)
- [ ] Portfolio tab shows properties
- [ ] Portfolio tab shows error state on fetch failure
- [ ] Add a property → appears in list
- [ ] Add property blocked at maxProperties limit (Starter: 3) → shows UpgradePrompt
- [ ] Tasks tab shows agent tasks
- [ ] Chat tab → send message → agent responds
- [ ] Agent suggests actions → approve → tool actually executes → result appears
- [ ] Agent suggests actions → reject → rejection recorded

#### Feature Gating (Starter Tier)
- [ ] Tenant finding features show UpgradePrompt
- [ ] Professional inspections show UpgradePrompt
- [ ] Advanced lease management shows UpgradePrompt
- [ ] Autonomy level capped at L1 (cannot select L2+)
- [ ] Agent refuses tier-locked tools server-side

#### Property Management
- [ ] View property details
- [ ] Create inspection → schedule → complete
- [ ] Create maintenance request → assign → resolve
- [ ] View arrears → send reminder
- [ ] Keyboard doesn't cover inputs in listing creation form

#### Documents & Compliance
- [ ] Upload a document → appears in documents list
- [ ] View compliance status
- [ ] Upload compliance evidence

#### Payments (if Stripe configured)
- [ ] Subscribe to a plan
- [ ] View subscription status
- [ ] Upgrade/downgrade plan
- [ ] Feature gates update immediately after upgrade

#### Settings
- [ ] Change autonomy level
- [ ] View/edit agent rules
- [ ] Notification preferences
- [ ] Support ticket creation

#### Security
- [ ] Rate limiting: rapid messages → eventually throttled
- [ ] Agent tools respect ownership (can't modify other users' data)
- [ ] Email sending restricted to user's property contacts

#### Tenant App
- [ ] Tenant login
- [ ] Tenant onboarding flow (new user)
- [ ] View tenancy details
- [ ] View rent schedule
- [ ] Add payment method (real Stripe flow)
- [ ] Submit maintenance request
- [ ] Chat with agent
- [ ] View inspections
- [ ] Access settings hub
- [ ] Submit support ticket
- [ ] Navigate to documents, notifications

### What Claude Does
Fix every bug found during QA testing. Common issues to watch for:
- Keyboard covering inputs on small screens
- Safe area insets on different iPhone models
- Loading states that hang
- Empty states that show blank screens
- Navigation that doesn't go back properly
- Images that don't load
- Dates displayed in wrong timezone

### Verification
- Every item in the test checklist passes
- No crashes in 30 minutes of continuous use
- App feels polished and responsive

---

## L8: App Store Submission

**Goal:** Submit to the App Store for public availability.

### What Owner Needs to Prepare

#### 1. App Store Listing Content
- **App Name:** Casa — AI Property Manager
- **Subtitle:** (30 chars max) e.g., "Smart Property Management"
- **Description:** (4000 chars max) — Highlight AI agent, cost savings vs traditional PM, Australian compliance
- **Keywords:** property management, landlord, rental, AI, Australia, tenant, inspection, maintenance
- **Category:** Primary: Finance, Secondary: Productivity
- **Privacy Policy URL:** Must be hosted (e.g., https://casaapp.com.au/privacy)
- **Support URL:** e.g., https://casaapp.com.au/support

#### 2. Screenshots (Required)
- 6.7" display (iPhone 15 Pro Max): 1290 x 2796px — minimum 3, recommended 6-10
- 6.5" display (iPhone 14 Plus): 1284 x 2778px
- Key screens to capture: Home dashboard, Chat with agent, Property details, Inspection flow, Subscription plans

#### 3. App Icon
- 1024x1024px PNG, no alpha channel, no rounded corners (Apple adds them)

#### 4. Review Notes for Apple
- Test account credentials for Apple reviewers
- Explanation of AI agent functionality
- Note about Australian property market focus

### What Claude Does
- Final production build with `eas build --platform ios --profile production`
- Submit via `eas submit`
- Ensure all metadata is configured in App Store Connect

### Verification
- App passes Apple review (typically 24-48 hours)
- App appears in the App Store
- Download and install from App Store works

---

## Owner Action Items Summary

These are the things ONLY YOU can do (Claude cannot access dashboards or create accounts):

### Immediate (Do Today)
1. [ ] **Apple Developer Program** — Enroll at developer.apple.com ($99/year)
2. [ ] **Stripe account** — Sign up at stripe.com, create products + prices
3. [ ] **SendGrid account** — Sign up at sendgrid.com, create API key, verify sender
4. [ ] **Twilio account** — Sign up at twilio.com, get Australian phone number

### After Account Setup (Provide to Claude)
5. [ ] **Apple Team ID** + App Store Connect numeric App ID
6. [ ] **Stripe keys** — secret key, webhook secret, 3 price IDs
7. [ ] **SendGrid API key** + verified sender email
8. [ ] **Twilio** — account SID, auth token, phone number

### Google OAuth (10 minutes)
9. [ ] **Google Cloud Console** — Add redirect URIs to existing OAuth client
10. [ ] **Supabase Dashboard** — Enable Google provider with client ID/secret
11. [ ] **Supabase Dashboard** — Add deep link redirect URLs

### App Store (When Ready to Submit)
12. [ ] **App Store Connect** — Create app listing, upload screenshots
13. [ ] **Privacy Policy** — Host at casaapp.com.au/privacy
14. [ ] **Test account** — Create test credentials for Apple reviewers

---

## What Claude Can Start Immediately (No Owner Action Needed)

### L1 Infrastructure
1. Apply pending migrations (053-062) to live Supabase
2. Deploy all undeployed edge functions
3. Generate and set DATA_ENCRYPTION_KEY

### L2 Critical Fixes
4. Build deep link listener for OAuth callback (both apps)
5. Fix approveAction to trigger server-side tool execution
6. Add rate limiting to agent-chat
7. Add server-side subscription tier enforcement
8. Fix all 4 ownership bypasses in tool handlers
9. Restrict email/push recipients to property-related contacts
10. Fix RLS on folder_templates and lease_templates
11. Fix send-compliance-reminders push_token bug
12. Fix onboarding race condition
13. Fix chat error tap behavior
14. Add error states to home dashboard and portfolio
15. Add KeyboardAvoidingView to listing creation
16. Create notification-icon.png asset
17. Resolve MFA divergence

### L2.5 Feature Gating
18. Build UpgradePrompt component
19. Add feature gate checks to all gated screens
20. Enforce maxProperties limit
21. Gate autonomy levels by tier

### L5.5 Tenant App
22. Create tenant settings hub
23. Register missing routes in tenant layout
24. Build tenant support screens
25. Add tenant onboarding flow
26. Add ToS acceptance flow

### L5.7 Agentic Property Management
27. Extract agent-core.ts from agent-chat (shared pipeline)
28. Build agent-orchestrator edge function with agentic loop
29. DB triggers for instant events (payment, maintenance, tenancy, inspection)
30. Notification templates for all lifecycle communications
31. Workflow engine (agent_workflows table + step advancement)
32. Tiered cron jobs (instant/daily/weekly/monthly)
33. Event store (agent_events table + full decision logging)
34. Model routing (Haiku routine / Sonnet complex / Opus critical)

**These cover ~80% of the remaining work. The 20% that requires owner action is: Apple Developer account, Stripe setup, SendGrid/Twilio accounts, Google OAuth dashboard config.**
