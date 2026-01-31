// Owner's Saved Trade Network
// Mission 10: Tradesperson Network

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { TradeWithNetwork, MaintenanceCategory } from '../types/database';

export interface MyTradesFilter {
  category?: MaintenanceCategory;
  favoritesOnly?: boolean;
}

export interface MyTradesState {
  trades: TradeWithNetwork[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface MyTradesSummary {
  total: number;
  favorites: number;
  byCategory: Partial<Record<MaintenanceCategory, number>>;
}

export function useMyTrades(filter?: MyTradesFilter): MyTradesState & {
  refreshTrades: () => Promise<void>;
  summary: MyTradesSummary;
} {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeWithNetwork[]>([]);
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

      // Fetch owner's trade network with trade details
      const { data: ownerTrades, error: otError } = await (supabase
        .from('owner_trades') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id);

      if (otError) throw new Error(otError.message);
      if (!ownerTrades || ownerTrades.length === 0) {
        setTrades([]);
        return;
      }

      const tradeIds = ownerTrades.map((ot: any) => ot.trade_id);

      // Fetch trade details
      let tradeQuery = (supabase
        .from('trades') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('id', tradeIds)
        .order('business_name');

      if (filter?.category) {
        tradeQuery = tradeQuery.contains('categories', [filter.category]);
      }

      const { data: tradeData, error: tError } = await tradeQuery;
      if (tError) throw new Error(tError.message);

      // Build network map
      const networkMap = new Map<string, { is_favorite: boolean; notes: string | null }>();
      for (const ot of ownerTrades) {
        networkMap.set((ot as any).trade_id, {
          is_favorite: (ot as any).is_favorite,
          notes: (ot as any).notes,
        });
      }

      // Merge data
      let merged: TradeWithNetwork[] = ((tradeData as unknown as any[]) || []).map(trade => ({
        ...trade,
        is_in_network: true,
        is_favorite: networkMap.get(trade.id)?.is_favorite ?? false,
        owner_notes: networkMap.get(trade.id)?.notes ?? null,
      }));

      if (filter?.favoritesOnly) {
        merged = merged.filter(t => t.is_favorite);
      }

      setTrades(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, filter?.category, filter?.favoritesOnly]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const refreshTrades = useCallback(async () => {
    await fetchTrades(true);
  }, [fetchTrades]);

  const summary: MyTradesSummary = useMemo(() => {
    const byCategory: Partial<Record<MaintenanceCategory, number>> = {};
    for (const trade of trades) {
      for (const cat of trade.categories) {
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }
    }
    return {
      total: trades.length,
      favorites: trades.filter(t => t.is_favorite).length,
      byCategory,
    };
  }, [trades]);

  return { trades, loading, error, refreshing, refreshTrades, summary };
}
