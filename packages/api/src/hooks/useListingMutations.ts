// useListingMutations Hook - Create/Update/Close Listings
// Mission 04: Property Listings

import { useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { ListingInsert, ListingUpdate, Listing } from '../types/database';

export interface ListingMutations {
  createListing: (data: Omit<ListingInsert, 'owner_id'>, features?: string[]) => Promise<Listing>;
  updateListing: (id: string, data: ListingUpdate, features?: string[]) => Promise<Listing>;
  publishListing: (id: string) => Promise<Listing>;
  pauseListing: (id: string) => Promise<Listing>;
  closeListing: (id: string, reason?: string) => Promise<Listing>;
  deleteListing: (id: string) => Promise<void>;
}

export function useListingMutations(): ListingMutations {
  const { user } = useAuth();

  const createListing = useCallback(async (
    data: Omit<ListingInsert, 'owner_id'>,
    features?: string[]
  ): Promise<Listing> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const insertData: ListingInsert = {
      ...data,
      owner_id: user.id,
    };

    const { data: listing, error } = await (supabase
      .from('listings') as ReturnType<typeof supabase.from>)
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const createdListing = listing as Listing;

    // Insert features if provided
    if (features && features.length > 0) {
      const featureInserts = features.map(feature => ({
        listing_id: createdListing.id,
        feature,
      }));

      const { error: featuresError } = await (supabase
        .from('listing_features') as ReturnType<typeof supabase.from>)
        .insert(featureInserts);

      if (featuresError) throw new Error(featuresError.message);
    }

    return createdListing;
  }, [user]);

  const updateListing = useCallback(async (
    id: string,
    data: ListingUpdate,
    features?: string[]
  ): Promise<Listing> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { data: listing, error } = await (supabase
      .from('listings') as ReturnType<typeof supabase.from>)
      .update(data)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Replace features if provided
    if (features !== undefined) {
      // Delete existing features
      await (supabase
        .from('listing_features') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('listing_id', id);

      // Insert new features
      if (features.length > 0) {
        const featureInserts = features.map(feature => ({
          listing_id: id,
          feature,
        }));

        const { error: featuresError } = await (supabase
          .from('listing_features') as ReturnType<typeof supabase.from>)
          .insert(featureInserts);

        if (featuresError) throw new Error(featuresError.message);
      }
    }

    return listing as Listing;
  }, [user]);

  const publishListing = useCallback(async (id: string): Promise<Listing> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { data: listing, error } = await (supabase
      .from('listings') as ReturnType<typeof supabase.from>)
      .update({
        status: 'active',
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return listing as Listing;
  }, [user]);

  const pauseListing = useCallback(async (id: string): Promise<Listing> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { data: listing, error } = await (supabase
      .from('listings') as ReturnType<typeof supabase.from>)
      .update({ status: 'paused' })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return listing as Listing;
  }, [user]);

  const closeListing = useCallback(async (id: string, reason?: string): Promise<Listing> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { data: listing, error } = await (supabase
      .from('listings') as ReturnType<typeof supabase.from>)
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        close_reason: reason || null,
      })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return listing as Listing;
  }, [user]);

  const deleteListing = useCallback(async (id: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('listings') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) throw new Error(error.message);
  }, [user]);

  return {
    createListing,
    updateListing,
    publishListing,
    pauseListing,
    closeListing,
    deleteListing,
  };
}
