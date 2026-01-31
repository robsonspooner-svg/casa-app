// Unit tests for Mission 13: Reports & Analytics
// Tests useReports, useExpenses, useCashFlowForecast hooks

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  mockFrom,
  mockRpc,
  mockUser,
  resetMocks,
  createMockSupabaseClient,
} from '../__mocks__/supabase';

// Mock functions.invoke for Edge Function calls
const mockFunctionsInvoke = vi.fn();

// Mock getUser to return the authenticated user
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null });

// Mock the client module
vi.mock('../client', () => ({
  getSupabaseClient: vi.fn(() => {
    const client = createMockSupabaseClient();
    (client as any).auth.getUser = mockGetUser;
    (client as any).functions = { invoke: mockFunctionsInvoke };
    return client;
  }),
  initializeSupabase: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
}));

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    isAuthenticated: true,
    loading: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useAuthProvider: vi.fn(),
}));

// Import after mocking
import { useReports } from '../hooks/useReports';
import { useExpenses } from '../hooks/useExpenses';
import { useCashFlowForecast } from '../hooks/useCashFlowForecast';

// ─── Mock Data ────────────────────────────────────────────────

const mockGeneratedReport = {
  id: 'report-1',
  owner_id: 'test-user-id',
  report_type: 'financial_summary',
  title: 'Financial Summary - Jan 2025',
  property_ids: ['property-1'],
  date_from: '2024-12-01',
  date_to: '2025-01-01',
  format: 'pdf',
  status: 'completed',
  storage_path: 'test-user-id/report-1.pdf',
  file_url: 'https://example.com/reports/report-1.pdf',
  file_size_bytes: 12345,
  completed_at: '2025-01-01T12:00:00Z',
  error_message: null,
  created_at: '2025-01-01T10:00:00Z',
};

const mockScheduledReport = {
  id: 'sched-1',
  owner_id: 'test-user-id',
  report_type: 'financial_summary',
  title: 'Monthly Financial Summary',
  property_ids: ['property-1'],
  frequency: 'monthly',
  day_of_month: 1,
  format: 'pdf',
  email_to: ['test@example.com'],
  is_active: true,
  last_run_at: '2025-01-01T00:00:00Z',
  next_run_at: '2025-02-01T00:00:00Z',
  created_at: '2024-12-01T00:00:00Z',
};

const mockExpense = {
  id: 'expense-1',
  owner_id: 'test-user-id',
  property_id: 'property-1',
  category_id: 'cat-1',
  amount: 250.00,
  description: 'Strata fees - Q1',
  expense_date: '2025-01-15',
  is_tax_deductible: true,
  receipt_url: null,
  notes: null,
  created_at: '2025-01-15T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
};

const mockCategory = {
  id: 'cat-1',
  owner_id: 'test-user-id',
  name: 'Strata / Body Corp',
  ato_category: 'body_corporate_fees',
  is_tax_deductible: true,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

const mockMonthlyFinancials = [
  { month_label: '2024-07', month_short: 'Jul', year: 2024, month_num: 7, income: 2200, expenses: 500, fees: 50 },
  { month_label: '2024-08', month_short: 'Aug', year: 2024, month_num: 8, income: 2200, expenses: 520, fees: 50 },
  { month_label: '2024-09', month_short: 'Sep', year: 2024, month_num: 9, income: 2200, expenses: 480, fees: 50 },
  { month_label: '2024-10', month_short: 'Oct', year: 2024, month_num: 10, income: 2200, expenses: 550, fees: 50 },
  { month_label: '2024-11', month_short: 'Nov', year: 2024, month_num: 11, income: 2200, expenses: 530, fees: 50 },
  { month_label: '2024-12', month_short: 'Dec', year: 2024, month_num: 12, income: 2200, expenses: 600, fees: 50 },
];

const mockPortfolioSummary = {
  total_properties: 2,
  occupied_properties: 2,
  total_monthly_rent: 4400,
  total_arrears: 0,
  leases_expiring_30d: 0,
  open_maintenance: 1,
};

// ─── Helper: build a mock chainable Supabase query ────────────

function buildMockChain(resolvedValue: { data: any; error: any }) {
  const chainable: any = {};
  const methods = ['select', 'eq', 'is', 'in', 'gte', 'lte', 'order', 'limit', 'single', 'insert', 'update', 'delete'];
  methods.forEach(method => {
    chainable[method] = vi.fn().mockReturnValue(chainable);
  });
  // Make it thenable for await / Promise.all
  chainable.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chainable.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chainable;
}

// ─── useReports Tests ─────────────────────────────────────────

describe('useReports', () => {
  beforeEach(() => {
    resetMocks();
    mockFunctionsInvoke.mockReset();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch generated and scheduled reports on mount', async () => {
    // Track from() calls by table name
    mockFrom.mockImplementation((table: string) => {
      if (table === 'generated_reports') {
        return buildMockChain({ data: [mockGeneratedReport], error: null });
      }
      if (table === 'scheduled_reports') {
        return buildMockChain({ data: [mockScheduledReport], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.generatedReports.length).toBe(1);
    expect(result.current.generatedReports[0].id).toBe('report-1');
    expect(result.current.scheduledReports.length).toBe(1);
    expect(result.current.scheduledReports[0].id).toBe('sched-1');
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch error gracefully', async () => {
    mockFrom.mockImplementation(() => {
      return buildMockChain({ data: null, error: { message: 'Network error' } });
    });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should generate a report and invoke edge function', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'generated_reports') {
        const chain = buildMockChain({ data: [mockGeneratedReport], error: null });
        // Override single() to resolve with a single row (for insert().select().single())
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockGeneratedReport, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockGeneratedReport, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [mockScheduledReport], error: null });
    });

    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const report = await result.current.generateReport({
        report_type: 'financial_summary',
        title: 'Test Report',
        property_ids: ['property-1'],
        date_from: '2024-12-01',
        date_to: '2025-01-01',
        format: 'pdf',
        status: 'generating',
      });
      expect(report).toBeDefined();
      expect(report.id).toBe('report-1');
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('generate-report', {
      body: { report_id: 'report-1' },
    });
  });

  it('should handle edge function failure gracefully', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'generated_reports') {
        const chain = buildMockChain({ data: [mockGeneratedReport], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockGeneratedReport, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockGeneratedReport, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [mockScheduledReport], error: null });
    });

    // Edge function returns an error
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'Function not found' } });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should not throw — graceful fallback marks as failed
    await act(async () => {
      const report = await result.current.generateReport({
        report_type: 'financial_summary',
        title: 'Test Report',
        property_ids: [],
        date_from: '2024-12-01',
        date_to: '2025-01-01',
        format: 'pdf',
        status: 'generating',
      });
      expect(report).toBeDefined();
    });
  });

  it('should handle edge function not deployed (throws)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'generated_reports') {
        const chain = buildMockChain({ data: [mockGeneratedReport], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockGeneratedReport, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockGeneratedReport, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [mockScheduledReport], error: null });
    });

    // Edge function throws (not deployed)
    mockFunctionsInvoke.mockRejectedValue(new Error('Edge Function not deployed'));

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should fallback to marking as completed
    await act(async () => {
      const report = await result.current.generateReport({
        report_type: 'financial_summary',
        title: 'Test Report',
        property_ids: [],
        date_from: '2024-12-01',
        date_to: '2025-01-01',
        format: 'csv',
        status: 'generating',
      });
      expect(report).toBeDefined();
    });
  });
});

// ─── useExpenses Tests ─────────────────────────────────────────

describe('useExpenses', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch expenses and categories on mount', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'manual_expenses') {
        return buildMockChain({ data: [mockExpense], error: null });
      }
      if (table === 'expense_categories') {
        return buildMockChain({ data: [mockCategory], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.expenses.length).toBe(1);
    expect(result.current.expenses[0].amount).toBe(250);
    expect(result.current.categories.length).toBe(1);
    expect(result.current.categories[0].name).toBe('Strata / Body Corp');
    expect(result.current.error).toBeNull();
  });

  it('should calculate total expenses correctly', async () => {
    const multipleExpenses = [
      { ...mockExpense, id: 'e-1', amount: 250 },
      { ...mockExpense, id: 'e-2', amount: 1500 },
      { ...mockExpense, id: 'e-3', amount: 80.50 },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'manual_expenses') {
        return buildMockChain({ data: multipleExpenses, error: null });
      }
      return buildMockChain({ data: [mockCategory], error: null });
    });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalExpenses).toBe(1830.50);
  });

  it('should handle empty expenses list', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'manual_expenses') {
        return buildMockChain({ data: [], error: null });
      }
      return buildMockChain({ data: [mockCategory], error: null });
    });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.expenses.length).toBe(0);
    expect(result.current.totalExpenses).toBe(0);
  });

  it('should handle fetch error', async () => {
    mockFrom.mockImplementation(() => {
      return buildMockChain({ data: null, error: { message: 'DB error' } });
    });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should add an expense', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'manual_expenses') {
        const chain = buildMockChain({ data: [mockExpense], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockExpense, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockExpense, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [mockCategory], error: null });
    });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const expense = await result.current.addExpense({
        property_id: 'property-1',
        category_id: 'cat-1',
        amount: 250,
        description: 'Strata fees - Q1',
        expense_date: '2025-01-15',
        is_tax_deductible: true,
      });
      expect(expense).toBeDefined();
      expect(expense.amount).toBe(250);
    });
  });
});

// ─── useCashFlowForecast Tests ────────────────────────────────

describe('useCashFlowForecast', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setupForecastMocks(overrides?: {
    financials?: typeof mockMonthlyFinancials;
    summary?: Partial<typeof mockPortfolioSummary>;
  }) {
    const financials = overrides?.financials ?? mockMonthlyFinancials;
    const summary = { ...mockPortfolioSummary, ...(overrides?.summary ?? {}) };

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_monthly_financials') {
        return Promise.resolve({ data: financials, error: null });
      }
      if (fnName === 'get_portfolio_summary') {
        return Promise.resolve({ data: summary, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  }

  it('should generate projections from historical data', async () => {
    setupForecastMocks();

    const { result } = renderHook(() => useCashFlowForecast({ months: 6 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.historicalMonths.length).toBe(6);
    expect(result.current.projectedMonths.length).toBe(6);

    // Historical months should not be projections
    result.current.historicalMonths.forEach(m => {
      expect(m.is_projection).toBe(false);
    });

    // Projected months should be projections
    result.current.projectedMonths.forEach(m => {
      expect(m.is_projection).toBe(true);
    });
  });

  it('should calculate correct occupancy assumptions', async () => {
    setupForecastMocks({
      summary: { total_properties: 4, occupied_properties: 3 },
    });

    const { result } = renderHook(() => useCashFlowForecast({ months: 3 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 3 out of 4 = 75%
    expect(result.current.assumptions.occupancy_rate).toBe(75);
  });

  it('should detect arrears risk', async () => {
    setupForecastMocks({ summary: { total_arrears: 2500 } });

    const { result } = renderHook(() => useCashFlowForecast());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const arrearsRisk = result.current.risks.find(r => r.description.includes('arrears'));
    expect(arrearsRisk).toBeDefined();
    expect(arrearsRisk!.likelihood).toBe('high');
    expect(arrearsRisk!.impact).toBe(2500);
  });

  it('should detect expiring leases risk', async () => {
    setupForecastMocks({ summary: { leases_expiring_30d: 2 } });

    const { result } = renderHook(() => useCashFlowForecast());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const leaseRisk = result.current.risks.find(r => r.description.includes('lease'));
    expect(leaseRisk).toBeDefined();
    expect(leaseRisk!.likelihood).toBe('medium');
  });

  it('should detect low occupancy risk', async () => {
    setupForecastMocks({
      summary: { total_properties: 10, occupied_properties: 8 },
    });

    const { result } = renderHook(() => useCashFlowForecast());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const occupancyRisk = result.current.risks.find(r => r.description.includes('Occupancy'));
    expect(occupancyRisk).toBeDefined();
    expect(occupancyRisk!.likelihood).toBe('high');
  });

  it('should detect high maintenance risk', async () => {
    setupForecastMocks({ summary: { open_maintenance: 5 } });

    const { result } = renderHook(() => useCashFlowForecast());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const maintenanceRisk = result.current.risks.find(r => r.description.includes('maintenance'));
    expect(maintenanceRisk).toBeDefined();
    expect(maintenanceRisk!.likelihood).toBe('medium');
  });

  it('should have no risks for healthy portfolio', async () => {
    setupForecastMocks(); // 0 arrears, 0 expiring, 1 maintenance, 100% occupancy

    const { result } = renderHook(() => useCashFlowForecast());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.risks.length).toBe(0);
  });

  it('should project 3 months when filter says 3', async () => {
    setupForecastMocks();

    const { result } = renderHook(() => useCashFlowForecast({ months: 3 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projectedMonths.length).toBe(3);
  });

  it('should project 12 months when filter says 12', async () => {
    setupForecastMocks();

    const { result } = renderHook(() => useCashFlowForecast({ months: 12 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projectedMonths.length).toBe(12);
  });

  it('should default to 6 months projection', async () => {
    setupForecastMocks();

    const { result } = renderHook(() => useCashFlowForecast());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projectedMonths.length).toBe(6);
  });

  it('should apply occupancy rate to projected income', async () => {
    setupForecastMocks({
      summary: { total_properties: 4, occupied_properties: 2 }, // 50%
    });

    const { result } = renderHook(() => useCashFlowForecast({ months: 3 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Average income from 6 months = 2200
    // With 50% occupancy: 2200 * 0.5 = 1100
    const firstProjected = result.current.projectedMonths[0];
    expect(firstProjected.projected_income).toBe(1100);
  });

  it('should track cumulative net across projections', async () => {
    setupForecastMocks();

    const { result } = renderHook(() => useCashFlowForecast({ months: 3 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Each projected month should add its net to cumulative
    for (let i = 1; i < result.current.projectedMonths.length; i++) {
      const curr = result.current.projectedMonths[i];
      const prev = result.current.projectedMonths[i - 1];
      if (curr.projected_net > 0) {
        expect(curr.cumulative_net).toBeGreaterThan(prev.cumulative_net);
      }
    }
  });

  it('should handle RPC error gracefully', async () => {
    mockRpc.mockImplementation(() => {
      return Promise.resolve({ data: null, error: { message: 'RPC failed' } });
    });

    const { result } = renderHook(() => useCashFlowForecast());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.projectedMonths.length).toBe(0);
  });

  it('should handle empty historical data with fallback', async () => {
    setupForecastMocks({ financials: [] });

    const { result } = renderHook(() => useCashFlowForecast({ months: 3 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.historicalMonths.length).toBe(0);
    // Should still generate projections using portfolio summary fallback
    expect(result.current.projectedMonths.length).toBe(3);
  });
});

// ─── Report Type Validation Tests ─────────────────────────────

describe('Report Types & Formats', () => {
  const VALID_REPORT_TYPES = [
    'financial_summary',
    'tax_summary',
    'property_performance',
    'cash_flow',
    'maintenance_summary',
    'portfolio_overview',
  ];

  const VALID_FORMATS = ['pdf', 'csv', 'xlsx'];

  it('should have all expected report types', () => {
    VALID_REPORT_TYPES.forEach(type => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
    expect(VALID_REPORT_TYPES).toHaveLength(6);
  });

  it('should support 3 output formats', () => {
    expect(VALID_FORMATS).toHaveLength(3);
    expect(VALID_FORMATS).toContain('pdf');
    expect(VALID_FORMATS).toContain('csv');
    expect(VALID_FORMATS).toContain('xlsx');
  });

  it('should have frequency options for scheduled reports', () => {
    const frequencies = ['weekly', 'monthly', 'quarterly', 'yearly'];
    expect(frequencies).toHaveLength(4);
    frequencies.forEach(freq => {
      expect(typeof freq).toBe('string');
    });
  });
});

// ─── Forecast Calculation Logic Tests ─────────────────────────

describe('Forecast Calculation Logic', () => {
  it('should calculate expense growth rate from halved periods', () => {
    // First half: [500, 520, 480] → avg 500
    // Second half: [550, 530, 600] → avg 560
    // Growth rate: ((560 - 500) / 500) * 100 = 12%
    const firstHalf = [500, 520, 480];
    const secondHalf = [550, 530, 600];
    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const growthRate = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);

    expect(firstAvg).toBe(500);
    expect(secondAvg).toBe(560);
    expect(growthRate).toBe(12);
  });

  it('should apply growth factor progressively over months', () => {
    const baseExpense = 500;
    const growthRate = 12; // 12%

    const month1Factor = 1 + (growthRate / 100) * (1 / 12);
    const month6Factor = 1 + (growthRate / 100) * (6 / 12);
    const month12Factor = 1 + (growthRate / 100) * (12 / 12);

    expect(baseExpense * month1Factor).toBeCloseTo(505, 0);
    expect(baseExpense * month6Factor).toBeCloseTo(530, 0);
    expect(baseExpense * month12Factor).toBeCloseTo(560, 0);
  });

  it('should clamp negative growth factor to minimum 0.5', () => {
    const growthRate = -80;
    const month12Factor = 1 + (growthRate / 100) * (12 / 12);
    const clampedFactor = Math.max(month12Factor, 0.5);

    // Without clamping: 1 + (-0.8) * 1 ≈ 0.2
    expect(month12Factor).toBeCloseTo(0.2, 5);
    expect(clampedFactor).toBe(0.5);
  });

  it('should correctly calculate occupancy-adjusted income', () => {
    const avgIncome = 2200;
    const occupancyRate = 75;
    const adjustedIncome = avgIncome * (occupancyRate / 100);

    expect(adjustedIncome).toBe(1650);
  });
});
