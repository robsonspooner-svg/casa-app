// useFeatureOptions Hook - Available Amenities/Features
// Mission 04: Property Listings

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type { FeatureOption } from '../types/database';

export interface FeatureOptionsState {
  features: FeatureOption[];
  featuresByCategory: Record<string, FeatureOption[]>;
  loading: boolean;
  error: string | null;
}

export function useFeatureOptions(): FeatureOptionsState {
  const [state, setState] = useState<FeatureOptionsState>({
    features: [],
    featuresByCategory: {},
    loading: true,
    error: null,
  });

  const fetchFeatures = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('feature_options') as ReturnType<typeof supabase.from>)
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      const features = (data || []) as FeatureOption[];

      // Group by category
      const featuresByCategory: Record<string, FeatureOption[]> = {};
      for (const feature of features) {
        if (!featuresByCategory[feature.category]) {
          featuresByCategory[feature.category] = [];
        }
        featuresByCategory[feature.category].push(feature);
      }

      setState({
        features,
        featuresByCategory,
        loading: false,
        error: null,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch feature options';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  return state;
}
