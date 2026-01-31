// Single application detail - Mission 05
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import { ApplicationWithDetails } from '../types/database';

export function useApplication(applicationId: string | null) {
  const { user } = useAuth();
  const [application, setApplication] = useState<ApplicationWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplication = useCallback(async () => {
    if (!user || !applicationId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();

      // Fetch application
      const { data: appData, error: appError } = await (supabase
        .from('applications') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;

      const app = appData as any;

      // Fetch references, documents, and listing in parallel
      const [refsResult, docsResult, listingResult] = await Promise.all([
        (supabase.from('application_references') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('application_id', applicationId),
        (supabase.from('application_documents') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('application_id', applicationId),
        (supabase.from('listings') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('id', app.listing_id)
          .single(),
      ]);

      let listing;
      if (listingResult.data) {
        const { data: propertyData } = await (supabase.from('properties') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('id', (listingResult.data as any).property_id)
          .single();

        listing = {
          ...(listingResult.data as any),
          features: [],
          property: propertyData || undefined,
        };
      }

      setApplication({
        ...app,
        references: (refsResult.data || []) as any[],
        documents: (docsResult.data || []) as any[],
        listing,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }, [user, applicationId]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  return { application, loading, error, refetch: fetchApplication };
}
