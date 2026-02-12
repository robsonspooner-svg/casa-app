import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import type { NotificationRow, NotificationUpdate } from '../types/database';

export interface NotificationsState {
  notifications: NotificationRow[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

export interface UseNotificationsReturn extends NotificationsState {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const PAGE_SIZE = 20;

export function useNotifications(userId: string | undefined): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const supabase = useMemo(() => {
    try { return getSupabaseClient(); } catch { return null; }
  }, []);

  const fetchNotifications = useCallback(async (pageNum: number, append = false) => {
    if (!supabase || !userId) return;
    try {
      if (!append) setLoading(true);
      setError(null);

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: err } = await (supabase
        .from('notifications') as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (err) throw err;

      const items = (data || []) as NotificationRow[];
      setHasMore(items.length === PAGE_SIZE);

      if (append) {
        setNotifications(prev => [...prev, ...items]);
      } else {
        setNotifications(items);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    setPage(0);
    fetchNotifications(0);
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as NotificationRow;
          setNotifications(prev => [newNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const refresh = useCallback(async () => {
    setPage(0);
    await fetchNotifications(0);
  }, [fetchNotifications]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchNotifications(nextPage, true);
  }, [hasMore, loading, page, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!supabase) return;
    const update: NotificationUpdate = { is_read: true, read_at: new Date().toISOString() };
    const { error: err } = await (supabase
      .from('notifications') as any)
      .update(update)
      .eq('id', id);
    if (!err) {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
    }
  }, [supabase]);

  const markAllAsRead = useCallback(async () => {
    if (!supabase || !userId) return;
    const now = new Date().toISOString();
    const { error: err } = await (supabase
      .from('notifications') as any)
      .update({ is_read: true, read_at: now })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (!err) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: n.read_at || now }))
      );
    }
  }, [supabase, userId]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!supabase) return;
    const { error: err } = await (supabase
      .from('notifications') as any)
      .delete()
      .eq('id', id);
    if (!err) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  }, [supabase]);

  const clearAll = useCallback(async () => {
    if (!supabase || !userId) return;
    const { error: err } = await (supabase
      .from('notifications') as any)
      .delete()
      .eq('user_id', userId);
    if (!err) {
      setNotifications([]);
    }
  }, [supabase, userId]);

  return {
    notifications,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}
