# Mission 02: Authentication, User Profiles & UI Foundation

## Overview
**Goal**: Implement secure authentication, user profile management, subscription tier awareness, AND establish the premium UI foundation using the Casa Brand & UI Design System.
**Dependencies**: Mission 01 (Project Setup)
**Estimated Complexity**: Medium-High

**CRITICAL**: Before writing any UI code, read `/BRAND-AND-UI.md` thoroughly. Every component must follow the design system exactly.

## Success Criteria

### Phase 0: UI Foundation (DO THIS FIRST)
- [ ] Read and understand `/BRAND-AND-UI.md` completely
- [ ] Update `@casa/config` with the full theme object from design system
- [ ] Update `@casa/ui` Button component to match design system specs
- [ ] Update `@casa/ui` Card component to match design system specs
- [ ] Create `@casa/ui` Input component per design system
- [ ] Create `@casa/ui` Avatar component per design system
- [ ] Create `@casa/ui` Badge/StatusPill component per design system
- [ ] Create `@casa/ui` ScreenContainer component (handles canvas background, safe areas)
- [ ] Test all components visually - must look premium, not bootstrap

### Phase A: Supabase Setup
- [ ] Create Supabase project and obtain credentials
- [ ] Add environment variables to both apps (.env.local)
- [ ] Initialize Supabase client in app entry points
- [ ] Verify connection works (simple query test)

### Phase B: Database Schema
- [ ] Create `profiles` table with RLS policies
- [ ] Create `user_roles` enum (owner, tenant, admin)
- [ ] Set up automatic profile creation trigger on auth.users insert
- [ ] Test RLS policies (users can only read/write own profile)

### Phase C: Auth UI - Owner App
- [ ] Create LoginScreen with email/password
- [ ] Create SignUpScreen with email/password + name
- [ ] Create ForgotPasswordScreen
- [ ] Implement auth state persistence (stay logged in)
- [ ] Add logout functionality
- [ ] Protect routes (redirect to login if not authenticated)

### Phase D: Auth UI - Tenant App
- [ ] Copy and adapt auth screens from owner app
- [ ] Adjust branding/colors for tenant app
- [ ] Test full auth flow

### Phase E: Profile Management
- [ ] Create ProfileScreen (view/edit profile)
- [ ] Add avatar upload (Supabase Storage)
- [ ] Add phone number field with AU validation
- [ ] Create useAuth hook for easy auth state access
- [ ] Create useProfile hook for profile data

### Phase F: Subscription Tier & Feature Gating
- [ ] Add `subscription_tier` field to `profiles` table (starter, pro, hands_off)
- [ ] Add `subscription_status` field (trialing, active, past_due, cancelled)
- [ ] Add `stripe_customer_id` field to profiles
- [ ] Create `useFeatureGate` hook that checks tier→feature access
- [ ] Create `FeatureGate` wrapper component (renders children or upgrade prompt)
- [ ] Create `UpgradePrompt` component (shows feature benefit + upgrade CTA)
- [ ] Define tier→feature mapping constant (see Tier Feature Matrix below)
- [ ] Ensure all gated features show meaningful upgrade prompts, not just locks
- [ ] Test feature gate with each tier level

### Phase G: Testing
- [ ] Unit tests for auth hooks
- [ ] Unit tests for useFeatureGate hook
- [ ] Integration tests for auth flows
- [ ] E2E test: Sign up → Login → View Profile → Logout
- [ ] E2E test: Feature gate blocks Starter user from Pro features

## Database Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum
CREATE TYPE user_role AS ENUM ('owner', 'tenant', 'admin');

-- Subscription tier enum
CREATE TYPE subscription_tier AS ENUM ('starter', 'pro', 'hands_off');

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'owner',

  -- Subscription (owner only, NULL for tenants)
  subscription_tier subscription_tier DEFAULT 'starter',
  subscription_status subscription_status DEFAULT 'active',
  stripe_customer_id TEXT,
  trial_ends_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Tier Feature Matrix

This constant defines which features are available at each tier. It is the single source of truth for feature gating throughout the app.

```typescript
// packages/api/src/constants/tierFeatures.ts

export const TIER_FEATURES = {
  starter: {
    // Included
    properties: true,
    tenancies: true,
    rent_collection: true,
    maintenance_requests: true,
    communications: true,
    ai_chat: true,
    financial_reports: true,
    lease_generation: true,
    // Not included (show upgrade prompts)
    tenant_finding: false,        // Available as add-on ($79/listing)
    professional_inspection: false, // Available as add-on ($99)
    open_home_hosting: false,      // Available as add-on ($79/session)
    photography: false,            // Available as add-on ($149)
    emergency_callout: false,      // Available as add-on ($49)
    routine_inspections: false,    // Available as add-on ($99)
    leasing_service: false,        // Pro+ only
    entry_exit_reports: false,     // Pro+ only
    auto_inspections: false,       // Pro+ only
  },
  pro: {
    // Everything in Starter, PLUS:
    tenant_finding: true,
    professional_inspection: true,
    routine_inspections: true,
    leasing_service: true,
    entry_exit_reports: true,
    auto_inspections: true,
    open_home_hosting: false,      // Available as add-on ($79/session)
    photography: false,            // Available as add-on ($149)
    emergency_callout: false,      // Available as add-on ($49)
    dedicated_manager: false,      // Hands-Off only
    custom_automation_rules: false, // Hands-Off only
    priority_support: false,       // Hands-Off only
  },
  hands_off: {
    // Everything in Pro, PLUS:
    open_home_hosting: true,
    photography: true,
    emergency_callout: true,
    dedicated_manager: true,
    custom_automation_rules: true,
    priority_support: true,
  },
} as const;

export type Feature = keyof typeof TIER_FEATURES.starter;

export const ADD_ON_PRICES: Record<string, { price: number; unit: string }> = {
  tenant_finding: { price: 79, unit: 'per listing' },
  professional_inspection: { price: 99, unit: 'per inspection' },
  open_home_hosting: { price: 79, unit: 'per session' },
  photography: { price: 149, unit: 'per property' },
  emergency_callout: { price: 49, unit: 'per callout' },
  routine_inspections: { price: 99, unit: 'per inspection' },
};
```

## Feature Gate Hook

```typescript
// packages/api/src/hooks/useFeatureGate.ts

import { useProfile } from './useProfile';
import { TIER_FEATURES, ADD_ON_PRICES, Feature } from '../constants/tierFeatures';

interface FeatureGateResult {
  hasAccess: boolean;
  tier: 'starter' | 'pro' | 'hands_off';
  isAddOn: boolean;          // Can purchase as one-off
  addOnPrice?: { price: number; unit: string };
  upgradeTier?: string;      // Which tier unlocks this
}

export function useFeatureGate(feature: Feature): FeatureGateResult {
  const { profile } = useProfile();
  const tier = profile?.subscription_tier ?? 'starter';

  const hasAccess = TIER_FEATURES[tier]?.[feature] ?? false;
  const isAddOn = feature in ADD_ON_PRICES && !hasAccess;
  const addOnPrice = isAddOn ? ADD_ON_PRICES[feature] : undefined;

  // Determine which tier unlocks this feature
  let upgradeTier: string | undefined;
  if (!hasAccess) {
    if (TIER_FEATURES.pro[feature]) upgradeTier = 'pro';
    else if (TIER_FEATURES.hands_off[feature]) upgradeTier = 'hands_off';
  }

  return { hasAccess, tier, isAddOn, addOnPrice, upgradeTier };
}
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── index.ts                    # Update: Add profile queries
├── constants/
│   └── tierFeatures.ts         # Tier→feature mapping + add-on prices
├── hooks/
│   ├── useAuth.ts              # Auth state hook
│   ├── useProfile.ts           # Profile data hook
│   └── useFeatureGate.ts       # Feature gating hook
├── components/
│   ├── FeatureGate.tsx         # Wrapper: renders children or UpgradePrompt
│   └── UpgradePrompt.tsx       # Shows feature benefit + upgrade/add-on CTA
└── types/
    └── database.ts             # Supabase generated types
```

### Owner App
```
apps/owner/
├── .env.local                  # Supabase credentials
├── app/
│   ├── _layout.tsx             # Update: Auth provider wrapper
│   ├── (auth)/
│   │   ├── _layout.tsx         # Auth stack layout
│   │   ├── login.tsx           # Login screen
│   │   ├── signup.tsx          # Sign up screen
│   │   └── forgot-password.tsx # Password reset
│   ├── (app)/
│   │   ├── _layout.tsx         # Protected app layout
│   │   ├── index.tsx           # Dashboard (move existing)
│   │   ├── properties.tsx      # Properties (move existing)
│   │   └── profile.tsx         # Profile screen
│   └── index.tsx               # Root redirect based on auth
└── components/
    └── AuthGuard.tsx           # Auth protection wrapper
```

### Tenant App
```
apps/tenant/
├── .env.local                  # Supabase credentials
├── app/
│   ├── _layout.tsx             # Update: Auth provider wrapper
│   ├── (auth)/                 # Same structure as owner
│   └── (app)/                  # Same structure as owner
└── components/
    └── AuthGuard.tsx
```

### Shared UI
```
packages/ui/src/
├── components/
│   ├── Input.tsx               # Text input component
│   ├── Avatar.tsx              # Avatar display/upload
│   └── FormField.tsx           # Label + Input + Error
└── index.ts                    # Export new components
```

## Validation Commands
```bash
pnpm typecheck                  # Must pass
pnpm test                       # Must pass
pnpm test:e2e                   # Must pass
```

## Commit Message Pattern
```
feat(auth): <description>

Mission-02: Authentication & Profiles
```

## Notes
- Use Supabase Auth for all authentication
- Store minimal data in profiles (no PII beyond name/email/phone)
- Avatar images go to Supabase Storage `avatars` bucket
- Phone validation should accept AU mobile format (+61 or 04xx)

## UI/Brand Requirements (MANDATORY)

**Reference**: `/BRAND-AND-UI.md`

### Brand: Casa
Casa uses a clean, premium navy-gradient identity. The logo is "Casa" in Inter Bold.

### Design System Tokens

| Token | Value | Usage |
|-------|-------|-------|
| **Casa Navy** | `#1B1464` | Primary brand, headers, CTA buttons |
| **Navy Light** | `#2D2080` | Hover states, gradient end |
| **Indigo** | `#4338CA` | Accent gradients, highlights |
| **Indigo Light** | `#6366F1` | Secondary accents |
| **Canvas** | `#FAFAFA` | App background |
| **Surface** | `#FFFFFF` | Cards |
| **Warm Subtle** | `#FAF8F5` | Alternate section backgrounds |
| **Text Primary** | `#0A0A0A` | Headlines, primary text |
| **Text Secondary** | `#525252` | Body text |
| **Text Tertiary** | `#A3A3A3` | Hints, placeholders |
| **Border** | `#E5E5E5` | Card/input borders |
| **Success** | `#16A34A` | Active states, positive indicators |
| **Warning** | `#F59E0B` | Renewing, pending states |
| **Error** | `#DC2626` | Failed, overdue states |

### Visual Checklist for Every Screen
Before marking any phase complete, verify:

- [ ] Background is Canvas (#FAFAFA), NOT white
- [ ] Cards use `rounded-2xl` (16px) border-radius with subtle shadow (`shadow-sm`)
- [ ] Primary buttons are 48px height, `rounded-xl` (12px), Casa Navy background
- [ ] Typography: Inter font, bold headings (24px h1, 18px h2), regular body (15px)
- [ ] Spacing uses 4px base unit (4, 8, 12, 16, 24, 32, 48)
- [ ] No pure black (#000) used — use Text Primary (#0A0A0A) instead
- [ ] Touch targets are minimum 44x44px
- [ ] Status pills use rounded-full with coloured backgrounds: Active=green, Renewing=amber, Overdue=red
- [ ] Animations are ≤200ms and use ease-out
- [ ] Screen headers use casa-navy → indigo gradient for emphasis where appropriate

### Bottom Navigation (Tab Bar)
All authenticated screens use a shared bottom tab navigation with exactly 4 tabs:

| Tab | Icon | Label | Route |
|-----|------|-------|-------|
| Home | `Home` (Lucide) | Home | `/(app)/` |
| Chat | `MessageCircle` (Lucide) | Chat | `/(app)/chat` |
| Rent | `DollarSign` (Lucide) | Rent | `/(app)/payments` |
| Tasks | `CheckSquare` (Lucide) | Tasks | `/(app)/tasks` |

- Active tab: Casa Navy icon + label, filled variant
- Inactive tab: Text Tertiary icon, no label or muted label
- Tab bar background: white with top border (#E5E5E5)

### Status Pill Component
Used throughout the app for tenancy status, payment status, inspection status, etc:

```typescript
// packages/ui/src/components/StatusPill.tsx
type StatusVariant = 'active' | 'renewing' | 'ending' | 'overdue' | 'pending' | 'draft';

const STATUS_STYLES: Record<StatusVariant, { bg: string; text: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700' },
  renewing: { bg: 'bg-amber-50', text: 'text-amber-700' },
  ending: { bg: 'bg-orange-50', text: 'text-orange-700' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700' },
  pending: { bg: 'bg-blue-50', text: 'text-blue-700' },
  draft: { bg: 'bg-gray-50', text: 'text-gray-600' },
};
```

### Auto-Managed Section Pattern
For screens showing automated actions (leases, inspections, maintenance), display an "AUTO-MANAGED" badge section:

```
┌─────────────────────────────────────────┐
│  ✓ AUTO-MANAGED                         │
│                                          │
│  ✓ Bond lodged with NSW Fair Trading     │
│  ✓ Renewal notice sent (60 days)         │
│  ✓ NSW compliant templates used          │
└─────────────────────────────────────────┘
```
- Green checkmarks for completed automated actions
- Grey text for pending automated actions
- Only shown for Pro and Hands-Off tiers (Starter sees upgrade prompt instead)

### AI Chat Header
The Casa AI chat interface uses this header pattern:
```
┌─────────────────────────────────────────┐
│  [Casa logo]  Casa AI                    │
│  Always online                           │
└─────────────────────────────────────────┘
```
- Navy gradient background for header
- "Always online" in green with pulsing dot indicator
- Messages in white bubbles (user) and light grey bubbles (AI)
- Suggested prompt pills at bottom of chat (rounded-full, border, navy text)

### Auth Screens Must Include
1. **Login**: Email/password inputs, primary "Sign In" button (Casa Navy), "Forgot password?" link, "Create account" link
2. **Sign Up**: Full name, email, password inputs with validation feedback, tier selection (defaults to Starter)
3. **Forgot Password**: Email input, clear success/error states

### Greeting Pattern
Use personalized greetings on authenticated screens:
```
Hey {firstName} 👋
Let's check on your properties
```

### Empty States
Center content, use subtle Lucide icon, friendly copy, and CTA button when applicable.

### Card Patterns
Two card styles used throughout the app:

1. **Property/Tenancy Card**: White background, rounded-2xl, subtle shadow, left-aligned content, status pill top-right
2. **Action Card**: White background, rounded-xl, centered icon (Lucide outline, 24px) above bold title, optional subtitle

### List Item Pattern
For lists (payments, maintenance, messages):
- Left: Icon or avatar in rounded-lg container
- Center: Title (bold) + subtitle (muted)
- Right: Amount or status pill
- Divider: 1px border-b with mx-4 inset

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`profiles` table, enums)
- [ ] RLS policies verified: user can only SELECT/UPDATE own profile
- [ ] `handle_new_user()` trigger fires on auth.users INSERT (profile auto-created)
- [ ] `update_updated_at()` trigger updates `updated_at` on profile changes
- [ ] `subscription_tier` defaults to `starter` for new users
- [ ] `subscription_status` defaults to `active` for new users
- [ ] Foreign key `profiles.id` references `auth.users(id)` with CASCADE delete

### Feature Verification (Mission-Specific)
- [ ] User can sign up with email/password and full name
- [ ] User can log in with email/password
- [ ] User can log out and is redirected to login screen
- [ ] Forgot password flow sends reset email
- [ ] Auth state persists across app restarts (stay logged in)
- [ ] Unauthenticated users are redirected to login
- [ ] Profile screen displays user's name, email, phone, avatar
- [ ] User can update profile fields (name, phone)
- [ ] Avatar upload works and displays correctly
- [ ] `useAuth` hook returns correct auth state
- [ ] `useProfile` hook returns correct profile data
- [ ] `useFeatureGate` hook correctly gates features by tier
- [ ] `FeatureGate` component shows upgrade prompt for locked features
- [ ] UI components match BRAND-AND-UI.md (Button, Card, Input, Avatar, StatusPill, ScreenContainer)
- [ ] Bottom tab navigation renders with correct icons and labels

### Visual & UX
- [ ] Tested on physical iOS device via Expo Go
- [ ] UI matches BRAND-AND-UI.md design system
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes

### Regression (All Prior Missions)
- [ ] All prior mission critical paths still work (see TESTING-METHODOLOGY.md Section 4)
- [ ] Navigation between all existing screens works
- [ ] Previously created data still loads correctly
- [ ] No new TypeScript errors in existing code

### Auth & Security
- [ ] Authenticated routes redirect unauthenticated users
- [ ] User can only access their own data (RLS verified)
- [ ] Session persists across app restarts
- [ ] No sensitive data in logs or error messages
- [ ] Password requirements enforced (minimum length, complexity)
- [ ] Auth tokens stored securely (not in plain text storage)
- [ ] Failed login attempts do not leak user existence info
- [ ] Signup validates email format and AU phone format (+61 or 04xx)
