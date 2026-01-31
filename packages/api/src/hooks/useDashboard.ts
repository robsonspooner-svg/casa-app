// Mission 13: Portfolio Dashboard Hook
// Provides portfolio summary, monthly financials, and property metrics

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type { PortfolioSummary, MonthlyFinancial, PropertyMetricsRow } from '../types/database';

export interface DashboardState {
  summary: PortfolioSummary | null;
  monthlyFinancials: MonthlyFinancial[];
  propertyMetrics: PropertyMetricsRow[];
  loading: boolean;
  error: string | null;
}

export interface DashboardFilter {
  propertyId?: string;
  months?: number; // for monthly financials chart (default 6)
}

export function useDashboard(filter?: DashboardFilter) {
  const [state, setState] = useState<DashboardState>({
    summary: null,
    monthlyFinancials: [],
    propertyMetrics: [],
    loading: true,
    error: null,
  });

  const fetchDashboard = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch portfolio summary, monthly financials, and property metrics in parallel
      const [summaryResult, financialsResult, metricsResult] = await Promise.all([
        // Portfolio summary via RPC
        (supabase.rpc as any)('get_portfolio_summary', {
          p_owner_id: user.id,
        }),

        // Monthly financials via RPC
        (supabase.rpc as any)('get_monthly_financials', {
          p_owner_id: user.id,
          p_months: filter?.months ?? 6,
          p_property_id: filter?.propertyId ?? null,
        }),

        // Property metrics from materialized view
        (supabase.from('property_metrics') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('owner_id', user.id)
          .order('address_line_1', { ascending: true }),
      ]);

      if (summaryResult.error) throw summaryResult.error;
      if (financialsResult.error) throw financialsResult.error;
      if (metricsResult.error) throw metricsResult.error;

      setState({
        summary: summaryResult.data as PortfolioSummary,
        monthlyFinancials: (financialsResult.data as MonthlyFinancial[]) || [],
        propertyMetrics: (metricsResult.data as PropertyMetricsRow[]) || [],
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load dashboard',
      }));
    }
  }, [filter?.propertyId, filter?.months]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    ...state,
    refreshDashboard: fetchDashboard,
  };
}
