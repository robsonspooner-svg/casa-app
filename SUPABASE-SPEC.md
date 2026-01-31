# Stead Supabase & Database Specification

> **Purpose**: Reference document for any Claude agent (or developer) working on the Stead database, migrations, storage, and Supabase infrastructure.

---

## 1. Project Details

| Key | Value |
|-----|-------|
| **Project Ref** | `woxlvhzgannzhajtjnke` |
| **Region** | Oceania (Sydney) - `ap-southeast-2` |
| **Dashboard** | https://supabase.com/dashboard/project/woxlvhzgannzhajtjnke |
| **API URL** | `https://woxlvhzgannzhajtjnke.supabase.co` |
| **CLI Version** | Available via `npx supabase` (v2.72+) |
| **Auth Method** | `SUPABASE_ACCESS_TOKEN` env var (Personal Access Token) |

---

## 2. CLI Commands Reference

```bash
# Always prefix with token (or export SUPABASE_ACCESS_TOKEN)
SUPABASE_ACCESS_TOKEN=<token> npx supabase <command> --workdir /path/to/propbot

# Common commands:
npx supabase projects list          # Verify token works
npx supabase migration list         # Show migration status (local vs remote)
npx supabase db push                # Apply pending migrations to remote
npx supabase db push --dry-run      # Preview what would be applied
npx supabase db diff                # Generate migration from remote schema changes
npx supabase gen types typescript --project-id woxlvhzgannzhajtjnke > packages/api/src/types/supabase.ts
```

---

## 3. Migration Rules

### Naming Convention
```
supabase/migrations/<timestamp>_<description>.sql
```
- Timestamp format: `YYYYMMDDHHMMSS` (e.g., `20240101000001`)
- Description: snake_case, descriptive (e.g., `create_properties`, `add_listings_table`)
- Files that don't match `<timestamp>_name.sql` pattern are **skipped**

### Writing Migrations

**DO:**
- Use `gen_random_uuid()` for UUID defaults (NOT `uuid_generate_v4()`)
- Use `TIMESTAMPTZ` for all timestamp columns (NOT `TIMESTAMP`)
- Use `ON CONFLICT DO NOTHING` for bucket/seed inserts (idempotent)
- Include `IF NOT EXISTS` for extensions and indexes where possible
- Always enable RLS on new tables: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- Create RLS policies immediately after table creation
- Add indexes for foreign keys and commonly queried columns
- Use `DROP TRIGGER IF EXISTS` before creating triggers (idempotent)

**DON'T:**
- Don't use `uuid_generate_v4()` — it requires the uuid-ossp extension explicitly
- Don't use `CREATE OR REPLACE` for tables (use IF NOT EXISTS)
- Don't put storage bucket creation in commented-out SQL — use real SQL with `ON CONFLICT`
- Don't create migrations with non-standard naming (no `combined_migration.sql`)

### UUID Generation
```sql
-- CORRECT: Built into PostgreSQL 13+
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- INCORRECT: Requires explicit extension
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

### Timestamp Pattern
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Standard updated_at Trigger
The `update_updated_at()` function is created in the first migration. Reuse it:
```sql
CREATE TRIGGER <table>_updated_at
  BEFORE UPDATE ON <table>
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 4. Row Level Security (RLS) Patterns

### Owner-Based Access
```sql
-- Owner can CRUD their own records
CREATE POLICY "Owners can manage own <table>"
  ON <table> FOR ALL
  USING (owner_id = auth.uid());
```

### Tenant Access via Tenancy
```sql
-- Tenants can view records for properties they rent
CREATE POLICY "Tenants can view their <table>"
  ON <table> FOR SELECT
  USING (
    property_id IN (
      SELECT t.property_id FROM tenancies t
      JOIN tenancy_tenants tt ON t.id = tt.tenancy_id
      WHERE tt.tenant_id = auth.uid()
      AND t.status = 'active'
    )
  );
```

### Nested Resource Access
```sql
-- Access to child resources based on parent ownership
CREATE POLICY "Owners can manage <child>"
  ON <child> FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM <parent>
      WHERE <parent>.id = <child>.<parent>_id
      AND <parent>.owner_id = auth.uid()
    )
  );
```

### Public Read Access
```sql
-- Anyone can read active/published records
CREATE POLICY "Anyone can view active <table>"
  ON <table> FOR SELECT
  USING (status = 'active');
```

### Admin Access
```sql
CREATE POLICY "Admins can view all <table>"
  ON <table> FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 5. Storage Buckets

### Current Buckets

| Bucket | Public | Purpose | Folder Pattern |
|--------|--------|---------|----------------|
| `avatars` | Yes | Profile pictures | `{user_id}/avatar-{timestamp}.{ext}` |
| `property-images` | Yes | Property photos | `{user_id}/{property_id}/{filename}` |

### Future Buckets (per mission specs)

| Bucket | Public | Mission | Purpose |
|--------|--------|---------|---------|
| `application-documents` | No | M05 | Tenant application docs (ID, payslips) |
| `tenancy-documents` | No | M06 | Leases, condition reports, notices |
| `maintenance-images` | Yes | M09 | Before/after maintenance photos |
| `trade-portfolio` | Yes | M10 | Tradesperson portfolio images |
| `inspection-images` | No | M11 | Inspection photos |
| `inspection-voice` | No | M11 | Voice note recordings |
| `message-attachments` | No | M12 | Chat file attachments |
| `generated-reports` | No | M13 | PDF/CSV financial reports |
| `documents` | No | M16 | User document storage |
| `document-thumbnails` | No | M16 | Auto-generated thumbnails |
| `shared-documents` | Yes | M16 | Token-authenticated shared docs |

### Storage RLS Pattern
```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('<bucket-id>', '<bucket-name>', <true|false>)
ON CONFLICT (id) DO NOTHING;

-- Public read (for public buckets)
CREATE POLICY "<Bucket> publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = '<bucket-id>');

-- User-scoped write (folder = user_id)
CREATE POLICY "Users can upload to <bucket>"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = '<bucket-id>'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Same pattern for UPDATE and DELETE
```

---

## 6. Database Schema Conventions

### Enums
Define as PostgreSQL enums. Current enums:
- `user_role`: `'owner' | 'tenant' | 'admin'`
- `property_type`: `'house' | 'apartment' | 'townhouse' | 'unit' | 'studio' | 'other'`
- `payment_frequency`: `'weekly' | 'fortnightly' | 'monthly'`

Future enums should follow the same pattern:
```sql
CREATE TYPE <enum_name> AS ENUM ('value1', 'value2', 'value3');
```

### Status Fields
For simple status workflows, use CHECK constraints instead of enums (easier to extend):
```sql
status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled'))
```

### Soft Deletes
Use `deleted_at TIMESTAMPTZ` column. Index with WHERE clause:
```sql
CREATE INDEX idx_<table>_<field> ON <table>(<field>) WHERE deleted_at IS NULL;
```

### Foreign Keys
Always use `ON DELETE CASCADE` for child records. Use `REFERENCES profiles(id)` for user ownership (not `auth.users(id)` — profiles is the public-facing user table).

### JSONB Columns
Use for:
- Feature arrays: `features JSONB DEFAULT '[]'`
- Preferences: `preferences JSONB DEFAULT '{}'`
- Metadata: `metadata JSONB DEFAULT '{}'`

Do NOT use for:
- Data you need to query/filter by regularly (normalize it)
- Foreign key relationships

---

## 7. TypeScript Types

After schema changes, regenerate types:
```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase gen types typescript \
  --project-id woxlvhzgannzhajtjnke \
  > packages/api/src/types/supabase.ts
```

The `packages/api/src/types/database.ts` file contains manually maintained types that match the schema. Keep these in sync with migrations.

---

## 8. Edge Functions (Future)

Edge functions live in `supabase/functions/<function-name>/index.ts`. Deploy with:
```bash
npx supabase functions deploy <function-name>
```

Key functions planned:
- Webhooks (Stripe, DocuSign, Twilio, SendGrid)
- Scheduled tasks (arrears processing, compliance checks, report generation)
- Background processing (document OCR, image thumbnails)

---

## 9. Realtime Subscriptions

Used in Mission 12 (Communications). Enable per-table:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

Client-side subscription pattern:
```typescript
const channel = supabase
  .channel('room-messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    // Handle new message
  })
  .subscribe();
```

---

## 10. Environment Variables

### App-Level (Expo)
```env
EXPO_PUBLIC_SUPABASE_URL=https://woxlvhzgannzhajtjnke.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<jwt-anon-key>
```

These go in:
- `apps/owner/.env.local`
- `apps/tenant/.env.local`

### CLI-Level
```env
SUPABASE_ACCESS_TOKEN=<personal-access-token>
```

This should be in the developer's shell environment or a root `.env` file (gitignored).

### Key Types
| Key | Format | Purpose |
|-----|--------|---------|
| Anon Key | JWT (`eyJ...`) | Client-side auth, respects RLS |
| Service Role Key | JWT (`eyJ...`) | Server-side, bypasses RLS - NEVER expose to client |
| Access Token | `sbp_...` | CLI authentication for project management |

---

## 11. Current Schema State

### Applied Migrations (in order):
1. `20240101000001_profiles.sql` - Profiles table, auth trigger, RLS
2. `20240101000002_properties.sql` - Properties + property_images tables, RLS
3. `20240101000003_storage_buckets.sql` - Avatars + property-images buckets, storage RLS

### Tables:
- `profiles` (extends auth.users)
- `properties` (owner's properties)
- `property_images` (photos for properties)

### Functions:
- `handle_new_user()` - Auto-creates profile on signup
- `update_updated_at()` - Generic updated_at trigger function

### Triggers:
- `on_auth_user_created` on `auth.users` → `handle_new_user()`
- `profiles_updated_at` on `profiles` → `update_updated_at()`
- `properties_updated_at` on `properties` → `update_updated_at()`

---

## 12. Testing Against Supabase

### Mock Pattern (for unit tests)
The project uses mocked Supabase client at `packages/api/src/__mocks__/supabase.ts`. Tests should NOT hit the real database.

### Integration Testing
For integration tests that need real Supabase:
1. Use Supabase local development (Docker required)
2. Or create a separate staging project
3. Never run destructive tests against production

---

## 13. Common Gotchas

1. **Docker not required** for remote operations. Only needed for `supabase start` (local dev) and `supabase db dump`.
2. **Migrations are one-way** — once pushed, you can't un-push. Create a new migration to revert.
3. **RLS blocks service role too** if not configured. Use `SECURITY DEFINER` on functions that need to bypass RLS.
4. **Storage folder isolation** uses `(storage.foldername(name))[1]` which extracts the first path segment.
5. **The anon key is public** — security comes from RLS policies, not key secrecy.
6. **Expo env vars** must be prefixed with `EXPO_PUBLIC_` to be accessible in the client bundle.
