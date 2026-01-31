// useTenancy Hook - Single Tenancy Details
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

export interface TenancyState {
  tenancy: TenancyWithDetails | null;
  loading: boolean;
  error: string | null;
}

export function useTenancy(tenancyId: string | null): TenancyState & { refreshTenancy: () => Promise<void> } {
  const { user } = useAuth();
  const [state, setState] = useState<TenancyState>({
    tenancy: null,
    loading: true,
    error: null,
  });

  const fetchTenancy = useCallback(async () => {
    if (!tenancyId || !user) {
      setState({ tenancy: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // Fetch tenancy
      const { data: tenancyData, error: tenancyError } = await (supabase
        .from('tenancies') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', tenancyId)
        .single();

      if (tenancyError) throw tenancyError;
      const tenancy = tenancyData as Tenancy;

      // Fetch tenants with profiles
      const { data: tenantsData, error: tenantsError } = await (supabase
        .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenancy_id', tenancyId);

      if (tenantsError) throw tenantsError;
      const tenants = (tenantsData || []) as TenancyTenant[];

      // Fetch profiles for tenants
      let profilesData: Profile[] = [];
      const tenantIds = tenants.map(t => t.tenant_id);
      if (tenantIds.length > 0) {
        const { data: profiles, error: profilesError } = await (supabase
          .from('profiles') as ReturnType<typeof supabase.from>)
          .select('*')
          .in('id', tenantIds);

        if (profilesError) throw profilesError;
        profilesData = (profiles || []) as Profile[];
      }

      // Fetch documents
      const { data: docsData, error: docsError } = await (supabase
        .from('tenancy_documents') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      // Fetch property
      const { data: propertyData, error: propertyError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', tenancy.property_id)
        .single();

      if (propertyError) throw propertyError;

      // Fetch rent increases
      const { data: rentData, error: rentError } = await (supabase
        .from('rent_increases') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('created_at', { ascending: false });

      if (rentError) throw rentError;

      const tenancyWithDetails: TenancyWithDetails = {
        ...tenancy,
        tenants: tenants.map(t => ({
          ...t,
          profile: profilesData.find(p => p.id === t.tenant_id),
        })),
        documents: (docsData || []) as TenancyDocument[],
        property: propertyData as Property,
        rent_increases: (rentData || []) as RentIncrease[],
      };

      setState({
        tenancy: tenancyWithDetails,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({
        tenancy: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch tenancy',
      });
    }
  }, [tenancyId, user]);

  useEffect(() => {
    fetchTenancy();
  }, [fetchTenancy]);

  const refreshTenancy = useCallback(async () => {
    await fetchTenancy();
  }, [fetchTenancy]);

  return {
    ...state,
    refreshTenancy,
  };
}
