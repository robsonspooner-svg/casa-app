// usePublicListings Hook - Tenant-facing Search
// Mission 04: Property Listings

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type {
  Listing,
  ListingWithDetails,
  Property,
  PropertyImage,
  PropertyWithImages,
} from '../types/database';

export interface PublicListingsSearchParams {
  suburb?: string;
  minRent?: number;
  maxRent?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  propertyType?: string;
  petsAllowed?: boolean;
  furnished?: boolean;
  sortBy?: 'newest' | 'price_low' | 'price_high';
}

export interface PublicListingsState {
  listings: ListingWithDetails[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function usePublicListings(params?: PublicListingsSearchParams): PublicListingsState & {
  refreshListings: () => Promise<void>;
  searchListings: (newParams: PublicListingsSearchParams) => Promise<void>;
} {
  const [searchParams, setSearchParams] = useState<PublicListingsSearchParams>(params || {});
  const [state, setState] = useState<PublicListingsState>({
    listings: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchListings = useCallback(async (isRefresh = false) => {
    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const supabase = getSupabaseClient();

      // Active listings only (public view)
      let query = (supabase.from('listings') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('status', 'active')
        .order('published_at', { ascending: false });

      if (searchParams.minRent) {
        query = query.gte('rent_amount', searchParams.minRent);
      }
      if (searchParams.maxRent) {
        query = query.lte('rent_amount', searchParams.maxRent);
      }

      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) throw listingsError;

      const listings = (listingsData || []) as Listing[];

      // Fetch properties for these listings to get address and property details
      const propertyIds = [...new Set(listings.map(l => l.property_id))];
      let propertiesData: Property[] = [];
      let imagesData: PropertyImage[] = [];

      if (propertyIds.length > 0) {
        const { data: properties, error: propertiesError } = await (supabase
          .from('properties') as ReturnType<typeof supabase.from>)
          .select('*')
          .in('id', propertyIds);

        if (propertiesError) throw propertiesError;
        propertiesData = (properties || []) as Property[];

        // Fetch images
        const { data: images, error: imagesError } = await (supabase
          .from('property_images') as ReturnType<typeof supabase.from>)
          .select('*')
          .in('property_id', propertyIds)
          .order('display_order', { ascending: true });

        if (imagesError) throw imagesError;
        imagesData = (images || []) as PropertyImage[];
      }

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

      // Combine everything
      let listingsWithDetails: ListingWithDetails[] = listings.map(listing => {
        const property = propertiesData.find(p => p.id === listing.property_id);
        const propertyWithImages: PropertyWithImages | undefined = property
          ? {
              ...property,
              images: imagesData.filter(img => img.property_id === property.id),
            }
          : undefined;

        return {
          ...listing,
          features: featuresData
            .filter(f => f.listing_id === listing.id)
            .map(f => f.feature),
          property: propertyWithImages,
        };
      });

      // Client-side filters that depend on property data
      if (searchParams.suburb) {
        const suburbLower = searchParams.suburb.toLowerCase();
        listingsWithDetails = listingsWithDetails.filter(l =>
          l.property?.suburb.toLowerCase().includes(suburbLower)
        );
      }
      if (searchParams.minBedrooms) {
        listingsWithDetails = listingsWithDetails.filter(l =>
          (l.property?.bedrooms || 0) >= searchParams.minBedrooms!
        );
      }
      if (searchParams.minBathrooms) {
        listingsWithDetails = listingsWithDetails.filter(l =>
          (l.property?.bathrooms || 0) >= searchParams.minBathrooms!
        );
      }
      if (searchParams.propertyType) {
        listingsWithDetails = listingsWithDetails.filter(l =>
          l.property?.property_type === searchParams.propertyType
        );
      }
      if (searchParams.petsAllowed === true) {
        listingsWithDetails = listingsWithDetails.filter(l => l.pets_allowed === true);
      }
      if (searchParams.furnished === true) {
        listingsWithDetails = listingsWithDetails.filter(l => l.furnished === true);
      }

      // Sort
      if (searchParams.sortBy === 'price_low') {
        listingsWithDetails.sort((a, b) => Number(a.rent_amount) - Number(b.rent_amount));
      } else if (searchParams.sortBy === 'price_high') {
        listingsWithDetails.sort((a, b) => Number(b.rent_amount) - Number(a.rent_amount));
      }
      // Default (newest) is already sorted by published_at desc from query

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
  }, [searchParams]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const refreshListings = useCallback(async () => {
    await fetchListings(true);
  }, [fetchListings]);

  const searchListings = useCallback(async (newParams: PublicListingsSearchParams) => {
    setSearchParams(newParams);
  }, []);

  return {
    ...state,
    refreshListings,
    searchListings,
  };
}
