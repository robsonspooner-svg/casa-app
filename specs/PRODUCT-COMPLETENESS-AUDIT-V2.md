# Casa Product Completeness Audit — V2

> **Date:** 2026-02-14
> **Auditor:** Claude Opus 4.6 with full codebase access
> **Scope:** Complete product lifecycle audit — "code that works" vs "product that works"
> **Methodology:** 8 parallel deep-dive agents traced every workflow step through tool-handlers, hooks, Edge Functions, UI screens, database schema, agent orchestrator, and notification templates
> **Status:** AUDIT ONLY — No fixes applied
> **Key context from product owner:** "The owner should only open the app a few times per year. 95% of app usage should be reviewing/accepting agent-proposed tasks. Casa AI should be doing most of the work."

---

## SECTION 1: WORKFLOW GAPS

### WORKFLOW 1: MAINTENANCE REQUEST

The most common workflow. 12 of 15 steps are wired; 3 have gaps.

| Step | Status | Detail |
|------|--------|--------|
| a) Tenant submits request with description + photos | **WIRED** | Form captures category, urgency, title, description, location, access instructions. `uploadImage()` function exists but photo upload UI is not wired in `new.tsx` |
| b) Owner receives push + email notification | **PARTIAL** | Notification dispatched via `dispatch-notification` with channels `['push', 'email']`, but uses generic template — no maintenance-specific email with request details, photos, urgency badge |
| c) Request appears in owner's maintenance list | **WIRED** | Full dashboard with filtering by status/urgency, summary cards |
| d) Owner asks AI "What's open?" → AI lists with context | **WIRED** | `get_maintenance` tool (autonomy L4) with property/status/urgency filters |
| e) Owner says "Get quotes" → AI drafts quote request | **WIRED** | `request_quote` tool creates work_order, sends email to tradesperson |
| f) AI sends quote request to tradesperson via email | **WIRED** | Resend API email with property address, issue details, access instructions. Owner CC'd. Audit trail logged as maintenance comment |
| g) Quotes come back → AI presents comparison | **WIRED** | `compare_quotes` tool fetches work_orders with trade details, ratings; AI ranks by price/quality/speed |
| h) Owner approves quote | **WIRED** | `approve_quote` updates work_order status + maintenance_request status |
| i) AI notifies tenant of booking | **WIRED** | `approve_quote` handler calls `dispatchNotif()` with booking confirmation message |
| j) Tenant sees status update | **WIRED** | Tenant detail screen shows status badges + timeline. Uses Supabase queries (not realtime subscription) |
| k) Work marked complete with cost | **WIRED** | Status transition buttons in owner UI. Records timestamp, changed_by, notes |
| l) AI notifies tenant of completion | **MISSING** | No automatic notification when owner marks maintenance as complete. Tenant only sees if they manually check |
| m) Cost recorded in financial records | **PARTIAL** | Cost fields saved to `maintenance_requests` table (actual_cost, cost_responsibility). But costs do NOT flow to `transactions` table or `financial_summary` view |
| n) Timeline view in both apps | **WIRED** | Full status history with timestamps in both owner and tenant apps via `maintenance_status_history` table |
| o) AI can reference in future | **WIRED** | `get_maintenance_detail` retrieves full history including quotes, comments, costs |

**Priority gaps:**
- **P0:** Maintenance completion notification missing — tenant left in the dark when work is done
- **P1:** Financial integration — maintenance costs exist but don't appear in financial reporting
- **P2:** Photo upload UI not wired in tenant submission form (backend ready)
- **P2:** Generic notification template — should show urgency, category, address in email

---

### WORKFLOW 2: DOCUMENT GENERATION AND SHARING

Strong end-to-end flow. 10 of 12 steps wired.

| Step | Status | Detail |
|------|--------|--------|
| a) Owner asks AI to generate document | **WIRED** | `generate_lease`, `generate_notice`, `generate_financial_report`, `generate_tax_report`, `generate_inspection_report`, `generate_property_summary` tools all implemented |
| b) AI generates document as PDF | **PARTIAL** | Documents stored as HTML content, not actual PDFs. PDF is generated on-demand at view/download time via Expo Print API. No server-side PDF engine for email attachments |
| c) Document saved to documents system | **WIRED** | `create_document` inserts into `documents` table with owner_id, property_id, tenancy_id, html_content, tags, status. Document versioning via `document_versions` table |
| d) Document appears in owner's documents tab | **WIRED** | Full document viewer at `documents/[id].tsx` with WebView for HTML, PDF viewer, image viewer |
| e) Owner can preview in-app | **WIRED** | WebView renders HTML content. PDF preview via Google Docs viewer. Image preview with zoom. SignaturePad for owner signing |
| f) Owner asks AI to revise | **WIRED** | `update_document` tool saves previous version to `document_versions`, updates with new HTML, increments version number |
| g) Owner says "Send to tenant" | **WIRED** | `submit_document_email` sends via Resend API with branded template, creates `document_shares` record, sends push notification, updates document status to 'submitted' |
| h) Tenant receives push notification | **WIRED** | `dispatch-notification` called with type `document_shared`, creates notification record, sends Expo push |
| i) Tenant can view in their app | **WIRED** | Tenant documents screen at `tenancy/documents.tsx` lists documents from `tenancy_documents` table. Same viewer as owner app |
| j) Document status tracking (sent/viewed/acknowledged) | **WIRED** | `document_shares` tracks access_count + last_accessed_at. `document_access_log` records view/download/print/share actions. `document_signatures` tracks signing |
| k) AI can follow up on unviewed documents | **PARTIAL** | AI can query via `get_document` which includes shares, but no dedicated `get_document_access_log` tool. No `remind_unsigned_documents` tool |
| l) AI can query all documents | **WIRED** | `get_documents` (filter by type/property/tenancy) + `search_documents` (full-text search via PostgreSQL GIN index with relevance ranking) |

**Priority gaps:**
- **P1:** No server-side PDF generation — email attachments are HTML, not proper PDFs
- **P2:** No dedicated tool for querying document access logs or sending signature reminders
- **P2:** No bulk document operations (send same document to multiple tenants)

---

### WORKFLOW 3: RENT COLLECTION AND ARREARS

Core payment flow works. Major gap: no proactive pre-due reminders.

| Step | Status | Detail |
|------|--------|--------|
| a) Pre-due rent reminders (3d, 1d, day-of) | **MISSING** | No cron job or Edge Function sends reminders BEFORE rent is due. `process-autopay` handles auto-payment but not reminders. `send-arrears-reminder` only processes AFTER arrears detected |
| b) Payment received → recorded | **WIRED** | Tenant initiates via `create-rent-checkout` Edge Function → Stripe Checkout → `stripe-webhook` updates payment status to 'completed', marks rent_schedule as paid |
| c) Receipt sent to tenant | **PARTIAL** | Stripe `receipt_url` captured in webhook, but no automatic receipt email or push notification sent. `send_receipt` tool exists but is never called automatically |
| d) Owner notified of payment | **MISSING** | No notification sent to owner when rent payment succeeds. Owner only sees payment via query or dashboard |
| e) Overdue detection | **WIRED** | `process-arrears` Edge Function queries unpaid rent_schedules past due, creates `arrears_records` with auto-calculated severity |
| f) Day 1 overdue: friendly reminder | **WIRED** | `send-arrears-reminder` selects template by `days_overdue`, sends via Resend email, logs to `arrears_actions` |
| g) Day 3 escalation | **PARTIAL** | Templates selected by current `days_overdue` on each run. No discrete "Day 1 → Day 3 → Day 7" state machine — system responds to elapsed days, not milestone triggers |
| h) Day 7: formal notice for owner approval | **PARTIAL** | `send_breach_notice` tool exists (L0 — always requires approval), but no automatic trigger at day 7. Owner app shows breach notice button only at day 14+, not day 7 |
| i) Day 14+: AI recommends next steps | **PARTIAL** | AI has tools (`escalate_arrears`, `resolve_arrears`, `log_arrears_action`) but doesn't proactively recommend legal escalation. Must be asked |
| j) Arrears visible in owner dashboard | **WIRED** | Full arrears screen with severity breakdown, total amounts, action timelines, payment plan tracking |
| k) Arrears visible to tenant | **WIRED** | Tenant arrears screen with severity banner, amount overdue, days overdue, communication history, payment plan view |
| l) Tenant pays → arrears resolved | **PARTIAL** | `process-arrears` marks `is_resolved = true` when all payments made — but only on next daily cron run. No real-time resolution |
| m) Payment history reflects lateness | **WIRED** | Data exists (due_date vs paid_at) to compute lateness, but no explicit `is_late` or `days_late` field shown in UI |
| n) AI can report on payment patterns | **MISSING** | No `analyze_payment_patterns` or `get_payment_statistics` tool. AI can manually query `get_payments` but has no pattern analysis capability |

**Priority gaps:**
- **P0:** Pre-due rent reminders missing entirely — tenants get no warning before rent is due
- **P0:** Owner not notified when rent is paid — critical feedback loop broken
- **P1:** Receipt not automatically sent to tenant after payment
- **P1:** Real-time arrears resolution — paying at 2pm shouldn't show arrears until 6am next day
- **P2:** No payment pattern analysis tool for AI

---

### WORKFLOW 4: INSPECTION LIFECYCLE

Framework is solid; automation gaps prevent end-to-end flow.

| Step | Status | Detail |
|------|--------|--------|
| a) AI proactively suggests inspection due | **PARTIAL** | Background task `inspection_scheduling` defined (Monday 8am) with `schedule_inspection` tool, but no logic to calculate WHICH properties are due. No algorithm based on last inspection date + state rules |
| b) Owner approves, state notice period checked | **WIRED** | Handler queries `tenancy_law_rules` for state-specific notice_days, notice_business_days, max frequency. Supports all 8 Australian states |
| c) AI sends notice to tenant | **PARTIAL** | Tenant receives `inspection_scheduled` push notification with property address and date. But no time included, no mechanism for tenant to propose alternatives |
| d) Tenant confirms or requests alternative | **MISSING** | No UI or API for tenant to confirm/negotiate inspection time. Tenant review screen only allows post-inspection actions (photos, disputes, signing) |
| e) Date confirmed, appears in both apps | **WIRED** | Both owner and tenant apps display inspection lists with scheduled dates, times, status filtering |
| f) Guided inspection flow (room by room) | **WIRED** | Owner: room-by-room conduct flow with condition rating + photos. Tenant: review each item, suggest changes, raise disputes, add photos, sign |
| g) Report generated as PDF | **PARTIAL** | HTML report generated with room breakdown and condition badges. No PDF conversion — only HTML rendering |
| h) Report saved to documents | **PARTIAL** | `create_document` tool available with `document_type: 'inspection_report'`, but NOT automatically triggered on inspection finalization. Requires explicit agent call |
| i) Report shared with tenant | **PARTIAL** | `submit_inspection_to_tenant` moves to tenant_review status + sends notification. But automatic share of the report document requires separate tool call |
| j) Issues found → AI creates maintenance requests | **PARTIAL** | `inspection_finalized` event exists in orchestrator, but agent must explicitly iterate inspection items and create maintenance. No automatic database trigger |
| k) Inspection history viewable | **WIRED** | Both apps show full inspection history with filtering |
| l) AI can compare inspections | **WIRED** | `compare_inspections` tool uses Claude Vision API to analyze photo changes, determines wear vs tenant damage, recommends bond deductions |

**Priority gaps:**
- **P0:** Tenant cannot negotiate inspection time — unilateral scheduling with no input
- **P1:** No auto-detection of which properties are due for inspection
- **P1:** Report not auto-saved to documents or auto-shared on finalization
- **P2:** No auto-creation of maintenance requests from inspection findings

---

### WORKFLOW 5: LEASE MANAGEMENT AND RENEWAL

Good tooling; missing the "60-day recommendation" and tenant response workflows.

| Step | Status | Detail |
|------|--------|--------|
| a) AI alerts "lease expires in 90 days" | **WIRED** | `lease_expiring_soon` event in orchestrator (Sonnet model). Daily batch review checks all tenancies with leases expiring within 90 days |
| b) AI recommends renewal/increase/periodic at 60 days | **PARTIAL** | `analyze_rent` and `suggest_rent_price` tools exist but no external market API is wired. No explicit 60-day trigger — only 90-day alert |
| c) Owner decides → AI generates document | **WIRED** | `generate_lease`, `generate_notice` (with `notice_type: 'rent_increase'`), `create_rent_increase` tools all implemented with state-compliant templates |
| d) Document sent to tenant | **WIRED** | `submit_document_email` + `share_document` tools handle email + in-app sharing |
| e) Tenant responds (accept/negotiate/vacate) | **MISSING** | No formal tenant response workflow for lease renewal. No acceptance/rejection UI. Chat-based response possible but not structured |
| f) If renewal: new lease, signed, old archived | **PARTIAL** | `renew_lease` tool creates new lease with dates + optional rent adjustment. But no validation that old lease is archived, no handoff workflow |
| g) If vacating: exit inspection, bond, relisting | **WIRED** | `workflow_end_tenancy` tool coordinates: exit inspection → compare with entry → bond processing. `workflow_find_tenant` for relisting |
| h) All documents/communications logged | **WIRED** | `agent_events`, `agent_decisions` tables log all actions. `get_documents` + `search_documents` for querying |
| i) AI tracks lease dates across all properties | **WIRED** | Daily batch review loops all properties, checks `lease_end_date` index. Weekly/monthly reviews use Sonnet model for deeper analysis |

**Priority gaps:**
- **P0:** No tenant response mechanism for lease renewals — critical for the back-and-forth negotiation the product owner described
- **P1:** No 60-day specific trigger — current 90-day alert is too early for action
- **P2:** No market data integration for rent analysis despite tools existing

---

### WORKFLOW 6: TENANT ONBOARDING AND CONNECTION

Strongest workflow — nearly complete end-to-end.

| Step | Status | Detail |
|------|--------|--------|
| a) Owner adds property and tenant details | **WIRED** | `create_property` and `create_tenancy` tools + full UI forms |
| b) Owner sends invitation | **WIRED** | `useConnectionCodes` hook generates 6-character cryptographic code. `invite_tenant` tool available. Owner connections screen shows codes |
| c) Tenant downloads app, signs up, enters code | **WIRED** | Tenant signup flow → connection code screen with clear instructions, 6-char uppercase input |
| d) Tenant connected to tenancy | **WIRED** | `tenant_connect_with_code` tool validates code, links tenant to tenancy. Rate-limited (3s cooldown, 5 attempts/min) |
| e) Tenant sees lease, rent, property, documents | **WIRED** | Tenant tenancy screen, lease screen, documents screen, payment history — all querying real data via `useMyTenancy()` |
| f) Tenant receives AI welcome message | **PARTIAL** | AI chat available to tenant, onboarding introduces AI capabilities. But no automatic welcome message triggered on connection completion |
| g) Future communications flow through system | **WIRED** | `send_message`, `create_conversation`, `send_in_app_message` tools. All comms logged in conversations/messages tables |
| h) Owner sees tenant connection status | **WIRED** | Owner connections screen tracks code usage, attempt counts, expiry dates via `connection_codes` + `connection_attempts` tables |

**Priority gaps:**
- **P1:** No automatic AI welcome message after tenant connects — missed onboarding moment
- **P2:** Connection completion doesn't auto-trigger entry inspection scheduling

---

### WORKFLOW 7: FINANCIAL OVERVIEW AND REPORTING

Fully wired end-to-end.

| Step | Status | Detail |
|------|--------|--------|
| a) Owner asks "How are properties performing?" | **WIRED** | `get_financial_summary` tool (L4 autonomous) uses `financial_summary` materialized view + maintenance cost aggregation |
| b) AI provides summary with net per property | **WIRED** | Returns income, expenses, maintenance costs by property and period |
| c) Real-time financial dashboard with charts | **WIRED** | Custom SVG bar chart (6-month income vs expenses), portfolio summary via `get_portfolio_summary()` RPC, per-property metrics via materialized view |
| d) Income and expenses tracked per property | **WIRED** | `financial_summary` view, `manual_expenses` table, `payments` table. `useExpenses()` hook with filters |
| e) Owner can add manual expenses | **WIRED** | `useExpenses()` hook provides `addExpense()`, `updateExpense()`, `deleteExpense()` mutations. Categories supported |
| f) End of FY: AI generates tax summary | **WIRED** | `generate_tax_report` tool (L3) fetches payments + manual expenses for FY, generates ATO-compliant categories |
| g) Report exportable as PDF | **WIRED** | `create_document()` saves report as HTML document. Expo Print API converts to PDF on device |
| h) AI answers detailed financial questions | **WIRED** | `get_financial_summary`, `get_transactions`, `get_expenses`, `get_payment_plan` tools all at L4 autonomy |

**Priority gaps:**
- **P2:** Manual expenses not exposed as AI tool — owner must use UI, can't say "add $800 council rates for 42 Smith St"
- **P2:** Maintenance costs don't flow to `transactions` table (gap shared with Workflow 1)

---

## SECTION 2: CROSS-APP COMMUNICATION GAPS

### Real-Time Sync Assessment

The app uses 3 active Supabase Realtime subscriptions:
1. `useNotifications.ts` — subscribes to `notifications` INSERT events
2. `useConversations.ts` — subscribes to conversation participant changes
3. `useUnreadCount.ts` — subscribes to notification table changes

| Data Flow | Owner Experience | Tenant Experience | Notification | Sync Type |
|-----------|-----------------|-------------------|--------------|-----------|
| 1. Property update | Immediate (own data) | Not directly visible to tenant | None | N/A |
| 2. Document shared | N/A | **REAL-TIME** badge, **MANUAL** list | Push + in-app | Notification Realtime, list manual |
| 3. Maintenance submitted | **NEAR-RT** (push alerts) | N/A | Push + email | Notification Realtime, list manual refresh |
| 4. Maintenance status update | N/A | **NEAR-RT** (push alerts) | Push | Notification Realtime, detail manual refresh |
| 5. Inspection scheduled | N/A | **NEAR-RT** (push) | Push | Notification Realtime, list manual |
| 6. Rent payment recorded | **MANUAL** | **MANUAL** | **NONE** | No Realtime, no notification |
| 7. Owner message via AI | N/A | **REAL-TIME** | Push | `useConversation()` Realtime |
| 8. Tenant message | **REAL-TIME** | N/A | Push | `useConversation()` Realtime |
| 9. Arrears notice | N/A | **REAL-TIME** badge, **MANUAL** view | Push | Notification Realtime, view manual |
| 10. Connection code used | **MANUAL** | **MANUAL** | **NONE** | No Realtime, no notification |

### Critical Cross-App Gaps

**P0 — No notification on rent payment (Flow 6):**
Neither owner nor tenant receives any notification when a rent payment succeeds. This is the single most important event in the system — the moment money moves — and it's completely silent.

**P1 — No notification on tenant connection (Flow 10):**
When a tenant successfully connects using a code, the owner isn't notified. This is a high-anticipation moment (owner has been waiting for tenant to connect) with no feedback.

**P1 — Maintenance list not Realtime-subscribed:**
Owner's maintenance list requires manual refresh. If a tenant submits an urgent maintenance request while the owner is already on the maintenance screen, it won't appear until they pull-to-refresh.

**P2 — `useFocusEffect` not consistently applied:**
Several hooks should auto-refresh when the user navigates back to a screen. The pattern exists in inspections but isn't applied to maintenance, payments, or documents hooks.

---

## SECTION 3: AI CAPABILITY GAPS

### 3.1 Tool Inventory Summary

The agent has **158 tools** registered, with **148 active** and **10 intentionally stubbed** (hidden from Claude with documented workarounds).

| Category | Active | Stubs | Notes |
|----------|--------|-------|-------|
| Query | 30 | 0 | All L4 autonomous |
| Action | 43 | 0 | L0-L4 with autonomy gating |
| Generate | 24 | 0 | L1-L3 |
| Document | 9 | 0 | L1-L2 |
| Workflow | 5 | 0 | L1-L2 |
| Memory/Planning | 7 | 0 | L3-L4 |
| External/Integration | 30 | 10 | Stubs: Domain/REA, Equifax, TICA, DocuSign, Twilio, hipages, Stripe collect/refund, state bond |

### 3.2 System Prompt vs Reality

The system prompt claims 16 capability categories. **All 16 are implemented.** No false claims found. The system prompt accurately describes what the agent can and cannot do, including workarounds for stubbed integrations.

### 3.3 Proactive Behaviors

The agent orchestrator handles these event types proactively:
- `payment_completed`, `payment_failed`
- `maintenance_submitted`, `maintenance_submitted_emergency`
- `tenancy_created`, `tenancy_terminated`
- `inspection_finalized`
- `lease_expiring_soon`
- `arrears_escalation`
- `compliance_overdue`
- `application_received`

Plus scheduled batch reviews: daily (Haiku), weekly (Sonnet), monthly (Sonnet).

**All proactive behaviors are implemented and functional.** Current limitation: orchestrator requires manual HTTP trigger with CRON_SECRET header. Production deployment needs pg_cron wiring.

### 3.4 AI Capability Gaps

**Missing tools that should exist:**

1. **`add_manual_expense`** — Owner can't add expenses via chat. Must use UI. "Add $800 council rates for 42 Smith St" should work.

2. **`send_rent_reminder_predue`** — No tool for pre-due reminders. Only post-arrears reminders exist.

3. **`analyze_payment_patterns`** — AI can't identify "this tenant is always 3 days late" patterns. Only raw data queries.

4. **`get_document_access_log`** — AI can't see who viewed/downloaded documents. Only share counts via `get_document`.

5. **`remind_unsigned_documents`** — AI can't send reminders for unsigned documents. Must manually draft and send.

6. **`respond_to_lease_renewal`** (tenant-side) — No structured way for tenants to accept/reject/negotiate lease changes.

7. **`negotiate_rent_increase`** (tenant-side) — No tool for tenant to counter-propose rent amounts.

### 3.5 App Screens Without Chat Equivalent

~90% of owner app screens can be fully accessed via AI chat. The 10% that cannot:
- Upload property photos (upload endpoint exists, no AI coordination)
- Sign documents in-app (SignaturePad is UI-only)
- Direct Stripe payment processing (collection/refund are stubs)
- Change push notification preferences
- Change user profile avatar

### 3.6 AI Context and Memory

- **Per-message context:** User profile, all properties, autonomy settings, top 20 rules, top 30 preferences, top 8 golden trajectories, tool genome warnings, tool co-occurrence patterns, semantic preference search, tenancy count, state regulatory rules
- **Conversation history:** Last 40 messages, 120K token budget with compaction
- **Cross-conversation memory:** `search_precedent` tool finds similar past decisions via pgvector. Correction-to-rule pipeline generates persistent rules from owner feedback
- **Gap:** Conversations are isolated. Agent can't say "Last week you asked about..." unless it created a rule/preference from that interaction

---

## SECTION 4: USER GUIDANCE AND DISCOVERABILITY GAPS

### 4.1 Onboarding

| App | Onboarding Exists | AI Introduction | Post-Onboarding Welcome |
|-----|-------------------|-----------------|------------------------|
| Owner | Yes — 3-slide flow with "Meet Your AI Property Manager" | Yes — explains automation | **MISSING** — no AI welcome message after setup |
| Tenant | Yes — slides + connection code entry | Yes — "Chat with Casa AI" slide | **MISSING** — no AI welcome message after connection |

### 4.2 Empty States

| Screen | Empty State Exists | CTA Button | AI Guidance |
|--------|-------------------|------------|-------------|
| Owner: Maintenance | Yes — "No active maintenance requests" | No | No |
| Owner: Documents | Yes — "No documents yet" | Yes — "Upload Document" | Partial — mentions "ask Casa Agent" in text |
| Owner: Arrears | Yes — "No tenants in arrears" | No | No |
| Tenant: Maintenance | Yes — "No maintenance requests" | Yes — "Submit a Request" + FAB | No |
| Tenant: Documents | Yes — "No documents yet" | No | Passive — "Documents will appear once uploaded by landlord" |

**Gap:** Empty states lack AI guidance. None say "Try asking Casa to..." or provide a chat link.

### 4.3 Contextual AI Suggestions

| Feature | Owner App | Tenant App |
|---------|-----------|------------|
| Chat suggestion chips | **CONTEXT-AWARE** — generated from real data (arrears, inspections, vacancies). 6 chips max | **STATIC** — 4 fixed suggestions ("When is my rent due?", "Report maintenance", "Lease terms", "Connection code") |
| Inline navigation from chat | **YES** — `suggest_navigation` tool renders tappable cards linking to app screens | **MISSING** — Tenant chat has no inline navigation |
| Inline approval actions | **YES** — Approve/Decline buttons rendered in chat | **MISSING** — Tenant can't approve anything inline |
| Tool call feedback | **YES** — Shows tool count, expandable list, action vs lookup classification | **BASIC** — Shows count and names only |

**Gap:** Tenant app is significantly behind owner app in chat capabilities. Context-aware suggestions, navigation links, and approval actions are all missing.

### 4.4 Action Feedback

**Gap: No success toasts after form submissions.** When a tenant submits a maintenance request, or an owner adds a property, there's no visual confirmation toast. Some screens use `Alert.alert()` but not consistently. The user is left wondering "did that work?"

### 4.5 Navigation from AI

Owner chat supports `suggest_navigation` tool with 21 documented routes. When AI mentions a property, maintenance request, or document, it can render a tappable card linking directly to that screen.

**Gap:** Tenant chat does not render any navigation actions. AI mentions things but they're plain text.

---

## SECTION 5: IMPLEMENTATION PLAN

### Sprint 1: "The Chain" — Wire the 3 Critical End-to-End Workflows

**Goal:** Maintenance, Documents, and Rent work completely from trigger to resolution across both apps.

| Item | Priority | Files to Modify |
|------|----------|----------------|
| Add pre-due rent reminders (3-day, 1-day before due) | P0 | New Edge Function: `supabase/functions/send-rent-reminders/index.ts` + pg_cron schedule |
| Add owner notification on rent payment | P0 | `supabase/functions/stripe-webhook/index.ts` — call `dispatchNotif()` after payment success |
| Add tenant notification on maintenance completion | P0 | `packages/api/src/hooks/useMaintenanceMutations.ts` — call dispatchNotif in updateStatus when status='completed' |
| Auto-send receipt to tenant after payment | P1 | `supabase/functions/stripe-webhook/index.ts` — call `send_receipt` tool or send email directly |
| Wire maintenance costs to financial_summary | P1 | `supabase/functions/_shared/tool-handlers-actions.ts` — insert into `transactions` when marking maintenance complete with cost |
| Real-time arrears resolution on payment | P1 | `supabase/functions/stripe-webhook/index.ts` — call arrears resolution check immediately after payment |
| Wire photo upload UI in tenant maintenance form | P2 | `apps/tenant/app/(app)/maintenance/new.tsx` — call existing `uploadImage()` function |
| Maintenance-specific notification template | P2 | `supabase/functions/_shared/notification-templates.ts` + `dispatch-notification/index.ts` |

**Estimated scope:** ~15 files, concentrated in Edge Functions and hooks

---

### Sprint 2: "The Brain" — Make AI the Omniscient Coordinator

**Goal:** Every manual action gets a chat equivalent. AI proactively drives every workflow.

| Item | Priority | Files to Modify |
|------|----------|----------------|
| Add `add_manual_expense` tool | P1 | `tool-registry.ts`, `tool-dispatcher.ts`, `tool-handlers-actions.ts` |
| Add `analyze_payment_patterns` tool | P1 | `tool-registry.ts`, `tool-dispatcher.ts`, `tool-handlers.ts` |
| Add `get_document_access_log` tool | P2 | `tool-registry.ts`, `tool-dispatcher.ts`, `tool-handlers.ts` |
| Add `remind_unsigned_documents` tool | P2 | `tool-registry.ts`, `tool-dispatcher.ts`, `tool-handlers-generate.ts` |
| Auto-trigger inspection report save + share on finalization | P1 | `tool-handlers-actions.ts` (finalize_inspection handler) |
| Auto-detect which properties are due for inspection | P1 | `supabase/functions/agent-orchestrator/index.ts` — add inspection due detection to daily batch |
| Auto-create maintenance from inspection findings with action_required | P2 | `supabase/functions/agent-orchestrator/index.ts` — enhance inspection_finalized handler |
| Add 60-day lease renewal trigger (not just 90-day) | P2 | `supabase/functions/agent-orchestrator/index.ts` — add secondary threshold |

**Estimated scope:** ~8 files, concentrated in tool system and orchestrator

---

### Sprint 3: "The Bridge" — Complete Cross-App Data Flows

**Goal:** Owner and tenant apps feel like one system with real-time sync.

| Item | Priority | Files to Modify |
|------|----------|----------------|
| Add Realtime subscription to owner's maintenance list | P1 | `packages/api/src/hooks/useMaintenance.ts` |
| Add notification on tenant connection | P1 | `packages/api/src/hooks/useConnection.ts` or `useConnectionCodes.ts` |
| Add `useFocusEffect` refresh to key hooks | P2 | `useMyMaintenance.ts`, `usePayments.ts`, `useMyTenancy.ts`, `useDocuments.ts` |
| Add notification on payment for both parties | P0 | `supabase/functions/stripe-webhook/index.ts` (overlaps Sprint 1) |
| Context-aware suggestion chips in tenant chat | P1 | `apps/tenant/app/(app)/(tabs)/chat.tsx` |
| Inline navigation actions in tenant chat | P1 | `apps/tenant/app/(app)/(tabs)/chat.tsx` — port InlineActionCards from owner |
| Tool call feedback parity in tenant chat | P2 | `apps/tenant/app/(app)/(tabs)/chat.tsx` — port ToolCallSummary from owner |

**Estimated scope:** ~8 files, concentrated in hooks and tenant chat

---

### Sprint 4: "The Guide" — Contextual AI Suggestions and User Guidance

**Goal:** New users never feel lost. Every screen guides toward the next action.

| Item | Priority | Files to Modify |
|------|----------|----------------|
| Post-onboarding AI welcome message (owner) | P1 | `apps/owner/app/(app)/onboarding/index.tsx` — trigger AI message on complete |
| Post-connection AI welcome message (tenant) | P1 | `apps/tenant/app/(app)/connect/index.tsx` or orchestrator event |
| Add "Try asking Casa..." CTAs to empty states | P2 | Multiple list screens in both apps |
| Add success toasts after form submissions | P2 | `apps/owner/app/(app)/properties/add.tsx`, `apps/tenant/app/(app)/maintenance/new.tsx`, etc. |
| Add AI-powered empty state suggestions | P2 | Key list screens — show AI-suggested actions when empty |

**Estimated scope:** ~12 files, UI-focused

---

### Sprint 5: "The Loop" — Complete Remaining Lifecycle Gaps

**Goal:** Inspections, lease management, and tenant responses are fully automated.

| Item | Priority | Files to Modify |
|------|----------|----------------|
| Tenant inspection time negotiation UI | P0 | New screen: `apps/tenant/app/(app)/inspections/[id]/respond.tsx` + API |
| Tenant lease renewal response UI | P0 | New screen: `apps/tenant/app/(app)/tenancy/renewal-response.tsx` + API |
| Day 7 formal notice auto-trigger | P1 | `supabase/functions/send-arrears-reminder/index.ts` — add formal notice threshold |
| Inspection auto-scheduling logic (which properties are due) | P1 | `supabase/functions/agent-orchestrator/index.ts` |
| Auto-save + auto-share inspection report on finalization | P1 | `supabase/functions/_shared/tool-handlers-actions.ts` |
| Market data API integration for rent analysis | P2 | `supabase/functions/_shared/tool-handlers-generate.ts` — wire external API |
| Server-side PDF generation for email attachments | P2 | New utility or Edge Function for HTML → PDF conversion |

**Estimated scope:** ~10 files, mix of new screens and Edge Function work

---

## APPENDIX: OVERALL COMPLETION MATRIX

| Workflow | Steps Wired | Steps Partial | Steps Missing | Completion |
|----------|-------------|---------------|---------------|------------|
| 1. Maintenance | 12 | 2 | 1 | 85% |
| 2. Documents | 10 | 2 | 0 | 90% |
| 3. Rent/Arrears | 6 | 5 | 3 | 55% |
| 4. Inspections | 5 | 5 | 1 | 55% |
| 5. Lease Management | 6 | 2 | 1 | 72% |
| 6. Tenant Onboarding | 7 | 1 | 0 | 94% |
| 7. Financial Reporting | 8 | 0 | 0 | 100% |
| **Cross-App Sync** | 3 RT, 4 NRT | 1 Manual | 2 Silent | 70% |
| **AI Capabilities** | 148 tools | 10 stubs | 7 missing tools | 94% |
| **User Guidance** | 5 areas | 3 partial | 4 missing | 55% |

### Overall Product Completeness: ~75%

The codebase is architecturally excellent — 158 AI tools, comprehensive database schema, dual-app architecture with shared packages. The gaps are almost entirely in the **connective tissue**: notifications that should fire but don't, automations that should trigger but require manual intervention, and tenant-side features that haven't achieved parity with the owner app.

The most impactful single change would be **Sprint 1** — wiring pre-due rent reminders, payment notifications, and completion notifications. These three changes alone would make the system feel alive and responsive, which is the core promise of Casa.
