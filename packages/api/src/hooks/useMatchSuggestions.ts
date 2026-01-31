// useMatchSuggestions Hook - AI Tenant Matching for Owners
// Tenant-Owner Connection System

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  MatchSuggestion,
  MatchSuggestionWithDetails,
  MatchSuggestionStatus,
} from '../types/database';

export interface MatchSuggestionsState {
  suggestions: MatchSuggestionWithDetails[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface MatchSuggestionsActions {
  markViewed: (suggestionId: string) => Promise<void>;
  inviteTenant: (suggestionId: string) => Promise<void>;
  rejectSuggestion: (suggestionId: string) => Promise<void>;
  refreshSuggestions: () => Promise<void>;
}

/**
 * Hook for property owners to view and act on AI-generated tenant match suggestions.
 * @param propertyId - Optional: filter suggestions for a specific property
 */
export function useMatchSuggestions(propertyId?: string): MatchSuggestionsState & MatchSuggestionsActions {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<MatchSuggestionsState>({
    suggestions: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchSuggestions = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ suggestions: [], loading: false, error: null, refreshing: false });
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

      let query = (supabase
        .from('match_suggestions') as ReturnType<typeof supabase.from>)
        .select(`
          *,
          tenant:profiles!match_suggestions_tenant_id_fkey(id, full_name, email, avatar_url),
          tenant_availability:tenant_availability(*)
        `)
        .in('status', ['pending', 'viewed'])
        .gt('expires_at', new Date().toISOString())
        .order('match_score', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      // Filter to owner's properties
      const { data: ownerProperties } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('owner_id', user.id);

      const propertyIds = (ownerProperties || []).map((p: { id: string }) => p.id);

      if (propertyIds.length === 0) {
        setState({
          suggestions: [],
          loading: false,
          error: null,
          refreshing: false,
        });
        return;
      }

      const { data, error } = await query.in('property_id', propertyIds);

      if (error) throw error;

      setState({
        suggestions: (data || []) as MatchSuggestionWithDetails[],
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch match suggestions';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, propertyId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSuggestions();
    }
  }, [fetchSuggestions, isAuthenticated]);

  const updateSuggestionStatus = useCallback(async (
    suggestionId: string,
    status: MatchSuggestionStatus,
    additionalFields: Record<string, unknown> = {}
  ): Promise<void> => {
    if (!user) throw new Error('Must be authenticated');

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('match_suggestions') as ReturnType<typeof supabase.from>)
        .update({
          status,
          actioned_at: ['invited', 'rejected'].includes(status) ? new Date().toISOString() : undefined,
          viewed_at: status === 'viewed' ? new Date().toISOString() : undefined,
          ...additionalFields,
        })
        .eq('id', suggestionId);

      if (error) throw error;

      // Update local state
      setState(prev => ({
        ...prev,
        suggestions: prev.suggestions.map(s =>
          s.id === suggestionId
            ? { ...s, status, ...additionalFields }
            : s
        ),
      }));
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to update suggestion';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw caught;
    }
  }, [user]);

  const markViewed = useCallback(async (suggestionId: string): Promise<void> => {
    await updateSuggestionStatus(suggestionId, 'viewed');
  }, [updateSuggestionStatus]);

  const inviteTenant = useCallback(async (suggestionId: string): Promise<void> => {
    // When implemented fully, this will:
    // 1. Create a connection code for the tenant
    // 2. Send the invitation via the messaging system
    // 3. Update the suggestion status
    await updateSuggestionStatus(suggestionId, 'invited');
  }, [updateSuggestionStatus]);

  const rejectSuggestion = useCallback(async (suggestionId: string): Promise<void> => {
    await updateSuggestionStatus(suggestionId, 'rejected');
    // Remove from local list
    setState(prev => ({
      ...prev,
      suggestions: prev.suggestions.filter(s => s.id !== suggestionId),
    }));
  }, [updateSuggestionStatus]);

  const refreshSuggestions = useCallback(async () => {
    await fetchSuggestions(true);
  }, [fetchSuggestions]);

  return {
    ...state,
    markViewed,
    inviteTenant,
    rejectSuggestion,
    refreshSuggestions,
  };
}
