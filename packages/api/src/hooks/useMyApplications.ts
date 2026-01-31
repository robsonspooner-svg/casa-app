// Tenant's own applications list - Mission 05
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import { Application, ApplicationWithDetails } from '../types/database';

interface MyApplicationsFilter {
  status?: Application['status'];
}

export function useMyApplications(filter?: MyApplicationsFilter) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const supabase = getSupabaseClient();

      let query = (supabase.from('applications') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenant_id', user.id);

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      const { data: appsData, error: appsError } = await query.order('updated_at', { ascending: false });

      if (appsError) throw appsError;

      const apps = (appsData || []) as Application[];

      // Fetch references and documents for each application
      const appsWithDetails: ApplicationWithDetails[] = await Promise.all(
        apps.map(async (app) => {
          const [refsResult, docsResult] = await Promise.all([
            (supabase.from('application_references') as ReturnType<typeof supabase.from>)
              .select('*')
              .eq('application_id', app.id),
            (supabase.from('application_documents') as ReturnType<typeof supabase.from>)
              .select('*')
              .eq('application_id', app.id),
          ]);

          // Fetch listing info
          const { data: listingData } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
            .select('*')
            .eq('id', app.listing_id)
            .single();

          let listing;
          if (listingData) {
            // Fetch property for address display
            const { data: propertyData } = await (supabase.from('properties') as ReturnType<typeof supabase.from>)
              .select('*')
              .eq('id', (listingData as any).property_id)
              .single();

            listing = {
              ...(listingData as any),
              features: [],
              property: propertyData || undefined,
            };
          }

          return {
            ...app,
            references: (refsResult.data || []) as any[],
            documents: (docsResult.data || []) as any[],
            listing,
          };
        })
      );

      setApplications(appsWithDetails);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, filter?.status]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const refreshApplications = useCallback(() => fetchApplications(true), [fetchApplications]);

  return { applications, loading, refreshing, error, refreshApplications };
}
