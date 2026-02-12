# Casa Launch Guide — For Any Claude Agent

> **Purpose:** This document is the single entry point for any Claude agent working on the Casa launch. It tells you what to read, in what order, what to build, and how to verify your work. Follow it sequentially.
>
> **Goal:** Ship Casa to the App Store by 2026-02-19.

---

## How to Use This Guide

1. Read **Phase 0** (this page's context section) to understand what Casa is.
2. Read the **Required Documents** for your assigned mission.
3. Read the **Testing Methodology** section — understand the 3 test gates.
4. Execute the mission following the **Implementation Rules**.
5. Pass **Gate 1** continuously during implementation (`pnpm typecheck && pnpm test` after every change batch).
6. Pass **Gate 2** after implementation (full build + device testing + mission-specific checklist).
7. Pass **Gate 3** before moving on (full regression of all prior missions).
8. Run the **Global Verification** before marking anything complete.

**Do not skip steps. Do not skip tests. Do not defer work. Do not leave TODOs.**

---

## Phase 0: Context (Read This First)

Casa is an AI-powered property management app for Australian landlords. It replaces traditional property managers (~$4,000/year) with an intelligent app (~$600/year). Two React Native (Expo) apps (owner + tenant), backed by Supabase, with an AI agent powered by Anthropic Claude.

### Project Structure
```
propbot/
├── apps/owner/          # Owner mobile app (Expo SDK 54, Expo Router)
├── apps/tenant/         # Tenant mobile app
├── packages/api/        # Supabase client, hooks, types
├── packages/config/     # Theme, constants, tier features
├── packages/ui/         # Shared UI components
├── supabase/
│   ├── migrations/      # SQL migrations (001-062+)
│   └── functions/       # Edge Functions (31+)
├── specs/               # Architecture and mission documents
└── LAUNCH-MISSIONS.md   # Current state + what needs building
```

### Current State (Verified 2026-02-12)
- **7/7 packages** compile clean (TypeScript)
- **52 of 62** migrations applied to live DB
- **21 of 31** edge functions deployed
- **130 agent tools** implemented with autonomy gating
- **48 heartbeat scanners** (procedural, being replaced with agentic system)
- **4 critical bugs** and **7 security vulnerabilities** identified

---

## Document Reading Guide

### Documents Every Agent Must Read

| Priority | Document | Path | Why |
|----------|----------|------|-----|
| **1** | CLAUDE.md | `/CLAUDE.md` (345 lines) | Non-negotiable project rules, heuristics, patterns |
| **2** | Launch Missions | `/specs/LAUNCH-MISSIONS.md` (~800 lines) | Current state, what's done, what's broken, what to build |
| **3** | Brand & UI | `/BRAND-AND-UI.md` (585 lines) | Design system — every UI element must match this |

### Documents By Mission

Read **only** the documents relevant to your assigned mission. Don't read everything — it wastes context.

#### L1: Infrastructure
| Document | Path | Read Sections |
|----------|------|---------------|
| Supabase Spec | `/SUPABASE-SPEC.md` | CLI commands, migration workflow, secrets |
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | L1 section |

#### L2: Bug Fixes & Security
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | Known Bugs, Security Vulnerabilities, L2 section |
| Agent Architecture | `/specs/AGENT-ARCHITECTURE.md` | Autonomy levels, tool system (for understanding approveAction fix) |

**Key source files to read before editing:**
- `packages/api/src/hooks/useAgentChat.ts` — approveAction bug
- `supabase/functions/agent-chat/index.ts` — rate limiting, tier enforcement
- `supabase/functions/_shared/tool-handlers-actions.ts` — ownership bypasses
- `supabase/functions/_shared/tool-handlers-generate.ts` — email/push restrictions
- `apps/owner/app/_layout.tsx` — deep link listener
- `apps/owner/app/(app)/_layout.tsx` — onboarding race condition
- `apps/owner/app/(app)/(tabs)/chat.tsx` — error tap behavior

#### L2.5: Feature Gating
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | Feature Gating Gaps, L2.5 section |
| Config | `/packages/config/index.ts` | `TIER_FEATURES` definition (lines ~174-211) |

**Key source files:**
- `packages/api/src/hooks/useFeatureGate.ts` — existing hook (use this pattern)
- `apps/owner/app/(app)/autonomy.tsx` — autonomy settings screen

#### L3: Google OAuth
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | L3 section (has client ID/secret) |
| Auth Mission | `/specs/ralph-missions/MISSION-02-auth-profiles.md` | OAuth flow, profile creation |

**Key source files:**
- `packages/api/src/hooks/useAuth.tsx` — signInWithOAuth implementation
- `apps/owner/app/(auth)/login.tsx` — Google button implementation
- `apps/owner/app/(auth)/signup.tsx` — signup flow

#### L4: Stripe Billing
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | L4 section |
| Rent Collection Mission | `/specs/ralph-missions/MISSION-07-rent-collection.md` | Stripe Connect architecture |

**Key source files:**
- `supabase/functions/manage-subscription/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/create-payment-intent/index.ts`

#### L5: Email & SMS
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | L5 section |
| Notifications Mission | `/specs/ralph-missions/MISSION-17-notifications.md` | Email/SMS architecture |

**Key source files:**
- `supabase/functions/dispatch-notification/index.ts`
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/_shared/notification-templates.ts`
- `supabase/functions/_shared/sendgrid.ts`

#### L5.5: Tenant App
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | Tenant App Gaps, L5.5 section |
| Brand & UI | `/BRAND-AND-UI.md` | Component specs, layout patterns |

**Key source files:**
- `apps/tenant/app/(app)/_layout.tsx` — missing route registrations
- `apps/tenant/app/(app)/payments/methods/add.tsx` — Stripe stub to replace

#### L5.7: Agentic Property Management (THE BIG ONE)
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | Honest Assessment, L5.7 section (full architecture) |
| Agent Architecture | `/specs/AGENT-ARCHITECTURE.md` | Full document — autonomy, tools, learning |
| AI Orchestrator Mission | `/specs/ralph-missions/MISSION-14-ai-orchestrator.md` | Agent design, tool system, heartbeat |
| Learning Mission | `/specs/ralph-missions/MISSION-15-learning-compliance.md` | Learning pipeline, corrections, rules |

**Key source files (read ALL of these before writing code):**
- `supabase/functions/agent-chat/index.ts` — THE reference implementation. The agentic loop, buildSystemPrompt, confidence scoring, autonomy gating — all of this must be understood before building agent-orchestrator.
- `supabase/functions/agent-heartbeat/index.ts` — The current procedural heartbeat being replaced. Understand what the 48 scanners detect so the new system covers the same ground.
- `supabase/functions/_shared/tool-dispatcher.ts` — How tools are dispatched
- `supabase/functions/_shared/tool-registry.ts` — All 130 tool definitions
- `supabase/functions/_shared/tool-handlers.ts` — Query tool implementations
- `supabase/functions/_shared/tool-handlers-actions.ts` — Action tool implementations
- `supabase/functions/_shared/tool-handlers-generate.ts` — Generate tool implementations
- `supabase/functions/agent-learning/index.ts` — Learning pipeline

**Architecture summary for L5.7:**
1. Extract shared agent logic from agent-chat into `_shared/agent-core.ts`
2. Build `agent-orchestrator` edge function that uses Claude Haiku to review each property with full context and decide what actions to take (using the same tool system as agent-chat)
3. Add DB triggers for instant events (payment, maintenance, tenancy, inspection lifecycle)
4. Add workflow engine for multi-step processes (lease renewal, arrears escalation, etc.)
5. Add event store for audit trail of every autonomous decision
6. Wire tiered cron jobs (instant/daily/weekly/monthly)

#### L6: TestFlight
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | L6 section |
| Launch Prep Mission | `/specs/ralph-missions/MISSION-20-launch-preparation.md` | Build process, submission |

**Key source files:**
- `apps/owner/eas.json` — needs real Apple Team ID + ascAppId
- `apps/owner/app.json` — needs valid EAS project ID + notification icon

#### L7: QA & Polish
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | L7 full test checklist |
| Testing Methodology | `/specs/TESTING-METHODOLOGY.md` | Regression testing approach |
| Brand & UI | `/BRAND-AND-UI.md` | Visual verification reference |

#### L8: App Store Submission
| Document | Path | Read Sections |
|----------|------|---------------|
| Launch Missions | `/specs/LAUNCH-MISSIONS.md` | L8 section |
| Launch Prep Mission | `/specs/ralph-missions/MISSION-20-launch-preparation.md` | App Store requirements |

---

## Implementation Rules

These are non-negotiable. They come from `/CLAUDE.md` and are repeated here for emphasis.

### 1. No Mock Data
Never create fake data. If a screen needs data, build the real pipeline. The ONLY exception is test files.

### 2. No TODOs
If it's hard, solve it now. `// TODO` is not acceptable.

### 3. No Deferrals
Every mission must be 100% complete. "We'll add this later" is not allowed.

### 4. Fix Every Error You Find
If you discover a bug while working on something else, fix it.

### 5. Rise to the Level of Testing
Never modify a test to make code pass. Never skip tests.

### 6. Design System Compliance
Every UI element must use `THEME` from `@casa/config`. Never use raw color values, font sizes, or spacing values.

```typescript
import { THEME } from '@casa/config';
// Use: THEME.colors.brand, THEME.colors.canvas, THEME.spacing.md, etc.
```

### 7. Supabase Patterns
```typescript
import { getSupabaseClient } from '@casa/api';
const supabase = getSupabaseClient();
```

### 8. Navigation
```typescript
import { router } from 'expo-router';
router.push('/(app)/(tabs)/chat');
// File-based routing via Expo Router
```

### 9. Feature Gating
```typescript
import { useFeatureGate } from '@casa/api';
const { hasAccess, requiredTier } = useFeatureGate(profile, 'tenantFinding');
```

---

## Mission Execution Order

### Critical Path (sequential — each blocks the next)
```
L1 → L2 → L2.5 → L5.7 → L6 → L7 → L8
```

### Parallel Track (can run alongside critical path)
```
L3 (needs owner: Google Cloud Console config)
L4 (needs owner: Stripe account + keys)
L5 (needs owner: SendGrid + Twilio accounts)
L5.5 (needs L2 complete)
```

### What Can Start Immediately (no owner action needed)
- **L1**: Apply migrations, deploy functions, generate encryption key
- **L2**: All 15 bug/security fixes
- **L2.5**: UpgradePrompt component, feature gate enforcement
- **L5.5**: Tenant settings hub, route registration, support screens, onboarding
- **L5.7**: agent-core extraction, agent-orchestrator, DB triggers, workflows, event store

### What Needs Owner Action First
- **L3**: Owner must configure Google OAuth in Google Cloud Console + Supabase Dashboard
- **L4**: Owner must create Stripe account, products, prices, webhook
- **L5**: Owner must create SendGrid + Twilio accounts and provide API keys
- **L6**: Owner must enroll in Apple Developer Program + create App Store Connect app

---

## Testing Methodology (Enforced at Every Stage)

> **Reference**: `/specs/TESTING-METHODOLOGY.md` — Read it. This section is the enforcement mechanism.

Testing is not optional. It is not a final step. It is embedded into every phase of every mission. A mission without verified tests is an incomplete mission.

### The 5 Testing Layers (All Required)

| Layer | What | When | Failure = |
|-------|------|------|-----------|
| **1. Build Verification** | `pnpm typecheck && pnpm test && pnpm build` | After every file change batch | Stop. Fix before continuing. |
| **2. Unit Tests** | Test pure functions, hooks, utilities | Write alongside the code | Code is incomplete without tests. |
| **3. Integration Tests** | RLS, triggers, cascades, cross-table ops | After DB changes or hook changes | The feature doesn't work. Fix it. |
| **4. Device Testing** | Physical iOS device via Expo Go + tunnel | After every UI change | The feature is broken. Fix it. |
| **5. Regression** | ALL prior missions' critical paths | Before marking mission complete | Current mission is NOT done. |

### Per-Mission Testing Requirements

Every mission has **three mandatory test gates**. You cannot proceed past a gate without passing it.

#### Gate 1: During Implementation (Continuous)
Run after every meaningful code change (not every keystroke, but every logical unit of work):
```bash
pnpm typecheck && pnpm test
```
If this fails, stop writing new code. Fix the failure first.

#### Gate 2: Mission Feature Verification (After Implementation)
After all code for a mission is written, verify every feature works end-to-end:

```bash
# Build verification
pnpm typecheck && pnpm test && pnpm build

# Start the app on a real device
cd apps/owner && npx expo start --port 8081 --tunnel --clear
```

Then manually verify on a physical device:
- [ ] Every new screen renders without crash
- [ ] Every new user flow works start-to-finish
- [ ] Error states handled (disconnect network, submit empty form, hit back button)
- [ ] Loading states are present and not jarring
- [ ] Empty states are informative
- [ ] Data persists after killing and reopening the app
- [ ] UI matches BRAND-AND-UI.md (colours, spacing, typography, radii)
- [ ] Touch targets are minimum 44x44px
- [ ] Safe areas respected (content visible, not behind notch/home indicator)

#### Gate 3: Full Regression (Before Moving to Next Mission)
Before marking a mission complete, re-verify ALL prior critical paths still work. This is the regression gate.

### Mission-Specific Test Checklists

#### L1: Infrastructure — Test Checklist
- [ ] `pnpm typecheck` — zero errors across all 7 packages
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm build` — succeeds
- [ ] `npx supabase migration list --linked` — all 62 migrations applied
- [ ] `npx supabase functions list --project-ref woxlvhzgannzhajtjnke` — all 31+ functions deployed
- [ ] `npx supabase secrets list --project-ref woxlvhzgannzhajtjnke` — DATA_ENCRYPTION_KEY present
- [ ] App starts on device without crash after migration changes

#### L2: Bug Fixes & Security — Test Checklist
- [ ] Build verification passes (`pnpm typecheck && pnpm test && pnpm build`)
- [ ] approveAction: Approve a pending action in chat → tool executes, result appears
- [ ] Rate limiting: Send 20+ rapid messages → rate limit message appears, no crash
- [ ] Tier enforcement: Starter user tries hands_off-only tool → graceful rejection
- [ ] Deep links: Open `casa://` link → navigates correctly (not duplicate listener)
- [ ] Onboarding: Sign up as new user → onboarding completes before dashboard loads
- [ ] Chat error: Tap error message → retry fires (not blank response)
- [ ] Dashboard: Add property → no duplicate renders, no stale data
- [ ] Ownership: Try to access another user's property via tool → blocked
- [ ] Email tools: Cannot send email to arbitrary addresses outside tenancy
- [ ] Full regression: Login, navigate all tabs, view property, open chat, send message

#### L2.5: Feature Gating — Test Checklist
- [ ] Build verification passes
- [ ] Starter user: Blocked from autonomy settings with UpgradePrompt
- [ ] Starter user: Blocked from AI-generated listings with UpgradePrompt
- [ ] Pro user: Can access all Pro features, blocked from Hands Off features
- [ ] Hands Off user: Full access to everything
- [ ] UpgradePrompt: Shows correct required tier, links to upgrade flow
- [ ] Server-side: Edge function rejects tool calls above user's tier
- [ ] Full regression: All L2 checks still pass

#### L3: Google OAuth — Test Checklist
- [ ] Build verification passes
- [ ] Tap "Sign in with Google" → Google consent screen appears
- [ ] Complete OAuth → redirected back to app, profile created
- [ ] OAuth user can access all features same as email user
- [ ] Deep link callback `casa://auth/callback` handled correctly
- [ ] Existing email user links Google account successfully
- [ ] Full regression: Email login still works, all L2.5 checks pass

#### L4: Stripe Billing — Test Checklist
- [ ] Build verification passes
- [ ] Subscription creation: Select plan → Stripe checkout → subscription active in DB
- [ ] Webhook: Stripe sends payment_succeeded → profiles.subscription_tier updated
- [ ] Plan change: Upgrade/downgrade → reflected in app immediately
- [ ] Cancellation: Cancel subscription → reverts to starter tier
- [ ] Feature gates: Tier change → feature access updates accordingly
- [ ] Full regression: All L3 checks pass, auth still works

#### L5: Email & SMS — Test Checklist
- [ ] Build verification passes
- [ ] SendGrid: Trigger a notification → email arrives with correct template
- [ ] Twilio: Trigger SMS notification → message delivered
- [ ] Email queue: Multiple notifications → processed in order, no duplicates
- [ ] Templates: All notification types render correctly (rent reminder, maintenance update, etc.)
- [ ] Unsubscribe: User opts out → no further emails sent
- [ ] Full regression: All L4 checks pass

#### L5.5: Tenant App — Test Checklist
- [ ] Build verification passes
- [ ] Tenant login: Sign in → lands on home screen
- [ ] Settings hub: Navigate to settings → all options present and functional
- [ ] Notifications: Tenant receives push + in-app notifications
- [ ] Maintenance request: Submit with photos → owner sees it
- [ ] Inspection: View scheduled inspection → details correct
- [ ] Support: Submit ticket → confirmation shown
- [ ] Onboarding: New tenant → guided through setup
- [ ] Full regression: Owner app unaffected, all L5 checks pass

#### L5.7: Agentic Property Management — Test Checklist
- [ ] Build verification passes
- [ ] agent-core.ts: Imported by both agent-chat and agent-orchestrator without error
- [ ] agent-chat: Still works identically (regression — no behaviour change)
- [ ] agent-orchestrator: Invoked → reviews properties → creates tasks/executes actions
- [ ] Autonomy gating: L0 user → orchestrator creates tasks only, never auto-executes
- [ ] Autonomy gating: L2+ user → orchestrator auto-executes within allowed categories
- [ ] DB triggers: Insert a payment → instant event fires → orchestrator processes
- [ ] DB triggers: Create maintenance request → instant event fires → orchestrator responds
- [ ] Workflow engine: Start lease renewal workflow → progresses through steps correctly
- [ ] Event store: Every autonomous action logged to `agent_events` with reasoning
- [ ] Model routing: Routine tasks use Haiku, complex use Sonnet (verify via logs)
- [ ] Notification budget: Orchestrator caps tasks per user per cycle (max 15)
- [ ] Confidence scoring: Low-confidence actions escalate to user, don't auto-execute
- [ ] Full regression: Chat still works, all heartbeat scanner outputs still covered

#### L6: TestFlight — Test Checklist
- [ ] `eas build --platform ios --profile preview` succeeds
- [ ] Build uploads to TestFlight
- [ ] App installs on test device from TestFlight
- [ ] App launches without crash
- [ ] All critical flows work on TestFlight build (login, chat, properties, inspections)
- [ ] Push notifications work on TestFlight build
- [ ] Full regression: All L5.7 checks pass on TestFlight build

#### L7: QA & Polish — Test Checklist
- [ ] Build verification passes
- [ ] Full TESTING-METHODOLOGY.md regression (all 20 mission paths)
- [ ] Visual audit: Every screen matches BRAND-AND-UI.md
- [ ] Performance: Screen load < 2s, smooth scrolling, no memory leaks
- [ ] Error handling: Network disconnect during every critical flow → graceful recovery
- [ ] Edge cases: 0 properties, 100 properties, long property names, special characters
- [ ] Accessibility: VoiceOver reads key screens correctly
- [ ] Auth: Login → use app → kill → reopen → still authenticated
- [ ] RLS: Verified with 2 different user accounts (no cross-user data leakage)

#### L8: App Store Submission — Test Checklist
- [ ] Production build succeeds
- [ ] App Store Connect metadata complete (screenshots, description, keywords, privacy)
- [ ] App Review guidelines compliance verified
- [ ] No crash on first launch (cold start)
- [ ] All required privacy labels accurate
- [ ] TestFlight users' feedback addressed

### Testing Rules (Non-Negotiable)

1. **Tests fail = stop work.** Do not write new code until all tests pass.
2. **Never modify a test to make code pass.** If a test fails, the code is wrong.
3. **Never skip tests.** `--skip`, `xdescribe`, `xit` — none of these are acceptable.
4. **Regression is a blocker.** If a prior mission's feature breaks, fixing it is the highest priority.
5. **Device testing is not optional.** Simulator is insufficient. Real device via Expo Go.
6. **Evidence required.** For each mission: record build output, test output, and device verification.

### When Something Fails

| Failure | Action |
|---------|--------|
| Build fails | Stop. Fix immediately. Do not proceed. |
| Test fails | The code is wrong, not the test. Fix the code. |
| Device test fails | Reproduce, identify root cause, fix. |
| Regression found | Highest priority. Fix before continuing current mission. |
| Design mismatch | Fix to match BRAND-AND-UI.md. Design system is source of truth. |

---

## Global Verification (Run After Every Mission)

```bash
# 1. TypeScript compilation (all 7 packages must pass)
pnpm typecheck

# 2. Tests (all must pass — never skip, never modify tests to pass)
pnpm test

# 3. Build (must succeed)
pnpm build
```

If any of these fail, fix the issue before moving to the next mission.

### Supabase Verification (after L1)
```bash
# Check all migrations are applied
npx supabase migration list --linked

# Check all functions are deployed
npx supabase functions list --project-ref woxlvhzgannzhajtjnke

# Check secrets are configured
npx supabase secrets list --project-ref woxlvhzgannzhajtjnke
```

---

## Supabase Connection Details

| Key | Value |
|-----|-------|
| Project Ref | `woxlvhzgannzhajtjnke` |
| Region | Sydney (`ap-southeast-2`) |
| API URL | `https://woxlvhzgannzhajtjnke.supabase.co` |

Environment variables are in `apps/owner/.env.local` (not committed):
```
EXPO_PUBLIC_SUPABASE_URL=https://woxlvhzgannzhajtjnke.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

---

## Running the Apps for Testing

```bash
# Kill existing processes first
killall -9 node ngrok 2>/dev/null; sleep 2

# Owner app (port 8081)
cd apps/owner && npx expo start --port 8081 --tunnel --clear &
sleep 5

# Tenant app (port 8082)
cd apps/tenant && npx expo start --port 8082 --tunnel --clear &
sleep 20

# Get tunnel URLs
curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"[^"]*8081[^"]*"'
curl -s http://127.0.0.1:4041/api/tunnels | grep -o '"public_url":"[^"]*8082[^"]*"'
```

---

## Quick Reference: File Locations

### App Screens (Owner)
```
apps/owner/app/
├── (auth)/login.tsx          # Login screen
├── (auth)/signup.tsx         # Signup screen
├── (app)/(tabs)/
│   ├── index.tsx             # Home dashboard
│   ├── chat.tsx              # Agent chat
│   └── tasks.tsx             # Task list
├── (app)/autonomy.tsx        # Autonomy settings
├── (app)/settings.tsx        # Settings
├── (app)/inspections/        # Inspection flows
├── (app)/maintenance/        # Maintenance flows
└── (app)/listings/           # Listing creation
```

### Shared Packages
```
packages/
├── api/src/
│   ├── hooks/                # All React hooks (useAuth, useAgentChat, useFeatureGate, etc.)
│   ├── types/database.ts     # TypeScript types for all DB tables
│   └── index.ts              # Package exports
├── config/index.ts           # THEME, TIER_FEATURES, APP_CONFIG
└── ui/src/components/        # Shared UI components (DatePicker, etc.)
```

### Agent System (Backend)
```
supabase/functions/
├── agent-chat/index.ts       # THE intelligent agent (Claude + tools + autonomy)
├── agent-heartbeat/index.ts  # Current procedural heartbeat (being replaced)
├── agent-learning/index.ts   # Learning pipeline (corrections → rules)
└── _shared/
    ├── tool-registry.ts      # 130 tool definitions
    ├── tool-dispatcher.ts    # Routes tool calls to handlers
    ├── tool-handlers.ts      # Query tool implementations
    ├── tool-handlers-actions.ts  # Action tool implementations
    └── tool-handlers-generate.ts # Generate + integration tool implementations
```

### Migrations
```
supabase/migrations/
├── 20240101000001_*.sql through 20240101000052_*.sql  # Applied to live DB
└── 20240101000053_*.sql through 20240101000062_*.sql  # NOT YET APPLIED
```

---

## Decision Framework

When facing a choice, use this priority order:

1. **Will this work in production?** → If not, don't ship it
2. **Does this match the design system?** → If not, fix it
3. **Is this the simplest correct solution?** → If not, simplify
4. **Does this pass all tests?** → If not, fix the code
5. **Would I be confident launching with this?** → If not, keep going

---

## What "Done" Looks Like

A mission is complete when ALL of these are true:

### Build Health
- [ ] `pnpm typecheck` — zero errors across all 7 packages
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] `pnpm build` — succeeds with no issues
- [ ] No `// TODO` or `// FIXME` left in mission code
- [ ] No `console.log` debugging statements left in production code

### Feature Completeness
- [ ] All items in the mission's section of LAUNCH-MISSIONS.md are implemented
- [ ] No mock data or placeholder implementations
- [ ] Error states handled (network failure, invalid input, unauthorised access)
- [ ] Loading states exist and are not jarring
- [ ] Empty states are informative (not blank screens)

### Visual & UX Verification
- [ ] Tested on physical device (iOS via Expo Go)
- [ ] Matches BRAND-AND-UI.md design system (colours, spacing, typography, radii)
- [ ] Safe areas respected
- [ ] Touch targets minimum 44x44px

### Security
- [ ] User can only access their own data (RLS verified)
- [ ] No sensitive data in logs or error messages
- [ ] Auth flows work correctly

### Regression
- [ ] All previous missions' critical paths still work
- [ ] Navigation between all existing screens works
- [ ] Data created in prior missions still loads correctly
- [ ] No new TypeScript errors introduced in existing code

### Evidence
- [ ] Build output recorded (pass/fail)
- [ ] Test output recorded (X tests, X passing)
- [ ] Device verification completed
- [ ] Mission-specific test checklist (from Testing Methodology section) fully checked off
