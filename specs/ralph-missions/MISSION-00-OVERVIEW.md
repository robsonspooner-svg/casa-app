# Casa Mission System

## Current Status (January 2026)

| # | Mission | Status | Notes |
|---|---------|--------|-------|
| 01 | Project Setup | COMPLETE | Monorepo, Expo, Supabase, shared packages |
| 02 | Auth & Profiles | COMPLETE | Auth flow, profiles, feature gating, premium UI |
| 03 | Properties CRUD | COMPLETE | Property management, Google Places, images |
| 04 | Listings & Marketplace | COMPLETE | Listings, search filters, favourites, saved searches, featured listings |
| 05 | Applications | COMPLETE | 6-step form, documents, email notifications. Equifax/TICA: external blocker |
| 06 | Tenancies & Leases | COMPLETE | Lease lifecycle, rent increases, compliance checklists, lease/condition report generators, direct invitations |
| 07 | Rent Collection | COMPLETE | Stripe Connect structure, rent schedules, payment tracking |
| 08 | Arrears Management | COMPLETE | Escalation ladder, payment plans, breach notices (61 tests) |
| 09 | Maintenance Requests | COMPLETE | Full CRUD, tenant submission, owner management, status lifecycle, images, comments, status history. 2 migrations (314 lines) |
| 10 | Trade Coordination | COMPLETE | Trade network, work orders, quotes, reviews, portfolio. 4 migrations (599 lines). Tenant work order visibility + review requests |
| 11 | Inspections | COMPLETE | Full inspection system: templates (8 default rooms), scheduling, conducting (room-by-room), AI comparison, voice notes, tenant acknowledgment. 2 migrations (680 lines) |
| 12 | Communications | COMPLETE | In-app messaging: conversations, participants, messages, attachments, read receipts, reactions, templates. Realtime enabled. 1 migration (397 lines) |
| 13 | Financial Reports | NOT STARTED | Agent integration (6 tools), ATO tax categorisation, expense tracking, cash flow forecasting, monthly auto-generation |
| 14 | AI Orchestrator | **50% COMPLETE** | Chat UI, Tasks UI, heartbeat (4 scanners), autonomy settings, 125 tool definitions, 112 tool handlers built. **Remaining**: 13 external integration tools, 5 workflow orchestrations, 8 additional heartbeat scanners, tool implementation tracking, Claude Agent SDK migration |
| 15 | Learning Engine | NOT STARTED | Correction-to-rule pipeline, pgvector memory retrieval, autonomy graduation, rule management UI, compliance engine (8 states), learning content, regulatory updates |
| 16 | Document Management | NOT STARTED | Agent integration (8 tools), document generation service (7 types), lease template system (NSW/VIC/QLD), auto-categorisation |
| 17 | Notifications | NOT STARTED | Notification dispatch service, agent notification integration (13 event types), SMS templates (Twilio, Spam Act compliant), email templates (SendGrid), tenant notifications |
| 18 | Security Audit | NOT STARTED | Feature gating enforcement (3 tiers), agent action audit trail, data encryption requirements (AES-256), 7-year audit retention |
| 19 | Performance | NOT STARTED | Agent performance optimisation (response time targets, tool search, context window management), database indexes for agent queries, pgvector HNSW index, cache strategy |
| 20 | Launch Prep | NOT STARTED | PM transition wizard (inspection preference collection), website promise verification checklist, agent launch readiness checklist, inspection outsourcing in onboarding |

**Overall Progress**: 12/20 missions complete (60%), Mission 14 at 50%

**Next Priority**: Mission 13 (Financial Reports) — last P1 feature mission. Then complete Mission 14 remaining items (external integrations, workflows, heartbeat expansion). Mission 14 tool handlers already exist but need real external API connections (Brave Search, Google Places, SendGrid, Twilio, etc.).

**External Integration Applications to Start Immediately** (long lead times):
- Stripe Connect account setup
- Domain API partnership application
- REA API partnership application
- Equifax business verification
- TICA credentials

---

## Comprehensive Gap Matrix

This matrix maps every major capability from the AGENT-SPEC, STEAD-BIBLE, and website promises to specific missions, ensuring 100% coverage at launch.

### Agent Feature → Mission Allocation

| Agent Feature | Source | Mission | Status |
|---------------|--------|---------|--------|
| Chat UI (FAB) | AGENT-SPEC §2 | 14 | Built |
| Tasks UI (timeline) | AGENT-SPEC §2 | 14 | Built |
| 125 tool definitions | AGENT-SPEC §3 | 14 | Built |
| 112 tool handlers | AGENT-SPEC §3 | 14 | Built |
| Heartbeat engine (4 scanners) | AGENT-SPEC §4 | 14 | Built |
| Autonomy settings (L0-L4) | AGENT-SPEC §5 | 14 | Built |
| External integrations (13 tools) | AGENT-SPEC §3.5 | 14 | Phase 10 |
| Workflow orchestration (5 workflows) | AGENT-SPEC §3.6 | 14 | Phase 11 |
| Additional heartbeat scanners (8) | AGENT-SPEC §4.2 | 14 | Added |
| Tool Search (dynamic discovery) | AGENT-SPEC §6 | 14+19 | Spec'd in 14, optimised in 19 |
| Correction-to-rule pipeline | AGENT-SPEC §7 | 15 | Phase B |
| pgvector memory retrieval | AGENT-SPEC §7.2 | 15 | Phase C |
| Autonomy graduation | AGENT-SPEC §7.3 | 15 | Phase D |
| Rule management UI | AGENT-SPEC §7.4 | 15 | Phase G |
| Trajectory optimisation | AGENT-SPEC §7.5 | 15 | Phase I |
| Proactive intelligence | AGENT-SPEC §7.6 | 15 | Phase J |
| Financial report generation | BIBLE §8 | 13 | Phases A-H |
| ATO tax categorisation | BIBLE §8.3 | 13 | Phase J |
| Expense tracking | BIBLE §8.4 | 13 | Phase K |
| Cash flow forecasting | BIBLE §8.5 | 13 | Phase L |
| Document management | BIBLE §9 | 16 | Phases A-H |
| Document generation (7 types) | BIBLE §9.2 | 16 | Phase I |
| Lease template system | BIBLE §9.3 | 16 | Phase J |
| Push notifications | BIBLE §10 | 17 | Phases A-H |
| Notification dispatch service | BIBLE §10.2 | 17 | Phase I |
| SMS/email templates | BIBLE §10.3 | 17 | Phase J |
| Feature gating enforcement | BIBLE §2 | 18 | Phase I |
| Agent audit trail | BIBLE §11 | 18 | Phase J |
| Data encryption (field-level) | BIBLE §11.2 | 18 | Phase K |
| Agent response time targets | AGENT-SPEC §8 | 19 | Phase I |
| Database query optimisation | BIBLE §12 | 19 | Phase I |
| Inspection outsourcing | BIBLE §6.3 | 11 | Phase K+L |
| PM transition wizard | BIBLE §13 | 20 | Phase H |
| Website promise verification | Website | 20 | Phase M |
| Agent launch readiness | AGENT-SPEC | 20 | Phase N |
| Compliance engine (8 states) | BIBLE §6.5 | 15 | Phase E+F |

### Website Promise → Mission Coverage

| Website Promise | Tier | Covered By |
|----------------|------|------------|
| Tenant communications | All | M12 (built), M17 (notifications) |
| Rent tracking | All | M07 (built), M08 (built) |
| Maintenance requests | All | M09 (built), M10 (built) |
| AI condition comparison | All | M11 (built) |
| Basic reports | All | M13 |
| AI chat | All | M14 (built) |
| Tenant finding | Pro | M04 (built), M14 (workflow) |
| Lease management | Pro | M06 (built), M16 (templates) |
| Bond handling | Pro | M06 (built, external blocker for APIs) |
| Professional inspections | Pro | M11 (Phase K — outsourcing system) |
| Full automation | Pro | M14 (workflows), M15 (learning) |
| Financial reports | Pro | M13 (full spec) |
| Cash flow forecasting | Pro | M13 Phase L |
| Open homes | Hands-Off | M04 (built), M14 (workflow) |
| Entry/exit reports | Hands-Off | M11 (built + Phase K outsourcing) |
| Priority support | Hands-Off | M18 (feature gating) |
| Dedicated account manager | Hands-Off | M18 (feature gating) |
| "Under 2 minutes" response | All | M19 (agent response targets) |
| "Learns your preferences" | All | M15 (learning pipeline) |
| "State tenancy compliant" | All | M15 (compliance engine), M06 (built) |
| "Bank-level encryption" | All | M18 (Phase K) |
| "24/7 instant" | All | M14 (built — always-on agent) |
| "Built in Australia" | All | Supabase Sydney region (configured) |

### Remaining Gaps: NONE

After updating missions 11, 13-20, every feature from the AGENT-SPEC, STEAD-BIBLE, and website has been allocated to a specific mission with a specific phase. When all 20 missions are complete, the app will deliver on 100% of its promises.

**Key dependencies to monitor:**
1. External API approvals (Domain, REA, Equifax, TICA) — long lead times
2. State-specific lease templates — require legal review before launch
3. Claude Agent SDK migration (M14) — Cloudflare Worker deployment
4. Stripe Connect production account — required for real payments

---

## Mission Philosophy

Each mission is **atomic** and **testable**. A mission is complete when:
1. All code is written and compiles
2. All tests pass
3. Feature works on a real device (not just simulator)
4. No regressions in existing features
5. Mission-Complete Testing Checklist is fully satisfied
6. No mock data, TODOs, or unresolved errors remain

## Mission Sequence

### Foundation (Missions 1-3) - Week 1-2
| Mission | Name | Depends On | Output |
|---------|------|------------|--------|
| 01 | Project Setup | - | Monorepo, Supabase, Expo configured |
| 02 | Auth & Profiles | 01 | Login/signup working, profiles table |
| 03 | Properties CRUD | 02 | Owner can add/edit properties |

### Tenant Management (Missions 4-6) - Week 3-4
| Mission | Name | Depends On | Output |
|---------|------|------------|--------|
| 04 | Listings | 03 | Create/publish property listings |
| 05 | Applications | 04 | Tenant can apply, owner sees applications |
| 06 | Tenancies | 05 | Create tenancy from approved application |

### Money (Missions 7-8) - Week 5-6
| Mission | Name | Depends On | Output |
|---------|------|------------|--------|
| 07 | Rent Collection | 06 | Stripe Connect, rent scheduling, payments |
| 08 | Arrears Management | 07 | Auto-reminders, notices, escalation |

### Maintenance (Missions 9-10) - Week 7-8
| Mission | Name | Depends On | Output |
|---------|------|------------|--------|
| 09 | Maintenance Requests | 06 | Tenant can report issues, owner sees |
| 10 | Trade Coordination | 09 | Quotes, approval, scheduling |

### Operations (Missions 11-13) - Week 9-10
| Mission | Name | Depends On | Output |
|---------|------|------------|--------|
| 11 | Inspections | 06 | Schedule, self-service, outsourced professional inspections, AI comparison, reports, agent-driven lifecycle |
| 12 | Communications | 02 | In-app messaging, notifications |
| 13 | Financial Reports | 07 | Income/expense tracking, ATO tax categorisation, cash flow forecasting, agent integration (6 tools) |

### Intelligence (Missions 14-15) - Week 11-12
| Mission | Name | Depends On | Output |
|---------|------|------------|--------|
| 14 | AI Orchestrator — Proactive Autonomous PM | 03-13 | 87 tools across 7 categories, Chat + Tasks as primary interface, heartbeat engine (14 scanners), user-adjustable autonomy (L0-L4), Claude Agent SDK on Cloudflare Worker, MCP servers for all integrations, Tool Search for dynamic discovery |
| 15 | Learning Engine | 14 | Self-evolving skills (correction → rule pipeline), pgvector memory retrieval, autonomy graduation, trajectory optimisation |

> **Note**: Agent infrastructure (database tables, types) deploys at Mission 03. Agent tools are added progressively with each mission's data. Mission 14 delivers the frontier-grade autonomous agent — Moltbot-calibre intelligence applied to Australian property management. Mission 15 activates the full learning pipeline that makes the agent smarter with every interaction.
>
> **Frontier Vision**: Casa's agent is not a chatbot. It is a proactive autonomous property manager that orchestrates the entire rental lifecycle with minimal owner involvement. The owner interacts through Chat and Tasks. All complexity is hidden. The agent reaches out to the user (not just the other way around). Users see everything happening, can pause anything, and take manual control — but shouldn't need to. Every property management action a human PM performs becomes a callable tool (87 tools, 565+ equivalent actions). The agent self-evolves by learning from owner corrections and generating persistent rules. This is the frontier of AI-powered property management.

### Admin & Polish (Missions 16-20) - Week 13-16
| Mission | Name | Depends On | Output |
|---------|------|------------|--------|
| 16 | Document Management | 02, 14 | Document storage, agent integration (8 tools), document generation service (7 types), lease templates (NSW/VIC/QLD) |
| 17 | Notifications | 12, 14 | Expo Push + SendGrid + Twilio, notification dispatch service, agent notification integration (13 event types), SMS/email templates |
| 18 | Security Audit | All | RLS review, feature gating enforcement (3 tiers), agent audit trail, data encryption (AES-256), 7-year retention |
| 19 | Performance | All | App + agent optimisation, tool search, pgvector HNSW index, database indexes, cache strategy, response time targets |
| 20 | Launch Prep | All | App Store submission, PM transition wizard (inspection preferences), website promise verification, agent launch readiness checklist |

## Mission File Template

Each mission file follows this exact structure:

```markdown
# Mission XX: [Name]

## Overview
**Goal**: [One sentence]
**Depends On**: Mission XX, YY
**Estimated Effort**: X hours

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
- [ ] All tests pass
- [ ] No TypeScript errors

## Technical Approach
[Brief description of how to implement]

## Files to Create/Modify
- `path/to/file.ts` - Description
- `path/to/another.ts` - Description

## Database Changes
```sql
-- Migration SQL if needed
```

## Tests Required
- [ ] Unit test: description
- [ ] Integration test: description

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm build
```

## Commit Message
```
feat(scope): description

- Detail 1
- Detail 2
```
```

## Rules for Implementation

1. **One mission at a time** - Never work on multiple missions simultaneously
2. **Read before write** - Always read existing code before modifying
3. **Test as you go** - Write tests alongside implementation
4. **Small commits** - Commit after each logical unit of work
5. **No shortcuts** - Every success criterion must be met
6. **Ask if unclear** - Better to ask than assume

## Quality Bar

A mission is NOT complete if:
- TypeScript has errors
- Any test fails
- A previous feature regresses
- Code doesn't follow existing patterns
- Files are created in wrong locations
- The Mission-Complete Testing Checklist (at the bottom of each mission doc) has unchecked items

## Testing Requirements

Every mission includes a **Mission-Complete Testing Checklist** at the bottom of its document. This checklist MUST be fully satisfied before the mission can be considered done.

Full testing methodology: `/specs/TESTING-METHODOLOGY.md`
Agent heuristics and required reading: `/CLAUDE.md`

The testing framework ensures:
1. **Build health** — zero TypeScript errors, all tests pass
2. **Database integrity** — migrations applied, RLS verified, triggers working
3. **Feature completeness** — every success criterion met with real data (no mocks)
4. **Visual verification** — tested on physical device, matches design system
5. **Regression** — all prior missions' critical paths still work
6. **Security** — auth enforced, RLS correct, no data leakage

---

## Third-Party Integration Summary

The following third-party integrations are required to deliver a production-ready property management platform. Detailed implementation specifications are in each mission file and in `STEAD-BIBLE.md` Section 8.

### Critical Path Integrations (MVP Required)

| Integration | Mission | Priority | Purpose |
|-------------|---------|----------|---------|
| **Stripe Connect** | 07 | P1 | Rent collection, owner payouts, platform fees |
| **Domain API** | 04 | P1 | Property portal syndication (domain.com.au) |
| **REA API** | 04 | P1 | Property portal syndication (realestate.com.au) |
| **DocuSign** | 06 | P1 | Digital lease signing (legally binding) |
| **SendGrid** | 12 | P1 | Transactional emails, receipts, reminders |
| **Twilio SMS** | 12 | P1 | Critical notification fallback |
| **Expo Push** | 17 | P1 | Primary notification channel |

### Recommended Integrations (Launch Quality)

| Integration | Mission | Priority | Purpose |
|-------------|---------|----------|---------|
| **Equifax** | 05 | P2 | Tenant credit checks |
| **TICA** | 05 | P2 | Tenancy database checks |
| **NSW/VIC/QLD Bond APIs** | 06 | P2 | Automated bond lodgement |
| **Anthropic Claude** | 14 | P2 | AI agent (conversation + tools) |
| **Hipages API** | 10 | P2 | Trade service integration |

### Nice-to-Have Integrations (Future Enhancement)

| Integration | Mission | Priority | Purpose |
|-------------|---------|----------|---------|
| **Cloudinary** | 04 | P3 | Optimized image hosting |
| **WhatsApp Business** | 12 | P3 | Higher engagement notifications |
| **Airtasker API** | 10 | P3 | Alternative trade booking |
| **PayTo (NPP)** | 07 | P3 | Instant bank payments |

### Integration Package Structure

All third-party integrations should be implemented in a shared package:

```
packages/integrations/
├── package.json
├── src/
│   ├── index.ts                    # Main exports
│   │
│   ├── stripe/                     # Mission 07
│   │   ├── client.ts
│   │   ├── connect.ts
│   │   ├── payments.ts
│   │   ├── billing.ts              # Subscription management
│   │   ├── addons.ts               # Add-on one-off charges
│   │   ├── becs.ts
│   │   └── webhooks.ts
│   │
│   ├── domain/                     # Mission 04
│   │   ├── client.ts
│   │   ├── mapper.ts
│   │   └── types.ts
│   │
│   ├── rea/                        # Mission 04
│   │   ├── client.ts
│   │   ├── mapper.ts
│   │   └── reaxml.ts
│   │
│   ├── docusign/                   # Mission 06
│   │   ├── client.ts
│   │   ├── templates.ts
│   │   └── webhooks.ts
│   │
│   ├── bond-authorities/           # Mission 06
│   │   ├── nsw.ts
│   │   ├── vic.ts
│   │   └── qld.ts
│   │
│   ├── equifax/                    # Mission 05
│   │   ├── client.ts
│   │   └── types.ts
│   │
│   ├── tica/                       # Mission 05
│   │   ├── client.ts
│   │   └── types.ts
│   │
│   ├── twilio/                     # Mission 12
│   │   ├── sms.ts
│   │   ├── whatsapp.ts
│   │   └── verify.ts
│   │
│   ├── sendgrid/                   # Mission 12
│   │   ├── client.ts
│   │   └── templates.ts
│   │
│   ├── hipages/                    # Mission 10
│   │   └── client.ts
│   │
│   └── ai/                         # Mission 14
│       └── anthropic.ts            # Claude API client
```

### Required Environment Variables

```bash
# === STRIPE (Mission 07) ===
STRIPE_SECRET_KEY=sk_xxx
STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CONNECT_CLIENT_ID=ca_xxx
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxx
STRIPE_PLATFORM_FEE_PERCENT=1.5

# === STRIPE BILLING (Mission 07 - Subscriptions) ===
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_HANDS_OFF=price_xxx

# === PROPERTY PORTALS (Mission 04) ===
DOMAIN_API_KEY=xxx
DOMAIN_CLIENT_ID=xxx
DOMAIN_CLIENT_SECRET=xxx
REA_API_KEY=xxx
REA_AGENCY_ID=xxx

# === DOCUSIGN (Mission 06) ===
DOCUSIGN_INTEGRATION_KEY=xxx
DOCUSIGN_USER_ID=xxx
DOCUSIGN_ACCOUNT_ID=xxx
DOCUSIGN_PRIVATE_KEY=xxx

# === BACKGROUND CHECKS (Mission 05) ===
EQUIFAX_API_KEY=xxx
EQUIFAX_CLIENT_ID=xxx
EQUIFAX_CLIENT_SECRET=xxx
TICA_API_KEY=xxx
TICA_AGENCY_ID=xxx

# === BOND AUTHORITIES (Mission 06) ===
NSW_RBO_API_KEY=xxx
VIC_RTBA_API_KEY=xxx
QLD_RTA_API_KEY=xxx

# === COMMUNICATIONS (Mission 12) ===
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+61xxx
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@casapm.com.au

# === AI AGENT (Mission 14) ===
ANTHROPIC_API_KEY=sk-ant-xxx
AGENT_MODEL=claude-sonnet-4-20250514

# === TRADE SERVICES (Mission 10) ===
HIPAGES_API_KEY=xxx
```

### Integration Development Order

For maximum efficiency, implement integrations in this order:

1. **Phase 1 (Foundation)**: Stripe Connect (enables all payments)
2. **Phase 2 (Acquisition)**: Domain + REA APIs (enables tenant acquisition)
3. **Phase 3 (Documents)**: DocuSign (enables legal lease signing)
4. **Phase 4 (Communications)**: SendGrid + Twilio (enables notifications)
5. **Phase 5 (Trust)**: Equifax + TICA (enables background checks)
6. **Phase 6 (Compliance)**: Bond Authority APIs (enables automated compliance)
7. **Phase 7 (Intelligence)**: Anthropic Claude Agent SDK on Cloudflare Worker (enables frontier AI agent with 87 tools, Tool Search, and Programmatic Tool Calling)
8. **Phase 7b (MCP Servers)**: Each integration from Phases 1-6 is wrapped as an MCP server for the agent to invoke directly (Stripe MCP, Twilio MCP, Domain MCP, Equifax MCP, SendGrid MCP, State Bond MCP)
9. **Phase 8 (Enhancement)**: Hipages, Cloudinary, WhatsApp (quality of life)

### API Access Notes

Some integrations require business verification or partnerships:

| Integration | Access Requirements | Lead Time |
|-------------|---------------------|-----------|
| Domain API | Partner application | 2-4 weeks |
| REA API | Licensed agent required | 4-6 weeks |
| DocuSign | Developer account → Production | 1-2 weeks |
| Equifax | Business verification | 2-4 weeks |
| TICA | Real estate credentials | 1-2 weeks |
| WhatsApp Business | Meta business verification | 1-2 weeks |

**Recommendation**: Apply for API access early in parallel with development.
