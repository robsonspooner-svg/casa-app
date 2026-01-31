// AgentProvider - Agent Context for Tab Badges & Notification Indicators
// Mission 14: AI Agent

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from '../hooks/useAuth';

const POLL_INTERVAL_MS = 30_000;

export interface AgentContextValue {
  pendingCount: number;
  hasUnreadProactive: boolean;
  refreshCounts: () => Promise<void>;
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [hasUnreadProactive, setHasUnreadProactive] = useState(false);
  const lastCheckedRef = useRef<string>(new Date().toISOString());

  const fetchCounts = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      setHasUnreadProactive(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // Count pending_input tasks
      const { count, error: tasksError } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending_input');

      if (tasksError) throw tasksError;

      setPendingCount(count ?? 0);

      // Check for proactive messages since last check
      const { count: proactiveCount, error: messagesError } = await (supabase
        .from('agent_messages') as ReturnType<typeof supabase.from>)
        .select('*', { count: 'exact', head: true })
        .eq('role', 'proactive')
        .gt('created_at', lastCheckedRef.current);

      if (messagesError) throw messagesError;

      setHasUnreadProactive((proactiveCount ?? 0) > 0);
    } catch {
      // Silently fail polling - counts will refresh on next interval
    }
  }, [user]);

  const refreshCounts = useCallback(async () => {
    await fetchCounts();
    lastCheckedRef.current = new Date().toISOString();
  }, [fetchCounts]);

  // Fetch counts on mount and when auth changes
  useEffect(() => {
    if (!isAuthenticated) {
      setPendingCount(0);
      setHasUnreadProactive(false);
      return;
    }

    fetchCounts();

    const interval = setInterval(fetchCounts, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [fetchCounts, isAuthenticated]);

  return (
    <AgentContext.Provider
      value={{
        pendingCount,
        hasUnreadProactive,
        refreshCounts,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext(): AgentContextValue {
  const context = useContext(AgentContext);

  if (context === undefined) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }

  return context;
}
