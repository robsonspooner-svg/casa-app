# Casa Testing Methodology

> **Principle**: Every mission must be proven production-ready before advancing. Testing is not a checkbox — it is the evidence that what we built actually works for real users in real conditions.

---

## 1. Testing Philosophy

### 1.1 Core Rules

1. **Test reality, not assumptions** — Use real Supabase, real device, real data. Never mock something that exists.
2. **Regression is a blocker** — If a prior mission's feature breaks, the current mission is NOT complete.
3. **Rise to the level of testing** — Never weaken a test to make code pass. Fix the code.
4. **Visual confirmation required** — Screenshots or physical device verification for every UI change.
5. **End-to-end means end-to-end** — From user action through database and back to UI.

### 1.2 What "Production-Ready" Means

A feature is production-ready when:
- It works on a real device (not just simulator/web)
- It handles errors gracefully (network down, invalid input, expired session)
- It persists correctly (close app, reopen — state is preserved)
- It respects RLS (user A cannot see user B's data)
- It matches the design system (BRAND-AND-UI.md)
- It performs acceptably (no visible lag, no loading spinners > 2s on good connection)

---

## 2. Testing Layers

### Layer 1: Build Verification
```bash
pnpm typecheck          # Zero TypeScript errors across all packages
pnpm test               # All unit/integration tests pass
pnpm build              # Production build succeeds (no dead code, no missing deps)
```

**Rule**: If any of these fail, stop. Fix before proceeding.

### Layer 2: Unit Tests
- Test pure functions, hooks, and utilities in isolation
- Use real Supabase types (generated from schema)
- Cover edge cases: empty inputs, max values, invalid formats
- Minimum: every exported function has at least one test

### Layer 3: Integration Tests
- Test hooks with real Supabase client (test project or local)
- Verify RLS policies work correctly (attempt cross-user access)
- Test database triggers fire correctly
- Verify cascading operations (delete property → images cleaned up)

### Layer 4: Device Testing (E2E)
- Run on physical iOS device via Expo Go + tunnel
- Walk through every user flow manually
- Verify persistence (kill app, reopen)
- Test on slow network (throttle if needed)
- Check safe area handling on notched devices

### Layer 5: Regression Testing
- Re-run ALL prior missions' critical paths
- Verify no UI regressions (layout, colours, interactions)
- Verify no data regressions (existing records still load)
- Verify auth still works (login, persist session, logout)

---

## 3. Mission-Complete Checklist Template

Every mission must pass ALL items before advancing. This checklist is appended to each mission document.

### A. Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] `pnpm build` — succeeds with no warnings that indicate issues
- [ ] No `// TODO` or `// FIXME` left in mission code
- [ ] No `console.log` debugging statements left in production code

### B. Database Integrity
- [ ] All migrations applied to remote Supabase (`npx supabase migration list` shows no pending)
- [ ] RLS policies verified (tested with different user contexts)
- [ ] Triggers working (verified with real signup/insert operations)
- [ ] No orphaned data possible (foreign keys, cascades, soft deletes all correct)

### C. Feature Completeness
- [ ] Every success criterion in the mission doc is met (not partially — fully)
- [ ] No placeholder/mock data used to simulate functionality
- [ ] Error states handled (network failure, invalid input, unauthorised access)
- [ ] Loading states exist and are not jarring
- [ ] Empty states are informative (not blank screens)

### D. Visual & UX Verification
- [ ] Tested on physical device (iOS via Expo Go)
- [ ] Matches BRAND-AND-UI.md design system (colours, spacing, typography, radii)
- [ ] Safe areas respected (content not hidden behind notch/status bar/home indicator)
- [ ] Touch targets are minimum 44x44px
- [ ] No layout overflow or text truncation on standard screen sizes
- [ ] Dark text on light backgrounds (contrast ratio acceptable)

### E. Auth & Security
- [ ] Authenticated routes redirect unauthenticated users to login
- [ ] User can only access their own data (RLS verified)
- [ ] Session persists across app restarts
- [ ] Logout clears all user state
- [ ] No sensitive data in logs or error messages

### F. Regression (Prior Missions)
- [ ] All previous missions' critical paths still work
- [ ] Navigation between all existing screens works
- [ ] Data created in prior missions still loads correctly
- [ ] No new TypeScript errors introduced in existing code

### G. Performance
- [ ] Initial screen load < 2s on real device
- [ ] List scrolling is smooth (no frame drops)
- [ ] Images load progressively (not blocking UI)
- [ ] No memory leaks from unmounted subscriptions

---

## 4. Regression Test Paths by Mission

These are the critical paths that must be verified EVERY time, accumulated as missions complete.

### After Mission 01 (Project Setup)
- [ ] App starts without crash on device
- [ ] All packages resolve and build

### After Mission 02 (Auth & Profiles)
- [ ] Sign up with new email → profile created in DB
- [ ] Login with existing credentials → lands on home screen
- [ ] Profile shows correct name and email
- [ ] Logout → redirected to login
- [ ] Kill app → reopen → still authenticated
- [ ] Feature gates show correct tier-based access
- [ ] Home screen shows personalised greeting with user's name
- [ ] Tab navigation works (Home, Chat, Rent, Tasks)
- [ ] UI matches design system (navy header, proper icons, branded)

### After Mission 03 (Properties CRUD)
- All of Mission 02 checks, PLUS:
- [ ] Add property with all fields → appears in list
- [ ] Edit property → changes persist
- [ ] View property details → all info displayed
- [ ] Delete property → removed from list (soft delete)
- [ ] Property images upload and display
- [ ] Empty state shown when no properties exist

### After Mission 04 (Listings)
- All prior checks, PLUS:
- [ ] Create listing from property → listing appears
- [ ] Listing shows correct property details
- [ ] Publish/unpublish listing → status updates
- [ ] Portal syndication configured (Domain/REA)

### After Mission 05 (Applications)
- All prior checks, PLUS:
- [ ] Tenant can submit application → owner sees it
- [ ] Owner can approve/reject applications
- [ ] Application status updates reflect correctly
- [ ] Background check integration works (if configured)

### After Mission 06 (Tenancies)
- All prior checks, PLUS:
- [ ] Create tenancy from approved application
- [ ] Tenancy shows correct lease dates and terms
- [ ] Property status changes to "occupied"
- [ ] DocuSign integration for lease signing (if configured)

### After Mission 07 (Rent Collection)
- All prior checks, PLUS:
- [ ] Rent schedule created for tenancy
- [ ] Payment reminders sent at correct times
- [ ] Payment recorded → status updates
- [ ] Stripe Connect integration working (if configured)

### After Mission 08 (Arrears Management)
- All prior checks, PLUS:
- [ ] Overdue rent triggers reminder sequence
- [ ] Escalation occurs at correct intervals
- [ ] Notices generated with correct content
- [ ] Owner notified of arrears status

### After Mission 09 (Maintenance Requests)
- All prior checks, PLUS:
- [ ] Tenant can submit maintenance request with photos
- [ ] Owner sees request with priority classification
- [ ] Status progression works (submitted → in progress → completed)
- [ ] Notifications sent at each stage

### After Mission 10 (Trade Coordination)
- All prior checks, PLUS:
- [ ] Request quotes from tradespeople
- [ ] Compare and approve quotes
- [ ] Schedule trade visit
- [ ] Mark job complete with photos

### After Mission 11 (Inspections)
- All prior checks, PLUS:
- [ ] Schedule inspection → calendar entry created
- [ ] Self-service inspection form works
- [ ] Inspection report generated with findings
- [ ] Routine inspection scheduling works

### After Mission 12 (Communications)
- All prior checks, PLUS:
- [ ] In-app messaging between owner and tenant
- [ ] Message notifications delivered
- [ ] Email fallback works
- [ ] Communication history accessible

### After Mission 13 (Reports & Analytics)
- All prior checks, PLUS:
- [ ] Financial summary shows correct totals
- [ ] Income/expense breakdown accurate
- [ ] Tax report generation works
- [ ] Export to PDF/CSV functions

### After Mission 14 (AI Orchestrator)
- All prior checks, PLUS:
- [ ] AI chat responds to queries
- [ ] Tools execute correctly (property lookup, rent check, etc.)
- [ ] Autonomy levels respected (asks before executing risky actions)
- [ ] Conversation history persists

### After Mission 15 (Learning & Compliance)
- All prior checks, PLUS:
- [ ] Corrections stored and influence future behaviour
- [ ] Rules generated from correction patterns
- [ ] Compliance checks for relevant state
- [ ] Autonomy dashboard reflects owner preferences

### After Mission 16 (Document Management)
- All prior checks, PLUS:
- [ ] Documents stored and retrievable
- [ ] Lease templates generate correctly
- [ ] Document sharing works securely

### After Mission 17 (Notifications)
- All prior checks, PLUS:
- [ ] Push notifications delivered to device
- [ ] Notification preferences respected
- [ ] In-app notification centre shows history
- [ ] Email notifications formatted correctly

### After Mission 18 (Security Audit)
- All prior checks, PLUS:
- [ ] RLS policies reviewed and hardened
- [ ] No data leakage between users
- [ ] Auth tokens handled securely
- [ ] Input sanitisation on all user inputs

### After Mission 19 (Performance)
- All prior checks, PLUS:
- [ ] App start time < 1.5s
- [ ] List views handle 100+ items smoothly
- [ ] Images optimised and cached
- [ ] Bundle size within acceptable limits

### After Mission 20 (Launch Polish)
- All prior checks, PLUS:
- [ ] Onboarding flow complete and clear
- [ ] App Store assets ready (screenshots, descriptions)
- [ ] Error reporting integrated (Sentry or similar)
- [ ] All edge cases handled gracefully
- [ ] Full regression of ALL missions passes

---

## 5. Testing Commands Reference

```bash
# Full build verification
pnpm typecheck && pnpm test && pnpm build

# Run specific test file
pnpm test -- --testPathPattern=useAuth

# Run tests in watch mode during development
pnpm test -- --watch

# Start app for device testing
cd apps/owner && npx expo start --tunnel --clear

# Check Supabase migration status
SUPABASE_ACCESS_TOKEN=<token> npx supabase migration list --workdir .

# Verify database state
psql postgresql://postgres:<password>@db.woxlvhzgannzhajtjnke.supabase.co:5432/postgres -c "SELECT * FROM profiles LIMIT 5;"
```

---

## 6. When Something Fails

1. **Build fails**: Fix immediately. Do not proceed with broken builds.
2. **Test fails**: The code is wrong, not the test. Fix the code.
3. **Device test fails**: Reproduce, identify root cause, fix. Don't mark as "works on my machine."
4. **Regression found**: This is now the highest priority. Fix before continuing current mission work.
5. **Design mismatch**: Fix to match BRAND-AND-UI.md. The design system is the source of truth.

---

## 7. Evidence Trail

For each mission completion, record:
- Build output (pass/fail)
- Test output (X tests, X passing)
- Device screenshot of key screens
- Database verification (query showing correct data)

This evidence is not bureaucracy — it is confidence that we are building something real and launch-ready.
