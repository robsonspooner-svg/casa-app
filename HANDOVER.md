# Stead Project Handover Document

**Date**: January 22, 2026
**Status**: Mission 02 Complete - Ready for Mission 03

---

## Project Overview

**Stead** (formerly PropBot) is an AI-powered property management platform that replaces traditional property managers, enabling owners to self-manage properties with 90%+ automation at a fraction of the cost.

### Business Model
- **Base tier**: $25/week ($108/month) - 54% cheaper than PMs
- **Premium tier**: $30/week ($130/month) - 44% cheaper than PMs
- **Luxury tier**: $40/week ($173/month) - 28% cheaper than PMs

**Unit Economics**: ~$2/week cost per property = **90%+ profit margins**

### Key Documents (READ IN THIS ORDER)

1. **`/propbot/BRAND-AND-UI.md`** - **READ FIRST** - The UI/brand design system:
   - Logo specification: `<stead>` in monospace
   - Complete color palette (Canvas #FAFAFA, no pure black/white)
   - Typography scale and rules
   - Component specifications (cards, buttons, inputs, etc.)
   - Spacing system (4px base unit)
   - Animation guidelines
   - Full theme object code for implementation
   - **MANDATORY: Read before writing ANY UI code**

2. **`/propbot/STEAD-BIBLE.md`** - The master reference document containing:
   - Complete product vision and value proposition
   - Technical architecture diagrams
   - Database schema definitions
   - Agent system design
   - Feature specifications
   - Mobile app design specs
   - Integration specifications
   - Security & compliance requirements
   - Implementation roadmap (20 missions)

3. **`/propbot/PROJECT-STRUCTURE.md`** - Monorepo directory layout and conventions

4. **`/propbot/specs/ralph-missions/`** - Individual mission specifications

---

## Brand Identity

### Logo: `<stead>`

The Stead logo uses code-style angle brackets in monospace font (SF Mono).
- Communicates: technology-forward, developer aesthetic, containment/safety
- Color: #0A0A0A on light backgrounds, #FAFAFA on dark
- Never use pure black (#000) or pure white (#FFF)

### Design Philosophy

**"Premium, trustworthy, effortlessly simple"**

Stead should look like a $100M ARR product, not a $10k bootstrap. Key principles:
- Soft shadows, not harsh borders
- Canvas background (#FAFAFA), not pure white
- 16px border-radius on cards
- 48px button heights
- 4px spacing grid
- Minimal color (95% neutrals, 5% semantic color)
- Fast animations (≤200ms)

---

## What Has Been Built

### Mission 01: Project Setup (COMPLETE)

**Monorepo Structure** (`/propbot/`):
```
propbot/
├── apps/
│   ├── owner/          # Owner mobile app (Expo)
│   │   ├── app/(auth)/ # Login, Signup, Forgot Password
│   │   ├── app/(app)/  # Protected routes (Dashboard, Profile, Properties)
│   │   └── scripts/    # iOS simulator scripts
│   └── tenant/         # Tenant mobile app (Expo)
│       ├── app/(auth)/ # Login, Signup, Forgot Password
│       └── app/(app)/  # Protected routes (Dashboard, Profile, Maintenance)
├── packages/
│   ├── config/         # Shared THEME object (colors, spacing, typography)
│   ├── ui/             # Premium UI components (Button, Card, Input, Avatar, etc.)
│   └── api/            # Supabase client, useAuth, useProfile hooks
├── supabase/
│   └── migrations/     # Database migrations (profiles table)
├── eslint.config.js    # Shared ESLint configuration
├── BRAND-AND-UI.md     # Design system specification
├── STEAD-BIBLE.md      # Master reference document
├── PROJECT-STRUCTURE.md
└── HANDOVER.md         # This file
```

### Mission 02: Auth, Profiles & UI Foundation (COMPLETE)

**Implemented**:
- Premium UI components matching BRAND-AND-UI.md
- Supabase authentication (email/password)
- User profiles with avatar upload
- Protected route guards
- Row Level Security (RLS) policies
- ESLint with monorepo configuration

**Database**:
- `profiles` table with auto-creation trigger on signup
- `user_role` enum: owner, tenant, admin
- RLS policies for profile access

**UI Components** (`@stead/ui`):
- Button (primary, secondary, text variants)
- Card (default, elevated variants)
- Input (with label, error, helper text)
- Avatar (with fallback initials)
- ScreenContainer
- SteadLogo

**Auth Screens** (both apps):
- Login with email/password
- Signup with email confirmation flow
- Forgot Password with reset email
- Profile management with edit mode

**How to Run**:
```bash
cd /Users/robbiespooner/Desktop/propbot
pnpm install
pnpm dev                  # Run all apps

# Or run specific app:
cd apps/owner && pnpm start

# iOS Simulator (owner app):
cd apps/owner && pnpm ios:sim
```

**Quality Status**:
- `pnpm typecheck` - PASSING (5/5 packages)
- `pnpm lint` - PASSING (2/2 packages, 0 errors)
- `pnpm test` - PASSING (27 tests: 14 useAuth + 13 useProfile)

---

## Technology Stack

| Layer | Technology | Status |
|-------|------------|--------|
| **Mobile Apps** | Expo (React Native) | Working |
| **Web** | Expo Web (React Native Web) | Working |
| **API/Database** | Supabase | Not yet connected |
| **Agent Runtime** | Cloudflare Workers | Not yet built |
| **AI** | Claude API (Anthropic) | Not yet integrated |
| **Payments** | Stripe Connect | Not yet integrated |
| **Communications** | Twilio + SendGrid | Not yet integrated |

---

## Next Steps: Mission 03 - Properties

**Goal**: Property CRUD operations with address validation and photo management

### Key Deliverables
1. Property database schema (address, type, bedrooms, bathrooms, features)
2. Property list screen with search/filter
3. Add/Edit property form with:
   - Google Places address autocomplete
   - Photo upload (multiple images)
   - Property features selection
4. Property detail screen
5. Property settings (rent amount, availability)

### Third-Party Integration
- **Google Places API** - Address autocomplete and validation

### Database Tables
- `properties` - Core property data
- `property_photos` - Photo storage references
- `property_features` - Amenities/features

**Refer to**: `/propbot/specs/ralph-missions/MISSION-03-properties.md`

---

## Mission Roadmap (Expanded with Integrations)

| # | Mission | Key Deliverables | Third-Party Integrations | Status |
|---|---------|------------------|--------------------------|--------|
| 01 | Project Setup | Monorepo, Expo apps, shared packages | - | COMPLETE |
| 02 | Auth, Profiles & UI Foundation | Supabase auth, profiles, premium UI | Supabase Auth | COMPLETE |
| 03 | Properties | Property CRUD, address validation, photos | Google Places API (address autocomplete) | NEXT |
| 04 | Listings | Create/manage listings, **portal syndication** | **Domain API, REA (realestate.com.au) API**, Cloudinary (images) | Pending |
| 05 | Applications | Application forms, **tenant screening** | **Equifax (credit checks), TICA (tenancy database)** | Pending |
| 06 | Tenancies | Lease management, **e-signing**, **bond lodgement** | **DocuSign/Annature**, **State Bond Authorities (RTBA VIC, RBO NSW, RTA QLD)** | Pending |
| 07 | Rent Collection | Payment processing, **tenant-side Stripe** | **Stripe Connect** (both owner payouts AND tenant payments) | Pending |
| 08 | Arrears Management | Auto-reminders, breach notices | SendGrid (emails), Twilio (SMS) | Pending |
| 09 | Maintenance | Request system, job tracking | - | Pending |
| 10 | Trades Network | Tradesperson marketplace, quoting | - | Pending |
| 11 | Inspections | Photo reports, scheduling | - | Pending |
| 12 | Communications | Unified inbox, templates | Twilio, SendGrid, **WhatsApp Business API** | Pending |
| 13 | Finance Reports | Owner statements, tax reports | - | Pending |
| 14 | Agent Orchestrator | AI agent system, task automation | Claude API (Anthropic), Cloudflare Workers | Pending |
| 15 | Learning Engine | Owner preferences, smart defaults | Claude API | Pending |
| 16 | Admin Dashboard | Stead ops dashboard, analytics | - | Pending |
| 17 | Notifications | Push notifications, in-app alerts | Expo Push Notifications, OneSignal | Pending |
| 18 | Security Audit | Penetration testing, compliance | - | Pending |
| 19 | Performance | Optimization, caching | - | Pending |
| 20 | Polish | Final UX refinements, edge cases | - | Pending |

---

## Third-Party Integration Details

### Mission 04: Listings - Portal Syndication
**Critical for launch** - Properties must appear on Domain and REA to get tenants.

| Integration | Purpose | API Type | Notes |
|-------------|---------|----------|-------|
| **Domain API** | Syndicate listings to domain.com.au | REST | Requires agency account, XML feed alternative |
| **REA API** | Syndicate to realestate.com.au | REST | Requires agent license verification |
| **Cloudinary** | Image hosting/optimization | REST | CDN delivery, auto-resize |

### Mission 05: Applications - Tenant Screening
**Critical for risk management** - Owners need confidence in tenant quality.

| Integration | Purpose | API Type | Notes |
|-------------|---------|----------|-------|
| **Equifax** | Credit checks | REST/SOAP | Requires AFCA compliance, consent flow |
| **TICA** | Tenancy database (bad tenants) | REST | Check for prior breaches, VCAT orders |

### Mission 06: Tenancies - Legal & Bond
**Critical for compliance** - Bond lodgement is legally required within 10 days.

| Integration | Purpose | API Type | Notes |
|-------------|---------|----------|-------|
| **DocuSign** | E-signature for leases | REST | OR Annature (AU-based alternative) |
| **RTBA (VIC)** | Bond lodgement Victoria | REST/Portal | rtba.vic.gov.au |
| **RBO (NSW)** | Bond lodgement NSW | REST/Portal | fairtrading.nsw.gov.au |
| **RTA (QLD)** | Bond lodgement QLD | REST/Portal | rta.qld.gov.au |

### Mission 07: Rent Collection - Payments
**Critical for revenue** - This is how owners get paid.

| Integration | Purpose | API Type | Notes |
|-------------|---------|----------|-------|
| **Stripe Connect** | Owner payouts | REST | Custom/Express accounts for owners |
| **Stripe Connect** | Tenant payments | REST | Direct debit, card payments from tenants |

### Mission 12: Communications
| Integration | Purpose | API Type | Notes |
|-------------|---------|----------|-------|
| **Twilio** | SMS notifications | REST | Arrears reminders, inspection alerts |
| **SendGrid** | Email | REST | Statements, notices, marketing |
| **WhatsApp Business** | Messaging | REST | Tenant-preferred communication channel |

### Mission 14: Agent System
| Integration | Purpose | API Type | Notes |
|-------------|---------|----------|-------|
| **Claude API** | AI reasoning | REST | Anthropic, tool use for automation |
| **Cloudflare Workers** | Agent runtime | Durable Objects | Stateful agent execution |

---

## Integration Priority Matrix

| Priority | Integration | Mission | Why |
|----------|-------------|---------|-----|
| P0 - Launch Blocker | Stripe Connect | M07 | Can't collect rent without it |
| P0 - Launch Blocker | State Bond APIs | M06 | Legally required |
| P1 - Critical | Domain/REA | M04 | Can't find tenants without listings |
| P1 - Critical | Equifax/TICA | M05 | Risk management for owners |
| P2 - Important | DocuSign | M06 | E-signing is expected, but can launch with PDF |
| P2 - Important | Twilio/SendGrid | M08 | Arrears management needs comms |
| P3 - Nice to Have | WhatsApp | M12 | Preferred by tenants but not critical |
| P3 - Nice to Have | Cloudinary | M04 | Can use Supabase storage initially |

---

## Known Issues & Notes

1. **iOS Development**: Xcode is installed and simulator works, but expo-router requires a **development build** for iOS native testing. The web version works perfectly for development. To enable iOS native:
   - Run `npx expo prebuild --platform ios` (requires fixing CocoaPods path resolution in monorepo)
   - Or use EAS Build: `npx eas build --platform ios --profile development`
   - For now, use web (`npx expo start --web`) which works great for development

2. **Naming**: Project folder is `propbot` but product is now called **Stead**. Package names use `@stead/` namespace.

3. **Metro Config**: Custom `metro.config.js` in `/apps/owner/` handles workspace package resolution. Required for monorepo to work with Expo.

4. **pnpm Hoisting**: `.npmrc` has `shamefully-hoist=true` to work around Expo/Metro compatibility issues.

5. **UI is Basic**: Current UI is scaffold quality. Mission 02 Phase 0 must update all components to match BRAND-AND-UI.md before proceeding.

---

## Quality Gates & Mission Development Cycle

Every mission follows this development cycle:

### 1. Build Phase
- Implement mission features
- Write tests as you go
- Commit frequently

### 2. Test Phase
- `pnpm typecheck` - Zero TypeScript errors (5/5 packages)
- `pnpm lint` - Zero lint errors (2/2 packages)
- `pnpm test` - All tests pass (Vitest with @testing-library/react)
- Manual test in Expo Go / browser
- **Visual check against BRAND-AND-UI.md** - Must look premium

**Testing Infrastructure**:
- **Framework**: Vitest 1.x with jsdom environment
- **Libraries**: @testing-library/react for hook testing
- **Location**: `packages/api/src/__tests__/` for API hook tests
- **Mocks**: `packages/api/src/__mocks__/supabase.ts` for Supabase client mocking

### 3. Simplify Phase (MANDATORY)
After tests pass, run a code simplification pass:
- **Remove dead code**: Unused imports, variables, functions
- **Consolidate duplicates**: Extract shared logic into utilities
- **Simplify over-engineering**: Replace complex abstractions with simpler patterns
- **Consistent naming**: Ensure naming conventions are followed
- **Remove backwards-compatibility hacks**: No `_unusedVars`, re-exports, or `// removed` comments

### 4. Re-Test Phase
- Re-run all tests after simplification
- Ensure nothing broke
- If tests fail, fix and return to step 3

### 5. Document Phase
- Update HANDOVER.md with mission completion
- Note any known issues or tech debt
- Document any architectural decisions

---

## ESLint Configuration

ESLint is configured with rules that catch **real bugs**, not style preferences:

### Current Rules (What They Catch)

| Rule | What It Catches | Severity |
|------|-----------------|----------|
| `react-hooks/rules-of-hooks` | Hooks called conditionally or in loops - causes runtime crashes | Error |
| `react-hooks/exhaustive-deps` | Missing dependencies in useEffect - causes stale closures | Warn |
| `@typescript-eslint/no-unused-vars` | Unused variables - often indicates logic errors | Warn |
| `no-var` | `var` usage - causes scoping bugs | Error |
| `prefer-const` | Reassigned `const` - indicates logic errors | Warn |

### What ESLint Does NOT Enforce (By Design)
- Semicolons, quotes, trailing commas (use Prettier for formatting)
- Maximum line length (impractical for modern code)
- `any` types (too noisy during rapid development)
- Console statements (useful during development)

### Future Enhancements (If Needed)
If more coverage is needed, consider adding:
- `eslint-plugin-import` - catches broken imports, circular dependencies
- `@typescript-eslint/strict` - stricter type checking
- `eslint-plugin-react-native` - RN-specific rules

Run ESLint: `pnpm lint`

---

## Your Role

You are continuing development of Stead. Follow these principles:

1. **Read the Brand Guide First**: Before writing ANY UI, read `BRAND-AND-UI.md` completely

2. **Read the Bible**: Before making decisions, check `STEAD-BIBLE.md` for architectural guidance

3. **Mission-Driven**: Work through missions sequentially. Each mission builds on the last.

4. **Premium Quality**: The UI must look like a $100M ARR product. No bootstrap aesthetics.

5. **Test Everything**: Use `pnpm typecheck` and manual testing before marking complete

6. **Track Progress**: Keep this handover document updated for the next session

---

## Commands Reference

```bash
# Development
cd /Users/robbiespooner/Desktop/propbot
pnpm install              # Install all dependencies
pnpm dev                  # Run all apps in dev mode
pnpm typecheck            # TypeScript check (via turbo)
pnpm lint                 # Lint all packages (via turbo)
pnpm test                 # Run all tests (Vitest)
pnpm test:watch           # Run tests in watch mode
pnpm build                # Build all packages

# Run specific app
cd apps/owner && pnpm start           # Start owner app
cd apps/owner && pnpm ios:sim         # iOS Simulator with dev client
cd apps/tenant && pnpm start          # Start tenant app

# Quality checks (run before completing any mission)
pnpm typecheck && pnpm lint && pnpm test   # Full quality check

# Supabase
pnpm db:generate          # Generate types from schema
pnpm db:migrate           # Push migrations
pnpm db:reset             # Reset database
```

---

## Contact & Context

**Owner**: Robbie Spooner
**Location**: Australia
**Target Market**: Australian rental properties

The goal is to disrupt the $1.7B Australian property management market by providing AI-powered automation that saves landlords money while giving them more control.

---

*Last Updated: January 22, 2026 - Mission 02 Complete, Testing Infrastructure Added, Auth & ESLint Configured*
