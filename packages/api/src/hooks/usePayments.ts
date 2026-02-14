// usePayments Hook - Payment History
// Mission 07: Rent Collection & Payments

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { Payment, PaymentStatus, PaymentWithDetails } from '../types/database';

export interface PaymentsState {
  payments: PaymentWithDetails[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface PaymentsFilter {
  tenancyId?: string;
  status?: PaymentStatus;
  limit?: number;
}

export function usePayments(filter?: PaymentsFilter): PaymentsState & { refreshPayments: () => Promise<void> } {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<PaymentsState>({
    payments: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchPayments = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ payments: [], loading: false, error: null, refreshing: false });
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

      let query = (supabase.from('payments') as ReturnType<typeof supabase.from>)
        .select('*')
        .order('created_at', { ascending: false });

      if (filter?.tenancyId) {
        query = query.eq('tenancy_id', filter.tenancyId);
      }

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const payments = (data || []) as Payment[];

      // Fetch related payment methods
      const methodIds = [...new Set(payments.filter(p => p.payment_method_id).map(p => p.payment_method_id))];
      let methodsMap: Record<string, { type: string; last_four: string; brand?: string; bank_name?: string }> = {};

      if (methodIds.length > 0) {
        const { data: methods } = await (supabase
          .from('payment_methods') as ReturnType<typeof supabase.from>)
          .select('id, type, last_four, brand, bank_name')
          .in('id', methodIds)
          .eq('is_active', true);

        if (methods) {
          methodsMap = (methods as Array<{ id: string; type: string; last_four: string; brand?: string; bank_name?: string }>)
            .reduce((map, m) => ({ ...map, [m.id]: m }), {} as typeof methodsMap);
        }
      }

      // Fetch tenancy details for display
      const tenancyIds = [...new Set(payments.map(p => p.tenancy_id))];
      let tenancyMap: Record<string, { property_id: string; property_address?: string }> = {};

      if (tenancyIds.length > 0) {
        const { data: tenancies } = await (supabase
          .from('tenancies') as ReturnType<typeof supabase.from>)
          .select('id, property_id')
          .in('id', tenancyIds);

        if (tenancies) {
          const propertyIds = [...new Set((tenancies as Array<{ id: string; property_id: string }>).map(t => t.property_id))];
          const { data: properties } = await (supabase
            .from('properties') as ReturnType<typeof supabase.from>)
            .select('id, street_address, suburb')
            .in('id', propertyIds);

          const propertyMap = (properties || []).reduce((map: Record<string, string>, p: { id: string; street_address: string; suburb: string }) => ({
            ...map,
            [p.id]: `${p.street_address}, ${p.suburb}`,
          }), {} as Record<string, string>);

          tenancyMap = (tenancies as Array<{ id: string; property_id: string }>).reduce((map, t) => ({
            ...map,
            [t.id]: { property_id: t.property_id, property_address: propertyMap[t.property_id] },
          }), {} as typeof tenancyMap);
        }
      }

      const paymentsWithDetails: PaymentWithDetails[] = payments.map(payment => ({
        ...payment,
        payment_method: payment.payment_method_id ? methodsMap[payment.payment_method_id] : undefined,
        tenancy: tenancyMap[payment.tenancy_id],
      }));

      setState({
        payments: paymentsWithDetails,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch payments';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, filter?.tenancyId, filter?.status, filter?.limit]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPayments();
    }
  }, [fetchPayments, isAuthenticated]);

  // Refresh data when screen gains focus (e.g. navigating back)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchPayments(true);
      }
    }, [fetchPayments, isAuthenticated])
  );

  // Realtime subscription for live payment updates
  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseClient();

    const channel = supabase
      .channel('payment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
        },
        () => {
          // Re-fetch on any change to payments
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchPayments]);

  const refreshPayments = useCallback(async () => {
    await fetchPayments(true);
  }, [fetchPayments]);

  return {
    ...state,
    refreshPayments,
  };
}
