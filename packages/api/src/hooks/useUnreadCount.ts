import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSupabaseClient } from '../client';

export interface UseUnreadCountReturn {
  count: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useUnreadCount(userId: string | undefined): UseUnreadCountReturn {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => {
    try { return getSupabaseClient(); } catch { return null; }
  }, []);

  const fetchCount = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      setLoading(true);
      const { count: total, error } = await (supabase
        .from('notifications') as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (!error) {
        setCount(total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Realtime subscription for badge updates
  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel('unread-count-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, fetchCount]);

  return { count, loading, refresh: fetchCount };
}
