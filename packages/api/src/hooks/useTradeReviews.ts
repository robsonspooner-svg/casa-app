// Trade Reviews List
// Mission 10: Tradesperson Network

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { TradeReviewWithDetails, TradeReviewRow, Profile, WorkOrderRow } from '../types/database';

export interface TradeReviewsState {
  reviews: TradeReviewWithDetails[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface TradeReviewsSummary {
  total: number;
  averageRating: number | null;
  recommendPercentage: number | null;
}

export function useTradeReviews(tradeId: string | null): TradeReviewsState & {
  refreshReviews: () => Promise<void>;
  summary: TradeReviewsSummary;
} {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<TradeReviewWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReviews = useCallback(async (isRefresh = false) => {
    if (!user || !tradeId) {
      setReviews([]);
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

      const { data: reviewData, error: reviewError } = await (supabase
        .from('trade_reviews') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('trade_id', tradeId)
        .order('created_at', { ascending: false });

      if (reviewError) throw new Error(reviewError.message);
      if (!reviewData || reviewData.length === 0) {
        setReviews([]);
        return;
      }

      const rawReviews = reviewData as unknown as TradeReviewRow[];

      // Collect unique reviewer IDs and work order IDs for enrichment
      const reviewerIds = [...new Set(rawReviews.map(r => r.reviewer_id))];
      const workOrderIds = [...new Set(rawReviews.map(r => r.work_order_id))];

      // Fetch enrichment data in parallel
      const [reviewersResult, workOrdersResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,full_name,avatar_url')
          .in('id', reviewerIds),
        (supabase
          .from('work_orders') as ReturnType<typeof supabase.from>)
          .select('id,title,category')
          .in('id', workOrderIds),
      ]);

      const reviewerMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>();
      if (reviewersResult.data) {
        for (const r of reviewersResult.data) {
          reviewerMap.set((r as any).id, r as any);
        }
      }

      const workOrderMap = new Map<string, Pick<WorkOrderRow, 'id' | 'title' | 'category'>>();
      if (workOrdersResult.data) {
        for (const wo of workOrdersResult.data) {
          workOrderMap.set((wo as any).id, wo as any);
        }
      }

      const enriched: TradeReviewWithDetails[] = rawReviews.map(review => ({
        ...review,
        reviewer: reviewerMap.get(review.reviewer_id),
        work_order: workOrderMap.get(review.work_order_id),
      }));

      setReviews(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, tradeId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const refreshReviews = useCallback(async () => {
    await fetchReviews(true);
  }, [fetchReviews]);

  const summary: TradeReviewsSummary = useMemo(() => {
    if (reviews.length === 0) {
      return { total: 0, averageRating: null, recommendPercentage: null };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const recommendCount = reviews.filter(r => r.would_recommend === true).length;
    const recommendTotal = reviews.filter(r => r.would_recommend !== null).length;

    return {
      total: reviews.length,
      averageRating: Math.round((totalRating / reviews.length) * 10) / 10,
      recommendPercentage: recommendTotal > 0
        ? Math.round((recommendCount / recommendTotal) * 100)
        : null,
    };
  }, [reviews]);

  return { reviews, loading, error, refreshing, refreshReviews, summary };
}
