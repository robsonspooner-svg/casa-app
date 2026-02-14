# Mission 19: Performance & Optimization

## Overview
**Goal**: Optimize app performance for smooth user experience and efficient resource usage.
**Dependencies**: All previous missions
**Estimated Complexity**: Medium-High

## Success Criteria

### Phase A: Performance Baseline
- [ ] Implement performance monitoring
- [ ] Establish baseline metrics
- [ ] Identify performance bottlenecks
- [ ] Set performance budgets

### Phase B: Database Optimization
- [ ] Query optimization
- [ ] Index review and optimization
- [ ] Connection pooling
- [ ] Query caching strategy
- [ ] Materialized views for reports

### Phase C: API Optimization
- [ ] Response caching
- [ ] Pagination implementation
- [ ] Request batching
- [ ] GraphQL consideration
- [ ] Edge function optimization

### Phase D: App Performance
- [ ] Bundle size optimization
- [ ] Lazy loading screens
- [ ] Image optimization
- [ ] List virtualization
- [ ] Memory leak prevention

### Phase E: Caching Strategy
- [ ] Client-side caching (React Query)
- [ ] Server-side caching
- [ ] CDN configuration
- [ ] Cache invalidation strategy

### Phase F: Offline Support
- [ ] Offline data persistence
- [ ] Background sync
- [ ] Conflict resolution
- [ ] Offline-first architecture

### Phase G: Monitoring & Alerting
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Uptime monitoring
- [ ] Alert configuration

### Phase H: Testing
- [ ] Load testing
- [ ] Stress testing
- [ ] Performance regression tests

## Performance Metrics

### Target Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| App Launch (cold) | < 2s | < 4s |
| App Launch (warm) | < 1s | < 2s |
| Screen Transition | < 300ms | < 500ms |
| API Response (p95) | < 200ms | < 500ms |
| List Scroll FPS | > 55fps | > 45fps |
| Memory Usage | < 150MB | < 250MB |
| Bundle Size | < 5MB | < 10MB |

## Database Optimizations

### Index Audit Script
```sql
-- Find missing indexes for foreign keys
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  a.attname AS column_name,
  'CREATE INDEX idx_' || conrelid::regclass || '_' || a.attname ||
  ' ON ' || conrelid::regclass || '(' || a.attname || ');' AS suggested_index
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY(i.indkey)
  );

-- Find slow queries
SELECT
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%pkey%';
```

### Common Query Optimizations
```sql
-- Use covering indexes for common queries
CREATE INDEX idx_properties_owner_list ON properties(owner_id, created_at DESC)
  INCLUDE (address_line_1, suburb, rent_amount, status)
  WHERE deleted_at IS NULL;

-- Partial indexes for filtered queries
CREATE INDEX idx_maintenance_open ON maintenance_requests(property_id, created_at)
  WHERE status NOT IN ('completed', 'cancelled');

-- Composite indexes for joins
CREATE INDEX idx_payments_tenancy_date ON payments(tenancy_id, paid_at DESC)
  WHERE status = 'completed';
```

## API Optimization Strategies

### Pagination
```typescript
// packages/api/src/pagination.ts
export interface PaginationParams {
  cursor?: string
  limit?: number
  direction?: 'forward' | 'backward'
}

export interface PaginatedResult<T> {
  data: T[]
  nextCursor?: string
  prevCursor?: string
  hasMore: boolean
  totalCount?: number
}

export async function paginatedQuery<T>(
  query: PostgrestBuilder<T>,
  params: PaginationParams
): Promise<PaginatedResult<T>> {
  const { cursor, limit = 20, direction = 'forward' } = params

  let q = query.limit(limit + 1) // Fetch one extra to check hasMore

  if (cursor) {
    const decoded = decodeCursor(cursor)
    q = direction === 'forward'
      ? q.lt('created_at', decoded.createdAt)
      : q.gt('created_at', decoded.createdAt)
  }

  const { data, error } = await q

  const hasMore = data.length > limit
  const items = hasMore ? data.slice(0, limit) : data

  return {
    data: items,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : undefined,
    hasMore
  }
}
```

### Request Batching
```typescript
// packages/api/src/batching.ts
import DataLoader from 'dataloader'

// Batch property fetches
const propertyLoader = new DataLoader(async (ids: string[]) => {
  const { data } = await supabase
    .from('properties')
    .select('*')
    .in('id', ids)

  const propertyMap = new Map(data.map(p => [p.id, p]))
  return ids.map(id => propertyMap.get(id) || null)
})

export const getProperty = (id: string) => propertyLoader.load(id)
```

## React Native Optimizations

### List Virtualization
```typescript
// components/OptimizedList.tsx
import { FlashList } from '@shopify/flash-list'

export function PropertyList({ properties }) {
  const renderItem = useCallback(({ item }) => (
    <PropertyCard property={item} />
  ), [])

  const keyExtractor = useCallback((item) => item.id, [])

  return (
    <FlashList
      data={properties}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={120}
      getItemType={(item) => item.status}
    />
  )
}
```

### Image Optimization
```typescript
// components/OptimizedImage.tsx
import { Image } from 'expo-image'

export function PropertyImage({ uri, style }) {
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={200}
      placeholder={blurhash}
      cachePolicy="memory-disk"
    />
  )
}
```

### Bundle Optimization
```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      drop_console: true, // Remove console.logs in production
    },
  },
}

module.exports = config
```

## Caching Strategy

### React Query Configuration
```typescript
// packages/api/src/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
})

// Cache policies per query type
export const cacheConfig = {
  properties: { staleTime: 10 * 60 * 1000 }, // 10 min - changes infrequently
  payments: { staleTime: 1 * 60 * 1000 },    // 1 min - changes frequently
  notifications: { staleTime: 30 * 1000 },    // 30 sec - real-time important
  analytics: { staleTime: 30 * 60 * 1000 },   // 30 min - expensive to compute
}
```

### Offline Persistence
```typescript
// packages/api/src/persistence.ts
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'CASA_QUERY_CACHE',
  throttleTime: 1000,
})

// In app entry
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      {/* ... */}
    </PersistQueryClientProvider>
  )
}
```

## Monitoring Setup

### Sentry Integration
```typescript
// packages/monitoring/src/sentry.ts
import * as Sentry from '@sentry/react-native'

export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.2,
    profilesSampleRate: 0.1,
    integrations: [
      new Sentry.ReactNativeTracing({
        tracingOrigins: ['api.casaapp.com.au', /^\//],
        routingInstrumentation: Sentry.routingInstrumentation,
      }),
    ],
  })
}

// Track performance
export function trackPerformance(name: string, fn: () => Promise<void>) {
  return Sentry.startSpan({ name }, fn)
}
```

### Custom Metrics
```typescript
// packages/monitoring/src/metrics.ts
export const metrics = {
  screenLoad: (screen: string, duration: number) => {
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${screen} loaded in ${duration}ms`,
      level: 'info',
    })

    if (duration > 1000) {
      Sentry.captureMessage(`Slow screen load: ${screen}`, 'warning')
    }
  },

  apiCall: (endpoint: string, duration: number, status: number) => {
    if (duration > 500) {
      Sentry.captureMessage(`Slow API call: ${endpoint}`, 'warning')
    }
  },
}
```

## Files to Create/Modify

### Packages
```
packages/monitoring/             # New package
├── package.json
├── src/
│   ├── index.ts
│   ├── sentry.ts               # Sentry setup
│   ├── performance.ts          # Performance tracking
│   └── analytics.ts            # Usage analytics

packages/api/src/
├── cache/
│   ├── queryClient.ts          # React Query config
│   ├── persistence.ts          # Offline persistence
│   └── invalidation.ts         # Cache invalidation
├── optimization/
│   ├── pagination.ts           # Pagination utilities
│   ├── batching.ts             # Request batching
│   └── prefetch.ts             # Prefetch strategies
```

### App Updates
```
apps/[owner|tenant]/
├── metro.config.js             # Bundle optimization
├── app.config.ts               # Update: Sentry config
├── providers/
│   └── MonitoringProvider.tsx  # Sentry + analytics
└── hooks/
    ├── usePerformance.ts       # Performance tracking
    └── useOfflineStatus.ts     # Offline detection
```

### Phase I: Agent Performance Optimization

The AI agent is the most resource-intensive component. These optimizations are critical:

**Agent Response Time Targets:**
| Scenario | Target | Critical |
|----------|--------|----------|
| Simple query (get_property) | < 1s | < 2s |
| Complex query (financial summary) | < 2s | < 4s |
| Action tool (create_maintenance) | < 3s | < 5s |
| Generate tool (generate_lease) | < 10s | < 20s |
| External tool (web_search) | < 5s | < 10s |
| Workflow step | < 3s per step | < 5s per step |
| Streaming first token | < 500ms | < 1s |

**Optimization Strategies:**

1. **Tool Search (Dynamic Discovery)**
   - Instead of sending all 125 tool definitions to Claude on every request (expensive, slow), implement tool search:
   - Agent first receives a small set of "always available" tools (5-10)
   - Plus a `search_tools` meta-tool that finds relevant tools based on the conversation context
   - This reduces input tokens by ~80% per request
   - Implementation: Tool definitions stored in a lookup table, `search_tools` returns the 10 most relevant

2. **Context Window Management**
   - Conversation history trimmed to last 20 messages (with summary of earlier messages)
   - System prompt dynamically assembled (only include relevant property context, rules, preferences)
   - Tool results summarized if > 2000 tokens
   - Embeddings cache: frequently-accessed property data cached in Cloudflare KV

3. **Streaming Response**
   - Agent responses stream to client in real-time
   - Tool calls execute concurrently when independent
   - Progressive UI updates: show "thinking..." → tool name → result → final response

4. **Heartbeat Engine Performance**
   - Heartbeat scanners run as background Supabase Edge Functions (cron-triggered)
   - Each scanner has a max execution time of 30 seconds
   - Scanner results cached for 1 hour to prevent redundant processing
   - If scanner finds > 10 actionable items, batch into a single agent task (not 10 separate ones)

5. **Edge Function Cold Start**
   - Supabase Edge Functions have cold starts (~500ms)
   - For the main `agent-chat` function: keep warm with periodic health checks
   - For background scanners: accept cold start cost (they run on schedule, not user-triggered)
   - Consider Cloudflare Worker migration for the main chat endpoint (no cold starts)

**Database Query Performance for Agent:**
```sql
-- Agent queries must be fast. Key indexes for agent tool handlers:

-- Fast property lookup by owner
CREATE INDEX IF NOT EXISTS idx_properties_owner_active
  ON properties(owner_id)
  WHERE deleted_at IS NULL;

-- Fast tenancy lookup by property
CREATE INDEX IF NOT EXISTS idx_tenancies_property_active
  ON tenancies(property_id)
  WHERE status = 'active';

-- Fast arrears lookup
CREATE INDEX IF NOT EXISTS idx_arrears_tenancy_unresolved
  ON arrears_records(tenancy_id)
  WHERE NOT is_resolved;

-- Fast maintenance lookup by property and status
CREATE INDEX IF NOT EXISTS idx_maintenance_property_open
  ON maintenance_requests(property_id, created_at DESC)
  WHERE status NOT IN ('completed', 'cancelled');

-- Fast agent decisions for precedent search
CREATE INDEX IF NOT EXISTS idx_agent_decisions_owner_recent
  ON agent_decisions(owner_id, created_at DESC);

-- pgvector index for similarity search (HNSW for speed)
CREATE INDEX IF NOT EXISTS idx_agent_decisions_embedding
  ON agent_decisions USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**React Query Cache Strategy for Agent:**
```typescript
// Agent-specific cache configuration
const AGENT_CACHE_CONFIG = {
  // Agent conversation list — refresh frequently
  agentConversations: { staleTime: 30 * 1000 }, // 30 seconds

  // Agent tasks — near real-time
  agentTasks: { staleTime: 10 * 1000 }, // 10 seconds

  // Agent insights (proactive actions) — moderate
  agentInsights: { staleTime: 5 * 60 * 1000 }, // 5 minutes

  // Autonomy settings — rarely changes
  autonomySettings: { staleTime: 30 * 60 * 1000 }, // 30 minutes
};
```

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:perf                  # Performance tests
pnpm analyze                    # Bundle analysis
```

## Performance Testing Script
```bash
#!/bin/bash
# scripts/perf-test.sh

# Run Lighthouse CI
npx lhci autorun

# Run load test
npx artillery run load-test.yml

# Analyze bundle
npx react-native-bundle-visualizer
```

## Commit Message Pattern
```
perf: <description>

Mission-19: Performance Optimization
```

## Notes
- Profile before optimizing - don't guess
- Focus on perceived performance (loading states)
- Use FlashList instead of FlatList for long lists
- Implement skeleton screens for better UX
- Consider code splitting for web builds
- Monitor real-user metrics, not just lab tests
- Set up performance regression alerts
- Document performance budgets in README

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All database query optimizations applied without breaking existing functionality
- [ ] New indexes verified with EXPLAIN ANALYZE (query plans improved)
- [ ] Connection pooling configured and tested under load
- [ ] Materialized views refresh on schedule without errors
- [ ] No N+1 query patterns remaining in application code

### Feature Verification (Mission-Specific)
- [ ] App cold start time under target threshold (e.g., < 3 seconds)
- [ ] App warm start time under target threshold (e.g., < 1 second)
- [ ] FlatList/ScrollView performance smooth on lists with 100+ items (60fps)
- [ ] Images load with progressive quality (placeholder -> thumbnail -> full)
- [ ] Bundle size reduced from baseline (document before/after)
- [ ] Lazy loading screens load on-demand without jank
- [ ] Client-side caching (React Query) prevents redundant network requests
- [ ] Stale data revalidates in background without blocking UI
- [ ] Offline mode shows cached data when network unavailable
- [ ] Background sync resolves conflicts correctly when reconnected
- [ ] Memory usage stable during extended app sessions (no leaks)
- [ ] Performance monitoring (Sentry) captures real-user metrics
- [ ] Performance budgets documented and CI alerts configured
- [ ] Edge function response times under target (e.g., < 500ms p95)
- [ ] Agent chat response time under 3s for simple queries (p95)
- [ ] Agent streaming first token under 1s
- [ ] Tool search reduces input tokens by > 50% vs sending all tools
- [ ] Heartbeat scanners complete within 30s each
- [ ] pgvector similarity search returns results under 200ms
- [ ] No N+1 queries in agent tool handlers

### Visual & UX
- [ ] Tested on physical iOS device via Expo Go (performance-focused testing)
- [ ] No visible jank or frame drops during scrolling
- [ ] Loading states display immediately (no blank screens)
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes

### Regression (All Prior Missions)
- [ ] All prior mission critical paths still work (see TESTING-METHODOLOGY.md Section 4)
- [ ] Navigation between all existing screens works
- [ ] Previously created data still loads correctly
- [ ] No new TypeScript errors in existing code
- [ ] No performance regressions in previously-optimized screens

### Auth & Security
- [ ] Authenticated routes redirect unauthenticated users
- [ ] User can only access their own data (RLS verified)
- [ ] Session persists across app restarts
- [ ] No sensitive data in logs or error messages
- [ ] Caching does not leak data between users (cache keys include user ID)

---

## Pre-Launch Checklist (Items Requiring External Dependencies)

These items were deferred from earlier missions because they require third-party API accounts, business verification, or infrastructure not yet available. They must be completed before production launch.

### Background Checks (from Mission 05)

**Blocker**: Requires business verification + API account registration with Equifax and TICA.

| Integration | Provider | What's Needed | Action |
|-------------|----------|---------------|--------|
| Credit Check | Equifax Australia | API key, client ID, client secret | Apply at equifax.com.au/business |
| Identity Verification | Equifax Australia | Same account as above | Included in credit check package |
| Tenancy History | TICA | API key, agency ID | Apply at tica.com.au |

**Implementation when accounts are ready**:
1. Create `packages/integrations/src/equifax/client.ts` — Equifax API client (see Mission 05 spec for interface)
2. Create `packages/integrations/src/tica/client.ts` — TICA API client (see Mission 05 spec for interface)
3. Create `supabase/functions/run-background-check/` — Edge function to execute checks server-side
4. Add consent step to tenant application wizard (before Review step)
5. Add "Run Background Check" button to owner application detail screen
6. Add result viewer for owners (credit score, risk level, TICA listings)
7. Database tables already exist: `background_checks`, `background_check_consents` (created in Mission 05 migration)

**Environment Variables**:
```bash
EQUIFAX_API_KEY=xxx
EQUIFAX_CLIENT_ID=xxx
EQUIFAX_CLIENT_SECRET=xxx
EQUIFAX_ENVIRONMENT=sandbox
TICA_API_KEY=xxx
TICA_AGENCY_ID=xxx
TICA_ENVIRONMENT=sandbox
```

**Testing**:
- [ ] Consent flow captures tenant agreement with timestamp and IP
- [ ] Credit check returns score, defaults, risk grade
- [ ] TICA check returns tenancy history and blacklist status
- [ ] Results encrypted at rest in database
- [ ] Results expire after 30 days
- [ ] Owner can view check results on application detail screen

### DocuSign Integration (from Mission 06)

**Blocker**: Requires DocuSign developer account + production review (1-2 weeks approval process).

| Item | What's Needed | Action |
|------|---------------|--------|
| DocuSign Account | Integration Key, User ID, Account ID, RSA Private Key | Apply at developers.docusign.com |
| Lease Templates | State-specific templates (NSW, VIC, QLD, SA, WA, TAS, NT, ACT) | Create in DocuSign template editor |
| Webhook Endpoint | Cloudflare Worker for signing events | Deploy `supabase/functions/docusign-webhook/` |

**Implementation when account is ready**:
1. Create `packages/integrations/src/docusign/client.ts` — DocuSign eSignature REST API client (see Mission 06 spec for interface)
2. Create `packages/integrations/src/docusign/templates.ts` — State-specific lease template mappings
3. Create `supabase/functions/docusign-webhook/` — Handle envelope completed/declined events
4. Add `docusign_envelope_id` and `docusign_status` columns to tenancies table
5. Add "Send for Signing" button on tenancy detail screen (owner)
6. Add signing status indicators on tenant lease view
7. Database table `lease_signing_events` already exists (created in Mission 06 migration)

**Environment Variables**:
```bash
DOCUSIGN_INTEGRATION_KEY=xxx
DOCUSIGN_USER_ID=xxx
DOCUSIGN_ACCOUNT_ID=xxx
DOCUSIGN_BASE_URL=https://demo.docusign.net
DOCUSIGN_PRIVATE_KEY=xxx
DOCUSIGN_WEBHOOK_SECRET=xxx
```

**Testing**:
- [ ] Lease sent for e-signing with correct template for property state
- [ ] Sequential signing order (owner first, then tenant)
- [ ] Webhook updates tenancy status on signing completion
- [ ] Signed document stored in tenancy-documents bucket
- [ ] Declined/voided envelopes handled gracefully

### State Bond Authority APIs (from Mission 06)

**Blocker**: Requires registration with state bond authorities (NSW Fair Trading, VIC RTBA, QLD RTA). Each state has separate registration process.

| State | Authority | API Type | Registration |
|-------|-----------|----------|--------------|
| NSW | NSW Fair Trading | REST API | services.nsw.gov.au |
| VIC | RTBA | REST API | rtba.vic.gov.au |
| QLD | RTA | REST API | rta.qld.gov.au |

**Implementation when accounts are ready**:
1. Create `packages/integrations/src/bond/` — Bond authority API clients per state
2. Create `supabase/functions/lodge-bond/` — Edge function to submit bond lodgement
3. Add "Lodge Bond" button to tenancy detail (owner) when bond_status is 'pending'
4. Add bond lodgement number display when lodgement confirmed
5. Database tables `bond_lodgements` and `bond_claims` already exist (created in Mission 06 migration)

**Environment Variables**:
```bash
NSW_BOND_API_KEY=xxx
NSW_BOND_AGENCY_ID=xxx
VIC_RTBA_API_KEY=xxx
VIC_RTBA_AGENT_ID=xxx
QLD_RTA_API_KEY=xxx
QLD_RTA_AGENCY_ID=xxx
```

**Testing**:
- [ ] Bond lodgement submitted with correct amount and tenant details
- [ ] Lodgement number stored on tenancy record
- [ ] Bond status updates to 'held' after successful lodgement
- [ ] Error handling for API failures (retry with backoff)
- [ ] Bond claim flow at end of tenancy

### Lease Lifecycle Alerts Edge Function (from Mission 06)

**Blocker**: Requires notification infrastructure (Mission 17: Expo Push + SendGrid + Twilio).

**Implementation when notifications are available**:
1. Create `supabase/functions/lease-lifecycle-alerts/` — Cron-triggered function
2. Checks for: leases expiring in 90/60/30 days, rent increases effective soon, notice periods ending
3. Sends push notifications to owners and tenants
4. Creates in-app notifications (Mission 16)

**Deferred to**: Mission 17 (Notifications)
