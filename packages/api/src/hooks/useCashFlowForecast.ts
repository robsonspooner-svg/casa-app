// Mission 13: Cash Flow Forecasting Hook
// Projects forward 3, 6, or 12 months based on historical data

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type { MonthlyFinancial, PortfolioSummary } from '../types/database';

export interface ForecastMonth {
  month_label: string;
  month_short: string;
  year: number;
  month_num: number;
  projected_income: number;
  projected_expenses: number;
  projected_net: number;
  cumulative_net: number;
  is_projection: boolean;
}

export interface ForecastAssumptions {
  occupancy_rate: number;
  expense_growth_rate: number;
  pending_rent_increases: number;
}

export interface ForecastRisk {
  description: string;
  impact: number;
  likelihood: 'low' | 'medium' | 'high';
}

export interface CashFlowForecastState {
  historicalMonths: ForecastMonth[];
  projectedMonths: ForecastMonth[];
  assumptions: ForecastAssumptions;
  risks: ForecastRisk[];
  loading: boolean;
  error: string | null;
}

export interface CashFlowForecastFilter {
  months?: 3 | 6 | 12;
  propertyId?: string;
}

export function useCashFlowForecast(filter?: CashFlowForecastFilter) {
  const [state, setState] = useState<CashFlowForecastState>({
    historicalMonths: [],
    projectedMonths: [],
    assumptions: { occupancy_rate: 100, expense_growth_rate: 0, pending_rent_increases: 0 },
    risks: [],
    loading: true,
    error: null,
  });

  const projectionMonths = filter?.months ?? 6;

  const fetchForecast = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch 12 months of historical data
      const [financialsResult, summaryResult] = await Promise.all([
        (supabase.rpc as any)('get_monthly_financials', {
          p_owner_id: user.id,
          p_months: 12,
          p_property_id: filter?.propertyId ?? null,
        }),
        (supabase.rpc as any)('get_portfolio_summary', {
          p_owner_id: user.id,
        }),
      ]);

      if (financialsResult.error) throw financialsResult.error;
      if (summaryResult.error) throw summaryResult.error;

      const historicalData = (financialsResult.data as MonthlyFinancial[]) || [];
      const summary = summaryResult.data as PortfolioSummary;

      // Convert historical data to ForecastMonth format
      let cumulative = 0;
      const historicalMonths: ForecastMonth[] = historicalData.map(m => {
        const net = Number(m.income) - Number(m.expenses) - Number(m.fees);
        cumulative += net;
        return {
          month_label: m.month_label,
          month_short: m.month_short,
          year: m.year,
          month_num: m.month_num,
          projected_income: Number(m.income),
          projected_expenses: Number(m.expenses) + Number(m.fees),
          projected_net: net,
          cumulative_net: cumulative,
          is_projection: false,
        };
      });

      // Calculate averages from recent data (last 6 months or all available)
      const recentData = historicalData.slice(-6);
      const avgIncome = recentData.length > 0
        ? recentData.reduce((s, m) => s + Number(m.income), 0) / recentData.length
        : Number(summary?.total_monthly_rent ?? 0);
      const avgExpenses = recentData.length > 0
        ? recentData.reduce((s, m) => s + Number(m.expenses) + Number(m.fees), 0) / recentData.length
        : 0;

      // Calculate assumptions
      const totalProperties = Number(summary?.total_properties ?? 0);
      const occupiedProperties = Number(summary?.occupied_properties ?? 0);
      const occupancyRate = totalProperties > 0 ? Math.round((occupiedProperties / totalProperties) * 100) : 100;

      // Detect expense growth trend
      let expenseGrowthRate = 0;
      if (recentData.length >= 3) {
        const firstHalf = recentData.slice(0, Math.floor(recentData.length / 2));
        const secondHalf = recentData.slice(Math.floor(recentData.length / 2));
        const firstAvg = firstHalf.reduce((s, m) => s + Number(m.expenses), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((s, m) => s + Number(m.expenses), 0) / secondHalf.length;
        if (firstAvg > 0) {
          expenseGrowthRate = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
        }
      }

      const assumptions: ForecastAssumptions = {
        occupancy_rate: occupancyRate,
        expense_growth_rate: expenseGrowthRate,
        pending_rent_increases: 0,
      };

      // Generate projections
      const now = new Date();
      const projectedMonths: ForecastMonth[] = [];
      let projCumulative = cumulative;

      for (let i = 1; i <= projectionMonths; i++) {
        const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthShort = futureDate.toLocaleString('en-AU', { month: 'short' });
        const monthLabel = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

        // Apply occupancy rate to income
        const projectedIncome = avgIncome * (occupancyRate / 100);

        // Apply expense growth rate
        const growthFactor = 1 + (expenseGrowthRate / 100) * (i / 12);
        const projectedExpenses = avgExpenses * Math.max(growthFactor, 0.5);

        const projectedNet = projectedIncome - projectedExpenses;
        projCumulative += projectedNet;

        projectedMonths.push({
          month_label: monthLabel,
          month_short: monthShort,
          year: futureDate.getFullYear(),
          month_num: futureDate.getMonth() + 1,
          projected_income: Math.round(projectedIncome * 100) / 100,
          projected_expenses: Math.round(projectedExpenses * 100) / 100,
          projected_net: Math.round(projectedNet * 100) / 100,
          cumulative_net: Math.round(projCumulative * 100) / 100,
          is_projection: true,
        });
      }

      // Identify risks
      const risks: ForecastRisk[] = [];
      const totalArrears = Number(summary?.total_arrears ?? 0);
      if (totalArrears > 0) {
        risks.push({
          description: `Outstanding arrears of $${Math.round(totalArrears).toLocaleString()}`,
          impact: totalArrears,
          likelihood: 'high',
        });
      }
      const leasesExpiring = Number(summary?.leases_expiring_30d ?? 0);
      if (leasesExpiring > 0) {
        risks.push({
          description: `${leasesExpiring} lease(s) expiring within 30 days`,
          impact: avgIncome * leasesExpiring * 0.5,
          likelihood: 'medium',
        });
      }
      const openMaintenance = Number(summary?.open_maintenance ?? 0);
      if (openMaintenance > 2) {
        risks.push({
          description: `${openMaintenance} open maintenance requests`,
          impact: avgExpenses * 0.3,
          likelihood: 'medium',
        });
      }
      if (occupancyRate < 90) {
        risks.push({
          description: `Occupancy rate below 90% (${occupancyRate}%)`,
          impact: avgIncome * ((100 - occupancyRate) / 100),
          likelihood: 'high',
        });
      }

      setState({
        historicalMonths,
        projectedMonths,
        assumptions,
        risks,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load forecast',
      }));
    }
  }, [projectionMonths, filter?.propertyId]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  return {
    ...state,
    refreshForecast: fetchForecast,
  };
}
