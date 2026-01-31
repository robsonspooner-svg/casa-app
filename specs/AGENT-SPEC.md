# Casa Agent System Specification

> Complete technical specification for the Casa AI Agent — the autonomous property management engine that replaces traditional property managers for Australian property owners. This document describes the target system: a world-class, Clawdbot-calibre agent that operates both inside the app (database mutations, user communication) and outside the app (web search, trade discovery, outbound communication) to deliver 99% autonomous property management.

---

## 1. Strategic Context

### 1.1 Why This Agent Matters

Traditional property management costs Australian owners ~$4,000/year. Casa replaces this with an AI agent at ~$600/year. The agent must be genuinely better than a human PM: faster response times, zero mistakes on compliance, proactive issue detection, continuous learning from every interaction, and the ability to operate externally — finding tradespeople, getting quotes, booking maintenance, and managing the full lifecycle of property operations without the owner lifting a finger.

### 1.2 The 99% Autonomy Target

Casa's agent is not a chatbot. It is an autonomous property manager that:

1. **Proactively manages** — reaches out to owners, not just responds
2. **Operates externally** — searches the web, contacts tradespeople, gets quotes, books work
3. **Builds a network** — discovers and vets service providers, creating a growing trade network
4. **Learns owner preferences** — every correction makes it smarter for this specific owner
5. **Handles the full lifecycle** — from listing to lease signing to rent collection to maintenance to exit
6. **Knows when to ask** — surfaces decisions for approval at the right moments, not all the time
7. **Never reveals it's AI** — all external communication appears human, professional, and from the owner/agency

The owner's experience should be: "I got a notification that there was a plumbing issue, Casa found a plumber, got a quote within my budget, booked it for when the tenant is home, and it's all done. I just saw the summary."

### 1.3 Competitive Moat Strategy

General-purpose AI agents will eventually be able to do what we build. Our moat comes from:

1. **Proprietary learning data** — Every correction, preference, and decision pattern across all owners creates a training signal no competitor starts with.
2. **Australian property law specialisation** — State-specific compliance rules, notice periods, tribunal procedures, bond lodgement processes — deeply encoded in tool logic and prompt engineering.
3. **Integrated execution** — The agent doesn't just advise, it acts: creates properties, sends notices, lodges bonds, schedules inspections, finds tradespeople, requests quotes, books work, and processes payments through direct database mutations and external API calls.
4. **Owner relationship memory** — The agent remembers that this owner always wants the cheapest quote, or that one prefers to approve anything over $300, or that they hate being contacted on weekends. These preferences compound into a service no new agent can replicate.
5. **Service provider network effects** — Trade ratings, work history, and reliability scores from all Casa owners improve recommendations for every individual owner. Over time, each owner builds a curated network of trusted trades that eliminates the need for web searching.
6. **AI-transparent communication** — External parties (tradespeople, tenants via email/SMS) never know they're communicating with AI. This is critical for professional relationships and trade pricing.

### 1.4 Launch-Critical Agent Capabilities

For launch, the agent must handle these scenarios end-to-end:

- "Set up my property at 42 Ocean Parade, Byron Bay" → creates property, asks follow-up questions, fills in all details
- "Find me a tenant" → creates listing, generates copy, publishes, scores applications
- "My tenant hasn't paid rent" → checks arrears, sends reminder, offers escalation options
- "The dishwasher is broken" → creates maintenance request, finds local trades, requests quotes, books work
- "Schedule an inspection" → books it, notifies tenant, generates report after
- "How much tax will I owe?" → generates financial year summary with deductible expenses
- "Increase the rent" → checks market rates, calculates increase, generates compliant notice

---

## 2. Architecture Overview

### 2.1 System Components

```
Mobile App (React Native / Expo)
    |
    | HTTPS (Bearer token)
    v
Supabase Edge Function: agent-chat
    |
    |--- tool-dispatcher.ts (routes tool calls)
    |       |--- tool-handlers.ts (query handlers)
    |       |--- tool-handlers-actions.ts (mutation handlers)
    |       |--- tool-handlers-generate.ts (generation + external + workflow + memory)
    |
    |--- tool-registry.ts (125 tool definitions + autonomy metadata)
    |
    |--- Claude API (claude-sonnet-4) with tool use
    |
    v
Supabase PostgreSQL (64 tables)
    |--- RLS policies (row-level security)
    |--- Materialized views (financial_summary, property_metrics)
    |--- Realtime subscriptions (messages, notifications)
    |
    v
External Services (via MCP Servers)
    |--- Web Search (Brave/Google) — find trades, market data, regulations
    |--- Google Places API — business details, ratings, contact info
    |--- Twilio — SMS to trades and tenants (appears human)
    |--- SendGrid — email to trades and tenants (appears human)
    |--- Stripe Connect — payments, invoicing
    |--- Domain/REA APIs — listing syndication, market data
    |--- State Bond APIs — bond lodgement/release
```

### 2.2 Request Flow

1. Owner sends message in chat UI
2. `useAgentChat` hook calls `agent-chat` edge function with auth token
3. Edge function authenticates, loads/creates conversation
4. Builds system prompt with owner context (properties, tenancies, arrears, autonomy preset, preferences, rules, trade network)
5. Sends to Claude with all 125 tool definitions
6. Claude responds — may include tool_use blocks
7. For each tool call:
   - Look up tool metadata from registry (category, autonomy level, risk)
   - Check owner's autonomy setting for that category
   - If allowed: execute via dispatcher → handler → Supabase query/mutation or external API
   - If not allowed: create pending_action for owner approval
8. Feed tool results back to Claude for next iteration (up to 10 iterations)
9. Store final response, tool calls, and decisions in database
10. Return response to app with any pending actions

### 2.3 Module Breakdown

| Module | Lines | Purpose |
|--------|-------|---------|
| `agent-chat/index.ts` | 740 | Main handler: auth, conversation management, agentic loop, system prompt |
| `tool-registry.ts` | 316 | 125 tool definitions in Claude API format + autonomy metadata |
| `tool-dispatcher.ts` | 225 | Maps tool names to handler functions, error handling |
| `tool-handlers.ts` | 645 | 32 query tool handlers (read-only Supabase queries) |
| `tool-handlers-actions.ts` | 900 | 38 action tool handlers (mutations: create, update, delete) |
| `tool-handlers-generate.ts` | 424 | 42 handlers: generation, external, workflow, memory, planning |

**Total: ~3,250 lines of agent infrastructure**

---

## 3. Tool System

### 3.1 Tool Categories

| Category | Count | Autonomy Range | Purpose |
|----------|-------|---------------|---------|
| **query** | 32 | L3-L4 | Read data from any table — properties, tenancies, payments, maintenance, etc. |
| **action** | 38 | L0-L3 | Create, update, delete records — the agent's hands |
| **generate** | 17 | L0-L3 | AI-powered analysis — scoring, triaging, cost estimates, document generation |
| **external** | 8 | L1-L3 | Web search, find trades, parse business details, market data |
| **workflow** | 5 | L1-L2 | Multi-step orchestration — find tenant, onboard, end tenancy, etc. |
| **memory** | 3 | L4 | Remember preferences, recall context, search past decisions |
| **planning** | 1 | L3 | Decompose complex requests into ordered tool-call steps |

### 3.2 Key Tool Patterns

**Query tools** return raw data. The agent interprets and presents it conversationally.

**Action tools** modify the database. Each has ownership verification (properties must belong to the authenticated owner, tenancies verified through property chain).

**Generate tools** return data + an `instruction` field. This is a prompt-within-a-tool pattern: the tool fetches relevant data from the database, then tells Claude how to reason about it. For example, `score_application` returns the application data, references, and background checks, plus an instruction: "Score this application 0-100 considering income-to-rent ratio, employment stability..."

**External tools** reach outside the app. `web_search` finds information, `find_local_trades` discovers service providers, `parse_business_details` extracts structured data from websites. These tools enable the agent to operate in the real world — finding tradespeople, checking regulations, gathering market data.

**Workflow tools** are orchestrators. They don't do the work directly — they return a step-by-step plan that tells the agent which individual tools to call in sequence. The agent executes each step, reporting progress to the owner. The `workflow_maintenance_resolution` workflow is the most complex, chaining: triage → owner preference check → trade discovery → quote request → approval gate → scheduling → work tracking → completion verification → rating prompt.

**Memory tools** give the agent persistent preferences. `remember` stores key-value pairs (e.g. `maintenance.preferred_plumber = "Dave's Plumbing"`). `recall` retrieves relevant preferences for the current context. `search_precedent` finds past decisions similar to the current situation.

### 3.3 Tool Registration

Every tool is defined in two places that must stay in sync:

1. **`packages/agent-core/src/constants/tool-catalog.ts`** — TypeScript source of truth with full metadata (resilience config, compensation tools, mission availability)
2. **`supabase/functions/_shared/tool-registry.ts`** — Deno-compatible mirror for the edge function with Claude API format schemas

When adding a new tool:
1. Add to `tool-catalog.ts` with full metadata
2. Mirror in `tool-registry.ts` (CLAUDE_TOOLS array + TOOL_META entry)
3. Add handler function in the appropriate `tool-handlers-*.ts` file
4. Add mapping in `tool-dispatcher.ts` HANDLER_MAP

---

## 4. Autonomy System

### 4.1 Five Levels

| Level | Name | Behaviour | Example |
|-------|------|-----------|---------|
| L0 | Inform | Agent cannot execute — creates pending action | Terminate lease, breach notices |
| L1 | Suggest | Agent proposes action, waits for confirmation | Create property, approve application, approve quote |
| L2 | Draft | Agent prepares action for review | Create listing, update tenancy, send message |
| L3 | Execute | Agent does it, reports after | Send rent reminder, schedule inspection, add comment |
| L4 | Autonomous | Silent execution | All queries, memory operations |

### 4.2 Owner Presets

| Preset | query | action | generate | external | workflow | memory |
|--------|-------|--------|----------|----------|----------|--------|
| **Cautious** | L4 | L1 | L2 | L1 | L0 | L4 |
| **Balanced** | L4 | L2 | L3 | L3 | L1 | L4 |
| **Hands-off** | L4 | L3 | L4 | L4 | L2 | L4 |

Owners can override individual categories (e.g. "balanced but maintenance at L3"). Stored in `agent_autonomy_settings` table.

### 4.3 Autonomy Gate Flow

```
Agent wants to call tool X
    |
    v
Look up TOOL_META[X].category and TOOL_META[X].autonomyLevel
    |
    v
Get owner's autonomy level for that category
    |
    v
Is owner_level >= tool_level?
    |
    YES --> Execute tool, log decision (was_auto_executed: true)
    |
    NO --> Create agent_pending_actions row
           Tell Claude "this needs approval"
           Claude explains to owner why it wants to do this
           Owner approves/rejects in UI
           If approved: execute and log (was_auto_executed: false, owner_feedback: approved)
```

### 4.4 Pending Action UI

Pending actions appear in the "Needs Attention" section on the home screen. Each shows:
- What the agent wants to do (tool name + description)
- Why (the agent's reasoning)
- Approve / Reject buttons
- Context data (property, tenant, amounts)

### 4.5 Progressive Autonomy Graduation

As the owner repeatedly approves the same type of action, the agent suggests upgrading autonomy for that category. After 5 consecutive approvals of the same tool category without rejection, the agent proposes: "You've approved all maintenance quotes under $300 this month. Want me to auto-approve routine quotes under $300 in future?" This turns repeated approval into a learned threshold stored as an `agent_rule`.

---

## 5. The Maintenance → Trade Lifecycle (Crown Jewel Workflow)

This is Casa's most complex and valuable workflow. It demonstrates the full power of the agent operating both inside and outside the app.

### 5.1 First Maintenance Issue — The Onboarding Conversation

When a tenant logs their first maintenance request for a property, the agent initiates a preference-gathering conversation with the owner:

```
[Casa] A maintenance request has been submitted for 42 Ocean Parade:

  Category: Plumbing
  Urgency: Urgent
  Issue: "Hot water system is leaking from the base"
  Tenant preferred times: Weekday mornings

How would you like to handle maintenance for this property?

  [Find me a trade]    [I'll handle it myself]    [I have a preferred trade]
```

**Path A: "Find me a trade"**
```
Agent: Great — I'll search for licensed plumbers in the Byron Bay area,
get quotes, and come back to you for approval before booking anything.

What's your budget threshold for routine plumbing work? (I'll auto-approve
quotes under this amount for future issues)

Owner: $400 for routine, but always ask for emergency work

Agent: Got it. I'll remember:
  - Auto-approve routine plumbing quotes under $400
  - Always ask for emergency work regardless of cost
  - Search for trades in Byron Bay area

[Remembers preferences] [Starts trade discovery]
```

**Path B: "I'll handle it myself"**
```
Agent: No problem. I've acknowledged the request and let the tenant know
you're looking into it. The tenant mentioned they're available weekday
mornings for access.

Let me know when you've arranged the repair and I'll update the status.
Would you like me to handle future maintenance requests, or do you prefer
to manage them yourself?

Owner: You can handle routine stuff, but let me know about anything major

Agent: Got it. I'll manage routine maintenance autonomously (finding trades,
getting quotes under your threshold) and always consult you on urgent or
emergency issues. You can change this anytime in Settings.
```

**Path C: "I have a preferred trade"**
```
Agent: Great — what are their details? I'll add them to your trade network.

Owner: Dave's Plumbing, 0412 345 678, dave@davesplumbing.com.au

Agent: [calls create_service_provider]
       [calls add_trade_to_network with is_favorite=true]

I've added Dave's Plumbing to your network and set them as your preferred
plumber for 42 Ocean Parade. For future plumbing issues, I'll reach out
to Dave first.

Want me to contact Dave about this hot water system issue now?

Owner: Yes please

Agent: [calls send_work_order to Dave via email/SMS]

Done. I've sent Dave the job details including:
  - Issue: Hot water system leaking from base
  - Property: 42 Ocean Parade, Byron Bay
  - Tenant available: Weekday mornings
  - Your contact details for any questions

I'll let you know when Dave responds with a quote or availability.
```

### 5.2 Trade Discovery — External Web Search

When the agent needs to find a trade and none exist in the owner's network:

```
1. Check owner_trades for existing trades in the right category + service area
   → If found: use existing network (skip to step 5)

2. Web search: "licensed plumber Byron Bay NSW"
   → Brave Search API returns business listings
   → Parse top 5-10 results

3. For each promising result:
   → parse_business_details: extract business name, phone, email, ABN, license, ratings
   → Verify license where possible (state licensing databases)
   → Check Google Places for reviews and ratings

4. Create service provider cards in the app:
   → create_service_provider for each vetted trade
   → Populate: business_name, contact_name, email, phone, categories, service_areas
   → Set status: 'active' (verified details) or 'pending_verification'
   → Link to owner's network via owner_trades

5. Present options to owner:
   "I found 3 licensed plumbers near Byron Bay:

    1. Dave's Plumbing — 4.8★ (Google), Licensed, Insured — $85-120/hr
    2. North Coast Plumbing — 4.5★ (Google), Licensed — $90-130/hr
    3. Bay Plumbing Co — 4.2★ (Google), Licensed — $75-110/hr

    Want me to request quotes from all three, or choose one?"
```

### 5.3 Quote Request — AI-Transparent Communication

When contacting trades, the agent sends professional communication that appears to come from the owner or agency — never revealing AI involvement:

**Email template (sent via SendGrid):**
```
Subject: Quote Request — Plumbing Work at Byron Bay

Hi Dave,

I'm managing a property at 42 Ocean Parade, Byron Bay NSW 2481 and
need a plumber for a hot water system repair.

The issue: The hot water system is leaking from the base. The tenant
reports it started yesterday and is getting worse.

Details:
- Property type: 3BR house
- Access: Tenant available weekday mornings
- Urgency: Urgent (within 48 hours if possible)

Could you provide a quote and your earliest availability?

Thanks,
[Owner Name]
[Owner Phone]
```

**SMS template (sent via Twilio):**
```
Hi Dave, this is [Owner Name]. I have a plumbing job at 42 Ocean Parade
Byron Bay — hot water system leak. Could you call me or email a quote?
Thanks
```

The agent logs all communication against the service provider card in the app, so the owner can see the full history of interactions.

### 5.4 Quote Approval — Cost Thresholds

When a quote comes in (via trade portal, email reply, or manual entry):

```
[Casa] Dave's Plumbing quoted $380 for the hot water system repair
at 42 Ocean Parade.

  Quote: $380 (parts + labour)
  Availability: Thursday 9am-12pm
  Notes: "Standard HWS replacement, 2-3 hours"

This is within your auto-approve threshold of $400 for routine plumbing.

  [Auto-approved ✓] — I've sent Dave a purchase order and
  confirmed Thursday morning with the tenant.
```

If the quote exceeds the threshold:
```
[Casa] Dave's Plumbing quoted $850 for the hot water system repair.
This exceeds your $400 threshold for routine plumbing.

  Quote: $850 (new unit + installation)
  Notes: "HWS needs full replacement, not just repair"

  [Approve $850]  [Get more quotes]  [Negotiate]  [Handle myself]
```

### 5.5 Scheduling — Tenant Availability Integration

The agent uses the tenant's `preferred_times` and `access_instructions` from the maintenance request to coordinate scheduling:

```
1. Tenant submitted: preferred_times = "Weekday mornings"
2. Trade quoted: available Thursday 9am-12pm
3. Agent confirms with tenant: "A plumber will attend Thursday morning
   between 9-12. Please ensure access to the hot water system."
4. Agent confirms with trade: "Confirmed for Thursday 9am. Tenant will
   be home. Access via front door."
5. Agent updates maintenance_request: scheduled_date, scheduled_time
6. Agent updates work_order: status = 'scheduled'
```

If there's a scheduling conflict, the agent negotiates between parties without revealing it's AI.

### 5.6 Work Completion — Verification and Rating

After the scheduled work date:

```
[Casa] Dave's Plumbing was scheduled to complete the hot water system
repair at 42 Ocean Parade yesterday.

I've sent a follow-up to check if the work was completed.

[Later, after confirmation]

[Casa] The hot water system repair is complete. Dave submitted completion
photos and a final invoice for $380.

I've asked the tenant to confirm the issue is resolved.

[Tenant confirms]

[Casa] The tenant confirmed the hot water is working perfectly.

How would you rate Dave's Plumbing for this job?
  ⭐⭐⭐⭐⭐  (1-5 stars)
  [Add a comment...]

[Owner rates 5 stars]

[Casa] Thanks! I've added the rating to Dave's profile. He's now your
top-rated plumber with 5.0 stars. I'll use him first for future plumbing
issues at this property.
```

The agent also prompts the tenant to rate the repair experience (satisfaction_rating on maintenance_request).

### 5.7 Network Building Over Time

As the owner uses Casa, their trade network grows organically:

**Month 1**: Agent discovers and vets trades via web search. Creates service provider cards. Gets first ratings.

**Month 3**: Owner has 5-10 rated trades across categories. Agent prioritises highest-rated trades for each category. Web search only needed for new categories or locations.

**Month 6**: Owner has a comprehensive network. Agent rarely needs to search externally. Uses the owner's preferred trades automatically. Network effects kick in — trades discovered by other Casa owners in the area are also available.

**Month 12**: The trade network is a major retention driver. Switching to a competitor means losing your curated, rated network of reliable trades. This data belongs to the owner (downloadable), but the convenience of having Casa manage it is the lock-in.

### 5.8 Landlord Override — Manual Control

At any point, the owner can take manual control:

- **"I'll call the plumber myself"** → Agent stops managing, marks task as manual-override, but still tracks completion
- **"Cancel the work order"** → Agent cancels, notifies trade, updates status
- **"I want to use a different trade"** → Agent switches, creates new work order
- **"Book my trade Dave for this"** → Agent uses the owner's specified trade, skipping discovery
- **"I already fixed it myself"** → Agent marks complete, thanks owner

The key principle: the agent is always available to resume management. "Resume managing this" in chat hands control back.

---

## 6. Autonomous Workflows — Every Property Management Domain

The maintenance → trade lifecycle in Section 5 is one domain. Casa must deliver the same level of autonomous, end-to-end management across **every** function a human property manager performs. This section defines the complete set.

### 6.1 Tenant Finding — From Vacancy to Signed Lease

**What a human PM does**: Lists the property on portals, handles enquiries, conducts open homes, collects applications, runs background checks, shortlists candidates, negotiates terms, generates the lease, collects bond, lodges bond with the state authority.

**What Casa does autonomously**:

```
1. VACANCY DETECTED (lease ending, or owner says "find me a tenant")
   |
   v
2. LISTING CREATION
   - Pulls property data (beds, baths, features, photos)
   - Generates compelling listing copy via generate_listing_copy
   - Suggests rent based on market comparables via suggest_rent_price
   - Presents draft to owner: "Here's your listing at $750/wk. Approve?"
   |
   v
3. SYNDICATION
   - Publishes to Casa marketplace
   - Syndicates to Domain.com.au via domain_publish_listing
   - Syndicates to realestate.com.au via rea_publish_listing
   - Monitors listing performance (views, saves, enquiries)
   |
   v
4. ENQUIRY HANDLING
   - Auto-responds to enquiries with property details
   - Schedules open homes or private inspections
   - Answers common questions (pets, parking, lease terms)
   - All communication appears from owner — never AI
   |
   v
5. APPLICATION PROCESSING
   - Scores applications via score_application (income ratio, history, references)
   - Runs background checks via equifax_credit_check + tica_tenancy_check
   - Ranks applicants with reasoning
   - Presents top 3 with recommendation to owner
   |
   v
6. APPROVAL + ONBOARDING
   - Owner approves tenant
   - Agent generates state-compliant lease via generate_lease
   - Sends for e-signature via DocuSign
   - Collects bond and lodges with state authority
   - Sets up rent schedule and payment method
   - Sends welcome pack to tenant with property info
   - Creates tenancy record with all details
   |
   v
7. LISTING CLEANUP
   - Unpublishes from all portals
   - Updates property status to 'occupied'
   - Marks tenant finding task as complete
```

**Owner experience**: "Casa found me a tenant in 18 days. I approved the listing, chose from 3 scored applicants, and the lease was signed digitally. Bond was lodged automatically. I barely did anything."

### 6.2 Rent Collection + Arrears — From Due Date to Tribunal

**What a human PM does**: Tracks rent due dates, sends reminders, follows up on late payments, issues formal notices, arranges payment plans, escalates to breach notices, files tribunal applications.

**What Casa does autonomously**:

```
DAY 0: Rent due date
  → Agent checks payment status
  → If paid: log and continue
  → If unpaid: wait 24 hours (grace period, configurable)

DAY 1: Gentle reminder
  → Send friendly reminder via tenant's preferred channel
  → "Hi Sarah, just a reminder that your rent of $730 was due yesterday..."
  → Autonomy: L3 Execute (auto-send for Balanced+)

DAY 3: Follow-up
  → Check if paid since reminder
  → If still unpaid: send follow-up with stronger language
  → Notify owner: "Sarah is 3 days late. Sent follow-up."

DAY 7: Formal warning
  → Generate state-compliant rent arrears notice
  → Present to owner for approval (even on Hands-off — legal docs need sign-off)
  → If approved: serve notice via registered post + email
  → "I've served Sarah a formal notice. She has 14 days to pay."

DAY 14: Payment plan or escalation
  → If tenant requests payment plan: draft plan, present to owner
  → If no response: draft breach notice
  → Owner decides: payment plan, breach notice, or call tenant

DAY 21+: Tribunal preparation
  → Compile evidence: payment history, notices served, communications
  → Draft tribunal application
  → Present to owner: "Ready to file with NSW Civil & Administrative Tribunal"
  → Owner must explicitly approve (L0 — always requires approval)
```

**Key learning signals**: The agent learns whether this owner prefers leniency (payment plans) or strictness (fast escalation), which communication tone works for each tenant, and typical payment patterns (e.g. "Sarah always pays 2 days late on payday").

### 6.3 Lease Management — Renewals, Increases, Terminations

**What a human PM does**: Tracks lease expiry dates, negotiates renewals, calculates market-rate rent increases, generates compliant notices, processes terminations, manages exit procedures.

**What Casa does autonomously**:

```
90 DAYS BEFORE LEASE EXPIRY:
  → Agent flags in Tasks: "Lease at 42 Ocean Parade expires in 90 days"
  → Runs market analysis: comparable rents, vacancy rates, CPI
  → Assesses tenant quality: payment history, maintenance record, communication
  → Recommends: renew (with or without increase), or let expire for new tenant

60 DAYS BEFORE (if renewing with increase):
  → Calculates compliant increase (state-specific rules)
  → NSW: max 1 increase per 12 months, 60 days written notice
  → VIC: max 1 per 12 months, 60 days notice
  → QLD: market-based, no cap, 2 months notice
  → Generates state-compliant rent increase notice
  → Owner approves: "Increase to $780/wk? Here's the notice."
  → Serves notice to tenant
  → Updates rent schedule for new amount after notice period

IF TENANT DOESN'T RENEW:
  → Triggers exit workflow (see 6.8)
  → Simultaneously triggers tenant finding workflow (6.1)

IF OWNER WANTS TO TERMINATE:
  → Checks valid grounds per state legislation
  → Generates appropriate termination notice
  → Tracks notice period and compliance deadlines
  → Schedules exit inspection
```

### 6.4 Inspections — Routine, Entry, Exit

**What a human PM does**: Schedules routine inspections quarterly, gives proper notice to tenants, conducts the inspection, generates condition reports, follows up on issues, manages entry/exit inspections with bond implications.

**What Casa does autonomously**:

```
ROUTINE INSPECTION (quarterly):
  → Agent checks last inspection date
  → Proposes date/time based on tenant's typical availability
  → Generates state-compliant inspection notice (NSW: 7 days)
  → Sends to tenant: "A routine inspection is scheduled for [date]"
  → On inspection day: prompts owner to complete the inspection
  → Owner uses self-service inspection flow on phone:
    - Room-by-room photo capture
    - Condition notes per area
    - Flag issues for follow-up
  → Agent generates inspection report from captured data
  → If issues found: creates maintenance requests automatically
  → Stores report and schedules next inspection

ENTRY INSPECTION (new tenant moving in):
  → Generates comprehensive condition report
  → Both parties sign off
  → Stored as baseline for bond claims

EXIT INSPECTION (tenant moving out):
  → Compares current condition to entry report
  → Flags differences as potential bond claims
  → Generates itemised bond claim or release
  → Processes via state bond authority
  → If dispute: compiles evidence for tribunal
```

### 6.5 Compliance — Smoke Alarms, Pool Fences, Gas, Electrical

**What a human PM does**: Tracks compliance deadlines per state, arranges service providers for compliance checks, maintains records, ensures property meets safety standards before each new tenancy.

**What Casa does autonomously**:

```
PER-STATE COMPLIANCE TRACKING:
  → NSW: Annual smoke alarm check, 2-yearly gas fitting check
  → VIC: Urgent repair response requirements, minimum standards
  → QLD: Smoke alarm compliance at start of each tenancy, pool fence register

  → Agent maintains a compliance calendar per property
  → 30 days before due: "Smoke alarm check due at 42 Ocean Parade"
  → Agent finds certified smoke alarm technician (same trade discovery flow)
  → Books service, tracks completion
  → Stores compliance certificate
  → Updates compliance record

COMPLIANCE CHECKLIST (before new tenancy):
  → Smoke alarms: tested and compliant
  → Pool fence (if applicable): registered and inspected
  → Gas fittings: safety check current
  → Electrical: RCD testing current
  → Locks: re-keyed between tenants
  → General: property clean, all fixtures working

  → Agent checks each item, flags missing ones
  → Auto-arranges services for any gaps
  → Generates compliance report for property file
```

### 6.6 Financial Management — Tracking, Reporting, Tax

**What a human PM does**: Tracks all income and expenses, generates monthly/quarterly/annual statements, prepares end-of-year tax summaries, categorises deductible expenses, provides cash flow analysis.

**What Casa does autonomously**:

```
ONGOING:
  → Every rent payment: logged as income against property
  → Every maintenance cost: logged as expense (deductible category)
  → Every insurance premium, council rates, body corp: tracked
  → Agent reconciles expected vs actual payments
  → Flags discrepancies: "Expected $730 rent, received $700"

MONTHLY STATEMENT:
  → Auto-generates at month-end
  → Income: rent received, other income
  → Expenses: maintenance, management fee, insurance, rates
  → Net: profit/loss for the month
  → Available in app + PDF download

ANNUAL TAX SUMMARY:
  → Generates comprehensive tax summary at financial year end (1 July)
  → Categorised expenses per ATO rules:
    - Deductible: interest, management fees, repairs, insurance, rates
    - Depreciable: capital works, plant & equipment
    - Not deductible: capital improvements
  → Export formats: PDF for accountant, CSV for tax software
  → Agent: "Your tax summary for 42 Ocean Parade is ready. Total deductions: $14,250."

PORTFOLIO ANALYSIS:
  → Yield calculation per property and aggregate
  → Cash flow forecasting (3/6/12 month projections)
  → Vacancy cost analysis
  → Market value tracking (via Domain/REA data)
  → "Your portfolio generated $62,400 net income this year across 3 properties"
```

### 6.7 Communication — Tenant Relations, Notices, Updates

**What a human PM does**: Acts as intermediary between owner and tenant, handles all communication, sends formal notices, manages disputes, provides updates.

**What Casa does autonomously**:

```
TENANT COMMUNICATION CHANNELS:
  → In-app messaging (primary)
  → Email (formal notices, documents)
  → SMS (urgent matters, reminders)
  → All communication logged against property/tenancy

FORMAL NOTICES:
  → Agent generates state-compliant notices:
    - Rent increase notice (60 days NSW/VIC, 2 months QLD)
    - Breach notice (14 days to remedy)
    - Termination notice (varies by ground and state)
    - Entry notice (inspection, repairs)
  → Serves via correct method per state requirements
  → Tracks service dates and response deadlines

DISPUTE MANAGEMENT:
  → When tenant disputes maintenance responsibility, rent increase, etc.
  → Agent provides relevant legislation references
  → Drafts owner's response with legal backing
  → Maintains communication trail for potential tribunal
  → Recommends mediation when appropriate

OWNER UPDATES:
  → Proactive status reports at owner's preferred frequency
  → "Weekly summary: All rent collected, 1 maintenance request resolved, next inspection in 3 weeks"
  → Adjusts detail level based on learned preference (brief vs detailed)
```

### 6.8 End of Tenancy — Exit Process

**What a human PM does**: Manages notice period, schedules exit inspection, processes bond claims/releases, arranges re-keying, cleans property, prepares for next tenant.

**What Casa does autonomously**:

```
NOTICE PERIOD:
  → Track who initiated (tenant or owner)
  → Calculate correct notice period per state
  → Send acknowledgement with key dates:
    - Last rent payment date
    - Exit inspection date
    - Key return date
    - Bond processing timeline

EXIT INSPECTION:
  → Schedule 1-2 days before vacate date
  → Generate checklist from entry condition report
  → Owner inspects using app (room-by-room)
  → Agent compares entry vs exit photos
  → Flags items for bond claim

BOND PROCESSING:
  → If clean exit: lodge bond release immediately
  → If claims: generate itemised claim with evidence
    - Photos (entry vs exit)
    - Quotes for remediation
    - Communication trail
  → Submit via state bond authority API
  → Track processing and notify both parties

RE-TENANTING:
  → Arrange cleaning service (trade discovery flow)
  → Arrange re-keying (trade discovery flow)
  → Update property condition report
  → Trigger tenant finding workflow if owner wants to re-let
```

### 6.9 Property Onboarding — New Property Setup

**What a human PM does**: Collects property details, conducts initial inspection, sets up compliance records, creates listings if vacant, sets up financial tracking.

**What Casa does autonomously**:

```
Owner: "I just bought a property at 15 Park Avenue, Bondi"

Agent:
  1. Creates property with address details
  2. Asks key questions conversationally:
     - Property type, beds, baths, parking
     - Current status (vacant, tenanted, under renovation)
     - If tenanted: tenant details, lease terms, rent amount
     - Insurance details
     - Any known maintenance issues
  3. Sets up:
     - Compliance calendar based on state
     - Financial tracking (rent schedule if tenanted)
     - Inspection schedule (first routine in 3 months)
  4. Offers next steps:
     - If vacant: "Want me to find a tenant? I'll create a listing."
     - If tenanted: "Want me to invite the tenant to the app?"
     - Either way: "I'll run a compliance check and let you know if anything needs attention."
```

### 6.10 Summary — Every Domain, Fully Autonomous

| Domain | Agent Capability | External Operations | Learning Applied |
|--------|-----------------|---------------------|-----------------|
| **Maintenance** | Full lifecycle: triage → find trade → quote → approve → schedule → complete → rate | Web search, trade contact (email/SMS), trade portal | Trade preferences, cost thresholds, scheduling preferences |
| **Tenant Finding** | Full lifecycle: list → syndicate → screen → approve → onboard | Portal APIs, DocuSign, background checks | Screening criteria, listing style, rent pricing |
| **Rent Collection** | Full lifecycle: track → remind → escalate → tribunal | SMS/email reminders, formal notice serving | Leniency vs strictness, communication timing, tenant patterns |
| **Lease Management** | Renewals, increases, terminations with state compliance | State-specific notice generation and serving | Increase tolerance, renewal preferences, tenant value |
| **Inspections** | Schedule → notify → conduct → report → follow-up | Inspection notice serving, report generation | Inspection frequency, issue severity thresholds |
| **Compliance** | Track → alert → arrange → verify → record | Trade booking for compliance services | Preferred compliance providers, state-specific rules |
| **Financial** | Track → reconcile → report → tax summary | ATO-compliant categorisation, PDF generation | Expense categorisation, reporting frequency |
| **Communication** | Mediate → draft → serve → track | Multi-channel delivery (app, email, SMS) | Tone, detail level, preferred update frequency |
| **Exit Process** | Notice → inspect → bond → clean → re-let | Bond authority APIs, cleaning/keying trades | Bond claim thresholds, cleaning standards |
| **Onboarding** | Setup → compliance → financial → first actions | Address verification, compliance databases | Onboarding question flow, property type defaults |

---

## 7. Learning System (The Competitive Moat)

### 7.1 Why Learning Is the Moat

Every interaction generates training signals. Over time, the agent:
- Knows this owner prefers the cheapest quote, while that owner prioritises quality
- Learns that "my plumber Dave" means trade_id `abc-123`
- Understands that this owner always approves routine maintenance under $200
- Remembers that exit inspections for this property always flag the bathroom tiles
- Adapts communication style (some owners want brief updates, others want full detail)
- Knows which trades respond quickly and which need follow-up
- Learns seasonal patterns (more plumbing issues in winter, more pest issues in summer)

No competitor who launches later has this data. It's our unfair advantage.

### 7.2 Learning Pipeline

```
Owner Interaction
    |
    v
Agent Decision (stored in agent_decisions with full context)
    |
    v
Owner Feedback
    |--- Approved (positive signal)
    |--- Rejected (negative signal)
    |--- Corrected (strongest signal — owner says "no, do X instead")
    |
    v
Pattern Detection
    |--- If correction matches existing rule → increase confidence
    |--- If correction is new → create agent_rule (source: correction_pattern)
    |--- If owner explicitly states preference → create agent_preference (source: explicit)
    |
    v
Preference Store (agent_preferences table)
    |--- category.key → value (with confidence score)
    |--- Scoped to user, optionally to property
    |
    v
Recall at Decision Time
    |--- Before each tool call, recall relevant preferences
    |--- Factor into decision (e.g. "owner prefers quotes under $300")
    |--- Search for precedent decisions in similar context
```

### 7.3 Database Tables for Learning

| Table | Purpose |
|-------|---------|
| `agent_decisions` | Every tool call: input, output, reasoning, confidence, owner feedback |
| `agent_corrections` | When owner overrides a decision: original vs corrected action |
| `agent_rules` | Extracted behavioural rules (e.g. "always use Dave for plumbing") |
| `agent_preferences` | Key-value store of owner preferences with confidence scores |
| `agent_trajectories` | Sequences of tool calls for a goal — tracks what worked |

### 7.4 Embedding-Based Precedent Search

`agent_decisions.embedding` is a 1536-dimension vector column. When the agent faces a decision:

1. Embed the current context (tool name + input + surrounding conversation)
2. Vector similarity search against past decisions
3. Find the most similar decision where the owner provided feedback
4. Use that feedback to inform the current decision

This means the agent literally learns from past experience. If an owner rejected a rent increase suggestion 6 months ago because the tenant was excellent, the agent will find that precedent next time.

### 7.5 Confidence Calibration

Every preference and rule has a confidence score (0-1):
- `explicit` source: starts at 0.95 (owner directly stated it)
- `correction_pattern` source: starts at 0.7, increases with each confirming correction
- `inferred` source: starts at 0.5, increases with consistent behaviour

The agent uses confidence to decide whether to act on a preference autonomously or ask for confirmation. Low-confidence preferences are treated as suggestions, not rules.

### 7.6 Trade Preference Learning

The learning system is especially powerful for trade management:

| Signal | What's Learned | Stored As |
|--------|---------------|-----------|
| Owner always picks Dave for plumbing | `maintenance.preferred_trade.plumbing.property_X = dave_id` | agent_preference |
| Owner rejects quotes over $500 | `maintenance.quote_threshold.routine = 500` | agent_rule |
| Owner prefers morning appointments | `scheduling.preferred_time = morning` | agent_preference |
| Owner rates Trade A: 5 stars (3 times) | Trade A moves to top of recommendations | trade_reviews aggregate |
| Owner says "don't use that company again" | `maintenance.blocked_trades = [trade_id]` | agent_rule |
| Owner handles emergency plumbing themselves | `maintenance.emergency.plumbing = manual_override` | agent_preference |

---

## 8. System Prompt Design

### 8.1 Dynamic Context Injection

The system prompt is rebuilt for every conversation turn with fresh data:

```
You are Casa, an AI property manager for Australian rental property owners.
You manage properties autonomously — finding tenants, collecting rent,
handling maintenance, coordinating trades, and keeping everything compliant.

Current user context:
- Owner: {name}
- Properties: {count} properties
  - {address}, {suburb} {state} ({status}, ${rent}/wk)
  ...
- Active tenancies: {count}
- Arrears: {count} overdue payments totalling ${amount}
- Autonomy: {preset} mode
- Trade network: {count} trades across {categories}

You have {N} tools available...
{categorised tool listing}

Autonomy levels...
{level descriptions}

Active rules (learned from this owner):
{rules list}

Core capabilities...
{capability descriptions}

Guidelines...
{13 behavioural rules}

CRITICAL: When communicating with external parties (tradespeople, tenants
via email/SMS), NEVER reveal that you are an AI. All communication must
appear to come from the property owner or their management team. Use the
owner's name as the sender. Keep communication professional and human.
```

### 8.2 Key Prompt Engineering Decisions

1. **Tool-as-data-fetch pattern**: Generate tools return data + instruction rather than the tool itself generating content. This keeps Claude in the loop for all content generation while tools handle data retrieval.

2. **Workflow-as-plan pattern**: Workflow tools return step-by-step plans rather than executing everything. The agent follows the plan, executing individual tools and reporting at each step. This gives the owner visibility and control.

3. **Australian English enforcement**: The prompt explicitly requires Australian English, AUD currency, DD/MM/YYYY dates. This is critical for a product targeting Australian owners.

4. **Proactive mindset**: The prompt instructs the agent to think in workflows and propose next steps. "My tenant hasn't paid" shouldn't just return arrears data — it should propose a complete escalation path.

5. **AI transparency rule**: The prompt enforces that all external-facing communication (emails, SMS to trades and tenants) must appear human. The agent uses the owner's name, maintains professional tone, and never mentions AI, automation, or Casa's technology.

---

## 9. Conversation Patterns

### 9.1 Property Setup via Chat

```
Owner: "Set up my property at 42 Ocean Parade, Byron Bay"

Agent: [calls create_property with address_line_1="42 Ocean Parade", suburb="Byron Bay", state="NSW", postcode="2481"]

       I've created your property at 42 Ocean Parade, Byron Bay NSW 2481.

       I need a few more details to complete the setup:
       - How many bedrooms and bathrooms?
       - What type of property is it? (house, apartment, townhouse, etc.)
       - What's the weekly rent?
       - Is there a current tenant or is it vacant?

Owner: "3 bed 2 bath house, renting for $730/week with a tenant already in"

Agent: [calls update_property with bedrooms=3, bathrooms=2, property_type="house", rent_amount=730]
       [asks about tenant details]

       Updated. What's your tenant's name and email? I'll set up the
       tenancy and invite them to the app.

Owner: "Sarah Chen, sarah@email.com, lease runs Jan to Dec"

Agent: [calls create_tenancy]
       [calls invite_tenant]

       Done. I've created the tenancy for Sarah Chen (Jan-Dec 2026, $730/wk)
       and sent her an invitation to connect via the app.

       A few things I can help with:
       - Schedule a routine inspection
       - Check if rent is at market rate
       - Set up compliance tracking (smoke alarms, etc.)

       Anything else for this property?
```

### 9.2 Full Maintenance Lifecycle via Chat

```
[Tenant submits maintenance request via tenant app]

Agent (proactive to owner):
       A maintenance request has been submitted for 42 Ocean Parade:

       Category: Plumbing (Urgent)
       Issue: "Hot water system is leaking from the base"
       Tenant available: Weekday mornings
       Photos: [2 attached]

       [calls recall — checks for plumbing preferences]
       [calls get_owner_trades — finds Dave's Plumbing in network]

       You have Dave's Plumbing (4.8★, 23 jobs) in your network.
       Want me to send Dave the job details and get a quote?

       [Send to Dave]  [Find other plumbers]  [Handle myself]

Owner: "Send to Dave"

Agent: [calls send_work_order to Dave via email]
       [calls update_maintenance_status to 'awaiting_quote']

       Done. I've sent Dave the job details:
       - Hot water system leak at 42 Ocean Parade
       - Tenant available weekday mornings
       - Your contact details for questions

       I'll let you know when Dave responds.

[Dave emails back with a quote]

Agent: Dave's Plumbing quoted $380 for the hot water system repair.
       Available Thursday 9-12pm.

       This is within your $400 auto-approve threshold.

       [Auto-approved ✓] I've confirmed Thursday 9am with Dave and
       notified Sarah to ensure access.

[After work is completed]

Agent: Dave has completed the hot water system repair at 42 Ocean Parade.
       Final cost: $380 (as quoted).

       Sarah confirmed the hot water is working.

       How would you rate Dave's work? ⭐⭐⭐⭐⭐

Owner: "5 stars, great as always"

Agent: [calls submit_trade_review with rating=5]
       [calls update_maintenance_status to 'completed']

       Rated! Dave's average is now 4.9★ across 24 jobs.
       Maintenance request closed.
```

### 9.3 Arrears Escalation

```
Agent (proactive): I've detected that Sarah Chen at 42 Ocean Parade is 3 days
overdue on rent ($730). This is her first late payment.

I'd like to send a friendly reminder email. Here's the draft:

"Hi Sarah, just a gentle reminder that your rent of $730 was due on 28/01.
If you've already paid, please disregard this. Otherwise, could you arrange
payment at your earliest convenience? Thanks, [Owner Name]"

Shall I send this? [Approve] [Edit] [Skip]

Owner: "Send it"

Agent: [calls send_rent_reminder]

       Sent. I'll monitor and escalate to a formal notice if payment
       isn't received within 7 days.
```

### 9.4 Market-Aware Rent Review

```
Agent (proactive): It's been 12 months since the last rent review for
42 Ocean Parade. Current rent: $730/wk.

I've analysed comparable properties in Byron Bay:
- 3BR houses: median $780/wk (+6.8% from yours)
- Similar properties on your street: $750-$810/wk

CPI increase would be $730 × 3.2% = $753/wk
Market-rate increase: $770-$790/wk

NSW requires 60 days written notice for rent increases.

[Draft increase to $770/wk]  [Draft increase to $780/wk]
[Custom amount]  [Skip this review]
```

---

## 10. External Integration Architecture

### 10.1 Web Search

The `web_search` tool provides the agent with real-time information about:
- Local tradespeople (plumbers, electricians, etc.) with ratings and contact details
- State-specific tenancy regulations (notice periods change, new laws)
- Local market rental rates
- Compliance requirements (smoke alarm standards, pool fence rules)
- Insurance providers and rates

**Production implementation**: Brave Search API or Google Custom Search, with results parsed and fed to Claude as context.

### 10.2 Trade Discovery Pipeline

The `find_local_trades` + `parse_business_details` + `create_service_provider` pipeline:

1. **find_local_trades** — First checks the owner's existing network (`owner_trades` + `trades` tables). Falls back to external directory search (Google Places API, Hipages API, ServiceSeeking API, Brave Search).
2. **parse_business_details** — Scrapes/parses a trade's website or Google Places listing to extract ABN, license number, insurance status, ratings, contact details, service areas.
3. **create_service_provider** — Creates a structured trade record in the `trades` table, linked to the owner's network via `owner_trades`.

This builds a growing tradesperson network — every trade discovered by any owner benefits all owners in the area.

### 10.3 AI-Transparent Communication

All external communication follows these rules:

1. **Sender identity**: Uses the owner's name (never "Casa" or "AI assistant")
2. **Tone**: Professional, human, appropriate to the relationship
3. **Channel**: Email (SendGrid) or SMS (Twilio) depending on urgency and context
4. **Logging**: Every message logged against the relevant entity (service provider card, maintenance request, work order)
5. **Reply handling**: Incoming replies parsed and fed back to agent for next action
6. **No AI disclosure**: The system prompt and all templates enforce that AI involvement is never mentioned

### 10.4 Market Data

The `get_market_data` tool pulls:
- Comparable listings from our own database
- Median rents by suburb/bedrooms/type
- In production: Domain API and REA API for comprehensive market analysis
- Historical trends for rent increase justification

### 10.5 MCP Server Architecture

Each external integration runs as a standalone Cloudflare Worker exposing MCP endpoints:

| MCP Server | Endpoints | Purpose |
|------------|-----------|---------|
| **Stripe MCP** | payment intents, refunds, balance, payouts, Connect onboarding | All payment operations |
| **Twilio MCP** | send SMS, send WhatsApp, call forwarding | Outbound communication |
| **SendGrid MCP** | send email, templates, delivery tracking | Email communication |
| **Domain MCP** | listing CRUD, analytics, leads, price estimation | Portal syndication |
| **Equifax MCP** | credit checks, identity verification, fraud scoring | Tenant screening |
| **State Bond MCP** | bond lodge, release, claim (NSW, VIC, QLD) | Compliance |

---

## 11. Proactive Agent Behaviour

### 11.1 Trigger-Based Actions

The agent doesn't just respond to messages. Background tasks (`agent_background_tasks`) run on schedules:

| Trigger | Action |
|---------|--------|
| Rent due date passes | Check payment, send reminder if overdue |
| Arrears reaches 7 days | Escalate to formal notice |
| Lease expires in 60 days | Prompt owner about renewal/increase |
| Inspection due in 30 days | Schedule and notify tenant |
| Compliance check overdue | Alert owner with action steps |
| Vacancy reaches 7 days | Suggest listing optimisations |
| New application received | Score and notify owner |
| Work order completed | Request owner satisfaction rating |
| Market rent increases >5% | Suggest rent review |
| Trade quote pending >72h | Follow up with trade |
| Maintenance >48h unacknowledged | Escalate to owner |
| Insurance expiry in 30 days | Remind owner to renew |
| Unanswered tenant message >48h | Draft follow-up |
| Payment plan milestone | Verify payment received |

### 11.2 Proactive Message Format

Proactive messages appear in the chat with a distinct "Casa" attribution:

```
[Casa] Your routine inspection at 42 Ocean Parade is due in 28 days.
I'd like to schedule it for 28 February at 10am and notify Sarah.

[Schedule] [Change date] [Skip this time]
```

Stored in `agent_messages` with role `proactive` and logged in `agent_proactive_actions`.

---

## 12. Security Model

### 12.1 Authentication

- All requests authenticated via Supabase JWT (Bearer token)
- Edge function validates token with `supabase.auth.getUser(token)`
- Service role client used for database operations (bypasses RLS for cross-table queries)

### 12.2 Ownership Verification

Every tool handler verifies ownership before reading or modifying data:
- **Properties**: `owner_id = userId`
- **Tenancies**: `tenancies.properties.owner_id = userId` (join through properties)
- **Listings**: `owner_id = userId`
- **Applications**: `listings.owner_id = userId` (join through listings)
- **Maintenance**: `properties.owner_id = userId` (join through properties)
- **Work orders**: `owner_id = userId`
- **Conversations**: participant check via `conversation_participants`

### 12.3 Audit Trail

Every agent action is logged in `agent_decisions` with:
- User ID, conversation ID
- Tool name, input data, output data
- Reasoning, confidence score
- Whether it was auto-executed or required approval
- Owner feedback (approved/rejected/corrected)
- Execution duration

This provides a complete audit trail for compliance and dispute resolution.

### 12.4 External Communication Security

- All outbound emails sent via authenticated SendGrid API
- All outbound SMS sent via authenticated Twilio API
- No PII exposed in URLs or query parameters
- Trade portal uses time-limited, signed URLs for quote submission
- Reply handling via dedicated inbound webhook (not direct database access)

---

## 13. Performance Considerations

### 13.1 Agentic Loop Limits

- Maximum 10 iterations per request (prevents runaway tool chains)
- Maximum 4096 tokens per Claude response
- 40-message conversation history window (keeps context manageable)
- Tool execution timeout: inherit from Deno edge function limits

### 13.2 Cost Management

- Model: `claude-sonnet-4` (good balance of capability and cost)
- Token usage tracked per message and per conversation
- Financial summary and property metrics use materialized views (pre-computed)
- Query tools use `.limit()` to prevent large result sets

### 13.3 Parallel Tool Calls

Claude can request multiple tool calls in a single turn. The edge function processes them sequentially (for consistency) but this could be parallelised for read-only queries in the future.

---

## 14. Implementation Roadmap

### Phase 1: Core Agent (Current State)

- [x] 125 tool definitions in registry
- [x] 112 tool execution handlers
- [x] Autonomy gating system
- [x] Comprehensive system prompt
- [x] Agentic loop with tool use
- [x] Decision logging and audit trail
- [x] Pending action approval flow

### Phase 2: Learning System Activation

- [ ] Wire `remember`/`recall` into agentic loop (auto-recall preferences before each turn)
- [ ] Implement correction detection (diff original vs owner-modified actions)
- [ ] Rule extraction pipeline (3+ similar corrections → create rule)
- [ ] Embedding generation for decisions (1536-dim vectors)
- [ ] Precedent search in the agentic loop

### Phase 3: External Integrations

- [ ] Brave Search API for `web_search`
- [ ] Google Places API for `find_local_trades`
- [ ] Trade discovery → service provider card creation pipeline
- [ ] AI-transparent email templates via SendGrid
- [ ] AI-transparent SMS templates via Twilio
- [ ] Trade portal for quote submission (signed URLs)
- [ ] Inbound reply handling (email/SMS → agent processing)
- [ ] Domain API for `get_market_data` and listing syndication
- [ ] REA Group API for market data
- [ ] DocuSign for lease signing

### Phase 4: Proactive Agent

- [ ] Background task scheduler (Supabase cron or Cloudflare Workers)
- [ ] Trigger-based proactive actions (14 scanners)
- [ ] Proactive message delivery to chat
- [ ] Push notification integration (Expo Push)
- [ ] Trade follow-up automation (quote pending, job overdue)

### Phase 5: Agent Intelligence

- [ ] Progressive autonomy graduation (auto-suggest threshold upgrades)
- [ ] Trade preference optimisation (learn from ratings + corrections)
- [ ] Maintenance cost estimation from past work orders
- [ ] Market rate prediction from historical data
- [ ] Owner behaviour prediction (will they approve/reject?)
- [ ] Seasonal pattern detection (more plumbing in winter)

---

## 15. Testing Strategy

### 15.1 Unit Tests

Each tool handler should have unit tests that:
- Mock Supabase client
- Verify ownership checks work (reject unauthorised access)
- Verify correct table/column names in queries
- Verify error handling for missing data

### 15.2 Integration Tests

End-to-end tests that:
- Create test user + property + tenancy in Supabase
- Send a chat message
- Verify tool calls are made correctly
- Verify autonomy gating blocks/allows as expected
- Verify decisions are logged

### 15.3 Conversation Tests

Scripted conversation flows that verify:
- Property setup collects all required fields
- First maintenance issue triggers preference-gathering conversation
- Trade discovery creates service provider cards
- Quote approval respects cost thresholds
- Work completion triggers rating prompts
- Arrears escalation follows the correct ladder
- Workflow tools execute steps in order

### 15.4 External Communication Tests

Verify that all outbound communication:
- Uses owner's name as sender
- Never mentions AI or automation
- Includes correct property/issue details
- Logs against the correct entity
- Respects quiet hours and notification preferences

---

## 16. File Reference

| File | Description |
|------|-------------|
| `supabase/functions/agent-chat/index.ts` | Main edge function |
| `supabase/functions/_shared/tool-registry.ts` | Tool definitions + metadata |
| `supabase/functions/_shared/tool-dispatcher.ts` | Tool name → handler mapping |
| `supabase/functions/_shared/tool-handlers.ts` | Query tool handlers |
| `supabase/functions/_shared/tool-handlers-actions.ts` | Action tool handlers |
| `supabase/functions/_shared/tool-handlers-generate.ts` | Generate/external/workflow/memory handlers |
| `packages/agent-core/src/constants/tool-catalog.ts` | TypeScript tool catalog (source of truth) |
| `packages/api/src/hooks/useAgentChat.ts` | React hook for chat UI |
| `packages/api/src/hooks/useAgentInsights.ts` | Hook for activity feed/insights |
| `packages/api/src/hooks/useCasaPropertyActions.ts` | Hook for property-specific agent actions |
| `apps/owner/app/(app)/(tabs)/chat.tsx` | Chat screen UI |
| `apps/owner/app/(app)/(tabs)/index.tsx` | Home screen (pending actions, activity) |
