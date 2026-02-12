# Mission 11 Handover: Property Inspections & Condition Reports

> **Status**: Mission 10 (Tradesperson Network) is COMPLETE. All tests pass. Begin Mission 11.
> **Next Migration Number**: `20240101000028`
> **Date**: 30 January 2026

---

## MANDATORY: Read These Files First

Read these in order before writing any code:

1. `/CLAUDE.md` — Project rules, heuristics, technical stack, patterns
2. `/BRAND-AND-UI.md` — Design system, colours, typography, component specs
3. `/SUPABASE-SPEC.md` — Database connection details, CLI commands, migration workflow
4. `/specs/ralph-missions/MISSION-11-inspections.md` — Full Mission 11 spec (the mission you are implementing)
5. `/specs/TESTING-METHODOLOGY.md` — Testing framework, checklists

---

## Project Overview

Casa is an AI-powered property management platform for Australian property owners. React Native (Expo SDK 54) mobile app backed by Supabase. Monorepo with pnpm workspaces + Turborepo.

---

## Credentials & IDs

> **IMPORTANT**: All credentials are stored in `.env.local` files and Supabase secrets. Never commit secrets to git.
> See `apps/owner/.env.local` for Supabase keys and `supabase secrets list` for Edge Function secrets.

| Key | Value |
|-----|-------|
| Supabase Project Ref | `woxlvhzgannzhajtjnke` |
| API URL | `https://woxlvhzgannzhajtjnke.supabase.co` |
| Owner User ID (Robbie) | `e323a5a6-4f1f-4cf5-9707-6812a6c9d23a` |
| Tenant User ID (Robson) | `dc209741-6218-49b6-8509-10d65a4cebc5` |
| Test Property ID | `ce0622c8-d803-4808-90f8-61cef129109a` (4 Maloja Avenue, Caloundra) |
| Test Tenancy ID | `0912be54-0ac6-43e3-ac3f-af120f5dedd6` |

---

## Current State of the Codebase

### Completed Missions (1-10)
All missions 1-10 are fully implemented and tested:

| Mission | Feature | Status |
|---------|---------|--------|
| 1 | Project Setup & Monorepo | Complete |
| 2 | Auth & Profiles | Complete |
| 3 | Properties | Complete |
| 4 | Listings | Complete |
| 5 | Applications | Complete |
| 6 | Tenancies | Complete |
| 7 | Payments | Complete |
| 8 | Arrears Management | Complete |
| 9 | Maintenance Requests | Complete |
| 10 | Tradesperson Network | Complete |
| Security | Comprehensive audit + fixes | Complete |

### Migration Count
27 migrations applied (000001 through 000027). **Your next migration should be `20240101000028_inspections.sql`**.

### Key Existing Tables You'll Reference
- `properties` — property records (owner_id FK)
- `tenancies` — lease agreements (property_id FK, status enum)
- `tenancy_tenants` — M:M join between tenancies and tenants (tenant_id, tenancy_id)
- `profiles` — user accounts (id, role, subscription_tier)
- `maintenance_requests` — tenant-submitted maintenance issues

---

## Critical Technical Patterns (MUST FOLLOW)

### 1. Supabase Type Casting
Tables NOT in the auto-generated Supabase types need special casting. This applies to ALL new tables you create:

```typescript
// Query builder cast (REQUIRED for .insert(), .update(), .select() on new tables):
const { data, error } = await (supabase
  .from('inspections') as ReturnType<typeof supabase.from>)
  .select('*')
  .eq('property_id', propertyId);

// Result cast (REQUIRED when assigning to typed variables):
const inspections = (data as unknown as InspectionRow[]) || [];
```

**Every `.from()` call on a table not in the generated types MUST use this pattern.** Without it, TypeScript will error with `never` type on insert/update params.

### 2. SECURITY DEFINER Functions
All trigger functions and cross-RLS helper functions MUST include:
```sql
CREATE OR REPLACE FUNCTION my_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- REQUIRED for security
AS $$ ... $$;
```

### 3. RLS Policy Pattern
All tables require `auth.uid() IS NOT NULL` — no unauthenticated access. Follow these patterns:

```sql
-- Owner access via property ownership:
CREATE POLICY "Owners can manage inspections"
  ON inspections FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = inspections.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenant access via tenancy:
CREATE POLICY "Tenants can view inspections"
  ON inspections FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM tenancy_tenants tt
      JOIN tenancies t ON tt.tenancy_id = t.id
      WHERE t.id = inspections.tenancy_id
      AND tt.tenant_id = auth.uid()
    )
  );
```

### 4. Hook Architecture Pattern
Follow the three-hook pattern established in Missions 9-10:

- **List hook** (`useInspections`) — fetches list with filters, returns array + summary + loading/error/refreshing
- **Detail hook** (`useInspection`) — fetches single record with enriched related data
- **Mutations hook** (`useInspectionMutations`) — all create/update/delete operations

Each hook follows this structure:
```typescript
export function useInspections(filter?: InspectionsFilter) {
  const { user } = useAuth();
  const [items, setItems] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchItems = useCallback(async (isRefresh = false) => {
    // ... fetch logic with isRefresh controlling loading vs refreshing state
  }, [user, filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const refresh = useCallback(async () => { await fetchItems(true); }, [fetchItems]);

  return { items, loading, error, refreshing, refresh, /* summary */ };
}
```

### 5. Theme Usage
```typescript
import { THEME } from '@casa/config';

// Key values:
THEME.colors.brand        // '#1B1464' (casa navy)
THEME.colors.brandIndigo  // '#4F46E5' (accent)
THEME.colors.canvas        // '#FAFAFA' (page background)
THEME.colors.surface       // '#FFFFFF' (card background)
THEME.radius              // { sm: 8, md: 12, lg: 16, full: 9999 } — OBJECT, not number

// Button component accepts:
variant: 'primary' | 'secondary' | 'text'
```

### 6. Navigation Pattern
```typescript
import { router } from 'expo-router';

// Navigate to screens:
router.push('/(app)/inspections' as any);
router.push({ pathname: '/(app)/inspections/[id]' as any, params: { id: inspectionId } });

// Route params:
const { id } = useLocalSearchParams<{ id: string }>();
```

### 7. Existing Enum Values (DO NOT use values outside these)
```
maintenance_category: plumbing, electrical, appliance, hvac, structural, pest, locks_security, garden_outdoor, cleaning, other
maintenance_urgency: emergency, urgent, routine
```

### 8. UUID Generation
Use `gen_random_uuid()` in migrations (NOT `uuid_generate_v4()`). The spec uses `uuid_generate_v4()` but the codebase consistently uses `gen_random_uuid()`.

### 9. Updated At Trigger
The trigger function is called `update_updated_at()` (NOT `update_updated_at_column()`):
```sql
CREATE TRIGGER inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

## What Already Exists for Mission 11

### Gateway Hook (Placeholder)
`packages/api/src/hooks/gateways/useInspectionsGateway.ts` — Contains navigation stubs and placeholder actions. You will create REAL hooks alongside this (don't modify the gateway — create new hooks).

### Gateway Types
`packages/api/src/types/gateways.ts` — Contains TypeScript interfaces for:
- `Inspection`, `InspectionRoom`, `InspectionItem`, `InspectionImage`
- `InspectionType`, `InspectionStatus`, `ConditionRating`

You will create **database row types** in `packages/api/src/types/database.ts` (like `InspectionRow`, `InspectionInsert`, etc.) that map to the actual DB schema. The gateway types are for the gateway pattern; your hooks use the database types.

### Exports Already Registered
In `packages/api/src/index.ts`, the gateway exports are already present (line 378-380). You will ADD new exports for the real hooks below these.

### App Layout
`apps/owner/app/(app)/_layout.tsx` — You need to add `<Stack.Screen name="inspections" />` to the Stack (currently has trades, work-orders, maintenance, etc.).

---

## Mission 11 Implementation Sequence

### Step 1: Database Migration (`20240101000028_inspections.sql`)

Create the migration with:
- Enums: `inspection_type`, `inspection_status`, `condition_rating`
- Tables: `inspections`, `inspection_templates`, `inspection_template_rooms`, `inspection_rooms`, `inspection_items`, `inspection_images`, `inspection_voice_notes`
- AI comparison tables: `inspection_ai_comparisons`, `inspection_ai_issues`
- Property columns: `inspection_interval_months`, `last_inspection_at`, `next_inspection_due`
- Default template data (Standard Residential with 8 rooms)
- All indexes
- All RLS policies (owner CRUD, tenant view/acknowledge)
- Storage bucket: `inspection-images`
- Triggers: `update_updated_at()`, `update_next_inspection()`

**Important corrections to the spec's SQL:**
- Use `gen_random_uuid()` instead of `uuid_generate_v4()`
- Add `auth.uid() IS NOT NULL` to ALL RLS USING clauses
- Add `SET search_path = public` to ALL SECURITY DEFINER functions
- The spec has incomplete RLS for items/images (says "Similar for items and images...") — you must write full policies for `inspection_items`, `inspection_images`, `inspection_voice_notes`
- Add `update_updated_at()` trigger to inspections table

### Step 2: Database Types
Add to `packages/api/src/types/database.ts`:
- `InspectionRow`, `InspectionInsert`, `InspectionUpdate`
- `InspectionRoomRow`, `InspectionRoomInsert`
- `InspectionItemRow`, `InspectionItemInsert`, `InspectionItemUpdate`
- `InspectionImageRow`, `InspectionImageInsert`
- `InspectionVoiceNoteRow`
- `InspectionTemplateRow`, `InspectionTemplateRoomRow`
- `InspectionAIComparisonRow`, `InspectionAIIssueRow`
- Enriched types: `InspectionWithDetails` (with rooms, items, images, property, tenancy)
- Add new enums to the Database Enums interface

### Step 3: API Hooks
Create these hooks in `packages/api/src/hooks/`:

| Hook | Purpose |
|------|---------|
| `useInspections.ts` | List inspections with filters (property, type, status) |
| `useInspection.ts` | Single inspection detail with rooms/items/images |
| `useInspectionTemplates.ts` | List templates (system defaults + owner custom) |
| `useInspectionMutations.ts` | Schedule, start, complete, acknowledge, dispute, room/item CRUD, image upload |

### Step 4: Owner App Screens
Create in `apps/owner/app/(app)/inspections/`:

| File | Purpose |
|------|---------|
| `_layout.tsx` | Stack navigator |
| `index.tsx` | All inspections list (upcoming, past, filters) |
| `schedule.tsx` | Schedule new inspection (type, date, property, template) |
| `templates.tsx` | Manage templates |
| `[id]/index.tsx` | Inspection detail/report view |
| `[id]/conduct.tsx` | Conduct inspection (room-by-room workflow) |
| `[id]/rooms/[roomId].tsx` | Single room inspection (items checklist, photos, condition ratings) |

### Step 5: Tenant App Screens
Create in `apps/tenant/app/(app)/inspections/`:

| File | Purpose |
|------|---------|
| `_layout.tsx` | Stack navigator |
| `index.tsx` | My inspections list |
| `[id]/index.tsx` | View inspection report |
| `[id]/acknowledge.tsx` | Acknowledge/sign/dispute |

### Step 6: Shared UI Components
Create in `packages/ui/src/components/`:

| Component | Purpose |
|-----------|---------|
| `ConditionBadge.tsx` | Colour-coded badge for condition ratings |

### Step 7: Integration Points
- Add `<Stack.Screen name="inspections" />` to `apps/owner/app/(app)/_layout.tsx`
- Add "Inspections" quick action to owner home screen `apps/owner/app/(app)/(tabs)/index.tsx`
- Add inspection scheduling from property detail screen
- Export all new hooks and types from `packages/api/src/index.ts`
- Export new UI components from `packages/ui/src/index.ts`

### Step 8: Verification
1. `pnpm typecheck` — zero errors across all 7 packages
2. Push migration to remote Supabase and verify it applies
3. Comprehensive E2E functional testing (see below)
4. Full regression testing of Missions 1-10

---

## Applying Migrations to Remote Supabase

Use psql directly (the Supabase CLI is not linked):

```bash
# Read the migration file and pipe to psql
PGPASSWORD="<service_role_password>" psql \
  -h db.woxlvhzgannzhajtjnke.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f supabase/migrations/20240101000028_inspections.sql
```

Or use the Supabase dashboard SQL editor.

To push via the Supabase management API, use:
```bash
curl -X POST 'https://woxlvhzgannzhajtjnke.supabase.co/rest/v1/rpc/<function>' \
  -H "apikey: <service_role_key>" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json"
```

For testing, authenticate as owner/tenant:
```bash
# Get auth token
curl -X POST 'https://woxlvhzgannzhajtjnke.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"<your_email>","password":"<your_password>"}'
```

---

## Testing Requirements (CRITICAL)

The user has explicitly demanded comprehensive functional E2E testing after implementation. This is NOT optional.

### What to Test

**Phase 1: Database & RLS (20+ tests)**
- Create inspection as owner for their property
- Owner can CRUD all inspection-related records
- Tenant can VIEW inspections for their tenancy
- Tenant can UPDATE for acknowledgment (but not other fields)
- Tenant CANNOT create inspections
- Tenant CANNOT see inspections for other properties
- Cross-table RLS: rooms/items/images follow inspection permissions
- Default templates load correctly
- Template rooms have correct default items

**Phase 2: Inspection Lifecycle (15+ tests)**
- Schedule inspection (routine, entry, exit)
- Start inspection (status → in_progress)
- Add rooms from template
- Rate items with condition ratings
- Complete inspection (status → completed)
- Verify `update_next_inspection()` trigger fires
- Cancel inspection
- Tenant acknowledgment flow
- Tenant dispute flow

**Phase 3: Entry/Exit Comparison (10+ tests)**
- Create entry inspection, complete it
- Create exit inspection linked to entry
- Items show entry_condition from linked inspection
- condition_changed flag works correctly
- Compare inspections end-to-end

**Phase 4: Edge Cases**
- Empty string validation on required text fields
- Duplicate prevention
- FK cascade behavior
- Invalid status transitions

**Phase 5: Regression (22+ tests)**
Run the full regression suite for Missions 1-10:
- Auth & profiles
- Properties CRUD
- Listings
- Applications
- Tenancies & connection codes
- Rent collection & payments
- Arrears management
- Maintenance requests
- Tradesperson network (trades, work orders, reviews)
- Tenant review requests

### How to Test
Use `curl` commands against the Supabase REST API with auth tokens. Test as both owner and tenant. Verify RLS by attempting unauthorized operations and confirming they fail.

---

## Key Files Reference

### Core Configuration
- `/CLAUDE.md` — Agent rules, heuristics
- `/BRAND-AND-UI.md` — Design system
- `/SUPABASE-SPEC.md` — DB connection details
- `/specs/ralph-missions/MISSION-11-inspections.md` — Full spec

### Database
- `supabase/migrations/` — All 27 existing migrations
- `packages/api/src/types/database.ts` — All database types
- `packages/api/src/types/gateways.ts` — Gateway types (includes inspection interfaces)

### API Layer
- `packages/api/src/hooks/` — All 51 hooks
- `packages/api/src/index.ts` — Central export file
- `packages/api/src/client.ts` — Supabase client initialization

### Reference Hooks (Study These Patterns)
- `packages/api/src/hooks/useMaintenance.ts` — List hook pattern
- `packages/api/src/hooks/useMaintenanceRequest.ts` — Detail hook pattern
- `packages/api/src/hooks/useMaintenanceMutations.ts` — Mutations hook pattern
- `packages/api/src/hooks/useWorkOrder.ts` — Detail with parallel enrichment
- `packages/api/src/hooks/useTradeMutations.ts` — Complex mutations with type casting
- `packages/api/src/hooks/useReviewRequests.ts` — Simple tenant-facing hook

### Reference Screens (Study These Patterns)
- `apps/owner/app/(app)/maintenance/` — List + detail + mutations screens
- `apps/owner/app/(app)/trades/` — Network dashboard, search, add, detail
- `apps/owner/app/(app)/work-orders/` — Dashboard, create, detail, review

### App Integration Points
- `apps/owner/app/(app)/_layout.tsx` — Route registration (add inspections)
- `apps/owner/app/(app)/(tabs)/index.tsx` — Home screen quick actions (add inspections)
- `packages/ui/src/index.ts` — UI component exports
- `packages/ui/src/components/StarRating.tsx` — Reference for new UI components

---

## Common Gotchas & Lessons Learned

1. **`update_updated_at()` not `update_updated_at_column()`** — The function name was previously confused in a migration and had to be fixed.

2. **RLS recursion** — If an RLS policy on table A joins to table B which also has RLS, PostgreSQL may hit infinite recursion. Use SECURITY DEFINER helper functions if needed. See migration 000017 and 000023 for examples.

3. **Empty strings pass NOT NULL** — PostgreSQL `NOT NULL` allows `''`. Add CHECK constraints: `CHECK (trim(column_name) <> '')` on required text fields.

4. **CASCADE deletes are dangerous** — Use `ON DELETE RESTRICT` for important data relationships (like trades to work orders). Use `CASCADE` only for true parent-child relationships where the child has no meaning without the parent (like inspection_rooms without an inspection).

5. **Storage buckets** — Create with: `INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-images', 'inspection-images', false);` and add appropriate storage policies.

6. **React Native SVG** — The project uses `react-native-svg` for icons. Import `Svg, { Path, Circle, Rect }` from `react-native-svg`.

7. **The spec's SQL has uuid_generate_v4()** — Change ALL occurrences to `gen_random_uuid()` to match the rest of the codebase.

8. **Typecheck command** — Run `pnpm typecheck` from the project root. All 7 packages must pass with zero errors.

9. **Do NOT filter on non-existent enum values** — For example, `maintenance_category` does NOT include `pest_control`, `landscaping`, `heating_cooling`, `painting`, `roofing`, or `general`.

10. **Tenant app route structure** — The tenant app mirrors the owner app at `apps/tenant/app/(app)/`. Check the existing tenant maintenance screens at `apps/tenant/app/(app)/maintenance/` for the pattern.

---

## Scope Decisions for Mission 11

The Mission 11 spec is extensive. Here's a practical prioritization:

### P1 (Must Have)
- Database schema with all tables, RLS, indexes, triggers
- Inspection scheduling (routine, entry, exit types)
- Room-by-room inspection conduct flow with condition ratings
- Photo capture per room/item
- Entry condition report
- Exit condition report with comparison to entry
- Tenant view + acknowledgment
- Default templates
- PDF report generation (or HTML report that can be shared)
- Typecheck passing, comprehensive E2E tests

### P2 (Important but may need external services)
- AI photo comparison (requires Claude Vision API or OpenAI Vision)
- Voice notes + transcription (requires Whisper API)
- Digital signature capture
- Offline support
- State-specific inspection intervals and reminders

### P3 (Nice to have)
- Custom templates per property
- Image annotations
- Bond deduction calculator
- Comparison PDF with side-by-side photos

Focus on P1 first. The spec is a guide — implement what's achievable with real, working functionality. Don't stub things out.

---

## Workspace Commands

```bash
# Typecheck all packages
pnpm typecheck

# Run tests
pnpm test

# Start owner app
cd apps/owner && npx expo start --port 8081 --tunnel --clear

# Start tenant app
cd apps/tenant && npx expo start --port 8082 --tunnel --clear

# Start both (kill existing first)
killall -9 node ngrok 2>/dev/null; sleep 2
cd /Users/robbiespooner/Desktop/propbot/apps/owner && npx expo start --port 8081 --tunnel --clear &
sleep 5
cd /Users/robbiespooner/Desktop/propbot/apps/tenant && npx expo start --port 8082 --tunnel --clear &
```

---

## Summary

You are implementing Mission 11: Property Inspections. The codebase is healthy with Missions 1-10 complete and all tests passing. Follow the patterns established in Mission 10 (trades/work orders) and Mission 9 (maintenance). The gateway hook and types already exist as placeholders. Create real hooks, screens, and a database migration. Test comprehensively — not just typecheck but full functional E2E tests with curl against the live Supabase instance. Run regression tests for all prior missions.

Good luck.
