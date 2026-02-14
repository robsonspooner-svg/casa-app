# Mission 20: Launch Preparation & Polish

## Overview
**Goal**: Final polish, testing, and preparation for production launch.
**Dependencies**: All previous missions
**Estimated Complexity**: Medium

## Success Criteria

### Phase A0: Combined App Entry Point & Onboarding
- [ ] Create role selection screen shown on first launch: "I'm a Property Owner" / "I'm a Tenant"
- [ ] Store selected role in user profile (`user_role` field) and route to appropriate app experience
- [ ] Build onboarding intro screens (3-4 swipeable screens explaining how Casa works for their role)
- [ ] Owner onboarding: "AI Property Manager" → "Automate Everything" → "Full Control" → "Get Started"
- [ ] Tenant onboarding: "Pay Rent Easily" → "Report Issues Instantly" → "Stay Informed" → "Get Started"
- [ ] Skip option on all onboarding screens
- [ ] Only show onboarding once (store `has_completed_onboarding` in AsyncStorage)

### Phase A1: Subscription Payment Website
- [ ] Create payment landing page at casaapp.com.au/pricing (or within marketing site)
- [ ] Display 3 tiers: Starter ($49/mo), Pro ($89/mo), Hands-Off ($149/mo) with feature comparison
- [ ] Integrate Stripe Checkout for subscription creation
- [ ] After successful payment, redirect user to app download / deep link back into app
- [ ] Sync subscription status to Supabase `profiles.subscription_tier` via Stripe webhook
- [ ] In-app upgrade flow: "Upgrade" buttons throughout the app link to the payment website
- [ ] Feature gate upgrade prompts show plan comparison and link to payment page

### Phase A2: UI/UX Polish
- [ ] Design system audit
- [ ] Consistent spacing and typography
- [ ] Animation and transitions
- [ ] Loading states everywhere
- [ ] Empty states for all lists
- [ ] Error states and recovery

### Phase B: Accessibility
- [ ] Screen reader support
- [ ] Color contrast compliance
- [ ] Touch target sizes
- [ ] Keyboard navigation (web)
- [ ] Reduced motion support

### Phase C: Localization Preparation
- [ ] Extract all strings
- [ ] Date/time formatting
- [ ] Currency formatting
- [ ] Number formatting
- [ ] RTL preparation (future)

### Phase D: App Store Preparation
- [ ] App icons (all sizes)
- [ ] Splash screens
- [ ] Screenshots for store
- [ ] App Store descriptions
- [ ] Privacy policy URLs
- [ ] Support URLs

### Phase E: Testing Completion
- [ ] Full E2E test suite passing
- [ ] Manual QA checklist
- [ ] Device testing matrix
- [ ] Beta testing feedback incorporated

### Phase F: Documentation
- [ ] User guide / help center
- [ ] FAQ content
- [ ] Onboarding flows
- [ ] Tooltips and hints

### Phase G: Legal & Compliance
- [ ] Terms of Service final
- [ ] Privacy Policy final
- [ ] Data processing agreements
- [ ] Cookie policy
- [ ] App Store compliance

### Phase H: PM Transition Onboarding Wizard
- [ ] Guided import flow for owners switching from a traditional PM
- [ ] **Step 0: Agent Autonomy Setup** — "How would you like Casa to help manage your properties?" with preset selector (Cautious/Balanced/Hands-Off). This MUST happen before property import so the agent respects user preferences from the start.
- [ ] Step 1: Import property details (address, rent amount, lease dates)
- [ ] Step 2: Import tenant details (name, email, phone)
- [ ] Step 3: Upload existing documents (lease, condition report, bond receipt)
- [ ] Step 4: Set up rent collection (connect Stripe, set schedule)
- [ ] Step 5: Send tenant welcome message (triggers Mission 12 PM transition flow)
- [ ] **Step 6: Agent Review** — Agent summarises what it found, identifies any compliance gaps or issues, and presents them for owner review before going active

**Inspection Preference Collection (within Step 0: Agent Autonomy Setup)**
During autonomy setup, the wizard should also ask:
- "How would you like to handle property inspections?"
  - "I'll do them myself" → Agent suggests self-service inspections when due
  - "Get a professional" → Agent auto-books professional inspectors when due
  - "Let me decide each time" → Agent asks before each inspection
- This preference is stored in `agent_preferences` and used by the inspection heartbeat scanner

- [ ] Template notice letter for outgoing PM (editable, owner sends themselves)
- [ ] Progress indicator showing setup completion percentage
- [ ] Skip/complete-later option for non-critical steps
- [ ] **24-hour grace period**: Agent waits 24h after onboarding before executing any L3+ autonomous actions. This gives the owner time to review and adjust settings.

### Phase H2: Deep Linking & Universal Links
- [ ] Configure `apple-app-site-association` for iOS Universal Links
- [ ] Configure `assetlinks.json` for Android App Links
- [ ] Implement URL scheme handler in app `_layout.tsx`
- [ ] Deep links from push notifications route to correct screen
- [ ] Deep links from email notifications route to correct screen
- [ ] Share links for listings open in app (if installed) or web (if not)
- [ ] Test all deep link routes: property detail, tenancy detail, maintenance request, task detail, chat

### Phase H3: OTA Updates (EAS Update)
- [ ] Configure EAS Update in `app.json`
- [ ] Implement update check on app launch
- [ ] Show "Update available" banner for optional updates
- [ ] Force update for critical security patches
- [ ] Fallback to App Store for native code changes

### Phase I: Data Export & Cancellation
- [ ] Full data export functionality (CSV + PDF)
- [ ] Export includes: property details, tenant info, payment history, maintenance records, inspection reports, messages
- [ ] Trigger export from Settings → Account → Export My Data
- [ ] 30-day access window after cancellation
- [ ] Subscription cancellation flow in Settings
- [ ] Cancel confirmation with summary of what happens (data access, active tenancies)
- [ ] No lock-in messaging throughout the cancel flow
- [ ] Post-cancellation: read-only access for 30 days, then data deleted

### Phase J: Subscription Management
- [ ] Subscription management screen in Settings
- [ ] Current plan display (Starter / Pro / Hands-Off)
- [ ] Upgrade/downgrade flow between tiers
- [ ] Billing history with downloadable invoices
- [ ] Payment method management (update card)
- [ ] Cancel subscription flow with retention offer
- [ ] Plan comparison within upgrade flow
- [ ] Proration handling for mid-cycle changes

### Phase K: Support Tier Routing
- [ ] Support priority queue system (Starter → normal, Pro → priority, Hands-Off → dedicated)
- [ ] In-app support chat with response time indicators
- [ ] Hands-Off tier: dedicated account manager assignment
- [ ] Pro tier: priority queue with faster response times
- [ ] Support ticket categorisation (billing, technical, property, general)
- [ ] Escalation paths for urgent issues

### Phase L: Production Deployment
- [ ] Production environment setup
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Monitoring configured
- [ ] Backup procedures verified
- [ ] Rollback procedures documented

## Design System Audit

### Typography Scale
```typescript
// packages/ui/src/theme/typography.ts
export const typography = {
  // Headings
  h1: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  h4: { fontSize: 18, lineHeight: 24, fontWeight: '600' },

  // Body
  bodyLarge: { fontSize: 18, lineHeight: 28, fontWeight: '400' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' },

  // Labels
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  labelSmall: { fontSize: 12, lineHeight: 16, fontWeight: '500' },

  // Caption
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
}
```

### Spacing System
```typescript
// packages/ui/src/theme/spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const layout = {
  screenPadding: spacing.md,
  cardPadding: spacing.md,
  sectionGap: spacing.lg,
  itemGap: spacing.sm,
}
```

### Color System
```typescript
// packages/ui/src/theme/colors.ts
export const colors = {
  // Primary
  primary: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    500: '#4CAF50', // Main
    600: '#43A047',
    700: '#388E3C',
  },

  // Semantic
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Neutral
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },

  // Text
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#BDBDBD',
    inverse: '#FFFFFF',
  },

  // Background
  background: {
    default: '#FFFFFF',
    paper: '#FAFAFA',
    elevated: '#FFFFFF',
  },
}
```

## Accessibility Checklist

### Screen Reader
- [ ] All images have alt text
- [ ] Form labels are associated
- [ ] Button labels are descriptive
- [ ] Headings are in logical order
- [ ] Focus order is logical

### Visual
- [ ] Text contrast ratio ≥ 4.5:1
- [ ] Large text contrast ≥ 3:1
- [ ] Non-text contrast ≥ 3:1
- [ ] Color is not only indicator
- [ ] Focus indicators visible

### Motor
- [ ] Touch targets ≥ 44x44pt
- [ ] Adequate spacing between targets
- [ ] No time limits (or extendable)
- [ ] Gesture alternatives available

## App Store Assets

### iOS App Store
```
Icon Sizes:
- 1024x1024 (App Store)
- 180x180 (@3x iPhone)
- 120x120 (@2x iPhone)
- 167x167 (@2x iPad Pro)
- 152x152 (@2x iPad)

Screenshots:
- 6.7" (1290 x 2796)
- 6.5" (1284 x 2778)
- 5.5" (1242 x 2208)
- 12.9" iPad Pro (2048 x 2732)
```

### Google Play Store
```
Icon:
- 512x512 (High-res icon)

Feature Graphic:
- 1024x500

Screenshots:
- Phone: 16:9 ratio (1080 x 1920 recommended)
- Tablet 7": 16:9 ratio
- Tablet 10": 16:9 ratio
```

## App Store Copy

### Short Description (80 chars)
```
Casa: AI property management for investors. Simplify rent, maintenance & more.
```

### Long Description
```
Casa is AI-powered property management for Australian investors who want
professional results without the property manager.

KEY FEATURES:

📊 Portfolio Dashboard
Get a complete overview of your properties, rental income, and key metrics
at a glance.

💰 Automated Rent Collection
Rent collected via Stripe. Tenants pay easily, you get paid on time.
Automatic arrears tracking and reminders.

🔧 Maintenance Made Simple
Tenants submit requests with photos. AI triages urgency, coordinates
tradespeople, and tracks progress in real-time.

📋 AI Condition Reports
Conduct inspections room-by-room on your phone. AI compares entry and
exit photos to flag damage vs wear-and-tear. Bond recommendations included.

💬 Built-in Messaging
Communicate with tenants directly in the app. Keep all correspondence in
one place. Under 2-minute AI response times.

📈 Smart Reports
Financial reports, cash flow analysis, and tax summaries ready when you
need them. Real-time financial dashboard.

🤖 AI Property Manager
Your intelligent property management assistant. Handles tenant queries,
coordinates maintenance, and automates routine tasks 24/7.

DESIGNED FOR AUSTRALIA:
- NSW, VIC, QLD tenancy law compliant
- Australian tax year reporting
- Local payment methods
- State-specific lease templates

PLANS FROM $49/MONTH:
- Starter ($49/mo): Full management tools for hands-on investors
- Pro ($89/mo): Professional inspections + tenant finding included
- Hands-Off ($149/mo): Everything done for you

No lock-in contracts. Cancel anytime. Full data export included.

Whether you're managing one property or a growing portfolio, Casa gives
you professional property management results at a fraction of the cost.

Download Casa today — property management without the property manager.
```

## PM Transition Onboarding Wizard

### Flow
```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Property Details                                     │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ Address           │  │ Weekly Rent       │                 │
│  │ [42 Oak Street]  │  │ [$670]            │                 │
│  └──────────────────┘  └──────────────────┘                 │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ Lease Start       │  │ Lease End         │                 │
│  │ [01/03/2024]     │  │ [28/02/2025]      │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                        [Next →]              │
├─────────────────────────────────────────────────────────────┤
│  Step 2: Tenant Details                                       │
│  Name:  [Sarah Johnson]                                       │
│  Email: [sarah@email.com]                                     │
│  Phone: [0412 345 678]                                        │
│  Bond:  [$2,680]                                              │
│                                        [Next →]              │
├─────────────────────────────────────────────────────────────┤
│  Step 3: Upload Documents                                     │
│  ☑ Lease agreement (PDF)              [Upload]               │
│  ☐ Entry condition report             [Upload]               │
│  ☐ Bond lodgement receipt             [Upload]               │
│  ☐ Insurance certificate              [Upload]               │
│                                        [Next →]              │
├─────────────────────────────────────────────────────────────┤
│  Step 4: Set Up Rent Collection                               │
│  Connect Stripe → Set rent schedule → Confirm amount         │
│                                        [Next →]              │
├─────────────────────────────────────────────────────────────┤
│  Step 5: Welcome Tenant                                       │
│  Preview welcome message:                                     │
│  "Hi Sarah, I'm taking over management of..."               │
│  [✓ Send welcome sequence]           [Complete Setup →]      │
└─────────────────────────────────────────────────────────────┘
```

### Files for PM Transition
```
apps/owner/app/(app)/
├── onboarding/
│   ├── transition/
│   │   ├── index.tsx              # Wizard container
│   │   ├── property-details.tsx   # Step 1
│   │   ├── tenant-details.tsx     # Step 2
│   │   ├── documents.tsx          # Step 3
│   │   ├── rent-setup.tsx         # Step 4
│   │   └── welcome-tenant.tsx     # Step 5

apps/owner/components/
├── TransitionWizard.tsx           # Multi-step wizard wrapper
├── TransitionProgress.tsx         # Step indicator (1-5)
├── DocumentUploader.tsx           # Upload existing documents
└── WelcomeMessagePreview.tsx      # Preview before sending
```

## Data Export & Cancellation

### Export Contents
```typescript
interface DataExport {
  // Account
  profile: UserProfile;
  subscription: SubscriptionDetails;

  // Properties
  properties: Property[];

  // Tenancies
  tenancies: Tenancy[];
  tenants: TenantInfo[];

  // Financial
  payments: Payment[];
  rentSchedules: RentSchedule[];
  financialReports: FinancialReport[];

  // Maintenance
  maintenanceRequests: MaintenanceRequest[];
  maintenanceQuotes: MaintenanceQuote[];

  // Inspections
  inspections: Inspection[];
  inspectionReports: InspectionReportPDF[]; // Actual PDFs

  // Communications
  messages: Message[];

  // Documents
  documents: Document[]; // Actual files included in ZIP
}
```

### Export Formats
- **CSV**: Tabular data (payments, tenancies, properties)
- **PDF**: Reports and inspection documents
- **JSON**: Full structured export for re-import
- **ZIP**: All files bundled together

### Cancellation Flow
1. User taps Settings → Account → Cancel Subscription
2. Show summary: "You have X properties, Y active tenancies"
3. Warning: "Active tenancies will need to be managed manually"
4. Option: "Export all data before cancelling" (triggers full export)
5. Confirm cancellation
6. 30-day read-only access window
7. After 30 days: data permanently deleted (with email reminder at 7 days)

### Database
```sql
-- Data export requests
CREATE TABLE data_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'expired'
  format TEXT NOT NULL DEFAULT 'zip',     -- 'zip', 'csv', 'json'
  file_url TEXT,
  file_size INTEGER,
  expires_at TIMESTAMPTZ,                 -- Download link expiry (7 days)
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Subscription management
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'upgraded', 'downgraded', 'cancelled', 'reactivated'
  from_plan TEXT,
  to_plan TEXT,
  stripe_subscription_id TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Subscription Management

### Plan Tiers
| Plan | Monthly | Features |
|------|---------|----------|
| Starter | $49 | Full management tools, AI chat, rent collection, maintenance |
| Pro | $89 | + Professional inspections, tenant finding, leasing |
| Hands-Off | $149 | + Open home hosting, entry/exit reports, dedicated account manager |

### Upgrade/Downgrade Rules
- **Upgrade**: Immediate access, prorated charge for remainder of billing period
- **Downgrade**: Takes effect at end of current billing period
- **Cancel**: Immediate (no more charges), 30-day read-only access
- **Reactivate**: Available within 30-day window, resumes previous plan

## Support Tier System

### Priority Levels
| Tier | Response Time Target | Support Type |
|------|---------------------|--------------|
| Starter | Within 24 hours | Standard (in-app chat, email) |
| Pro | Within 4 hours | Priority (in-app chat, email, phone callback) |
| Hands-Off | Within 1 hour | Dedicated (assigned account manager, direct line) |

### Implementation
```typescript
// packages/api/src/services/supportRouting.ts
interface SupportRouter {
  // Create support ticket with automatic priority based on plan
  createTicket(params: {
    userId: string;
    category: 'billing' | 'technical' | 'property' | 'general' | 'urgent';
    subject: string;
    message: string;
  }): Promise<SupportTicket>;

  // Get assigned support agent based on tier
  getAssignedAgent(userId: string): Promise<SupportAgent | null>;
}

// Support tickets table
interface SupportTicket {
  id: string;
  userId: string;
  priority: 'normal' | 'priority' | 'dedicated';
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
  assignedTo?: string;
  responseTimeTarget: number; // minutes
  firstResponseAt?: Date;
  resolvedAt?: Date;
}
```

## QA Checklist

### Critical Flows
- [ ] User registration and login
- [ ] Password reset
- [ ] Add property
- [ ] Create listing
- [ ] Submit application
- [ ] Accept application / create tenancy
- [ ] Pay rent
- [ ] Submit maintenance request
- [ ] Complete inspection
- [ ] Send message
- [ ] Generate report

### Edge Cases
- [ ] No properties (empty state)
- [ ] No tenants (empty state)
- [ ] No payments (empty state)
- [ ] Network offline
- [ ] Network slow (3G simulation)
- [ ] Session expired
- [ ] Invalid data handling
- [ ] Large data sets (100+ properties)

### Device Matrix
| Device | OS Version | Status |
|--------|------------|--------|
| iPhone 15 Pro | iOS 17 | ⬜ |
| iPhone 13 | iOS 16 | ⬜ |
| iPhone SE | iOS 15 | ⬜ |
| iPad Pro | iPadOS 17 | ⬜ |
| Pixel 8 | Android 14 | ⬜ |
| Samsung S23 | Android 14 | ⬜ |
| Samsung A54 | Android 13 | ⬜ |
| Older Android | Android 11 | ⬜ |

## Production Deployment Checklist

### Environment Setup
- [ ] Production Supabase project created
- [ ] Production Stripe account configured
- [ ] Production domain configured
- [ ] SSL certificates valid
- [ ] CDN configured

### Configuration
- [ ] All environment variables set
- [ ] API keys rotated from development
- [ ] Webhook endpoints configured
- [ ] Email sending configured
- [ ] Push notification credentials

### Database
- [ ] All migrations applied
- [ ] Seed data (if any) applied
- [ ] RLS policies verified
- [ ] Indexes optimized
- [ ] Backups configured

### Monitoring
- [ ] Sentry configured for production
- [ ] Uptime monitoring enabled
- [ ] Error alerting configured
- [ ] Performance monitoring enabled
- [ ] Log aggregation configured

### Security
- [ ] Security audit completed
- [ ] Penetration testing done
- [ ] Vulnerability scan clean
- [ ] Rate limiting configured
- [ ] DDoS protection enabled

## Files to Create/Modify

### Design System
```
packages/ui/src/
├── theme/
│   ├── index.ts                # Theme export
│   ├── colors.ts               # Color palette
│   ├── typography.ts           # Typography scale
│   ├── spacing.ts              # Spacing system
│   └── shadows.ts              # Shadow definitions
├── components/
│   └── [review all components for consistency]
```

### App Assets
```
apps/owner/assets/              # "Casa" branded
├── icon.png                    # 1024x1024 (Casa logo, navy background)
├── splash.png                  # Splash screen (Casa logo centered)
├── adaptive-icon.png           # Android adaptive
└── favicon.png                 # Web favicon

apps/tenant/assets/             # "Casa Tenant" branded
├── icon.png                    # 1024x1024 (Casa logo, lighter variant)
├── splash.png                  # Splash screen
├── adaptive-icon.png           # Android adaptive
└── favicon.png                 # Web favicon
```

### PM Transition & Onboarding
```
apps/owner/app/(app)/onboarding/
├── transition/
│   ├── index.tsx               # Wizard container
│   ├── property-details.tsx    # Step 1: Property import
│   ├── tenant-details.tsx      # Step 2: Tenant import
│   ├── documents.tsx           # Step 3: Document upload
│   ├── rent-setup.tsx          # Step 4: Stripe setup
│   └── welcome-tenant.tsx      # Step 5: Send welcome

apps/owner/components/onboarding/
├── TransitionWizard.tsx        # Multi-step wizard
├── TransitionProgress.tsx      # Step indicator
├── DocumentUploader.tsx        # Bulk document upload
└── WelcomeMessagePreview.tsx   # Preview welcome sequence
```

### Account & Subscription Management
```
apps/owner/app/(app)/settings/
├── account/
│   ├── index.tsx               # Account overview
│   ├── subscription.tsx        # Plan management
│   ├── billing.tsx             # Billing history
│   ├── export.tsx              # Data export
│   └── cancel.tsx              # Cancellation flow

apps/owner/components/settings/
├── PlanCard.tsx                # Current plan display
├── PlanComparison.tsx          # Upgrade/downgrade comparison
├── BillingHistory.tsx          # Invoice list
├── ExportProgress.tsx          # Export status indicator
└── CancelConfirmation.tsx      # Cancel flow steps
```

### Support System
```
apps/owner/app/(app)/support/
├── index.tsx                   # Support home
├── new-ticket.tsx              # Create ticket
└── [id].tsx                    # Ticket detail/chat

packages/api/src/services/
├── supportRouting.ts           # Priority routing
├── dataExport.ts               # Export orchestrator
└── subscriptionManager.ts      # Plan changes

supabase/functions/
├── generate-data-export/       # Background export job
│   └── index.ts
└── subscription-webhook/       # Stripe subscription events
    └── index.ts
```

### Documentation
```
docs/
├── user-guide/
│   ├── getting-started.md
│   ├── pm-transition.md        # Switching from a PM guide
│   ├── properties.md
│   ├── tenants.md
│   ├── payments.md
│   └── maintenance.md
├── faq.md
└── privacy-policy.md
```

### Deployment
```
infrastructure/
├── production/
│   ├── env.example             # Environment template
│   └── deploy.sh               # Deployment script
└── monitoring/
    ├── alerts.yml              # Alert definitions
    └── dashboards.json         # Monitoring dashboards
```

### Phase M: Website Promise Verification

Every claim on the marketing website (casa-lake.vercel.app) must be deliverable at launch. This checklist ensures no false advertising:

**Pricing Promises:**
- [ ] Starter $49/mo — all listed features functional
- [ ] Pro $89/mo — all listed features functional (tenant finding, lease management, bond handling, professional inspections)
- [ ] Hands-Off $149/mo — all listed features functional (open homes, entry/exit reports, priority support, dedicated account manager)
- [ ] "No hidden fees" — no unexpected charges beyond subscription
- [ ] "Cancel anytime" — cancellation flow works, 30-day read-only access

**Feature Promises:**
- [ ] "AI lists, screens, and recommends the best applicants" — tenant finding workflow functional
- [ ] "Background checks and scoring included" — Equifax/TICA integration OR clear disclosure that it's coming
- [ ] "Automatic debits, real-time tracking" — Stripe auto-pay functional
- [ ] "Smart arrears escalation" — arrears ladder functional with state-compliant notices
- [ ] "AI triages requests, finds tradespeople, coordinates jobs" — maintenance → trade workflow functional
- [ ] "Generates state-compliant documents, manages renewals, handles bond lodgement" — lease generation + bond API OR clear disclosure
- [ ] "AI responds to tenant queries instantly" — tenant chat with AI functional
- [ ] "Under 2 minutes" response time — verified with load testing
- [ ] "Schedules routine inspections, processes condition reports, flags issues proactively" — inspection system complete
- [ ] "Learns your preferences" — learning engine stores preferences from interactions
- [ ] "State tenancy compliant (NSW, VIC, QLD)" — all notices, forms, intervals verified per state
- [ ] "Bank-level encryption" — field-level encryption on sensitive data verified

**Differentiator Promises:**
- [ ] "24/7, instant" availability — agent available round the clock
- [ ] "Built in Australia" — all data stored in Australian region (Supabase Sydney)
- [ ] AI condition report comparison — entry/exit photo comparison functional

**Items That May Need Website Updates:**
If any feature is not ready for launch, the marketing website must be updated BEFORE launch to remove or qualify the claim. Better to remove a promise than launch with a broken feature.

### Phase N: Agent Launch Readiness Checklist

Before launch, the agent must pass these minimum viability checks:

**Chat Quality:**
- [ ] Agent handles all 7 launch-critical scenarios from AGENT-SPEC §1.4
- [ ] Agent never reveals it's AI in external communications
- [ ] Agent respects autonomy settings consistently
- [ ] Agent doesn't hallucinate tool calls for tools that don't exist
- [ ] Agent correctly refuses actions outside its capability
- [ ] Conversation history maintains context across sessions

**Tool Coverage:**
- [ ] All query tools return correct data (verify against database)
- [ ] Core action tools execute correctly (create_property, send_rent_reminder, schedule_inspection, etc.)
- [ ] Generate tools produce usable documents (lease, breach notice, inspection report)
- [ ] At least 2 external integrations working (SendGrid + Twilio minimum)
- [ ] At least 1 workflow functional end-to-end (maintenance_resolution)

**Proactive Behaviour:**
- [ ] Heartbeat engine runs on schedule (verified via logs)
- [ ] At least 4 scanners active (rent due, arrears, inspection, lease expiry)
- [ ] Agent creates tasks proactively (not just in response to chat)
- [ ] Owner receives proactive notifications (not just chat messages)

**Safety:**
- [ ] Agent cannot execute L3+ actions when autonomy is set to L0-L2
- [ ] Agent cannot access other users' data
- [ ] Agent rate limiting prevents abuse (20 requests/min)
- [ ] Agent handles Anthropic API failures gracefully (shows error, doesn't crash)
- [ ] Agent conversation data is encrypted in transit

## Launch Day Checklist

### Pre-Launch (T-1 week)
- [ ] Final QA sign-off
- [ ] Beta feedback addressed
- [ ] App Store submissions prepared
- [ ] Marketing materials ready
- [ ] Support team briefed

### Launch Day
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Support team on standby
- [ ] Social media announcements
- [ ] Email to waitlist

### Post-Launch (T+1 week)
- [ ] Review initial feedback
- [ ] Address critical issues
- [ ] Plan first update
- [ ] Collect testimonials

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm lint
pnpm build                      # Verify production build
```

## Commit Message Pattern
```
chore: <description>

Mission-20: Launch Preparation
```

## Notes
- Allow extra time for App Store review
- Have hotfix process ready
- Plan for initial user support load
- Document known issues
- Prepare rollback procedures
- Have communication plan for issues
- PM transition wizard is critical — most initial users will be switching from a PM
- Data export must be comprehensive (legal requirement under Privacy Act)
- No lock-in / cancel anytime is a core brand promise — must be frictionless
- Support tiers should be measurable (track response times for SLA compliance)
- Hands-Off "dedicated account manager" is a human resource post-launch — app just assigns and routes

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied and verified on production Supabase instance
- [ ] All RLS policies confirmed working in production environment
- [ ] All triggers and functions verified in production
- [ ] Database backup schedule configured and tested
- [ ] Seed data removed (no test/dummy data in production)

### Feature Verification (Mission-Specific)
- [ ] Role selection screen appears on first launch (owner vs tenant)
- [ ] Selected role persists and routes to correct app experience
- [ ] Onboarding intro screens display correctly for each role (3-4 screens)
- [ ] Onboarding can be skipped and only shows once
- [ ] Subscription payment website displays tier comparison correctly
- [ ] Stripe Checkout flow works end-to-end on payment website
- [ ] Successful payment syncs subscription tier to app via webhook
- [ ] In-app upgrade buttons link to payment website correctly
- [ ] Onboarding flow guides new users through key setup steps (PM transition wizard)
- [ ] Onboarding can be skipped and resumed later
- [ ] All empty states display friendly copy with actionable CTAs
- [ ] All loading states show skeleton/spinner (no blank screens)
- [ ] All error states show recovery options (retry, go back, contact support)
- [ ] App icons render correctly at all required sizes (iOS)
- [ ] Splash screen displays during cold start
- [ ] App Store screenshots captured for all required device sizes
- [ ] App Store description and metadata prepared
- [ ] Privacy policy URL accessible and accurate
- [ ] Sentry error reporting captures crashes and handled errors
- [ ] Edge case handling: no network, expired session, server error, empty data
- [ ] Accessibility: screen reader announces all interactive elements
- [ ] Accessibility: color contrast meets WCAG AA minimum
- [ ] Accessibility: reduced motion respected when system setting enabled
- [ ] All strings extracted for future localization
- [ ] Date/time/currency formatting uses AU locale correctly

### Visual & UX
- [ ] Tested on physical iOS device via Expo Go
- [ ] UI matches BRAND-AND-UI.md design system
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes
- [ ] Consistent spacing and typography across all screens
- [ ] Animations and transitions smooth (< 200ms, ease-out)

### Regression (All Prior Missions)
- [ ] All prior mission critical paths still work (see TESTING-METHODOLOGY.md Section 4)
- [ ] Navigation between all existing screens works
- [ ] Previously created data still loads correctly
- [ ] No new TypeScript errors in existing code
- [ ] Full E2E test suite passes (all missions)
- [ ] Manual QA checklist completed across device matrix

### Auth & Security
- [ ] Authenticated routes redirect unauthenticated users
- [ ] User can only access their own data (RLS verified)
- [ ] Session persists across app restarts
- [ ] No sensitive data in logs or error messages
- [ ] Production environment variables set (no test keys in production)
- [ ] Sentry DSN configured for production (not development)
- [ ] All third-party API keys rotated from development values

---

## Pre-Launch External Configuration Checklist

> **Purpose**: This section tracks ALL external services, accounts, API keys, and infrastructure that must be configured before launch. Items are compiled from all 20 missions to ensure nothing is missed.

---

### 1. Supabase (Missions 01–20)

| Item | Details | Status |
|------|---------|--------|
| Production project created | Separate from dev project `woxlvhzgannzhajtjnke` | ⬜ |
| `EXPO_PUBLIC_SUPABASE_URL` | Production API URL | ⬜ |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Production anon key | ⬜ |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role key (server-side only) | ⬜ |
| All migrations applied | Run all `/supabase/migrations/*.sql` on production | ⬜ |
| Connection codes migration | Apply `20240101000010_connection_codes.sql` for tenant-owner linking | ⬜ |
| RLS policies verified | All tables have correct row-level security | ⬜ |
| Edge Functions deployed | All Supabase Edge Functions live on production | ⬜ |
| Storage buckets created | `property-images`, `documents`, `inspection-photos`, `avatars`, `maintenance-photos` | ⬜ |
| Storage policies applied | Public/private read, authenticated write per bucket | ⬜ |
| Realtime enabled | For `messages`, `notifications`, `maintenance_requests` tables | ⬜ |
| Database backups configured | Point-in-time recovery enabled | ⬜ |
| Connection pooling | PgBouncer configured for production load | ⬜ |

---

### 2. Stripe (Missions 07, 08, 20)

| Item | Details | Status |
|------|---------|--------|
| Stripe Platform Account | Australian business verification completed | ⬜ |
| `STRIPE_SECRET_KEY` | Production secret key | ⬜ |
| `STRIPE_PUBLISHABLE_KEY` | Production publishable key | ⬜ |
| `STRIPE_WEBHOOK_SECRET` | For payment event webhooks | ⬜ |
| Stripe Connect enabled | Platform type: Express accounts for owners | ⬜ |
| Connect onboarding configured | Redirect URLs, branding, fee structure | ⬜ |
| BECS Direct Debit enabled | AU bank payment method activated | ⬜ |
| Card payments enabled | Visa/Mastercard for rent payments | ⬜ |
| Subscription Products created | Starter ($49), Pro ($89), Hands-Off ($149) in Stripe | ⬜ |
| Add-On Products created | All 6 add-on services as Stripe products | ⬜ |
| Webhook endpoints configured | `payment_intent.succeeded`, `invoice.paid`, `customer.subscription.*`, `account.updated` | ⬜ |
| Platform fee configured | 1.5% application fee on Connect payments | ⬜ |
| Payout schedule set | Daily payouts to connected accounts | ⬜ |
| Test mode verified | Full payment flow tested in Stripe test mode | ⬜ |
| Go-live checklist complete | Stripe's own go-live requirements satisfied | ⬜ |

#### Deferred from Mission 07 — Stripe Edge Functions

These items were deferred from Mission 07 because they require live Stripe credentials and Supabase Edge Function deployment:

| Item | File to Create | Details | Status |
|------|----------------|---------|--------|
| **Create Payment Intent** | `supabase/functions/create-payment-intent/index.ts` | Creates Stripe PaymentIntent for rent payments | ⬜ |
| **Confirm Payment Webhook** | `supabase/functions/stripe-webhook/index.ts` | Handles `payment_intent.succeeded`, updates `payments` table | ⬜ |
| **Failed Payment Webhook** | `supabase/functions/stripe-webhook/index.ts` | Handles `payment_intent.payment_failed`, marks payment failed | ⬜ |
| **Subscription Webhook** | `supabase/functions/stripe-subscription-webhook/index.ts` | Syncs `profiles.subscription_tier` from `customer.subscription.*` events | ⬜ |
| **Invoice Webhook** | `supabase/functions/stripe-webhook/index.ts` | Handles `invoice.paid` and `invoice.payment_failed` for subscriptions | ⬜ |
| **Auto-Pay Cron Job** | `supabase/functions/process-autopay/index.ts` | Scheduled function to process auto-pay on due dates | ⬜ |
| **Connect Account Webhook** | `supabase/functions/stripe-webhook/index.ts` | Handles `account.updated` for owner Stripe Connect status | ⬜ |
| **Add-On Purchase Intent** | `supabase/functions/create-addon-payment/index.ts` | Creates one-off PaymentIntent for add-on purchases | ⬜ |

---

### 3. Anthropic / Claude AI (Missions 03, 14, 15)

| Item | Details | Status |
|------|---------|--------|
| Anthropic API account | Production account with billing | ⬜ |
| `ANTHROPIC_API_KEY` | Production API key | ⬜ |
| Model access confirmed | Claude Sonnet (or chosen model) available | ⬜ |
| Rate limits adequate | Sufficient for expected user load | ⬜ |
| Usage alerts configured | Billing alerts for API spend | ⬜ |
| System prompts finalised | Agent personality, tool definitions, safety rails | ⬜ |
| Token budget configured | Max tokens per conversation, per day per user | ⬜ |

---

### 4. Cloudflare Workers (Mission 14)

| Item | Details | Status |
|------|---------|--------|
| Cloudflare account | Workers plan activated | ⬜ |
| `CLOUDFLARE_API_TOKEN` | For deployment | ⬜ |
| `CLOUDFLARE_ACCOUNT_ID` | Account identifier | ⬜ |
| Worker deployed | `workers/agent/` deployed to production | ⬜ |
| Custom domain configured | Worker route or custom domain for agent API | ⬜ |
| KV namespaces created | For agent session storage, rate limiting | ⬜ |
| Environment variables set | All secrets configured in Worker settings | ⬜ |
| Rate limiting configured | Per-user request limits | ⬜ |

---

### 5. Expo / EAS Build (Missions 01–20)

| Item | Details | Status |
|------|---------|--------|
| Expo account | Organisation account for Casa | ⬜ |
| `EXPO_TOKEN` | For CI/CD builds | ⬜ |
| EAS Build configured | `eas.json` with production profile | ⬜ |
| iOS Distribution Certificate | Apple Developer Program ($99/year) | ⬜ |
| iOS Provisioning Profile | Production distribution profile | ⬜ |
| Android Keystore | Production signing key (KEEP BACKED UP) | ⬜ |
| `EXPO_PUBLIC_*` env vars | All public env vars in EAS secrets | ⬜ |
| Push notification credentials | APNs key (iOS) + FCM key (Android) | ⬜ |
| App identifiers registered | `com.casa.owner` and `com.casa.tenant` | ⬜ |
| OTA Updates configured | EAS Update for over-the-air JS updates | ⬜ |

---

### 6. Apple Developer (Mission 20)

| Item | Details | Status |
|------|---------|--------|
| Apple Developer Program | Enrolled ($99 AUD/year) | ⬜ |
| App Store Connect | Owner app + Tenant app created | ⬜ |
| Bundle IDs registered | `com.casa.owner`, `com.casa.tenant` | ⬜ |
| APNs Authentication Key | For push notifications | ⬜ |
| App Store screenshots | All required device sizes | ⬜ |
| App Store metadata | Description, keywords, categories | ⬜ |
| Privacy policy URL | Publicly accessible | ⬜ |
| App Review preparation | Demo account credentials for reviewers | ⬜ |

---

### 7. Google Play (Mission 20)

| Item | Details | Status |
|------|---------|--------|
| Google Play Developer | Account registered ($25 USD one-time) | ⬜ |
| Play Console apps created | Owner app + Tenant app listings | ⬜ |
| FCM configuration | Firebase Cloud Messaging for push | ⬜ |
| `google-services.json` | Firebase config for Android | ⬜ |
| Play Store screenshots | All required device sizes | ⬜ |
| Play Store metadata | Description, categorisation | ⬜ |
| Content rating questionnaire | Completed for both apps | ⬜ |
| Data safety section | Privacy declarations completed | ⬜ |

---

### 8. SendGrid (Missions 12, 16, 17)

| Item | Details | Status |
|------|---------|--------|
| SendGrid account | Verified sender, production plan | ⬜ |
| `SENDGRID_API_KEY` | Production API key | ⬜ |
| Sender domain verified | DNS records (SPF, DKIM, DMARC) for `@casa.au` or chosen domain | ⬜ |
| Email templates created | Rent reminders, arrears notices, maintenance updates, welcome sequences, inspection notifications, PM transition emails | ⬜ |
| Transactional templates | Password reset, email verification, payment receipts | ⬜ |
| Suppression management | Unsubscribe handling configured | ⬜ |
| IP warm-up plan | If using dedicated IP | ⬜ |

---

### 9. Twilio (Missions 12, 16, 17)

| Item | Details | Status |
|------|---------|--------|
| Twilio account | Australian phone number provisioned | ⬜ |
| `TWILIO_ACCOUNT_SID` | Account SID | ⬜ |
| `TWILIO_AUTH_TOKEN` | Auth token | ⬜ |
| `TWILIO_PHONE_NUMBER` | Australian mobile number for SMS | ⬜ |
| SMS templates configured | Rent reminders, urgent maintenance, verification codes | ⬜ |
| Messaging service created | For bulk/scheduled SMS | ⬜ |
| Opt-out handling | STOP/HELP keyword responses | ⬜ |
| A2P 10DLC registration | If required for Australian SMS | ⬜ |

---

### 10. Sentry (Missions 02, 20)

| Item | Details | Status |
|------|---------|--------|
| Sentry account | Organisation created | ⬜ |
| `SENTRY_DSN` (owner app) | Production DSN for owner app | ⬜ |
| `SENTRY_DSN` (tenant app) | Production DSN for tenant app | ⬜ |
| `SENTRY_DSN` (worker) | Production DSN for Cloudflare Worker | ⬜ |
| Source maps uploaded | Via EAS Build hooks | ⬜ |
| Release tracking | Version tagging for releases | ⬜ |
| Alert rules configured | Error spike alerts, performance degradation | ⬜ |
| Team notification channels | Slack/email for critical errors | ⬜ |

---

### 11. Google Maps / Places API (Missions 04, 09)

| Item | Details | Status |
|------|---------|--------|
| Google Cloud project | Billing enabled | ⬜ |
| `GOOGLE_MAPS_API_KEY` (iOS) | iOS-restricted key | ⬜ |
| `GOOGLE_MAPS_API_KEY` (Android) | Android-restricted key | ⬜ |
| Places API enabled | For address autocomplete | ⬜ |
| Geocoding API enabled | For property location lookup | ⬜ |
| Maps SDK enabled | For property map display (if used) | ⬜ |
| API key restrictions | Bundle ID / package name restrictions applied | ⬜ |
| Usage quotas set | Budget alerts for API spend | ⬜ |

---

### 12. Domain & DNS (Mission 20)

| Item | Details | Status |
|------|---------|--------|
| Domain registered | `casa.au` or chosen domain | ⬜ |
| DNS configured | A/CNAME records for marketing site | ⬜ |
| SSL certificates | Auto-renewed via provider | ⬜ |
| Email DNS records | SPF, DKIM, DMARC for SendGrid | ⬜ |
| Deep link configuration | `apple-app-site-association` + `assetlinks.json` | ⬜ |
| Marketing site deployed | Next.js site on Vercel/similar | ⬜ |

---

### 13. Vercel (Marketing Site)

| Item | Details | Status |
|------|---------|--------|
| Vercel account | Team/Pro plan | ⬜ |
| Marketing site deployed | `marketing/website/` Next.js app | ⬜ |
| Custom domain connected | `casa.au` or chosen domain | ⬜ |
| Environment variables | Any API keys for contact forms, analytics | ⬜ |

---

### 14. Analytics (Mission 20)

| Item | Details | Status |
|------|---------|--------|
| Analytics provider chosen | PostHog / Mixpanel / Amplitude | ⬜ |
| `ANALYTICS_API_KEY` | Production key | ⬜ |
| Key events defined | Signup, property_added, rent_paid, maintenance_created, subscription_started | ⬜ |
| Funnels configured | Onboarding, payment, maintenance resolution | ⬜ |
| Privacy compliance | AU Privacy Act compliant data collection | ⬜ |

---

### 15. Document Generation (Missions 10, 11, 18)

| Item | Details | Status |
|------|---------|--------|
| PDF generation service | For inspection reports, lease documents, tax summaries | ⬜ |
| Template engine | Lease templates for NSW, VIC, QLD | ⬜ |
| State-specific forms | Bond lodgement, condition reports per state | ⬜ |
| Digital signature provider | For lease signing (if required at launch) | ⬜ |

---

### 16. Property Data APIs (Mission 09)

| Item | Details | Status |
|------|---------|--------|
| Domain.com.au API | For rental listing syndication (if used) | ⬜ |
| realestate.com.au API | For rental listing syndication (if used) | ⬜ |
| CoreLogic / RP Data | For property valuations (if used) | ⬜ |
| API agreements signed | Commercial terms for data access | ⬜ |

---

### 17. Legal & Compliance (Mission 20)

| Item | Details | Status |
|------|---------|--------|
| ABN registered | Australian Business Number for Casa | ⬜ |
| Terms of Service | Lawyer-reviewed, published to domain | ⬜ |
| Privacy Policy | AU Privacy Act compliant, published | ⬜ |
| Data Processing Agreement | For Supabase, Stripe, etc. | ⬜ |
| AFSL considerations | Financial services licensing review (rent collection) | ⬜ |
| State tenancy law compliance | Verified for NSW, VIC, QLD at minimum | ⬜ |
| Insurance | Professional indemnity, cyber liability | ⬜ |
| Trust account requirements | If holding tenant funds (state-dependent) | ⬜ |

---

### 18. CI/CD Pipeline (Mission 20)

| Item | Details | Status |
|------|---------|--------|
| GitHub Actions | Workflows for test, typecheck, build | ⬜ |
| Branch protection | Main branch requires CI pass | ⬜ |
| Automated EAS builds | On merge to main → production build | ⬜ |
| Preview builds | PR preview builds via EAS | ⬜ |
| Secret management | All secrets in GitHub Actions / EAS | ⬜ |

---

### 19. Uptime & Monitoring (Mission 20)

| Item | Details | Status |
|------|---------|--------|
| Uptime monitoring | BetterUptime / Pingdom for API + marketing site | ⬜ |
| Status page | Public status page for users | ⬜ |
| PagerDuty / Opsgenie | On-call alerting for critical issues | ⬜ |
| Performance monitoring | Supabase dashboard + Sentry performance | ⬜ |
| Log aggregation | Centralised logging for Edge Functions + Worker | ⬜ |

---

### 20. Push Notifications (Missions 16, 17)

| Item | Details | Status |
|------|---------|--------|
| Expo Push Service | Configure in EAS for both apps | ⬜ |
| APNs key uploaded | Apple Push Notification service key in Expo | ⬜ |
| FCM credentials | Firebase Cloud Messaging server key in Expo | ⬜ |
| Notification categories | Rent, maintenance, messages, inspections, system | ⬜ |
| Notification preferences | User settings for each category | ⬜ |
| Silent push configured | For background data sync | ⬜ |

---

### Environment Variables Summary

All environment variables that must be set for production:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Cloudflare
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=

# SendGrid
SENDGRID_API_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Sentry
SENTRY_DSN_OWNER=
SENTRY_DSN_TENANT=
SENTRY_DSN_WORKER=
SENTRY_AUTH_TOKEN=

# Google Maps
GOOGLE_MAPS_API_KEY_IOS=
GOOGLE_MAPS_API_KEY_ANDROID=

# Expo
EXPO_TOKEN=

# Analytics
ANALYTICS_API_KEY=

# Push Notifications
EXPO_PUSH_ACCESS_TOKEN=

# App Config
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_ENVIRONMENT=production
```

---

### Priority Setup Order

Configure these accounts in this order to unblock development and testing:

1. **Supabase** (production project) — Unblocks all data flows
2. **Stripe** (platform + Connect) — Unblocks payments testing
3. **Anthropic** — Unblocks AI agent
4. **Expo / EAS** — Unblocks production builds
5. **Sentry** — Unblocks error monitoring
6. **SendGrid + Twilio** — Unblocks notifications
7. **Google Maps** — Unblocks address features
8. **Cloudflare** — Unblocks agent worker deployment
9. **Apple Developer + Google Play** — Unblocks app store submission
10. **Domain + DNS** — Unblocks marketing site and deep links
11. **Analytics** — Unblocks usage tracking
12. **Legal** — Must be complete before public launch
