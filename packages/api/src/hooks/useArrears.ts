// useArrears Hook - Arrears Records List
// Mission 08: Arrears & Late Payment Management

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  ArrearsRecord,
  ArrearsRecordWithDetails,
  ArrearsSeverity,
  Profile,
  Tenancy,
  Property,
  ArrearsAction,
  PaymentPlan,
} from '../types/database';

export interface ArrearsState {
  arrears: ArrearsRecordWithDetails[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface ArrearsFilter {
  severity?: ArrearsSeverity;
  tenancyId?: string;
  isResolved?: boolean;
  minDaysOverdue?: number;
}

export interface ArrearsSummary {
  totalRecords: number;
  totalAmount: number;
  bySeverity: Record<ArrearsSeverity, { count: number; amount: number }>;
}

export function useArrears(filter?: ArrearsFilter): ArrearsState & {
  refreshArrears: () => Promise<void>;
  summary: ArrearsSummary;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ArrearsState>({
    arrears: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchArrears = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ arrears: [], loading: false, error: null, refreshing: false });
      return;
    }

    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const supabase = getSupabaseClient();

      // Build the query
      let query = supabase
        .from('arrears_records')
        .select('*')
        .order('days_overdue', { ascending: false });

      // Apply filters
      if (filter?.severity) {
        query = query.eq('severity', filter.severity);
      }

      if (filter?.tenancyId) {
        query = query.eq('tenancy_id', filter.tenancyId);
      }

      if (filter?.isResolved !== undefined) {
        query = query.eq('is_resolved', filter.isResolved);
      } else {
        // Default to showing only unresolved
        query = query.eq('is_resolved', false);
      }

      if (filter?.minDaysOverdue) {
        query = query.gte('days_overdue', filter.minDaysOverdue);
      }

      const { data: arrearsData, error: arrearsError } = await query;

      if (arrearsError) throw arrearsError;

      const arrears = (arrearsData || []) as ArrearsRecord[];

      if (arrears.length === 0) {
        setState({
          arrears: [],
          loading: false,
          error: null,
          refreshing: false,
        });
        return;
      }

      // Fetch related tenant profiles
      const tenantIds = [...new Set(arrears.map(a => a.tenant_id))];
      const { data: tenants } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', tenantIds);

      const tenantMap = (tenants || []).reduce((map, t: any) => {
        map[t.id] = t as Profile;
        return map;
      }, {} as Record<string, Profile>);

      // Fetch related tenancies with properties
      const tenancyIds = [...new Set(arrears.map(a => a.tenancy_id))];
      const { data: tenancies } = await supabase
        .from('tenancies')
        .select('id, property_id, rent_amount, rent_frequency, lease_start_date, lease_end_date, status')
        .in('id', tenancyIds);

      // Fetch properties
      const propertyIds = [...new Set((tenancies || []).map((t: any) => t.property_id))];
      const { data: properties } = await supabase
        .from('properties')
        .select('id, address_line_1, suburb, state, postcode')
        .in('id', propertyIds);

      const propertyMap = (properties || []).reduce((map, p: any) => {
        map[p.id] = p as Property;
        return map;
      }, {} as Record<string, Property>);

      const tenancyMap = (tenancies || []).reduce((map, t: any) => {
        map[t.id] = {
          ...t,
          property: propertyMap[t.property_id],
        } as Tenancy & { property?: Property };
        return map;
      }, {} as Record<string, Tenancy & { property?: Property }>);

      // Fetch payment plans for arrears with plans
      const arrearsWithPlans = arrears.filter(a => a.has_payment_plan && a.payment_plan_id);
      const planIds = arrearsWithPlans.map(a => a.payment_plan_id).filter(Boolean) as string[];

      let planMap: Record<string, PaymentPlan> = {};
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from('payment_plans')
          .select('*')
          .in('id', planIds);

        planMap = (plans || []).reduce((map, p: any) => {
          map[p.id] = p as PaymentPlan;
          return map;
        }, {} as Record<string, PaymentPlan>);
      }

      // Fetch last action for each arrears record
      const arrearsIds = arrears.map(a => a.id);
      const { data: lastActions } = await supabase
        .from('arrears_actions')
        .select('*')
        .in('arrears_record_id', arrearsIds)
        .order('created_at', { ascending: false });

      // Group actions by arrears_record_id and take the first (most recent)
      const lastActionMap: Record<string, ArrearsAction> = {};
      (lastActions || []).forEach((action: any) => {
        if (!lastActionMap[action.arrears_record_id]) {
          lastActionMap[action.arrears_record_id] = action as ArrearsAction;
        }
      });

      // Combine all data
      const arrearsWithDetails: ArrearsRecordWithDetails[] = arrears.map(record => ({
        ...record,
        tenant: tenantMap[record.tenant_id],
        tenancy: tenancyMap[record.tenancy_id],
        payment_plan: record.payment_plan_id ? planMap[record.payment_plan_id] : undefined,
        last_action: lastActionMap[record.id] || null,
      }));

      setState({
        arrears: arrearsWithDetails,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch arrears';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, filter?.severity, filter?.tenancyId, filter?.isResolved, filter?.minDaysOverdue]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchArrears();
    }
  }, [fetchArrears, isAuthenticated]);

  const refreshArrears = useCallback(async () => {
    await fetchArrears(true);
  }, [fetchArrears]);

  // Calculate summary
  const summary: ArrearsSummary = {
    totalRecords: state.arrears.length,
    totalAmount: state.arrears.reduce((sum, a) => sum + a.total_overdue, 0),
    bySeverity: {
      minor: { count: 0, amount: 0 },
      moderate: { count: 0, amount: 0 },
      serious: { count: 0, amount: 0 },
      critical: { count: 0, amount: 0 },
    },
  };

  state.arrears.forEach(a => {
    summary.bySeverity[a.severity].count += 1;
    summary.bySeverity[a.severity].amount += a.total_overdue;
  });

  return {
    ...state,
    refreshArrears,
    summary,
  };
}
