# Casa Launch Sprint — From 80% to Shippable

> **Date:** February 12, 2026
> **Objective:** Get Casa to a cohesive, launchable state in 8 days. Every feature either works flawlessly end-to-end or is cleanly gated behind a polished "coming soon" state. No dead ends. No broken flows. No half-built features masquerading as real ones.
> **Launch Target:** February 20, 2026 — TestFlight to first 5-10 landlords.

---

## How to Use This Document

This is a sequential mission plan. Complete each phase fully before moving to the next. Each phase has a verification checklist — do not advance until every item passes. Copy this file into your project root as `LAUNCH-SPRINT.md` and reference it in every Claude Code conversation.

**For every Claude Code conversation, use this opening prompt:**

```
Read /LAUNCH-SPRINT.md fully before doing anything. You are executing Phase [X]. 
Complete every task in this phase. Do not skip tasks. Do not defer tasks. 
Do not move to the next phase. When complete, run the verification checklist 
and report results.
```

**One phase per conversation.** Start a fresh Claude Code session for each phase. This prevents context degradation and keeps each session focused.

---

## The Core Principle: Ship or Gate

Every feature in this app falls into exactly one of two categories:

**SHIP IT** — The feature works end-to-end. A real user can start and complete the flow without hitting an error, a dead end, a placeholder, or confusing behaviour. Data persists. Notifications fire. State updates. The UI handles loading, empty, error, and success states.

**GATE IT** — The feature is not ready. The UI entry point shows a clean, branded "Coming Soon" card that feels intentional and premium — not broken. Every navigation path that could lead into the unfinished feature is intercepted. The user never accidentally discovers half-built functionality.

There is no third category. There is no "it mostly works." There is no "it works if you don't do X." Ship it or gate it.

---

## Phase 0: The Audit (2-3 hours)

**Goal:** Build a complete map of what's shippable and what needs gating before writing a single line of code.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 0 and CLAUDE.md.

I need you to audit every user-facing feature in both the owner and tenant apps. 
For each feature, walk through it as a real user would — tap every button, submit 
every form, trigger every flow. 

For each feature, report:

1. FEATURE NAME and entry point (which screen/tab/button leads to it)
2. STATUS: one of:
   - SHIPPABLE: Works end-to-end, data persists, no dead ends
   - FIXABLE (<4 hours): Has specific bugs but core flow works, list what's broken
   - NOT READY: Fundamental gaps, missing backend, stubbed data, or >4 hours of work
3. BACKEND STATUS: Does this feature's backend pipeline work? 
   - API hooks → Edge Functions → Database → Notifications — trace the full chain
   - Call out any stubbed integrations, missing Edge Function deployments, or broken data flows
4. ALL ENTRY POINTS: Every button, nav item, deep link, or notification that leads 
   to this feature (we need this to gate NOT READY features completely)

Structure your output as three lists:
- SHIP LIST: Features that are SHIPPABLE or FIXABLE (with specific fixes needed)
- GATE LIST: Features that are NOT READY (with all entry points to intercept)
- BACKEND BLOCKERS: Systems that must work for ANY feature to function 
  (auth, database, cron, notifications)

Be brutally honest. A feature that crashes once in a realistic user flow is NOT READY.
A feature with a beautiful UI but a stubbed backend is NOT READY.
A feature that works but has no error handling is FIXABLE.
```

### What You (Robbie) Do During Phase 0:
While Claude Code audits, you set up external accounts in parallel:

1. **Apple Developer Program** — Enroll at developer.apple.com ($99 USD/year). Note your Team ID.
2. **Stripe** — Sign up at stripe.com. Create three products:
   - Casa Starter: $49/month AUD → note the `price_xxx` ID
   - Casa Pro: $89/month AUD → note the `price_xxx` ID  
   - Casa Hands Off: $149/month AUD → note the `price_xxx` ID
   - Create webhook endpoint: `https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/stripe-webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `checkout.session.completed`
   - Note the webhook signing secret
3. **SendGrid** — Sign up at sendgrid.com. Create API key with Mail Send permission. Verify sender identity for your chosen domain.
4. **Twilio** — Sign up at twilio.com. Get an Australian phone number. Note Account SID, Auth Token, Phone Number.
5. **Google Cloud Console** — Add redirect URIs to your existing OAuth client:
   - `https://woxlvhzgannzhajtjnke.supabase.co/auth/v1/callback`
   - `casa-owner://auth/callback`
   - `casa-tenant://auth/callback`
6. **Supabase Dashboard:**
   - Enable Google auth provider with your client ID/secret
   - Add `casa-owner://auth/callback` and `casa-tenant://auth/callback` to redirect URLs
   - Verify `pg_cron` and `pg_net` extensions are enabled (Database → Extensions)
   - Verify `private.cron_config` table exists and has the service role key
7. **Domain** — Pick ONE domain. Every reference in the codebase must use the same domain. Recommended: `casapm.com.au` (already referenced in app.json). Update SendGrid sender identity to match.
8. **App Store Connect** — Create two apps:
   - Casa Owner: Bundle ID `com.casa.owner`
   - Casa Tenant: Bundle ID `com.casa.tenant`
   - Note the numeric Apple ID for each

### Phase 0 Verification:
- [ ] Audit complete — every feature categorised as SHIP, FIXABLE, or NOT READY
- [ ] All entry points to NOT READY features documented
- [ ] All external accounts created and credentials collected
- [ ] Supabase dashboard: pg_cron enabled, pg_net enabled, Google auth configured
- [ ] Single domain chosen and documented

---

## Phase 1: Infrastructure & Secrets (2-3 hours)

**Goal:** Get the live Supabase instance fully configured so all backend systems can function.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 1 and CLAUDE.md.

Execute these tasks in order. Verify each before moving to the next.

TASK 1: Apply all pending migrations
Run: npx supabase db push --linked
Verify all migrations 001-062 are synced: npx supabase migration list --linked

TASK 2: Deploy ALL edge functions (not just undeployed ones — redeploy everything)
Deploy every function in supabase/functions/ to ensure live versions match code:
npx supabase functions deploy <function-name> --project-ref woxlvhzgannzhajtjnke
Do this for ALL 31 functions. List each deployment result.

TASK 3: Set all secrets
Run:
npx supabase secrets set \
  ANTHROPIC_API_KEY=<I will provide> \
  STRIPE_SECRET_KEY=<I will provide> \
  STRIPE_WEBHOOK_SECRET=<I will provide> \
  STRIPE_PRICE_STARTER=<I will provide> \
  STRIPE_PRICE_PRO=<I will provide> \
  STRIPE_PRICE_HANDS_OFF=<I will provide> \
  SENDGRID_API_KEY=<I will provide> \
  SENDGRID_FROM_EMAIL=<I will provide> \
  TWILIO_ACCOUNT_SID=<I will provide> \
  TWILIO_AUTH_TOKEN=<I will provide> \
  TWILIO_PHONE_NUMBER=<I will provide> \
  DATA_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  CRON_SECRET=$(openssl rand -hex 32) \
  --project-ref woxlvhzgannzhajtjnke

(I will paste my actual keys when you're ready for this step.)

TASK 4: Fix environment configuration
- Search entire codebase for domain references. Every instance of 'usecasa.com.au', 
  'casagroup.au', or any domain that isn't 'casapm.com.au' must be updated to use 
  the single production domain: casapm.com.au
- Fix eas.json: Replace placeholder TEAM_ID with <I will provide>
- Fix eas.json: Replace placeholder ascAppId values with real App Store Connect IDs 
  <I will provide>
- Fix app.json: Ensure all deep link schemes are correct (casa-owner:// for owner, 
  casa-tenant:// for tenant)

TASK 5: Verify the heartbeat system
- Confirm pg_cron job exists for agent-heartbeat (check via SQL: SELECT * FROM cron.job)
- Confirm private.cron_config table has service_role_key populated
- Manually invoke the agent-heartbeat function and check logs for successful execution
- If the heartbeat fails, diagnose and fix the issue

TASK 6: Fix the maintenance storage bucket
- Change the maintenance bucket from public=true to public=false
- Add appropriate RLS policies for authenticated users who own the related property
```

### Phase 1 Verification:
- [ ] All 62 migrations applied (`npx supabase migration list --linked` shows all synced)
- [ ] All 31 functions deployed and ACTIVE (`npx supabase functions list`)
- [ ] All secrets set (`npx supabase secrets list` shows all keys present)
- [ ] Single domain used throughout codebase (search confirms no stale references)
- [ ] eas.json has real Team ID and App IDs
- [ ] Heartbeat cron job exists and executes successfully
- [ ] Maintenance bucket is private with proper RLS

---

## Phase 2: Critical Fixes — Security & Core Functionality (4-6 hours)

**Goal:** Fix every bug that would cause the app to break, leak data, or lose user trust in the first 5 minutes of use.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 2 and CLAUDE.md.

Fix these issues in priority order. For each fix, show me the before/after 
and explain what you changed. Do not batch fixes — complete and verify each 
one before moving to the next.

CRITICAL FUNCTIONALITY FIXES (the app is broken without these):

1. BUILD DEEP LINK LISTENER FOR OAUTH CALLBACK
   Both apps need Linking.addEventListener('url') in _layout.tsx to catch 
   casa-owner://auth/callback and casa-tenant://auth/callback redirects.
   Without this, Google OAuth silently fails — user taps Google, browser opens, 
   auth succeeds, but app never catches the redirect.
   Files: apps/owner/app/_layout.tsx, apps/tenant/app/_layout.tsx
   Test: Simulate a deep link URL and verify the handler fires.

2. FIX approveAction TO TRIGGER SERVER-SIDE TOOL EXECUTION
   useAgentChat.approveAction() currently only updates agent_messages.action_status 
   to 'approved' in the database but never calls the agent-chat edge function to 
   actually execute the approved tool. This means when a user approves an AI-suggested 
   action, nothing actually happens. This is the core interaction loop of the product.
   Files: packages/api/src/hooks/useAgentChat.ts, supabase/functions/agent-chat/index.ts
   Test: Approve a pending action → verify tool executes → verify result appears in chat.

3. FIX ONBOARDING RACE CONDITION
   If profile is null during the onboarding check in apps/owner/app/(app)/_layout.tsx, 
   user bypasses onboarding entirely. Treat null profile as "needs onboarding."
   Files: apps/owner/app/(app)/_layout.tsx
   Test: Clear profile data → verify onboarding gate activates.

4. FIX REPORT GENERATION FAILURE HANDLING
   useReports.ts marks reports as status: 'completed' when the generate-report Edge 
   Function fails. This means users see "completed" reports that were never generated.
   Change to status: 'failed' with a user-visible error message.
   Files: packages/api/src/hooks/useReports.ts
   Test: Simulate a function failure → verify status shows 'failed'.

SECURITY FIXES (data safety):

5. FIX ALL 4 OWNERSHIP BYPASSES IN TOOL HANDLERS
   - cancel_inspection: Remove fallback that drops owner_id filter (lines 647-662)
   - resolve_arrears: Add ownership check via property → user join (lines 922-930)
   - log_arrears_action: Add ownership check (lines 932-946)
   - record_maintenance_cost: Add ownership check (lines 532-547)
   Files: supabase/functions/_shared/tool-handlers-actions.ts
   For each fix: verify the ownership check joins through property to user.id.

6. RESTRICT EMAIL AND PUSH RECIPIENTS
   - send_email_sendgrid: Validate recipient email belongs to a tenant/owner 
     associated with the user's properties
   - send_push_expo: Validate target user_id is a tenant of one of the user's properties
   Files: supabase/functions/_shared/tool-handlers-generate.ts

7. FIX RLS ON folder_templates AND lease_templates
   Both tables have RLS enabled but no policies — effectively blocks ALL access.
   Add read-only policies for authenticated users.
   Files: New migration file

8. FIX send-compliance-reminders PUSH TOKEN BUG
   Function queries profiles.push_token but tokens are in the push_tokens table.
   Fix to join against push_tokens.
   Files: supabase/functions/send-compliance-reminders/index.ts

RATE LIMITING & TIER ENFORCEMENT (cost protection):

9. ADD RATE LIMITING TO agent-chat EDGE FUNCTION
   Implement per-user rate limiting: 30 messages per 15-minute window.
   Use a simple database counter (INSERT with timestamp, COUNT where timestamp > 
   NOW() - interval '15 minutes'). Return a friendly error: "You've sent a lot of 
   messages recently. Please wait a few minutes."
   Files: supabase/functions/agent-chat/index.ts

10. ADD SERVER-SIDE SUBSCRIPTION TIER ENFORCEMENT
    Before executing tools in agent-chat, check user's subscription_tier.
    Create a TIER_TOOL_ACCESS map that defines which tool categories each tier 
    can access. Starter gets: all query tools, basic maintenance, basic chat.
    Pro adds: inspections, advanced maintenance, communications.
    Hands Off adds: autonomous execution, all tools.
    When a user tries to use a tool above their tier, the agent should respond 
    naturally: "That feature is available on the Pro plan. Would you like to 
    learn about upgrading?"
    Files: supabase/functions/agent-chat/index.ts

UX FIXES (trust and polish):

11. ADD ERROR STATES TO HOME DASHBOARD AND PORTFOLIO
    Both screens show nothing on data fetch failure. Add error UI with a retry 
    button. Use the app's design system (BRAND-AND-UI.md) for styling.
    Files: apps/owner/app/(app)/(tabs)/index.tsx, portfolio components

12. FIX CHAT ERROR TAP BEHAVIOUR
    Error bar tap in chat creates a new conversation instead of dismissing the error.
    Files: apps/owner/app/(app)/(tabs)/chat.tsx

13. ADD KeyboardAvoidingView TO LISTING CREATION
    Keyboard covers form inputs on smaller screens.
    Files: apps/owner/app/(app)/listings/create.tsx

14. CREATE notification-icon.png ASSET
    Generate a 96x96 notification icon from the existing app icon for Android.
    Files: apps/owner/assets/

After completing all fixes, run: pnpm typecheck
Report any TypeScript errors and fix them.
```

### Phase 2 Verification:
- [ ] OAuth deep link handler exists in both apps and correctly parses tokens
- [ ] approveAction triggers server-side tool execution (test with real action)
- [ ] Onboarding gate works correctly when profile is null
- [ ] Failed reports show 'failed' status, not 'completed'
- [ ] All 4 ownership bypasses fixed with proper user join checks
- [ ] Email/push recipients validated against user's properties
- [ ] folder_templates and lease_templates have working RLS policies
- [ ] Compliance reminders query push_tokens table correctly
- [ ] Rate limiting prevents >30 messages per 15 minutes per user
- [ ] Agent refuses tier-locked tools with friendly upgrade message
- [ ] Dashboard and portfolio show error states with retry on fetch failure
- [ ] Chat error tap dismisses error (doesn't create new conversation)
- [ ] Listing creation form has KeyboardAvoidingView
- [ ] notification-icon.png exists at correct path
- [ ] `pnpm typecheck` passes clean

---

## Phase 3: Feature Gating & Cohesion (3-4 hours)

**Goal:** Every NOT READY feature from the Phase 0 audit gets a clean gate. Every FIXABLE feature gets fixed. The app feels intentionally scoped, not accidentally broken.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 3 and CLAUDE.md and BRAND-AND-UI.md.

This phase has two jobs: gate unfinished features and build the upgrade paywall.

JOB 1: BUILD THE COMING SOON COMPONENT

Create a reusable ComingSoon component that can be dropped into any screen. It should:
- Display the Casa logo/icon mark
- Show a title: "Coming Soon" 
- Show a customisable subtitle explaining what the feature will do
- Include an optional "Notify Me" button (stores interest in local state for now)
- Follow the design system exactly: Casa Navy (#1B1464), canvas background (#FAFAFA),
  the warm/confident/premium brand voice
- Feel intentional and polished — like a feature preview, not an error page
- Include a back button or be dismissable

Files: packages/ui/src/components/ComingSoon.tsx

JOB 2: BUILD THE UPGRADE PROMPT COMPONENT

Create a reusable UpgradePrompt component for feature gating. It should:
- Accept props: currentTier, requiredTier, featureName, featureDescription
- Show the user's current tier
- Show what tier is needed and what it costs
- Include a "View Plans" CTA that navigates to the subscription screen
- Follow the design system: premium feel, not aggressive or salesy
- The tone should be: "This powerful feature is available on [tier]" not 
  "UPGRADE NOW TO UNLOCK"

Files: packages/ui/src/components/UpgradePrompt.tsx

JOB 3: GATE ALL NOT READY FEATURES

Using the GATE LIST from the Phase 0 audit, intercept EVERY entry point to every 
NOT READY feature. This means:

For each NOT READY feature:
1. Find every button, nav item, list item, or link that leads to it
2. Replace the navigation with either:
   a. The ComingSoon component (if the screen itself is the entry point)
   b. A redirect to ComingSoon (if it's a button that pushes a route)
   c. Hiding the entry point entirely (if removing it doesn't leave a visual gap)
3. CRITICAL: Also check if any agent tools reference NOT READY features. 
   If the agent can suggest actions that lead to gated features, update the 
   agent's system prompt to exclude those capabilities from its self-description.

The following features are KNOWN to need gating based on the backend audit 
(your Phase 0 audit may reveal more):

- Listing syndication to Domain/REA (integrationStub)
- Credit checks / TICA checks (integrationStub)  
- Bond lodgement with state authority (integrationStub)
- DocuSign document signing (integrationStub)
- hipages trade search (integrationStub)
- Agent-initiated Stripe rent collection (integrationStub)
- Agent-initiated Stripe refunds (integrationStub)

For each of these: the agent must NOT try to use these tools. Update the tool 
registry or the agent's system prompt to remove or clearly mark these tools as 
unavailable. When a user asks about these capabilities, the agent should say:
"That feature is coming soon. For now, here's how you can handle this manually: 
[provide helpful workaround]."

JOB 4: ENFORCE FEATURE GATING ON ALL TIER-LOCKED SCREENS

The useFeatureGate hook exists but is only called in 2 places. Add gate checks to:

- Property creation: Starter users limited to maxProperties (check TIER_FEATURES)
  → Show UpgradePrompt when at limit
- Tenant finding features: Starter cannot access → Show UpgradePrompt
- Professional inspections: Starter cannot access → Show UpgradePrompt  
- Advanced lease management: Starter gets 'basic', Pro+ gets 'full' → Gate advanced features
- Advanced communications: Starter gets 'basic' → Gate bulk messaging, custom templates
- Arrears auto-management: Starter cannot access → Show UpgradePrompt
- Autonomy level settings: Starter can only set L0-L1, Pro L0-L2, Hands Off L0-L4
  → Cap the selector and show UpgradePrompt for higher levels

For each gate: add BOTH client-side (UpgradePrompt) AND server-side (agent-chat 
tier check from Phase 2) enforcement.

JOB 5: VERIFY NO DEAD ENDS EXIST

Walk through every screen in both apps as if you are a new user on the Starter tier.
Tap every button. Follow every link. Open every menu item. Report any screen that:
- Shows a blank/empty state with no explanation
- Navigates to a screen that doesn't exist (404-type behaviour)
- Shows a loading spinner that never resolves
- Shows a raw error message instead of a friendly error state
- Leads to a half-built form with missing fields or non-functional buttons

Fix each one: either complete the screen, show ComingSoon, or show a proper empty state.
```

### Phase 3 Verification:
- [ ] ComingSoon component exists, follows design system, looks polished
- [ ] UpgradePrompt component exists, shows correct tier info, navigates to plans
- [ ] Every NOT READY feature is gated — no entry point leads to broken functionality
- [ ] Agent tools for stubbed integrations are disabled or handled gracefully
- [ ] Feature gating enforced on all tier-locked screens (7+ screens updated)
- [ ] Full app walkthrough on Starter tier reveals zero dead ends
- [ ] Full app walkthrough on Pro tier reveals zero dead ends
- [ ] `pnpm typecheck` passes clean

---

## Phase 4: Stripe & Payment Flows (2-3 hours)

**Goal:** Users can subscribe to a plan and the app correctly gates features based on their active subscription.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 4 and CLAUDE.md.

TASK 1: VERIFY STRIPE INTEGRATION END-TO-END
The Stripe Edge Functions exist (manage-subscription, stripe-webhook, 
create-payment-intent, create-connect-account). Secrets are configured from Phase 1.

Test the full subscription flow:
1. User taps "Subscribe" on a plan → manage-subscription creates a Stripe 
   Checkout Session with the correct price ID
2. User completes payment in Stripe → webhook fires → user's subscription_tier 
   updates in the profiles table
3. Feature gates immediately reflect the new tier
4. User can upgrade/downgrade → subscription updates correctly
5. User can cancel → tier reverts to 'starter' (or free tier)

If any step fails, fix it. Common issues:
- Price IDs not mapping correctly to tier names
- Webhook not verifying Stripe signature properly
- Subscription status not syncing back to profiles table
- The manage-subscription dev fallback (direct DB write) is still active — 
  REMOVE this for production. Stripe must be the source of truth.

TASK 2: FIX TENANT PAYMENT METHOD ADDITION
The tenant app's payments/methods/add.tsx shows an Alert("Stripe Integration Required") 
and navigates back. Replace this stub with a real Stripe SetupIntent flow using the 
existing create-setup-intent edge function.

Files: apps/tenant/app/(app)/payments/methods/add.tsx

TASK 3: BUILD SUBSCRIPTION SELECTION INTO ONBOARDING
After signup, users need to see available plans and select one. This should be part 
of the onboarding flow — either as a dedicated step or integrated into the existing 
onboarding screens. Default to Starter (free trial or immediate billing — match 
whatever Stripe is configured for).

TASK 4: VERIFY WEBHOOK SECURITY
- Stripe webhook verifies signature using STRIPE_WEBHOOK_SECRET
- Webhook endpoint is not accessible without valid Stripe signature
- Failed webhook attempts are logged

After completing all tasks, test with Stripe test mode:
- Create a test subscription using a Stripe test card (4242 4242 4242 4242)
- Verify the webhook fires and tier updates
- Verify feature gates change immediately
```

### Phase 4 Verification:
- [ ] Subscription creation works end-to-end with real Stripe test cards
- [ ] Webhook correctly updates subscription_tier in profiles
- [ ] Feature gates update immediately when tier changes
- [ ] Upgrade and downgrade flows work correctly
- [ ] Cancel flow reverts to starter tier
- [ ] Tenant can add a real payment method via SetupIntent
- [ ] Manage-subscription dev fallback is removed
- [ ] Webhook validates Stripe signatures

---

## Phase 5: Email, SMS & Notification Pipeline (2-3 hours)

**Goal:** When the app needs to notify someone, the notification actually arrives.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 5 and CLAUDE.md.

TASK 1: VERIFY EMAIL DELIVERY
The send-email Edge Function uses SendGrid with 5 HTML templates. Secrets are 
configured from Phase 1.
- Trigger each email template type and verify delivery
- Check that FROM address matches the verified SendGrid sender
- Check that email links use the correct production domain (casapm.com.au)
- Check that unsubscribe links work

TASK 2: VERIFY SMS DELIVERY  
The dispatch-notification Edge Function uses Twilio for SMS.
- Trigger an SMS notification and verify delivery
- Verify the FROM number matches the configured Twilio number
- Verify that if Twilio credentials are missing, the failure is logged 
  (not silently swallowed) and the user gets a fallback (push or email)

TASK 3: VERIFY PUSH NOTIFICATIONS
- Verify push token registration works (usePushToken.ts)
- Trigger a push notification and verify delivery on a real device
- Verify notification preferences are respected (should_notify RPC)
- Verify the dispatch-notification function correctly tries all channels 
  (push → email → SMS) based on user preferences

TASK 4: VERIFY THE EMAIL QUEUE
- process-email-queue should process queued emails in batches with retry logic
- Trigger multiple emails and verify the queue processes them
- Simulate a failure and verify retry with backoff works (3 attempts)

TASK 5: WIRE UP CRITICAL NOTIFICATION TRIGGERS
These notifications must fire automatically (no user action required after setup):

a) MAINTENANCE REQUEST SUBMITTED → Notify landlord via push + email
   Verify: Tenant submits maintenance → landlord gets notification within 60 seconds

b) RENT REMINDER → Notify tenant when rent is approaching due date
   Verify: The heartbeat/cron system sends reminders at the configured interval

c) LEASE EXPIRY WARNING → Notify landlord when lease is approaching expiry
   Verify: The heartbeat detects upcoming lease expiry and alerts landlord

If any of these triggers don't work because the heartbeat isn't executing the 
relevant scanner, fix the heartbeat to include them. The heartbeat doesn't need 
to be AI-powered for launch — procedural if/else triggers are fine. What matters 
is that notifications actually fire.

After all tasks, send a test email, SMS, and push notification and verify all three arrive.
```

### Phase 5 Verification:
- [ ] Email delivery works for all 5 template types
- [ ] SMS delivery works via Twilio
- [ ] Push notifications arrive on real device
- [ ] Email queue processes with retry logic
- [ ] Maintenance submission triggers landlord notification
- [ ] Rent reminders fire at configured intervals
- [ ] Lease expiry warnings fire at configured intervals
- [ ] Notification preferences are respected
- [ ] All emails use correct domain in links
- [ ] Failed notifications have fallback to other channels

---

## Phase 6: Tenant App Completion (2-3 hours)

**Goal:** The tenant app is a complete, usable experience for tenants — not a broken appendage of the owner app.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 6 and CLAUDE.md and BRAND-AND-UI.md.

TASK 1: CREATE TENANT SETTINGS HUB
Build apps/tenant/app/(app)/settings/index.tsx — entry point for all tenant settings.
Include: profile editing, notification preferences, security (password change), 
about/help link. Follow the design system.

TASK 2: REGISTER MISSING ROUTES
Add Stack.Screen entries in tenant _layout.tsx for: documents, notifications, 
and all settings sub-routes. Every nav item in the tenant app must lead somewhere real.

TASK 3: BUILD TENANT ONBOARDING
New tenants need a minimal onboarding flow:
- Welcome screen explaining what Casa is
- Connect to tenancy (via connection code from landlord)
- Set notification preferences
- Done → land on home screen

This should be gated: if tenant has no active tenancy, show onboarding. 
If they have an active tenancy, skip to home.

TASK 4: BUILD TENANT SUPPORT SCREENS
Create basic support screens: 
- Help/FAQ with common tenant questions (hardcoded content is fine for launch)
- Simple contact form that creates a support ticket in the database
If the support_tickets table doesn't exist, create it via migration.

TASK 5: APPLY COMING SOON GATES TO TENANT APP
Any tenant feature that doesn't work end-to-end gets the ComingSoon component.
Walk through the tenant app exhaustively and gate anything broken.

TASK 6: FULL TENANT APP WALKTHROUGH
Walk through the complete tenant experience:
- Sign up as new tenant
- Complete onboarding
- Connect to a tenancy
- View tenancy details
- View rent schedule
- Submit maintenance request
- Chat with agent
- View inspections
- Access settings
- Access support

Report and fix every issue found.
```

### Phase 6 Verification:
- [ ] Settings hub exists with working sub-screens
- [ ] All routes registered — no missing Stack.Screen errors
- [ ] New tenant onboarding flow works end-to-end
- [ ] Support screens exist with FAQ and ticket submission
- [ ] All broken tenant features gated with ComingSoon
- [ ] Complete tenant walkthrough passes with zero dead ends

---

## Phase 7: Agent Intelligence & Proactive Behaviour (3-4 hours)

**Goal:** The AI agent feels like a property manager, not a chatbot. It proactively mentions things that need attention, handles conversations intelligently, and gracefully acknowledges what it can't yet do.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 7 and CLAUDE.md and specs/AGENT-ARCHITECTURE.md.

This phase is NOT about building the full agent-orchestrator or the autonomous 
agentic loop. That's post-launch work. This phase is about making the EXISTING 
agent-chat experience excellent.

TASK 1: UPDATE THE AGENT'S SYSTEM PROMPT FOR LAUNCH REALITY

The agent's system prompt in agent-chat/index.ts needs to accurately reflect 
what the app can and cannot do at launch. Update it to:

a) Clearly state its current capabilities:
   - Answer questions about properties, tenants, leases, payments, maintenance
   - Help triage and coordinate maintenance requests
   - Provide compliance information and reminders
   - Draft communications to tenants
   - Provide financial summaries and reports
   - Help with inspections and scheduling

b) Clearly state what's coming soon (so it doesn't promise and fail):
   - Listing syndication to Domain/REA (coming soon, here's how to do it manually)
   - Automated credit/TICA checks (coming soon, here's how to request one)
   - DocuSign document signing (coming soon, use email/print for now)
   - Bond lodgement (coming soon, here's the state authority link)
   - hipages trade search (coming soon, I can help you find a trade manually)
   - Automated rent collection via Stripe (coming soon, use manual payment tracking)

c) Set the right personality: professional, warm, quietly competent. 
   Use first person ("I'll look into that"). Refer to landlords and tenants by name. 
   Never say "I'm just an AI" — say "I" and act like a capable property manager 
   who happens to have some features still in development.

d) When the user asks about something that's gated/coming soon, provide a HELPFUL 
   WORKAROUND, not just "that's not available yet." Example: "I can't syndicate 
   your listing to Domain automatically yet, but I can draft the listing content 
   for you to copy into Domain's portal. Want me to do that?"

TASK 2: ADD PROACTIVE CONTEXT TO CHAT OPENING

When a user opens the chat (new conversation), the agent should start with a 
contextual greeting that shows it's aware of their property situation. This is 
powered by the existing buildSystemPrompt which already loads property context.

The agent's first message should include relevant proactive observations:
- "Welcome back, Robbie. I've noticed a few things across your portfolio:"
- "Sarah's lease at 42 Smith St expires in 58 days — want me to start the renewal process?"
- "There's an open maintenance request (leaking tap) from 3 days ago — would you like me to help coordinate a plumber?"
- "Rent from your tenants at 15 Jones Rd is due in 4 days."

This should feel like an executive assistant giving you a morning briefing, 
not a bot listing database queries. Only mention things that need attention — 
if everything is fine, say "Everything looks good across your properties. 
How can I help?"

IMPORTANT: This is generated by the agent-chat function when starting a new 
conversation, NOT by a separate orchestrator. It uses the same context that 
buildSystemPrompt already loads.

TASK 3: VERIFY AGENT TOOL EXECUTION LOOP

Test the complete agent interaction loop:
1. User asks "What maintenance requests are open?"
   → Agent calls get_maintenance tool → returns real data → formats response
2. User asks "Schedule an inspection for 42 Smith St"
   → Agent proposes action → waits for approval → user approves → 
   tool executes (Phase 2 fix) → result confirmed
3. User asks "Draft a message to Sarah about the rent increase"
   → Agent generates a draft → presents it → user approves → message sent
4. User asks about a gated feature (e.g., "Run a credit check on this applicant")
   → Agent explains it's coming soon → offers manual workaround

Fix any issues found during testing.

TASK 4: VERIFY AGENT HANDLES EDGE CASES

Test these scenarios:
- User sends empty message → graceful handling
- User sends very long message → no truncation errors
- User sends rapid messages → rate limiting kicks in with friendly message
- Agent tool call fails → agent acknowledges the error and suggests alternatives
- User on Starter tries Pro feature via agent → tier enforcement message
- Network timeout during agent response → proper error state in UI
```

### Phase 7 Verification:
- [ ] Agent system prompt accurately reflects launch capabilities
- [ ] Agent provides helpful workarounds for gated features
- [ ] New conversations start with proactive property observations
- [ ] Tool execution loop works: query → action proposal → approval → execution → result
- [ ] Agent handles edge cases gracefully (empty messages, rapid messages, failures)
- [ ] Agent personality feels warm, competent, professional
- [ ] Tier enforcement works conversationally through the agent

---

## Phase 8: TestFlight Build (2-3 hours)

**Goal:** Get both apps on real iPhones via TestFlight.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 8 and CLAUDE.md.

TASK 1: PRE-BUILD CHECKS
- Run: pnpm typecheck — fix any errors
- Run: pnpm build — fix any errors
- Verify app.json has correct:
  - Bundle identifiers (com.casa.owner, com.casa.tenant)
  - Version and buildNumber
  - Deep link schemes
  - All referenced assets exist (icons, splash screens, notification icon)
- Verify eas.json has correct:
  - Team ID
  - ascAppId for both apps
  - Build profiles (development, preview, production)

TASK 2: INITIALIZE EAS (if not already done)
cd apps/owner && npx eas init
cd apps/tenant && npx eas init

TASK 3: BUILD OWNER APP
cd apps/owner
npx eas build --platform ios --profile production

Wait for build to complete. If it fails, diagnose from build logs and fix.

TASK 4: BUILD TENANT APP  
cd apps/tenant
npx eas build --platform ios --profile production

TASK 5: SUBMIT TO TESTFLIGHT
cd apps/owner
npx eas submit --platform ios --profile production --latest

cd apps/tenant
npx eas submit --platform ios --profile production --latest

TASK 6: VERIFY TESTFLIGHT
- Both builds appear in App Store Connect → TestFlight
- Install via TestFlight on real iPhone
- Verify app launches and login works
```

### Phase 8 Verification:
- [ ] Both apps build successfully on EAS
- [ ] Both apps submitted to TestFlight
- [ ] Both apps installable via TestFlight
- [ ] Both apps launch and login works on real device

---

## Phase 9: Real-Device QA & Polish (1-2 days)

**Goal:** Every user journey works on a real iPhone. The app feels polished and trustworthy.

### Prompt for Claude Code:

```
Read LAUNCH-SPRINT.md Phase 9 and CLAUDE.md and BRAND-AND-UI.md.

I'm going to test the app on my real device and report bugs. For each bug I report:

1. Reproduce it from my description
2. Identify the root cause
3. Fix it
4. Tell me what you fixed and how to verify

Between bug reports, also work through this systematic test checklist.
For each item, verify it works and fix it if it doesn't:

OWNER APP — AUTHENTICATION
- [ ] Email/password signup → creates account → onboarding flow
- [ ] Email/password login → home screen
- [ ] Google OAuth login → deep link catches callback → home screen  
- [ ] Password reset flow → email arrives → reset works
- [ ] Logout → returns to login screen

OWNER APP — CORE EXPERIENCE
- [ ] Home dashboard loads real data with loading state
- [ ] Home dashboard shows error state with retry on failure
- [ ] Portfolio tab shows all properties
- [ ] Add property flow works end-to-end
- [ ] Property detail screen shows correct data
- [ ] Chat tab → new conversation → proactive greeting appears
- [ ] Send message → agent responds with real data
- [ ] Agent suggests action → approve → action executes
- [ ] Tasks tab shows agent tasks
- [ ] Task detail screen works

OWNER APP — PROPERTY MANAGEMENT
- [ ] Create maintenance request → appears in list
- [ ] Schedule inspection → confirmation shown
- [ ] View compliance status → shows real data
- [ ] Upload document → appears in documents list
- [ ] View financial summary → shows real data

OWNER APP — SUBSCRIPTION
- [ ] View available plans
- [ ] Subscribe with test card → tier updates
- [ ] Feature gates update immediately
- [ ] Upgrade/downgrade works

OWNER APP — SETTINGS
- [ ] Profile editing works
- [ ] Autonomy level selector works (capped by tier)
- [ ] Notification preferences save
- [ ] Agent rules display and save

TENANT APP — FULL JOURNEY
- [ ] Signup → onboarding → connect to tenancy
- [ ] View tenancy details
- [ ] View rent schedule  
- [ ] Submit maintenance request → appears in list
- [ ] Chat with agent
- [ ] View inspections
- [ ] Settings → all sub-screens work
- [ ] Support → FAQ and ticket submission work

CROSS-APP
- [ ] Owner creates property + adds tenant → tenant can connect
- [ ] Tenant submits maintenance → owner gets notification
- [ ] Owner sends message via agent → tenant receives it

VISUAL POLISH (check during all above testing)
- [ ] No screens with blank/white backgrounds that should have content
- [ ] All loading states use skeleton screens or branded spinners (not raw ActivityIndicator)
- [ ] All empty states have helpful messages (not blank screens)
- [ ] Keyboard doesn't cover inputs on any form
- [ ] Safe area insets look correct on different iPhone models
- [ ] Navigation back buttons work everywhere
- [ ] No images that fail to load (broken image placeholders)
- [ ] Dates display in Australian format (DD/MM/YYYY)
- [ ] Currency displays as AUD with $ symbol
- [ ] All text is readable (no text cut off, no overlapping)

After completing all items, run one more full typecheck:
pnpm typecheck
```

### Phase 9 Verification:
- [ ] Every checklist item passes
- [ ] All reported bugs fixed
- [ ] No crashes in 30 minutes of continuous use on real device
- [ ] App feels polished, cohesive, and trustworthy
- [ ] `pnpm typecheck` passes clean

---

## Phase 10: Launch Preparation (half day)

**Goal:** Everything ready for first users.

### Tasks for Robbie (not Claude Code):

1. **Create test accounts for Apple Review:**
   - One owner account with a property already set up
   - One tenant account connected to that property
   - Document credentials for App Store review notes

2. **App Store listing content:**
   - App Name: "Casa — AI Property Manager"
   - Subtitle: "Smart Property Management" (30 chars)
   - Description (4000 chars): Focus on AI agent, cost savings, Australian compliance
   - Keywords: property management, landlord, rental, AI, Australia, tenant, inspection, maintenance
   - Category: Finance (primary), Productivity (secondary)
   - Screenshots: Capture 6-10 key screens from the real app on your real device
     (Home, Chat with agent, Property detail, Inspection, Subscription plans, Maintenance)
   - Privacy Policy: Host at casapm.com.au/privacy

3. **Final OTA update:**
   After all Phase 9 fixes, push a final update:
   ```bash
   cd apps/owner && eas update --branch production
   cd apps/tenant && eas update --branch production
   ```

4. **Invite first users to TestFlight:**
   - Start with 5-10 landlords from Fin's network
   - Send personal invitation with a 2-sentence pitch and TestFlight link
   - Offer to help them set up their first property over a 15-minute call

---

## Post-Launch Queue (Build in this order after launch)

This is everything that was gated, deferred, or identified as post-launch during 
the sprint. It's ordered by impact. **Do not start these during the launch sprint.** 

### Post-Launch Week 1-2: User Feedback & Stability
- Fix every bug reported by first users (priority above all else)
- Watch AI agent conversations for confusion or failures — tune system prompt
- Monitor Anthropic API costs and optimise if needed
- Monitor Stripe webhook reliability

### Post-Launch Week 2-4: The Proactive Agent (L5.7)
This is the big architectural upgrade — replacing the procedural heartbeat with 
the intelligent agent-orchestrator. Build in this order:

1. **Extract agent-core.ts** — Shared pipeline from agent-chat (buildSystemPrompt, 
   autonomy gating, confidence scoring, tool execution)
2. **Build agent-orchestrator Edge Function** — Agentic loop that reviews each 
   property with full context and decides what actions to take using Claude
3. **Add DB triggers for instant events** — maintenance submitted, payment received, 
   tenancy created, inspection completed → immediate AI triage
4. **Build workflow engine** — agent_workflows table + multi-step workflow tracking 
   (lease renewal, arrears escalation, maintenance lifecycle)
5. **Add event store** — agent_events table for full audit trail of autonomous decisions
6. **Implement model routing** — Haiku for routine, Sonnet for complex, with prompt 
   caching and batch API for cost control

### Post-Launch Month 2-3: Integration Sprint
- Stripe Connect for automated rent collection (agent-initiated)
- Trade procurement: simple trade directory (not hipages integration — build your own)
- Condition reports with AI photo comparison
- Document generation for standard notices (rent increase, lease renewal, Form 12/13)

### Post-Launch Month 3-4: Scale Features
- Listing syndication (Domain.com.au API — requires partnership)
- Credit check / TICA integration (requires business verification)
- DocuSign or similar e-signature integration
- Bond lodgement automation (state-specific)
- Self-serve Casa Intelligence tier ($1,500-3,000 instant feasibility reports)

### Post-Launch Month 4-6: Platform Maturity
- Android app launch (Google Play)
- MFA enforcement for Hands Off tier
- Advanced financial reporting and tax summaries
- Tenant portable rental history
- Maintenance marketplace (trade matching)
- State expansion beyond Queensland

---

## Tools & Commands Quick Reference

### Daily Development
```bash
# Run both apps for testing
cd apps/owner && npx expo start --port 8081 --tunnel --clear &
cd apps/tenant && npx expo start --port 8082 --tunnel --clear &

# Type checking
pnpm typecheck

# Run tests
pnpm test

# Full build verification
pnpm typecheck && pnpm test && pnpm build
```

### Supabase
```bash
# Apply migrations
npx supabase db push --linked

# Deploy a function
npx supabase functions deploy <name> --project-ref woxlvhzgannzhajtjnke

# Deploy ALL functions
for dir in supabase/functions/*/; do
  name=$(basename "$dir")
  [[ "$name" == "_shared" ]] && continue
  npx supabase functions deploy "$name" --project-ref woxlvhzgannzhajtjnke
done

# View function logs
npx supabase functions logs <name> --project-ref woxlvhzgannzhajtjnke

# Set secrets
npx supabase secrets set KEY=value --project-ref woxlvhzgannzhajtjnke

# List migration status
npx supabase migration list --linked

# List functions status
npx supabase functions list --project-ref woxlvhzgannzhajtjnke
```

### EAS (Expo Application Services)
```bash
# Build for TestFlight
cd apps/owner && npx eas build --platform ios --profile production
cd apps/tenant && npx eas build --platform ios --profile production

# Submit to TestFlight
cd apps/owner && npx eas submit --platform ios --profile production --latest
cd apps/tenant && npx eas submit --platform ios --profile production --latest

# OTA update (no app store review needed)
cd apps/owner && eas update --branch production
cd apps/tenant && eas update --branch production
```

### Git
```bash
# Before each phase, create a branch
git checkout -b launch/phase-X

# After each phase passes verification
git add -A
git commit -m "Launch Phase X: [description]"
git checkout main
git merge launch/phase-X
git push origin main
```

---

## The Rule

If a feature doesn't work perfectly, gate it. If a system isn't configured, configure it. If a flow has a dead end, close it. 

The app that launches on February 20 must do fewer things than what you've built — but everything it does must work flawlessly. That's what earns trust. Trust earns the second month of subscription. The second month earns the third. 

Ship what works. Gate what doesn't. Launch.
