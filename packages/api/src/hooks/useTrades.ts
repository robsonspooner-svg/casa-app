// Search/List Active Trades
// Mission 10: Tradesperson Network

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { TradeRow, MaintenanceCategory } from '../types/database';

export interface TradesFilter {
  category?: MaintenanceCategory;
  serviceArea?: string;
  minRating?: number;
  searchTerm?: string;
}

export interface TradesState {
  trades: TradeRow[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useTrades(filter?: TradesFilter): TradesState & {
  refreshTrades: () => Promise<void>;
} {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrades = useCallback(async (isRefresh = false) => {
    if (!user) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const supabase = getSupabaseClient();
      let query = (supabase
        .from('trades') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('status', 'active')
        .order('average_rating', { ascending: false, nullsFirst: false })
        .order('total_jobs', { ascending: false });

      if (filter?.category) {
        query = query.contains('categories', [filter.category]);
      }

      if (filter?.serviceArea) {
        query = query.contains('service_areas', [filter.serviceArea]);
      }

      if (filter?.minRating) {
        query = query.gte('average_rating', filter.minRating);
      }

      if (filter?.searchTerm) {
        const term = `%${filter.searchTerm}%`;
        query = query.or(`business_name.ilike.${term},contact_name.ilike.${term}`);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw new Error(queryError.message);
      setTrades((data as unknown as TradeRow[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, filter?.category, filter?.serviceArea, filter?.minRating, filter?.searchTerm]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const refreshTrades = useCallback(async () => {
    await fetchTrades(true);
  }, [fetchTrades]);

  return { trades, loading, error, refreshing, refreshTrades };
}
