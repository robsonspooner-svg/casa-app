// useRegulatoryUpdates Hook — Regulatory update list + acknowledgements
// Mission 15: Learning Engine & Compliance

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface RegulatoryUpdate {
  id: string;
  title: string;
  description: string;
  state: string;
  category: string;
  effective_date: string;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  action_required: string | null;
  source_url: string | null;
  is_published: boolean;
  created_at: string;
}

export interface RegulatoryUpdateNotification {
  id: string;
  update_id: string;
  user_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface RegulatoryUpdatesState {
  updates: RegulatoryUpdate[];
  notifications: Record<string, RegulatoryUpdateNotification>;
  loading: boolean;
  error: string | null;
  unacknowledgedCount: number;
}

export interface UseRegulatoryUpdatesReturn extends RegulatoryUpdatesState {
  fetchUpdates: (filters?: { state?: string; category?: string }) => Promise<void>;
  acknowledgeUpdate: (updateId: string) => Promise<void>;
  markRead: (updateId: string) => Promise<void>;
}

export function useRegulatoryUpdates(): UseRegulatoryUpdatesReturn {
  const { user } = useAuth();
  const [state, setState] = useState<RegulatoryUpdatesState>({
    updates: [],
    notifications: {},
    loading: true,
    error: null,
    unacknowledgedCount: 0,
  });

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase
        .from('regulatory_update_notifications') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const notifMap: Record<string, RegulatoryUpdateNotification> = {};
      let unacked = 0;
      for (const n of (data || [])) {
        notifMap[n.update_id] = n as RegulatoryUpdateNotification;
        if (!n.acknowledged_at) unacked++;
      }

      setState(prev => ({
        ...prev,
        notifications: notifMap,
        unacknowledgedCount: unacked,
      }));
    } catch {
      // Non-critical
    }
  }, [user]);

  const fetchUpdates = useCallback(async (filters?: { state?: string; category?: string }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      let query = (supabase
        .from('regulatory_updates') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('is_published', true)
        .order('effective_date', { ascending: false });

      if (filters?.state) {
        query = query.or(`state.eq.${filters.state},state.eq.ALL`);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query;
      if (error) throw error;

      setState(prev => ({
        ...prev,
        updates: (data || []) as RegulatoryUpdate[],
        loading: false,
        error: null,
      }));
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Failed to fetch updates';
      setState(prev => ({ ...prev, loading: false, error: msg }));
    }
  }, []);

  const acknowledgeUpdate = useCallback(async (updateId: string) => {
    if (!user) return;

    // Optimistic update
    setState(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [updateId]: {
          ...(prev.notifications[updateId] || { id: '', update_id: updateId, user_id: user.id, read_at: null, created_at: new Date().toISOString() }),
          acknowledged_at: new Date().toISOString(),
        },
      },
      unacknowledgedCount: Math.max(0, prev.unacknowledgedCount - 1),
    }));

    try {
      const supabase = getSupabaseClient();

      // Upsert the notification row
      const { error } = await (supabase
        .from('regulatory_update_notifications') as ReturnType<typeof supabase.from>)
        .upsert({
          update_id: updateId,
          user_id: user.id,
          acknowledged_at: new Date().toISOString(),
          read_at: new Date().toISOString(),
        }, { onConflict: 'update_id,user_id' });

      if (error) throw error;
    } catch {
      // Revert on failure
      await fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const markRead = useCallback(async (updateId: string) => {
    if (!user) return;

    try {
      const supabase = getSupabaseClient();
      await (supabase
        .from('regulatory_update_notifications') as ReturnType<typeof supabase.from>)
        .upsert({
          update_id: updateId,
          user_id: user.id,
          read_at: new Date().toISOString(),
        }, { onConflict: 'update_id,user_id' });
    } catch {
      // Non-critical
    }
  }, [user]);

  useEffect(() => {
    fetchUpdates();
    fetchNotifications();
  }, [fetchUpdates, fetchNotifications]);

  return {
    ...state,
    fetchUpdates,
    acknowledgeUpdate,
    markRead,
  };
}
