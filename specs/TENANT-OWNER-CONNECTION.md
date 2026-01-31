# Tenant-Owner Connection System

This document describes the multiple methods available for connecting tenant accounts with owner accounts in the Casa platform.

## Connection Methods Overview

| Method | Use Case | Implementation Status |
|--------|----------|----------------------|
| **Invite Code** | Owner generates code, tenant enters it | Ready |
| **Application Flow** | Tenant applies to listing, owner approves → creates tenancy | Ready |
| **AI Matching** | Tenants register availability, AI suggests matches to owners | Gateway Ready |
| **Direct Link** | QR code / deep link with embedded connection data | Planned |

---

## 1. Invite Code System

### How It Works

1. **Owner generates code** via the owner app (Settings → Connection Codes or from a specific property/tenancy)
2. **Code is shared** with tenant (text, email, QR code, etc.)
3. **Tenant enters code** in tenant app (Settings → Connect to Property or during onboarding)
4. **System validates** the code and links the tenant to the property/tenancy

### Database Schema

```sql
-- Connection codes table
CREATE TABLE connection_codes (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  tenancy_id UUID REFERENCES tenancies(id),
  code TEXT NOT NULL UNIQUE,  -- 6 character alphanumeric
  connection_type TEXT NOT NULL,  -- 'tenancy', 'application', 'property'
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  label TEXT,
  created_at TIMESTAMPTZ
);
```

### API Hooks

**Owner Side:**
```typescript
import { useConnectionCodes } from '@casa/api';

function OwnerConnectionScreen() {
  const { codes, createCode, revokeCode } = useConnectionCodes();

  const handleCreateCode = async () => {
    const code = await createCode({
      tenancyId: 'tenancy-uuid',
      connectionType: 'tenancy',
      maxUses: 1,
      expiresInDays: 7,
      label: 'For John Smith',
    });
    // Share code.code with tenant
  };
}
```

**Tenant Side:**
```typescript
import { useConnection } from '@casa/api';

function TenantConnectScreen() {
  const { useCode, connectToTenancy, connecting, error } = useConnection();

  const handleConnect = async (code: string) => {
    // Step 1: Validate the code
    const result = await useCode(code);

    if (result.success && result.tenancyId) {
      // Step 2: Connect to the tenancy
      await connectToTenancy(result.tenancyId, code);
    }
  };
}
```

---

## 2. Application Flow (Existing)

This is the standard flow already implemented:

1. Tenant browses public listings
2. Tenant submits application to a listing
3. Owner reviews application
4. Owner approves and clicks "Create Tenancy"
5. System creates tenancy and links tenant automatically
6. Rent schedule is generated automatically

**Key Files:**
- `apps/tenant/app/(app)/listings/[id]/apply.tsx` - Application form
- `apps/owner/app/(app)/applications/[id].tsx` - Review application
- `apps/owner/app/(app)/tenancies/create.tsx` - Create tenancy from application
- `packages/api/src/hooks/useTenancyMutations.ts` - Creates tenancy + tenant link + rent schedule

---

## 3. AI Matching System

### How It Works

1. **Tenant registers availability**: Preferred suburbs, budget, bedrooms, move-in date, etc.
2. **AI agent periodically scans** vacant properties and available tenants
3. **AI generates match suggestions** with compatibility scores
4. **Owner reviews suggestions** and can:
   - View tenant profile
   - Invite tenant (sends connection code)
   - Dismiss suggestion
5. **Tenant receives invitation** and can apply to the property

### Database Schema

```sql
-- Tenant availability for AI matching
CREATE TABLE tenant_availability (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  preferred_suburbs TEXT[],
  min_bedrooms INTEGER DEFAULT 1,
  max_rent_weekly DECIMAL(10,2),
  move_in_date DATE,
  has_pets BOOLEAN DEFAULT FALSE,
  employment_status TEXT,
  rental_history_years INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  matched_at TIMESTAMPTZ
);

-- AI-generated match suggestions
CREATE TABLE match_suggestions (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  match_score DECIMAL(3,2),  -- 0.00-1.00
  match_reasons JSONB,  -- {"location": 0.9, "budget": 0.85, ...}
  status TEXT DEFAULT 'pending',  -- pending, viewed, invited, applied, rejected
  expires_at TIMESTAMPTZ
);
```

### API Hooks

**Tenant Side:**
```typescript
import { useTenantAvailability } from '@casa/api';

function TenantAvailabilityScreen() {
  const { availability, createAvailability, updateAvailability, deactivate } = useTenantAvailability();

  const handleSetup = async () => {
    await createAvailability({
      preferredSuburbs: ['Bondi', 'Coogee', 'Bronte'],
      maxRentWeekly: 600,
      minBedrooms: 2,
      moveInDate: '2024-03-01',
      hasPets: true,
      petDetails: '1 small dog',
    });
  };
}
```

**Owner Side:**
```typescript
import { useMatchSuggestions } from '@casa/api';

function OwnerMatchesScreen() {
  const { suggestions, markViewed, inviteTenant, rejectSuggestion } = useMatchSuggestions();

  const handleInvite = async (suggestionId: string) => {
    await inviteTenant(suggestionId);
    // Creates connection code and sends to tenant
  };
}
```

---

## Testing the Connection System

### Prerequisites

1. Two separate devices or simulators (one for owner app, one for tenant app)
2. Two different user accounts (one owner, one tenant)
3. Database with migration applied: `20240101000010_connection_codes.sql`

### Test Scenario A: Invite Code Flow

**Setup:**
1. Owner has a property with an active tenancy
2. Tenant account exists but is not connected to any property

**Steps:**

1. **Owner App:**
   ```
   Settings → Connection Codes → Create Code
   Select: Property/Tenancy
   Set: Max uses = 1, Expires in 7 days
   → Code generated (e.g., "ABC123")
   Share code with tenant
   ```

2. **Tenant App:**
   ```
   Settings → Connect to Property → Enter Code
   Input: "ABC123"
   → "Connected successfully!"
   Rent tab now shows schedule
   ```

3. **Verify:**
   - Tenant appears in tenancy_tenants table
   - Tenant can see rent schedule
   - Owner can see tenant in tenancy details
   - Connection attempt logged in connection_attempts table

### Test Scenario B: Application → Tenancy Flow

**Setup:**
1. Owner has a property with active listing
2. Tenant account exists

**Steps:**

1. **Tenant App:**
   ```
   Browse Listings → Select property → Apply
   Fill in application form → Submit
   ```

2. **Owner App:**
   ```
   Applications → View new application
   Review details → Approve → Create Tenancy
   Fill in lease dates → Create
   ```

3. **Verify:**
   - Tenancy created with tenant linked
   - Rent schedule generated automatically
   - Tenant's Rent tab shows upcoming payments
   - Owner's Payments tab shows expected payments

### Test Scenario C: AI Matching Flow

**Setup:**
1. Owner has vacant property
2. Multiple tenants have active availability profiles

**Steps:**

1. **Tenant App (multiple tenants):**
   ```
   Settings → Find a Home → Setup Availability
   Enter: Suburbs, Budget, Bedrooms, Move-in date
   → Availability activated
   ```

2. **AI Agent (Background):**
   ```
   - Scans vacant properties
   - Matches against available tenants
   - Generates match_suggestions records
   ```

3. **Owner App:**
   ```
   Matches → View suggestions
   See: Tenant profiles with match scores
   → Invite best match
   ```

4. **Tenant App:**
   ```
   Receives invitation notification
   → Apply to property
   ```

---

## API Reference

### useConnectionCodes (Owner)

| Method | Description |
|--------|-------------|
| `codes` | List of owner's connection codes |
| `createCode(input)` | Create new connection code |
| `revokeCode(id)` | Deactivate a code |
| `refreshCodes()` | Refresh codes list |

### useConnection (Tenant)

| Method | Description |
|--------|-------------|
| `useCode(code)` | Validate a connection code |
| `connectToTenancy(id, code)` | Connect to a tenancy |
| `connecting` | Loading state |
| `error` | Error message |

### useTenantAvailability (Tenant)

| Method | Description |
|--------|-------------|
| `availability` | Current availability profile |
| `createAvailability(input)` | Create availability profile |
| `updateAvailability(updates)` | Update profile |
| `deactivate()` | Stop looking for properties |
| `reactivate()` | Resume looking |

### useMatchSuggestions (Owner)

| Method | Description |
|--------|-------------|
| `suggestions` | List of AI match suggestions |
| `markViewed(id)` | Mark suggestion as viewed |
| `inviteTenant(id)` | Send invitation to tenant |
| `rejectSuggestion(id)` | Dismiss suggestion |

---

## Migration Checklist

To enable this feature, apply the migration:

```bash
# Via Supabase CLI
supabase db push

# Or via direct SQL
psql $DATABASE_URL < supabase/migrations/20240101000010_connection_codes.sql
```

Tables created:
- `connection_codes`
- `connection_attempts`
- `tenant_availability`
- `match_suggestions`

---

## Future Enhancements

1. **QR Code Generation**: Generate QR codes for connection codes
2. **Deep Links**: `casa://connect?code=ABC123` for one-tap connection
3. **Bulk Invites**: Invite multiple tenants at once
4. **Match Score Tuning**: Allow owners to adjust matching weights
5. **Automated Matching**: AI agent automatically invites best matches
