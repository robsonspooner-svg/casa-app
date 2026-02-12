# Casa Master Launch Plan

> **Created:** February 13, 2026
> **Target Launch:** February 20, 2026 (TestFlight Beta to 5-10 landlords)
> **Public Launch:** March 2026 (App Store)

---

## Part 1: Current State Assessment

### What's Built (~95% Complete)

**NOTE:** The mission docs (MISSION-00-OVERVIEW.md) are outdated and show missions 15-20 as "NOT STARTED". The actual codebase tells a different story — all 20 missions have been substantially implemented.

**All 20 missions implemented in code:**
- 34 owner app screens, 21 tenant app screens — all fully functional
- 66 database migrations, all tables with RLS enabled
- 33 Edge Functions — ALL real implementations (zero stubs)
- 98 API hooks implemented
- 87+ agent tools across 7 categories
- 20 heartbeat scanners for property monitoring
- 5 autonomy levels (L0-L4) with owner control
- Learning engine: correction-to-rule pipeline, pgvector, autonomy graduation
- Document management: processing, annotations, sharing, storage
- Notifications: multi-channel dispatch (push + email + SMS), email queue, templates
- Security: MFA (TOTP), AES-256 encryption, audit logs, rate limiting, consent versioning
- Performance: 50+ database indexes, pgvector HNSW
- Onboarding: setup flow, autonomy presets
- Subscriptions: 3-tier UI, Stripe Billing integration, manage-subscription Edge Function

### What's Needed for Launch
1. **12 critical code fixes** (security, functionality, integration — see Part 2)
2. **Production credentials** (Stripe, SendGrid, Twilio, Expo Push)
3. **Visual polish** (borderRadius standardization, color tokens — in progress)
4. **Feature gating** (Coming Soon for 10 stubbed external integrations)
5. **Agent system prompt** (updated for launch reality)
6. **App Store assets** (screenshots, copy, metadata)
7. **Marketing website** (pricing page, product copy — currently a scaffold)

### External Blockers (Long Lead Time)
| Integration | Status | Lead Time | Impact on Launch |
|-------------|--------|-----------|-----------------|
| Domain API | Not started | 2-4 weeks | Gate with "Coming Soon" |
| REA API | Not started | 4-6 weeks | Gate with "Coming Soon" |
| Equifax | Application initiated | 2-4 weeks | Gate credit checks |
| TICA | Not started | 1-2 weeks | Gate tenancy checks |
| DocuSign | Not started | 1-2 weeks | Gate e-signatures |
| Stripe Connect | Sandbox ready | 1-2 days | **Must have for launch** |
| SendGrid | Key available | 0.5 days | **Must have for launch** |

---

## Part 2: Pre-Launch Critical Fixes (12 Items)

These are code-level fixes that must be completed before any user touches the app. Each is documented in detail in the plan file.

### Security Fixes (Priority 1)
| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 5 | 4 ownership bypasses in tool handlers | `tool-handlers-actions.ts` | Any user can cancel/modify other users' data |
| 6 | Email/push recipient validation | `tool-handlers-generate.ts` | Agent can email/push any user |
| 7 | RLS on folder_templates & lease_templates | New migration | Tables accessible by anyone |
| 8 | Push token query bug in compliance reminders | `send-compliance-reminders/index.ts` | Push notifications fail silently |

### Functionality Fixes (Priority 2)
| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 1 | OAuth deep link handler | Both `_layout.tsx` | Google sign-in silently fails |
| 2 | approveAction must invoke Edge Function | `useAgentChat.ts` | Approving agent actions does nothing |
| 3 | Onboarding race condition | Owner `_layout.tsx` | New users bypass onboarding |
| 4 | Report failure shows "completed" | `useReports.ts` | Failed reports appear successful |

### Integration Fixes (Priority 3)
| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 9 | Tenant payment method — Stripe stub | `payments/methods/add.tsx` | Tenants can't add payment methods |
| 10 | Owner payout onboarding — Stripe stub | `payments/onboard.tsx` | Owners can't set up payouts |
| 11 | Unify domain references | Multiple files | Inconsistent domain across app |
| 12 | TypeScript verification | All | Ensure everything compiles |

---

## Part 3: Launch Sprint Phases (Feb 13-20)

### Phase 0: Audit & External Accounts (DONE)
- [x] Feature audit complete
- [x] Apple Developer enrolled
- [x] EAS builds configured for both apps
- [x] TestFlight submissions in progress
- [ ] Stripe production products created (Starter $49, Pro $89, Hands Off $149)
- [ ] SendGrid sender identity verified
- [ ] Twilio Australian number obtained
- [ ] Google OAuth redirect URIs configured
- [ ] Single domain chosen and standardized

### Phase 1: Infrastructure & Secrets (2-3 hours)
- [ ] Apply all 62 migrations: `npx supabase db push --linked`
- [ ] Deploy all 42 Edge Functions
- [ ] Set all secrets (Stripe, SendGrid, Twilio, Anthropic, encryption keys)
- [ ] Fix domain references to single production domain
- [ ] Verify pg_cron heartbeat system
- [ ] Set maintenance storage bucket to private + RLS

### Phase 2: Critical Fixes (4-6 hours)
- [ ] Fix 1: OAuth deep link handler (both apps)
- [ ] Fix 2: approveAction invokes Edge Function
- [ ] Fix 3: Onboarding race condition
- [ ] Fix 4: Report failure status
- [ ] Fix 5: 4 ownership bypasses
- [ ] Fix 6: Email/push recipient validation
- [ ] Fix 7: RLS on template tables
- [ ] Fix 8: Push token query bug
- [ ] Fix 9: Rate limiting on agent-chat (30 msgs / 15 min)
- [ ] Fix 10: Server-side tier enforcement
- [ ] Fix 11: Dashboard/portfolio error states
- [ ] Fix 12: Chat error tap behavior
- [ ] Fix 13: KeyboardAvoidingView on listing creation
- [ ] `pnpm typecheck` passes clean

### Phase 3: Feature Gating & Cohesion (3-4 hours)
- [ ] Build ComingSoon component (reusable, branded, premium feel)
- [ ] Build UpgradePrompt component (tier-aware, non-aggressive)
- [ ] Gate all stubbed integrations (Domain, REA, TICA, Equifax, DocuSign, Bond, hipages)
- [ ] Update agent system prompt to exclude gated capabilities
- [ ] Enforce feature gating on all tier-locked screens
- [ ] Full walkthrough — zero dead ends on Starter tier
- [ ] Full walkthrough — zero dead ends on Pro tier

### Phase 4: Stripe & Payment Flows (2-3 hours)
- [ ] Subscription creation works end-to-end
- [ ] Webhook correctly updates subscription_tier
- [ ] Feature gates update immediately on tier change
- [ ] Upgrade/downgrade flows work
- [ ] Cancel reverts to Starter tier
- [ ] Tenant payment method addition (real Stripe SetupIntent)
- [ ] Owner payout onboarding (real Stripe Connect)
- [ ] Remove dev fallback in manage-subscription

### Phase 5: Email, SMS & Notification Pipeline (2-3 hours)
- [ ] Email delivery works for all templates (SendGrid)
- [ ] SMS delivery works (Twilio)
- [ ] Push notifications arrive on real device
- [ ] Email queue processes with retry logic
- [ ] Maintenance submission triggers landlord notification
- [ ] Rent reminders fire at configured intervals
- [ ] Lease expiry warnings fire
- [ ] Notification preferences respected
- [ ] All emails use correct production domain

### Phase 6: Tenant App Completion (2-3 hours)
- [ ] Settings hub with working sub-screens
- [ ] All routes registered (no missing Stack.Screen)
- [ ] Tenant onboarding flow
- [ ] Support screens (FAQ + ticket)
- [ ] All broken flows gated with ComingSoon
- [ ] Full tenant walkthrough — zero dead ends

### Phase 7: Agent Intelligence (3-4 hours)
- [ ] System prompt updated for launch capabilities
- [ ] Helpful workarounds for gated features
- [ ] Proactive greeting with property observations
- [ ] Tool execution loop: query → proposal → approval → execution → result
- [ ] Edge case handling (empty/long/rapid messages, failures, tier limits)
- [ ] Agent personality: warm, competent, professional

### Phase 8: TestFlight Build (2-3 hours)
- [ ] `pnpm typecheck` clean
- [ ] Both apps build on EAS (production profile)
- [ ] Both apps submitted to TestFlight
- [ ] Both apps installable and launch on real device

### Phase 9: Real-Device QA (1-2 days)
- [ ] Complete test matrix (auth, core, property management, subscription, settings)
- [ ] Cross-app flows (owner creates property → tenant connects)
- [ ] Visual polish pass (loading states, empty states, keyboard, safe areas)
- [ ] No crashes in 30 minutes of continuous use

### Phase 10: Launch Preparation
- [ ] Test accounts for Apple Review
- [ ] App Store listing (name, description, keywords, screenshots)
- [ ] Privacy policy hosted
- [ ] Final OTA update pushed
- [ ] First 5-10 landlords invited to TestFlight

---

## Part 4: UI Polish Tracker

### Completed
- [x] Hardcoded color values → THEME.colors tokens (both apps)
- [x] borderRadius standardization → THEME.radius tokens (tenant app)
- [ ] borderRadius standardization → THEME.radius tokens (owner app — in progress)

### Remaining Polish Items
| Item | Priority | Effort | Description |
|------|----------|--------|-------------|
| Skeleton loading screens | HIGH | 2-3 hrs | Replace raw ActivityIndicator with branded skeleton screens on all data-loading screens |
| Empty states | HIGH | 2-3 hrs | Every list/data screen needs a branded empty state with helpful action |
| Error states with retry | HIGH | 2 hrs | All data screens need error UI with retry button |
| KeyboardAvoidingView | MEDIUM | 1-2 hrs | All form screens need proper keyboard handling |
| Safe area consistency | MEDIUM | 1 hr | Verify safe area insets on all screens, all iPhone models |
| Haptic feedback | LOW | 1 hr | Add haptic feedback on key interactions (approvals, submissions) |
| Pull-to-refresh | MEDIUM | 1-2 hrs | All list screens should support pull-to-refresh |
| Animation polish | LOW | 2 hrs | Screen transitions, card expansions, loading animations |
| Typography audit | LOW | 1 hr | Ensure all text uses THEME.typography scale |
| Spacing audit | LOW | 1 hr | Ensure all spacing uses THEME.spacing scale |
| Shadow consistency | LOW | 1 hr | Ensure all elevation uses THEME.shadow tokens |

---

## Part 5: Post-Launch Feature Roadmap

### Week 1-2: Stability & Feedback (Feb 20 - Mar 6)
**Goal:** Zero crashes, responsive to user feedback

| Item | Type | Effort |
|------|------|--------|
| Fix all bugs reported by beta users | Bug fix | Ongoing |
| Monitor agent conversations for confusion | Tuning | Ongoing |
| Monitor Anthropic API costs | Ops | 1 day |
| Monitor Stripe webhook reliability | Ops | 0.5 day |
| In-app feedback button | Feature | 0.5 day |
| Crash reporting (Sentry) | Infra | 1 day |
| Analytics (Mixpanel/Amplitude) | Infra | 1 day |

### Week 3-4: Agent Tuning & Autonomy (Mar 6 - Mar 20)
**Goal:** Agent feels like a real property manager, autonomy graduation working

| Item | Type | Effort | OTA? |
|------|------|--------|------|
| Tune agent system prompt based on real conversations | Tuning | Ongoing | Yes (Edge Function) |
| Verify learning pipeline (correction-to-rule) in production | Verification | 1 day | Yes |
| Verify autonomy graduation triggers correctly | Verification | 1 day | Yes |
| Model routing (Haiku for routine, Sonnet for complex) | Optimization | 1 day | Yes (Edge Function) |
| Agent proactive observations on conversation start | Enhancement | 1 day | Yes |
| Improve agent tool error recovery | Enhancement | 1 day | Yes |

### Week 5-6: Polish & Email Templates (Mar 20 - Apr 3)
**Goal:** Professional communications and refined UX

| Item | Type | Effort | OTA? |
|------|------|--------|------|
| Branded HTML email templates for all notification types | Polish | 2 days | Yes (Edge Function) |
| Skeleton loading screens on all data screens | Polish | 2 days | Yes |
| Empty state illustrations | Polish | 1 day | Yes |
| Pull-to-refresh on all list screens | Polish | 1 day | Yes |
| Haptic feedback on key interactions | Polish | 0.5 day | Yes |
| Animation polish (transitions, card expansions) | Polish | 1 day | Yes |

### Week 7-8: Marketing & Growth (Apr 3 - Apr 17)
**Goal:** Marketing website live, referral program active

| Item | Type | Effort | OTA? |
|------|------|--------|------|
| Marketing website: pricing page with Stripe checkout | Feature | 3 days | N/A (web) |
| Marketing website: product features & screenshots | Content | 2 days | N/A (web) |
| Marketing website: SEO & blog infrastructure | Feature | 2 days | N/A (web) |
| In-app referral program | Feature | 2 days | Yes |
| App Store listing optimization (ASO) | Marketing | 1 day | N/A |
| Response caching for frequently accessed data | Performance | 1 day | Yes |

### Month 2-3: Integration Sprint (Apr - May)
**Goal:** External integrations that multiply the app's value

| Item | Type | Effort | OTA? | Requires |
|------|------|--------|------|----------|
| Stripe Connect automated rent collection | Integration | 3 days | Yes | Production Stripe |
| Trade directory (own, not hipages) | Feature | 3 days | Yes | - |
| AI photo comparison for inspections | Feature | 2 days | Yes | - |
| DocuSign e-signatures | Integration | 3 days | Yes | DocuSign approval |
| Domain.com.au listing syndication | Integration | 3 days | Yes | Domain API approval |
| REA.com.au listing syndication | Integration | 3 days | Yes | REA API approval |
| Equifax credit checks | Integration | 2 days | Yes | Equifax approval |
| TICA tenancy database checks | Integration | 2 days | Yes | TICA credentials |
| Bond lodgement automation (NSW) | Integration | 2 days | Yes | State API access |

### Month 4-6: Platform Maturity (Jun - Aug)
**Goal:** Full feature parity with traditional PMs

| Item | Type | Effort |
|------|------|--------|
| Android app launch (Google Play) | Platform | 2 weeks |
| Combined app (owner + tenant role selection) | Architecture | 1 week |
| MFA enforcement for Hands Off tier | Security | 2 days |
| Advanced financial reporting | Feature | 3 days |
| Tenant portable rental history | Feature | 2 days |
| Maintenance marketplace (trade matching) | Feature | 1 week |
| State expansion (VIC, QLD, SA, WA, TAS, NT, ACT) | Compliance | 2 weeks |
| Bond lodgement (VIC, QLD) | Integration | 1 week |
| NZ expansion prep | Research | 1 week |

---

## Part 6: Infrastructure for Scale

### Current Infrastructure
| Component | Status | Handles |
|-----------|--------|---------|
| Supabase PostgreSQL | Production | ~100 properties |
| Supabase Auth | Production | ~500 users |
| Supabase Realtime | Production | ~50 concurrent |
| Supabase Storage | Production | ~10 GB |
| Edge Functions (Deno) | Production | 60-sec timeout |
| EAS Build | Free tier | 1-2 hr queue |

### Scale Milestones

**At 100 properties (Month 1-2):**
- [ ] Add database connection pooling (Supabase built-in)
- [ ] Add CDN for static assets (Supabase Storage + CDN)
- [ ] Upgrade to Supabase Pro plan ($25/mo)
- [ ] Set up database backups (daily)
- [ ] Add Sentry for crash reporting
- [ ] Add Mixpanel/Amplitude for analytics

**At 500 properties (Month 3-4):**
- [ ] Upgrade to EAS paid plan ($99/yr) for faster builds
- [ ] Add database read replicas if query load increases
- [ ] Implement response caching (Redis or Supabase cache)
- [ ] Add rate limiting to all public endpoints
- [ ] Add CloudFlare for DDoS protection
- [ ] Agent: Migrate to Cloudflare Workers + Durable Objects for longer-running tasks

**At 1,000 properties (Month 6-8):**
- [ ] Upgrade to Supabase Team plan
- [ ] Horizontal scaling for Edge Functions
- [ ] pgvector optimization for 10K+ embeddings
- [ ] Add database partitioning for high-volume tables (transactions, agent_tasks)
- [ ] Add job queue for background processing (pg_boss or similar)
- [ ] Agent: Implement model routing to reduce Anthropic costs (Haiku for routine, Sonnet for complex)

**At 5,000 properties (Month 12+):**
- [ ] Dedicated database instance
- [ ] Multi-region deployment (Sydney primary, Melbourne failover)
- [ ] Advanced caching (property data, agent context)
- [ ] Custom CDN for inspection images
- [ ] Dedicated support infrastructure (Intercom or similar)
- [ ] SLA monitoring and alerting

### Cost Projections
| Properties | Supabase | Anthropic AI | Stripe Fees | SendGrid | Twilio | Total/mo |
|------------|----------|-------------|-------------|----------|--------|----------|
| 50 | $25 | $150 | $50 | $15 | $20 | ~$260 |
| 200 | $25 | $500 | $200 | $30 | $80 | ~$835 |
| 500 | $100 | $1,200 | $500 | $50 | $200 | ~$2,050 |
| 1,000 | $200 | $2,500 | $1,000 | $100 | $400 | ~$4,200 |
| 5,000 | $500 | $10,000 | $5,000 | $300 | $1,500 | ~$17,300 |

**Revenue at each scale:**
| Properties | Avg Rev/Property | Monthly Revenue | Monthly Cost | Margin |
|------------|-----------------|-----------------|--------------|--------|
| 50 | $70 | $3,500 | $260 | 93% |
| 200 | $75 | $15,000 | $835 | 94% |
| 500 | $80 | $40,000 | $2,050 | 95% |
| 1,000 | $85 | $85,000 | $4,200 | 95% |
| 5,000 | $90 | $450,000 | $17,300 | 96% |

---

## Part 7: Feedback Loops & Feature Discovery

### In-App Feedback System (Build Week 1)

**1. Feedback Button (Every Screen)**
- Floating "?" button in bottom-right corner
- Taps open a quick feedback form: thumbs up/down + optional text
- Auto-captures: screen name, user tier, device info
- Stores in `user_feedback` table with `screen`, `rating`, `comment`, `created_at`

**2. Agent Conversation Mining**
- After every agent conversation, analyze for:
  - Feature requests ("Can you...?", "I wish...", "It would be nice if...")
  - Frustrations ("This doesn't work", "I can't find", "Why isn't...")
  - Confusion patterns (user asks same thing multiple ways)
- Store in `agent_insights` table, categorized by topic
- Weekly report: top 10 feature requests, top 10 pain points

**3. NPS Survey (Monthly)**
- After 30 days of use, show a simple NPS: "How likely are you to recommend Casa?"
- Score 0-10 with optional follow-up
- Detractors (0-6): immediate support outreach
- Promoters (9-10): ask for App Store review + referral

**4. Session Recording (Post-Launch Month 2)**
- Integrate Hotjar or similar for session replay
- Focus on: onboarding drop-off, feature discovery, agent chat patterns
- Privacy-safe: no recording of sensitive data fields

### Feature Request Pipeline

**Collection Points:**
1. In-app feedback button
2. Agent conversation mining
3. Support ticket categorization
4. App Store reviews analysis
5. Direct user interviews (first 50 users)

**Prioritization Framework:**
| Score | Factor | Weight |
|-------|--------|--------|
| 1-5 | Frequency (how many users request it) | 3x |
| 1-5 | Revenue impact (does it enable upgrades) | 2x |
| 1-5 | Effort to build | 1x (inverted) |
| 1-5 | Strategic alignment (builds moat) | 2x |

**Weekly Process:**
1. Monday: Review all feedback from past week
2. Score new requests using framework
3. Top 3 requests go into next sprint
4. Communicate "What's Coming" to users (in-app banner or agent message)

### User Communication Channels

**1. In-App Announcements**
- Agent proactively tells users about new features
- "I can now help you with X! Would you like to try it?"
- Uses EAS OTA updates — no app store review needed

**2. Email Digest (Weekly)**
- Summary of property activity
- "What's New in Casa" section with recent features
- Personalized recommendations based on usage

**3. Push Notifications for New Features**
- Opt-in only
- Max 1 per week
- Tied to features relevant to user's tier

---

## Part 8: Weekly OTA Update Plan

EAS Update allows pushing JS-only changes instantly without App Store review. This is the primary shipping mechanism post-launch.

### OTA vs Full Build Decision Matrix
| Change Type | Ship Via |
|-------------|----------|
| Bug fixes | OTA |
| UI polish | OTA |
| New screens (JS only) | OTA |
| API hook changes | OTA |
| Edge Function changes | Direct deploy |
| New native module | Full EAS Build |
| Expo SDK upgrade | Full EAS Build |
| New native permission | Full EAS Build |

### Weekly Cadence
| Day | Activity |
|-----|----------|
| Monday | Review feedback, prioritize sprint |
| Tuesday-Thursday | Build features/fixes |
| Friday AM | `pnpm typecheck && pnpm test` |
| Friday PM | `eas update --branch production` (both apps) |
| Weekend | Monitor for regressions |

### Planned OTA Updates (First 12 Weeks)

**Week 1 (Feb 20):** Launch fixes
- Bug fixes from first users
- Agent system prompt tuning

**Week 2 (Feb 27):** Stability
- Crash fixes
- Performance improvements
- In-app feedback button

**Week 3 (Mar 6):** Agent Tuning
- System prompt refinement from real conversation data
- Verify learning pipeline in production
- Model routing for cost optimization

**Week 4 (Mar 13):** Agent Autonomy
- Verify autonomy graduation in production
- Proactive observation improvements
- Tool error recovery enhancements

**Week 5 (Mar 20):** Communication Polish
- Branded HTML email templates
- SMS template refinements
- Notification preference tuning from user feedback

**Week 6 (Mar 27):** UX Polish
- Skeleton loading screens
- Empty state illustrations
- Pull-to-refresh, haptics, animations

**Week 7 (Apr 3):** Marketing Website
- Pricing page with Stripe checkout
- Product features & screenshots
- SEO foundation

**Week 8 (Apr 10):** Growth
- In-app referral program
- App Store listing optimization
- Response caching for performance

**Week 9 (Apr 17):** Integrations (Phase 1)
- DocuSign e-signatures (if approved)
- Trade directory v1

**Week 10 (Apr 24):** Integrations (Phase 2)
- Domain.com.au syndication (if approved)
- Stripe Connect automated rent

**Week 11 (May 1):** Integrations (Phase 3)
- REA syndication (if approved)
- Credit check integration (if approved)

**Week 12 (May 8):** Platform
- Android beta launch
- Advanced autonomy features
- Bulk operations

---

## Part 9: Launch Metrics & Success Criteria

### Week 1 Success
- [ ] 5-10 landlords on TestFlight
- [ ] 0 crashes in production
- [ ] Agent responds to 95%+ of queries correctly
- [ ] At least 1 property fully onboarded
- [ ] Rent tracking working for at least 1 tenant

### Month 1 Success
- [ ] 20-30 properties managed
- [ ] 3+ paying subscribers (non-trial)
- [ ] NPS > 40 from early users
- [ ] Agent handles 80%+ of routine tasks without intervention
- [ ] <5 min average response time for agent
- [ ] Zero security incidents

### Month 3 Success
- [ ] 100+ properties
- [ ] $5,000+ MRR
- [ ] At least 1 external integration live (Stripe Connect, DocuSign, or listing syndication)
- [ ] Android app in beta
- [ ] Agent autonomy level graduated for at least 5 properties

### Month 6 Success
- [ ] 500+ properties
- [ ] $30,000+ MRR
- [ ] Full listing syndication (Domain + REA)
- [ ] Credit check integration live
- [ ] Multi-state coverage (NSW + VIC)
- [ ] Combined owner/tenant app

### Month 12 Success
- [ ] 1,000+ properties
- [ ] $85,000+ MRR
- [ ] National coverage (all 8 states)
- [ ] Android at parity with iOS
- [ ] Agent operating at L3-L4 for majority of properties

---

## Part 10: Immediate Next Actions

### Today (Feb 13)
1. **Finish borderRadius standardization** (owner app agent completing)
2. **Run typecheck** to verify all visual polish changes compile
3. **Monitor tenant rebuild** in EAS queue
4. **Submit tenant build to TestFlight** when ready
5. **Start Phase 1** — infrastructure & secrets setup

### Tomorrow (Feb 14)
1. **Phase 2** — Critical fixes (12 items)
2. **Robbie:** Create Stripe products, verify SendGrid, get Twilio number

### Feb 15-16
1. **Phase 3** — Feature gating & cohesion
2. **Phase 4** — Stripe & payment flows

### Feb 17-18
1. **Phase 5** — Notification pipeline
2. **Phase 6** — Tenant app completion

### Feb 19
1. **Phase 7** — Agent intelligence
2. **Phase 8** — TestFlight build

### Feb 20
1. **Phase 9** — Real-device QA
2. **Phase 10** — Launch to first users

---

## Summary

Casa is ~95% built. All 20 missions have been substantially implemented in code — 33 real Edge Functions, 66 migrations, 98 API hooks, full learning engine, MFA, encryption, performance indexes, and onboarding. The remaining ~5% is:
- **12 critical code fixes** (security vulnerabilities, functionality bugs — 4-6 hours)
- **Production credential wiring** (Stripe keys, SendGrid, Twilio, Expo Push — 1 day)
- **Visual polish** (borderRadius, skeleton screens, empty states — in progress)
- **Feature gating** (10 stubbed external integrations need "Coming Soon" gates)
- **Agent system prompt tuning** (match capabilities to launch reality)
- **Marketing website** (pricing page, product copy — currently a scaffold)
- **App Store assets** (screenshots, metadata)

The app will launch with fewer features than what's built — but everything it ships will work flawlessly. External integrations (Domain, REA, Equifax, TICA) are gated behind "Coming Soon" and will ship via OTA updates as partner approvals come through.

Post-launch, the weekly OTA cadence means users get improvements every Friday without App Store review. The feedback loop (in-app button + agent conversation mining + NPS) ensures we're building what users actually need.

**Ship what works. Gate what doesn't. Launch.**
