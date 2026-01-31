# PropBot Project Structure

## Directory Layout

```
propbot/
├── apps/
│   ├── owner/                    # Owner mobile app (Expo)
│   │   ├── app/                  # Expo Router file-based routing
│   │   │   ├── (auth)/           # Auth screens (login, signup)
│   │   │   ├── (tabs)/           # Main tab navigation
│   │   │   │   ├── index.tsx     # Home/Dashboard
│   │   │   │   ├── properties.tsx
│   │   │   │   ├── messages.tsx
│   │   │   │   └── settings.tsx
│   │   │   ├── property/
│   │   │   │   └── [id].tsx      # Property detail
│   │   │   ├── maintenance/
│   │   │   │   └── [id].tsx      # Maintenance request detail
│   │   │   └── _layout.tsx
│   │   ├── components/           # App-specific components
│   │   ├── hooks/                # App-specific hooks
│   │   ├── app.json
│   │   └── package.json
│   │
│   ├── tenant/                   # Tenant mobile app (Expo)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx     # Home (my rental)
│   │   │   │   ├── payments.tsx
│   │   │   │   ├── maintenance.tsx
│   │   │   │   └── messages.tsx
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   └── package.json
│   │
│   └── admin/                    # Admin web dashboard (Next.js)
│       ├── app/
│       │   ├── dashboard/
│       │   ├── users/
│       │   ├── properties/
│       │   └── support/
│       └── package.json
│
├── packages/
│   ├── ui/                       # Shared UI components
│   │   ├── src/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api/                      # Supabase client + typed queries
│   │   ├── src/
│   │   │   ├── client.ts         # Supabase client setup
│   │   │   ├── queries/          # Typed query functions
│   │   │   │   ├── properties.ts
│   │   │   │   ├── tenancies.ts
│   │   │   │   ├── maintenance.ts
│   │   │   │   └── index.ts
│   │   │   ├── mutations/        # Typed mutation functions
│   │   │   │   ├── properties.ts
│   │   │   │   └── index.ts
│   │   │   └── types.ts          # Generated from Supabase
│   │   └── package.json
│   │
│   ├── agents/                   # Agent logic (runs on Cloudflare)
│   │   ├── src/
│   │   │   ├── orchestrator.ts
│   │   │   ├── agents/
│   │   │   │   ├── listing.ts
│   │   │   │   ├── tenant.ts
│   │   │   │   ├── maintenance.ts
│   │   │   │   ├── finance.ts
│   │   │   │   ├── inspection.ts
│   │   │   │   └── comms.ts
│   │   │   ├── tools/            # Agent tools
│   │   │   │   ├── supabase.ts
│   │   │   │   ├── claude.ts
│   │   │   │   ├── stripe.ts
│   │   │   │   └── twilio.ts
│   │   │   └── index.ts
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   └── config/                   # Shared configuration
│       ├── src/
│       │   ├── constants.ts
│       │   ├── env.ts
│       │   └── index.ts
│       └── package.json
│
├── supabase/
│   ├── migrations/               # Database migrations
│   │   ├── 00001_initial_schema.sql
│   │   ├── 00002_rls_policies.sql
│   │   └── 00003_functions.sql
│   ├── functions/                # Edge Functions
│   │   ├── handle-payment/
│   │   ├── process-webhook/
│   │   └── send-notification/
│   ├── seed.sql                  # Test data
│   └── config.toml
│
├── docs/
│   ├── PROPBOT-BIBLE.md          # Master reference
│   ├── API.md                    # API documentation
│   ├── DEPLOYMENT.md             # Deployment guide
│   └── TESTING.md                # Testing guide
│
├── specs/
│   └── ralph-missions/           # Mission files for Ralph
│       ├── MISSION-01-project-setup.md
│       ├── MISSION-02-auth-profiles.md
│       ├── MISSION-03-properties.md
│       ├── MISSION-04-listings.md
│       ├── MISSION-05-applications.md
│       ├── MISSION-06-tenancies.md
│       ├── MISSION-07-rent-collection.md
│       ├── MISSION-08-arrears.md
│       ├── MISSION-09-maintenance.md
│       ├── MISSION-10-trades.md
│       ├── MISSION-11-inspections.md
│       ├── MISSION-12-communications.md
│       ├── MISSION-13-finance-reports.md
│       ├── MISSION-14-agent-orchestrator.md
│       ├── MISSION-15-learning-engine.md
│       ├── MISSION-16-admin-dashboard.md
│       ├── MISSION-17-notifications.md
│       ├── MISSION-18-security-audit.md
│       ├── MISSION-19-performance.md
│       └── MISSION-20-polish.md
│
├── .github/
│   └── workflows/
│       ├── test.yml
│       ├── deploy-staging.yml
│       └── deploy-production.yml
│
├── @fix_plan.md                  # Ralph's task tracker
├── PROMPT.md                     # Ralph's instructions
├── package.json                  # Root package.json (workspaces)
├── turbo.json                    # Turborepo config
├── tsconfig.json                 # Root TypeScript config
└── .env.example                  # Environment variables template
```

## Monorepo Setup

### Root package.json
```json
{
  "name": "propbot",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "db:generate": "supabase gen types typescript --local > packages/api/src/types.ts",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  },
  "packageManager": "pnpm@8.15.0"
}
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".expo/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Quality Gates

Every mission MUST pass these before moving to the next:

1. **TypeScript**: `pnpm typecheck` passes with zero errors
2. **Lint**: `pnpm lint` passes with zero errors
3. **Tests**: `pnpm test` passes (unit tests for the mission)
4. **Build**: `pnpm build` succeeds
5. **Manual Test**: Feature works in Expo Go / browser

## Git Strategy

```
main          ─────●─────●─────●─────●───── (production)
                   │     │     │     │
staging       ─────●─────●─────●─────●───── (staging deploys)
                   │     │     │
feature/m01  ──────●─────┘     │
feature/m02  ──────────────────●
```

- Each mission = one feature branch
- PR to staging when mission complete
- Staging → main when batch of missions tested together
