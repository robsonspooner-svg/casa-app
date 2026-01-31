// useCasaPropertyActions Hook - Property-scoped agent action tracking
// Tracks what Casa has done for a specific property to prevent duplicate actions
// and surface context banners in property sub-tabs.

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { AgentProactiveAction, AgentTask } from '../types/database';

export interface CasaPropertyAction {
  id: string;
  type: 'communication' | 'maintenance' | 'inspection' | 'financial' | 'lease';
  title: string;
  description: string;
  timestamp: string;
  wasAutoExecuted: boolean;
}

export interface UseCasaPropertyActionsReturn {
  recentActions: CasaPropertyAction[];
  hasCommunicatedWithTenant: boolean;
  lastTenantCommunication: CasaPropertyAction | null;
  hasActiveMaintenanceTask: boolean;
  hasScheduledInspection: boolean;
  hasSentRentReminder: boolean;
  loading: boolean;
  refreshActions: () => Promise<void>;
}

// Map trigger types and categories to action types
function categorizeAction(
  source: 'proactive' | 'task',
  item: { trigger_type?: string; category?: string; action_taken?: string; title?: string },
): CasaPropertyAction['type'] {
  const text = (item.action_taken || item.title || '').toLowerCase();
  const triggerType = (item.trigger_type || '').toLowerCase();
  const category = (item.category || '').toLowerCase();

  if (category === 'maintenance' || text.includes('maintenance') || text.includes('repair')) {
    return 'maintenance';
  }
  if (category === 'compliance' || text.includes('inspection') || text.includes('inspect')) {
    return 'inspection';
  }
  if (category === 'rent_collection' || text.includes('rent') || text.includes('payment') || triggerType === 'arrears') {
    return 'financial';
  }
  if (category === 'lease_management' || text.includes('lease') || text.includes('tenancy')) {
    return 'lease';
  }
  if (text.includes('notify') || text.includes('remind') || text.includes('sent') || text.includes('contact') || text.includes('message') || text.includes('inform')) {
    return 'communication';
  }
  return 'communication';
}

export function useCasaPropertyActions(propertyId: string | undefined): UseCasaPropertyActionsReturn {
  const { user } = useAuth();
  const [recentActions, setRecentActions] = useState<CasaPropertyAction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    if (!user || !propertyId) {
      setRecentActions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const actions: CasaPropertyAction[] = [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch proactive actions related to this property
      const { data: proactiveData } = await (supabase
        .from('agent_proactive_actions') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .eq('related_entity_type', 'property')
        .eq('related_entity_id', propertyId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (proactiveData) {
        (proactiveData as AgentProactiveAction[]).forEach(action => {
          actions.push({
            id: `proactive-${action.id}`,
            type: categorizeAction('proactive', action),
            title: action.action_taken,
            description: `Triggered by ${action.trigger_type}`,
            timestamp: action.created_at,
            wasAutoExecuted: action.was_auto_executed,
          });
        });
      }

      // Fetch agent tasks related to this property
      const { data: taskData } = await (supabase
        .from('agent_tasks') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .eq('related_entity_type', 'property')
        .eq('related_entity_id', propertyId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (taskData) {
        (taskData as AgentTask[]).forEach(task => {
          actions.push({
            id: `task-${task.id}`,
            type: categorizeAction('task', task),
            title: task.title,
            description: task.description || task.category,
            timestamp: task.updated_at || task.created_at,
            wasAutoExecuted: task.status === 'completed',
          });
        });
      }

      // Sort by timestamp (newest first)
      actions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setRecentActions(actions);
    } catch {
      setRecentActions([]);
    } finally {
      setLoading(false);
    }
  }, [user, propertyId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // Derived booleans for quick checks
  const hasCommunicatedWithTenant = recentActions.some(a => a.type === 'communication');
  const lastTenantCommunication = recentActions.find(a => a.type === 'communication') || null;
  const hasActiveMaintenanceTask = recentActions.some(a => a.type === 'maintenance');
  const hasScheduledInspection = recentActions.some(a => a.type === 'inspection');
  const hasSentRentReminder = recentActions.some(
    a => a.type === 'financial' && (a.title.toLowerCase().includes('remind') || a.title.toLowerCase().includes('sent')),
  );

  return {
    recentActions,
    hasCommunicatedWithTenant,
    lastTenantCommunication,
    hasActiveMaintenanceTask,
    hasScheduledInspection,
    hasSentRentReminder,
    loading,
    refreshActions: fetchActions,
  };
}
