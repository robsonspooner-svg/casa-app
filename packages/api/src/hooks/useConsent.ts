// useConsent Hook - User Consent Management
// Mission 18: Security Audit

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface UserConsent {
  id: string;
  consent_type: string;
  version: string;
  consented: boolean;
  created_at: string;
}

export interface ConsentState {
  consents: UserConsent[];
  loading: boolean;
  error: string | null;
}

export interface UseConsentReturn extends ConsentState {
  recordConsent: (type: string, version: string, consented: boolean) => Promise<void>;
  hasConsented: (type: string) => boolean;
  refresh: () => Promise<void>;
}

export function useConsent(): UseConsentReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ConsentState>({
    consents: [],
    loading: true,
    error: null,
  });

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const fetchConsents = useCallback(async () => {
    if (!user || !supabase) {
      setState({ consents: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await (supabase.from('user_consents') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setState({
        consents: (data as UserConsent[]) || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch consents';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [user, supabase]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchConsents();
    }
  }, [fetchConsents, isAuthenticated]);

  const recordConsent = useCallback(async (type: string, version: string, consented: boolean) => {
    if (!user || !supabase) return;

    try {
      const { data, error } = await (supabase.from('user_consents') as any)
        .insert({
          user_id: user.id,
          consent_type: type,
          version,
          consented,
        })
        .select()
        .single();

      if (error) throw error;

      const newConsent = data as UserConsent;
      setState(prev => ({
        ...prev,
        consents: [newConsent, ...prev.consents],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record consent';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [user, supabase]);

  const hasConsented = useCallback((type: string): boolean => {
    // Find the most recent consent entry for the given type
    // Consents are already ordered by created_at DESC, so the first match is the latest
    const latest = state.consents.find(c => c.consent_type === type);
    return latest?.consented === true;
  }, [state.consents]);

  const refresh = useCallback(async () => {
    await fetchConsents();
  }, [fetchConsents]);

  return {
    ...state,
    recordConsent,
    hasConsented,
    refresh,
  };
}
