// usePaymentPlan Hook - Payment Plan Details
// Mission 08: Arrears & Late Payment Management

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  PaymentPlan,
  PaymentPlanInstallment,
  PaymentPlanWithDetails,
  ArrearsRecord,
} from '../types/database';

export interface PaymentPlanState {
  plan: PaymentPlanWithDetails | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface PaymentPlanProgress {
  percentComplete: number;
  remainingAmount: number;
  remainingInstallments: number;
  nextInstallment: PaymentPlanInstallment | null;
  overdueInstallments: PaymentPlanInstallment[];
  isOnTrack: boolean;
}

export function usePaymentPlan(planId: string | null): PaymentPlanState & {
  refreshPlan: () => Promise<void>;
  progress: PaymentPlanProgress | null;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<PaymentPlanState>({
    plan: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchPlan = useCallback(async (isRefresh = false) => {
    if (!user || !planId) {
      setState({ plan: null, loading: false, error: null, refreshing: false });
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

      // Fetch the payment plan
      const { data: planData, error: planError } = await supabase
        .from('payment_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError) throw planError;
      if (!planData) throw new Error('Payment plan not found');

      const plan = planData as PaymentPlan;

      // Fetch installments
      const { data: installmentsData, error: installmentsError } = await supabase
        .from('payment_plan_installments')
        .select('*')
        .eq('payment_plan_id', planId)
        .order('installment_number', { ascending: true });

      if (installmentsError) throw installmentsError;

      // Fetch related arrears record
      const { data: arrearsData } = await supabase
        .from('arrears_records')
        .select('*')
        .eq('id', plan.arrears_record_id)
        .single();

      const planWithDetails: PaymentPlanWithDetails = {
        ...plan,
        installments: (installmentsData || []) as PaymentPlanInstallment[],
        arrears_record: (arrearsData ?? undefined) as ArrearsRecord | undefined,
      };

      setState({
        plan: planWithDetails,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch payment plan';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, planId]);

  useEffect(() => {
    if (isAuthenticated && planId) {
      fetchPlan();
    }
  }, [fetchPlan, isAuthenticated, planId]);

  const refreshPlan = useCallback(async () => {
    await fetchPlan(true);
  }, [fetchPlan]);

  // Calculate progress
  let progress: PaymentPlanProgress | null = null;
  if (state.plan?.installments) {
    const installments = state.plan.installments;
    const today = new Date().toISOString().split('T')[0];

    const paidInstallments = installments.filter(i => i.is_paid);
    const unpaidInstallments = installments.filter(i => !i.is_paid);
    const overdueInstallments = unpaidInstallments.filter(i => i.due_date < today);
    const nextInstallment = unpaidInstallments.sort((a, b) =>
      a.due_date.localeCompare(b.due_date)
    )[0] || null;

    const totalPaid = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
    const remainingAmount = state.plan.total_arrears - totalPaid;

    progress = {
      percentComplete: Math.round((totalPaid / state.plan.total_arrears) * 100),
      remainingAmount,
      remainingInstallments: unpaidInstallments.length,
      nextInstallment,
      overdueInstallments,
      isOnTrack: overdueInstallments.length === 0,
    };
  }

  return {
    ...state,
    refreshPlan,
    progress,
  };
}

// Hook for fetching tenant's active payment plan (if any)
export function useMyPaymentPlan(): PaymentPlanState & {
  refreshPlan: () => Promise<void>;
  progress: PaymentPlanProgress | null;
} {
  const { user, isAuthenticated } = useAuth();
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyPlan = async () => {
      if (!user) return;

      const supabase = getSupabaseClient();

      // Find active arrears record for this tenant
      const { data: arrearsData } = await supabase
        .from('arrears_records')
        .select('payment_plan_id')
        .eq('tenant_id', user.id)
        .eq('is_resolved', false)
        .eq('has_payment_plan', true)
        .single();

      if ((arrearsData as any)?.payment_plan_id) {
        setPlanId((arrearsData as any).payment_plan_id);
      }
    };

    if (isAuthenticated) {
      fetchMyPlan();
    }
  }, [user, isAuthenticated]);

  return usePaymentPlan(planId);
}
