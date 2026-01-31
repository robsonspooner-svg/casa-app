// useMaintenanceRequest Hook - Single Maintenance Request Detail
// Mission 09: Maintenance Requests

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  MaintenanceRequestWithDetails,
  MaintenanceRequest,
  MaintenanceImage,
  MaintenanceComment,
  MaintenanceStatusHistory,
  Property,
  Profile,
} from '../types/database';

export interface MaintenanceRequestState {
  request: MaintenanceRequestWithDetails | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useMaintenanceRequest(requestId: string | null): MaintenanceRequestState & {
  refreshRequest: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<MaintenanceRequestState>({
    request: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchRequest = useCallback(async (isRefresh = false) => {
    if (!user || !requestId) {
      setState({ request: null, loading: false, error: null, refreshing: false });
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

      // Fetch the request
      const { data: requestData, error: requestError } = await (supabase
        .from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;
      if (!requestData) throw new Error('Request not found');

      const request = requestData as MaintenanceRequest;

      // Fetch related data in parallel
      const [imagesResult, commentsResult, historyResult, propertyResult, tenantResult] = await Promise.all([
        (supabase
          .from('maintenance_images') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('request_id', requestId)
          .order('created_at', { ascending: true }),

        (supabase
          .from('maintenance_comments') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('request_id', requestId)
          .order('created_at', { ascending: true }),

        (supabase
          .from('maintenance_status_history') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('request_id', requestId)
          .order('created_at', { ascending: true }),

        supabase
          .from('properties')
          .select('*')
          .eq('id', request.property_id)
          .single(),

        supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .eq('id', request.tenant_id)
          .single(),
      ]);

      const enriched: MaintenanceRequestWithDetails = {
        ...request,
        images: (imagesResult.data || []) as MaintenanceImage[],
        comments: (commentsResult.data || []) as MaintenanceComment[],
        status_history: (historyResult.data || []) as MaintenanceStatusHistory[],
        property: (propertyResult.data ?? undefined) as Property | undefined,
        tenant: (tenantResult.data ?? undefined) as Profile | undefined,
      };

      setState({
        request: enriched,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch maintenance request';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, requestId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequest();
    }
  }, [fetchRequest, isAuthenticated]);

  const refreshRequest = useCallback(async () => {
    await fetchRequest(true);
  }, [fetchRequest]);

  return {
    ...state,
    refreshRequest,
  };
}
