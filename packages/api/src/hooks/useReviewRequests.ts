// Tenant Review Requests — pending prompts to rate trades
// Mission 10: Tradesperson Network

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { TradeReviewRequestRow } from '../types/database';

export interface ReviewRequestsState {
  requests: TradeReviewRequestRow[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  pendingCount: number;
}

export function useReviewRequests(): ReviewRequestsState & {
  refreshRequests: () => Promise<void>;
  dismissRequest: (requestId: string) => Promise<boolean>;
  completeRequest: (requestId: string, reviewId: string) => Promise<boolean>;
} {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TradeReviewRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async (isRefresh = false) => {
    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const { data, error: fetchError } = await (supabase
        .from('trade_review_requests') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw new Error(fetchError.message);

      setRequests((data as unknown as TradeReviewRequestRow[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const refreshRequests = useCallback(async () => {
    await fetchRequests(true);
  }, [fetchRequests]);

  const dismissRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error: updateError } = await (supabase
        .from('trade_review_requests') as ReturnType<typeof supabase.from>)
        .update({ status: 'dismissed' })
        .eq('id', requestId)
        .eq('tenant_id', user.id);

      if (updateError) throw updateError;
      await fetchRequests(true);
      return true;
    } catch {
      return false;
    }
  }, [user, fetchRequests]);

  const completeRequest = useCallback(async (requestId: string, reviewId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error: updateError } = await (supabase
        .from('trade_review_requests') as ReturnType<typeof supabase.from>)
        .update({ status: 'completed', review_id: reviewId })
        .eq('id', requestId)
        .eq('tenant_id', user.id);

      if (updateError) throw updateError;
      await fetchRequests(true);
      return true;
    } catch {
      return false;
    }
  }, [user, fetchRequests]);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return {
    requests,
    loading,
    error,
    refreshing,
    pendingCount,
    refreshRequests,
    dismissRequest,
    completeRequest,
  };
}
