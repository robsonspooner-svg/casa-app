// useMyTenancy Hook - Tenant's Current Tenancy
// Mission 06: Tenancies & Leases

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  Tenancy,
  TenancyTenant,
  TenancyDocument,
  TenancyWithDetails,
  RentIncrease,
  Profile,
  Property,
} from '../types/database';

export interface MyTenancyState {
  tenancy: TenancyWithDetails | null;
  allTenancies: TenancyWithDetails[];
  loading: boolean;
  error: string | null;
}

export function useMyTenancy(): MyTenancyState & { refreshMyTenancy: () => Promise<void> } {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<MyTenancyState>({
    tenancy: null,
    allTenancies: [],
    loading: true,
    error: null,
  });

  const fetchMyTenancy = useCallback(async () => {
    if (!user) {
      setState({ tenancy: null, allTenancies: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // Find tenancies where this user is a tenant
      const { data: tenantRecords, error: tenantError } = await (supabase
        .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
        .select('tenancy_id')
        .eq('tenant_id', user.id);

      if (tenantError) throw tenantError;

      const tenancyIds = (tenantRecords || []).map((r: { tenancy_id: string }) => r.tenancy_id);

      if (tenancyIds.length === 0) {
        setState({ tenancy: null, allTenancies: [], loading: false, error: null });
        return;
      }

      // Fetch all tenancies
      const { data: tenanciesData, error: tenanciesError } = await (supabase
        .from('tenancies') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('id', tenancyIds)
        .order('lease_start_date', { ascending: false });

      if (tenanciesError) throw tenanciesError;

      const tenancies = (tenanciesData || []) as Tenancy[];

      // Fetch all tenants across these tenancies
      const { data: allTenantsData, error: allTenantsError } = await (supabase
        .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('tenancy_id', tenancyIds);

      if (allTenantsError) throw allTenantsError;
      const allTenants = (allTenantsData || []) as TenancyTenant[];

      // Fetch profiles for all tenants
      const allTenantIds = [...new Set(allTenants.map(t => t.tenant_id))];
      let profilesData: Profile[] = [];
      if (allTenantIds.length > 0) {
        const { data: profiles, error: profilesError } = await (supabase
          .from('profiles') as ReturnType<typeof supabase.from>)
          .select('*')
          .in('id', allTenantIds);

        if (profilesError) throw profilesError;
        profilesData = (profiles || []) as Profile[];
      }

      // Fetch documents
      const { data: docsData, error: docsError } = await (supabase
        .from('tenancy_documents') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('tenancy_id', tenancyIds)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      // Fetch properties
      const propertyIds = [...new Set(tenancies.map(t => t.property_id))];
      const { data: propertyData, error: propertyError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('id', propertyIds);

      if (propertyError) throw propertyError;

      // Fetch rent increases
      const { data: rentData, error: rentError } = await (supabase
        .from('rent_increases') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('tenancy_id', tenancyIds)
        .order('created_at', { ascending: false });

      if (rentError) throw rentError;

      // Combine data
      const allTenanciesWithDetails: TenancyWithDetails[] = tenancies.map(tenancy => ({
        ...tenancy,
        tenants: allTenants
          .filter(t => t.tenancy_id === tenancy.id)
          .map(t => ({
            ...t,
            profile: profilesData.find(p => p.id === t.tenant_id),
          })),
        documents: ((docsData || []) as TenancyDocument[]).filter(d => d.tenancy_id === tenancy.id),
        property: (propertyData || []).find((p: { id: string }) => p.id === tenancy.property_id) as Property | undefined,
        rent_increases: ((rentData || []) as RentIncrease[]).filter(r => r.tenancy_id === tenancy.id),
      }));

      // Active tenancy is the current one (active or ending)
      const activeTenancy = allTenanciesWithDetails.find(
        t => t.status === 'active' || t.status === 'ending'
      ) || allTenanciesWithDetails[0] || null;

      setState({
        tenancy: activeTenancy,
        allTenancies: allTenanciesWithDetails,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({
        tenancy: null,
        allTenancies: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch tenancy',
      });
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyTenancy();
    }
  }, [fetchMyTenancy, isAuthenticated]);

  const refreshMyTenancy = useCallback(async () => {
    await fetchMyTenancy();
  }, [fetchMyTenancy]);

  return {
    ...state,
    refreshMyTenancy,
  };
}
