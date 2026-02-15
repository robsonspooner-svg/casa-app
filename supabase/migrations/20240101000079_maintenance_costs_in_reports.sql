-- Include maintenance_requests.actual_cost in financial reporting
--
-- Previously, only work_orders.final_amount was counted as maintenance expenses
-- in the financial_summary materialized view and get_monthly_financials RPC.
-- Maintenance requests can have actual_cost set directly (without a work order),
-- e.g. when the owner pays a tradesperson outside the work order flow.
-- This migration adds those costs to both the materialized view and the RPC,
-- while avoiding double-counting requests that DO have a linked completed work order.

-- ============================================================================
-- Drop and recreate financial_summary materialized view
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS financial_summary;

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
-- Maintenance requests with actual_cost that do NOT have a linked completed work order
-- These are costs recorded directly on the maintenance request
maintenance_request_expenses AS (
  SELECT
    p.owner_id,
    p.id AS property_id,
    DATE_TRUNC('month', COALESCE(mr.actual_completion_date::timestamp, mr.updated_at)) AS month,
    SUM(mr.actual_cost) AS mr_expenses
  FROM properties p
  JOIN maintenance_requests mr ON mr.property_id = p.id
    AND mr.status = 'completed'
    AND mr.actual_cost IS NOT NULL
    AND mr.actual_cost > 0
  WHERE p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.maintenance_request_id = mr.id
      AND wo.status = 'completed'
    )
  GROUP BY p.owner_id, p.id, DATE_TRUNC('month', COALESCE(mr.actual_completion_date::timestamp, mr.updated_at))
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
  SELECT owner_id, property_id, month FROM maintenance_request_expenses WHERE month IS NOT NULL
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

  -- Expenses (work orders + unlinked maintenance requests)
  COALESCE(woe.maintenance_expenses, 0) + COALESCE(mre.mr_expenses, 0) AS maintenance_expenses,
  COALESCE(med.manual_expenses_total, 0) AS manual_expenses_total,
  COALESCE(woe.maintenance_expenses, 0) + COALESCE(mre.mr_expenses, 0) + COALESCE(med.manual_expenses_total, 0) AS total_expenses,

  -- Net position (income minus expenses)
  COALESCE(pd.net_income, 0) - (COALESCE(woe.maintenance_expenses, 0) + COALESCE(mre.mr_expenses, 0) + COALESCE(med.manual_expenses_total, 0)) AS net_position

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
LEFT JOIN maintenance_request_expenses mre
  ON mre.owner_id = am.owner_id
  AND mre.property_id = am.property_id
  AND mre.month = am.month
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

-- ============================================================================
-- Update get_monthly_financials to include maintenance_requests.actual_cost
-- ============================================================================

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

      -- Expenses (work orders + unlinked maintenance requests + manual)
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
          SELECT mr.actual_cost AS amount
          FROM maintenance_requests mr
          JOIN properties p ON p.id = mr.property_id
          WHERE p.owner_id = p_owner_id
          AND mr.status = 'completed'
          AND mr.actual_cost IS NOT NULL
          AND mr.actual_cost > 0
          AND COALESCE(mr.actual_completion_date::timestamp, mr.updated_at) >= gs.month
          AND COALESCE(mr.actual_completion_date::timestamp, mr.updated_at) < gs.month + INTERVAL '1 month'
          AND (p_property_id IS NULL OR mr.property_id = p_property_id)
          AND NOT EXISTS (
            SELECT 1 FROM work_orders wo2
            WHERE wo2.maintenance_request_id = mr.id
            AND wo2.status = 'completed'
          )
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
      DATE_TRUNC('month', NOW()) - (p_months - 1) * INTERVAL '1 month',
      DATE_TRUNC('month', NOW()),
      '1 month'::interval
    ) AS gs(month)
    ORDER BY gs.month
  ) m;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
