// useMyMaintenance Hook - Tenant's Own Maintenance Requests
// Mission 09: Maintenance Requests

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  MaintenanceRequest,
  MaintenanceStatus,
  Property,
} from '../types/database';

export interface MyMaintenanceFilter {
  status?: MaintenanceStatus;
  showCompleted?: boolean;
}

export interface MyMaintenanceItem extends MaintenanceRequest {
  property?: Pick<Property, 'id' | 'address_line_1' | 'suburb'>;
}

export interface MyMaintenanceState {
  requests: MyMaintenanceItem[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useMyMaintenance(filter?: MyMaintenanceFilter): MyMaintenanceState & {
  refreshRequests: () => Promise<void>;
  activeCount: number;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<MyMaintenanceState>({
    requests: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchRequests = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ requests: [], loading: false, error: null, refreshing: false });
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

      let query = (supabase
        .from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      if (!filter?.showCompleted) {
        query = query.not('status', 'in', '("completed","cancelled")');
      }

      const { data: requestsData, error: requestsError } = await query;

      if (requestsError) throw requestsError;

      const requests = (requestsData || []) as MaintenanceRequest[];

      if (requests.length === 0) {
        setState({ requests: [], loading: false, error: null, refreshing: false });
        return;
      }

      // Fetch property info
      const propertyIds = [...new Set(requests.map(r => r.property_id))];
      const { data: properties } = await supabase
        .from('properties')
        .select('id, address_line_1, suburb')
        .in('id', propertyIds);

      const propertyMap = (properties || []).reduce((map, p: any) => {
        map[p.id] = p as Pick<Property, 'id' | 'address_line_1' | 'suburb'>;
        return map;
      }, {} as Record<string, Pick<Property, 'id' | 'address_line_1' | 'suburb'>>);

      const enriched: MyMaintenanceItem[] = requests.map(r => ({
        ...r,
        property: propertyMap[r.property_id],
      }));

      setState({
        requests: enriched,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch maintenance requests';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, filter?.status, filter?.showCompleted]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequests();
    }
  }, [fetchRequests, isAuthenticated]);

  const refreshRequests = useCallback(async () => {
    await fetchRequests(true);
  }, [fetchRequests]);

  const activeCount = state.requests.filter(
    r => r.status !== 'completed' && r.status !== 'cancelled'
  ).length;

  return {
    ...state,
    refreshRequests,
    activeCount,
  };
}
