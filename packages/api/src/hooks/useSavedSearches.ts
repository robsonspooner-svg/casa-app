// useSavedSearches Hook - Saved Search Filters for Tenant Marketplace
// Mission 04: Property Listings

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { PublicListingsSearchParams } from './usePublicListings';

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: PublicListingsSearchParams;
  alerts_enabled: boolean;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchesState {
  savedSearches: SavedSearch[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface UseSavedSearchesReturn extends SavedSearchesState {
  saveSearch: (name: string, filters: PublicListingsSearchParams) => Promise<boolean>;
  deleteSearch: (id: string) => Promise<boolean>;
  toggleAlerts: (id: string, enabled: boolean) => Promise<boolean>;
  refreshSearches: () => Promise<void>;
}

export function useSavedSearches(): UseSavedSearchesReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<SavedSearchesState>({
    savedSearches: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchSearches = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ savedSearches: [], loading: false, error: null, refreshing: false });
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
        .from('saved_searches') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setState({
        savedSearches: (data || []) as SavedSearch[],
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch saved searches';
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
      fetchSearches();
    }
  }, [fetchSearches, isAuthenticated]);

  const refreshSearches = useCallback(async () => {
    await fetchSearches(true);
  }, [fetchSearches]);

  const saveSearch = useCallback(async (name: string, filters: PublicListingsSearchParams): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('saved_searches') as ReturnType<typeof supabase.from>)
        .insert({
          user_id: user.id,
          name,
          filters,
          alerts_enabled: false,
        });

      if (error) throw error;

      await fetchSearches();
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to save search';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, fetchSearches]);

  const deleteSearch = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('saved_searches') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Optimistically update local state
      setState(prev => ({
        ...prev,
        savedSearches: prev.savedSearches.filter(s => s.id !== id),
      }));

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to delete saved search';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user]);

  const toggleAlerts = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('saved_searches') as ReturnType<typeof supabase.from>)
        .update({ alerts_enabled: enabled })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Optimistically update local state
      setState(prev => ({
        ...prev,
        savedSearches: prev.savedSearches.map(s =>
          s.id === id ? { ...s, alerts_enabled: enabled } : s
        ),
      }));

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to toggle alerts';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user]);

  return {
    ...state,
    saveSearch,
    deleteSearch,
    toggleAlerts,
    refreshSearches,
  };
}
