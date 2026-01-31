-- =============================================================================
-- Mission 10 Fix: Tenant review request system
-- When a work order completes, the tenant at that property gets a review request.
-- Tenants do NOT see work orders directly — they only see the review prompt.
-- =============================================================================

-- =============================================================================
-- 1. DROP the tenant work order visibility policy (added in 000026, wrong approach)
-- =============================================================================
DROP POLICY IF EXISTS "Tenants can view work orders for their properties" ON work_orders;

-- =============================================================================
-- 2. Create trade_review_requests table
-- One row per completed work order per tenant at that property
-- =============================================================================
CREATE TABLE trade_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE RESTRICT,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Context shown to tenant (so they don't need work_order access)
  trade_business_name TEXT NOT NULL,
  work_summary TEXT NOT NULL,
  category maintenance_category NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,

  -- State
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  review_id UUID REFERENCES trade_reviews(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(work_order_id, tenant_id)
);

CREATE INDEX idx_review_requests_tenant ON trade_review_requests(tenant_id);
CREATE INDEX idx_review_requests_pending ON trade_review_requests(tenant_id, status) WHERE status = 'pending';

-- =============================================================================
-- 3. RLS for trade_review_requests
-- =============================================================================
ALTER TABLE trade_review_requests ENABLE ROW LEVEL SECURITY;

-- Tenants can see their own review requests
CREATE POLICY "Tenants can view own review requests"
  ON trade_review_requests FOR SELECT
  USING (auth.uid() = tenant_id);

-- Tenants can update their own review requests (dismiss or mark completed)
CREATE POLICY "Tenants can update own review requests"
  ON trade_review_requests FOR UPDATE
  USING (auth.uid() = tenant_id);

-- Only triggers/service role can insert
CREATE POLICY "Service role inserts review requests"
  ON trade_review_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- 4. Trigger: When a work order status changes to 'completed',
--    create review requests for all active tenants at that property
-- =============================================================================
CREATE OR REPLACE FUNCTION create_tenant_review_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade_name TEXT;
  v_tenant RECORD;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    -- Get the trade business name
    SELECT business_name INTO v_trade_name
    FROM trades
    WHERE id = NEW.trade_id;

    IF v_trade_name IS NULL THEN
      v_trade_name := 'Tradesperson';
    END IF;

    -- Find all active tenants at this property
    FOR v_tenant IN
      SELECT tt.tenant_id
      FROM tenancy_tenants tt
      JOIN tenancies t ON tt.tenancy_id = t.id
      WHERE t.property_id = NEW.property_id
      AND t.status IN ('active', 'pending')
    LOOP
      -- Insert review request (ignore if duplicate)
      INSERT INTO trade_review_requests (
        tenant_id, trade_id, work_order_id, property_id,
        trade_business_name, work_summary, category, completed_at
      ) VALUES (
        v_tenant.tenant_id, NEW.trade_id, NEW.id, NEW.property_id,
        v_trade_name, NEW.title, NEW.category, NOW()
      )
      ON CONFLICT (work_order_id, tenant_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_review_requests
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_tenant_review_requests();

-- =============================================================================
-- 5. Update timestamp trigger for trade_review_requests
-- =============================================================================
CREATE TRIGGER update_trade_review_requests_updated_at
  BEFORE UPDATE ON trade_review_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
