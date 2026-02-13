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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useAgentTasks, AgentTask, TimelineEntry } from '@casa/api';
import { Badge } from '@casa/ui';

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: 'Maintenance',
  rent_collection: 'Rent',
  lease_management: 'Lease',
  compliance: 'Compliance',
  communication: 'Communication',
  general: 'General',
  inspections: 'Inspections',
};

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
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <TimelineIcon status={entry.status} />
        <View style={styles.timelineLine} />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineDate}>
          {formatTimelineDate(entry.timestamp)}
        </Text>
        <Text style={[
          styles.timelineAction,
          entry.status === 'pending' && styles.timelineActionPending,
        ]}>
          {entry.action}
        </Text>
      </View>
    </View>
  );
}

function TaskCard({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(task.status === 'pending_input');
  const timeline = (task.timeline as TimelineEntry[]) || [];
  const priority = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.normal;
  const category = CATEGORY_LABELS[task.category] || task.category;

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
              {task.title}
            </Text>
            <View style={styles.taskCardMeta}>
              <Text style={styles.taskCardCategory}>{category}</Text>
              {task.priority !== 'normal' && (
                <Badge label={priority.label} variant={priority.variant} />
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
            <Text style={styles.taskDescription}>{task.description}</Text>
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
              <Text style={styles.recommendationTitle}>What to know</Text>
              <Text style={styles.recommendationText}>{task.recommendation}</Text>
            </View>
          )}
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
        No updates right now. You'll be notified when something needs your attention.
      </Text>
    </View>
  );
}

interface TaskSection {
  title: string;
  data: AgentTask[];
}

export default function TenantTasksScreen() {
  const insets = useSafeAreaInsets();
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
  } = useAgentTasks();

  const sections: TaskSection[] = [];
  if (pendingInputTasks.length > 0) {
    sections.push({ title: 'Needs Attention', data: pendingInputTasks });
  }
  if (inProgressTasks.length > 0) {
    sections.push({ title: 'In Progress', data: inProgressTasks });
  }
  if (scheduledTasks.length > 0) {
    sections.push({ title: 'Upcoming', data: scheduledTasks });
  }
  if (completedTasks.length > 0) {
    sections.push({ title: 'Completed', data: completedTasks });
  }

  const hasTasks = sections.length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Updates</Text>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>
          {pendingCount > 0
            ? `${pendingCount} update${pendingCount > 1 ? 's' : ''} for you`
            : 'Maintenance, rent, and lease updates'}
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
          renderItem={({ item }) => <TaskCard task={item} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  pendingBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textTertiary,
  },
  taskCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  taskCardHeader: {
    padding: 14,
  },
  taskCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskCardTitleLeft: {
    flex: 1,
    marginRight: 10,
  },
  taskCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  taskCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskCardCategory: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  taskCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  taskCardTime: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  taskCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  taskDescription: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 12,
  },
  timelineContainer: {
    marginTop: 12,
  },
  timelineSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 36,
  },
  timelineLeft: {
    width: 22,
    alignItems: 'center',
  },
  timelineIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
    paddingLeft: 8,
    paddingBottom: 10,
  },
  timelineDate: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    marginBottom: 2,
  },
  timelineAction: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
  },
  timelineActionPending: {
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
  },
  recommendationContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 14,
    color: THEME.colors.textPrimary,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: THEME.colors.errorBg,
  },
  errorText: {
    fontSize: 13,
    color: THEME.colors.error,
  },
});
