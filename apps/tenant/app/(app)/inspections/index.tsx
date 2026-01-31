// My Inspections - Tenant View
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
import { useMyInspections } from '@casa/api';
import type { InspectionStatus, InspectionType } from '@casa/api';
import type { MyInspectionItem } from '@casa/api';

const STATUS_CONFIG: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: '#F5F5F5' },
  tenant_review: { label: 'Review Required', color: THEME.colors.brand, bg: '#EDE9FE' },
  disputed: { label: 'Disputed', color: THEME.colors.error, bg: THEME.colors.errorBg },
  finalized: { label: 'Finalized', color: THEME.colors.success, bg: THEME.colors.successBg },
};

const TYPE_LABELS: Record<InspectionType, string> = {
  routine: 'Routine',
  entry: 'Entry',
  exit: 'Exit',
  pre_listing: 'Pre-Listing',
  maintenance: 'Maintenance',
  complaint: 'Complaint',
};

const FILTER_OPTIONS: { value: 'active' | 'all'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
];

export default function MyInspectionsScreen() {
  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active');
  const { inspections, loading, refreshing, error, refreshInspections, activeCount } = useMyInspections({
    showCompleted: filterMode === 'all',
  });

  const renderItem = ({ item }: { item: MyInspectionItem }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const needsReview = item.status === 'tenant_review';

    return (
      <TouchableOpacity
        style={[styles.card, needsReview && styles.cardHighlight]}
        onPress={() => router.push(`/(app)/inspections/${item.id}` as any)}
        activeOpacity={0.7}
      >
        {needsReview && (
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewBannerText}>YOUR REVIEW REQUIRED</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {TYPE_LABELS[item.inspection_type]} Inspection
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <Text style={styles.cardDate}>
            {new Date(item.scheduled_date).toLocaleDateString('en-AU', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            })}
            {item.scheduled_time ? ` at ${item.scheduled_time.slice(0, 5)}` : ''}
          </Text>

          {item.property && (
            <Text style={styles.cardProperty} numberOfLines={1}>
              {item.property.address_line_1}, {item.property.suburb}
            </Text>
          )}
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
          <Button title="Retry" onPress={refreshInspections} variant="secondary" />
        </View>
      ) : inspections.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No inspections</Text>
          <Text style={styles.emptySubtext}>
            {filterMode === 'active'
              ? 'No active inspections at this time.'
              : 'No inspections have been scheduled yet.'}
          </Text>
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
    fontWeight: THEME.fontWeight.medium as any,
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
  cardHighlight: {
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
  },
  reviewBanner: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.base,
  },
  reviewBannerText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.bold as any,
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
    fontWeight: THEME.fontWeight.semibold as any,
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
    fontWeight: THEME.fontWeight.medium as any,
  },
  cardDate: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  cardProperty: {
    fontSize: THEME.fontSize.bodySmall,
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
