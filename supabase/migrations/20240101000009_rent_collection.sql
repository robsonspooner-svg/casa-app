-- Mission 07: Rent Collection & Payments
-- Creates tables for rent schedules, payments, payment methods, Stripe Connect,
-- subscriptions, auto-pay, and add-on purchases.

-- ============================================================
-- ENUMS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM (
      'scheduled',
      'pending',
      'completed',
      'failed',
      'cancelled',
      'refunded'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE payment_type AS ENUM (
      'rent',
      'bond',
      'utility',
      'maintenance',
      'fee',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_frequency') THEN
    CREATE TYPE payment_frequency AS ENUM (
      'weekly',
      'fortnightly',
      'monthly'
    );
  END IF;
END$$;

-- ============================================================
-- TABLES
-- ============================================================

-- Owner Stripe Connect accounts
CREATE TABLE owner_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'express',
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  payout_schedule TEXT DEFAULT 'daily',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant Stripe customers
CREATE TABLE tenant_stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment methods (cards, BECS bank accounts)
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  type TEXT NOT NULL,
  last_four TEXT NOT NULL,
  brand TEXT,
  bank_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_autopay BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  becs_mandate_status TEXT,
  becs_mandate_id TEXT,
  autopay_days_before INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments record
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  payment_method_id UUID REFERENCES payment_methods(id),
  payment_type payment_type NOT NULL DEFAULT 'rent',
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  description TEXT,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  stripe_fee DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  net_amount DECIMAL(10,2),
  status payment_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  receipt_url TEXT,
  receipt_number TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rent schedules (individual due dates)
CREATE TABLE rent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  is_prorata BOOLEAN NOT NULL DEFAULT FALSE,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenancy_id, due_date)
);

-- Auto-pay settings per tenancy
CREATE TABLE autopay_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  days_before_due INTEGER NOT NULL DEFAULT 0,
  max_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment disputes
CREATE TABLE payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_response',
  evidence_due_by TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add-on purchases
CREATE TABLE add_on_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  tenancy_id UUID REFERENCES tenancies(id),
  add_on_type TEXT NOT NULL CHECK (add_on_type IN (
    'tenant_finding', 'professional_inspection', 'open_home_hosting',
    'photography', 'emergency_callout', 'routine_inspection'
  )),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'scheduled', 'in_progress', 'completed', 'refunded', 'cancelled'
  )),
  scheduled_date DATE,
  scheduled_time TIME,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_rent_schedules_tenancy ON rent_schedules(tenancy_id);
CREATE INDEX idx_rent_schedules_due ON rent_schedules(due_date) WHERE NOT is_paid;
CREATE INDEX idx_payment_methods_user ON payment_methods(user_id) WHERE is_active;
CREATE INDEX idx_payments_tenancy ON payments(tenancy_id);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_status ON payments(status, created_at);
CREATE INDEX idx_autopay_settings_tenancy ON autopay_settings(tenancy_id);
CREATE INDEX idx_payment_disputes_payment ON payment_disputes(payment_id);
CREATE INDEX idx_add_on_purchases_owner ON add_on_purchases(owner_id);
CREATE INDEX idx_add_on_purchases_property ON add_on_purchases(property_id);
CREATE INDEX idx_add_on_purchases_status ON add_on_purchases(status) WHERE status IN ('paid', 'scheduled', 'in_progress');

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE owner_stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopay_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE add_on_purchases ENABLE ROW LEVEL SECURITY;

-- Owners manage their own Stripe account
CREATE POLICY "Owners manage own Stripe account"
  ON owner_stripe_accounts FOR ALL
  USING (auth.uid() = owner_id);

-- Tenants manage their own Stripe customer record
CREATE POLICY "Tenants manage own customer record"
  ON tenant_stripe_customers FOR ALL
  USING (auth.uid() = tenant_id);

-- Users manage their own payment methods
CREATE POLICY "Users manage own payment methods"
  ON payment_methods FOR ALL
  USING (auth.uid() = user_id);

-- Owners can view payments for properties they own
CREATE POLICY "Owners view payments for their properties"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = payments.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view their own payments
CREATE POLICY "Tenants view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = tenant_id);

-- Tenants can create payments
CREATE POLICY "Tenants create payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

-- Owners can view rent schedules for their properties
CREATE POLICY "Owners view rent schedules"
  ON rent_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = rent_schedules.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view their own rent schedules
CREATE POLICY "Tenants view own rent schedules"
  ON rent_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = rent_schedules.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Tenants manage their own autopay settings
CREATE POLICY "Tenants manage own autopay"
  ON autopay_settings FOR ALL
  USING (auth.uid() = tenant_id);

-- Owners can view autopay settings for their properties
CREATE POLICY "Owners view autopay for their properties"
  ON autopay_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = autopay_settings.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Payment disputes visible to payment participants
CREATE POLICY "Owners view disputes for their payments"
  ON payment_disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payments
      JOIN tenancies ON tenancies.id = payments.tenancy_id
      JOIN properties ON properties.id = tenancies.property_id
      WHERE payments.id = payment_disputes.payment_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Owners manage their own add-on purchases
CREATE POLICY "Owners manage own add-on purchases"
  ON add_on_purchases FOR ALL
  USING (auth.uid() = owner_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER autopay_settings_updated_at
  BEFORE UPDATE ON autopay_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER owner_stripe_accounts_updated_at
  BEFORE UPDATE ON owner_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER add_on_purchases_updated_at
  BEFORE UPDATE ON add_on_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Generate rent schedule entries for a tenancy
CREATE OR REPLACE FUNCTION generate_rent_schedule(
  p_tenancy_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_amount DECIMAL,
  p_frequency payment_frequency
)
RETURNS VOID AS $$
DECLARE
  current_due DATE := p_start_date;
  interval_days INTEGER;
BEGIN
  CASE p_frequency
    WHEN 'weekly' THEN interval_days := 7;
    WHEN 'fortnightly' THEN interval_days := 14;
    WHEN 'monthly' THEN interval_days := 0;
  END CASE;

  WHILE current_due <= p_end_date LOOP
    INSERT INTO rent_schedules (tenancy_id, due_date, amount)
    VALUES (p_tenancy_id, current_due, p_amount)
    ON CONFLICT (tenancy_id, due_date) DO NOTHING;

    IF p_frequency = 'monthly' THEN
      current_due := current_due + INTERVAL '1 month';
    ELSE
      current_due := current_due + (interval_days || ' days')::INTERVAL;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark a rent schedule entry as paid
CREATE OR REPLACE FUNCTION mark_rent_paid(
  p_schedule_id UUID,
  p_payment_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE rent_schedules
  SET is_paid = TRUE, paid_at = NOW(), payment_id = p_payment_id
  WHERE id = p_schedule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
