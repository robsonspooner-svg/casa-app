// usePaymentMethods Hook - User's Saved Payment Methods
// Mission 07: Rent Collection & Payments

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { PaymentMethod } from '../types/database';

export interface PaymentMethodsState {
  methods: PaymentMethod[];
  defaultMethod: PaymentMethod | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function usePaymentMethods(): PaymentMethodsState & { refreshMethods: () => Promise<void> } {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<PaymentMethodsState>({
    methods: [],
    defaultMethod: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchMethods = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ methods: [], defaultMethod: null, loading: false, error: null, refreshing: false });
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

      const { data, error } = await (supabase
        .from('payment_methods') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const methods = (data || []) as PaymentMethod[];
      const defaultMethod = methods.find(m => m.is_default) || null;

      setState({
        methods,
        defaultMethod,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch payment methods';
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
      fetchMethods();
    }
  }, [fetchMethods, isAuthenticated]);

  const refreshMethods = useCallback(async () => {
    await fetchMethods(true);
  }, [fetchMethods]);

  return {
    ...state,
    refreshMethods,
  };
}
