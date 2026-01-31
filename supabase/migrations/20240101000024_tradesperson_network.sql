-- =============================================================================
-- Mission 10: Tradesperson Network
-- Tables: trades, owner_trades, work_orders, trade_reviews, trade_portfolio
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE trade_status AS ENUM (
  'pending_verification',
  'active',
  'suspended',
  'inactive'
);

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

-- =============================================================================
-- TABLES
-- =============================================================================

-- Tradesperson profiles
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

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
  service_areas TEXT[],

  -- Availability
  available_weekdays BOOLEAN NOT NULL DEFAULT TRUE,
  available_weekends BOOLEAN NOT NULL DEFAULT FALSE,
  available_after_hours BOOLEAN NOT NULL DEFAULT FALSE,

  -- Profile
  bio TEXT,
  years_experience INTEGER,
  avatar_url TEXT,

  -- Ratings (updated by trigger)
  average_rating DECIMAL(2,1),
  total_reviews INTEGER NOT NULL DEFAULT 0,
  total_jobs INTEGER NOT NULL DEFAULT 0,

  -- Status
  status trade_status NOT NULL DEFAULT 'active',
  verified_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owner's saved trades (network)
CREATE TABLE owner_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, trade_id)
);

-- Work orders
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

  -- Quote (filled by trade)
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
  completion_photos TEXT[],

  -- Payment
  final_amount DECIMAL(10,2),
  invoice_number TEXT,
  invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,

  -- Status
  status work_order_status NOT NULL DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trade reviews
CREATE TABLE trade_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Review content
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT,
  would_recommend BOOLEAN,

  -- Trade response
  trade_response TEXT,
  trade_responded_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(work_order_id)
);

-- Trade portfolio images
CREATE TABLE trade_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  category maintenance_category,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ADD FK on maintenance_requests.trade_id
-- =============================================================================

ALTER TABLE maintenance_requests
  ADD CONSTRAINT fk_maintenance_trade
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE SET NULL;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_trades_categories ON trades USING GIN (categories);
CREATE INDEX idx_trades_areas ON trades USING GIN (service_areas);
CREATE INDEX idx_trades_status ON trades(status) WHERE status = 'active';
CREATE INDEX idx_trades_user ON trades(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX idx_owner_trades_owner ON owner_trades(owner_id);
CREATE INDEX idx_owner_trades_trade ON owner_trades(trade_id);

CREATE INDEX idx_work_orders_property ON work_orders(property_id);
CREATE INDEX idx_work_orders_trade ON work_orders(trade_id);
CREATE INDEX idx_work_orders_owner ON work_orders(owner_id);
CREATE INDEX idx_work_orders_maintenance ON work_orders(maintenance_request_id) WHERE maintenance_request_id IS NOT NULL;
CREATE INDEX idx_work_orders_active ON work_orders(status) WHERE status NOT IN ('completed', 'cancelled');

CREATE INDEX idx_trade_reviews_trade ON trade_reviews(trade_id);
CREATE INDEX idx_trade_reviews_work_order ON trade_reviews(work_order_id);

CREATE INDEX idx_trade_portfolio_trade ON trade_portfolio(trade_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_portfolio ENABLE ROW LEVEL SECURITY;

-- Trades: authenticated users can view active trades
CREATE POLICY "Authenticated users can view active trades"
  ON trades FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND status = 'active'
  );

-- Trades: users can manage their own profile
CREATE POLICY "Trades can manage own profile"
  ON trades FOR ALL
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- Trades: authenticated users can create trade records
CREATE POLICY "Authenticated users can create trades"
  ON trades FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Owner trades: owners manage their own network
CREATE POLICY "Owners manage own trade network"
  ON owner_trades FOR ALL
  USING (auth.uid() = owner_id);

-- Work orders: owners manage their own
CREATE POLICY "Owners manage own work orders"
  ON work_orders FOR ALL
  USING (auth.uid() = owner_id);

-- Work orders: trades can view assigned work orders
CREATE POLICY "Trades can view assigned work orders"
  ON work_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = work_orders.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Work orders: trades can update assigned work orders (submit quote, schedule, complete)
CREATE POLICY "Trades can update assigned work orders"
  ON work_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = work_orders.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Reviews: authenticated users can view
CREATE POLICY "Authenticated users can view reviews"
  ON trade_reviews FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Reviews: reviewers can create
CREATE POLICY "Reviewers can create reviews"
  ON trade_reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- Reviews: trades can respond
CREATE POLICY "Trades can respond to reviews"
  ON trade_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_reviews.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Portfolio: authenticated users can view
CREATE POLICY "Authenticated users can view portfolio"
  ON trade_portfolio FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Portfolio: trades manage their own
CREATE POLICY "Trades manage own portfolio"
  ON trade_portfolio FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_portfolio.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Update trade rating when a review is added or updated
CREATE OR REPLACE FUNCTION update_trade_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER trade_review_rating_update
  AFTER INSERT OR UPDATE ON trade_reviews
  FOR EACH ROW EXECUTE FUNCTION update_trade_rating();

-- Increment trade job count when work order is completed
CREATE OR REPLACE FUNCTION update_trade_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE trades SET total_jobs = total_jobs + 1
    WHERE id = NEW.trade_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_completed_job_count
  AFTER INSERT OR UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_trade_jobs();

-- Updated_at triggers
CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trade_reviews_updated_at
  BEFORE UPDATE ON trade_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update status_changed_at when work order status changes
CREATE OR REPLACE FUNCTION update_work_order_status_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_status_timestamp
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_work_order_status_timestamp();

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('trade-portfolio', 'trade-portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for trade-portfolio bucket
CREATE POLICY "Authenticated users can view trade portfolio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trade-portfolio' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload trade portfolio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trade-portfolio' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own trade portfolio uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'trade-portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);
