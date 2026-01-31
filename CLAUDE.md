# CLAUDE.md — Casa Project Agent Guide

> This file is mandatory reading for any Claude agent working on the Casa project. Read it fully before writing any code.

---

## Project Overview

Casa is an AI-powered property management platform for Australian property owners. It replaces traditional property managers (~$4,000/year) with an intelligent app (~$600/year). The product is built as a React Native (Expo) mobile app backed by Supabase, with an AI agent powered by Anthropic Claude.

---

## Required Reading (Before Any Work)

Read these documents in order before beginning any mission:

1. **`/BRAND-AND-UI.md`** — Design system, colours, typography, component specs. Every UI element must match this.
2. **`/STEAD-BIBLE.md`** — Product vision, architecture, database schema, feature specs, business model.
3. **`/SUPABASE-SPEC.md`** — Database connection details, CLI commands, migration workflow, RLS patterns.
4. **`/specs/AGENT-ARCHITECTURE.md`** — AI agent design, autonomy levels, tool system, learning pipeline.
5. **`/specs/ralph-missions/MISSION-00-OVERVIEW.md`** — Mission sequence, dependencies, quality bar, rules.
6. **`/specs/TESTING-METHODOLOGY.md`** — Testing framework, mission-complete checklists, regression paths.

If you are working on a specific mission, also read that mission's document thoroughly before starting.

---

## Project Heuristics

These are non-negotiable principles for every decision made in this codebase.

### 1. Always Build for Launch

Every decision must get us closer to launch. Ask: "Does this make the app more launch-ready?" If not, don't do it.

- Choose the approach that results in real, working functionality
- Don't build scaffolding that "we'll fill in later"
- Don't add abstractions for hypothetical future requirements
- Ship real features that real users can use on day one

### 2. No Mock Data

Never create fake data to simulate functionality. If a feature needs data, build the real pipeline to create it.

- No hardcoded arrays pretending to be API responses
- No `MOCK_PROPERTIES = [...]` constants
- No placeholder images or fake user names in production code
- If the screen needs data that doesn't exist yet, show the proper empty state
- The ONLY exception is in test files, where fixtures are appropriate

### 3. No TODOs

When something is challenging, solve it now. Do not leave breadcrumbs for future work.

- `// TODO: implement later` is not acceptable
- `// FIXME: this is a hack` means fix it before committing
- If a problem is genuinely out of scope for the current mission, document it in the next mission's spec — not as a comment in code
- Code comments should explain WHY, not mark incomplete work

### 4. Fix Every Error You Encounter

If you discover a bug, a TypeScript error, a broken import, a failing test — fix it. Even if it wasn't caused by your current work.

- A known bug left unfixed is a launch blocker we'll forget about
- Broken windows invite more broken windows
- The codebase should always be in a deployable state
- If fixing an error is genuinely complex, at minimum document it clearly and flag it to the user

### 5. Rise to the Level of Testing

Tests define the quality bar. When tests fail, the code is wrong — not the tests.

- Never modify a test to make failing code pass
- Never skip tests to avoid dealing with failures
- Never reduce test coverage to make a build green
- If a test expectation seems wrong, verify the intended behaviour first — the test may be correct
- Add tests for every new feature, especially edge cases

### 6. No Shortcuts That Create Debt

Shortcuts that save time now but cost time later are always wrong.

### 7. No Deferrals — Complete Every Mission Fully

**Deferring work is not allowed.** Every mission must be 100% complete before moving to the next one. This is non-negotiable.

#### Why Deferrals Are Dangerous

Deferrals create a false sense of progress. A mission that defers its core integrations (like "Stripe Edge Functions" or "email notifications") appears complete in the mission tracker but leaves the app non-functional. This pattern compounds: by Mission 19, you have a UI-complete app where payments don't process, emails don't send, and listings don't syndicate.

#### The Only Acceptable Exceptions

Work may ONLY be deferred if ALL of these conditions are true:

1. **External blocker exists** — A third-party account, API key, or business verification is required that takes weeks to obtain (e.g., Domain API partnership approval, Equifax business verification)
2. **The blocker has been initiated** — The application/registration process has already been started
3. **The feature is not P1** — It's marked P2 or lower in MISSION-00-OVERVIEW.md
4. **A stub implementation exists** — The code structure is in place, only the API call is stubbed
5. **It's documented in Pre-Launch Checklist** — With the specific blocker, date initiated, and expected resolution

If ANY of these conditions is false, **the work must be completed in the current mission**.

#### What Is NOT a Valid Reason to Defer

- "This is complex" — Complex work is still work. Do it now.
- "We can add this later" — Later never comes. Do it now.
- "This needs configuration" — Configuration is part of implementation. Do it now.
- "This depends on another mission" — If it depends on a prior mission, that mission wasn't complete. Go back and complete it.
- "Edge Functions require deployment" — Write the code. Deployment is a separate step.
- "We don't have API keys yet" — Get the API keys. Or use test/sandbox keys.
- "This is a nice-to-have" — If it's in the mission spec, it's required, not nice-to-have.

#### Edge Functions and Integrations Are Code, Not Configuration

A common trap is classifying Edge Functions, webhooks, and API integrations as "configuration to do later." This is wrong:

- `supabase/functions/create-payment-intent/index.ts` is CODE that must be written
- Stripe webhook handlers are CODE that must be written
- SendGrid email templates are CODE that must be written
- Domain/REA API clients are CODE that must be written

These belong in the mission where the feature is specified, not in "Pre-Launch."

#### Mission Completion Checklist

Before marking any mission complete, verify:

- [ ] All database migrations are applied and tested
- [ ] All API hooks are implemented and have tests
- [ ] All UI screens are built and match the design system
- [ ] All Edge Functions specified in the mission are written and deployed
- [ ] All integrations specified in the mission are implemented (or have valid external blockers documented)
- [ ] All email/notification triggers are wired up
- [ ] The feature works end-to-end on a real device
- [ ] No items are deferred without meeting ALL five exception criteria above

- Don't use `as any` to silence TypeScript (find the correct type)
- Don't use `!important` in styles (fix the specificity)
- Don't disable lint rules instead of fixing violations
- Don't use `@ts-ignore` without an explanation of why it's necessary
- Don't copy-paste code instead of extracting shared logic

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native (Expo SDK 54, Expo Router) |
| Database | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| AI Agent | Anthropic Claude via Cloudflare Worker |
| Payments | Stripe Connect |
| Notifications | Expo Push + SendGrid + Twilio |
| Monorepo | Turborepo + pnpm workspaces |
| Testing | Jest + React Native Testing Library |

---

## Workspace Structure

```
propbot/
├── apps/
│   ├── owner/          # Owner mobile app (Expo)
│   └── tenant/         # Tenant mobile app (Expo)
├── packages/
│   ├── api/            # Supabase client, hooks, types
│   ├── config/         # Shared theme, constants
│   ├── ui/             # Shared UI components
│   └── agent-core/     # Agent types, tool definitions (from Mission 03)
├── workers/
│   └── agent/          # Cloudflare Worker for AI agent (Mission 14)
├── supabase/
│   └── migrations/     # SQL migrations (applied via CLI or psql)
├── marketing/
│   └── website/        # Next.js marketing site
├── specs/
│   ├── ralph-missions/ # Mission documents
│   ├── AGENT-ARCHITECTURE.md
│   └── TESTING-METHODOLOGY.md
├── BRAND-AND-UI.md
├── STEAD-BIBLE.md
├── SUPABASE-SPEC.md
└── CLAUDE.md           # This file
```

---

## Supabase Connection

| Key | Value |
|-----|-------|
| Project Ref | `woxlvhzgannzhajtjnke` |
| Region | Sydney (`ap-southeast-2`) |
| API URL | `https://woxlvhzgannzhajtjnke.supabase.co` |

Environment variables are stored in `apps/owner/.env.local` (not committed to git):
```
EXPO_PUBLIC_SUPABASE_URL=https://woxlvhzgannzhajtjnke.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

---

## Running Expo Apps for Testing

Casa has two separate mobile apps: **Owner** and **Tenant**. They can be run simultaneously on different ports for testing interactions between them.

### Port Assignments

| App | Port | Tunnel Format |
|-----|------|---------------|
| Owner | 8081 | `exp://<id>-anonymous-8081.exp.direct` |
| Tenant | 8082 | `exp://<id>-anonymous-8082.exp.direct` |

### Running Both Apps Simultaneously

When asked to run Expo for testing, **always start both apps** using this procedure:

```bash
# 1. Kill any existing processes
killall -9 node ngrok 2>/dev/null; sleep 2

# 2. Start Owner app on port 8081
cd /Users/robbiespooner/Desktop/propbot/apps/owner && npx expo start --port 8081 --tunnel --clear &

# 3. Wait for first tunnel to initialize
sleep 5

# 4. Start Tenant app on port 8082
cd /Users/robbiespooner/Desktop/propbot/apps/tenant && npx expo start --port 8082 --tunnel --clear &

# 5. Wait for tunnels and get URLs
sleep 20

# 6. Get Owner tunnel URL (port 4040)
curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"[^"]*8081[^"]*"'

# 7. Get Tenant tunnel URL (port 4041)
curl -s http://127.0.0.1:4041/api/tunnels | grep -o '"public_url":"[^"]*8082[^"]*"'
```

### Important Notes

- **Always kill all processes first** when switching between apps or restarting
- Each app runs its own ngrok tunnel on separate ports (4040 for owner, 4041 for tenant)
- The `--clear` flag clears the Metro bundler cache
- Both apps share the same Supabase backend but have separate user sessions
- Test interactions by logging into different accounts on each app

### Single App Mode

If only testing one app:
```bash
# Owner only
cd apps/owner && npx expo start --port 8081 --tunnel --clear

# Tenant only
cd apps/tenant && npx expo start --port 8082 --tunnel --clear
```

---

## Mission Workflow

1. Read the mission document completely
2. Read this file (CLAUDE.md) and TESTING-METHODOLOGY.md
3. Read BRAND-AND-UI.md if any UI work is involved
4. Implement the mission following all heuristics above
5. Run the build verification: `pnpm typecheck && pnpm test && pnpm build`
6. Test on real device via Expo Go tunnel
7. Complete the Mission-Complete Checklist (in the mission doc)
8. Run full regression testing (all prior mission paths)
9. Only then is the mission complete

---

## Common Patterns

### Supabase Client Usage
```typescript
import { getSupabaseClient } from '@casa/api';
const supabase = getSupabaseClient();
// Client uses AsyncStorage for session persistence
// Configured in apps/owner/app/_layout.tsx via initializeSupabase()
```

### Theme/Design System
```typescript
import { THEME } from '@casa/config';
// Use THEME.colors.brand, THEME.colors.canvas, etc.
// Never use raw colour values — always reference the theme
```

### Navigation
```typescript
import { router } from 'expo-router';
router.push('/(app)/(tabs)/chat');
// File-based routing via Expo Router
```

### Feature Gating
```typescript
import { useFeatureGate } from '@casa/api';
const { hasAccess, upgradeTier } = useFeatureGate('tenant_finding');
```

---

## What Not To Do

- Don't create documentation files unless explicitly asked
- Don't add emoji to code or UI unless explicitly requested
- Don't create new packages without clear justification
- Don't install dependencies that duplicate existing functionality
- Don't refactor code you weren't asked to touch
- Don't add comments to code you didn't write
- Don't create README files for packages
- Don't add logging that wouldn't be appropriate in production

---

## Decision Framework

When facing a choice, use this priority order:

1. **Will this work in production?** → If not, don't ship it
2. **Does this match the design system?** → If not, fix it
3. **Is this the simplest correct solution?** → If not, simplify
4. **Does this pass all tests?** → If not, fix the code
5. **Would I be confident launching with this?** → If not, keep going

---

## Equanimity Principle

> "Make decisions that are always getting us closer to launch and will leave us equanimous in the long term — even if they are challenging in the short term."

This means:
- Do the hard thing now instead of the easy thing that creates debt
- Build it right the first time instead of planning to fix it later
- Face errors head-on instead of working around them
- Accept that quality takes effort, and invest that effort upfront
- Every line of code should be something you'd be proud to show a user
