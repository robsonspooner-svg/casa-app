# Handover: Mission 03 — Properties CRUD

## Current State

Missions 01 and 02 are complete and working on a real device. The app is running via Expo Go over tunnel.

### What's Working
- Monorepo with pnpm workspaces + Turborepo
- Expo SDK 54, Expo Router (file-based routing)
- Supabase Auth: signup, login, logout, session persistence via AsyncStorage
- Profiles table with `handle_new_user()` trigger (includes `SET search_path = public`)
- Subscription tier/status columns on profiles (starter/pro/hands_off enums)
- Feature gating: `useFeatureGate` hook + `FeatureGate` component + `UpgradePrompt`
- Home screen with navy gradient header, personalised greeting, revenue card, quick actions grid
- Tab navigation: Home, Chat, Rent, Tasks (SVG icons, no emojis)
- UI matches BRAND-AND-UI.md design system
- Casa logo assets in `apps/owner/assets/`

### Supabase Details
- Project ref: `woxlvhzgannzhajtjnke`
- API URL: `https://woxlvhzgannzhajtjnke.supabase.co`
- Region: Sydney (ap-southeast-2)
- Credentials in `apps/owner/.env.local`
- Database password: stored in .env.local (connect via psql if needed for migrations)
- Migrations applied: `20240101000001_profiles.sql`, `20240101000005_subscription_tiers.sql`

### Package Structure
```
apps/owner/          — Expo app (SDK 54, Expo Router)
packages/api/        — Supabase client, hooks (useAuth, useProfile, useFeatureGate), types
packages/config/     — THEME object (Casa navy colours, spacing, typography)
packages/ui/         — Shared components (Button, Card)
```

### Key Files Modified from Original Mission Specs
- `packages/api/src/client.ts` — Uses AsyncStorage, runtime init pattern (not env vars at import time)
- `apps/owner/app/_layout.tsx` — Calls `initializeSupabase()` at module level
- `apps/owner/app/(app)/(tabs)/_layout.tsx` — SVG icons via react-native-svg
- `apps/owner/app/(app)/(tabs)/index.tsx` — Full redesign matching marketing mockup

### Dependencies Already Installed
- `react-native-svg` (tab icons)
- `@react-native-async-storage/async-storage` (session persistence)
- `react-native-safe-area-context` (safe area insets)
- `@supabase/supabase-js` (database/auth)

---

## Mission 03 Scope

Read the full spec: `/specs/ralph-missions/MISSION-03-properties-crud.md`

### Summary
1. **Properties table** — address, type, bedrooms/bathrooms, rent, status, soft delete
2. **Property images table** — storage paths, primary flag, display order
3. **Properties CRUD UI** — list, add (multi-step wizard), edit, view details, delete
4. **Agent-core package** — types, tool catalog, resilience configs (data infrastructure only, no visible AI)
5. **Agent database tables** — 9 tables + pgvector extension

### Key Decisions Already Made
- Soft delete pattern (deleted_at column, not hard delete)
- Image compression client-side before upload (max 1MB)
- Google Places API for address autocomplete
- Agent tables deployed now but no agent UI until Mission 14
- Package name: `@casa/` prefix (not `@propbot/` — was renamed)

---

## Important Notes

1. The mission spec references `@propbot/` package names — the project was renamed to `@casa/`. Use `@casa/config`, `@casa/api`, `@casa/ui` everywhere.
2. The Supabase client uses a runtime init pattern (not direct env var access). See `packages/api/src/client.ts`.
3. Tab structure is Home/Chat/Rent/Tasks (not the Properties/Messages/Settings from Mission 01 spec).
4. The home screen's "Quick Actions" grid already has a placeholder for navigating to properties — wire this up.
5. All UI must match BRAND-AND-UI.md: navy brand colour (#1B1464), canvas background (#FAFAFA), 16px card radius, 48px button height, Inter font.

---

## How to Run

```bash
cd /Users/robbiespooner/Desktop/propbot
pnpm install
cd apps/owner
npx expo start --tunnel --clear
```

Scan the QR code with Expo Go on iOS device.

---

## Testing

After implementation, complete the Mission-Complete Testing Checklist at the bottom of MISSION-03-properties-crud.md. Run:
```bash
pnpm typecheck && pnpm test
```
Then verify all features on a real device via Expo Go.
