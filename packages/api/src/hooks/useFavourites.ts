// useFavourites Hook - Tenant Favourite Listings
// Manages favourite listings for tenants with optimistic updates

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface FavouriteListing {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface FavouritesState {
  favourites: FavouriteListing[];
  favouriteIds: Set<string>;
  loading: boolean;
  error: string | null;
}

export interface UseFavouritesReturn extends FavouritesState {
  isFavourite: (listingId: string) => boolean;
  toggleFavourite: (listingId: string) => Promise<boolean>;
  refreshFavourites: () => Promise<void>;
}

export function useFavourites(): UseFavouritesReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<FavouritesState>({
    favourites: [],
    favouriteIds: new Set<string>(),
    loading: true,
    error: null,
  });

  const fetchFavourites = useCallback(async () => {
    if (!user) {
      setState({ favourites: [], favouriteIds: new Set<string>(), loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('favourite_listings') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const favourites = (data || []) as FavouriteListing[];
      const favouriteIds = new Set<string>(favourites.map(f => f.listing_id));

      setState({
        favourites,
        favouriteIds,
        loading: false,
        error: null,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch favourites';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFavourites();
    }
  }, [fetchFavourites, isAuthenticated]);

  const isFavourite = useCallback((listingId: string): boolean => {
    return state.favouriteIds.has(listingId);
  }, [state.favouriteIds]);

  const toggleFavourite = useCallback(async (listingId: string): Promise<boolean> => {
    if (!user) return false;

    const currentlyFavourited = state.favouriteIds.has(listingId);

    // Optimistic update: immediately update local state
    if (currentlyFavourited) {
      setState(prev => {
        const newFavourites = prev.favourites.filter(f => f.listing_id !== listingId);
        const newIds = new Set<string>(newFavourites.map(f => f.listing_id));
        return { ...prev, favourites: newFavourites, favouriteIds: newIds };
      });
    } else {
      const optimisticFavourite: FavouriteListing = {
        id: `optimistic-${listingId}`,
        user_id: user.id,
        listing_id: listingId,
        created_at: new Date().toISOString(),
      };
      setState(prev => {
        const newFavourites = [optimisticFavourite, ...prev.favourites];
        const newIds = new Set<string>(prev.favouriteIds);
        newIds.add(listingId);
        return { ...prev, favourites: newFavourites, favouriteIds: newIds };
      });
    }

    try {
      const supabase = getSupabaseClient();

      if (currentlyFavourited) {
        // Remove favourite
        const { error } = await (supabase
          .from('favourite_listings') as ReturnType<typeof supabase.from>)
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId);

        if (error) throw error;
      } else {
        // Add favourite
        const { error } = await (supabase
          .from('favourite_listings') as ReturnType<typeof supabase.from>)
          .insert({
            user_id: user.id,
            listing_id: listingId,
          });

        if (error) throw error;
      }

      // Refetch to get server-assigned IDs and accurate state
      await fetchFavourites();
      return true;
    } catch (caught) {
      // Revert optimistic update on failure
      await fetchFavourites();
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to toggle favourite';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, state.favouriteIds, fetchFavourites]);

  const refreshFavourites = useCallback(async () => {
    await fetchFavourites();
  }, [fetchFavourites]);

  return {
    ...state,
    isFavourite,
    toggleFavourite,
    refreshFavourites,
  };
}
