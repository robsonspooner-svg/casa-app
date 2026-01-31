// useMyArrears Hook - Tenant's Own Arrears Status
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
  Property,
  Tenancy,
} from '../types/database';

export interface MyArrearsState {
  arrears: ArrearsRecordWithDetails | null;
  hasArrears: boolean;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useMyArrears(): MyArrearsState & {
  refreshMyArrears: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<MyArrearsState>({
    arrears: null,
    hasArrears: false,
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchMyArrears = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ arrears: null, hasArrears: false, loading: false, error: null, refreshing: false });
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

      // Find active arrears record for this tenant
      const { data: arrearsData, error: arrearsError } = await supabase
        .from('arrears_records')
        .select('*')
        .eq('tenant_id', user.id)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (arrearsError && arrearsError.code !== 'PGRST116') {
        // PGRST116 = no rows found (not an error for us)
        throw arrearsError;
      }

      if (!arrearsData) {
        setState({
          arrears: null,
          hasArrears: false,
          loading: false,
          error: null,
          refreshing: false,
        });
        return;
      }

      const arrears = arrearsData as ArrearsRecord;

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

      // Fetch recent actions (limited)
      const { data: actionsData } = await supabase
        .from('arrears_actions')
        .select('*')
        .eq('arrears_record_id', arrears.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const arrearsWithDetails: ArrearsRecordWithDetails = {
        ...arrears,
        tenancy: tenancy ? {
          ...tenancy as Tenancy,
          property,
        } : undefined,
        payment_plan: paymentPlan,
        actions: (actionsData || []) as ArrearsAction[],
        last_action: actionsData && actionsData.length > 0 ? actionsData[0] as ArrearsAction : null,
      };

      setState({
        arrears: arrearsWithDetails,
        hasArrears: true,
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
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyArrears();
    }
  }, [fetchMyArrears, isAuthenticated]);

  const refreshMyArrears = useCallback(async () => {
    await fetchMyArrears(true);
  }, [fetchMyArrears]);

  return {
    ...state,
    refreshMyArrears,
  };
}
