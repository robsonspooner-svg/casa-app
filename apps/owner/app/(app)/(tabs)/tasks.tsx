import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useAgentTasks, AgentTask, TimelineEntry } from '@casa/api';
import { Badge } from '@casa/ui';

const CATEGORY_LABELS: Record<string, string> = {
  tenant_finding: 'Tenant Finding',
  lease_management: 'Lease Management',
  rent_collection: 'Rent Collection',
  maintenance: 'Maintenance',
  compliance: 'Compliance',
  general: 'General',
  inspections: 'Inspections',
  listings: 'Listings',
  financial: 'Financial',
  insurance: 'Insurance',
  communication: 'Communication',
};

// Map raw tool names to user-friendly labels
const TOOL_NAME_LABELS: Record<string, string> = {
  search_trades_hipages: 'Find a tradesperson',
  send_rent_reminder: 'Send rent reminder',
  send_email: 'Send email',
  send_sms: 'Send SMS',
  create_maintenance_request: 'Create maintenance request',
  update_maintenance_request: 'Update maintenance request',
  assign_trade: 'Assign tradesperson',
  schedule_inspection: 'Schedule inspection',
  create_listing: 'Create listing',
  update_listing: 'Update listing',
  generate_lease: 'Generate lease',
  record_payment: 'Record payment',
  create_arrears_record: 'Create arrears record',
  send_arrears_notice: 'Send arrears notice',
  send_lease_renewal: 'Send lease renewal',
  create_work_order: 'Create work order',
  approve_application: 'Approve application',
  reject_application: 'Reject application',
  send_tenant_notice: 'Send tenant notice',
  update_property: 'Update property details',
  create_payment_plan: 'Create payment plan',
  lodge_bond: 'Lodge bond',
  generate_report: 'Generate report',
};

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function humanizeText(text: string): string {
  const trimmed = text.split(':')[0].trim();
  if (TOOL_NAME_LABELS[trimmed]) return TOOL_NAME_LABELS[trimmed];
  let cleaned = text.replace(UUID_REGEX, '').trim();
  cleaned = cleaned.replace(/\b\w+_id:\s*/gi, '').trim();
  cleaned = cleaned.replace(/[,:]+\s*$/, '').trim();
  if (!cleaned || cleaned.length < 3) return 'Task';
  return cleaned;
}

const PRIORITY_BADGE: Record<string, { label: string; variant: 'error' | 'warning' | 'info' | 'neutral' }> = {
  urgent: { label: 'URGENT', variant: 'error' },
  high: { label: 'HIGH', variant: 'warning' },
  normal: { label: 'NORMAL', variant: 'neutral' },
  low: { label: 'LOW', variant: 'neutral' },
};

function formatDate(dateStr: string): string {
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

function formatTimelineDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function TimelineIcon({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <View style={[styles.timelineIcon, styles.timelineIconCompleted]}>
        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
          <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    );
  }
  if (status === 'current') {
    return (
      <View style={[styles.timelineIcon, styles.timelineIconCurrent]}>
        <View style={styles.timelineIconCurrentDot} />
      </View>
    );
  }
  return (
    <View style={[styles.timelineIcon, styles.timelineIconPending]}>
      <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={4} fill={THEME.colors.textTertiary} />
      </Svg>
    </View>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <TimelineIcon status={entry.status} />
        <View style={styles.timelineLine} />
      </View>
      <TouchableOpacity
        style={styles.timelineContent}
        onPress={() => entry.reasoning && setShowReasoning(!showReasoning)}
        disabled={!entry.reasoning}
        activeOpacity={0.7}
      >
        <Text style={styles.timelineDate}>
          {formatTimelineDate(entry.timestamp)}
        </Text>
        <Text style={[
          styles.timelineAction,
          entry.status === 'pending' && styles.timelineActionPending,
        ]}>
          {entry.action}
        </Text>
        {entry.reasoning && showReasoning && (
          <View style={styles.reasoningContainer}>
            <Text style={styles.reasoningText}>{entry.reasoning}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function TaskCard({
  task,
  onApprove,
  onReject,
  onTakeControl,
  onResume,
}: {
  task: AgentTask;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onTakeControl: (taskId: string) => void;
  onResume: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(task.status === 'pending_input');
  const timeline = (task.timeline as TimelineEntry[]) || [];
  const priority = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.normal;
  const category = CATEGORY_LABELS[task.category] || task.category;
  const isPaused = task.manual_override;

  return (
    <View style={styles.taskCard}>
      <TouchableOpacity
        style={styles.taskCardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.taskCardTitleRow}>
          <View style={styles.taskCardTitleLeft}>
            <Text style={styles.taskCardTitle} numberOfLines={2}>
              {humanizeText(task.title)}
            </Text>
            <View style={styles.taskCardMeta}>
              <Text style={styles.taskCardCategory}>{category}</Text>
              {task.priority !== 'normal' && (
                <Badge label={priority.label} variant={priority.variant} />
              )}
              {isPaused && (
                <Badge label="MANUAL" variant="info" />
              )}
            </View>
          </View>
          <View style={styles.taskCardRight}>
            <Text style={styles.taskCardTime}>{formatDate(task.updated_at)}</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d={expanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}
                stroke={THEME.colors.textTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.taskCardBody}>
          {task.description && (
            <Text style={styles.taskDescription}>{humanizeText(task.description)}</Text>
          )}

          {timeline.length > 0 && (
            <View style={styles.timelineContainer}>
              <Text style={styles.timelineSectionTitle}>Timeline</Text>
              {timeline.map((entry, idx) => (
                <TimelineRow key={idx} entry={entry} />
              ))}
            </View>
          )}

          {task.recommendation && (
            <View style={styles.recommendationContainer}>
              <View style={styles.recommendationHeader}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke={THEME.colors.brandIndigo}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.recommendationTitle}>Agent Recommendation</Text>
              </View>
              <Text style={styles.recommendationText}>{task.recommendation}</Text>
            </View>
          )}

          <View style={styles.taskActions}>
            {task.status === 'pending_input' && (
              <>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => onApprove(task.id)}
                  activeOpacity={0.7}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => onReject(task.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </>
            )}
            {(task.status === 'in_progress' || task.status === 'scheduled') && !isPaused && (
              <>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => onTakeControl(task.id)}
                  activeOpacity={0.7}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M10 9V6l-7 7 7 7v-3.17C15 16.83 19 18 22 21c0-7-3-14-12-15z" fill={THEME.colors.textPrimary} />
                  </Svg>
                  <Text style={styles.controlButtonText}>Take Control</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => router.push({ pathname: '/(app)/task-detail', params: { id: task.id } } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailButtonText}>Details</Text>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brandIndigo} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              </>
            )}
            {isPaused && (
              <>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => router.push({ pathname: '/(app)/task-detail', params: { id: task.id } } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.controlButtonText}>Manage</Text>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resumeButton}
                  onPress={() => onResume(task.id)}
                  activeOpacity={0.7}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 3l14 9-14 9V3z" fill={THEME.colors.textInverse} />
                  </Svg>
                  <Text style={styles.resumeButtonText}>Resume Agent</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
          <Path
            d="M22 11.08V12a10 10 0 11-5.93-9.14"
            stroke={THEME.colors.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M22 4L12 14.01l-3-3"
            stroke={THEME.colors.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={styles.emptyTitle}>All caught up</Text>
      <Text style={styles.emptyText}>
        No pending tasks. Casa will notify you when something needs attention.
      </Text>
    </View>
  );
}

interface TaskSection {
  title: string;
  data: AgentTask[];
  icon: string;
}

export default function TasksScreen() {
  const {
    loading,
    refreshing,
    error,
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
  } = useAgentTasks();

  const handleApprove = useCallback(async (taskId: string) => {
    // For now, approve the task directly — in the full implementation,
    // this would find the associated pending action
    await approveTask(taskId, taskId);
  }, [approveTask]);

  const handleReject = useCallback(async (taskId: string) => {
    await rejectTask(taskId, taskId);
  }, [rejectTask]);

  const handleTakeControl = useCallback(async (taskId: string) => {
    await takeControl(taskId);
  }, [takeControl]);

  const handleResume = useCallback(async (taskId: string) => {
    await resumeTask(taskId);
  }, [resumeTask]);

  // Build sections (only include non-empty ones)
  const sections: TaskSection[] = [];
  if (pendingInputTasks.length > 0) {
    sections.push({ title: 'Needs Your Input', data: pendingInputTasks, icon: 'alert' });
  }
  if (inProgressTasks.length > 0) {
    sections.push({ title: 'In Progress', data: inProgressTasks, icon: 'progress' });
  }
  if (scheduledTasks.length > 0) {
    sections.push({ title: 'Scheduled', data: scheduledTasks, icon: 'clock' });
  }
  if (completedTasks.length > 0) {
    sections.push({ title: 'Recently Completed', data: completedTasks, icon: 'check' });
  }

  const hasTasks = sections.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Tasks</Text>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>
          {pendingCount > 0
            ? `${pendingCount} item${pendingCount > 1 ? 's' : ''} need${pendingCount === 1 ? 's' : ''} your attention`
            : 'Everything the agent is doing'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : !hasTasks ? (
        <EmptyState />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onApprove={handleApprove}
              onReject={handleReject}
              onTakeControl={handleTakeControl}
              onResume={handleResume}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <SectionIcon type={section.icon} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshTasks}
              tintColor={THEME.colors.brand}
            />
          }
        />
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function SectionIcon({ type }: { type: string }) {
  const color = type === 'alert' ? THEME.colors.warning : THEME.colors.textSecondary;

  switch (type) {
    case 'alert':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'progress':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} />
          <Path d="M12 6v6l4 2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M22 4L12 14.01l-3-3" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing['2xl'],
    paddingBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  title: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  pendingBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textInverse,
  },
  subtitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing['2xl'],
  },
  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    paddingVertical: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textTertiary,
  },
  // Task card
  taskCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    marginBottom: THEME.spacing.md,
    overflow: 'hidden',
    ...THEME.shadow.sm,
  },
  taskCardHeader: {
    padding: THEME.spacing.base,
  },
  taskCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskCardTitleLeft: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  taskCardTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  taskCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  taskCardCategory: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  taskCardRight: {
    alignItems: 'flex-end',
    gap: THEME.spacing.xs,
  },
  taskCardTime: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  // Task card body
  taskCardBody: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.base,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  taskDescription: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  // Timeline
  timelineContainer: {
    marginTop: THEME.spacing.md,
  },
  timelineSectionTitle: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 40,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineIconCompleted: {
    backgroundColor: THEME.colors.successBg,
  },
  timelineIconCurrent: {
    backgroundColor: THEME.colors.infoBg,
  },
  timelineIconCurrentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.info,
  },
  timelineIconPending: {
    backgroundColor: THEME.colors.subtle,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: THEME.colors.border,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: THEME.spacing.sm,
    paddingBottom: THEME.spacing.md,
  },
  timelineDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginBottom: 2,
  },
  timelineAction: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
  },
  timelineActionPending: {
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
  },
  reasoningContainer: {
    marginTop: THEME.spacing.sm,
    padding: THEME.spacing.md,
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.sm,
  },
  reasoningText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  // Recommendation
  recommendationContainer: {
    marginTop: THEME.spacing.md,
    padding: THEME.spacing.md,
    backgroundColor: THEME.colors.brand + '15',
    borderRadius: THEME.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.brandIndigo,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  recommendationTitle: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.brandIndigo,
  },
  recommendationText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    lineHeight: 22,
  },
  // Action buttons
  taskActions: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.base,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    height: 44,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
  },
  approveButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textInverse,
  },
  rejectButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  rejectButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    height: 44,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  controlButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.md,
  },
  detailButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.brandIndigo,
  },
  resumeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    height: 44,
    backgroundColor: THEME.colors.brandIndigo,
    borderRadius: THEME.radius.md,
  },
  resumeButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textInverse,
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.base,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Error
  errorContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.errorBg,
  },
  errorText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.error,
  },
});
