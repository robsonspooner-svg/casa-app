// useMyInspections Hook - Tenant's own inspections
// Mission 11: Property Inspections

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  InspectionRow,
  InspectionStatus,
  Property,
} from '../types/database';

export interface MyInspectionsFilter {
  showCompleted?: boolean;
}

export interface MyInspectionItem extends InspectionRow {
  property?: Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>;
}

export interface MyInspectionsState {
  inspections: MyInspectionItem[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  activeCount: number;
}

export function useMyInspections(filter?: MyInspectionsFilter): MyInspectionsState & {
  refreshInspections: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<MyInspectionsState>({
    inspections: [],
    loading: true,
    error: null,
    refreshing: false,
    activeCount: 0,
  });

  const fetchInspections = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ inspections: [], loading: false, error: null, refreshing: false, activeCount: 0 });
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

      // Get tenancies where this user is a tenant
      const { data: tenancyLinks } = await supabase
        .from('tenancy_tenants')
        .select('tenancy_id')
        .eq('tenant_id', user.id);

      if (!tenancyLinks || tenancyLinks.length === 0) {
        setState({ inspections: [], loading: false, error: null, refreshing: false, activeCount: 0 });
        return;
      }

      const tenancyIds = tenancyLinks.map((t: any) => t.tenancy_id);

      // Build query
      let query = (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('tenancy_id', tenancyIds)
        .order('scheduled_date', { ascending: false });

      if (!filter?.showCompleted) {
        query = query.not('status', 'in', '("cancelled","finalized")');
      }

      const { data: inspectionsData, error: inspectionsError } = await query;

      if (inspectionsError) throw inspectionsError;

      const inspections = (inspectionsData || []) as InspectionRow[];

      if (inspections.length === 0) {
        setState({ inspections: [], loading: false, error: null, refreshing: false, activeCount: 0 });
        return;
      }

      // Fetch properties
      const propertyIds = [...new Set(inspections.map(i => i.property_id))];
      const { data: properties } = await supabase
        .from('properties')
        .select('id, address_line_1, suburb, state')
        .in('id', propertyIds);

      const propertyMap = (properties || []).reduce((map: Record<string, any>, p: any) => {
        map[p.id] = p;
        return map;
      }, {} as Record<string, any>);

      const enriched: MyInspectionItem[] = inspections.map(i => ({
        ...i,
        property: propertyMap[i.property_id],
      }));

      const activeCount = enriched.filter(i =>
        !['cancelled', 'finalized'].includes(i.status)
      ).length;

      setState({
        inspections: enriched,
        loading: false,
        error: null,
        refreshing: false,
        activeCount,
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
  }, [user, filter?.showCompleted]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInspections();
    }
  }, [fetchInspections, isAuthenticated]);

  const refreshInspections = useCallback(async () => {
    await fetchInspections(true);
  }, [fetchInspections]);

  return {
    ...state,
    refreshInspections,
  };
}
