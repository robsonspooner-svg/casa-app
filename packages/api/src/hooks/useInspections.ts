// useInspections Hook - All Inspections List (Owner)
// Mission 11: Property Inspections

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  InspectionRow,
  InspectionType,
  InspectionStatus,
  Property,
} from '../types/database';

export interface InspectionFilter {
  propertyId?: string;
  type?: InspectionType;
  status?: InspectionStatus;
  excludeCompleted?: boolean;
}

export interface InspectionSummary {
  total: number;
  byStatus: Partial<Record<InspectionStatus, number>>;
  byType: Partial<Record<InspectionType, number>>;
  upcomingCount: number;
  overdueCount: number;
}

export interface InspectionListItem extends InspectionRow {
  property?: Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>;
}

export interface InspectionsState {
  inspections: InspectionListItem[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useInspections(filter?: InspectionFilter): InspectionsState & {
  refreshInspections: () => Promise<void>;
  summary: InspectionSummary;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<InspectionsState>({
    inspections: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchInspections = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ inspections: [], loading: false, error: null, refreshing: false });
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

      // Get owner's properties to scope the query
      const { data: properties } = await supabase
        .from('properties')
        .select('id, address_line_1, suburb, state')
        .eq('owner_id', user.id);

      if (!properties || properties.length === 0) {
        setState({ inspections: [], loading: false, error: null, refreshing: false });
        return;
      }

      const propertyIds = properties.map((p: any) => p.id);
      const propertyMap = properties.reduce((map: Record<string, Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>>, p: any) => {
        map[p.id] = p as Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>;
        return map;
      }, {} as Record<string, Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>>);

      // Build query
      let query = (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('property_id', propertyIds)
        .order('scheduled_date', { ascending: false });

      if (filter?.propertyId) {
        query = query.eq('property_id', filter.propertyId);
      }

      if (filter?.type) {
        query = query.eq('inspection_type', filter.type);
      }

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      if (filter?.excludeCompleted) {
        query = query.not('status', 'in', '("completed","cancelled","finalized")');
      }

      const { data: inspectionsData, error: inspectionsError } = await query;

      if (inspectionsError) throw inspectionsError;

      const inspections = (inspectionsData || []) as InspectionRow[];

      // Combine with property data
      const enriched: InspectionListItem[] = inspections.map(i => ({
        ...i,
        property: propertyMap[i.property_id],
      }));

      setState({
        inspections: enriched,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch inspections';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, filter?.propertyId, filter?.type, filter?.status, filter?.excludeCompleted]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInspections();
    }
  }, [fetchInspections, isAuthenticated]);

  const refreshInspections = useCallback(async () => {
    await fetchInspections(true);
  }, [fetchInspections]);

  const summary = useMemo<InspectionSummary>(() => {
    const today = new Date().toISOString().split('T')[0];
    const result: InspectionSummary = {
      total: state.inspections.length,
      byStatus: {},
      byType: {},
      upcomingCount: 0,
      overdueCount: 0,
    };

    state.inspections.forEach(i => {
      result.byStatus[i.status] = (result.byStatus[i.status] || 0) + 1;
      result.byType[i.inspection_type] = (result.byType[i.inspection_type] || 0) + 1;
      if (i.status === 'scheduled' && i.scheduled_date >= today) {
        result.upcomingCount += 1;
      }
      if (i.status === 'scheduled' && i.scheduled_date < today) {
        result.overdueCount += 1;
      }
    });

    return result;
  }, [state.inspections]);

  return {
    ...state,
    refreshInspections,
    summary,
  };
}
