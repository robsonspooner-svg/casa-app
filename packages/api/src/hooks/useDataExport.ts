// useDataExport Hook - Data Export & Deletion Requests
// Mission 18: Security Audit

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface DataRequest {
  id: string;
  request_type: string;
  status: string;
  data_types: string[] | null;
  processed_at: string | null;
  export_url: string | null;
  created_at: string;
}

export interface DataExportState {
  requests: DataRequest[];
  loading: boolean;
  error: string | null;
}

export interface UseDataExportReturn extends DataExportState {
  requestExport: (dataTypes?: string[]) => Promise<void>;
  requestDeletion: (dataTypes?: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useDataExport(): UseDataExportReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<DataExportState>({
    requests: [],
    loading: true,
    error: null,
  });

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!user || !supabase) {
      setState({ requests: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await (supabase.from('data_deletion_requests') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setState({
        requests: (data as DataRequest[]) || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data requests';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [user, supabase]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequests();
    }
  }, [fetchRequests, isAuthenticated]);

  const requestExport = useCallback(async (dataTypes?: string[]) => {
    if (!user || !supabase) return;

    try {
      const { data, error } = await (supabase.from('data_deletion_requests') as any)
        .insert({
          user_id: user.id,
          request_type: 'export',
          status: 'pending',
          data_types: dataTypes || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newRequest = data as DataRequest;
      setState(prev => ({
        ...prev,
        requests: [newRequest, ...prev.requests],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request data export';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [user, supabase]);

  const requestDeletion = useCallback(async (dataTypes?: string[]) => {
    if (!user || !supabase) return;

    try {
      const { data, error } = await (supabase.from('data_deletion_requests') as any)
        .insert({
          user_id: user.id,
          request_type: 'delete',
          status: 'pending',
          data_types: dataTypes || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newRequest = data as DataRequest;
      setState(prev => ({
        ...prev,
        requests: [newRequest, ...prev.requests],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request data deletion';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [user, supabase]);

  const refresh = useCallback(async () => {
    await fetchRequests();
  }, [fetchRequests]);

  return {
    ...state,
    requestExport,
    requestDeletion,
    refresh,
  };
}
