// useSecurityAlerts Hook - Security Alert Management
// Mission 18: Security Audit

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface SecurityAlert {
  id: string;
  user_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  data: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export interface SecurityAlertsState {
  alerts: SecurityAlert[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

export interface UseSecurityAlertsReturn extends SecurityAlertsState {
  dismissAlert: (id: string) => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSecurityAlerts(): UseSecurityAlertsReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<SecurityAlertsState>({
    alerts: [],
    unreadCount: 0,
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

  const fetchAlerts = useCallback(async () => {
    if (!user || !supabase) {
      setState({ alerts: [], unreadCount: 0, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await (supabase.from('security_alerts') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const alerts = (data as SecurityAlert[]) || [];
      const unreadCount = alerts.filter(a => a.status === 'unread' || a.status === 'new').length;

      setState({
        alerts,
        unreadCount,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch security alerts';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [user, supabase]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts();
    }
  }, [fetchAlerts, isAuthenticated]);

  const dismissAlert = useCallback(async (id: string) => {
    if (!user || !supabase) return;

    try {
      const { error } = await (supabase.from('security_alerts') as any)
        .update({ status: 'dismissed' })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => {
        const updated = prev.alerts.map(a =>
          a.id === id ? { ...a, status: 'dismissed' } : a
        );
        return {
          ...prev,
          alerts: updated,
          unreadCount: updated.filter(a => a.status === 'unread' || a.status === 'new').length,
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dismiss alert';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [user, supabase]);

  const acknowledgeAlert = useCallback(async (id: string) => {
    if (!user || !supabase) return;

    try {
      const { error } = await (supabase.from('security_alerts') as any)
        .update({ status: 'acknowledged' })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => {
        const updated = prev.alerts.map(a =>
          a.id === id ? { ...a, status: 'acknowledged' } : a
        );
        return {
          ...prev,
          alerts: updated,
          unreadCount: updated.filter(a => a.status === 'unread' || a.status === 'new').length,
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [user, supabase]);

  const refresh = useCallback(async () => {
    await fetchAlerts();
  }, [fetchAlerts]);

  return {
    ...state,
    dismissAlert,
    acknowledgeAlert,
    refresh,
  };
}
