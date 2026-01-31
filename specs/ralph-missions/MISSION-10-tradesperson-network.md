# Mission 10: Tradesperson Network

## Overview
**Goal**: Build a network of trusted tradespeople that owners can engage for maintenance and repairs.
**Dependencies**: Mission 09 (Maintenance Requests)
**Estimated Complexity**: Medium

## Success Criteria

### Phase A: Database Schema
- [ ] Create `trades` table (tradesperson profiles)
- [ ] Create `trade_categories` table
- [ ] Create `work_orders` table
- [ ] Create `trade_reviews` table
- [ ] Set up RLS policies

### Phase B: Tradesperson Registration
- [ ] Trade signup flow (separate from owner/tenant)
- [ ] Business details (ABN, license, insurance)
- [ ] Service categories and areas
- [ ] Availability settings
- [ ] Portfolio/photo gallery

### Phase C: Owner's Trade Network
- [ ] Create TradesScreen (owner app)
- [ ] Add tradesperson (by invite or search)
- [ ] View trade profiles
- [ ] Save favorites
- [ ] Filter by category, rating, area

### Phase D: Work Order Creation
- [ ] Create work order from maintenance request
- [ ] Assign to tradesperson
- [ ] Include job details, photos, access info
- [ ] Set budget/quote requirement
- [ ] Send notification to trade

### Phase E: Quote Management
- [ ] Trade submits quote via web link or app
- [ ] Owner reviews and approves/rejects
- [ ] Multiple quotes comparison
- [ ] Quote acceptance notification

### Phase F: Job Tracking
- [ ] Trade confirms job acceptance
- [ ] Schedule appointment
- [ ] Check-in when arriving
- [ ] Check-out when complete
- [ ] Upload completion photos

### Phase G: Payment & Invoicing
- [ ] Trade submits invoice
- [ ] Owner reviews and approves
- [ ] Payment via Stripe (optional)
- [ ] Record payment as made externally

### Phase H: Reviews & Ratings
- [ ] Owner reviews tradesperson after job
- [ ] Rating (1-5 stars)
- [ ] Written review
- [ ] Trade response capability
- [ ] Reviews visible on profile

### Phase I: Testing
- [ ] Unit tests for trade hooks
- [ ] Integration tests for work order flow
- [ ] E2E test: Create work order → Quote → Complete → Review

## Database Schema

```sql
-- Trade status enum
CREATE TYPE trade_status AS ENUM (
  'pending_verification',
  'active',
  'suspended',
  'inactive'
);

-- Work order status enum
CREATE TYPE work_order_status AS ENUM (
  'draft',
  'sent',
  'quoted',
  'approved',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

-- Tradesperson profiles
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- If they have an account

  -- Business details
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  abn TEXT,
  license_number TEXT,

  -- Insurance
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  insurance_expiry DATE,

  -- Services
  categories maintenance_category[] NOT NULL,
  service_areas TEXT[], -- Postcodes or suburbs

  -- Availability
  available_weekdays BOOLEAN NOT NULL DEFAULT TRUE,
  available_weekends BOOLEAN NOT NULL DEFAULT FALSE,
  available_after_hours BOOLEAN NOT NULL DEFAULT FALSE,

  -- Profile
  bio TEXT,
  years_experience INTEGER,
  avatar_url TEXT,

  -- Ratings
  average_rating DECIMAL(2,1),
  total_reviews INTEGER NOT NULL DEFAULT 0,
  total_jobs INTEGER NOT NULL DEFAULT 0,

  -- Status
  status trade_status NOT NULL DEFAULT 'pending_verification',
  verified_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owner's saved trades
CREATE TABLE owner_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, trade_id)
);

-- Work orders
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  maintenance_request_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,

  -- Job details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category maintenance_category NOT NULL,
  urgency maintenance_urgency NOT NULL DEFAULT 'routine',

  -- Access
  access_instructions TEXT,
  tenant_contact_allowed BOOLEAN NOT NULL DEFAULT TRUE,

  -- Budget
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  quote_required BOOLEAN NOT NULL DEFAULT TRUE,

  -- Quote
  quoted_amount DECIMAL(10,2),
  quoted_at TIMESTAMPTZ,
  quote_notes TEXT,
  quote_valid_until DATE,

  -- Schedule
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,

  -- Completion
  completion_notes TEXT,
  completion_photos TEXT[], -- Storage URLs

  -- Payment
  final_amount DECIMAL(10,2),
  invoice_number TEXT,
  invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  payment_method TEXT, -- 'stripe', 'bank_transfer', 'cash', etc.

  -- Status
  status work_order_status NOT NULL DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trade reviews
CREATE TABLE trade_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Review content
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT,
  would_recommend BOOLEAN,

  -- Response
  trade_response TEXT,
  trade_responded_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(work_order_id) -- One review per work order
);

-- Trade portfolio images
CREATE TABLE trade_portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  category maintenance_category,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trades_categories ON trades USING GIN (categories);
CREATE INDEX idx_trades_areas ON trades USING GIN (service_areas);
CREATE INDEX idx_trades_status ON trades(status) WHERE status = 'active';
CREATE INDEX idx_owner_trades ON owner_trades(owner_id);
CREATE INDEX idx_work_orders_property ON work_orders(property_id);
CREATE INDEX idx_work_orders_trade ON work_orders(trade_id);
CREATE INDEX idx_work_orders_status ON work_orders(status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_trade_reviews ON trade_reviews(trade_id);

-- RLS Policies
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_portfolio ENABLE ROW LEVEL SECURITY;

-- Anyone can view active trades
CREATE POLICY "Anyone can view active trades"
  ON trades FOR SELECT
  USING (status = 'active');

-- Trades can manage own profile
CREATE POLICY "Trades can manage own profile"
  ON trades FOR ALL
  USING (user_id = auth.uid());

-- Owner trades
CREATE POLICY "Owners can manage own trade network"
  ON owner_trades FOR ALL
  USING (auth.uid() = owner_id);

-- Work orders: owners and assigned trades
CREATE POLICY "Owners can manage own work orders"
  ON work_orders FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Trades can view assigned work orders"
  ON work_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = work_orders.trade_id
      AND trades.user_id = auth.uid()
    )
  );

CREATE POLICY "Trades can update assigned work orders"
  ON work_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = work_orders.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Reviews
CREATE POLICY "Anyone can view reviews"
  ON trade_reviews FOR SELECT
  USING (TRUE);

CREATE POLICY "Owners can create reviews"
  ON trade_reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Trades can respond to reviews"
  ON trade_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_reviews.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Portfolio: public view, trade manages own
CREATE POLICY "Anyone can view portfolio"
  ON trade_portfolio FOR SELECT
  USING (TRUE);

CREATE POLICY "Trades can manage own portfolio"
  ON trade_portfolio FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_portfolio.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Function to update trade ratings
CREATE OR REPLACE FUNCTION update_trade_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE trades SET
    average_rating = (
      SELECT AVG(rating)::DECIMAL(2,1)
      FROM trade_reviews
      WHERE trade_id = NEW.trade_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM trade_reviews
      WHERE trade_id = NEW.trade_id
    )
  WHERE id = NEW.trade_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trade_review_added
  AFTER INSERT OR UPDATE ON trade_reviews
  FOR EACH ROW EXECUTE FUNCTION update_trade_rating();

-- Function to update trade job count
CREATE OR REPLACE FUNCTION update_trade_jobs()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE trades SET total_jobs = total_jobs + 1
    WHERE id = NEW.trade_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER work_order_completed
  AFTER INSERT OR UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_trade_jobs();

-- Updated_at triggers
CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── trades.ts               # Trade CRUD
│   ├── workOrders.ts           # Work order CRUD
│   └── tradeReviews.ts         # Reviews CRUD
├── hooks/
│   ├── useTrades.ts            # Search/list trades
│   ├── useMyTrades.ts          # Owner's trade network
│   ├── useWorkOrders.ts        # Work orders list
│   ├── useWorkOrder.ts         # Single work order
│   └── useTradeReviews.ts      # Trade reviews
└── types/
    └── trades.ts               # Trade types
```

### Owner App
```
apps/owner/app/(app)/
├── trades/
│   ├── index.tsx               # My trade network
│   ├── search.tsx              # Find trades
│   ├── add.tsx                 # Add trade manually
│   └── [id].tsx                # Trade profile
├── work-orders/
│   ├── index.tsx               # All work orders
│   ├── create.tsx              # Create work order
│   └── [id]/
│       ├── index.tsx           # Work order details
│       ├── quote.tsx           # Review quote
│       └── review.tsx          # Write review

apps/owner/components/
├── TradeCard.tsx               # Trade profile card
├── TradeSearch.tsx             # Search interface
├── WorkOrderForm.tsx           # Create work order
├── QuoteComparison.tsx         # Compare quotes
├── WorkOrderTimeline.tsx       # Status timeline
└── ReviewForm.tsx              # Review form
```

### Trade Web Portal (Future: separate app)
For MVP, trades interact via:
- Email notifications with action links
- Mobile-optimized web pages for quote/update

```
supabase/functions/
├── trade-portal/
│   ├── view-work-order.tsx     # View work order details
│   ├── submit-quote.tsx        # Submit quote form
│   └── complete-job.tsx        # Mark complete
```

### Shared UI
```
packages/ui/src/components/
├── StarRating.tsx              # Star rating display/input
├── TradeAvatar.tsx             # Trade profile picture
├── CategoryIcon.tsx            # Category icons
└── QuoteCard.tsx               # Quote display
```

## Work Order Flow

```
1. Owner creates work order from maintenance request
   ↓
2. Work order sent to tradesperson (email + SMS)
   ↓
3. Trade views job details via web link
   ↓
4. Trade submits quote (if required)
   ↓
5. Owner reviews and approves quote
   ↓
6. Trade schedules and confirms appointment
   ↓
7. Trade checks in on arrival (captures time)
   ↓
8. Trade completes job and uploads photos
   ↓
9. Trade submits invoice
   ↓
10. Owner marks paid and writes review
```

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(trades): <description>

Mission-10: Tradesperson Network
```

## Notes
- ABN validation via ABR API in future
- License verification varies by trade and state
- Insurance expiry tracking important for compliance
- Consider marketplace model in future (trades find work)
- Trade web portal keeps initial scope simple
- Reviews build trust and help other owners
- Service areas help with job matching

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`trades`, `owner_trades`, `work_orders`, `trade_reviews`, `trade_portfolio`)
- [ ] RLS policies verified: anyone can view active trades
- [ ] RLS policies verified: trades can manage own profile
- [ ] RLS policies verified: owners can manage own work orders
- [ ] RLS policies verified: trades can view/update assigned work orders
- [ ] `update_trade_rating()` trigger correctly recalculates average rating on review
- [ ] `update_trade_jobs()` trigger increments job count on work order completion
- [ ] `update_updated_at()` triggers on trades and work_orders
- [ ] UNIQUE constraints: `owner_trades(owner_id, trade_id)`, `trade_reviews(work_order_id)`
- [ ] GIN indexes on `trades.categories` and `trades.service_areas` for array queries
- [ ] Foreign keys correct with appropriate CASCADE/RESTRICT/SET NULL behavior

### Feature Verification (Mission-Specific)
- [ ] Owner can add a tradesperson to their network (by invite or search)
- [ ] Owner can search trades by category, rating, and service area
- [ ] Owner can save trades as favorites
- [ ] Owner can create a work order from a maintenance request
- [ ] Work order includes job details, photos, access info, and budget
- [ ] Tradesperson receives notification of new work order (email + SMS)
- [ ] Trade can view job details via web portal link
- [ ] Trade can submit a quote with amount, notes, and validity period
- [ ] Owner can compare multiple quotes side-by-side
- [ ] Owner can approve/reject quotes
- [ ] Trade can schedule appointment after quote approval
- [ ] Trade can check-in on arrival and check-out on completion
- [ ] Trade can upload completion photos
- [ ] Trade can submit invoice
- [ ] Owner can mark invoice as paid (Stripe or external)
- [ ] Owner can write a review after job completion (1-5 stars + text)
- [ ] Trade average rating updates after new review
- [ ] Work order status flow works end-to-end (draft -> sent -> quoted -> approved -> scheduled -> in_progress -> completed)

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


---

## Agent Integration (Mission 14)

This mission's data is consumed by Mission 14's AI agent. The agent uses the trade network as its primary mechanism for finding, engaging, and managing service providers for maintenance work.

> See `specs/AGENT-SPEC.md` Section 5 and Section 6 for the full autonomous lifecycle.

### Agent Tools Available at This Mission

| Name | Category | Autonomy | Risk | Description |
|------|----------|----------|------|-------------|
| `get_trades` | query | L4 Autonomous | None | Get trades in owner's network filtered by category/area/rating |
| `get_trade_detail` | query | L4 Autonomous | None | Full trade profile: reviews, work history, portfolio, availability |
| `get_work_orders` | query | L4 Autonomous | None | Work orders filtered by property/trade/status |
| `get_work_order_detail` | query | L4 Autonomous | None | Full work order: quote, schedule, invoices, communications |
| `create_service_provider` | action | L2 Draft | Low | Create new trade from web search results or owner-provided details |
| `add_trade_to_network` | action | L3 Execute | Low | Add trade to owner's network, set as favorite |
| `create_work_order` | action | L1 Suggest | Medium | Create work order (involves money) |
| `send_work_order` | action | L1 Suggest | Medium | Send work order to trade via email/SMS (triggers from create_work_order) |
| `approve_quote` | action | L1 Suggest | Medium | Approve a trade's quote and confirm booking |
| `update_work_order_status` | action | L2 Draft | Low | Progress work order through lifecycle |
| `submit_trade_review` | action | L3 Execute | Low | Submit owner's rating after job completion |
| `find_local_trades` | external | L2 Draft | Low | Search web/directories for trades by category + location |
| `parse_business_details` | external | L3 Execute | None | Extract structured data from trade website/listing |

### Agent-Driven Trade Discovery Workflow

When the agent needs to find a trade (triggered by maintenance request or owner request):

```
1. CHECK EXISTING NETWORK
   → Query owner_trades JOIN trades WHERE category matches AND service_area covers
   → If found: present options ranked by rating + jobs completed
   → If found with favorites: suggest favorite first

2. IF NO EXISTING TRADE — EXTERNAL SEARCH
   → find_local_trades: Web search "licensed [category] [suburb] [state]"
   → Returns top 5-10 results with business details
   → For each: parse_business_details extracts ABN, license, insurance, ratings, contact

3. CREATE SERVICE PROVIDER CARDS
   → create_service_provider for each vetted result
   → Populates: business_name, contact_name, email, phone, abn, license_number,
     categories, service_areas, google_rating, verification_status
   → add_trade_to_network: adds to owner's network

4. PRESENT TO OWNER
   → "I found 3 licensed [trades] near [suburb]:
      1. [Name] — [rating]★, Licensed, Insured — $[rate_range]/hr
      2. [Name] — [rating]★, Licensed — $[rate_range]/hr
      3. [Name] — [rating]★, Licensed — $[rate_range]/hr
      Want me to request quotes from all three, or choose one?"

5. REQUEST QUOTE
   → create_work_order with selected trade
   → send_work_order via email/SMS (AI-transparent — appears from owner)
   → Log communication against service provider card
```

### AI-Transparent Communication with Trades

All outbound communication to tradespeople must appear to come from the property owner, not from AI. The agent:

1. **Uses owner's name as sender** — emails and SMS are from "[Owner Name]", reply-to is owner's email
2. **Professional, human tone** — no AI patterns, no disclaimers, natural Australian English
3. **Includes relevant details** — property address, issue description, urgency, access info
4. **Logs everything** — all communication stored against the work order + service provider card
5. **Handles replies** — incoming emails/SMS from trades parsed by agent, fed into conversation

### Trade Network Building Over Time

The agent tracks trade performance and builds the owner's network organically:

| Month | Agent Behaviour | Network State |
|-------|----------------|---------------|
| Month 1 | Discovers trades via web search for each new maintenance category | 0-5 trades, unrated |
| Month 3 | Uses rated trades from network first, web search only for new categories | 5-10 trades, some rated |
| Month 6 | Rarely searches externally, uses owner's preferred trades per category | 10-15 trades, well-rated |
| Month 12 | Fully curated network, auto-assigns preferred trade per category/property | 15+ trades, comprehensive |

**Network effects**: Trades discovered by other Casa owners in the same area are available as recommendations (anonymised). A new owner in Byron Bay gets suggested trades that other Byron Bay owners have rated highly.

### Work Order Lifecycle (Agent-Managed)

```
DRAFT → SENT → QUOTED → APPROVED → SCHEDULED → IN_PROGRESS → COMPLETED
  |        |       |        |           |            |           |
  |        |       |        |           |            |           → Agent: prompt rating
  |        |       |        |           |            → Agent: follow up if overdue
  |        |       |        |           → Agent: confirm with tenant + trade
  |        |       |        → Agent: check against threshold, auto-approve or ask owner
  |        |       → Agent: present quote to owner
  |        → Agent: log communication, set follow-up reminder
  → Agent: create from maintenance request
```

### Cost Threshold Management

The agent manages cost thresholds per owner, per property, per category:

- **Owner sets global threshold**: "Auto-approve anything under $400"
- **Per-category override**: "Plumbing up to $500, electrical up to $300"
- **Per-property override**: "Investment property: up to $200, my holiday home: up to $800"
- **Emergency override**: "Always ask for emergencies regardless of cost"
- **Learned thresholds**: Agent suggests threshold updates based on approval patterns

Thresholds stored as `agent_rules` and `agent_preferences`, recalled before each approval decision.

### Background Tasks Triggered at This Mission

| Task | Schedule | Description |
|------|----------|-------------|
| `trade_quote_followup` | Every 24h | Check for work orders in 'sent' status >72h, send follow-up to trade |
| `work_order_completion_check` | Every 24h | Check for 'in_progress' work orders past scheduled completion date |
| `trade_rating_prompt` | Event-driven | After work order marked 'completed', prompt owner + tenant to rate |

---

## Gateway Implementation (Pre-Built)

> The following gateway infrastructure was created in Mission 07 to facilitate this mission:

### Files Created
- `packages/api/src/hooks/gateways/useTradesGateway.ts` — Hook with navigation entry points and placeholder state
- `packages/api/src/types/gateways.ts` — Type definitions for `Trade`, `WorkOrder`, `TradeReview`, etc.

### What's Already Done
1. **Types defined**: All TypeScript interfaces including:
   - `Trade` with full business/insurance/category fields
   - `WorkOrder` with quote, schedule, payment tracking
   - `TradeReview` with rating and response
   - `TradeStatus` and `WorkOrderStatus` enums
2. **Gateway hook**: `useTradesGateway()` provides:
   - Navigation: `navigateToTradesList()`, `navigateToTradeDetail()`, `navigateToTradeSearch()`, `navigateToWorkOrders()`, `navigateToWorkOrderDetail()`, `navigateToCreateWorkOrder()`
   - Actions: `addTradeToNetwork()`, `removeTradeFromNetwork()`, `setTradeFavorite()`, `createWorkOrder()`, `approveQuote()`, `rejectQuote()`, `markJobComplete()`, `submitReview()`
3. **Exported from `@casa/api`**: Import directly in components

### What This Mission Needs to Do
1. Create database migration with tables defined in this spec
2. Implement real Supabase queries replacing gateway placeholders
3. Build trade portal (web) for tradesperson interaction
4. Create work order flow screens

### Usage Example (Already Works)
```typescript
import { useTradesGateway } from '@casa/api';

function TradesScreen() {
  const { items, favorites, navigateToTradeSearch, createWorkOrder } = useTradesGateway();
}
```
