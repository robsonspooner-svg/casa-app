// Inspections Dashboard - Owner View
// Mission 11: Property Inspections
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button } from '@casa/ui';
import { useInspections } from '@casa/api';
import type { InspectionStatus, InspectionType } from '@casa/api';
import type { InspectionListItem } from '@casa/api';

const STATUS_CONFIG: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: THEME.colors.subtle },
  tenant_review: { label: 'Tenant Review', color: THEME.colors.brand, bg: THEME.colors.brand + '20' },
  disputed: { label: 'Disputed', color: THEME.colors.error, bg: THEME.colors.errorBg },
  finalized: { label: 'Finalized', color: THEME.colors.success, bg: THEME.colors.successBg },
};

const TYPE_CONFIG: Record<InspectionType, { label: string; color: string }> = {
  routine: { label: 'Routine', color: THEME.colors.textSecondary },
  entry: { label: 'Entry', color: THEME.colors.info },
  exit: { label: 'Exit', color: THEME.colors.warning },
  pre_listing: { label: 'Pre-Listing', color: THEME.colors.brand },
  maintenance: { label: 'Maintenance', color: THEME.colors.warning },
  complaint: { label: 'Complaint', color: THEME.colors.error },
};

type FilterOption = 'upcoming' | 'all' | 'completed';
const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
];

export default function InspectionsDashboard() {
  const [filterMode, setFilterMode] = useState<FilterOption>('upcoming');

  const filter = filterMode === 'upcoming'
    ? { excludeCompleted: true }
    : filterMode === 'completed'
    ? { status: 'completed' as InspectionStatus }
    : undefined;

  const { inspections, loading, refreshing, error, refreshInspections, summary } = useInspections(filter);

  const renderItem = ({ item }: { item: InspectionListItem }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const typeConfig = TYPE_CONFIG[item.inspection_type];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/(app)/inspections/[id]' as any, params: { id: item.id } })}
        activeOpacity={0.7}
      >
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleArea}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {typeConfig.label} Inspection
              </Text>
              <Text style={styles.cardDate}>
                {new Date(item.scheduled_date).toLocaleDateString('en-AU', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
                {item.scheduled_time ? ` at ${item.scheduled_time.slice(0, 5)}` : ''}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {item.property && (
            <Text style={styles.cardProperty} numberOfLines={1}>
              {item.property.address_line_1}, {item.property.suburb}
            </Text>
          )}

          <View style={styles.cardFooter}>
            <View style={[styles.typePill, { backgroundColor: THEME.colors.subtle }]}>
              <Text style={[styles.typePillText, { color: typeConfig.color }]}>
                {typeConfig.label}
              </Text>
            </View>
            {item.overall_condition && (
              <Text style={styles.conditionText}>
                {item.overall_condition.charAt(0).toUpperCase() + item.overall_condition.slice(1)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspections</Text>
        <TouchableOpacity
          onPress={() => router.push('/(app)/inspections/schedule' as any)}
          style={styles.addButton}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      {!loading && summary.total > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.upcomingCount}</Text>
            <Text style={styles.summaryLabel}>Upcoming</Text>
          </View>
          {summary.overdueCount > 0 && (
            <View style={[styles.summaryCard, { backgroundColor: THEME.colors.warningBg }]}>
              <Text style={[styles.summaryNumber, { color: THEME.colors.warning }]}>
                {summary.overdueCount}
              </Text>
              <Text style={[styles.summaryLabel, { color: THEME.colors.warning }]}>Overdue</Text>
            </View>
          )}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.byStatus.in_progress || 0}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterChip, filterMode === opt.value && styles.filterChipActive]}
            onPress={() => setFilterMode(opt.value)}
          >
            <Text style={[styles.filterChipText, filterMode === opt.value && styles.filterChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={refreshInspections} variant="secondary" />
        </View>
      ) : inspections.length === 0 ? (
        <View style={styles.centered}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
            <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M9 12h6M9 16h6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
          <Text style={styles.emptyTitle}>No inspections</Text>
          <Text style={styles.emptySubtext}>
            {filterMode === 'upcoming'
              ? 'No upcoming inspections scheduled.'
              : filterMode === 'completed'
              ? 'No completed inspections yet.'
              : 'No inspections found.'}
          </Text>
          <Button
            title="Schedule Inspection"
            onPress={() => router.push('/(app)/inspections/schedule' as any)}
          />
        </View>
      ) : (
        <FlatList
          data={inspections}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshInspections}
              tintColor={THEME.colors.brand}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    alignItems: 'center',
    ...THEME.shadow.sm,
  },
  summaryNumber: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.textPrimary,
  },
  summaryLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  filterChipText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium as any,
  },
  filterChipTextActive: {
    color: THEME.colors.textInverse,
  },
  list: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    marginBottom: THEME.spacing.md,
    overflow: 'hidden',
    ...THEME.shadow.sm,
  },
  cardBody: {
    padding: THEME.spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.sm,
  },
  cardTitleArea: {
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  cardTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  cardDate: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.full,
  },
  statusText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
  },
  cardProperty: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginBottom: THEME.spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typePill: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  typePillText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
  },
  conditionText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  emptySubtext: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
});
