// useProperties Hook - Casa Property Management
// Mission 03: Properties CRUD

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { Property, PropertyWithImages, PropertyImage } from '../types/database';

export interface PropertiesState {
  properties: PropertyWithImages[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface PropertiesActions {
  refreshProperties: () => Promise<void>;
}

export interface PropertiesContextValue extends PropertiesState, PropertiesActions {}

export function useProperties(): PropertiesContextValue {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<PropertiesState>({
    properties: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchProperties = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ properties: [], loading: false, error: null, refreshing: false });
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

      // Fetch properties with images
      // Use type assertion to work around Supabase generic inference
      const { data: propertiesData, error: propertiesError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (propertiesError) throw propertiesError;

      // Fetch images for all properties
      const properties = (propertiesData || []) as Property[];
      const propertyIds = properties.map(p => p.id);
      let imagesData: PropertyImage[] = [];

      if (propertyIds.length > 0) {
        const { data: images, error: imagesError } = await (supabase
          .from('property_images') as ReturnType<typeof supabase.from>)
          .select('*')
          .in('property_id', propertyIds)
          .order('display_order', { ascending: true });

        if (imagesError) throw imagesError;
        imagesData = (images || []) as PropertyImage[];
      }

      // Combine properties with their images
      const propertiesWithImages: PropertyWithImages[] = properties.map(property => ({
        ...property,
        images: imagesData.filter(img => img.property_id === property.id),
      }));

      setState({
        properties: propertiesWithImages,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch properties';
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
      fetchProperties();
    }
  }, [fetchProperties, isAuthenticated]);

  const refreshProperties = useCallback(async () => {
    await fetchProperties(true);
  }, [fetchProperties]);

  return {
    ...state,
    refreshProperties,
  };
}

// Single property hook for detail views
export interface PropertyState {
  property: PropertyWithImages | null;
  loading: boolean;
  error: string | null;
}

export function useProperty(propertyId: string | null): PropertyState & { refreshProperty: () => Promise<void> } {
  const { user } = useAuth();
  const [state, setState] = useState<PropertyState>({
    property: null,
    loading: true,
    error: null,
  });

  const fetchProperty = useCallback(async () => {
    if (!user || !propertyId) {
      setState({ property: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // Fetch property
      const { data: propertyData, error: propertyError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', propertyId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .single();

      if (propertyError) throw propertyError;

      // Fetch images
      const { data: imagesData, error: imagesError } = await (supabase
        .from('property_images') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('property_id', propertyId)
        .order('display_order', { ascending: true });

      if (imagesError) throw imagesError;

      const propertyWithImages: PropertyWithImages = {
        ...(propertyData as Property),
        images: (imagesData || []) as PropertyImage[],
      };

      setState({
        property: propertyWithImages,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({
        property: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch property',
      });
    }
  }, [user, propertyId]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  return {
    ...state,
    refreshProperty: fetchProperty,
  };
}
