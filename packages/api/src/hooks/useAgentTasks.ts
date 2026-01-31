// useAgentTasks Hook - Agent Tasks Timeline
// Mission 14: AI Agent Task Management

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { AgentTask, AgentTaskStatus } from '../types/database';

export interface AgentTasksState {
  tasks: AgentTask[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface UseAgentTasksReturn extends AgentTasksState {
  pendingInputTasks: AgentTask[];
  inProgressTasks: AgentTask[];
  scheduledTasks: AgentTask[];
  completedTasks: AgentTask[];
  pendingCount: number;
  refreshTasks: () => Promise<void>;
  approveTask: (taskId: string, actionId: string) => Promise<boolean>;
  rejectTask: (taskId: string, actionId: string, reason?: string) => Promise<boolean>;
  takeControl: (taskId: string) => Promise<boolean>;
  resumeTask: (taskId: string) => Promise<boolean>;
}

export function useAgentTasks(): UseAgentTasksReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<AgentTasksState>({
    tasks: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchTasks = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ tasks: [], loading: false, error: null, refreshing: false });
      return;
    }

    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setState({
        tasks: (data || []) as AgentTask[],
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch tasks';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
    }
  }, [fetchTasks, isAuthenticated]);

  const refreshTasks = useCallback(async () => {
    await fetchTasks(true);
  }, [fetchTasks]);

  // Split tasks into sections by status
  const pendingInputTasks = useMemo(
    () => state.tasks.filter(t => t.status === 'pending_input'),
    [state.tasks]
  );

  const inProgressTasks = useMemo(
    () => state.tasks.filter(t => t.status === 'in_progress' || t.status === 'paused'),
    [state.tasks]
  );

  const scheduledTasks = useMemo(
    () => state.tasks.filter(t => t.status === 'scheduled'),
    [state.tasks]
  );

  const completedTasks = useMemo(
    () => state.tasks.filter(t => t.status === 'completed' || t.status === 'cancelled'),
    [state.tasks]
  );

  const pendingCount = pendingInputTasks.length;

  const approveTask = useCallback(async (taskId: string, actionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      // Approve the pending action associated with this task
      const { error: actionError } = await (supabase
        .from('agent_pending_actions') as ReturnType<typeof supabase.from>)
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', actionId)
        .eq('user_id', user.id);

      if (actionError) throw actionError;

      // Update the task status to in_progress
      const { error: taskError } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .update({
          status: 'in_progress' as AgentTaskStatus,
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (taskError) throw taskError;

      // Refresh tasks to get updated state
      await fetchTasks();
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to approve task';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, fetchTasks]);

  const rejectTask = useCallback(async (taskId: string, actionId: string, reason?: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const updateData: Record<string, unknown> = {
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      };

      if (reason) {
        updateData.recommendation = reason;
      }

      // Reject the pending action
      const { error: actionError } = await (supabase
        .from('agent_pending_actions') as ReturnType<typeof supabase.from>)
        .update(updateData)
        .eq('id', actionId)
        .eq('user_id', user.id);

      if (actionError) throw actionError;

      // Update the task status to cancelled
      const { error: taskError } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .update({
          status: 'cancelled' as AgentTaskStatus,
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (taskError) throw taskError;

      await fetchTasks();
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to reject task';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, fetchTasks]);

  const takeControl = useCallback(async (taskId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .update({
          manual_override: true,
          status: 'paused' as AgentTaskStatus,
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Optimistically update local state
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === taskId
            ? { ...t, manual_override: true, status: 'paused' as AgentTaskStatus }
            : t
        ),
      }));

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to take control of task';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user]);

  const resumeTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .update({
          manual_override: false,
          status: 'in_progress' as AgentTaskStatus,
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Optimistically update local state
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === taskId
            ? { ...t, manual_override: false, status: 'in_progress' as AgentTaskStatus }
            : t
        ),
      }));

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to resume task';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user]);

  return {
    ...state,
    pendingInputTasks,
    inProgressTasks,
    scheduledTasks,
    completedTasks,
    pendingCount,
    refreshTasks,
    approveTask,
    rejectTask,
    takeControl,
    resumeTask,
  };
}
