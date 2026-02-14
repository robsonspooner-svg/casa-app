# AGENT-OPERATIONS.md — Casa Operational Runbook

> **Purpose:** This document contains every tool, command, credential reference, and workflow a Claude Code agent needs to operate the Casa project end-to-end. Read CLAUDE.md first for project heuristics; read this for _how to actually do things_.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Credentials & Secrets](#3-credentials--secrets)
4. [Supabase Operations](#4-supabase-operations)
5. [EAS Build & TestFlight](#5-eas-build--testflight)
6. [OTA Updates (expo-updates)](#6-ota-updates-expo-updates)
7. [Edge Function Deployment](#7-edge-function-deployment)
8. [Running Apps Locally](#8-running-apps-locally)
9. [TypeScript & Testing](#9-typescript--testing)
10. [Marketing Website](#10-marketing-website)
11. [Email (Resend)](#11-email-resend)
12. [Stripe Payments](#12-stripe-payments)
13. [AI Agent System](#13-ai-agent-system)
14. [Git Workflow](#14-git-workflow)
15. [Common Pitfalls](#15-common-pitfalls)
16. [Current State (as of Feb 2026)](#16-current-state-as-of-feb-2026)

---

## 1. Project Overview

Casa is an AI-powered property management platform for Australian landlords. Two mobile apps (Owner + Tenant) backed by Supabase, with an AI agent powered by Anthropic Claude.

| Component | Technology |
|-----------|-----------|
| Owner App | React Native / Expo SDK 54 / Expo Router |
| Tenant App | React Native / Expo SDK 54 / Expo Router |
| Database | Supabase (PostgreSQL) — Sydney region |
| AI Agent | Claude via Edge Functions (agent-chat, agent-orchestrator) |
| Payments | Stripe Connect |
| Email | Resend (from `robbie@casaapp.com.au`) |
| Push Notifications | Expo Push API |
| Monorepo | Turborepo + pnpm workspaces |
| Website | Next.js (separate repo) at `casaapp.com.au` |

---

## 2. Repository Structure

### Main Codebase (this repo)
- **Path:** `/Users/robbiespooner/Desktop/propbot/`
- **GitHub:** `https://github.com/robsonspooner-svg/casa-app.git`
- **Branch:** `main`

```
propbot/
├── apps/
│   ├── owner/          # Owner mobile app (Expo)
│   └── tenant/         # Tenant mobile app (Expo)
├── packages/
│   ├── api/            # Supabase client, hooks, types
│   ├── config/         # Shared theme, constants
│   ├── ui/             # Shared UI components
│   ├── agent-core/     # Agent types, tool definitions
│   └── integrations/   # Third-party integrations
├── supabase/
│   ├── functions/      # Edge Functions (Deno)
│   │   ├── _shared/    # Shared modules (agent-core.ts, tool-handlers*.ts, etc.)
│   │   ├── agent-chat/
│   │   ├── agent-orchestrator/
│   │   ├── dispatch-notification/
│   │   └── ... (30+ functions)
│   └── migrations/     # SQL migrations
├── marketing/
│   └── website/        # Next.js marketing site (legacy copy, NOT the live one)
├── specs/              # Mission documents, architecture specs
├── CLAUDE.md           # Project heuristics (read first)
├── BRAND-AND-UI.md     # Design system
├── STEAD-BIBLE.md      # Product vision & full spec
└── SUPABASE-SPEC.md    # Database connection details
```

### Casa Marketing Website (deployed to casaapp.com.au)
- **Source:** `propbot/marketing/website/` (within this monorepo)
- **Deployed via:** Push files to the separate `casa` GitHub repo (see below)
- **GitHub:** `https://github.com/robsonspooner-svg/casa`
- **Live URL:** `https://casaapp.com.au` (hosted on Vercel)
- **Tech:** Next.js 14, Tailwind CSS, Framer Motion, Stripe, Supabase
- **Deployment:** The marketing website code lives in `propbot/marketing/website/`. To deploy, the contents of that folder are pushed to the `robsonspooner-svg/casa` repo, which triggers a Vercel deploy to `casaapp.com.au`.

### GitHub Repo Reference (DO NOT MIX THESE UP)

| Repo | URL | Purpose |
|------|-----|---------|
| `casa` | `https://github.com/robsonspooner-svg/casa` | Marketing website → casaapp.com.au (Vercel) |
| `casa-app` | `https://github.com/robsonspooner-svg/casa-app` | Full app project (propbot monorepo) |
| `Casa-Intelligence` | `https://github.com/robsonspooner-svg/Casa-Intelligence` | **SEPARATE PROJECT** — Casa Intelligence dev feasibility. DO NOT push Casa app code here. |
| `CasaProjects` | `https://github.com/robsonspooner-svg/CasaProjects` | **SEPARATE PROJECT** — Casa Project Management. DO NOT push Casa app code here. |

**CRITICAL:** Never push Casa property management app code to `Casa-Intelligence` or `CasaProjects` — they are completely separate businesses.

---

## 3. Credentials & Secrets

### Supabase (Production — Sydney)

| Key | Value |
|-----|-------|
| Project Ref | `woxlvhzgannzhajtjnke` |
| Region | `ap-southeast-2` (Sydney) |
| API URL | `https://woxlvhzgannzhajtjnke.supabase.co` |
| Org ID | `ikeypttbofcrbkcnzdqs` |
| Dashboard | `https://supabase.com/dashboard/project/woxlvhzgannzhajtjnke` |
| Pooler URL | `postgresql://postgres.woxlvhzgannzhajtjnke@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres` |

**Anon Key (public, safe for client-side):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveGx2aHpnYW5uemhhanRqbmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODYwNTcsImV4cCI6MjA4NDY2MjA1N30._akFWKzx3MC0OvkMrqM2MoKl6vNI_FR3ViQ-jj89pi4
```

**Service Role Key (server-side only, never expose to client):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveGx2aHpnYW5uemhhanRqbmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4NjA1NywiZXhwIjoyMDg0NjYyMDU3fQ.ZxWmgLToiq3EMMYSJ9FL5LDqP2as6FyIKOaxvt-Dv2E
```

**Env file locations:**
- Owner: `apps/owner/.env.local`
- Tenant: `apps/tenant/.env.local`

### Supabase Edge Function Secrets

These are set via `npx supabase secrets set KEY=value` and accessed in Edge Functions via `Deno.env.get('KEY')`:

| Secret | Description | How to get value |
|--------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | Claude API key for AI agent | Anthropic Console → API Keys |
| `RESEND_API_KEY` | Email delivery (Resend) | See [Email section](#11-email-resend) |
| `STRIPE_SECRET_KEY` | Stripe payments | Stripe Dashboard → Developers → API Keys |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client-side key | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | Stripe Dashboard → Developers → Webhooks |
| `STRIPE_PRICE_STARTER` | Stripe price ID for Starter tier | Stripe Dashboard → Products |
| `STRIPE_PRICE_PRO` | Stripe price ID for Pro tier | Stripe Dashboard → Products |
| `STRIPE_PRICE_HANDS_OFF` | Stripe price ID for Hands-Off tier | Stripe Dashboard → Products |
| `CRON_SECRET` | Auth for pg_cron → orchestrator calls | Self-generated, set once |
| `DATA_ENCRYPTION_KEY` | Encryption for sensitive data | Self-generated, set once |
| `EMAIL_FROM` | Sender email address | Currently `robbie@casaapp.com.au` |
| `EMAIL_FROM_NAME` | Sender display name | Currently `Casa` |
| `SUPABASE_URL` | Auto-set by Supabase | — |
| `SUPABASE_ANON_KEY` | Auto-set by Supabase | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase | — |
| `SUPABASE_DB_URL` | Auto-set by Supabase | — |

**To list current secrets:**
```bash
npx supabase secrets list
```

**To set a secret:**
```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxx
```

### Expo / EAS

| Key | Value |
|-----|-------|
| Expo Account | `roberto171` |
| Expo Organizations | `roberto171s-organization` (owner app), `casa-tenant` (tenant app) |
| Apple ID | `robbie@casaintelligence.com.au` |
| Apple Team ID | `JMA4855FVA` |
| EAS CLI Path | `/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas` |

**Owner App (Expo):**
| Key | Value |
|-----|-------|
| Slug | `casa` |
| Bundle ID (iOS) | `com.casa.owner` |
| Package (Android) | `com.casa.owner` |
| ASC App ID | `6759113854` |
| EAS Project ID | `8e409e27-49c7-410f-935c-e0ec17ade389` |
| Expo Org | `roberto171s-organization` |
| URL Scheme | `casa-owner` |

**Tenant App (Expo):**
| Key | Value |
|-----|-------|
| Slug | `casa-tenant` |
| Bundle ID (iOS) | `au.com.casaintelligence.tenant` |
| Package (Android) | `com.casa.tenant` |
| ASC App ID | `6759101933` |
| EAS Project ID | `c021f78c-e826-47c3-b4e1-aa1ad9e6f8c9` |
| Expo Org | `casa-tenant` |
| URL Scheme | `casa-tenant` |

### Resend (Email)

| Key | Value |
|-----|-------|
| Account email | `robbie@casaapp.com.au` |
| API Key | `re_FRabeaTA_KbhLHTXsuSU4xN4vKvdxJTTW` |
| From address | `robbie@casaapp.com.au` (set in `EMAIL_FROM` secret) |
| From name | `Casa` (set in `EMAIL_FROM_NAME` secret) |
| Dashboard | `https://resend.com/domains` |

**To update the Resend key on Edge Functions:**
```bash
npx supabase secrets set RESEND_API_KEY=re_FRabeaTA_KbhLHTXsuSU4xN4vKvdxJTTW
```

---

## 4. Supabase Operations

### CLI Setup
The Supabase CLI is installed globally at `/usr/local/bin/supabase` (v2.72.7). The project is already linked.

```bash
# Verify linked project
npx supabase projects list

# Run a SQL migration (remote)
npx supabase db push

# Apply a specific migration file
npx supabase migration up --include-all

# Generate TypeScript types from DB schema
npx supabase gen types typescript --project-id woxlvhzgannzhajtjnke > packages/api/src/types/supabase.ts
```

### Direct SQL Access
For ad-hoc queries, use the Supabase SQL Editor in the dashboard:
`https://supabase.com/dashboard/project/woxlvhzgannzhajtjnke/sql/new`

Or via psql (requires DB password from Supabase Dashboard → Settings → Database):
```bash
psql "postgresql://postgres.woxlvhzgannzhajtjnke:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
```

### Creating Migrations
```bash
# Create a new migration file
npx supabase migration new my_migration_name
# This creates: supabase/migrations/[timestamp]_my_migration_name.sql
# Edit the file, then push:
npx supabase db push
```

---

## 5. EAS Build & TestFlight

### Important: EAS CLI Location
The `eas` CLI is NOT globally installed. Use the full path:
```bash
/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas
```

Or run from the app directory with `npx`:
```bash
cd apps/owner && npx eas [command]
# NOTE: npx eas may not work in all contexts. If it fails with "could not determine executable to run", use the full path above.
```

### Building Both Apps

```bash
# Owner App — Build for iOS production
cd /Users/robbiespooner/Desktop/propbot/apps/owner
/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas build --platform ios --profile production --non-interactive

# Tenant App — Build for iOS production
cd /Users/robbiespooner/Desktop/propbot/apps/tenant
/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas build --platform ios --profile production --non-interactive
```

**Build numbers auto-increment** (configured in `eas.json` → `build.production.autoIncrement: true`).

### Check Build Status
```bash
# Owner builds
cd /Users/robbiespooner/Desktop/propbot/apps/owner
/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas build:list --platform ios --limit 3 --non-interactive

# Tenant builds
cd /Users/robbiespooner/Desktop/propbot/apps/tenant
/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas build:list --platform ios --limit 3 --non-interactive
```

### Submit to TestFlight

After a successful build, submit the latest build to App Store Connect (TestFlight):

```bash
# Owner App → TestFlight
cd /Users/robbiespooner/Desktop/propbot/apps/owner
/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas submit --platform ios --profile production --latest --non-interactive

# Tenant App → TestFlight
cd /Users/robbiespooner/Desktop/propbot/apps/tenant
/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas submit --platform ios --profile production --latest --non-interactive
```

**Apple credentials are pre-configured** via EAS App Store Connect API keys (auto-managed).

### Full Build + Submit Pipeline

```bash
EAS=/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas

# 1. Build both apps (can run in parallel)
cd /Users/robbiespooner/Desktop/propbot/apps/owner && $EAS build --platform ios --profile production --non-interactive &
cd /Users/robbiespooner/Desktop/propbot/apps/tenant && $EAS build --platform ios --profile production --non-interactive &
wait

# 2. Submit both to TestFlight (after builds finish)
cd /Users/robbiespooner/Desktop/propbot/apps/owner && $EAS submit --platform ios --profile production --latest --non-interactive &
cd /Users/robbiespooner/Desktop/propbot/apps/tenant && $EAS submit --platform ios --profile production --latest --non-interactive &
wait
```

---

## 6. OTA Updates (expo-updates)

For JavaScript-only changes (no native code changes), use OTA updates instead of full builds. These are instant — users get the update next time they open the app.

```bash
EAS=/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas

# Owner App OTA
cd /Users/robbiespooner/Desktop/propbot/apps/owner
$EAS update --branch production --message "Description of changes" --non-interactive

# Tenant App OTA
cd /Users/robbiespooner/Desktop/propbot/apps/tenant
$EAS update --branch production --message "Description of changes" --non-interactive
```

**When to use OTA vs full build:**
- **OTA:** JS/TS code changes, style changes, new screens, bug fixes
- **Full Build:** Native dependency changes (new plugin in app.json, new native module, SDK version bump)

**Important:** The `expo-updates` plugin must be in the `plugins` array in both `app.json` files. If it's missing, OTA updates won't work and EAS builds may fail.

---

## 7. Edge Function Deployment

### Deploying a Single Function
```bash
cd /Users/robbiespooner/Desktop/propbot
npx supabase functions deploy FUNCTION_NAME --no-verify-jwt
```

### Deploying All Functions
```bash
cd /Users/robbiespooner/Desktop/propbot
npx supabase functions deploy --no-verify-jwt
```

### Key Functions and When to Redeploy

| Function | When to redeploy |
|----------|-----------------|
| `agent-chat` | Any change to `_shared/agent-core.ts`, `_shared/tool-handlers*.ts`, `_shared/tool-registry.ts`, or `agent-chat/index.ts` |
| `agent-orchestrator` | Any change to shared tools or orchestrator logic |
| `dispatch-notification` | Changes to notification dispatch or `_shared/notification-templates.ts` |
| `stripe-webhook` | Changes to payment processing |
| `send-email` | Changes to email sending |

### Shared Files (_shared/)
Many Edge Functions import from `_shared/`. When you change a shared file, you must redeploy **all functions that import it**. Key shared files:

| File | Used by |
|------|---------|
| `agent-core.ts` | agent-chat, agent-orchestrator |
| `tool-handlers.ts` | agent-chat, agent-orchestrator |
| `tool-handlers-actions.ts` | agent-chat, agent-orchestrator |
| `tool-handlers-generate.ts` | agent-chat, agent-orchestrator |
| `tool-registry.ts` | agent-chat, agent-orchestrator |
| `notification-templates.ts` | dispatch-notification |
| `cors.ts` | All functions |
| `supabase.ts` | All functions |
| `stripe.ts` | stripe-webhook, create-payment-intent, create-setup-intent, etc. |

### Testing an Edge Function Locally
```bash
npx supabase functions serve FUNCTION_NAME --no-verify-jwt
# Then call it:
curl -X POST http://localhost:54321/functions/v1/FUNCTION_NAME \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"key": "value"}'
```

---

## 8. Running Apps Locally

### Running Both Apps Simultaneously (for testing cross-app interactions)

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

### Single App Mode
```bash
# Owner only
cd /Users/robbiespooner/Desktop/propbot/apps/owner && npx expo start --port 8081 --tunnel --clear

# Tenant only
cd /Users/robbiespooner/Desktop/propbot/apps/tenant && npx expo start --port 8082 --tunnel --clear
```

---

## 9. TypeScript & Testing

### Typecheck All Packages
```bash
cd /Users/robbiespooner/Desktop/propbot
pnpm typecheck
```
This runs `tsc --noEmit` across all 7 workspace packages via Turborepo.

### Run Tests
```bash
cd /Users/robbiespooner/Desktop/propbot
pnpm test
```

### Build Verification (before any release)
```bash
pnpm typecheck && pnpm test && pnpm build
```

---

## 10. Marketing Website

### Repo Details
- **Path:** `/Users/robbiespooner/Desktop/casa-intelligence-website/`
- **GitHub:** `https://github.com/robsonspooner-svg/Casa-Intelligence.git`
- **Live URL:** `https://casaapp.com.au`
- **Tech:** Next.js 14 + Tailwind CSS + Framer Motion

### ⚠️ Important: Separate from Main Codebase
The marketing website is in a **completely separate Git repo**. Do NOT confuse it with `propbot/marketing/website/` (which is a legacy copy inside the main monorepo).

**Any website changes must be made in:**
```
/Users/robbiespooner/Desktop/casa-intelligence-website/
```

### Running Locally
```bash
cd /Users/robbiespooner/Desktop/casa-intelligence-website
npm install
npm run dev
# Opens at http://localhost:3000
```

### The website uses a DIFFERENT Supabase project
The marketing website has its own Supabase instance (Mumbai region) for contact forms / waitlist:
- Project ref: `eyjanhpsejvzknjvkprh`
- URL: `https://eyjanhpsejvzknjvkprh.supabase.co`
- This is NOT the same as the app's Supabase project.

---

## 11. Email (Resend)

### Configuration
- **Provider:** Resend (https://resend.com)
- **Account:** `robbie@casaapp.com.au`
- **API Key:** `re_FRabeaTA_KbhLHTXsuSU4xN4vKvdxJTTW`
- **From address:** `robbie@casaapp.com.au`
- **From name:** `Casa`

### Where email is sent from
1. **Edge Function `dispatch-notification`** — Main notification dispatch (push + email + SMS)
2. **Edge Function `send-email`** — Direct email sending (used by document sharing, lease generation)
3. **Edge Function `process-email-queue`** — Processes queued emails (tenant invitations, etc.)
4. **Edge Function `send-arrears-reminder`** — Arrears-specific emails
5. **Edge Function `send-breach-notice`** — Breach notice emails
6. **Edge Function `send-compliance-reminders`** — Compliance due-date reminders

### Email Templates
All templates are in `supabase/functions/_shared/notification-templates.ts`. Each template produces branded HTML with the Casa design system.

### Updating the Resend API Key
If the key changes:
```bash
npx supabase secrets set RESEND_API_KEY=re_NEW_KEY_HERE
# Then redeploy functions that send email:
npx supabase functions deploy dispatch-notification --no-verify-jwt
npx supabase functions deploy send-email --no-verify-jwt
npx supabase functions deploy process-email-queue --no-verify-jwt
```

---

## 12. Stripe Payments

### Configuration
All Stripe keys are stored as Supabase Edge Function secrets. The Stripe client is in `supabase/functions/_shared/stripe.ts`.

### Key Functions
- `create-payment-intent` — Creates Stripe PaymentIntents for rent
- `create-setup-intent` — Sets up payment methods
- `stripe-webhook` — Handles Stripe webhook events (payment success/failure)
- `stripe-setup-session` — Creates Stripe Checkout sessions for setup
- `manage-subscription` — Manages Casa subscription tiers
- `create-connect-account` — Onboards owners to Stripe Connect

### Stripe Connect
Casa uses Stripe Connect (Standard) so rent payments go directly to the property owner's Stripe account, with Casa taking a 2.5% platform fee.

---

## 13. AI Agent System

### Architecture
The AI agent runs as Supabase Edge Functions:

1. **`agent-chat`** — Handles real-time chat with the user. Receives messages, calls Claude API, executes tools, returns responses.
2. **`agent-orchestrator`** — Autonomous background agent. Processes real-time events (from DB triggers) and runs daily/weekly/monthly batch reviews.
3. **`agent-learning`** — Processes feedback to improve tool genome weights.

### Key Shared Modules
- **`_shared/agent-core.ts`** — System prompt builder, autonomy gating, confidence scoring, tool execution
- **`_shared/tool-registry.ts`** — All 221 tool definitions (name, description, input_schema, category, autonomy level)
- **`_shared/tool-handlers.ts`** — Query tool handlers (read-only operations)
- **`_shared/tool-handlers-actions.ts`** — Action tool handlers (create, update, delete operations)
- **`_shared/tool-handlers-generate.ts`** — Generation tool handlers (documents, reports, notices)

### Autonomy Levels
- L1: Read-only queries (always auto-executed)
- L2: Low-risk actions (auto-executed if user setting allows)
- L3: Medium-risk actions (requires approval at lower autonomy settings)
- L4: High-risk actions (always requires approval)
- L5: Financial/legal actions (always requires explicit approval)

### Database Triggers → Event Queue
DB changes insert events into `agent_event_queue`, which the orchestrator processes:
- Payment completed/failed → `payment_completed` / `payment_failed`
- Maintenance submitted → `maintenance_submitted`
- Tenancy created/terminated → `tenancy_created` / `tenancy_terminated`
- Inspection finalized → `inspection_finalized`

### After Changing Agent Tools
When you add/modify/remove tools:
1. Update `_shared/tool-registry.ts` (tool definition)
2. Update the appropriate handler file (`tool-handlers.ts`, `tool-handlers-actions.ts`, or `tool-handlers-generate.ts`)
3. Redeploy: `npx supabase functions deploy agent-chat --no-verify-jwt && npx supabase functions deploy agent-orchestrator --no-verify-jwt`

---

## 14. Git Workflow

### Main Codebase
```bash
cd /Users/robbiespooner/Desktop/propbot
git add [files]
git commit -m "Description"
git push origin main
```

### Marketing Website
```bash
cd /Users/robbiespooner/Desktop/casa-intelligence-website
git add [files]
git commit -m "Description"
git push origin main
```

**⚠️ These are two separate repos. Never cross-push.**

---

## 15. Common Pitfalls

### EAS Build Fails at "Install dependencies"
- Check that `expo-updates` is in the `plugins` array in `app.json`
- Check for stale lockfiles (e.g., `pnpm-lock 5.yaml` with spaces in name)
- Run `pnpm install` before building

### TypeScript Errors with Supabase Client
When the generated types don't include a table:
```typescript
// Use `as any` casting:
const { data } = await (supabase.from('documents') as any).insert({...}).select().single();
```

### EAS CLI "command not found"
Use the full path:
```bash
/Users/robbiespooner/.npm/_npx/e25a38a8cc65d08e/node_modules/.bin/eas [command]
```

### Edge Function Import Errors
Edge Functions use Deno imports (URL-based). Common pattern:
```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
```

### OTA Updates Not Working
- Ensure `expo-updates` is in `plugins` array in `app.json`
- Ensure `runtimeVersion` matches between app.json and the build
- OTA updates only work for JS changes, not native code changes

### Supabase "relation does not exist"
The migration hasn't been applied. Run:
```bash
npx supabase db push
```

---

## 16. Current State (as of Feb 2026)

### Build Status
- Owner: Build #23 — iOS production, submitted to TestFlight
- Tenant: Build #17 — iOS production, submitted to TestFlight

### Latest OTA Updates
- Owner: Update group `8c30daaf` on `production` branch
- Tenant: Update group `4e185823` on `production` branch

### Deployed Edge Functions
All 32 Edge Functions deployed to production Supabase.

### What's Working
- Full property CRUD with compliance auto-init
- AI chat (owner + tenant apps) with 221 tools
- Document generation, saving to DB, sending to tenant
- Notification dispatch (push + email) with 25+ templates
- Maintenance workflow (submit → triage → work order → complete)
- Inspection lifecycle (schedule → conduct → review → finalize)
- Payment processing via Stripe Connect
- Tenant connection via 6-digit codes
- Arrears tracking and escalation
- Compliance monitoring per Australian state
- Agent orchestrator (instant events + daily/weekly/monthly reviews)
- Autonomy gating with confidence scoring

### Launch Target
- **Date:** Feb 20, 2026
- **Audience:** 5-10 landlords via TestFlight
- **Scope:** Email/password auth, push + email notifications, core property management features

### Key Spec Documents
- `CLAUDE.md` — Project heuristics and rules
- `BRAND-AND-UI.md` — Design system
- `STEAD-BIBLE.md` — Full product spec
- `SUPABASE-SPEC.md` — Database details
- `specs/LAUNCH-SPRINT.md` — 10-phase launch plan
- `specs/LAUNCH-MISSIONS.md` — L1-L8 mission sequence
- `specs/AGENT-ARCHITECTURE.md` — AI agent design
- `specs/TESTING-METHODOLOGY.md` — Testing framework
