// useListing Hook - Single Listing Detail
// Mission 04: Property Listings

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  Listing,
  ListingWithDetails,
  Property,
  PropertyImage,
  PropertyWithImages,
} from '../types/database';

export interface ListingState {
  listing: ListingWithDetails | null;
  loading: boolean;
  error: string | null;
}

export function useListing(listingId: string | null): ListingState & { refreshListing: () => Promise<void> } {
  const { user } = useAuth();
  const [state, setState] = useState<ListingState>({
    listing: null,
    loading: true,
    error: null,
  });

  const fetchListing = useCallback(async () => {
    if (!user || !listingId) {
      setState({ listing: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // Fetch listing
      const { data: listingData, error: listingError } = await (supabase
        .from('listings') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', listingId)
        .eq('owner_id', user.id)
        .single();

      if (listingError) throw listingError;

      const listing = listingData as Listing;

      // Fetch features
      const { data: featuresData, error: featuresError } = await (supabase
        .from('listing_features') as ReturnType<typeof supabase.from>)
        .select('feature')
        .eq('listing_id', listingId);

      if (featuresError) throw featuresError;

      // Fetch associated property with images
      const { data: propertyData, error: propertyError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', listing.property_id)
        .single();

      if (propertyError) throw propertyError;

      const property = propertyData as Property;

      // Fetch property images
      const { data: imagesData, error: imagesError } = await (supabase
        .from('property_images') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('property_id', property.id)
        .order('display_order', { ascending: true });

      if (imagesError) throw imagesError;

      const propertyWithImages: PropertyWithImages = {
        ...property,
        images: (imagesData || []) as PropertyImage[],
      };

      const listingWithDetails: ListingWithDetails = {
        ...listing,
        features: ((featuresData || []) as { feature: string }[]).map(f => f.feature),
        property: propertyWithImages,
      };

      setState({
        listing: listingWithDetails,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({
        listing: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch listing',
      });
    }
  }, [user, listingId]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  return {
    ...state,
    refreshListing: fetchListing,
  };
}
