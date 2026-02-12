// useAuditLog Hook - Security Audit Trail
// Mission 18: Security Audit

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  agent_execution: boolean;
  agent_tool_name: string | null;
  agent_autonomy_level: string | null;
  status: string;
  created_at: string;
}

export interface AuditLogState {
  entries: AuditLogEntry[];
  loading: boolean;
  error: string | null;
}

export interface UseAuditLogOptions {
  resourceType?: string;
  limit?: number;
}

export interface UseAuditLogReturn extends AuditLogState {
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 25;

export function useAuditLog(options?: UseAuditLogOptions): UseAuditLogReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<AuditLogState>({
    entries: [],
    loading: true,
    error: null,
  });
  const [hasMore, setHasMore] = useState(true);

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const limit = options?.limit ?? DEFAULT_LIMIT;

  const fetchEntries = useCallback(async (offset: number = 0, append: boolean = false) => {
    if (!user || !supabase) {
      setState({ entries: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let query = (supabase.from('audit_log') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (options?.resourceType) {
        query = query.eq('resource_type', options.resourceType);
      }

      const { data, error } = await query;

      if (error) throw error;

      const fetched = (data as AuditLogEntry[]) || [];
      setHasMore(fetched.length >= limit);

      setState(prev => ({
        entries: append ? [...prev.entries, ...fetched] : fetched,
        loading: false,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch audit log';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [user, supabase, limit, options?.resourceType]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEntries(0, false);
    }
  }, [fetchEntries, isAuthenticated]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    await fetchEntries(state.entries.length, true);
  }, [fetchEntries, state.entries.length, hasMore]);

  const refresh = useCallback(async () => {
    setHasMore(true);
    await fetchEntries(0, false);
  }, [fetchEntries]);

  return {
    ...state,
    loadMore,
    refresh,
    hasMore,
  };
}
