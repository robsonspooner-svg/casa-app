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

export type ApprovalActionType = 'advisory' | 'tool_execution';

export interface PendingApprovalItem {
  id: string;
  taskId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  actionType: ApprovalActionType;
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
  inspections: 'Inspections',
  listings: 'Listings',
  financial: 'Financial',
  insurance: 'Insurance',
  communication: 'Communication',
  general: 'General',
};

// Map raw tool names to user-friendly action descriptions
const TOOL_NAME_LABELS: Record<string, string> = {
  search_trades_hipages: 'Find a tradesperson',
  send_rent_reminder: 'Send rent reminder',
  send_email: 'Send email',
  send_sms: 'Send SMS',
  send_sms_twilio: 'Send SMS',
  send_push_expo: 'Send push notification',
  send_message: 'Send message',
  send_in_app_message: 'Send message',
  send_breach_notice: 'Send breach notice',
  send_receipt: 'Send payment receipt',
  send_docusign_envelope: 'Send for signature',
  create_maintenance_request: 'Create maintenance request',
  update_maintenance_request: 'Update maintenance request',
  update_maintenance_status: 'Update maintenance status',
  record_maintenance_cost: 'Record maintenance cost',
  assign_trade: 'Assign tradesperson',
  schedule_inspection: 'Schedule inspection',
  create_listing: 'Create listing',
  update_listing: 'Update listing',
  generate_listing: 'Generate listing',
  generate_lease: 'Generate lease',
  record_payment: 'Record payment',
  create_arrears_record: 'Create arrears record',
  send_arrears_notice: 'Send arrears notice',
  send_lease_renewal: 'Send lease renewal',
  create_work_order: 'Create work order',
  generate_work_order: 'Generate work order',
  update_work_order_status: 'Update work order',
  approve_application: 'Approve application',
  reject_application: 'Reject application',
  approve_quote: 'Approve quote',
  reject_quote: 'Reject quote',
  send_tenant_notice: 'Send tenant notice',
  update_property: 'Update property details',
  update_tenancy: 'Update tenancy',
  create_payment_plan: 'Create payment plan',
  create_rent_increase: 'Create rent increase',
  lodge_bond: 'Lodge bond',
  lodge_bond_state: 'Lodge bond',
  generate_report: 'Generate report',
  generate_financial_report: 'Generate financial report',
  generate_tax_report: 'Generate tax report',
  generate_property_summary: 'Generate property summary',
  generate_portfolio_report: 'Generate portfolio report',
  generate_cash_flow_forecast: 'Generate cash flow forecast',
  generate_inspection_report: 'Generate inspection report',
  generate_wealth_report: 'Generate wealth report',
  generate_property_action_plan: 'Generate action plan',
  create_conversation: 'Start conversation',
  tenant_connect_with_code: 'Connect tenant with code',
  update_autopay: 'Update autopay settings',
  update_document_status: 'Update document status',
  suggest_navigation: 'Navigate',
  estimate_cost: 'Estimate cost',
  web_search: 'Search the web',
  get_owner_rules: 'Check owner preferences',
};

// Strip UUIDs and raw technical identifiers from user-facing text
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function humanizeToolName(name: string): string {
  // Convert snake_case tool name to Title Case words
  return name
    .replace(/^(get|search|list)_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function humanizeTitle(title: string, toolName?: string): string {
  // If we have a tool name, check the friendly label map first
  if (toolName && TOOL_NAME_LABELS[toolName]) {
    return TOOL_NAME_LABELS[toolName];
  }

  // Check if the title itself starts with a known tool name
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0) {
    const prefix = title.substring(0, colonIndex).trim();
    if (TOOL_NAME_LABELS[prefix]) {
      return TOOL_NAME_LABELS[prefix];
    }
    // If prefix looks like a snake_case tool name, humanize it
    if (/^[a-z_]+$/.test(prefix)) {
      return humanizeToolName(prefix);
    }
  }

  // If toolName is provided but not in labels, auto-humanize it
  if (toolName && /^[a-z_]+$/.test(toolName)) {
    return humanizeToolName(toolName);
  }

  // Strip UUIDs from the title
  let cleaned = title.replace(UUID_REGEX, '').trim();

  // Remove JSON-like content: {...} or [...]
  cleaned = cleaned.replace(/\{[^}]*\}/g, '').replace(/\[[^\]]*\]/g, '').trim();

  // Clean up residual formatting: "property_id: " → "", "tenancy_id: " → ""
  cleaned = cleaned.replace(/\b\w+_id:\s*/gi, '').trim();

  // Remove trailing colons, commas, or leftover formatting
  cleaned = cleaned.replace(/[,:]+\s*$/, '').trim();

  // If nothing meaningful is left, fall back to a generic label
  if (!cleaned || cleaned.length < 3) {
    if (toolName) return humanizeToolName(toolName);
    return 'Action requires approval';
  }

  return cleaned;
}

function humanizeDescription(desc: string): string {
  // Strip UUIDs from descriptions
  let cleaned = desc.replace(UUID_REGEX, '').trim();
  cleaned = cleaned.replace(/\b\w+_id:\s*/gi, '').trim();
  cleaned = cleaned.replace(/[,:]+\s*$/, '').trim();
  if (!cleaned || cleaned.length < 3) return 'Needs your approval';
  return cleaned;
}

function humanizeRecommendation(rec: string): string {
  // Replace old technical L-level format with human-readable text
  // Old: 'your autonomy setting for "action" is L2 and this action requires L4'
  const lLevelMatch = rec.match(/your autonomy setting for "(\w+)" is L\d+ and this action requires L\d+/i);
  if (lLevelMatch) {
    const category = lLevelMatch[1].replace(/_/g, ' ');
    return rec.replace(lLevelMatch[0], `your autonomy settings require manual confirmation for ${category} actions`);
  }
  // Also handle orchestrator format
  const orchMatch = rec.match(/Your autonomy for "(\w+)" is L\d+, this requires L\d+/i);
  if (orchMatch) {
    const category = orchMatch[1].replace(/_/g, ' ');
    return rec.replace(orchMatch[0], `Your autonomy settings require manual confirmation for ${category} actions`);
  }
  return rec;
}

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

        // Pending actions with rich context (exclude expired)
        (supabase.from('agent_pending_actions') as ReturnType<typeof supabase.from>)
          .select('id, user_id, property_id, action_type, title, description, preview_data, tool_name, tool_params, autonomy_level, status, recommendation, confidence, task_id, created_at, expires_at')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(20),

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
            title: humanizeTitle(task.title || '', task.tool_name),
            description: humanizeDescription(task.description || 'Needs your input'),
            category: CATEGORY_LABELS[task.category] || task.category,
            priority: task.priority,
            actionType: 'advisory' as ApprovalActionType,
            recommendation: task.recommendation ? humanizeRecommendation(task.recommendation) : undefined,
            timestamp: task.updated_at || task.created_at,
            deepLink: task.deep_link,
            propertyAddress: taskAddress,
          });
        });
      }

      // Process pending actions (from agent_pending_actions - richer than tasks)
      // Deduplicate by tool_name + key params to avoid showing the same action multiple times
      if (pendingActionsResult.data) {
        const existingTaskIds = new Set(pendingApprovals.map(p => p.taskId));
        const seenActionKeys = new Set<string>();
        (pendingActionsResult.data as any[]).forEach(action => {
          // Skip if we already have this task from pending_tasks
          if (action.task_id && existingTaskIds.has(action.task_id)) return;

          // Dedup: build a key from tool_name + serialised params to skip identical actions
          const params = action.tool_params || {};
          const dedupKey = `${action.tool_name}:${JSON.stringify(params)}`;
          if (seenActionKeys.has(dedupKey)) return;
          seenActionKeys.add(dedupKey);

          const actionAddress = action.property_id ? addressMap.get(action.property_id) : undefined;
          const preview = action.preview_data as Record<string, unknown> | null;
          pendingApprovals.push({
            id: `action-${action.id}`,
            taskId: action.task_id || action.id,
            title: humanizeTitle(action.title || '', action.tool_name),
            description: humanizeDescription(action.description || 'Needs your approval'),
            category: CATEGORY_LABELS[action.action_type] || action.action_type,
            priority: action.autonomy_level <= 1 ? 'high' : 'normal',
            actionType: 'tool_execution' as ApprovalActionType,
            recommendation: action.recommendation ? humanizeRecommendation(action.recommendation) : undefined,
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
            title: `Casa completed: ${humanizeTitle(task.title || '')}`,
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
            title: `Working on: ${humanizeTitle(task.title || '')}`,
            description: humanizeDescription(task.description || CATEGORY_LABELS[task.category] || 'In progress'),
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
            title: `Casa handled: ${humanizeTitle(action.action_taken || '')}`,
            description: `Triggered by ${(action.trigger_type || '').replace(/_/g, ' ')}`,
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
