// useActivityFeed Hook - Aggregated activity feed for the Activity tab
// Combines agent tasks, payments, maintenance, inspections, arrears, and tenancy data
// into a unified chronological feed.

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export type ActivityItemType =
  | 'rent_collected'
  | 'rent_overdue'
  | 'inspection_scheduled'
  | 'inspection_completed'
  | 'maintenance_reported'
  | 'maintenance_completed'
  | 'lease_expiring'
  | 'arrears_detected'
  | 'tenant_application'
  | 'agent_task_completed'
  | 'agent_task_in_progress'
  | 'agent_pending_input'
  | 'reminder_sent'
  | 'message_received'
  | 'casa_proactive';

export interface ActivityFeedItem {
  id: string;
  type: ActivityItemType;
  title: string;
  description: string;
  timestamp: string;
  deepLink?: string;
  propertyAddress?: string;
  amount?: number;
  severity?: 'info' | 'success' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}

export interface PendingApprovalItem {
  id: string;
  taskId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  recommendation?: string;
  confidence?: number;
  previewData?: Record<string, unknown>;
  timestamp: string;
  deepLink?: string;
  propertyAddress?: string;
  tenantName?: string;
  amount?: number;
}

export interface ActivityFeedState {
  feedItems: ActivityFeedItem[];
  pendingApprovals: PendingApprovalItem[];
  loading: boolean;
  error: string | null;
}

export interface UseActivityFeedReturn extends ActivityFeedState {
  refreshFeed: () => Promise<void>;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

const CATEGORY_LABELS: Record<string, string> = {
  tenant_finding: 'Tenant Finding',
  lease_management: 'Lease Management',
  rent_collection: 'Rent Collection',
  maintenance: 'Maintenance',
  compliance: 'Compliance',
  general: 'General',
};

export function useActivityFeed(): UseActivityFeedReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ActivityFeedState>({
    feedItems: [],
    pendingApprovals: [],
    loading: true,
    error: null,
  });

  const fetchFeed = useCallback(async () => {
    if (!user) {
      setState({ feedItems: [], pendingApprovals: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const feedItems: ActivityFeedItem[] = [];
      const pendingApprovals: PendingApprovalItem[] = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString();

      // Fetch all data sources in parallel
      const [
        paymentsResult,
        maintenanceResult,
        inspectionsResult,
        arrearsResult,
        tenanciesResult,
        pendingTasksResult,
        completedTasksResult,
        inProgressTasksResult,
        pendingActionsResult,
        proactiveActionsResult,
        recentMessagesResult,
      ] = await Promise.all([
        // Recent payments
        supabase
          .from('payments')
          .select('id, amount, status, type, paid_date, due_date, created_at, tenancy_id')
          .in('status', ['completed', 'failed'])
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(20),

        // Active + recent maintenance requests
        supabase
          .from('maintenance_requests')
          .select('id, title, urgency, status, property_id, created_at, updated_at')
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(15),

        // Inspections (scheduled + recent completed)
        supabase
          .from('inspections')
          .select('id, inspection_type, status, scheduled_date, completed_date, property_id, created_at')
          .or(`status.eq.scheduled,and(status.eq.completed,completed_date.gte.${cutoff})`)
          .order('created_at', { ascending: false })
          .limit(10),

        // Active arrears
        supabase
          .from('arrears_records')
          .select('id, total_overdue, days_overdue, severity, tenancy_id, created_at')
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(10),

        // Expiring tenancies (within 90 days)
        (() => {
          const ninetyDays = new Date();
          ninetyDays.setDate(ninetyDays.getDate() + 90);
          return supabase
            .from('tenancies')
            .select('id, lease_end_date, property_id, status')
            .eq('status', 'active')
            .lte('lease_end_date', ninetyDays.toISOString().split('T')[0])
            .gte('lease_end_date', new Date().toISOString().split('T')[0])
            .order('lease_end_date', { ascending: true });
        })(),

        // Pending input tasks
        (supabase.from('agent_tasks') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending_input')
          .order('created_at', { ascending: false }),

        // Recently completed tasks
        (supabase.from('agent_tasks') as ReturnType<typeof supabase.from>)
          .select('id, title, description, category, status, completed_at, updated_at')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .gte('updated_at', cutoff)
          .order('updated_at', { ascending: false })
          .limit(10),

        // In-progress tasks
        (supabase.from('agent_tasks') as ReturnType<typeof supabase.from>)
          .select('id, title, description, category, status, updated_at')
          .eq('user_id', user.id)
          .eq('status', 'in_progress')
          .order('updated_at', { ascending: false })
          .limit(5),

        // Pending actions with rich context
        (supabase.from('agent_pending_actions') as ReturnType<typeof supabase.from>)
          .select('id, user_id, property_id, action_type, title, description, preview_data, tool_name, autonomy_level, status, recommendation, confidence, task_id, created_at')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10),

        // Recent proactive actions (Casa handled autonomously)
        (supabase.from('agent_proactive_actions') as ReturnType<typeof supabase.from>)
          .select('id, action_taken, trigger_type, was_auto_executed, created_at')
          .eq('user_id', user.id)
          .eq('was_auto_executed', true)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(10),

        // Recent messages received (conversations the user is part of)
        supabase
          .from('messages')
          .select('id, content, sender_id, conversation_id, created_at, content_type')
          .neq('sender_id', user.id)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      // Get property addresses for lookups
      const propertyIds = new Set<string>();
      maintenanceResult.data?.forEach((r: any) => propertyIds.add(r.property_id));
      inspectionsResult.data?.forEach((r: any) => r.property_id && propertyIds.add(r.property_id));
      tenanciesResult.data?.forEach((r: any) => propertyIds.add(r.property_id));
      pendingTasksResult.data?.forEach((r: any) => {
        if (r.related_entity_type === 'property' && r.related_entity_id) {
          propertyIds.add(r.related_entity_id);
        }
      });
      pendingActionsResult.data?.forEach((r: any) => {
        if (r.property_id) propertyIds.add(r.property_id);
      });

      const addressMap = new Map<string, string>();
      if (propertyIds.size > 0) {
        const { data: props } = await supabase
          .from('properties')
          .select('id, address_line_1, suburb')
          .in('id', Array.from(propertyIds));
        props?.forEach((p: any) => {
          addressMap.set(p.id, `${p.address_line_1}, ${p.suburb}`);
        });
      }

      // Process payments
      if (paymentsResult.data) {
        paymentsResult.data.forEach((payment: any) => {
          if (payment.status === 'completed' && payment.type === 'rent') {
            feedItems.push({
              id: `payment-${payment.id}`,
              type: 'rent_collected',
              title: 'Rent collected',
              description: `$${Math.round(payment.amount).toLocaleString()} received`,
              timestamp: payment.paid_date || payment.created_at,
              amount: payment.amount,
              severity: 'success',
              deepLink: '/(app)/payments',
            });
          } else if (payment.status === 'failed') {
            feedItems.push({
              id: `payment-failed-${payment.id}`,
              type: 'rent_overdue',
              title: 'Payment failed',
              description: `$${Math.round(payment.amount).toLocaleString()} payment unsuccessful`,
              timestamp: payment.created_at,
              amount: payment.amount,
              severity: 'error',
              deepLink: '/(app)/payments',
            });
          }
        });
      }

      // Process maintenance requests
      if (maintenanceResult.data) {
        maintenanceResult.data.forEach((req: any) => {
          const address = addressMap.get(req.property_id);
          if (req.status === 'reported' || req.status === 'in_progress') {
            feedItems.push({
              id: `maint-${req.id}`,
              type: 'maintenance_reported',
              title: req.title,
              description: address || 'Maintenance request',
              timestamp: req.created_at,
              propertyAddress: address,
              severity: req.urgency === 'emergency' || req.urgency === 'high' ? 'warning' : 'info',
              deepLink: `/(app)/maintenance/${req.id}`,
            });
          } else if (req.status === 'completed') {
            feedItems.push({
              id: `maint-done-${req.id}`,
              type: 'maintenance_completed',
              title: `Repair completed: ${req.title}`,
              description: address || 'Maintenance resolved',
              timestamp: req.updated_at,
              propertyAddress: address,
              severity: 'success',
              deepLink: `/(app)/maintenance/${req.id}`,
            });
          }
        });
      }

      // Process inspections
      if (inspectionsResult.data) {
        inspectionsResult.data.forEach((insp: any) => {
          const address = addressMap.get(insp.property_id);
          if (insp.status === 'scheduled') {
            const date = new Date(insp.scheduled_date);
            const formatted = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
            feedItems.push({
              id: `insp-${insp.id}`,
              type: 'inspection_scheduled',
              title: `${insp.inspection_type.charAt(0).toUpperCase() + insp.inspection_type.slice(1)} inspection`,
              description: `${formatted} · ${address || 'Property'}`,
              timestamp: insp.created_at,
              propertyAddress: address,
              severity: 'info',
              deepLink: `/(app)/inspections/${insp.id}`,
            });
          } else if (insp.status === 'completed') {
            feedItems.push({
              id: `insp-done-${insp.id}`,
              type: 'inspection_completed',
              title: 'Inspection completed',
              description: address || 'Property',
              timestamp: insp.completed_date || insp.created_at,
              propertyAddress: address,
              severity: 'success',
              deepLink: `/(app)/inspections/${insp.id}`,
            });
          }
        });
      }

      // Process arrears
      if (arrearsResult.data) {
        arrearsResult.data.forEach((arr: any) => {
          feedItems.push({
            id: `arrears-${arr.id}`,
            type: 'arrears_detected',
            title: `Overdue: $${Math.round(arr.total_overdue).toLocaleString()}`,
            description: `${arr.days_overdue} days overdue · ${arr.severity} severity`,
            timestamp: arr.created_at,
            amount: arr.total_overdue,
            severity: arr.severity === 'critical' || arr.severity === 'serious' ? 'error' : 'warning',
            deepLink: `/(app)/arrears/${arr.id}`,
          });
        });
      }

      // Process expiring tenancies
      if (tenanciesResult.data) {
        tenanciesResult.data.forEach((t: any) => {
          const address = addressMap.get(t.property_id);
          const endDate = new Date(t.lease_end_date);
          const daysUntil = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          feedItems.push({
            id: `lease-${t.id}`,
            type: 'lease_expiring',
            title: `Lease expires in ${daysUntil} days`,
            description: address || 'Property',
            timestamp: new Date().toISOString(), // Sort as current
            propertyAddress: address,
            severity: daysUntil <= 30 ? 'warning' : 'info',
            deepLink: `/(app)/tenancies/${t.id}`,
          });
        });
      }

      // Process agent tasks - pending input → pending approvals
      if (pendingTasksResult.data) {
        (pendingTasksResult.data as any[]).forEach(task => {
          const taskAddress = task.related_entity_type === 'property' && task.related_entity_id
            ? addressMap.get(task.related_entity_id)
            : undefined;
          pendingApprovals.push({
            id: `pending-${task.id}`,
            taskId: task.id,
            title: task.title,
            description: task.description || 'Needs your input',
            category: CATEGORY_LABELS[task.category] || task.category,
            priority: task.priority,
            recommendation: task.recommendation,
            timestamp: task.updated_at || task.created_at,
            deepLink: task.deep_link,
            propertyAddress: taskAddress,
          });
        });
      }

      // Process pending actions (from agent_pending_actions - richer than tasks)
      if (pendingActionsResult.data) {
        const existingTaskIds = new Set(pendingApprovals.map(p => p.taskId));
        (pendingActionsResult.data as any[]).forEach(action => {
          // Skip if we already have this task from pending_tasks
          if (action.task_id && existingTaskIds.has(action.task_id)) return;
          const actionAddress = action.property_id ? addressMap.get(action.property_id) : undefined;
          const preview = action.preview_data as Record<string, unknown> | null;
          pendingApprovals.push({
            id: `action-${action.id}`,
            taskId: action.task_id || action.id,
            title: action.title,
            description: action.description || 'Needs your approval',
            category: CATEGORY_LABELS[action.action_type] || action.action_type,
            priority: action.autonomy_level <= 1 ? 'high' : 'normal',
            recommendation: action.recommendation || undefined,
            confidence: action.confidence ? Number(action.confidence) : undefined,
            previewData: preview || undefined,
            timestamp: action.created_at,
            propertyAddress: actionAddress,
            tenantName: preview?.tenant_name as string || undefined,
            amount: preview?.estimated_cost as number || preview?.amount as number || undefined,
          });
        });
      }

      // Process agent tasks - completed
      if (completedTasksResult.data) {
        (completedTasksResult.data as any[]).forEach(task => {
          feedItems.push({
            id: `task-done-${task.id}`,
            type: 'agent_task_completed',
            title: `Casa completed: ${task.title}`,
            description: CATEGORY_LABELS[task.category] || task.category,
            timestamp: task.completed_at || task.updated_at,
            severity: 'success',
            metadata: { agentHandled: true },
          });
        });
      }

      // Process agent tasks - in progress
      if (inProgressTasksResult.data) {
        (inProgressTasksResult.data as any[]).forEach(task => {
          feedItems.push({
            id: `task-active-${task.id}`,
            type: 'agent_task_in_progress',
            title: `Working on: ${task.title}`,
            description: task.description || CATEGORY_LABELS[task.category] || 'In progress',
            timestamp: task.updated_at,
            severity: 'info',
            metadata: { agentHandled: true },
          });
        });
      }

      // Process proactive actions (Casa did autonomously)
      if (proactiveActionsResult.data) {
        (proactiveActionsResult.data as any[]).forEach(action => {
          feedItems.push({
            id: `proactive-${action.id}`,
            type: 'casa_proactive',
            title: `Casa handled: ${action.action_taken}`,
            description: `Triggered by ${action.trigger_type.replace(/_/g, ' ')}`,
            timestamp: action.created_at,
            severity: 'success',
            metadata: { agentHandled: true },
          });
        });
      }

      // Process recent messages received
      if (recentMessagesResult.data) {
        (recentMessagesResult.data as any[]).forEach(msg => {
          const preview = msg.content_type === 'image' ? 'Sent an image' : (msg.content || '').slice(0, 60);
          feedItems.push({
            id: `msg-${msg.id}`,
            type: 'message_received',
            title: 'New message',
            description: preview,
            timestamp: msg.created_at,
            severity: 'info',
            deepLink: `/(app)/messages/${msg.conversation_id}`,
          });
        });
      }

      // Sort feed items by timestamp (newest first)
      feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Sort pending approvals by priority then timestamp
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      pendingApprovals.sort((a, b) => {
        const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (pDiff !== 0) return pDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setState({
        feedItems,
        pendingApprovals,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load activity feed',
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFeed();
    }
  }, [fetchFeed, isAuthenticated]);

  const refreshFeed = useCallback(async () => {
    await fetchFeed();
  }, [fetchFeed]);

  return {
    ...state,
    refreshFeed,
  };
}
