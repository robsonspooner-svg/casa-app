-- Update financial_summary materialized view to include expenses
--
-- The original view (from 20240101000030_reports_analytics.sql) only aggregated
-- income data from the payments table. This migration drops and recreates the view
-- to also include:
--   - maintenance_expenses: from work_orders where status='completed' (final_amount)
--   - manual_expenses_total: from manual_expenses table
--   - total_expenses: sum of maintenance + manual expenses
--   - net_position: net_income minus total_expenses (true profit/loss)
--
-- Uses a CTE approach with UNION to collect all (owner_id, property_id, month)
-- combinations across payments, work_orders, and manual_expenses, then left-joins
-- each aggregated source to produce a single unified row per property per month.

-- ============================================================================
-- Drop existing materialized view and indexes
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS financial_summary;

-- ============================================================================
-- Recreate materialized view with expense columns
-- ============================================================================

CREATE MATERIALIZED VIEW financial_summary AS
WITH payment_data AS (
  SELECT
    p.owner_id,
    p.id AS property_id,
    p.address_line_1,
    DATE_TRUNC('month', pay.paid_at) AS month,
    SUM(CASE WHEN pay.payment_type = 'rent' AND pay.status = 'completed' THEN pay.amount ELSE 0 END) AS rent_collected,
    SUM(CASE WHEN pay.payment_type = 'bond' AND pay.status = 'completed' THEN pay.amount ELSE 0 END) AS bond_collected,
    SUM(CASE WHEN pay.payment_type NOT IN ('rent', 'bond') AND pay.status = 'completed' THEN pay.amount ELSE 0 END) AS other_income,
    SUM(COALESCE(pay.platform_fee, 0)) AS platform_fees,
    SUM(COALESCE(pay.stripe_fee, 0)) AS payment_processing_fees,
    SUM(COALESCE(pay.net_amount, 0)) AS net_income,
    COUNT(CASE WHEN pay.status = 'completed' THEN 1 END) AS completed_payments,
    COUNT(CASE WHEN pay.status = 'failed' THEN 1 END) AS failed_payments
  FROM properties p
  LEFT JOIN tenancies t ON t.property_id = p.id
  LEFT JOIN payments pay ON pay.tenancy_id = t.id AND pay.paid_at IS NOT NULL
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id, p.id, p.address_line_1, DATE_TRUNC('month', pay.paid_at)
),
work_order_expenses AS (
  SELECT
    p.owner_id,
    p.id AS property_id,
    DATE_TRUNC('month', wo.updated_at) AS month,
    SUM(COALESCE(wo.final_amount, 0)) AS maintenance_expenses
  FROM properties p
  JOIN work_orders wo ON wo.property_id = p.id AND wo.status = 'completed'
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id, p.id, DATE_TRUNC('month', wo.updated_at)
),
manual_expense_data AS (
  SELECT
    me.owner_id,
    me.property_id,
    DATE_TRUNC('month', me.expense_date::timestamp) AS month,
    SUM(me.amount) AS manual_expenses_total
  FROM manual_expenses me
  JOIN properties p ON p.id = me.property_id
  WHERE p.deleted_at IS NULL
  GROUP BY me.owner_id, me.property_id, DATE_TRUNC('month', me.expense_date::timestamp)
),
all_months AS (
  SELECT owner_id, property_id, month FROM payment_data WHERE month IS NOT NULL
  UNION
  SELECT owner_id, property_id, month FROM work_order_expenses WHERE month IS NOT NULL
  UNION
  SELECT owner_id, property_id, month FROM manual_expense_data WHERE month IS NOT NULL
)
SELECT
  am.owner_id,
  am.property_id,
  p.address_line_1,
  am.month,

  -- Income (from payments)
  COALESCE(pd.rent_collected, 0) AS rent_collected,
  COALESCE(pd.bond_collected, 0) AS bond_collected,
  COALESCE(pd.other_income, 0) AS other_income,

  -- Fees
  COALESCE(pd.platform_fees, 0) AS platform_fees,
  COALESCE(pd.payment_processing_fees, 0) AS payment_processing_fees,

  -- Net income from payments
  COALESCE(pd.net_income, 0) AS net_income,

  -- Payment counts
  COALESCE(pd.completed_payments, 0) AS completed_payments,
  COALESCE(pd.failed_payments, 0) AS failed_payments,

  -- Expenses
  COALESCE(woe.maintenance_expenses, 0) AS maintenance_expenses,
  COALESCE(med.manual_expenses_total, 0) AS manual_expenses_total,
  COALESCE(woe.maintenance_expenses, 0) + COALESCE(med.manual_expenses_total, 0) AS total_expenses,

  -- Net position (income minus expenses)
  COALESCE(pd.net_income, 0) - (COALESCE(woe.maintenance_expenses, 0) + COALESCE(med.manual_expenses_total, 0)) AS net_position

FROM all_months am
JOIN properties p ON p.id = am.property_id
LEFT JOIN payment_data pd
  ON pd.owner_id = am.owner_id
  AND pd.property_id = am.property_id
  AND pd.month = am.month
LEFT JOIN work_order_expenses woe
  ON woe.owner_id = am.owner_id
  AND woe.property_id = am.property_id
  AND woe.month = am.month
LEFT JOIN manual_expense_data med
  ON med.owner_id = am.owner_id
  AND med.property_id = am.property_id
  AND med.month = am.month;

-- ============================================================================
-- Recreate indexes
-- ============================================================================

CREATE UNIQUE INDEX idx_financial_summary_unique
  ON financial_summary(owner_id, property_id, month);

CREATE INDEX idx_financial_summary_owner
  ON financial_summary(owner_id);

CREATE INDEX idx_financial_summary_month
  ON financial_summary(month);
