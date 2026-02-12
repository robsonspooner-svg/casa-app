// useUserSessions Hook - Active Session Management
// Mission 18: Security Audit

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface UserSession {
  id: string;
  device_name: string | null;
  device_type: string | null;
  ip_address: string | null;
  is_active: boolean;
  last_active_at: string | null;
  created_at: string;
}

export interface UserSessionsState {
  sessions: UserSession[];
  loading: boolean;
  error: string | null;
}

export interface UseUserSessionsReturn extends UserSessionsState {
  revokeSession: (sessionId: string) => Promise<void>;
  revokeAllOtherSessions: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useUserSessions(): UseUserSessionsReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<UserSessionsState>({
    sessions: [],
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

  const fetchSessions = useCallback(async () => {
    if (!user || !supabase) {
      setState({ sessions: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await (supabase.from('user_sessions') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_active_at', { ascending: false });

      if (error) throw error;

      setState({
        sessions: (data as UserSession[]) || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sessions';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [user, supabase]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
    }
  }, [fetchSessions, isAuthenticated]);

  const revokeSession = useCallback(async (sessionId: string) => {
    if (!user || !supabase) return;

    try {
      const { error } = await (supabase.from('user_sessions') as any)
        .update({ is_active: false })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        sessions: prev.sessions.filter(s => s.id !== sessionId),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke session';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [user, supabase]);

  const revokeAllOtherSessions = useCallback(async () => {
    if (!user || !supabase) return;

    try {
      // Get the current session to exclude it
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const currentSessionToken = currentSession?.access_token;

      // Revoke all active sessions for this user except the current one
      // We identify the current session by finding the most recently active one
      // since we cannot directly match Supabase auth sessions to our user_sessions table
      const otherSessionIds = state.sessions
        .filter((_, index) => index !== 0) // Keep the first (most recent) session as current
        .map(s => s.id);

      if (otherSessionIds.length === 0) return;

      const { error } = await (supabase.from('user_sessions') as any)
        .update({ is_active: false })
        .in('id', otherSessionIds)
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        sessions: prev.sessions.filter(s => !otherSessionIds.includes(s.id)),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke sessions';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [user, supabase, state.sessions]);

  const refresh = useCallback(async () => {
    await fetchSessions();
  }, [fetchSessions]);

  return {
    ...state,
    revokeSession,
    revokeAllOtherSessions,
    refresh,
  };
}
