// useOwnerPayouts Hook - Owner's Stripe Connect Payout Info
// Mission 07: Rent Collection & Payments

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { OwnerStripeAccount } from '../types/database';

export interface OwnerPayoutsState {
  stripeAccount: OwnerStripeAccount | null;
  isOnboarded: boolean;
  loading: boolean;
  error: string | null;
}

export function useOwnerPayouts(): OwnerPayoutsState & { refreshPayouts: () => Promise<void> } {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<OwnerPayoutsState>({
    stripeAccount: null,
    isOnboarded: false,
    loading: true,
    error: null,
  });

  const fetchPayouts = useCallback(async () => {
    if (!user) {
      setState({ stripeAccount: null, isOnboarded: false, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('owner_stripe_accounts') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;

      const account = data as OwnerStripeAccount | null;

      setState({
        stripeAccount: account,
        isOnboarded: account?.charges_enabled === true && account?.payouts_enabled === true,
        loading: false,
        error: null,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch payout info';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPayouts();
    }
  }, [fetchPayouts, isAuthenticated]);

  const refreshPayouts = useCallback(async () => {
    await fetchPayouts();
  }, [fetchPayouts]);

  return {
    ...state,
    refreshPayouts,
  };
}
