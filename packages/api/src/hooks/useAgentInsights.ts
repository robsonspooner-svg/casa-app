// useAgentInsights Hook - Home Screen Agent Insights
// Mission 14: AI Agent Proactive Insights

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { AgentTask, AgentProactiveAction } from '../types/database';

export interface AgentInsight {
  id: string;
  title: string;
  description: string;
  type: 'action_needed' | 'info' | 'success' | 'warning';
  deepLink?: string;
  taskId?: string;
}

export interface AgentInsightsState {
  insights: AgentInsight[];
  loading: boolean;
}

export interface UseAgentInsightsReturn extends AgentInsightsState {
  refreshInsights: () => Promise<void>;
}

// Priority ordering for insight types (lower = higher priority)
const INSIGHT_TYPE_PRIORITY: Record<AgentInsight['type'], number> = {
  action_needed: 0,
  warning: 1,
  info: 2,
  success: 3,
};

const MAX_INSIGHTS = 5;

export function useAgentInsights(): UseAgentInsightsReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<AgentInsightsState>({
    insights: [],
    loading: true,
  });

  const fetchInsights = useCallback(async () => {
    if (!user) {
      setState({ insights: [], loading: false });
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const supabase = getSupabaseClient();
      const insights: AgentInsight[] = [];

      // 1. Fetch pending tasks that need user input
      const { data: pendingTasks } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending_input')
        .order('priority', { ascending: true })
        .limit(5);

      if (pendingTasks) {
        (pendingTasks as AgentTask[]).forEach(task => {
          insights.push({
            id: `task-${task.id}`,
            title: task.title,
            description: task.recommendation || task.description || 'Needs your input',
            type: task.priority === 'urgent' ? 'warning' : 'action_needed',
            deepLink: task.deep_link || '/(app)/(tabs)/tasks',
            taskId: task.id,
          });
        });
      }

      // 2. Fetch recent proactive actions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: proactiveActions } = await (supabase
        .from('agent_proactive_actions') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .eq('was_auto_executed', true)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (proactiveActions) {
        (proactiveActions as AgentProactiveAction[]).forEach(action => {
          insights.push({
            id: `proactive-${action.id}`,
            title: `Casa handled: ${action.action_taken}`,
            description: `Triggered by ${action.trigger_type}`,
            type: 'success',
            deepLink: action.task_id ? '/(app)/(tabs)/tasks' : undefined,
            taskId: action.task_id || undefined,
          });
        });
      }

      // 3. Fetch arrears for properties this owner has
      const { data: arrearsData } = await supabase
        .from('arrears_records')
        .select('id, total_overdue, days_overdue, severity, tenancy_id')
        .eq('is_resolved', false)
        .order('days_overdue', { ascending: false })
        .limit(3);

      if (arrearsData && arrearsData.length > 0) {
        const totalOverdue = arrearsData.reduce((sum: number, a: { total_overdue: number }) => sum + a.total_overdue, 0);
        insights.push({
          id: 'arrears-summary',
          title: `${arrearsData.length} overdue payment${arrearsData.length > 1 ? 's' : ''}`,
          description: `$${totalOverdue.toLocaleString()} total outstanding`,
          type: 'warning',
          deepLink: '/(app)/arrears',
        });
      }

      // 4. Fetch upcoming lease expiries (within 90 days)
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      const { data: expiringTenancies } = await supabase
        .from('tenancies')
        .select('id, lease_end_date, property_id')
        .eq('status', 'active')
        .lte('lease_end_date', ninetyDaysFromNow.toISOString().split('T')[0])
        .gte('lease_end_date', new Date().toISOString().split('T')[0])
        .order('lease_end_date', { ascending: true })
        .limit(3);

      if (expiringTenancies && expiringTenancies.length > 0) {
        expiringTenancies.forEach((tenancy: { id: string; lease_end_date: string; property_id: string }) => {
          const endDate = new Date(tenancy.lease_end_date);
          const daysUntil = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          insights.push({
            id: `lease-expiry-${tenancy.id}`,
            title: 'Lease expiring soon',
            description: `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until lease ends`,
            type: daysUntil <= 30 ? 'warning' : 'info',
            deepLink: `/(app)/tenancy/${tenancy.id}`,
          });
        });
      }

      // 5. Fetch in-progress tasks to show what the agent is working on
      const { data: activeTasks } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false })
        .limit(2);

      if (activeTasks) {
        (activeTasks as AgentTask[]).forEach(task => {
          insights.push({
            id: `active-task-${task.id}`,
            title: `Working on: ${task.title}`,
            description: task.description || 'In progress',
            type: 'info',
            deepLink: task.deep_link || '/(app)/(tabs)/tasks',
            taskId: task.id,
          });
        });
      }

      // Sort by type priority, then take top MAX_INSIGHTS
      insights.sort((a, b) => {
        const priorityDiff = INSIGHT_TYPE_PRIORITY[a.type] - INSIGHT_TYPE_PRIORITY[b.type];
        if (priorityDiff !== 0) return priorityDiff;
        return 0;
      });

      setState({
        insights: insights.slice(0, MAX_INSIGHTS),
        loading: false,
      });
    } catch {
      // Insights are non-critical; fail silently with empty state
      setState({
        insights: [],
        loading: false,
      });
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInsights();
    }
  }, [fetchInsights, isAuthenticated]);

  const refreshInsights = useCallback(async () => {
    await fetchInsights();
  }, [fetchInsights]);

  return {
    ...state,
    refreshInsights,
  };
}
