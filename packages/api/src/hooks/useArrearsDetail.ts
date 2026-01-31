// useArrearsDetail Hook - Single Arrears Record with Full History
// Mission 08: Arrears & Late Payment Management

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  ArrearsRecord,
  ArrearsRecordWithDetails,
  ArrearsAction,
  PaymentPlan,
  PaymentPlanInstallment,
  Profile,
  Tenancy,
  Property,
} from '../types/database';

export interface ArrearsDetailState {
  arrears: ArrearsRecordWithDetails | null;
  actions: ArrearsAction[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useArrearsDetail(arrearsId: string | null): ArrearsDetailState & {
  refreshArrearsDetail: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ArrearsDetailState>({
    arrears: null,
    actions: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchArrearsDetail = useCallback(async (isRefresh = false) => {
    if (!user || !arrearsId) {
      setState({ arrears: null, actions: [], loading: false, error: null, refreshing: false });
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

      // Fetch the arrears record
      const { data: arrearsData, error: arrearsError } = await supabase
        .from('arrears_records')
        .select('*')
        .eq('id', arrearsId)
        .single();

      if (arrearsError) throw arrearsError;
      if (!arrearsData) throw new Error('Arrears record not found');

      const arrears = arrearsData as ArrearsRecord;

      // Fetch tenant profile
      const { data: tenant } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', arrears.tenant_id)
        .single();

      // Fetch tenancy with property
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('*')
        .eq('id', arrears.tenancy_id)
        .single();

      let property: Property | undefined;
      if (tenancy) {
        const { data: propertyData } = await supabase
          .from('properties')
          .select('*')
          .eq('id', (tenancy as any).property_id)
          .single();
        property = (propertyData ?? undefined) as Property | undefined;
      }

      // Fetch payment plan if exists
      let paymentPlan: (PaymentPlan & { installments?: PaymentPlanInstallment[] }) | undefined;
      if (arrears.payment_plan_id) {
        const { data: planData } = await supabase
          .from('payment_plans')
          .select('*')
          .eq('id', arrears.payment_plan_id)
          .single();

        if (planData) {
          paymentPlan = planData as PaymentPlan;

          // Fetch installments
          const { data: installments } = await supabase
            .from('payment_plan_installments')
            .select('*')
            .eq('payment_plan_id', (planData as any).id)
            .order('installment_number', { ascending: true });

          paymentPlan.installments = (installments || []) as PaymentPlanInstallment[];
        }
      }

      // Fetch all actions (communication history)
      const { data: actionsData, error: actionsError } = await supabase
        .from('arrears_actions')
        .select('*')
        .eq('arrears_record_id', arrearsId)
        .order('created_at', { ascending: false });

      if (actionsError) throw actionsError;

      const actions = (actionsData || []) as ArrearsAction[];

      // Combine all data
      const arrearsWithDetails: ArrearsRecordWithDetails = {
        ...arrears,
        tenant: (tenant ?? undefined) as Profile | undefined,
        tenancy: tenancy ? {
          ...tenancy as Tenancy,
          property,
        } : undefined,
        payment_plan: paymentPlan,
        actions,
        last_action: actions.length > 0 ? actions[0] : null,
      };

      setState({
        arrears: arrearsWithDetails,
        actions,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch arrears detail';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, arrearsId]);

  useEffect(() => {
    if (isAuthenticated && arrearsId) {
      fetchArrearsDetail();
    }
  }, [fetchArrearsDetail, isAuthenticated, arrearsId]);

  const refreshArrearsDetail = useCallback(async () => {
    await fetchArrearsDetail(true);
  }, [fetchArrearsDetail]);

  return {
    ...state,
    refreshArrearsDetail,
  };
}
