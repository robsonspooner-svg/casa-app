// useAutoPay Hook - Auto-Pay Settings for a Tenancy
// Mission 07: Rent Collection & Payments

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { AutoPaySettings } from '../types/database';

export interface AutoPayState {
  settings: AutoPaySettings | null;
  loading: boolean;
  error: string | null;
}

export function useAutoPay(tenancyId?: string): AutoPayState & { refreshAutoPay: () => Promise<void> } {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<AutoPayState>({
    settings: null,
    loading: true,
    error: null,
  });

  const fetchSettings = useCallback(async () => {
    if (!user || !tenancyId) {
      setState({ settings: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('autopay_settings') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenancy_id', tenancyId)
        .eq('tenant_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setState({
        settings: data as AutoPaySettings | null,
        loading: false,
        error: null,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch auto-pay settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user, tenancyId]);

  useEffect(() => {
    if (isAuthenticated && tenancyId) {
      fetchSettings();
    }
  }, [fetchSettings, isAuthenticated, tenancyId]);

  const refreshAutoPay = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  return {
    ...state,
    refreshAutoPay,
  };
}
