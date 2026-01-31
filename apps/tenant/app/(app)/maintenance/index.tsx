// My Maintenance Requests - Tenant View
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
import { useMyMaintenance } from '@casa/api';
import type { MaintenanceStatus } from '@casa/api';
import type { MyMaintenanceItem } from '@casa/api';

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

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  emergency: { label: 'Emergency', color: THEME.colors.error },
  urgent: { label: 'Urgent', color: THEME.colors.warning },
  routine: { label: 'Routine', color: THEME.colors.textSecondary },
};

const FILTER_OPTIONS: { value: 'active' | 'all'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
];

export default function MyMaintenanceScreen() {
  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active');
  const { requests, loading, refreshing, error, refreshRequests, activeCount } = useMyMaintenance({
    showCompleted: filterMode === 'all',
  });

  const renderItem = ({ item }: { item: MyMaintenanceItem }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const urgencyConfig = URGENCY_CONFIG[item.urgency];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/maintenance/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {item.urgency === 'emergency' && (
              <View style={[styles.urgencyBadge, { backgroundColor: THEME.colors.errorBg }]}>
                <Text style={[styles.urgencyText, { color: THEME.colors.error }]}>
                  {urgencyConfig.label}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <Text style={styles.cardCategory}>
          {item.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          {item.location_in_property ? ` - ${item.location_in_property}` : ''}
        </Text>

        {item.property && (
          <Text style={styles.cardProperty} numberOfLines={1}>
            {item.property.address_line_1}, {item.property.suburb}
          </Text>
        )}

        <Text style={styles.cardDate}>
          {new Date(item.created_at).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
          {item.urgency !== 'emergency' && urgencyConfig && (
            <Text style={{ color: urgencyConfig.color }}> · {urgencyConfig.label}</Text>
          )}
        </Text>
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
              {opt.value === 'active' && activeCount > 0 ? ` (${activeCount})` : ''}
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
          <Text style={styles.emptyTitle}>No maintenance requests</Text>
          <Text style={styles.emptySubtext}>
            {filterMode === 'active'
              ? 'You have no active maintenance requests.'
              : 'You haven\'t submitted any maintenance requests yet.'}
          </Text>
          <Button
            title="Submit a Request"
            onPress={() => router.push('/(app)/maintenance/new' as any)}
          />
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

      {/* FAB for new request */}
      {!loading && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(app)/maintenance/new' as any)}
          activeOpacity={0.8}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: THEME.spacing.base,
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
    paddingBottom: 100,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.sm,
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginRight: THEME.spacing.sm,
  },
  cardTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    flexShrink: 1,
  },
  urgencyBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  urgencyText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.semibold,
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
    marginBottom: THEME.spacing.xs,
  },
  cardProperty: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginBottom: THEME.spacing.xs,
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
    marginBottom: THEME.spacing.md,
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
