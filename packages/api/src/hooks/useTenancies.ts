// useTenancies Hook - Owner's Tenancies List
// Mission 06: Tenancies & Leases

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { Tenancy, TenancyStatus, TenancyWithDetails, TenancyTenant, Profile } from '../types/database';

export interface TenanciesState {
  tenancies: TenancyWithDetails[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface TenanciesFilter {
  status?: TenancyStatus;
  propertyId?: string;
}

export function useTenancies(filter?: TenanciesFilter): TenanciesState & { refreshTenancies: () => Promise<void> } {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<TenanciesState>({
    tenancies: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchTenancies = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ tenancies: [], loading: false, error: null, refreshing: false });
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

      // First get properties owned by this user to find their tenancies
      const { data: properties, error: propError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('owner_id', user.id);

      if (propError) throw propError;

      const propertyIds = (properties || []).map((p: { id: string }) => p.id);

      if (propertyIds.length === 0) {
        setState({ tenancies: [], loading: false, error: null, refreshing: false });
        return;
      }

      let query = (supabase.from('tenancies') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('property_id', propertyIds)
        .order('created_at', { ascending: false });

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      if (filter?.propertyId) {
        query = query.eq('property_id', filter.propertyId);
      }

      const { data: tenanciesData, error: tenanciesError } = await query;

      if (tenanciesError) throw tenanciesError;

      const tenancies = (tenanciesData || []) as Tenancy[];
      const tenancyIds = tenancies.map(t => t.id);

      // Fetch tenants for all tenancies
      let tenantsData: TenancyTenant[] = [];
      let profilesData: Profile[] = [];

      if (tenancyIds.length > 0) {
        const { data: tenants, error: tenantsError } = await (supabase
          .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
          .select('*')
          .in('tenancy_id', tenancyIds);

        if (tenantsError) throw tenantsError;
        tenantsData = (tenants || []) as TenancyTenant[];

        // Fetch profiles for tenants
        const tenantIds = [...new Set(tenantsData.map(t => t.tenant_id))];
        if (tenantIds.length > 0) {
          const { data: profiles, error: profilesError } = await (supabase
            .from('profiles') as ReturnType<typeof supabase.from>)
            .select('*')
            .in('id', tenantIds);

          if (profilesError) throw profilesError;
          profilesData = (profiles || []) as Profile[];
        }
      }

      // Fetch properties for display
      const { data: propertyData, error: propertyError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('id', propertyIds);

      if (propertyError) throw propertyError;

      // Combine data
      const tenanciesWithDetails: TenancyWithDetails[] = tenancies.map(tenancy => ({
        ...tenancy,
        tenants: tenantsData
          .filter(t => t.tenancy_id === tenancy.id)
          .map(t => ({
            ...t,
            profile: profilesData.find(p => p.id === t.tenant_id),
          })),
        documents: [],
        property: (propertyData || []).find((p: { id: string }) => p.id === tenancy.property_id),
      }));

      setState({
        tenancies: tenanciesWithDetails,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch tenancies';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, filter?.status, filter?.propertyId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenancies();
    }
  }, [fetchTenancies, isAuthenticated]);

  const refreshTenancies = useCallback(async () => {
    await fetchTenancies(true);
  }, [fetchTenancies]);

  return {
    ...state,
    refreshTenancies,
  };
}
