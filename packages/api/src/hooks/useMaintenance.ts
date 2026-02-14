// useMaintenance Hook - All Maintenance Requests (Owner)
// Mission 09: Maintenance Requests

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenanceUrgency,
  MaintenanceCategory,
  Property,
  Profile,
} from '../types/database';

export interface MaintenanceFilter {
  propertyId?: string;
  status?: MaintenanceStatus;
  urgency?: MaintenanceUrgency;
  category?: MaintenanceCategory;
  excludeCompleted?: boolean;
}

export interface MaintenanceSummary {
  total: number;
  byStatus: Partial<Record<MaintenanceStatus, number>>;
  byUrgency: Partial<Record<MaintenanceUrgency, number>>;
  emergencyCount: number;
}

export interface MaintenanceListItem extends MaintenanceRequest {
  property?: Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>;
  tenant?: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>;
}

export interface MaintenanceState {
  requests: MaintenanceListItem[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useMaintenance(filter?: MaintenanceFilter): MaintenanceState & {
  refreshRequests: () => Promise<void>;
  summary: MaintenanceSummary;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<MaintenanceState>({
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

      // First get owner's properties to scope the query
      const { data: properties } = await supabase
        .from('properties')
        .select('id, address_line_1, suburb, state')
        .eq('owner_id', user.id);

      if (!properties || properties.length === 0) {
        setState({ requests: [], loading: false, error: null, refreshing: false });
        return;
      }

      const propertyIds = properties.map((p: any) => p.id);
      const propertyMap = properties.reduce((map: Record<string, Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>>, p: any) => {
        map[p.id] = p as Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>;
        return map;
      }, {} as Record<string, Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>>);

      // Build query
      let query = (supabase
        .from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('property_id', propertyIds)
        .order('created_at', { ascending: false });

      if (filter?.propertyId) {
        query = query.eq('property_id', filter.propertyId);
      }

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      if (filter?.urgency) {
        query = query.eq('urgency', filter.urgency);
      }

      if (filter?.category) {
        query = query.eq('category', filter.category);
      }

      if (filter?.excludeCompleted) {
        query = query.not('status', 'in', '("completed","cancelled")');
      }

      const { data: requestsData, error: requestsError } = await query;

      if (requestsError) throw requestsError;

      const requests = (requestsData || []) as MaintenanceRequest[];

      if (requests.length === 0) {
        setState({ requests: [], loading: false, error: null, refreshing: false });
        return;
      }

      // Fetch tenant profiles
      const tenantIds = [...new Set(requests.map(r => r.tenant_id))];
      const { data: tenants } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', tenantIds);

      const tenantMap = (tenants || []).reduce((map, t: any) => {
        map[t.id] = t as Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>;
        return map;
      }, {} as Record<string, Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>>);

      // Combine data
      const enriched: MaintenanceListItem[] = requests.map(r => ({
        ...r,
        property: propertyMap[r.property_id],
        tenant: tenantMap[r.tenant_id],
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
  }, [user, filter?.propertyId, filter?.status, filter?.urgency, filter?.category, filter?.excludeCompleted]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequests();
    }
  }, [fetchRequests, isAuthenticated]);

  // Refresh data when screen gains focus (e.g. navigating back)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchRequests(true);
      }
    }, [fetchRequests, isAuthenticated])
  );

  // Realtime subscription for live updates
  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseClient();

    // We need property IDs to filter, but we can subscribe broadly and re-fetch
    const channel = supabase
      .channel('owner-maintenance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_requests',
        },
        () => {
          // Re-fetch on any change to maintenance_requests
          fetchRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'maintenance_comments',
        },
        () => {
          // Re-fetch when new comments arrive (may affect display)
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchRequests]);

  const refreshRequests = useCallback(async () => {
    await fetchRequests(true);
  }, [fetchRequests]);

  // Calculate summary
  const summary: MaintenanceSummary = {
    total: state.requests.length,
    byStatus: {},
    byUrgency: {},
    emergencyCount: 0,
  };

  state.requests.forEach(r => {
    summary.byStatus[r.status] = (summary.byStatus[r.status] || 0) + 1;
    summary.byUrgency[r.urgency] = (summary.byUrgency[r.urgency] || 0) + 1;
    if (r.urgency === 'emergency' && r.status !== 'completed' && r.status !== 'cancelled') {
      summary.emergencyCount += 1;
    }
  });

  return {
    ...state,
    refreshRequests,
    summary,
  };
}
