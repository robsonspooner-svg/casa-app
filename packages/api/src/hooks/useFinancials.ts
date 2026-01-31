// Mission 13: Financial Reports Hook
// Tax summary, income/expense breakdown, and financial year data

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type { TaxSummary, MonthlyFinancial } from '../types/database';

export interface FinancialsState {
  taxSummary: TaxSummary | null;
  monthlyBreakdown: MonthlyFinancial[];
  loading: boolean;
  error: string | null;
}

export interface FinancialsFilter {
  financialYear?: number; // e.g. 2025 means FY 2024-25
  propertyId?: string;
}

export function useFinancials(filter?: FinancialsFilter) {
  const [state, setState] = useState<FinancialsState>({
    taxSummary: null,
    monthlyBreakdown: [],
    loading: true,
    error: null,
  });

  const fetchFinancials = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch tax summary and 12-month breakdown in parallel
      const [taxResult, monthlyResult] = await Promise.all([
        (supabase.rpc as any)('get_tax_summary', {
          p_owner_id: user.id,
          p_financial_year: filter?.financialYear ?? null,
        }),
        (supabase.rpc as any)('get_monthly_financials', {
          p_owner_id: user.id,
          p_months: 12,
          p_property_id: filter?.propertyId ?? null,
        }),
      ]);

      if (taxResult.error) throw taxResult.error;
      if (monthlyResult.error) throw monthlyResult.error;

      setState({
        taxSummary: taxResult.data as TaxSummary,
        monthlyBreakdown: (monthlyResult.data as MonthlyFinancial[]) || [],
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load financials',
      }));
    }
  }, [filter?.financialYear, filter?.propertyId]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  return {
    ...state,
    refreshFinancials: fetchFinancials,
  };
}
