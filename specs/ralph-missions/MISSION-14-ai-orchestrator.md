# Mission 14: AI Agent — Proactive Autonomous Property Manager

> **Full architecture reference**: See STEAD-BIBLE.md Section 5 and `/specs/AGENT-ARCHITECTURE.md`

## Overview
**Goal**: Launch a Clawdbot-style proactive autonomous AI property manager that orchestrates the entire rental lifecycle — from listing to lease signing to rent collection to arrears management — with minimal owner involvement. The primary user interfaces are **Chat** and **Tasks**. All complexity is hidden. The agent reaches out to the user (not just the other way around). Users can see everything happening, pause anything, and take manual control at any time — but they shouldn't need to.

**Dependencies**: Missions 03-13 (data foundation + all domain tools)
**Estimated Complexity**: Critical

---

## Implementation Status (January 2026)

### What's Built

| Phase | Status | Key Files |
|-------|--------|-----------|
| A: Agent Database + Edge Function | COMPLETE | `migrations/000018_agent_enhancements.sql`, `supabase/functions/agent-chat/index.ts` |
| B: Chat UI | COMPLETE | `apps/owner/app/(app)/(tabs)/chat.tsx`, `apps/tenant/app/(app)/(tabs)/chat.tsx`, `packages/api/src/hooks/useAgentChat.ts` |
| C: Tasks Tab | COMPLETE | `apps/owner/app/(app)/(tabs)/tasks.tsx`, `apps/tenant/app/(app)/(tabs)/tasks.tsx`, `packages/api/src/hooks/useAgentTasks.ts` |
| D: Heartbeat Engine | PARTIAL (4/10+ scanners) | `supabase/functions/agent-heartbeat/index.ts` |
| E: Autonomy Settings | COMPLETE | `apps/owner/app/(app)/autonomy.tsx`, `packages/api/src/hooks/useAutonomySettings.ts` |
| F: AgentProvider + Home | COMPLETE | `packages/api/src/providers/AgentProvider.tsx`, owner home updated with insights |
| G: MVP Tools | PARTIAL (15/87) | Tools defined inline in `agent-chat/index.ts` |
| H: Trajectory Recording | NOT STARTED | Schema exists, code does not populate |
| I: Polish & Performance | NOT STARTED | No pgvector retrieval, no response caching |

### What's Missing (Critical Gaps)

1. **72 tools not implemented** — Agent can read data but can only write 5 mutations (send_rent_reminder, shortlist_application, approve_application, create_listing, publish_listing)
2. **0 external integrations** — No Domain API, Stripe, Twilio, Equifax connections
3. **0 workflow orchestrations** — No multi-step processes (find tenant → onboard → exit)
4. **0 learning system** — Tables exist but corrections/rules/preferences never populated or queried
5. **0 vector retrieval** — pgvector index exists but embeddings never populated
6. **6 heartbeat scanners missing** — Need: maintenance follow-up, compliance gaps, inspection scheduling, market rent analysis, insurance renewal, communication follow-up

### Frontier Agent Expansion Plan

To reach the target of a Moltbot-calibre autonomous agent, implement in this order:

#### Priority 1: Action Tools (25 tools)
Every CRUD operation the owner can do manually, the agent does programmatically:

| Tool | Description | Autonomy |
|------|-------------|----------|
| `create_listing` | Create new property listing | L2 Draft |
| `publish_listing` | Publish to Casa + external portals | L1 Suggest |
| `update_listing` | Modify listing details, price, photos | L2 Draft |
| `unpublish_listing` | Remove listing from all channels | L1 Suggest |
| `send_rent_reminder` | Send rent reminder via in-app + SMS/email | L3 Execute |
| `send_breach_notice` | Generate and send formal breach notice | L0 Inform |
| `shortlist_application` | Move application to shortlisted | L2 Draft |
| `approve_application` | Approve tenant application | L1 Suggest |
| `reject_application` | Reject application with reason | L1 Suggest |
| `create_tenancy` | Create tenancy from approved application | L1 Suggest |
| `update_tenancy_dates` | Modify lease start/end dates | L1 Suggest |
| `end_tenancy` | Initiate tenancy termination | L0 Inform |
| `create_maintenance_request` | Log new maintenance request | L2 Draft |
| `assign_maintenance_trade` | Assign contractor to maintenance | L2 Draft |
| `approve_maintenance_quote` | Approve a quote for work | L1 Suggest |
| `schedule_inspection` | Schedule routine or entry/exit inspection | L2 Draft |
| `generate_lease` | Generate state-compliant lease PDF | L2 Draft |
| `generate_condition_report` | Generate condition report PDF | L2 Draft |
| `generate_breach_notice` | Generate formal breach notice document | L0 Inform |
| `create_rent_increase` | Draft rent increase notice with CPI data | L0 Inform |
| `lodge_bond` | Initiate bond lodgement with state authority | L1 Suggest |
| `request_bond_release` | Initiate bond release/claim | L0 Inform |
| `update_property_details` | Modify property features or metadata | L3 Execute |
| `create_payment_plan` | Set up structured payment plan | L1 Suggest |
| `record_manual_payment` | Record payment received outside app | L2 Draft |

#### Priority 2: Integration Bridge (15 tools)
Each external integration is implemented as an MCP (Model Context Protocol) server — a standalone service the agent connects to on demand:

| Tool | Integration | Description | Autonomy |
|------|-------------|-------------|----------|
| `domain_publish_listing` | Domain API | Syndicate listing to Domain.com.au | L1 Suggest |
| `domain_update_listing` | Domain API | Update listing on Domain | L2 Draft |
| `domain_unpublish_listing` | Domain API | Remove listing from Domain | L1 Suggest |
| `rea_publish_listing` | REA API | Syndicate to realestate.com.au | L1 Suggest |
| `rea_update_listing` | REA API | Update listing on REA | L2 Draft |
| `stripe_create_payment` | Stripe Connect | Create payment intent for rent | L1 Suggest |
| `stripe_process_refund` | Stripe Connect | Process a refund | L0 Inform |
| `stripe_get_balance` | Stripe Connect | Check Connect account balance | L4 Auto |
| `twilio_send_sms` | Twilio | Send SMS to tenant or trade | L3 Execute |
| `sendgrid_send_email` | SendGrid | Send email notification or document | L3 Execute |
| `equifax_credit_check` | Equifax | Run credit check on applicant | L1 Suggest |
| `tica_tenancy_check` | TICA | Check tenancy database for applicant | L1 Suggest |
| `bond_lodge_nsw` | NSW Fair Trading | Lodge bond with NSW | L1 Suggest |
| `bond_lodge_vic` | VIC RTBA | Lodge bond with Victoria | L1 Suggest |
| `bond_lodge_qld` | QLD RTA | Lodge bond with Queensland | L1 Suggest |

**MCP Server Architecture**: Each integration runs as a separate Cloudflare Worker exposing MCP endpoints. The agent connects via the Claude Agent SDK's MCP client. This isolates integration failures, allows independent deployment, and enables hot-swapping integrations.

#### Priority 3: Workflow Orchestration (10 tools)
Multi-step processes that chain multiple tools in a managed sequence with checkpoints and rollback:

| Tool | Steps | Description |
|------|-------|-------------|
| `workflow_find_tenant` | 7 | list → publish → collect apps → score → shortlist → approve → onboard |
| `workflow_onboard_tenant` | 5 | create tenancy → generate lease → lodge bond → set up rent → welcome |
| `workflow_end_tenancy` | 6 | notice → final inspection → bond claim → close tenancy → relist |
| `workflow_maintenance_resolution` | 5 | triage → find trade → get quotes → approve → verify completion |
| `workflow_compliance_check` | 4 | check items → identify gaps → create tasks → track completion |
| `workflow_rent_increase` | 4 | market analysis → draft notice → serve notice → update schedule |
| `workflow_lease_renewal` | 4 | check expiry → draft renewal → negotiate → execute |
| `workflow_inspection` | 5 | schedule → notify tenant → conduct → generate report → follow-up |
| `workflow_arrears_escalation` | 5 | remind → formal notice → payment plan → breach → tribunal |
| `workflow_property_onboard` | 4 | details → compliance check → listing → tenant finding |

Each workflow creates an `agent_task` with a timeline, allowing the owner to see progress, approve steps, and take manual control at any point.

#### Priority 4: Memory & Learning (10 tools)
The self-evolving intelligence layer — every interaction makes the agent smarter for this specific owner:

| Tool | Description |
|------|-------------|
| `remember` | Store a preference or fact ("I prefer trades from Hipages") |
| `recall` | Retrieve stored preferences and facts |
| `record_correction` | Log when owner corrects agent behavior |
| `generate_rule` | Create persistent rule from 3+ similar corrections |
| `search_precedents` | Search past decisions via pgvector similarity |
| `get_owner_rules` | Retrieve all active rules for this owner |
| `update_rule` | Modify an existing rule |
| `deactivate_rule` | Disable a rule without deleting |
| `log_trajectory` | Record full tool sequence + outcome |
| `evaluate_trajectory` | Score trajectory efficiency vs historical |

**Self-Evolving Skills Pattern**: When the agent receives 3+ similar corrections (e.g., "don't message tenants before 9am" three times), it automatically generates a persistent rule stored in `agent_rules`. This rule is injected into the system prompt for all future interactions. The owner can view, edit, and deactivate rules in Settings. This is the Moltbot "self-evolving skills" pattern — the agent dynamically creates new tool behaviors from accumulated corrections without code changes.

**pgvector Memory Architecture**: Every `agent_decision` generates an embedding via Claude's embedding API. On new decisions, the agent searches for similar past decisions using cosine similarity on the pgvector index. This enables:
- Precedent-based confidence scoring ("I handled a similar situation 3 weeks ago and you approved")
- Owner preference retrieval ("this owner always prefers the cheapest quote for minor repairs")
- Trajectory optimisation ("the fastest path to resolve this type of maintenance is...")

#### Priority 5: Planning & Communication (15 tools)

**Planning & Reasoning (8 tools)**:
| Tool | Description |
|------|-------------|
| `plan_task` | Create a multi-step plan for complex goals |
| `check_plan` | Verify plan completeness and identify blockers |
| `estimate_cost` | Estimate costs for maintenance, renovations |
| `assess_risk` | Risk assessment for applications, pricing, maintenance |
| `compare_options` | Compare options with pros/cons analysis |
| `calculate_yield` | Calculate rental yield and ROI metrics |
| `forecast_cashflow` | Project cash flow for 3/6/12 months |
| `suggest_improvements` | Suggest property improvements for value |

**Communication & Reporting (7 tools)**:
| Tool | Description |
|------|-------------|
| `draft_message` | Draft message in owner's communication style |
| `draft_tenant_notice` | Draft formal notice (state-compliant) |
| `generate_income_report` | Income/expense report for a period |
| `generate_tax_summary` | End-of-year tax summary with deductions |
| `generate_portfolio_report` | Full portfolio performance report |
| `send_notification` | Push notification to owner or tenant |
| `generate_inspection_report` | Formatted inspection report from data |

#### Phase 10: External Integration Tools

These tools connect the agent to external services. Each integration follows the AI-transparent principle — all external communication appears from the owner, never from AI.

| Tool | External Service | Purpose | Priority |
|------|-----------------|---------|----------|
| `web_search` | Brave Search API | Find tradespeople, market data, regulations | P1 |
| `find_local_trades` | Google Places API | Trade directory lookup with ratings, ABN | P1 |
| `parse_business_details` | Web scraping | Extract contact info from business listings | P1 |
| `send_email_sendgrid` | SendGrid | Outbound email (quotes, notices, comms) | P1 |
| `send_sms_twilio` | Twilio | SMS to trades and tenants | P1 |
| `send_push_expo` | Expo Push | Push notifications to app users | P1 |
| `syndicate_listing_domain` | Domain API | Publish listing to domain.com.au | P2 |
| `syndicate_listing_rea` | REA API | Publish listing to realestate.com.au | P2 |
| `create_payment_intent` | Stripe Connect | Process rent payment | P1 |
| `run_credit_check` | Equifax | Tenant background check | P2 |
| `check_tenancy_history` | TICA | Tenant database check | P2 |
| `lodge_bond` | State Bond APIs | Submit bond to state authority | P2 |
| `get_market_data` | Domain/REA APIs | Comparable rental data | P2 |

**Implementation Notes:**
- Each external tool wraps a specific API client from `packages/integrations/`
- All email/SMS content is generated by the agent but formatted to appear from the property owner
- Rate limiting per external service: max 10 requests/minute per user per service
- All external calls logged in `agent_decisions` with full request/response metadata
- Fallback behaviour: if external service is down, agent creates pending task for manual handling

#### Phase 11: Workflow Orchestration

Workflows are multi-step processes where the agent executes a sequence of tools with decision gates. Each workflow returns a plan, then executes steps with owner checkpoints at appropriate moments.

| Workflow | Steps | Typical Duration |
|----------|-------|-----------------|
| `workflow_maintenance_resolution` | triage → discover trades → request quotes → owner approval → schedule → complete → rate | 2-7 days |
| `workflow_tenant_finding` | create listing → publish → collect applications → score → shortlist → owner approval → onboard | 2-6 weeks |
| `workflow_end_tenancy` | exit notice → exit inspection → AI comparison → bond claim → property cleanup → relist | 4-8 weeks |
| `workflow_onboard_tenant` | create tenancy → generate lease → collect bond → lodge bond → setup rent → welcome | 1-2 weeks |
| `workflow_arrears_escalation` | friendly reminder → formal notice → payment plan offer → breach notice → tribunal prep | 1-6 weeks |

**Workflow Execution Model:**
- Agent creates `agent_task` with type 'workflow' and stores workflow state in `metadata`
- Each step is a tool call; agent checks gates before proceeding
- Gates: owner approval required, time delay (e.g., wait 3 days for quote responses), external response required
- If a gate blocks, agent creates pending action and notifies owner
- Workflows can be paused, resumed, or cancelled by owner
- All steps logged in `agent_decisions` with workflow_id reference

### Production Runtime Evolution

#### Current Runtime: Supabase Edge Function
- Deno runtime, 60-second timeout, cold starts
- Single Claude API call with `tool_use` loop (max 10 iterations)
- 15 tools defined inline in `agent-chat/index.ts`

#### Target Runtime: Cloudflare Worker + Claude Agent SDK

**Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`):
- TypeScript SDK for building autonomous agents with tool use
- Native MCP server connections for external integrations
- Persistent state via Durable Objects (workflows spanning days/weeks)
- No timeout limits (critical for multi-step tenant finding workflow)

**Tool Search Tool**:
Instead of loading all 87 tools into every Claude API call (wasting context), the SDK's Tool Search Tool dynamically discovers relevant tools:
- User: "send John a reminder" → discovers `send_rent_reminder`, `draft_message`, `twilio_send_sms`
- User: "how's my portfolio?" → discovers `get_financial_summary`, `get_properties`, `calculate_yield`
- Only 5-10 relevant tools loaded per call instead of all 87

**Programmatic Tool Calling**:
The agent calls tools based on runtime context rather than static definitions:
- Workflow tools (`workflow_find_tenant`) programmatically chain sub-tools
- Heartbeat scanners programmatically invoke action tools based on scan results
- Learning engine programmatically generates new tool behaviors from accumulated rules

**MCP Servers Per Integration**:
Each integration runs as a standalone Cloudflare Worker exposing MCP endpoints:
- **Stripe MCP**: Payment intents, refunds, balance, payouts, Connect onboarding
- **Twilio MCP**: SMS send/receive, WhatsApp (future), call forwarding (future)
- **Domain MCP**: Listing CRUD, analytics, leads, price estimation
- **Equifax MCP**: Credit checks, identity verification, fraud scoring
- **SendGrid MCP**: Transactional emails, templates, delivery tracking
- **State Bond MCP**: Bond lodgement, release, claim — per-state (NSW, VIC, QLD)

**Migration Path**: Edge Function → Cloudflare Worker is a runtime change, not a rewrite. The tool definitions, autonomy gating, and database schema remain identical. The main changes are:
1. Replace Deno `serve()` with Cloudflare Worker `fetch()` handler
2. Replace inline Claude API calls with Agent SDK agent loop
3. Replace direct integration calls with MCP server connections
4. Add Durable Objects for workflow state persistence

---

## Design Philosophy

```
"The owner never configures complexity. They just use the app, approve or correct actions, and the system adapts."
```

### Proactive, Not Reactive
Like Clawdbot's heartbeat engine, Casa's agent doesn't wait to be asked. It runs background tasks on schedules and triggers, then proactively surfaces results:
- "Your lease at 42 Smith St expires in 60 days. I've drafted a renewal offer — review it in Tasks."
- "3 new applications for Park Ave. Top applicant scored 87/100. Want me to shortlist her?"
- "Rent is 7 days overdue for John. I've sent the first reminder. If unpaid by Friday, I'll draft a breach notice."

### Chat + Tasks = Primary Interface
- **Chat**: Natural language commands, questions, and ad-hoc tasks. The agent also posts proactive messages here.
- **Tasks**: Rich, timeline-driven UI showing the agent's reasoning, decisions, approval requests, and completed work. Not just a to-do list — a full decision log with context.
- **Manual screens**: All existing screens remain accessible as the "detail/power-user" view. Most owners should rarely need to navigate directly to them.

### Seamless Manual Override
Any task the agent is managing can be paused and taken over:
- Tap a task in Tasks tab → see full context + reasoning → "Take Control"
- Agent stops acting but remains available for advice
- User can hand back: "Resume managing this" in chat

---

## Success Criteria

### Phase A: Agent Database + Edge Function Runtime
- [ ] Create agent infrastructure migration (agent tables + autonomy settings + proactive action log)
- [ ] Create `supabase/functions/agent-chat/index.ts` Edge Function
- [ ] Authenticate via JWT, load user context (properties, tenancies, arrears, preferences, autonomy settings)
- [ ] Load conversation history from `agent_conversations` + `agent_messages`
- [ ] Call Claude API with system prompt + tools + context
- [ ] 3-pass reasoning loop (think+plan → execute+verify → calibrate)
- [ ] Process tool calls through autonomy gate
- [ ] SSE streaming for real-time token delivery
- [ ] System prompt builder with dynamic rule/preference injection
- [ ] Context assembly: owner rules, preferences, property data, recent trajectories
- [ ] Max 10 tool iterations per request with timeout (30s)

### Phase B: Chat — Real Conversation Interface
- [ ] Full chat UI in both apps (owner + tenant)
- [ ] Message input + send
- [ ] User/agent message bubbles with streaming display (token-by-token)
- [ ] Tool call summaries (collapsible "Searched 12 trades...")
- [ ] Inline action cards for pending approvals
- [ ] Proactive messages from heartbeat engine
- [ ] "Add Task" shortcut from chat
- [ ] Conversation history with context summaries
- [ ] Rich data rendering (payment tables, applicant comparisons)

### Phase C: Tasks Tab — Rich Decision Surface
- [ ] Timeline-driven task cards with reasoning and decision transparency
- [ ] 4 sections: Needs Your Input, In Progress, Scheduled, Recently Completed
- [ ] Badge count on tab icon for pending approvals
- [ ] Approve/Reject/Take Control actions on each task
- [ ] Deep links from tasks to relevant detail screens
- [ ] Agent's recommendation with confidence + data summary
- [ ] Expand/collapse timeline entries
- [ ] Full reasoning trail: why it decided, what it considered, what it did, what happened

### Phase D: Proactive Heartbeat Engine
- [ ] Create `supabase/functions/agent-heartbeat/index.ts` scheduled Edge Function
- [ ] Scans for actionable events: lease expiry, overdue rent, new applications, stale maintenance, listing performance
- [ ] Checks user's autonomy threshold per action category
- [ ] If above threshold → auto-execute + log to `agent_proactive_actions`
- [ ] If below threshold → create pending action in Tasks + post proactive message to chat
- [ ] Configurable schedule (hourly default, can be adjusted)
- [ ] Idempotent: won't re-trigger for already-handled events

### Phase E: User-Adjustable Autonomy Threshold
- [ ] Autonomy settings screen (`apps/owner/app/(app)/profile/autonomy.tsx`)
- [ ] Preset selector: Cautious / Balanced / Hands-Off / Custom
- [ ] Custom mode: per-category sliders mapping to L0-L4
- [ ] Categories: Messages, Financial, Legal, Maintenance, Listings, Tenant Finding
- [ ] Default: Balanced (routine actions auto-execute, financial/legal need approval)
- [ ] Settings stored in `agent_autonomy_settings` table
- [ ] Tool execution checks autonomy level before acting
- [ ] First-time tool use always requires approval (learn from first interaction)
- [ ] Progressive graduation: repeated approvals auto-upgrade autonomy for that tool

### Phase F: Agent Provider + Home Integration
- [ ] Create `AgentProvider` wrapping both apps
- [ ] Maintains polling/realtime connection to agent state
- [ ] Tracks pending action count (for tab badge)
- [ ] Caches recent messages
- [ ] Home screen: replace static "Quick Actions" with agent-surfaced insights
- [ ] Contextual agent hint cards on detail screens (tenancy, arrears, listing)
- [ ] Deep linking from tasks to manual screens and back

### Phase G: MVP Tool Implementations (~15 tools)
- [ ] Query (auto): `get_properties`, `get_tenancies`, `get_arrears`, `get_listings`, `get_applications`, `get_rent_schedule`
- [ ] Action (gated): `send_rent_reminder`, `shortlist_application`, `approve_application`, `create_listing`, `publish_listing`
- [ ] Generate (draft): `generate_listing_copy`, `suggest_rent_price`, `score_application`, `draft_message`
- [ ] Planning: `plan_task`, `check_plan`
- [ ] Memory: `remember`, `recall`

### Phase H: Trajectory Recording + Learning
- [ ] Every tool sequence recorded in `agent_trajectories`
- [ ] Success/failure tracking per trajectory
- [ ] Efficiency scoring vs similar past trajectories
- [ ] Trajectory data informs future tool selection
- [ ] Owner corrections recorded in `agent_corrections` → generate rules

### Phase I: Polish & Performance
- [ ] Response time <3s for simple queries
- [ ] Error handling with self-correction (retry different approach)
- [ ] Smart context retrieval (pgvector precedent search on `agent_decisions`)
- [ ] Response caching for common queries
- [ ] Tenant assistant (limited read-only capabilities + maintenance requests)

---

## User-Adjustable Autonomy Threshold

The user sets a **trust level** that controls what the agent can do without asking:

| Preset | Description | Agent Behavior |
|--------|-------------|----------------|
| **Cautious** | Approve most things | Agent drafts, user approves. For new users. |
| **Balanced** | Smart defaults | Routine actions auto-execute. Financial/legal need approval. Default. |
| **Hands-Off** | Maximum autonomy | Agent handles everything. Only critical actions need approval. |
| **Custom** | Per-category control | User adjusts per category (messages, financial, legal, etc.) |

### Preset → Category Mapping

| Category | Cautious | Balanced | Hands-Off |
|----------|----------|----------|-----------|
| Query data | L4 Auto | L4 Auto | L4 Auto |
| Messages (reminders, notifications) | L1 Suggest | L3 Execute | L4 Auto |
| Financial (payments, bond) | L0 Inform | L1 Suggest | L3 Execute |
| Legal (notices, termination) | L0 Inform | L0 Inform | L1 Suggest |
| Maintenance (requests, quotes) | L1 Suggest | L2 Draft | L3 Execute |
| Listings (create, publish) | L1 Suggest | L2 Draft | L3 Execute |
| Tenant Finding (applications) | L1 Suggest | L2 Draft | L3 Execute |

### Autonomy Levels

| Level | Name | Behavior | Example |
|-------|------|----------|---------|
| **L0** | Inform | Notify only | "Rent is due tomorrow" |
| **L1** | Suggest | Recommend, owner confirms | "Should I send a breach notice?" |
| **L2** | Draft | Prepare for review | "Here's a draft message..." |
| **L3** | Execute | Act, report after | "Sent rent reminder to tenant" |
| **L4** | Autonomous | Silent, logged only | Auto-track payment status |

---

## Tasks Tab UX — Rich Decision Surface

The Tasks tab is the **window into everything the agent is doing**, designed to build trust through transparency.

### Card Design: Timeline + Reasoning + Actions

Each task card shows:
```
┌─────────────────────────────────────────────────────────────┐
│  Finding tenant for 42 Smith St                       Active │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Timeline:                                                   │
│  [check] Jan 28 — Created listing draft ($650/wk, 3BR)     │
│  [check] Jan 28 — You approved the listing                  │
│  [check] Jan 28 — Published to Casa + Domain + REA          │
│  [check] Jan 30 — 47 views, 3 applications received        │
│  [dot] Jan 30 — Scored applications:                        │
│             Sarah J. — 87/100 (strong income, clean history)│
│             James P. — 72/100 (good, short rental history)  │
│             Tom W.   — 65/100 (average, has pets)           │
│  [wait] Awaiting your decision                               │
│                                                              │
│  Agent's Recommendation:                                     │
│  "Sarah is the strongest candidate. Her income is 4x rent,  │
│   she has 5 years rental history, and clean references.      │
│   I'd recommend approving her application."                  │
│                                                              │
│  [Approve Sarah] [View All Applications] [Take Control]     │
└─────────────────────────────────────────────────────────────┘
```

### Sections in Tasks Tab
1. **Needs Your Input** — Items requiring a decision. Badge count on tab.
2. **In Progress** — Active workflows with live timeline. Expandable.
3. **Scheduled** — Upcoming proactive actions ("Lease check — tomorrow 8am")
4. **Recently Completed** — Last 7 days of agent activity with full reasoning trail.

### Reasoning & Decision Transparency
Every action the agent takes includes:
- **Why** it decided to act (or ask)
- **What** it considered (data, scores, rules)
- **What** it did (tool calls, results)
- **What** happened next (outcome, follow-up)

This builds trust. The user can see that the agent is making good decisions, which encourages moving the threshold toward Hands-Off.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ MOBILE APP                                                           │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐         │
│  │ Chat Tab         │  │ Tasks Tab    │  │ Home Screen    │         │
│  │ (streaming +     │  │ (timelines + │  │ (agent-surfaced│         │
│  │  proactive msgs) │  │  reasoning)  │  │  insights)     │         │
│  └──────┬───────────┘  └──────────────┘  └────────────────┘         │
│         │                                                            │
│  ┌──────▼───────────────────────────────────────────────────┐       │
│  │ AgentProvider (pending count, cache, realtime)            │       │
│  └──────────────────────────┬────────────────────────────────┘       │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ HTTP + SSE
┌─────────────────────────────▼────────────────────────────────────────┐
│ SUPABASE EDGE FUNCTIONS                                               │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  agent-chat (Edge Function)                                    │    │
│  │  ├── Context Assembly (rules, prefs, property data, autonomy) │    │
│  │  ├── 3-Pass Reasoning Loop                                    │    │
│  │  │   ├── Pass 1: THINK + PLAN (system prompt + tools)        │    │
│  │  │   ├── Pass 2: EXECUTE + VERIFY (tool calls + gating)      │    │
│  │  │   └── Pass 3: CALIBRATE (async: trajectory + scoring)     │    │
│  │  └── Tool Registry (MVP: 15 tools, autonomy-gated)           │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  agent-heartbeat (Scheduled Edge Function — hourly)            │    │
│  │  ├── Scan: lease expiry, overdue rent, new apps, stale maint  │    │
│  │  ├── Check autonomy threshold per action                      │    │
│  │  ├── Auto-execute or create pending action in Tasks           │    │
│  │  └── Post proactive messages to chat                          │    │
│  └──────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ Service Role Key
┌───────────────────────────────▼───────────────────────────────────────┐
│ SUPABASE DATABASE                                                      │
│  Agent tables: conversations, messages, decisions, trajectories,       │
│  rules, corrections, preferences, pending_actions, background_tasks,   │
│  autonomy_settings, proactive_actions + pgvector                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Tool System (MVP: 15 Tools)

At Mission 14 launch, 15 core tools are available via natural language. Additional tools from `@casa/agent-core` (87 total) are progressively activated.

| Name | Category | Autonomy | Description |
|------|----------|----------|-------------|
| `get_properties` | query | L4 Auto | Get owner's properties with status |
| `get_tenancies` | query | L4 Auto | Get tenancies with lease details |
| `get_arrears` | query | L4 Auto | Get overdue rent with amounts |
| `get_listings` | query | L4 Auto | Get listings with stats |
| `get_applications` | query | L4 Auto | Get applications for a listing |
| `get_rent_schedule` | query | L4 Auto | Get upcoming rent schedule |
| `send_rent_reminder` | action | L3 Execute | Send rent reminder to tenant |
| `shortlist_application` | action | L2 Draft | Shortlist a tenant application |
| `approve_application` | action | L1 Suggest | Approve tenant application |
| `create_listing` | action | L2 Draft | Create new property listing |
| `publish_listing` | action | L1 Suggest | Publish listing to portals |
| `generate_listing_copy` | generate | L2 Draft | Generate listing title + description |
| `suggest_rent_price` | generate | L2 Draft | Suggest rent from comparables |
| `score_application` | generate | L2 Draft | Score tenant application (0-100) |
| `draft_message` | generate | L2 Draft | Draft message for tenant |

> **Full tool definitions**: See `packages/agent-core/src/constants/tool-catalog.ts` for all 87 tools.

### Tool Execution Pipeline

Each tool call from Claude goes through this pipeline:

```
Claude tool_use response → ToolRouter.resolve() → AutonomyGate.check()
    │                                                     │
    │  If gated: create agent_pending_actions entry       │
    │  If auto: proceed ─────────────────────────────────►│
    │                                                     ▼
    │                                              Execute with context
    │                                              (Supabase service role)
    │                                                     │
    │  On success: log trajectory, return result          │
    │  On failure: retry or escalate to user              │
    │                                                     ▼
    │                                              ToolExecutionResult
    │                                              (back to Claude loop)
```

### SSE Streaming Contract

The Edge Function streams these events to the client:

```typescript
// Token streaming (text response)
{ type: 'token', data: { text: 'partial response...' } }

// Tool lifecycle events
{ type: 'tool_start', data: { toolName: 'get_arrears', status: 'started' } }
{ type: 'tool_result', data: { toolName: 'get_arrears', status: 'completed', durationMs: 120 } }
{ type: 'tool_gated', data: { toolName: 'approve_quote', status: 'gated', pendingActionId: 'uuid' } }

// Proactive message (from heartbeat)
{ type: 'proactive', data: { messageId: 'uuid', title: 'Rent overdue', body: '...' } }

// Completion
{ type: 'done', data: { messageId: 'uuid', toolsUsed: ['get_arrears', 'send_reminder'], totalDurationMs: 2400 } }
```

### Pending Action Resolution

When a tool is gated (autonomy insufficient):
1. Edge Function creates `agent_pending_actions` row with tool params + preview data
2. SSE sends `tool_gated` event to client
3. Client renders inline `ActionCard` with approve/reject buttons (in Tasks tab or Chat)
4. Owner taps approve → `POST /agent-chat` with action resolution
5. Edge Function re-executes tool
6. Push notification confirms action completion

---

## Proactive Heartbeat Engine

The heartbeat is a scheduled Edge Function that runs hourly, scanning for events that need attention.

### Event Scanners

| Scanner | Trigger | Auto Action (Balanced+) | Pending Action (Cautious) |
|---------|---------|------------------------|---------------------------|
| Lease Expiry | 90/60/30 days before end | Draft renewal offer → Tasks | Notify owner in Tasks |
| Overdue Rent | 1/3/7/14 days overdue | Send reminder (day 1), escalate (day 7+) | Create "Send reminder?" in Tasks |
| New Applications | Application submitted | Score + rank → surface in Tasks | Notify "New application received" |
| Stale Maintenance | >48h unassigned | Draft assignment suggestion | Notify owner |
| Maintenance Follow-up | Quote pending >72h, job >7d incomplete | Follow up with trade, escalate | Notify owner |
| Listing Performance | Weekly | Suggest price/description changes if low engagement | Report metrics |
| Rent Review Due | 12 months since last increase | Draft rent increase with CPI data | Notify owner |
| Compliance Deadlines | Smoke alarm, pool fence, gas safety due | Create compliance task → track | Notify owner |
| Inspection Scheduling | Quarterly routine, or 14d before lease end | Schedule + notify tenant | Create "Schedule inspection?" in Tasks |
| Communication Follow-up | Unanswered tenant message >48h | Draft follow-up message | Notify owner |
| Insurance Renewal | Policy expiry within 30 days | Remind owner to renew | Notify owner |
| Market Rent Analysis | Weekly | Compare current rent to suburb comparables | Report with suggestion |
| Application Processing | On arrival | Auto-score, check references, rank | Create "Review applications" in Tasks |
| Payment Plan Monitoring | Active payment plan milestone | Verify payment received, update plan | Notify owner of status |

#### Additional Heartbeat Scanners (Beyond Core)

The following scanners extend the heartbeat beyond the core 4 already implemented, providing comprehensive proactive coverage:

| Scanner | Frequency | Trigger Condition | Action |
|---------|-----------|-------------------|--------|
| **Compliance scanner** | Weekly | Upcoming compliance due dates (smoke alarms, gas safety, pool fences) across all properties | Create compliance task with deadline, auto-schedule if trades available |
| **Lease expiry scanner** | Weekly | Leases expiring in 90/60/30 days | Draft renewal offer at 90d, escalate urgency at 60d and 30d |
| **Listing performance scanner** | Weekly | Low view counts, high days on market relative to suburb average | Suggest price adjustment or description refresh |
| **Insurance renewal scanner** | Quarterly | Insurance policy expiry dates within 30/60/90 days | Remind owner to renew, surface policy details |
| **Market rent scanner** | Monthly | Compares current rent for each tenancy against suburb comparable data | Report with recommendation if rent is >10% below market |
| **Inspection due scanner** | Weekly | `properties.next_inspection_due` approaching or overdue | Schedule routine inspection, notify tenant with required notice period |
| **Communication follow-up scanner** | Daily | Unanswered trade/tenant communications older than 48 hours | Draft follow-up message, escalate if >5 days unanswered |
| **Financial anomaly scanner** | Monthly | Unusual expenses (>2x average), income drops (>20% below expected), missing payments | Flag anomaly to owner with historical comparison data |

**Scanner Implementation Pattern:**
- Each scanner is a pure function: `(userData: UserContext) => ProactiveAction[]`
- Scanners are idempotent — they check `agent_proactive_actions` before creating duplicates
- Scanner results are batched per user to minimize database writes
- Failed scanners do not block other scanners from running
- Scanner execution time is logged for performance monitoring

### Heartbeat Flow

```
1. Query all users with active properties
2. For each user:
   a. Load autonomy settings
   b. Run each scanner against user's data
   c. For each triggered event:
      - Check if already handled (idempotent)
      - Check autonomy level for this action category
      - If auto: execute action, log to agent_proactive_actions
      - If gated: create pending_action in Tasks, post proactive message to chat
3. Log heartbeat run (timestamp, users processed, actions taken)
```

---

## Database

### New Migration: Agent Infrastructure

**File**: `supabase/migrations/XXXX_agent_infrastructure.sql`

```sql
-- Core agent tables
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  context_summary TEXT,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  total_tokens_used INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'proactive')),
  content TEXT NOT NULL,
  tool_calls JSONB,           -- Array of tool calls made
  tool_results JSONB,         -- Results from tool execution
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_params JSONB NOT NULL,
  preview_data JSONB,         -- Human-readable preview of what will happen
  recommendation TEXT,        -- Agent's recommendation
  confidence DECIMAL(3,2),    -- 0.00 to 1.00
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'tenant_finding', 'lease_management', 'rent_collection',
    'maintenance', 'compliance', 'general'
  )),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
    'pending_input', 'in_progress', 'scheduled', 'paused', 'completed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  timeline JSONB NOT NULL DEFAULT '[]',  -- Array of timeline entries
  recommendation TEXT,
  related_entity_type TEXT,   -- 'property', 'tenancy', 'listing', 'application', etc.
  related_entity_id UUID,
  deep_link TEXT,             -- Route to navigate to related screen
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timeline entry format (stored in agent_tasks.timeline JSONB):
-- {
--   "timestamp": "2024-01-28T10:30:00Z",
--   "action": "Created listing draft ($650/wk, 3BR)",
--   "status": "completed",  -- 'completed', 'current', 'pending'
--   "tool_name": "create_listing",
--   "reasoning": "Property has 3BR, 2BA in Bondi. Comparable rents are $620-$680/wk.",
--   "data": { ... }  -- Optional structured data
-- }

CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_params JSONB,
  result JSONB,
  reasoning TEXT,
  confidence DECIMAL(3,2),
  duration_ms INTEGER,
  was_auto_executed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  tool_sequence JSONB NOT NULL,   -- Ordered array of tool calls
  goal TEXT,
  success BOOLEAN,
  efficiency_score DECIMAL(3,2),
  total_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_text TEXT NOT NULL,        -- Natural language rule
  source TEXT NOT NULL CHECK (source IN ('correction', 'preference', 'system')),
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES agent_decisions(id) ON DELETE SET NULL,
  original_action TEXT NOT NULL,
  corrected_action TEXT NOT NULL,
  correction_reason TEXT,
  rule_generated UUID REFERENCES agent_rules(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  source TEXT DEFAULT 'inferred',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE TABLE agent_autonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preset TEXT NOT NULL DEFAULT 'balanced' CHECK (preset IN ('cautious', 'balanced', 'hands_off', 'custom')),
  category_overrides JSONB DEFAULT '{}',
  -- category_overrides format: { "messages": "L3", "financial": "L1", ... }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_proactive_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,     -- 'lease_expiry', 'overdue_rent', 'new_application', etc.
  trigger_source TEXT,            -- Entity ID that triggered this
  action_taken TEXT NOT NULL,     -- What the agent did
  tool_name TEXT,
  tool_params JSONB,
  result JSONB,
  was_auto_executed BOOLEAN NOT NULL DEFAULT FALSE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  schedule TEXT,                  -- Cron expression or 'once'
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX idx_agent_pending_actions_user ON agent_pending_actions(user_id) WHERE status = 'pending';
CREATE INDEX idx_agent_tasks_user_status ON agent_tasks(user_id, status);
CREATE INDEX idx_agent_tasks_user_pending ON agent_tasks(user_id) WHERE status = 'pending_input';
CREATE INDEX idx_agent_decisions_user ON agent_decisions(user_id);
CREATE INDEX idx_agent_trajectories_user ON agent_trajectories(user_id);
CREATE INDEX idx_agent_rules_user ON agent_rules(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_agent_proactive_user ON agent_proactive_actions(user_id);

-- RLS
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_autonomy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_proactive_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_background_tasks ENABLE ROW LEVEL SECURITY;

-- Users can only access their own agent data
CREATE POLICY "Users own agent data" ON agent_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM agent_conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Users own agent data" ON agent_pending_actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_decisions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_trajectories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_rules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_corrections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_autonomy_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_proactive_actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own agent data" ON agent_background_tasks FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Updated_at triggers
CREATE TRIGGER agent_conversations_updated_at BEFORE UPDATE ON agent_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_tasks_updated_at BEFORE UPDATE ON agent_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_preferences_updated_at BEFORE UPDATE ON agent_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_autonomy_updated_at BEFORE UPDATE ON agent_autonomy_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Files to Create

### Supabase Edge Functions
```
supabase/functions/
├── agent-chat/
│   ├── index.ts                    # Main Edge Function entry point
│   ├── context.ts                  # Context assembly (rules, prefs, data)
│   ├── prompts.ts                  # System prompt builder
│   ├── loop.ts                     # 3-pass reasoning loop
│   ├── streaming.ts                # SSE response streaming
│   ├── autonomy.ts                 # Autonomy gate check + pending action creation
│   └── tools/
│       ├── registry.ts             # Tool registry + router
│       ├── query.ts                # Query tool implementations
│       ├── action.ts               # Action tool implementations
│       ├── generate.ts             # Generate tool implementations
│       ├── memory.ts               # Memory tool implementations
│       └── planning.ts             # Planning tool implementations
├── agent-heartbeat/
│   └── index.ts                    # Proactive heartbeat engine
```

### API Package Hooks
```
packages/api/src/
├── hooks/
│   ├── useAgentChat.ts             # Chat conversation + streaming
│   ├── usePendingActions.ts        # Pending actions for Tasks tab
│   ├── useAgentTasks.ts            # Full task list with timeline
│   ├── useAutonomySettings.ts      # Autonomy preset + category settings
│   └── useAgentInsights.ts         # Home screen agent-surfaced insights
├── providers/
│   └── AgentProvider.tsx           # Context provider for agent state
```

### App Files (Owner)
```
apps/owner/app/(app)/
├── (tabs)/
│   ├── chat.tsx                    # MODIFY: Real chat interface
│   └── tasks.tsx                   # MODIFY: Rich decision surface
├── profile/
│   └── autonomy.tsx                # NEW: Autonomy settings screen
```

### App Files (Tenant)
```
apps/tenant/app/(app)/
├── (tabs)/
│   ├── chat.tsx                    # MODIFY: Tenant chat interface
│   └── tasks.tsx                   # MODIFY: Tenant tasks (maintenance, rent)
```

### Modified Files
```
apps/owner/app/_layout.tsx          # MODIFY: Wrap with AgentProvider
apps/tenant/app/_layout.tsx         # MODIFY: Wrap with AgentProvider
apps/owner/app/(app)/(tabs)/index.tsx   # MODIFY: Agent-surfaced insights
apps/tenant/app/(app)/(tabs)/index.tsx  # MODIFY: Agent-surfaced insights
```

---

## Example Interactions

### Simple Query
```
User: "How much does John owe me?"

Agent uses: get_tenancies → get_arrears

Response: "John Smith at 42 Oak Street is $650 behind on rent (8 days overdue).
His last payment of $500 was on January 15th. Would you like me to send a reminder?"
```

### Multi-Step Task (via Chat)
```
User: "Find me a new tenant for Oak Street"

Agent uses: plan_task → creates agent_task with timeline

Response: "I'll help you find a new tenant for 42 Oak Street. Here's my plan:

1. Generate listing from property details
2. Get your approval on listing copy and rent price
3. Post to Casa + Domain + REA
4. Handle enquiries and score applications
5. Present top candidates with my recommendations

I've drafted a listing at $550/week (based on comparable rentals). [View Draft]

Shall I proceed?"
```

### Proactive Message (from Heartbeat)
```
Agent (proactive): "Heads up — rent for John Smith at 42 Oak Street is now 3 days
overdue ($650). I've sent a friendly reminder. If unpaid by Friday, I'll draft a
formal notice for your review.

[View in Tasks] [Send Another Reminder] [Call John]"
```

---

## Error Recovery Strategy

### Retriable Errors (retry same tool, different params or timing)
- **Database timeout** → retry with simpler query (reduce joins)
- **API rate limit** → wait and retry with exponential backoff (1s, 2s, 4s)
- **Temporary network error** → retry with exponential backoff
- **Stripe/Twilio transient failure** → retry up to 3 times

### Non-Retriable Errors (escalate to user)
- **Permission denied** → user needs to approve or grant permission
- **Data not found** → surface to user ("I couldn't find that property")
- **Tool validation error** → log for learning, surface to user
- **Integration auth failure** → surface to user ("I can't access Domain right now")

### Iteration Budget
- Agent gets max 10 iterations per user request
- Each tool call consumes 1 iteration
- Retries count as separate iterations
- If budget exhausted, agent summarizes partial progress and asks user to continue

### Self-Correction Pattern
When a tool fails, the agent should:
1. Check error type (retriable vs non-retriable)
2. If retriable: adjust params and retry (e.g., broader query, different date range)
3. If non-retriable: try alternative approach (e.g., different tool to get same data)
4. If no alternative: explain failure clearly to user with next-step suggestions

---

## Conversation Lifecycle

### Creation & Archival
- Conversation created on first user message
- Auto-archived after 7 days of inactivity (`is_active = FALSE`)
- User can manually close conversation ("Start a new conversation")
- Archived conversations kept for 12 months for audit/learning, then auto-deleted

### Context Window (per request)
- **Sliding window**: Last 10 messages (or 8,000 tokens, whichever is smaller)
- **Always include**: System prompt + user context (properties, tenancies, autonomy settings)
- **Context summary**: When messages exceed window, generate a summary of older messages and prepend
- **Precedent retrieval**: On new decisions, query pgvector for top 3 similar past decisions (cosine similarity > 0.7)

### Multi-Session Continuity
- Agent remembers context across sessions via conversation history
- Proactive messages (from heartbeat) create new conversations if none active
- User can reference past conversations ("What did you tell me about John last week?") via `recall` tool

---

## Tenant App Agent (Simplified)

The tenant app has a LIMITED agent with read-only + maintenance capabilities:

| Tool | Description | Autonomy |
|------|-------------|----------|
| `get_property` | View property details for their tenancy | L4 Auto |
| `get_tenancy` | View their lease terms and dates | L4 Auto |
| `get_messages` | View conversation history with owner | L4 Auto |
| `send_message` | Send message to owner | L2 Draft |
| `create_maintenance_request` | Submit maintenance request | L3 Execute (routine), L1 Suggest (emergency) |
| `get_maintenance_requests` | View their submitted requests | L4 Auto |
| `get_rent_schedule` | View upcoming payments | L4 Auto |
| `get_payment_history` | View past payments | L4 Auto |

**No heartbeat** — Proactive actions not needed for tenants.
**No autonomy settings** — All tools use fixed autonomy levels above.
**No learning** — Tenant agent doesn't learn; owner agent learns.

---

## Proactive Action Deduplication

Heartbeat must prevent duplicate tasks for the same event:

```sql
-- Before creating a proactive action, check for existing:
SELECT COUNT(*) FROM agent_proactive_actions
WHERE user_id = $1
  AND trigger_type = $2
  AND trigger_source = $3
  AND created_at > NOW() - INTERVAL '24 hours';

-- If count > 0, skip (already handled today)
```

Additionally, add a uniqueness constraint:
```sql
CREATE UNIQUE INDEX idx_proactive_dedup
  ON agent_proactive_actions(user_id, trigger_type, trigger_source, DATE(created_at))
  WHERE was_auto_executed = FALSE;
```

This prevents the heartbeat from creating "Lease expiring" tasks every hour for the same lease.

---

## Agent ↔ Notification Integration

When the agent executes a tool that triggers a notification (e.g., `send_rent_reminder`, `approve_application`):

1. **Check notification preferences** — Call `should_notify(user_id, notification_type, channel)` before sending
2. **Respect quiet hours** — Don't send SMS/push during user's quiet hours (stored in Mission 17 `notification_preferences`)
3. **Single approval** — When owner approves an agent action, that approval covers both the action AND the notification (no double-approval)
4. **Suppression** — If agent autonomy is L3+ for the action category, notifications send without additional approval

---

## Agent Audit Logging

Every tool execution that writes data must be logged for compliance:

```typescript
// After every mutation tool execution:
await supabase.from('agent_decisions').insert({
  user_id,
  conversation_id,
  task_id,
  tool_name,
  tool_params,
  result,
  reasoning: agent_reasoning_text,
  confidence,
  duration_ms,
  was_auto_executed: autonomy_level >= L3,
});
```

This provides a complete audit trail of every agent action, distinguishing between user-approved and auto-executed actions.

---

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
AGENT_MODEL=claude-sonnet-4-20250514
AGENT_MAX_ITERATIONS=10
AGENT_TIMEOUT_MS=30000
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Deferred from Mission 04: AI-Generated Listing Description

The following items were deferred from Mission 04 (Property Listings) because they require the agent infrastructure built in this mission. They MUST be implemented as part of Mission 14.

### useGenerateListing Hook & GenerateButton Component

The "first visible AI" in the app — a button on CreateListingScreen that generates listing copy from property data.

**Files to create**:
```
packages/api/src/hooks/useGenerateListing.ts
```

**useGenerateListing hook**:
```typescript
interface GenerateListingResult {
  title: string;           // Catchy, SEO-friendly title
  description: string;     // Highlights features, neighbourhood, lifestyle
  suggestedRent?: number;  // Based on comparable properties
}

export function useGenerateListing() {
  const generate = async (propertyData: {
    bedrooms: number;
    bathrooms: number;
    parkingSpaces: number;
    suburb: string;
    propertyType: string;
    features: string[];
  }): Promise<GenerateListingResult> => {
    // Calls agent-chat Edge Function with generate_listing_copy tool
    // Returns draft content for owner to edit/approve
  };

  return { generate, loading, error };
}
```

**Integration on CreateListingScreen** (`apps/owner/app/(app)/listings/create.tsx`):
- Add "Generate with AI" button in the details step
- Pre-fills title and description from AI response
- Owner can edit the generated content before publishing

### VacancyBanner AI Integration
When Pro/Hands-Off users see the VacancyBanner and tap "Create Listing with AI":
- Navigate to CreateListingScreen with property pre-selected
- Auto-trigger `useGenerateListing` to pre-fill listing copy

---

## Gateway Implementation (Pre-Built)

> The following gateway infrastructure was created in Mission 07 to facilitate this mission:

### Files Created
- `packages/api/src/hooks/gateways/useAgentGateway.ts` — Hook with navigation entry points and placeholder state
- `packages/api/src/types/gateways.ts` — Type definitions for agent entities

### What's Already Done
1. **Types defined**: All TypeScript interfaces including AgentConversation, AgentMessage, AgentPendingAction, AgentAutonomyLevel
2. **Gateway hook**: `useAgentGateway()` provides navigation, agent actions, streaming, memory methods (all currently stubs)
3. **Exported from `@casa/api`**: Import directly in components

### What This Mission Does
1. Create agent database tables via migration
2. Create `agent-chat` Edge Function with 3-pass reasoning loop
3. Create `agent-heartbeat` Edge Function for proactive actions
4. Build Chat tab with streaming display
5. Build Tasks tab with rich timeline/reasoning UX
6. Implement autonomy gating and user-adjustable thresholds
7. Wire AgentProvider into both apps
8. Implement ~15 MVP tools
9. Connect existing gateway hooks to real Edge Function endpoints

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Supabase Edge Functions (not Cloudflare) | Simpler architecture, same Supabase environment, no separate deployment |
| Proactive heartbeat engine | Clawdbot-inspired: agent reaches out, doesn't wait to be asked |
| User-adjustable autonomy | Trust builds over time; users control how much the agent does alone |
| Tasks as rich decision surface | Transparency builds trust; users see reasoning, not just results |
| Chat + Tasks as primary UI | Manual screens become backup; agent handles orchestration |
| 15 MVP tools (not 87) | Ship core value fast, activate more tools progressively |
| Timeline-driven task cards | Full audit trail of agent decisions builds confidence |

---

## Tool Implementation Status

This section tracks overall tool coverage to ensure Mission 14 delivers a complete, launch-ready agent.

| Category | Total | Implemented | Remaining | Priority |
|----------|-------|-------------|-----------|----------|
| Query | 32 | 8 | 24 | P1 — all must work for chat to be useful |
| Action | 38 | 5 | 33 | P1 — core actions needed for automation |
| Generate | 17 | 2 | 15 | P1 — report/document generation |
| External | 8 | 0 | 8 | P1 for SendGrid/Twilio/Stripe, P2 for others |
| Workflow | 5 | 0 | 5 | P1 for maintenance/arrears, P2 for others |
| Memory | 3 | 0 | 3 | P2 — activates in Mission 15 |
| Planning | 1 | 0 | 1 | P2 |

**Minimum viable for launch:** All query tools, 20 core action tools, 8 generate tools, SendGrid + Twilio + Stripe integrations, maintenance_resolution workflow.

### Implementation Sequence

To reach launch readiness, implement remaining tools in this order:

1. **All remaining query tools** (24) — these are read-only and low-risk, enabling the agent to answer any question about the owner's portfolio
2. **Core action tools** (20 of 33) — focus on the tools required by P1 workflows: maintenance assignment, tenancy creation, lease generation, rent increase, inspection scheduling
3. **Generate tools** (8 of 15) — prioritise listing copy, lease documents, breach notices, income reports, and tax summaries
4. **External integrations** (3 of 8) — SendGrid (email), Twilio (SMS), Stripe (payments) are required for any real automation
5. **P1 workflows** (2 of 5) — `workflow_maintenance_resolution` and `workflow_arrears_escalation` are the highest-value automations
6. **Remaining action tools** (13) — bond lodgement, payment plans, property updates, etc.
7. **Remaining generate tools** (7) — portfolio reports, inspection reports, improvement suggestions
8. **P2 workflows** (3) — tenant finding, onboarding, end tenancy
9. **P2 external integrations** (5) — Domain, REA, Equifax, TICA, State Bond APIs
10. **Memory + Planning tools** (4) — activates self-evolving intelligence

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All agent tables created and RLS policies verified
- [ ] `agent_conversations` + `agent_messages` store chat correctly
- [ ] `agent_tasks` store timeline + reasoning data
- [ ] `agent_pending_actions` created for gated tools
- [ ] `agent_autonomy_settings` stores presets + category overrides
- [ ] `agent_proactive_actions` logs heartbeat actions
- [ ] `agent_decisions` audit trail captures all tool executions
- [ ] `agent_trajectories` records execution paths
- [ ] Users can only access their own agent data (RLS)

### Feature Verification (Mission-Specific)
- [ ] Chat tab sends messages and receives streaming responses
- [ ] Agent answers natural language queries about properties, tenants, payments
- [ ] Agent executes query tools autonomously (L4) without approval
- [ ] Agent shows inline action cards for approval-required actions
- [ ] Owner can approve or reject pending actions from Tasks tab
- [ ] Tasks tab shows 4 sections: Needs Input, In Progress, Scheduled, Completed
- [ ] Task cards display timeline with reasoning and recommendations
- [ ] "Take Control" pauses agent management of a task
- [ ] Heartbeat engine scans for events and creates proactive actions
- [ ] Proactive messages appear in Chat tab
- [ ] Autonomy settings screen shows presets and category sliders
- [ ] Changing autonomy preset affects agent behavior
- [ ] Home screen shows agent-surfaced insights instead of static quick actions
- [ ] Deep links from Tasks navigate to correct detail screens
- [ ] Tool call summaries show collapsible details
- [ ] Response time <3s for simple queries
- [ ] AgentProvider tracks pending count for tab badge

### Visual & UX
- [ ] Tested on physical iOS device via Expo Go
- [ ] UI matches BRAND-AND-UI.md design system
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes

### Regression (All Prior Missions)
- [ ] All prior mission critical paths still work
- [ ] Navigation between all existing screens works
- [ ] Previously created data still loads correctly
- [ ] No new TypeScript errors in existing code

### Auth & Security
- [ ] Authenticated routes redirect unauthenticated users
- [ ] User can only access their own data (RLS verified)
- [ ] Session persists across app restarts
- [ ] No sensitive data in logs or error messages
- [ ] Edge Function authenticates requests via Supabase JWT
- [ ] Tool executions respect autonomy levels
- [ ] Conversation data isolated per user

---

## Validation Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Commit Message Pattern

```
feat(agent): <description>

Mission-14: AI Agent — Proactive Autonomous Property Manager
```
