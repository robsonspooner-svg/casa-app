# Casa Product Completeness Audit Report

> **Date:** 2026-02-14
> **Scope:** Full product lifecycle audit — code-that-works vs product-that-works
> **Methodology:** Traced every workflow step through actual code paths across tool-handlers, hooks, Edge Functions, UI screens, and database schema
> **Status:** AUDIT ONLY — No fixes applied

---

## SECTION 1: WORKFLOW GAPS

### WORKFLOW 1: MAINTENANCE REQUEST

The most common workflow. Traced from tenant submission through to resolution.

| Step | Status | Detail |
|------|--------|--------|
| a) Tenant submits request + photos | WIRED | `apps/tenant/app/(app)/maintenance/new.tsx` → `useMaintenanceMutations.createRequest()` → DB insert + photo upload to Storage |
| b) Owner receives push + email | PARTIAL | `dispatch-notification` called with `['push','email']` channels, but fire-and-forget with `.catch(() => {})` — errors silently swallowed, no retry |
| c) Request in owner list by urgency | WIRED | `apps/owner/app/(app)/maintenance/index.tsx` with emergency count, urgency color-coding, filter chips |
| d) AI lists open requests | WIRED | `handle_get_maintenance()` in tool-handlers.ts queries by status/urgency/property |
| e) AI drafts quote request to trades | PARTIAL | `handle_create_work_order()` creates work order but cannot email tradespeople |
| f) AI sends quote to tradesperson | **MISSING** | `request_quote` tool registered in tool-registry.ts but **has no handler implementation**. Email template `quote_request` exists in notification-templates.ts but is never called |
| g) Quotes comparison | PARTIAL | `handle_record_quote_response()` records incoming quotes. `compare_quotes` tool registered but **has no handler** |
| h) Owner approves quote | WIRED | `handle_approve_quote()` updates work_orders and maintenance_requests status |
| i) Tenant notified of booking | PARTIAL | `work_order_created` notification fires on work order creation (draft), NOT on approval/scheduling. No "plumber booked for [date]" notification |
| j) Tenant sees status update | WIRED | Tenant maintenance screen shows status badges, but requires manual refresh (no Realtime subscription) |
| k) Mark complete + cost | WIRED | `handle_update_maintenance_status()` + `handle_record_maintenance_cost()` both implemented |
| l) Tenant notified of completion | WIRED | `maintenance_completed` template dispatched via push+email |
| m) Cost in property financials | PARTIAL | Costs stored in maintenance_requests table but **NOT aggregated into financial_summary view**. Financial tools query manual_expenses and payments — not maintenance costs |
| n) Timeline viewable in both apps | PARTIAL | `maintenance_status_history` table stores transitions. Owner detail screen shows data. But **no chronological timeline UI** combining comments, status changes, images, costs. Tenant detail is limited |
| o) AI references in future | PARTIAL | Query tools exist (`get_maintenance`, `get_maintenance_detail`). But no cross-conversation memory — AI must re-query every time. No pattern detection |

**P0 Gaps (dead ends):**
- (f) Cannot send quote requests to tradespeople — the core value prop of AI handling maintenance is broken at this step

**P1 Gaps (manual workaround needed):**
- (e+g) No automated quote comparison — owner must manually compare
- (m) Maintenance costs invisible in financial reports — owner can't see true property P&L

**P2 Gaps (not connected to system):**
- (i) Tenant notification timing wrong (fires on draft, not approval)
- (n) No unified timeline view
- (o) No cross-conversation AI memory

---

### WORKFLOW 2: DOCUMENT GENERATION AND SHARING

| Step | Status | Detail |
|------|--------|--------|
| a) Owner asks AI to generate document | WIRED | `handle_generate_notice`, `handle_generate_lease`, `handle_generate_inspection_report` etc. in tool-handlers-generate.ts |
| b) AI generates as PDF | WIRED | Tools return structured data, AI generates HTML. PDF created at view/export time |
| c) Saved to documents system | WIRED | `handle_create_document()` saves to documents table with owner_id, property_id, tenancy_id, tenant_id, html_content, status |
| d) Appears in owner documents tab | WIRED | `useDocuments` hook + `apps/owner/app/(app)/documents/index.tsx` with search, folders, type badges |
| e) Owner previews in-app | WIRED | `apps/owner/app/(app)/documents/[id].tsx` renders HTML via WebView, PDFs via Google Docs viewer, images via ScrollView |
| f) AI revises existing document | **MISSING** | No tool to update/regenerate existing document content. AI can only create new documents. No versioning workflow |
| g) Send to tenant | WIRED | `handle_submit_document_email()` sends via Resend API. But sending email does NOT automatically create share record or ensure tenant sees it in-app |
| h) Tenant push notification | WIRED | `request_document_signature` sends push via Expo. But only fires for signature requests, not general document sharing |
| i) Tenant views in app | WIRED | Tenant documents screen fetches via useDocuments. Tenant can view HTML/PDF in detail screen |
| j) Track status (sent/viewed) | PARTIAL | `document_access_log` table exists but **is never written to**. Signature tracking works via document_signatures. No "viewed" event |
| k) AI follows up on unviewed | **MISSING** | No tool to query unviewed documents. No automated follow-up workflow |
| l) All documents queryable by AI | WIRED | `get_documents`, `get_document`, `search_documents` tools all implemented |

**P0 Gaps:**
- (f) Cannot revise documents — must regenerate from scratch. No versioning

**P1 Gaps:**
- (g) Email send doesn't guarantee tenant in-app visibility — no share record created
- (h) Push notification only for signatures, not general document sharing
- (j) document_access_log never populated — viewed/downloaded status unknown

**P2 Gaps:**
- (k) No follow-up workflow for unviewed documents

---

### WORKFLOW 3: RENT COLLECTION AND ARREARS

| Step | Status | Detail |
|------|--------|--------|
| a) AI sends pre-due reminders | PARTIAL | `handle_send_rent_reminder()` tool exists but **no scheduled trigger**. No cron job for 3-day/1-day reminders. Manual invoke only |
| b) Payment received → recorded → receipt → owner notified | WIRED | Stripe webhook processes payment, `payment_received` notification template sends push+email |
| c) Arrears process begins | WIRED | `process-arrears` Edge Function runs daily at 6am AEST, scans rent_schedules for overdue, creates arrears_records |
| d) Day 1: friendly reminder | PARTIAL | `send-arrears-reminder` Edge Function exists with template matching by days_overdue. But **no automatic day-1 cron trigger** |
| e) Day 3: escalation | PARTIAL | Severity auto-upgraded in arrears_records. `sendBreachNotice()` mutation exists. **No automatic day-3 trigger** |
| f) Day 7: formal arrears notice | **MISSING** | No automatic formal notice generation. No state-specific notice period compliance. Manual invocation only |
| g) Owner approves → sent via app+email | PARTIAL | Email dispatch works. But **no in-app approval UI** for pending breach notices. Chat-based approval only |
| h) Day 14+: AI recommends next steps | **MISSING** | No state-specific escalation playbooks. `get_tenancy_law` and `check_regulatory_requirements` tools exist but **no automated trigger** |
| i) Owner arrears dashboard | WIRED | `apps/owner/app/(app)/arrears/index.tsx` shows severity, days overdue, amounts, payment plans |
| j) Tenant arrears visibility | **MISSING** | **No tenant arrears screen exists**. Tenant cannot see their arrears status, payment plans, or escalation timeline in-app |
| k) Tenant pays → resolved → both notified | PARTIAL | `resolveArrears` mutation works. But resolution requires next daily cron run (not instant). **No tenant notification on resolution** |
| l) Payment history shows late payments | WIRED | Payments table tracks status (late/paid/failed/pending). Visible in payment screens |
| m) AI reports on patterns | PARTIAL | Financial query tools exist. But **no automatic pattern detection** or proactive alerts for repeated late payments |

**P0 Gaps:**
- (j) Tenant has NO arrears visibility — cannot see where they stand, what's owed, or what the escalation timeline looks like

**P1 Gaps:**
- (a) No automated pre-due reminders — the most basic rent collection feature
- (d-f) No automated escalation chain — each step requires manual invocation
- (h) No state-specific legal playbook automation

**P2 Gaps:**
- (g) No in-app approval UI for breach notices
- (k) Arrears resolution not instant
- (m) No pattern detection

---

### WORKFLOW 4: INSPECTION LIFECYCLE

| Step | Status | Detail |
|------|--------|--------|
| a) AI proactively suggests inspection | **MISSING** | No scheduled job checking inspection frequency. No "inspection_due" event. Manual scheduling only |
| b) Owner approves → notice period check | PARTIAL | `handle_schedule_inspection()` checks tenancy_law_rules for notice period. Returns warning if insufficient but **doesn't block** |
| c) Notice to tenant (app+email) | WIRED | `dispatchNotif()` sends inspection_scheduled notification via push+email |
| d) Tenant confirms or requests alternative | **MISSING** | No tenant response mechanism. No availability confirmation UI. One-way notification only |
| e) Date confirmed in both apps | PARTIAL | Owner sees via useInspections hook. **Tenant has no inspection list screen** |
| f) Guided inspection flow | WIRED | `useInspectionMutations` provides full room-by-room flow: start, add rooms, rate items, upload photos, complete |
| g) Report generated as PDF | WIRED | `generate-inspection-report` Edge Function creates HTML report from inspection data |
| h) Report saved to documents | PARTIAL | Report stored in Supabase Storage but **NOT registered in documents table** — invisible to document management system |
| i) Report shared with tenant | **MISSING** | No tenant sharing mechanism. Tenant cannot view inspection report, photos, or dispute findings |
| j) Issues → auto maintenance requests | PARTIAL | `handle_record_inspection_finding()` sets action_required flag. But **no automatic maintenance request creation** — requires manual follow-up |
| k) Inspection history viewable | WIRED | Owner can view all inspections with condition ratings |
| l) AI compares inspections | WIRED | `compare_inspections` tool + Edge Function compares entry vs exit with change detection |

**P0 Gaps:**
- (d) Tenant cannot respond to inspection notice — no scheduling confirmation
- (i) Tenant cannot view inspection reports — reports are owner-only

**P1 Gaps:**
- (a) No proactive inspection scheduling
- (h) Reports not in documents system — orphaned in Storage
- (j) No auto-creation of maintenance from inspection findings

**P2 Gaps:**
- (e) Tenant has no inspection visibility

---

### WORKFLOW 5: LEASE MANAGEMENT AND RENEWAL

| Step | Status | Detail |
|------|--------|--------|
| a) AI alerts lease expiring 90 days | WIRED | Agent orchestrator daily mode queries tenancies with lease_end_date within 90 days. Added to daily prompt context |
| b) 60-day recommendation | PARTIAL | AI has data in context but **no specific 60-day trigger** or recommendation workflow |
| c) Generate appropriate document | WIRED | `apps/owner/app/(app)/tenancies/[id]/generate-lease.tsx` + `handle_renew_lease` tool |
| d) Document sent to tenant | WIRED | Email sending via generate-lease screen + `handle_share_document` creates share record |
| e) Tenant responds | PARTIAL | Tenant can message via conversation system. **No dedicated renewal response workflow** (accept/negotiate/decline) |
| f) Renewal: new lease + signed + archived | PARTIAL | `handle_renew_lease` updates tenancy. Signature tracking exists. But **no automatic status change** from pending_signature to signed. Old lease archival is manual |
| g) Vacating: vacancy workflow | PARTIAL | `handle_terminate_lease` updates tenancy status to ending. But **no auto-trigger** for exit inspection, bond return, new listing |
| h) All logged and queryable | WIRED | Documents table, messages table, search tools all functional |
| i) AI tracks all lease dates | WIRED | `handle_get_tenancy_detail` returns all lease dates. Orchestrator daily review includes lease data |

**P1 Gaps:**
- (b) No 60-day recommendation trigger
- (e) No tenant lease response workflow
- (f) No automatic signature completion tracking
- (g) Vacancy sub-workflow not triggered automatically

---

### WORKFLOW 6: TENANT ONBOARDING AND CONNECTION

| Step | Status | Detail |
|------|--------|--------|
| a) Owner adds property + tenant | WIRED | `handle_create_property` + `handle_create_tenancy` with rent schedule auto-generation |
| b) AI generates connection code + email | WIRED | `handle_invite_tenant` creates 6-char code, queues invitation email, 7-day expiry |
| c) Tenant signs up + enters code | WIRED | `apps/tenant/app/(app)/onboarding/index.tsx` with code input. `useConnection()` validates code |
| d) Tenant connected to tenancy | WIRED | `handle_tenant_connect_with_code` calls `use_connection_code` RPC, creates tenancy_tenants join, sets status active |
| e) Tenant sees lease/rent/property/docs | WIRED | `useTenancy` hook fetches complete tenancy data with property, documents, rent schedules |
| f) Welcome message from AI | PARTIAL | Onboarding walkthrough screens exist (hardcoded). But **no automated AI welcome message** on first connection |
| g) Communications through system | WIRED | Messages table + conversations store all communications |
| h) Owner sees connection status | WIRED | `useConnectionCodes` fetches codes with attempts, shows connected/pending status |

**P1 Gaps:**
- (f) No AI-generated welcome message introducing itself and explaining capabilities

---

### WORKFLOW 7: FINANCIAL OVERVIEW AND REPORTING

| Step | Status | Detail |
|------|--------|--------|
| a) Owner asks AI about performance | WIRED | Chat interface + agent tools for financial queries |
| b) AI provides summary | WIRED | `handle_get_financial_summary` queries financial_summary view with income/expenses/net by period |
| c) Real-time dashboard with charts | WIRED | `apps/owner/app/(app)/reports/financial.tsx` with BarChart, property performance grid |
| d) Income + expenses per property | WIRED | `handle_get_transactions` + `handle_get_expenses` both filter by property_id |
| e) Add manual expenses | PARTIAL | manual_expenses table exists. Expense recording tools exist. But **no UI screen for adding/managing expenses** |
| f) Tax summary report | WIRED | `generate-report` Edge Function supports tax_report type. Tax screen exists |
| g) Report exportable as PDF | WIRED | generated_reports table tracks pdf_url, status. Download/export available |
| h) AI answers financial questions | WIRED | Multiple financial query tools: get_financial_summary, get_transactions, get_expenses, get_property_metrics, get_portfolio_snapshot |

**P1 Gaps:**
- (e) No manual expense entry UI — database and tools exist but no screen

---

## SECTION 2: CROSS-APP GAPS

### Real-Time Subscription Status

**Currently using Supabase Realtime (2 of 10 flows):**
1. `useNotifications.ts` — subscribes to notifications INSERT events
2. `useUnreadCount.ts` — subscribes to all notification changes

**Everything else requires manual pull-to-refresh:**

| # | Data Flow | Sync Method | Should Be Real-Time? |
|---|-----------|-------------|---------------------|
| 1 | Owner updates property → tenant sees it | Manual refresh | YES |
| 2 | Owner sends document → tenant documents | Manual refresh | YES |
| 3 | Tenant submits maintenance → owner list | Push notification + manual refresh | YES (list should auto-update) |
| 4 | Owner updates maintenance status → tenant | Manual refresh | YES |
| 5 | Owner schedules inspection → tenant notice | Push notification + manual refresh | YES |
| 6 | Rent payment recorded → both apps | Manual refresh | YES |
| 7 | Owner sends message via AI → tenant | **BROKEN** — no integration between agent_messages and tenant notification | YES |
| 8 | Tenant sends message → owner AI aware | PARTIAL — AI loads conversation history on next query, no proactive notification | YES |
| 9 | Arrears notice → tenant sees it | Push notification + manual refresh. **No tenant arrears screen** | YES |
| 10 | Connection code flow | WIRED end-to-end but owner status update is manual refresh | Acceptable |

### Critical Cross-App Breaks

1. **Owner-to-tenant messaging via AI is broken.** There is no mechanism to deliver an AI-generated message from the owner's chat to the tenant's app. The agent_messages table is owner-side only. Tenant has a separate agent_conversations context.

2. **Tenant has no arrears visibility.** When arrears escalation happens, tenant only gets push/email. No in-app screen to see amount owed, payment plan, or timeline.

3. **Inspection reports are owner-only.** Tenant cannot see inspection findings, condition ratings, or photos from inspections of their property.

4. **Document sharing email doesn't create in-app share.** `submit_document_email` sends the email but doesn't create a `document_shares` record, so tenant may not see the document in their app.

---

## SECTION 3: AI CAPABILITY GAPS

### 3.1 Tool Registry Overview

**165 registered tools** across categories. Key findings:

**Stub tools (registered but NOT implemented — hidden from Claude):**
- `syndicate_listing_domain` — Domain.com.au API
- `syndicate_listing_rea` — REA/realestate.com.au API
- `run_credit_check` — Equifax
- `run_tica_check` — TICA tenancy database
- `collect_rent_stripe` — Stripe direct collection
- `refund_payment_stripe` — Stripe refunds
- `send_docusign_envelope` — DocuSign e-signatures
- `lodge_bond_state` — State bond authorities
- `send_sms_twilio` — Twilio SMS
- `search_trades_hipages` — Hipages tradesperson search

**Live integrations:**
- `send_email_sendgrid` / Resend — email dispatch
- `send_push_expo` — Expo push notifications

**Registered but no handler (bugs):**
- `request_quote` — registered, no handler
- `compare_quotes` — registered, no handler

### 3.2 Tenant AI Capabilities

**CRITICAL GAP:** Tenant has access to only **2 tools**:
1. `tenant_connect_with_code` — enter connection code
2. `suggest_navigation` — get app navigation suggestions

**Missing tenant tools that should exist:**
- Request maintenance via chat
- Ask questions about lease/property
- View/search documents
- Check rent schedule and payment history
- Report issues
- Respond to inspection notices
- View arrears status
- Message landlord

### 3.3 Screen-to-Chat Mapping

| Owner Screen | Achievable via AI Chat? | Should Be? |
|-------------|------------------------|------------|
| Add property | YES | YES |
| Create tenancy | YES | YES |
| Generate lease | YES | YES |
| Submit maintenance | YES (as owner) | YES |
| View maintenance | YES | YES |
| Schedule inspection | YES | YES |
| Conduct inspection | NO | NO (requires physical presence + camera) |
| View documents | YES | YES |
| Send document | YES | YES |
| View payments | YES | YES |
| View arrears | YES | YES |
| Create payment plan | YES | YES |
| Add manual expense | NO | YES |
| View reports | YES | YES |
| Generate report | YES | YES |
| Manage subscription | NO | NO (Stripe UI needed) |
| Configure autonomy | NO | YES |
| Search trades | YES | YES |
| Invite tenant | YES | YES |

### 3.4 Proactive Behaviors

| Behavior | Trigger | Action | Working? |
|----------|---------|--------|----------|
| Process instant events | pg_cron every 2 min | Poll agent_event_queue, execute tool chains | YES |
| Daily property review | pg_cron 6am AEST | Scan arrears, maintenance backlog, compliance, lease expiry | YES |
| Weekly deep analysis | pg_cron Mon 7am AEST | Market intelligence, tenant retention, property health | YES |
| Monthly portfolio review | pg_cron 1st 8am AEST | Full financials, compliance horizon, property scores | YES |
| Rent due reminders | **None** | Send reminder 3/1 days before due | **NOT IMPLEMENTED** |
| Arrears auto-escalation | **None** | Day 1/3/7/14 automated escalation chain | **NOT IMPLEMENTED** |
| Inspection due suggestion | **None** | Alert when inspection frequency rule exceeded | **NOT IMPLEMENTED** |
| Lease renewal at 60 days | **None** | Specific recommendation trigger | **NOT IMPLEMENTED** |
| Welcome message on connect | **None** | AI introduces itself to new tenant | **NOT IMPLEMENTED** |

**Pattern:** The orchestrator infrastructure is solid (4 batch modes + event queue), but the **specific proactive workflows are not wired in**. The daily review scans for conditions but doesn't trigger the actual escalation chains.

### 3.5 AI Creation Visibility

When the AI creates something (document, work order, maintenance request), it is written to the database correctly. However:
- **No Realtime subscription** means the UI doesn't update until the user manually refreshes
- **No notification dispatch** from most creation tools — the item exists in DB but the user isn't told
- Items created by the orchestrator (background) are completely invisible until the user opens the relevant screen and refreshes

### 3.6 AI Memory and Context

- **Within a conversation:** YES — last 40 messages loaded into context
- **Across conversations:** NO — no cross-conversation search or memory
- **Learning pipeline:** Rules stored in agent_rules and agent_preferences, but the injection into future conversations is limited (20 most confident rules loaded into system prompt)
- **System prompt accuracy:** Claims ~125 tools; actual CLAUDE_TOOLS array is smaller. Claims autonomous operation for tenants; tenant AI is non-functional. Claims 24/7 monitoring; runs on cron schedule with up to 2-minute latency

---

## SECTION 4: GUIDANCE GAPS

### 4.1 Onboarding

**Owner onboarding:** Exists at `apps/owner/app/(app)/onboarding/index.tsx`. Multi-step walkthrough (Welcome, AI Chat, Protection). But:
- Does NOT offer to walk user through first property addition
- Does NOT explain what AI can do with specific examples
- No "What would you like to do first?" prompt after completion

**Tenant onboarding:** Exists at `apps/tenant/app/(app)/onboarding/index.tsx`. Connection code entry + walkthrough. But:
- No AI welcome message after successful connection
- No guided tour of what tenant can do
- No explanation of how to communicate with landlord through the app

### 4.2 Empty States

Not audited at individual screen level, but based on code exploration:
- Most list screens (maintenance, documents, inspections) likely have basic empty states
- Need verification that empty states include clear CTAs and explain what the screen is for
- AI chat empty state should suggest starting actions

### 4.3 Contextual AI Suggestions

- **Not implemented.** No screens show AI-driven suggestions or prompts
- Property detail does not show "3 things need attention"
- Maintenance list does not show "Casa found a plumber"
- Financial dashboard does not show "Your expenses are 15% higher"
- These would require a new "AI suggestions" component that queries the agent for contextual advice

### 4.4 Toast/Confirmation Feedback

Not systematically audited. Based on code patterns:
- Form submissions show success via Alert.alert() or toast in most cases
- Some mutations return without visual feedback
- Need screen-by-screen verification

### 4.5 Navigation from AI

**PARTIAL.** The `suggest_navigation` tool exists for tenants. For owners:
- AI responses include route paths (e.g., `/(app)/documents/{id}`)
- But these are **plain text** in chat — not tappable links
- No deep-linking from AI messages to specific screens
- Owner would need to manually navigate to the referenced item

### 4.6 Marketing Website (casaapp.com.au)

Reviewed separately. Clean waitlist landing page with:
- Hero, dashboard mockup, How It Works, 6 features, comparison table, 3 pricing tiers (Starter $49/mo, Pro $89/mo, Hands-Off $149/mo), savings calculator, FAQ
- **Gap:** Marketing promises features that don't fully work yet (automated rent collection, AI handling everything, proactive maintenance management)
- **Gap:** "About", "Blog", "Careers" links marked "coming soon"
- **Alignment issue:** Marketing claims autonomous operation; reality requires significant manual intervention

---

## SECTION 5: IMPLEMENTATION PLAN

### Sprint 1: "The Chain" — Wire Up Critical End-to-End Workflows
**Focus:** Make the 3 most common workflows work completely from trigger to resolution.
**Estimate:** 40-50 hours

#### 1a. Maintenance Quote Flow (P0)
- Implement `request_quote` handler in tool-handlers-actions.ts
- Wire handler to `quote_request` email template in notification-templates.ts
- Implement `compare_quotes` handler with AI-driven comparison
- Fix notification timing: send tenant notification on quote approval, not work order draft
- **Files:** `supabase/functions/_shared/tool-handlers-actions.ts`, `tool-handlers-generate.ts`, `notification-templates.ts`, `tool-dispatcher.ts`

#### 1b. Maintenance → Financial Integration (P1)
- Add maintenance cost aggregation to financial_summary view
- Create DB migration to include maintenance costs in financial queries
- Update `handle_get_financial_summary` to include maintenance expenses
- **Files:** `supabase/migrations/` (new migration), `supabase/functions/_shared/tool-handlers.ts`

#### 1c. Document Revision Workflow (P0)
- Add `update_document` tool to regenerate/update existing document content
- Implement document versioning (store previous versions, allow rollback)
- Wire `document_access_log` writes into tenant document viewer
- **Files:** `supabase/functions/_shared/tool-handlers-generate.ts`, `tool-handlers-actions.ts`, `tool-registry.ts`, `tool-dispatcher.ts`, `apps/tenant/app/(app)/tenancy/documents.tsx`

#### 1d. Document Sharing Fix (P1)
- Make `submit_document_email` also create `document_shares` record
- Add push notification for general document sharing (not just signatures)
- Ensure tenant sees all shared documents without manual refresh
- **Files:** `supabase/functions/_shared/tool-handlers-generate.ts`, `apps/tenant/app/(app)/tenancy/documents.tsx`

#### 1e. Tenant Arrears Screen (P0)
- Create tenant arrears dashboard showing: amount owed, payment plan, timeline, escalation status
- Add arrears data to `useMyTenancy` or create `useMyArrears` hook for tenant
- **Files:** `apps/tenant/app/(app)/arrears/` (new), `packages/api/src/hooks/useMyArrears.ts` (new or extend existing)

#### 1f. Automated Rent Reminders (P1)
- Create pg_cron job for pre-due rent reminders (3-day, 1-day, day-of)
- Wire to existing `send_rent_reminder` handler
- Make reminder schedule configurable per tenancy
- **Files:** `supabase/migrations/` (new), `supabase/functions/send-rent-reminder/` (new or adapt existing)

#### 1g. Automated Arrears Escalation Chain (P1)
- Wire day-1, day-3, day-7, day-14 triggers into process-arrears Edge Function
- Each threshold: auto-draft notice, notify owner for approval, escalate severity
- Add state-specific notice requirements per threshold
- **Files:** `supabase/functions/process-arrears/index.ts`, `supabase/functions/send-arrears-reminder/index.ts`, `notification-templates.ts`

---

### Sprint 2: "The Brain" — AI Awareness and Conversational Completeness
**Focus:** Make the AI aware of everything and able to drive every workflow through chat.
**Estimate:** 35-45 hours

#### 2a. Expand Tenant AI Tools (P0)
- Add tenant tools: `request_maintenance`, `get_my_tenancy`, `get_my_documents`, `get_my_payments`, `get_my_arrears`, `ask_question`, `send_message_to_owner`
- Build tenant system prompt with full context (property, lease, maintenance history, documents, arrears)
- Register tools in tool-registry.ts with appropriate tenant group
- **Files:** `supabase/functions/_shared/tool-registry.ts`, `tool-handlers.ts`, `tool-handlers-actions.ts`, `agent-core.ts`

#### 2b. Proactive Behavior Wiring (P1)
- Wire inspection-due suggestions into daily orchestrator review
- Wire 60-day lease renewal recommendations
- Wire AI welcome message on tenant connection
- Add proactive rent reminder scheduling
- **Files:** `supabase/functions/agent-orchestrator/index.ts`, `supabase/functions/_shared/agent-core.ts`

#### 2c. Manual Expense Entry (P1)
- Create expense entry screen in owner app
- Wire to existing manual_expenses table and hooks
- **Files:** `apps/owner/app/(app)/expenses/` (new screen), `packages/api/src/hooks/useExpenseMutations.ts` (new or extend)

#### 2d. Autonomy Configuration via Chat (P2)
- Allow owners to adjust autonomy levels through conversation
- Add `update_autonomy_level` tool
- **Files:** `supabase/functions/_shared/tool-handlers-actions.ts`, `tool-registry.ts`

#### 2e. Cross-Conversation Memory (P2)
- Implement `search_precedent` tool handler for cross-conversation decision lookup
- Index agent_decisions for semantic search
- Surface relevant past decisions in system prompt
- **Files:** `supabase/functions/_shared/tool-handlers.ts`, `agent-core.ts`

---

### Sprint 3: "The Bridge" — Cross-App Real-Time Sync
**Focus:** Make owner and tenant apps feel like one system.
**Estimate:** 25-30 hours

#### 3a. Add Realtime Subscriptions (P1)
Add Supabase Realtime `.on('postgres_changes')` subscriptions to:
- `useMaintenance.ts` — maintenance_requests INSERT/UPDATE
- `useMyMaintenance.ts` — tenant maintenance changes
- `useDocuments.ts` — documents INSERT for both apps
- `usePayments.ts` — payments INSERT/UPDATE
- `useInspections.ts` — inspections INSERT/UPDATE
- `useMyTenancy.ts` — tenancy property changes
- `useArrears.ts` — arrears_records changes
- **Files:** All hooks in `packages/api/src/hooks/` listed above

#### 3b. Owner-to-Tenant Messaging (P0)
- Create shared messaging channel between owner AI and tenant
- When AI sends a message intended for tenant, dispatch to both agent_messages AND tenant notification
- Tenant receives push + in-app message
- **Files:** `supabase/functions/_shared/tool-handlers-actions.ts`, `notification-templates.ts`, `apps/tenant/app/(app)/(tabs)/chat.tsx`

#### 3c. Inspection Report Sharing (P1)
- Register inspection reports in documents table (not just Storage)
- Share inspection report with tenant automatically on completion
- Add tenant inspection screen showing scheduled/completed inspections and reports
- **Files:** `supabase/functions/generate-inspection-report/index.ts`, `apps/tenant/app/(app)/inspections/` (new)

#### 3d. Notification Reliability (P2)
- Remove fire-and-forget `.catch(() => {})` pattern from notification dispatch
- Add retry logic for failed notifications
- Log notification delivery status
- **Files:** `packages/api/src/hooks/useMaintenanceMutations.ts`, all files calling `dispatchNotif()`

---

### Sprint 4: "The Guide" — User Guidance and Discoverability
**Focus:** Ensure no user ever feels lost or unaware of capabilities.
**Estimate:** 20-25 hours

#### 4a. Post-Onboarding AI Introduction (P1)
- After owner completes onboarding, AI sends first message: "I see you've added your first property. Here's what I can help with..."
- After tenant connects, AI sends welcome: "Welcome to [property]. I'm Casa, your property assistant..."
- **Files:** `supabase/functions/agent-orchestrator/index.ts`, `supabase/functions/_shared/agent-core.ts`

#### 4b. Tappable AI References (P1)
- When AI mentions a property, document, or maintenance request in chat, make it a tappable deep link
- Implement in chat message rendering component
- **Files:** `apps/owner/app/(app)/(tabs)/chat.tsx`, `apps/tenant/app/(app)/(tabs)/chat.tsx`, `packages/ui/` (chat components)

#### 4c. Contextual AI Suggestion Cards (P2)
- Add AI suggestion component to key screens (property detail, maintenance list, financial dashboard)
- Query agent for contextual recommendations on screen load
- **Files:** `packages/ui/src/components/AISuggestion.tsx` (new), various screen files

#### 4d. Empty State Audit and Enhancement (P2)
- Verify every list screen has meaningful empty state with CTA
- Empty maintenance: "No maintenance requests yet. Your tenant can submit requests through their app, or ask Casa to create one."
- Empty documents: "No documents yet. Ask Casa to generate a lease, notice, or report."
- **Files:** All list screen files in `apps/owner/` and `apps/tenant/`

#### 4e. Maintenance Timeline View (P2)
- Build chronological timeline component combining status changes, comments, images, costs
- Display in both owner and tenant maintenance detail screens
- **Files:** `apps/owner/app/(app)/maintenance/[id]/index.tsx`, `apps/tenant/app/(app)/maintenance/[id]/index.tsx`, `packages/ui/` (new TimelineView component)

---

### Sprint 5: "The Loop" — Complete Remaining Workflows
**Focus:** Close all remaining lifecycle gaps.
**Estimate:** 30-40 hours

#### 5a. Inspection Tenant Response (P1)
- Add tenant confirmation/reschedule UI for inspection notices
- Tenant can accept or propose alternative time
- Owner notified of tenant response
- **Files:** `apps/tenant/app/(app)/inspections/` (new), `packages/api/src/hooks/useInspectionMutations.ts`

#### 5b. Inspection → Auto Maintenance (P1)
- When inspection finding has action_required=true, automatically create maintenance request
- AI suggests priority and category based on finding
- **Files:** `supabase/functions/_shared/tool-handlers-actions.ts`, `supabase/functions/agent-orchestrator/index.ts`

#### 5c. Lease Renewal Response Workflow (P1)
- Create tenant lease renewal response flow (accept/negotiate/decline)
- Track response in tenancy status
- Notify owner of tenant decision
- **Files:** `apps/tenant/app/(app)/tenancy/` (new screens), `packages/api/src/hooks/useTenancyMutations.ts`

#### 5d. Vacancy Workflow Automation (P2)
- On lease termination, auto-trigger: exit inspection scheduling, bond return process, listing creation prompt
- **Files:** `supabase/functions/agent-orchestrator/index.ts`

#### 5e. Signature Completion Tracking (P2)
- Automatic status change when all required signatures collected
- Notify both parties on full execution
- **Files:** `supabase/functions/_shared/tool-handlers-actions.ts`, `packages/api/src/hooks/useDocument.ts`

#### 5f. System Prompt Accuracy (P2)
- Audit system prompt claims vs actual capabilities
- Remove references to stub tools
- Add accurate tenant capability description
- Update tool count to match reality
- **Files:** `supabase/functions/_shared/agent-core.ts`

---

## APPENDIX: Priority Summary

### P0 — Workflow Dead Ends (7 items)
1. Cannot send quote requests to tradespeople (maintenance flow breaks)
2. Cannot revise existing documents (must recreate from scratch)
3. Tenant has no arrears screen (cannot see what they owe)
4. Tenant cannot respond to inspection notices
5. Tenant cannot view inspection reports
6. Tenant AI has only 2 tools (effectively non-functional)
7. Owner-to-tenant messaging via AI is broken

### P1 — Key Steps Missing (14 items)
1. No automated rent due reminders
2. No automated arrears escalation chain
3. No proactive inspection scheduling
4. Maintenance costs not in financial reports
5. Document email doesn't create in-app share
6. Document push notification only for signatures
7. Manual expense entry has no UI
8. No AI welcome message on connection
9. Inspection reports not in documents system
10. No 60-day lease renewal trigger
11. No tenant lease response workflow
12. No tenant inspection confirmation
13. No auto maintenance from inspection findings
14. 8 of 10 cross-app flows require manual refresh

### P2 — System Not Connected (9 items)
1. Tenant notification timing wrong (fires on draft, not approval)
2. No unified maintenance timeline view
3. No cross-conversation AI memory
4. No automated pattern detection for late payments
5. Arrears resolution not instant
6. No in-app approval UI for breach notices
7. No contextual AI suggestions on screens
8. AI chat references are plain text, not tappable
9. Notification dispatch is fire-and-forget with no retry

---

> **Bottom line:** Casa has impressive infrastructure — 165 tools, 4-mode orchestrator, comprehensive database schema, 60+ owner screens, working inspection comparison, learning pipeline. But the product has significant gaps between what's built and what's connected. The AI is powerful in isolation but doesn't complete workflows end-to-end. The tenant app is particularly underserved. The fix is not more features — it's wiring what exists into complete, cross-app, AI-aware loops.
