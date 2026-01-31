// Maintenance Dashboard - Owner View
// Mission 09: Maintenance Requests
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
import { useMaintenance } from '@casa/api';
import type { MaintenanceStatus, MaintenanceUrgency } from '@casa/api';
import type { MaintenanceListItem } from '@casa/api';

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Submitted', color: THEME.colors.info, bg: THEME.colors.infoBg },
  acknowledged: { label: 'Acknowledged', color: THEME.colors.brand, bg: '#EDE9FE' },
  awaiting_quote: { label: 'Awaiting Quote', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  approved: { label: 'Approved', color: THEME.colors.success, bg: THEME.colors.successBg },
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: '#F5F5F5' },
  on_hold: { label: 'On Hold', color: THEME.colors.warning, bg: THEME.colors.warningBg },
};

const URGENCY_CONFIG: Record<MaintenanceUrgency, { label: string; color: string; bg: string }> = {
  emergency: { label: 'Emergency', color: THEME.colors.error, bg: THEME.colors.errorBg },
  urgent: { label: 'Urgent', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  routine: { label: 'Routine', color: THEME.colors.textSecondary, bg: '#F5F5F5' },
};

type FilterStatus = 'active' | MaintenanceStatus;
const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'submitted', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function MaintenanceDashboard() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');

  const filter = filterStatus === 'active'
    ? { excludeCompleted: true }
    : { status: filterStatus as MaintenanceStatus };

  const { requests, loading, refreshing, error, refreshRequests, summary } = useMaintenance(filter);

  const renderItem = ({ item }: { item: MaintenanceListItem }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const urgencyConfig = URGENCY_CONFIG[item.urgency];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/maintenance/${item.id}` as any)}
        activeOpacity={0.7}
      >
        {/* Emergency badge */}
        {item.urgency === 'emergency' && (
          <View style={styles.emergencyBar}>
            <Text style={styles.emergencyText}>EMERGENCY</Text>
          </View>
        )}

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
            {item.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            {item.location_in_property ? ` · ${item.location_in_property}` : ''}
          </Text>

          <View style={styles.cardMeta}>
            {item.tenant && (
              <Text style={styles.cardMetaText} numberOfLines={1}>
                {item.tenant.full_name || item.tenant.email}
              </Text>
            )}
            {item.property && (
              <Text style={styles.cardMetaText} numberOfLines={1}>
                {item.property.address_line_1}
              </Text>
            )}
          </View>

          <View style={styles.cardFooter}>
            <View style={[styles.urgencyPill, { backgroundColor: urgencyConfig.bg }]}>
              <Text style={[styles.urgencyPillText, { color: urgencyConfig.color }]}>
                {urgencyConfig.label}
              </Text>
            </View>
            <Text style={styles.cardDate}>
              {new Date(item.created_at).toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short',
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
        <Text style={styles.headerTitle}>Maintenance</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Summary Cards */}
      {!loading && summary.total > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          {summary.emergencyCount > 0 && (
            <View style={[styles.summaryCard, { backgroundColor: THEME.colors.errorBg }]}>
              <Text style={[styles.summaryNumber, { color: THEME.colors.error }]}>
                {summary.emergencyCount}
              </Text>
              <Text style={[styles.summaryLabel, { color: THEME.colors.error }]}>Emergency</Text>
            </View>
          )}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.byStatus.submitted || 0}</Text>
            <Text style={styles.summaryLabel}>New</Text>
          </View>
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
            style={[styles.filterChip, filterStatus === opt.value && styles.filterChipActive]}
            onPress={() => setFilterStatus(opt.value)}
          >
            <Text style={[styles.filterChipText, filterStatus === opt.value && styles.filterChipTextActive]}>
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
          <Button title="Retry" onPress={refreshRequests} variant="secondary" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No requests</Text>
          <Text style={styles.emptySubtext}>
            {filterStatus === 'active'
              ? 'No active maintenance requests.'
              : `No ${FILTER_OPTIONS.find(o => o.value === filterStatus)?.label.toLowerCase()} requests.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshRequests}
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
  emergencyBar: {
    backgroundColor: THEME.colors.error,
    paddingVertical: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.base,
  },
  emergencyText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 1,
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgencyPill: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  urgencyPillText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
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
});
