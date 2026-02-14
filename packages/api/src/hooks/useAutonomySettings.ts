// useAutonomySettings Hook - Agent Autonomy Preferences
// Mission 14: AI Agent Autonomy Configuration

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  AgentAutonomySettings,
  AutonomyPreset,
  AutonomyLevel,
  AgentTaskCategory,
} from '../types/database';

// Default autonomy levels per category for each preset
const PRESET_DEFAULTS: Record<AutonomyPreset, Record<AgentTaskCategory, AutonomyLevel>> = {
  cautious: {
    tenant_finding: 'L1',
    lease_management: 'L0',
    rent_collection: 'L1',
    maintenance: 'L1',
    compliance: 'L0',
    general: 'L1',
    inspections: 'L1',
    listings: 'L1',
    financial: 'L0',
    insurance: 'L0',
    communication: 'L1',
  },
  balanced: {
    tenant_finding: 'L2',
    lease_management: 'L1',
    rent_collection: 'L2',
    maintenance: 'L2',
    compliance: 'L1',
    general: 'L2',
    inspections: 'L2',
    listings: 'L2',
    financial: 'L1',
    insurance: 'L1',
    communication: 'L2',
  },
  hands_off: {
    tenant_finding: 'L3',
    lease_management: 'L2',
    rent_collection: 'L3',
    maintenance: 'L3',
    compliance: 'L2',
    general: 'L3',
    inspections: 'L3',
    listings: 'L3',
    financial: 'L2',
    insurance: 'L2',
    communication: 'L3',
  },
  custom: {
    tenant_finding: 'L2',
    lease_management: 'L1',
    rent_collection: 'L2',
    maintenance: 'L2',
    compliance: 'L1',
    general: 'L2',
    inspections: 'L2',
    listings: 'L2',
    financial: 'L1',
    insurance: 'L1',
    communication: 'L2',
  },
};

export interface AutonomySettingsState {
  settings: AgentAutonomySettings | null;
  loading: boolean;
  error: string | null;
}

export interface UseAutonomySettingsReturn extends AutonomySettingsState {
  preset: AutonomyPreset;
  categoryLevels: Record<string, AutonomyLevel>;
  updatePreset: (preset: AutonomyPreset) => Promise<boolean>;
  updateCategoryLevel: (category: string, level: AutonomyLevel) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
}

export function useAutonomySettings(): UseAutonomySettingsReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<AutonomySettingsState>({
    settings: null,
    loading: true,
    error: null,
  });

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setState({ settings: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('agent_autonomy_settings') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no settings row exists yet, that is not an error; use defaults
        if (error.code === 'PGRST116') {
          setState({
            settings: null,
            loading: false,
            error: null,
          });
          return;
        }
        throw error;
      }

      setState({
        settings: data as AgentAutonomySettings,
        loading: false,
        error: null,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch autonomy settings';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [fetchSettings, isAuthenticated]);

  const refreshSettings = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  // Derive the current preset
  const preset: AutonomyPreset = state.settings?.preset || 'balanced';

  // Derive category levels from preset defaults plus any overrides
  const categoryLevels = useMemo((): Record<string, AutonomyLevel> => {
    const defaults = PRESET_DEFAULTS[preset] || PRESET_DEFAULTS.balanced;
    const overrides = state.settings?.category_overrides || {};

    return {
      ...defaults,
      ...overrides,
    };
  }, [preset, state.settings?.category_overrides]);

  const updatePreset = useCallback(async (newPreset: AutonomyPreset): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      if (state.settings) {
        // Update existing settings
        const { error } = await (supabase
          .from('agent_autonomy_settings') as ReturnType<typeof supabase.from>)
          .update({
            preset: newPreset,
            // Clear category overrides when switching to a non-custom preset
            category_overrides: newPreset === 'custom' ? state.settings.category_overrides : {},
          })
          .eq('id', state.settings.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new settings row
        const { error } = await (supabase
          .from('agent_autonomy_settings') as ReturnType<typeof supabase.from>)
          .insert({
            user_id: user.id,
            preset: newPreset,
            category_overrides: {},
          });

        if (error) throw error;
      }

      // Refresh to get the persisted state
      await fetchSettings();
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to update preset';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, state.settings, fetchSettings]);

  const updateCategoryLevel = useCallback(async (category: string, level: AutonomyLevel): Promise<boolean> => {
    if (!user) return false;

    const validCategories: string[] = Object.keys(PRESET_DEFAULTS.balanced);
    if (!validCategories.includes(category)) {
      setState(prev => ({ ...prev, error: `Invalid category: ${category}` }));
      return false;
    }

    try {
      const supabase = getSupabaseClient();

      const currentOverrides = state.settings?.category_overrides || {};
      const updatedOverrides = { ...currentOverrides, [category]: level };

      if (state.settings) {
        const { error } = await (supabase
          .from('agent_autonomy_settings') as ReturnType<typeof supabase.from>)
          .update({
            preset: 'custom' as AutonomyPreset,
            category_overrides: updatedOverrides,
          })
          .eq('id', state.settings.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('agent_autonomy_settings') as ReturnType<typeof supabase.from>)
          .insert({
            user_id: user.id,
            preset: 'custom' as AutonomyPreset,
            category_overrides: updatedOverrides,
          });

        if (error) throw error;
      }

      await fetchSettings();
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to update category level';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, state.settings, fetchSettings]);

  return {
    ...state,
    preset,
    categoryLevels,
    updatePreset,
    updateCategoryLevel,
    refreshSettings,
  };
}
