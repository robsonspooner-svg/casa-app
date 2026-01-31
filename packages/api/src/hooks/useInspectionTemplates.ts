// useInspectionTemplates Hook - Inspection Templates List
// Mission 11: Property Inspections

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  InspectionTemplateRow,
  InspectionTemplateRoomRow,
} from '../types/database';

export interface TemplateWithRooms extends InspectionTemplateRow {
  rooms: InspectionTemplateRoomRow[];
}

export interface InspectionTemplatesState {
  templates: TemplateWithRooms[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useInspectionTemplates(): InspectionTemplatesState & {
  refreshTemplates: () => Promise<void>;
  defaultTemplate: TemplateWithRooms | null;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<InspectionTemplatesState>({
    templates: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchTemplates = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ templates: [], loading: false, error: null, refreshing: false });
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

      // Fetch templates (system defaults + owner's own)
      const { data: templatesData, error: templatesError } = await (supabase
        .from('inspection_templates') as ReturnType<typeof supabase.from>)
        .select('*')
        .order('is_default', { ascending: false });

      if (templatesError) throw templatesError;

      const templates = (templatesData || []) as InspectionTemplateRow[];

      if (templates.length === 0) {
        setState({ templates: [], loading: false, error: null, refreshing: false });
        return;
      }

      // Fetch all rooms for these templates
      const templateIds = templates.map(t => t.id);
      const { data: roomsData, error: roomsError } = await (supabase
        .from('inspection_template_rooms') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('template_id', templateIds)
        .order('display_order', { ascending: true });

      if (roomsError) throw roomsError;

      const rooms = (roomsData || []) as InspectionTemplateRoomRow[];

      // Group rooms by template
      const templatesWithRooms: TemplateWithRooms[] = templates.map(t => ({
        ...t,
        rooms: rooms.filter(r => r.template_id === t.id),
      }));

      setState({
        templates: templatesWithRooms,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch templates';
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
      fetchTemplates();
    }
  }, [fetchTemplates, isAuthenticated]);

  const refreshTemplates = useCallback(async () => {
    await fetchTemplates(true);
  }, [fetchTemplates]);

  const defaultTemplate = useMemo(
    () => state.templates.find(t => t.is_default) || null,
    [state.templates]
  );

  return {
    ...state,
    refreshTemplates,
    defaultTemplate,
  };
}
