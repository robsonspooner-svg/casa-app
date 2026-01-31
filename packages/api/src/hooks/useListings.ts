// useListings Hook - Owner's Listings List
// Mission 04: Property Listings

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { Listing, ListingStatus, ListingWithDetails } from '../types/database';

export interface ListingsState {
  listings: ListingWithDetails[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface ListingsActions {
  refreshListings: () => Promise<void>;
}

export interface ListingsFilter {
  status?: ListingStatus;
}

export function useListings(filter?: ListingsFilter): ListingsState & ListingsActions {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ListingsState>({
    listings: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchListings = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ listings: [], loading: false, error: null, refreshing: false });
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

      let query = (supabase.from('listings') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) throw listingsError;

      const listings = (listingsData || []) as Listing[];

      // Fetch features for all listings
      const listingIds = listings.map(l => l.id);
      let featuresData: { listing_id: string; feature: string }[] = [];

      if (listingIds.length > 0) {
        const { data: features, error: featuresError } = await (supabase
          .from('listing_features') as ReturnType<typeof supabase.from>)
          .select('listing_id, feature')
          .in('listing_id', listingIds);

        if (featuresError) throw featuresError;
        featuresData = (features || []) as { listing_id: string; feature: string }[];
      }

      // Combine listings with features
      const listingsWithDetails: ListingWithDetails[] = listings.map(listing => ({
        ...listing,
        features: featuresData
          .filter(f => f.listing_id === listing.id)
          .map(f => f.feature),
      }));

      setState({
        listings: listingsWithDetails,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch listings';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, filter?.status]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchListings();
    }
  }, [fetchListings, isAuthenticated]);

  const refreshListings = useCallback(async () => {
    await fetchListings(true);
  }, [fetchListings]);

  return {
    ...state,
    refreshListings,
  };
}
