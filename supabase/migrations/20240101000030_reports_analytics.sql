-- Mission 13: Reports & Analytics Dashboard
-- Creates materialized views, report generation tables, portfolio summary functions,
-- RLS policies, indexes, and scheduled report infrastructure.

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE report_type AS ENUM (
  'financial_summary',
  'cash_flow',
  'tax_summary',
  'property_performance',
  'maintenance_summary',
  'tenant_history'
);

CREATE TYPE report_format AS ENUM (
  'pdf',
  'csv',
  'xlsx'
);

CREATE TYPE report_status AS ENUM (
  'generating',
  'completed',
  'failed'
);

CREATE TYPE report_frequency AS ENUM (
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
);

-- ============================================================================
-- Materialized Views
-- ============================================================================

-- Financial summary: aggregates income and expenses per property per month
CREATE MATERIALIZED VIEW financial_summary AS
SELECT
  p.owner_id,
  p.id AS property_id,
  p.address_line_1,
  DATE_TRUNC('month', pay.paid_at) AS month,

  -- Income
  SUM(CASE WHEN pay.payment_type = 'rent' AND pay.status = 'completed' THEN pay.amount ELSE 0 END) AS rent_collected,
  SUM(CASE WHEN pay.payment_type = 'bond' AND pay.status = 'completed' THEN pay.amount ELSE 0 END) AS bond_collected,
  SUM(CASE WHEN pay.payment_type NOT IN ('rent', 'bond') AND pay.status = 'completed' THEN pay.amount ELSE 0 END) AS other_income,

  -- Fees
  SUM(COALESCE(pay.platform_fee, 0)) AS platform_fees,
  SUM(COALESCE(pay.stripe_fee, 0)) AS payment_processing_fees,

  -- Net amounts
  SUM(COALESCE(pay.net_amount, 0)) AS net_income,

  -- Payment counts
  COUNT(CASE WHEN pay.status = 'completed' THEN 1 END) AS completed_payments,
  COUNT(CASE WHEN pay.status = 'failed' THEN 1 END) AS failed_payments

FROM properties p
LEFT JOIN tenancies t ON t.property_id = p.id
LEFT JOIN payments pay ON pay.tenancy_id = t.id AND pay.paid_at IS NOT NULL
WHERE p.deleted_at IS NULL
GROUP BY p.owner_id, p.id, p.address_line_1, DATE_TRUNC('month', pay.paid_at);

CREATE UNIQUE INDEX idx_financial_summary_unique
  ON financial_summary(owner_id, property_id, month);

CREATE INDEX idx_financial_summary_owner
  ON financial_summary(owner_id);

CREATE INDEX idx_financial_summary_month
  ON financial_summary(month);

-- Property metrics: current state snapshot per property
CREATE MATERIALIZED VIEW property_metrics AS
SELECT
  p.id AS property_id,
  p.owner_id,
  p.address_line_1,
  p.suburb,
  p.state,
  p.property_type::text AS property_type,
  p.bedrooms,
  p.rent_amount AS listed_rent,
  p.rent_frequency::text AS rent_frequency,

  -- Vacancy status
  CASE WHEN t.id IS NOT NULL AND t.status = 'active' THEN FALSE ELSE TRUE END AS is_vacant,

  -- Current tenancy info
  t.id AS current_tenancy_id,
  t.lease_start_date,
  t.lease_end_date,
  t.rent_amount AS current_rent,

  -- Days until lease expiry
  CASE
    WHEN t.lease_end_date IS NOT NULL AND t.status = 'active'
    THEN (t.lease_end_date - CURRENT_DATE)
    ELSE NULL
  END AS days_until_lease_expiry,

  -- Maintenance stats (12 months)
  (
    SELECT COUNT(*)
    FROM maintenance_requests mr
    WHERE mr.property_id = p.id
    AND mr.created_at > NOW() - INTERVAL '12 months'
  ) AS maintenance_requests_12m,

  (
    SELECT COUNT(*)
    FROM maintenance_requests mr
    WHERE mr.property_id = p.id
    AND mr.status NOT IN ('completed', 'cancelled')
  ) AS open_maintenance_requests,

  -- Maintenance costs (12 months from work orders)
  (
    SELECT COALESCE(SUM(wo.final_amount), 0)
    FROM work_orders wo
    WHERE wo.property_id = p.id
    AND wo.status = 'completed'
    AND wo.updated_at > NOW() - INTERVAL '12 months'
  ) AS maintenance_cost_12m,

  -- Payment stats (12 months)
  (
    SELECT COUNT(*)
    FROM payments pay
    JOIN tenancies ten ON ten.id = pay.tenancy_id
    WHERE ten.property_id = p.id
    AND pay.status = 'completed'
    AND pay.paid_at > NOW() - INTERVAL '12 months'
  ) AS payments_received_12m,

  (
    SELECT COALESCE(SUM(pay.amount), 0)
    FROM payments pay
    JOIN tenancies ten ON ten.id = pay.tenancy_id
    WHERE ten.property_id = p.id
    AND pay.status = 'completed'
    AND pay.paid_at > NOW() - INTERVAL '12 months'
  ) AS total_income_12m,

  -- Current arrears
  (
    SELECT COALESCE(ar.total_overdue, 0)
    FROM arrears_records ar
    WHERE ar.tenancy_id = t.id
    AND NOT ar.is_resolved
    LIMIT 1
  ) AS current_arrears,

  -- Inspection status
  (
    SELECT i.scheduled_date
    FROM inspections i
    WHERE i.property_id = p.id
    AND i.status NOT IN ('completed', 'cancelled')
    ORDER BY i.scheduled_date ASC
    LIMIT 1
  ) AS next_inspection_date

FROM properties p
LEFT JOIN tenancies t ON t.property_id = p.id AND t.status = 'active'
WHERE p.deleted_at IS NULL;

CREATE UNIQUE INDEX idx_property_metrics_unique
  ON property_metrics(property_id);

CREATE INDEX idx_property_metrics_owner
  ON property_metrics(owner_id);

-- ============================================================================
-- Tables
-- ============================================================================

-- Owner-defined expense categories for manual expense entries
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_tax_deductible BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manual expenses (insurance, rates, strata, etc. - not captured from work orders/payments)
CREATE TABLE manual_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,

  -- Expense details
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
  receipt_url TEXT,

  -- Tax info
  is_tax_deductible BOOLEAN NOT NULL DEFAULT TRUE,
  tax_category TEXT, -- e.g. 'insurance', 'council_rates', 'strata', 'repairs', 'interest', 'depreciation'

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated reports
CREATE TABLE generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Report details
  report_type report_type NOT NULL,
  title TEXT NOT NULL,

  -- Parameters
  property_ids UUID[], -- NULL means all properties
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,

  -- Output
  format report_format NOT NULL DEFAULT 'pdf',
  storage_path TEXT,
  file_url TEXT,
  file_size_bytes INTEGER,

  -- Status
  status report_status NOT NULL DEFAULT 'generating',
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Report config
  report_type report_type NOT NULL,
  title TEXT NOT NULL,
  property_ids UUID[],

  -- Schedule
  frequency report_frequency NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 28),

  -- Delivery
  email_to TEXT[] NOT NULL,
  format report_format NOT NULL DEFAULT 'pdf',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_expense_categories_owner ON expense_categories(owner_id);
CREATE INDEX idx_manual_expenses_owner ON manual_expenses(owner_id, expense_date DESC);
CREATE INDEX idx_manual_expenses_property ON manual_expenses(property_id, expense_date DESC);
CREATE INDEX idx_manual_expenses_tax ON manual_expenses(owner_id, is_tax_deductible, expense_date) WHERE is_tax_deductible;
CREATE INDEX idx_generated_reports_owner ON generated_reports(owner_id, created_at DESC);
CREATE INDEX idx_generated_reports_status ON generated_reports(status) WHERE status = 'generating';
CREATE INDEX idx_generated_reports_expiry ON generated_reports(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_scheduled_reports_owner ON scheduled_reports(owner_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own expense categories"
  ON expense_categories FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners manage own manual expenses"
  ON manual_expenses FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners manage own generated reports"
  ON generated_reports FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners manage own scheduled reports"
  ON scheduled_reports FOR ALL
  USING (auth.uid() = owner_id);

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER manual_expenses_updated_at
  BEFORE UPDATE ON manual_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Functions
-- ============================================================================

-- Portfolio summary: high-level stats for the owner dashboard
CREATE OR REPLACE FUNCTION get_portfolio_summary(p_owner_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_properties', (
      SELECT COUNT(*) FROM properties WHERE owner_id = p_owner_id AND deleted_at IS NULL
    ),
    'occupied_properties', (
      SELECT COUNT(DISTINCT p.id) FROM properties p
      JOIN tenancies t ON t.property_id = p.id AND t.status = 'active'
      WHERE p.owner_id = p_owner_id AND p.deleted_at IS NULL
    ),
    'vacant_properties', (
      SELECT COUNT(*) FROM properties p
      WHERE p.owner_id = p_owner_id AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM tenancies t WHERE t.property_id = p.id AND t.status = 'active'
      )
    ),
    'total_monthly_rent', (
      SELECT COALESCE(SUM(
        CASE t.rent_frequency
          WHEN 'weekly' THEN t.rent_amount * 52 / 12
          WHEN 'fortnightly' THEN t.rent_amount * 26 / 12
          WHEN 'monthly' THEN t.rent_amount
          ELSE t.rent_amount
        END
      ), 0)
      FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id AND t.status = 'active' AND p.deleted_at IS NULL
    ),
    'total_arrears', (
      SELECT COALESCE(SUM(ar.total_overdue), 0)
      FROM arrears_records ar
      JOIN tenancies t ON t.id = ar.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id AND NOT ar.is_resolved
    ),
    'open_maintenance', (
      SELECT COUNT(*)
      FROM maintenance_requests mr
      JOIN properties p ON p.id = mr.property_id
      WHERE p.owner_id = p_owner_id
      AND mr.status NOT IN ('completed', 'cancelled')
    ),
    'leases_expiring_30d', (
      SELECT COUNT(*)
      FROM tenancies t
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      AND t.status = 'active'
      AND t.lease_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    ),
    'rent_collected_this_month', (
      SELECT COALESCE(SUM(pay.amount), 0)
      FROM payments pay
      JOIN tenancies t ON t.id = pay.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      AND pay.payment_type = 'rent'
      AND pay.status = 'completed'
      AND pay.paid_at >= DATE_TRUNC('month', CURRENT_DATE)
    ),
    'expenses_this_month', (
      SELECT COALESCE(SUM(amount), 0)
      FROM (
        -- Work order costs
        SELECT wo.final_amount AS amount
        FROM work_orders wo
        WHERE wo.owner_id = p_owner_id
        AND wo.status = 'completed'
        AND wo.updated_at >= DATE_TRUNC('month', CURRENT_DATE)
        UNION ALL
        -- Manual expenses
        SELECT me.amount
        FROM manual_expenses me
        WHERE me.owner_id = p_owner_id
        AND me.expense_date >= DATE_TRUNC('month', CURRENT_DATE)
        UNION ALL
        -- Platform fees
        SELECT pay.platform_fee AS amount
        FROM payments pay
        JOIN tenancies t ON t.id = pay.tenancy_id
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = p_owner_id
        AND pay.platform_fee IS NOT NULL AND pay.platform_fee > 0
        AND pay.paid_at >= DATE_TRUNC('month', CURRENT_DATE)
      ) expenses
    ),
    'collection_rate', (
      SELECT CASE
        WHEN total_due = 0 THEN 100.0
        ELSE ROUND((total_paid::numeric / total_due::numeric) * 100, 1)
      END
      FROM (
        SELECT
          COUNT(*) AS total_due,
          COUNT(*) FILTER (WHERE rs.is_paid) AS total_paid
        FROM rent_schedules rs
        JOIN tenancies t ON t.id = rs.tenancy_id
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = p_owner_id
        AND rs.due_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND rs.due_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      ) rates
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly financial breakdown for charts
CREATE OR REPLACE FUNCTION get_monthly_financials(
  p_owner_id UUID,
  p_months INTEGER DEFAULT 6,
  p_property_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(m)) INTO result
  FROM (
    SELECT
      to_char(gs.month, 'YYYY-MM') AS month_label,
      to_char(gs.month, 'Mon') AS month_short,
      EXTRACT(YEAR FROM gs.month)::integer AS year,
      EXTRACT(MONTH FROM gs.month)::integer AS month_num,

      -- Income from payments
      COALESCE((
        SELECT SUM(pay.amount)
        FROM payments pay
        JOIN tenancies t ON t.id = pay.tenancy_id
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = p_owner_id
        AND pay.status = 'completed'
        AND pay.payment_type = 'rent'
        AND pay.paid_at >= gs.month
        AND pay.paid_at < gs.month + INTERVAL '1 month'
        AND (p_property_id IS NULL OR p.id = p_property_id)
      ), 0) AS income,

      -- Expenses (work orders + manual)
      COALESCE((
        SELECT SUM(amount)
        FROM (
          SELECT wo.final_amount AS amount
          FROM work_orders wo
          WHERE wo.owner_id = p_owner_id
          AND wo.status = 'completed'
          AND wo.updated_at >= gs.month
          AND wo.updated_at < gs.month + INTERVAL '1 month'
          AND (p_property_id IS NULL OR wo.property_id = p_property_id)
          UNION ALL
          SELECT me.amount
          FROM manual_expenses me
          WHERE me.owner_id = p_owner_id
          AND me.expense_date >= gs.month
          AND me.expense_date < gs.month + INTERVAL '1 month'
          AND (p_property_id IS NULL OR me.property_id = p_property_id)
        ) exp
      ), 0) AS expenses,

      -- Fees
      COALESCE((
        SELECT SUM(COALESCE(pay.platform_fee, 0) + COALESCE(pay.stripe_fee, 0))
        FROM payments pay
        JOIN tenancies t ON t.id = pay.tenancy_id
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = p_owner_id
        AND pay.status = 'completed'
        AND pay.paid_at >= gs.month
        AND pay.paid_at < gs.month + INTERVAL '1 month'
        AND (p_property_id IS NULL OR p.id = p_property_id)
      ), 0) AS fees

    FROM generate_series(
      DATE_TRUNC('month', CURRENT_DATE - (p_months || ' months')::INTERVAL),
      DATE_TRUNC('month', CURRENT_DATE),
      '1 month'::INTERVAL
    ) AS gs(month)
    ORDER BY gs.month ASC
  ) m;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tax summary for Australian financial year (July-June)
CREATE OR REPLACE FUNCTION get_tax_summary(
  p_owner_id UUID,
  p_financial_year INTEGER DEFAULT NULL -- e.g. 2025 means FY 2024-25 (July 2024 - June 2025)
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  fy_start DATE;
  fy_end DATE;
BEGIN
  -- Default to current financial year
  IF p_financial_year IS NULL THEN
    IF EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN
      p_financial_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1;
    ELSE
      p_financial_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    END IF;
  END IF;

  fy_start := make_date(p_financial_year - 1, 7, 1);
  fy_end := make_date(p_financial_year, 6, 30);

  SELECT json_build_object(
    'financial_year', p_financial_year,
    'period_start', fy_start,
    'period_end', fy_end,

    'rental_income', (
      SELECT COALESCE(SUM(pay.amount), 0)
      FROM payments pay
      JOIN tenancies t ON t.id = pay.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      AND pay.payment_type = 'rent'
      AND pay.status = 'completed'
      AND pay.paid_at::date BETWEEN fy_start AND fy_end
    ),

    'bond_income', (
      SELECT COALESCE(SUM(pay.amount), 0)
      FROM payments pay
      JOIN tenancies t ON t.id = pay.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      AND pay.payment_type = 'bond'
      AND pay.status = 'completed'
      AND pay.paid_at::date BETWEEN fy_start AND fy_end
    ),

    'other_income', (
      SELECT COALESCE(SUM(pay.amount), 0)
      FROM payments pay
      JOIN tenancies t ON t.id = pay.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      AND pay.payment_type NOT IN ('rent', 'bond')
      AND pay.status = 'completed'
      AND pay.paid_at::date BETWEEN fy_start AND fy_end
    ),

    'maintenance_expenses', (
      SELECT COALESCE(SUM(wo.final_amount), 0)
      FROM work_orders wo
      WHERE wo.owner_id = p_owner_id
      AND wo.status = 'completed'
      AND wo.updated_at::date BETWEEN fy_start AND fy_end
    ),

    'manual_expenses_total', (
      SELECT COALESCE(SUM(me.amount), 0)
      FROM manual_expenses me
      WHERE me.owner_id = p_owner_id
      AND me.expense_date BETWEEN fy_start AND fy_end
    ),

    'tax_deductible_expenses', (
      SELECT COALESCE(SUM(me.amount), 0)
      FROM manual_expenses me
      WHERE me.owner_id = p_owner_id
      AND me.is_tax_deductible
      AND me.expense_date BETWEEN fy_start AND fy_end
    ),

    'platform_fees', (
      SELECT COALESCE(SUM(pay.platform_fee), 0)
      FROM payments pay
      JOIN tenancies t ON t.id = pay.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      AND pay.platform_fee IS NOT NULL
      AND pay.paid_at::date BETWEEN fy_start AND fy_end
    ),

    'processing_fees', (
      SELECT COALESCE(SUM(pay.stripe_fee), 0)
      FROM payments pay
      JOIN tenancies t ON t.id = pay.tenancy_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      AND pay.stripe_fee IS NOT NULL
      AND pay.paid_at::date BETWEEN fy_start AND fy_end
    ),

    'expense_breakdown_by_category', (
      SELECT COALESCE(json_agg(json_build_object(
        'category', tax_category,
        'total', total
      )), '[]'::json)
      FROM (
        SELECT
          COALESCE(me.tax_category, 'other') AS tax_category,
          SUM(me.amount) AS total
        FROM manual_expenses me
        WHERE me.owner_id = p_owner_id
        AND me.expense_date BETWEEN fy_start AND fy_end
        GROUP BY COALESCE(me.tax_category, 'other')
        ORDER BY total DESC
      ) cats
    ),

    'per_property', (
      SELECT COALESCE(json_agg(json_build_object(
        'property_id', p.id,
        'address', p.address_line_1,
        'rental_income', COALESCE(income.total, 0),
        'expenses', COALESCE(exp.total, 0),
        'net_income', COALESCE(income.total, 0) - COALESCE(exp.total, 0)
      )), '[]'::json)
      FROM properties p
      LEFT JOIN (
        SELECT t.property_id, SUM(pay.amount) AS total
        FROM payments pay
        JOIN tenancies t ON t.id = pay.tenancy_id
        WHERE pay.status = 'completed' AND pay.paid_at::date BETWEEN fy_start AND fy_end
        GROUP BY t.property_id
      ) income ON income.property_id = p.id
      LEFT JOIN (
        SELECT me.property_id, SUM(me.amount) AS total
        FROM manual_expenses me
        WHERE me.expense_date BETWEEN fy_start AND fy_end
        GROUP BY me.property_id
      ) exp ON exp.property_id = p.id
      WHERE p.owner_id = p_owner_id AND p.deleted_at IS NULL
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh materialized views function
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY financial_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY property_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Default expense categories
-- ============================================================================

-- These are common Australian property expense categories (inserted per-owner via app)
-- No global defaults needed - owners create their own categories

-- ============================================================================
-- Storage bucket for report files
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners can access own report files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can upload reports"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reports' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own report files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
