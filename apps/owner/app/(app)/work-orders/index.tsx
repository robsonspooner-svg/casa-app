// Work Orders Dashboard - Owner View
// Mission 10: Tradesperson Network
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
import { useWorkOrders } from '@casa/api';
import type { WorkOrderStatus } from '@casa/api';
import type { WorkOrderListItem } from '@casa/api';

const STATUS_CONFIG: Record<WorkOrderStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: THEME.colors.textTertiary, bg: '#F5F5F5' },
  sent: { label: 'Sent', color: THEME.colors.info, bg: THEME.colors.infoBg },
  quoted: { label: 'Quoted', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  approved: { label: 'Approved', color: THEME.colors.success, bg: THEME.colors.successBg },
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: '#F5F5F5' },
};

type FilterValue = 'active' | 'draft' | 'quoted' | 'in_progress' | 'completed';
const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatBudget(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  if (min != null) return `From $${min.toLocaleString()}`;
  if (max != null) return `Up to $${max.toLocaleString()}`;
  return null;
}

export default function WorkOrdersScreen() {
  const [filterValue, setFilterValue] = useState<FilterValue>('active');

  const filter = filterValue === 'active'
    ? { excludeCompleted: true }
    : { status: filterValue as WorkOrderStatus };

  const { workOrders, loading, refreshing, error, refreshWorkOrders, summary } = useWorkOrders(filter);

  const renderItem = ({ item }: { item: WorkOrderListItem }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const budget = item.quoted_amount != null
      ? `$${item.quoted_amount.toLocaleString()}`
      : formatBudget(item.budget_min, item.budget_max);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/work-orders/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <Text style={styles.cardCategory}>
            {formatCategory(item.category)}
            {item.trade?.business_name ? ` \u00B7 ${item.trade.business_name}` : ''}
          </Text>

          <View style={styles.cardMeta}>
            {item.property && (
              <Text style={styles.cardMetaText} numberOfLines={1}>
                {item.property.address_line_1}, {item.property.suburb}
              </Text>
            )}
            {budget && (
              <Text style={styles.cardMetaText}>{budget}</Text>
            )}
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.cardDate}>
              {new Date(item.created_at).toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </Text>
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
        <Text style={styles.headerTitle}>Work Orders</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Summary Row */}
      {!loading && summary.total > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.activeCount}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.byStatus.quoted || 0}</Text>
            <Text style={styles.summaryLabel}>Quoted</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.byStatus.in_progress || 0}</Text>
            <Text style={styles.summaryLabel}>In Progress</Text>
          </View>
        </View>
      )}

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterChip, filterValue === opt.value && styles.filterChipActive]}
            onPress={() => setFilterValue(opt.value)}
          >
            <Text style={[styles.filterChipText, filterValue === opt.value && styles.filterChipTextActive]}>
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
          <Button title="Retry" onPress={refreshWorkOrders} variant="secondary" />
        </View>
      ) : workOrders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No work orders yet</Text>
          <Text style={styles.emptySubtext}>
            {filterValue === 'active'
              ? 'Create a work order to get started with your trades.'
              : `No ${FILTER_OPTIONS.find(o => o.value === filterValue)?.label.toLowerCase()} work orders.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={workOrders}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshWorkOrders}
              tintColor={THEME.colors.brand}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/work-orders/create' as any)}
        activeOpacity={0.8}
      >
        <Svg width={THEME.components.fab.iconSize} height={THEME.components.fab.iconSize} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
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
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
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
    fontWeight: THEME.fontWeight.bold,
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
    fontWeight: THEME.fontWeight.medium,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
  cardTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.full,
  },
  statusText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
  },
  cardCategory: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  cardMeta: {
    marginBottom: THEME.spacing.sm,
    gap: 2,
  },
  cardMetaText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cardDate: {
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
    fontWeight: THEME.fontWeight.semibold,
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
  fab: {
    position: 'absolute',
    bottom: THEME.spacing.lg,
    right: THEME.spacing.base,
    width: THEME.components.fab.size,
    height: THEME.components.fab.size,
    borderRadius: THEME.components.fab.borderRadius,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow.lg,
  },
});
