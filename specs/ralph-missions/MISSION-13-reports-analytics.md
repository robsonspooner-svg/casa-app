# Mission 13: Reports & Analytics Dashboard

## Overview
**Goal**: Provide owners with comprehensive reports and analytics about their property portfolio.
**Dependencies**: Mission 07 (Payments), Mission 08 (Arrears), Mission 09 (Maintenance)
**Estimated Complexity**: Medium

## Success Criteria

### Phase A: Database Schema
- [ ] Create analytics materialized views
- [ ] Create report generation tables
- [ ] Set up scheduled refresh jobs

### Phase B: Dashboard Overview (Owner App)
- [ ] Create DashboardScreen
- [ ] Portfolio summary cards
- [ ] Key metrics at a glance
- [ ] Quick action shortcuts
- [ ] Alerts and notifications

### Phase C: Financial Reports
- [ ] Income summary (by property, period)
- [ ] Expense tracking
- [ ] Cash flow statement
- [ ] Rent collection rate
- [ ] Arrears summary
- [ ] Tax year summary

### Phase D: Property Reports
- [ ] Vacancy rate
- [ ] Average tenancy length
- [ ] Maintenance costs per property
- [ ] ROI calculations
- [ ] Property valuation tracking

### Phase E: Charts & Visualizations
- [ ] Income vs expenses chart
- [ ] Monthly cash flow trend
- [ ] Occupancy rate over time
- [ ] Maintenance category breakdown
- [ ] Payment timing distribution

### Phase F: Report Generation
- [ ] Generate PDF reports
- [ ] Schedule recurring reports
- [ ] Email reports automatically
- [ ] Export to CSV/Excel

### Phase G: Tenant Analytics (Owner View)
- [ ] Payment history patterns
- [ ] Maintenance request frequency
- [ ] Communication responsiveness
- [ ] Tenancy duration

### Phase H: Testing
- [ ] Unit tests for calculation functions
- [ ] Integration tests for report generation
- [ ] E2E test: View dashboard → Generate report → Export

## Database Schema

```sql
-- Financial summary view (materialized for performance)
CREATE MATERIALIZED VIEW financial_summary AS
SELECT
  p.owner_id,
  p.id AS property_id,
  p.address_line_1,
  DATE_TRUNC('month', pay.paid_at) AS month,

  -- Income
  SUM(CASE WHEN pay.payment_type = 'rent' AND pay.status = 'completed' THEN pay.amount ELSE 0 END) AS rent_collected,
  SUM(CASE WHEN pay.payment_type = 'bond' AND pay.status = 'completed' THEN pay.amount ELSE 0 END) AS bond_collected,

  -- Expenses (from work orders)
  SUM(COALESCE(wo.actual_cost, 0)) AS maintenance_costs,

  -- Fees
  SUM(COALESCE(pay.platform_fee, 0)) AS platform_fees,
  SUM(COALESCE(pay.stripe_fee, 0)) AS payment_fees

FROM properties p
LEFT JOIN tenancies t ON t.property_id = p.id
LEFT JOIN payments pay ON pay.tenancy_id = t.id
LEFT JOIN work_orders wo ON wo.property_id = p.id AND wo.status = 'completed'
  AND DATE_TRUNC('month', wo.updated_at) = DATE_TRUNC('month', pay.paid_at)
WHERE p.deleted_at IS NULL
GROUP BY p.owner_id, p.id, p.address_line_1, DATE_TRUNC('month', pay.paid_at);

CREATE UNIQUE INDEX idx_financial_summary ON financial_summary(owner_id, property_id, month);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_financial_summary()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY financial_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Property metrics view
CREATE MATERIALIZED VIEW property_metrics AS
SELECT
  p.id AS property_id,
  p.owner_id,

  -- Vacancy
  CASE WHEN t.status = 'active' THEN FALSE ELSE TRUE END AS is_vacant,

  -- Current tenancy
  t.id AS current_tenancy_id,
  t.lease_start_date,
  t.lease_end_date,
  t.rent_amount,

  -- Maintenance stats
  (
    SELECT COUNT(*)
    FROM maintenance_requests mr
    WHERE mr.property_id = p.id
    AND mr.created_at > NOW() - INTERVAL '12 months'
  ) AS maintenance_requests_12m,

  (
    SELECT COALESCE(SUM(wo.actual_cost), 0)
    FROM work_orders wo
    WHERE wo.property_id = p.id
    AND wo.status = 'completed'
    AND wo.updated_at > NOW() - INTERVAL '12 months'
  ) AS maintenance_cost_12m,

  -- Payment stats
  (
    SELECT COUNT(*)
    FROM payments pay
    JOIN tenancies ten ON ten.id = pay.tenancy_id
    WHERE ten.property_id = p.id
    AND pay.status = 'completed'
    AND pay.paid_at > NOW() - INTERVAL '12 months'
  ) AS payments_received_12m,

  -- Arrears
  (
    SELECT COALESCE(ar.total_overdue, 0)
    FROM arrears_records ar
    WHERE ar.tenancy_id = t.id
    AND NOT ar.is_resolved
  ) AS current_arrears

FROM properties p
LEFT JOIN tenancies t ON t.property_id = p.id AND t.status = 'active'
WHERE p.deleted_at IS NULL;

CREATE UNIQUE INDEX idx_property_metrics ON property_metrics(property_id);

-- Generated reports tracking
CREATE TABLE generated_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Report details
  report_type TEXT NOT NULL CHECK (report_type IN (
    'financial_summary',
    'cash_flow',
    'tax_summary',
    'property_performance',
    'maintenance_summary',
    'tenant_history'
  )),
  title TEXT NOT NULL,

  -- Parameters
  property_ids UUID[], -- NULL for all properties
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,

  -- Output
  format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'xlsx')),
  storage_path TEXT,
  url TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ -- Auto-delete after X days
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Report config
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  property_ids UUID[],

  -- Schedule
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  day_of_week INTEGER, -- For weekly (1-7)
  day_of_month INTEGER, -- For monthly

  -- Delivery
  email_to TEXT[] NOT NULL,
  format TEXT NOT NULL DEFAULT 'pdf',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolio summary function
CREATE OR REPLACE FUNCTION get_portfolio_summary(p_owner_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_properties', (SELECT COUNT(*) FROM properties WHERE owner_id = p_owner_id AND deleted_at IS NULL),
    'occupied_properties', (SELECT COUNT(*) FROM property_metrics WHERE owner_id = p_owner_id AND NOT is_vacant),
    'vacant_properties', (SELECT COUNT(*) FROM property_metrics WHERE owner_id = p_owner_id AND is_vacant),
    'total_monthly_rent', (SELECT COALESCE(SUM(rent_amount), 0) FROM property_metrics WHERE owner_id = p_owner_id AND NOT is_vacant),
    'total_arrears', (SELECT COALESCE(SUM(current_arrears), 0) FROM property_metrics WHERE owner_id = p_owner_id),
    'maintenance_requests_open', (
      SELECT COUNT(*) FROM maintenance_requests mr
      JOIN properties p ON p.id = mr.property_id
      WHERE p.owner_id = p_owner_id
      AND mr.status NOT IN ('completed', 'cancelled')
    ),
    'rent_collected_this_month', (
      SELECT COALESCE(SUM(rent_collected), 0)
      FROM financial_summary
      WHERE owner_id = p_owner_id
      AND month = DATE_TRUNC('month', CURRENT_DATE)
    ),
    'expenses_this_month', (
      SELECT COALESCE(SUM(maintenance_costs + platform_fees + payment_fees), 0)
      FROM financial_summary
      WHERE owner_id = p_owner_id
      AND month = DATE_TRUNC('month', CURRENT_DATE)
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes
CREATE INDEX idx_generated_reports_owner ON generated_reports(owner_id, created_at DESC);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active;

-- RLS Policies
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own reports"
  ON generated_reports FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can manage own scheduled reports"
  ON scheduled_reports FOR ALL
  USING (auth.uid() = owner_id);

-- Refresh materialized views periodically (via pg_cron or edge function)
-- CALL refresh_financial_summary();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── analytics.ts            # Dashboard queries
│   ├── financials.ts           # Financial reports
│   └── reports.ts              # Report generation
├── hooks/
│   ├── useDashboard.ts         # Dashboard data
│   ├── useFinancials.ts        # Financial data
│   ├── usePropertyMetrics.ts   # Property stats
│   └── useReports.ts           # Report management
└── services/
    └── reportGenerator.ts      # Generate PDF/CSV

packages/pdf/src/templates/
├── financialSummary.ts         # Financial report
├── cashFlow.ts                 # Cash flow report
├── taxSummary.ts               # Tax year report
└── propertyPerformance.ts      # Property report
```

### Owner App
```
apps/owner/app/(app)/
├── (tabs)/
│   └── index.tsx               # Dashboard (update)
├── reports/
│   ├── index.tsx               # Reports hub
│   ├── financial.tsx           # Financial reports
│   ├── properties.tsx          # Property reports
│   ├── generate.tsx            # Generate custom report
│   └── scheduled.tsx           # Manage scheduled reports
├── analytics/
│   ├── income.tsx              # Income analytics
│   ├── expenses.tsx            # Expense analytics
│   └── occupancy.tsx           # Occupancy analytics

apps/owner/components/
├── DashboardCard.tsx           # Summary card
├── MetricTile.tsx              # Single metric display
├── TrendIndicator.tsx          # Up/down trend
├── IncomeChart.tsx             # Income visualization
├── ExpenseChart.tsx            # Expense breakdown
├── OccupancyChart.tsx          # Occupancy over time
├── PropertyTable.tsx           # Property metrics table
├── ReportCard.tsx              # Generated report item
└── ScheduleReportForm.tsx      # Schedule setup
```

### Charts Package
```
packages/charts/                # New package
├── package.json
├── src/
│   ├── index.ts
│   ├── LineChart.tsx           # Time series
│   ├── BarChart.tsx            # Comparison
│   ├── PieChart.tsx            # Distribution
│   ├── AreaChart.tsx           # Stacked areas
│   └── theme.ts                # Chart theming

# Using victory-native or react-native-chart-kit
```

## Dashboard Layout

```
┌─────────────────────────────────────────┐
│ Portfolio Overview                       │
├──────────┬──────────┬──────────┬────────┤
│ 12       │ 10       │ 2        │ $45,200│
│ Properties│ Occupied │ Vacant   │ Monthly│
├──────────┴──────────┴──────────┴────────┤
│                                          │
│ Cash Flow This Month                     │
│ ┌──────────────────────────────────────┐ │
│ │ Income: $42,500  Expenses: $3,200    │ │
│ │ Net: $39,300                         │ │
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│ Attention Needed                         │
│ • 2 tenants in arrears ($1,450 total)   │
│ • 3 maintenance requests pending         │
│ • 1 lease expiring in 30 days           │
├──────────────────────────────────────────┤
│ Income Trend (6 months)                  │
│ [Line chart]                             │
└──────────────────────────────────────────┘
```

## Report Types

### Financial Summary
- Total income by category
- Total expenses by category
- Net income
- Property-by-property breakdown

### Cash Flow Statement
- Period-over-period comparison
- Income sources breakdown
- Expense categories
- Net cash position

### Tax Summary (Financial Year)
- Rental income
- Deductible expenses
- Depreciation schedules
- Capital gains (if applicable)

### Property Performance
- Individual property ROI
- Maintenance cost ratio
- Vacancy days
- Rent yield

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(analytics): <description>

Mission-13: Reports & Analytics
```

### Phase I: Agent Integration

The Casa agent uses financial data for proactive management. These agent tools must be implemented:

| Name | Category | Autonomy | Description |
|------|----------|----------|-------------|
| `get_financial_summary` | query | L4 Autonomous | Fetch materialized financial summary for owner's properties |
| `get_property_metrics` | query | L4 Autonomous | Fetch property performance metrics |
| `generate_income_report` | generate | L2 Draft | Generate income report for a period |
| `generate_tax_summary` | generate | L2 Draft | Generate annual tax summary (ATO format) |
| `generate_portfolio_report` | generate | L2 Draft | Multi-property analysis with yield, vacancy, forecasting |
| `generate_cash_flow_forecast` | generate | L2 Draft | 3/6/12 month cash flow projection |

**Proactive Financial Management:**
- Heartbeat scanner: Monthly financial report auto-generation (1st of each month)
- Agent surfaces expense anomalies (e.g., "Maintenance costs for 42 Oak St are 3x higher than your other properties this quarter")
- Agent proactively generates tax summary at end of financial year (30 June)
- Agent alerts owner when rental yield drops below market average
- Agent suggests rent increase when market data supports it (using `suggest_rent_price` tool from Mission 04)

### Phase J: ATO Tax Categorisation

Every expense must be categorised per ATO rules for the annual tax summary:

```typescript
export const ATO_EXPENSE_CATEGORIES = {
  deductible: {
    interest: 'Loan interest',
    council_rates: 'Council rates',
    water_rates: 'Water rates',
    body_corporate: 'Body corporate fees',
    insurance: 'Landlord insurance',
    property_management_fees: 'Property management fees (Casa subscription)',
    repairs_maintenance: 'Repairs and maintenance',
    pest_control: 'Pest control',
    gardening: 'Gardening and lawn mowing',
    cleaning: 'Cleaning',
    advertising: 'Advertising for tenants',
    legal_fees: 'Legal expenses',
    stationery: 'Stationery and postage',
    travel: 'Travel to property for inspections/maintenance',
    bank_charges: 'Bank charges',
  },
  depreciable: {
    capital_works: 'Capital works deductions (Div 43)',
    plant_equipment: 'Plant and equipment (Div 40)',
    // Examples: hot water system, air conditioning, carpet, blinds
  },
  not_deductible: {
    capital_improvements: 'Capital improvements (added to cost base)',
    personal_use: 'Personal use portion',
    acquisition_costs: 'Purchase costs (stamp duty, legal)',
  },
} as const;
```

The tax summary PDF must include:
- Total rental income per property
- Deductible expenses categorised per ATO schedule
- Depreciation schedule (if depreciation report uploaded)
- Net rental income/loss
- Capital gains events (if property sold)
- Ready for import to tax return software or handoff to accountant
- CSV export format compatible with myTax, Xero, MYOB

### Phase K: Expense Tracking System

Every financial transaction flows through:

1. **Automatic tracking**: Rent payments (from Mission 07), work order costs (from Mission 10), subscription fees
2. **Manual entry**: Owner-entered expenses (insurance, rates, body corporate, loan interest)
3. **Receipt capture**: Photo/PDF upload linked to expense entry
4. **Categorisation**: Auto-suggest category based on description/vendor, owner confirms

```sql
-- Expense tracking table (if not already in Mission 07)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Expense details
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL, -- From ATO_EXPENSE_CATEGORIES
  subcategory TEXT,

  -- Source
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'work_order', 'subscription', 'auto_import'
  source_id UUID, -- Reference to work_order, payment, etc.

  -- Tax
  is_deductible BOOLEAN NOT NULL DEFAULT TRUE,
  gst_included BOOLEAN NOT NULL DEFAULT FALSE,
  gst_amount DECIMAL(10,2),

  -- Receipt
  receipt_url TEXT,
  receipt_storage_path TEXT,

  -- Recurrence
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT, -- iCal RRULE

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_owner ON expenses(owner_id, expense_date DESC);
CREATE INDEX idx_expenses_property ON expenses(property_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own expenses"
  ON expenses FOR ALL
  USING (auth.uid() = owner_id);
```

**Expense Entry UI:**
- Quick-add form: amount, description, property, category (with auto-suggest), date
- Receipt capture via camera
- Recurring expense setup (e.g., monthly insurance, quarterly rates)
- Bulk import from CSV (bank statement)

**Auto-Expense Creation:**
- When a work order is completed → expense auto-created with category 'repairs_maintenance'
- When subscription renews → expense auto-created with category 'property_management_fees'
- Agent can create expenses when it processes invoices from tradespeople

### Phase L: Cash Flow Forecasting

```typescript
interface CashFlowForecast {
  // Projects forward 3, 6, or 12 months
  projectionMonths: 3 | 6 | 12;

  monthly: Array<{
    month: string; // 'Jan 2026'
    projectedIncome: number; // Based on current rent amounts
    projectedExpenses: number; // Based on recurring expenses + historical average
    netCashFlow: number;
    cumulativeCashFlow: number;
  }>;

  assumptions: {
    occupancyRate: number; // Based on current tenancy status
    expenseGrowthRate: number; // CPI-adjusted
    rentIncreasePending: boolean; // If rent increase notice sent
  };

  risks: Array<{
    description: string; // "Lease for 42 Oak St expires in 4 months"
    impact: number; // Dollar impact
    likelihood: 'low' | 'medium' | 'high';
  }>;
}
```

The agent uses this for proactive advice: "Based on your current expenses and lease expiry at 42 Oak St, your projected cash flow will turn negative in 6 months. Consider finding a tenant now or adjusting rent."

## Notes
- Materialized views for performance on large datasets
- Refresh views on schedule (not real-time)
- Reports expire after 30 days to save storage
- Tax summary aligns with Australian financial year (July-June)
- Consider integration with accounting software (Xero, MYOB) in future
- Charts should be accessible (color-blind friendly)
- Export formats: PDF for sharing, CSV/Excel for analysis
- Expenses must be tracked per-property for accurate tax reporting
- ATO compliance is non-negotiable — every dollar must be categorised correctly
- Cash flow forecasting is a premium feature (Pro/Hands-Off tiers)
- Receipt capture allows owners to photo-scan paper receipts
- Consider integration with Xero/MYOB for accounting software sync (P3 future enhancement)
- Agent generates monthly financial digest: "Here's your October summary: $X income, $Y expenses, $Z net. Top expense: maintenance at 42 Oak St ($X)."
- Financial year runs July 1 to June 30 in Australia

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] Analytics materialized views created and refreshing on schedule
- [ ] Report generation tables created with correct RLS
- [ ] Scheduled refresh jobs configured and running
- [ ] Indexes optimized for report query patterns
- [ ] Materialized views include correct data aggregations (income, expenses, occupancy)

### Feature Verification (Mission-Specific)
- [ ] Dashboard overview shows portfolio summary cards (total income, expenses, occupancy)
- [ ] Key metrics display at a glance with correct calculations
- [ ] Income summary report generates by property and period
- [ ] Expense tracking shows categorized costs per property
- [ ] Cash flow statement shows net income/expense per month
- [ ] Rent collection rate calculates correctly (paid on time vs total due)
- [ ] Arrears summary shows current outstanding amounts
- [ ] Tax year summary aggregates all financial data for financial year
- [ ] Vacancy rate calculates correctly per property
- [ ] Maintenance costs breakdown by property and category
- [ ] Income vs expenses chart renders with correct data
- [ ] Monthly cash flow trend chart shows historical data
- [ ] Occupancy rate over time chart works
- [ ] PDF report generates and downloads correctly
- [ ] CSV/Excel export produces valid, importable files
- [ ] Scheduled reports email correctly to owner
- [ ] Charts are color-blind accessible

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
- [ ] Financial reports only accessible to the owning user
- [ ] Exported files do not contain other users' data
