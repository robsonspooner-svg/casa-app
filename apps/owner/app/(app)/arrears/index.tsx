// Arrears Dashboard Screen
// Mission 08: Arrears & Late Payment Management

import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, Chip } from '@casa/ui';
import { useArrears, formatDollars, ARREARS_SEVERITY_CONFIG } from '@casa/api';
import type { ArrearsRecordWithDetails, ArrearsSeverity } from '@casa/api';

const SEVERITY_FILTERS: { label: string; value: ArrearsSeverity | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'Serious', value: 'serious' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Minor', value: 'minor' },
];

function SeverityBadge({ severity }: { severity: ArrearsSeverity }) {
  const config = ARREARS_SEVERITY_CONFIG[severity];
  return (
    <View style={[styles.severityBadge, { backgroundColor: config.color + '20' }]}>
      <Text style={[styles.severityText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

function ArrearsCard({ item }: { item: ArrearsRecordWithDetails }) {
  const property = item.tenancy?.property;
  const address = property
    ? `${property.address_line_1}, ${property.suburb}`
    : 'Unknown property';

  const tenantName = item.tenant?.full_name || 'Unknown tenant';

  return (
    <TouchableOpacity onPress={() => router.push(`/(app)/arrears/${item.id}` as any)}>
      <Card style={styles.arrearsCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.tenantName}>{tenantName}</Text>
            <Text style={styles.propertyAddress}>{address}</Text>
          </View>
          <SeverityBadge severity={item.severity} />
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailColumn}>
            <Text style={styles.detailLabel}>Amount Overdue</Text>
            <Text style={styles.detailValue}>{formatDollars(item.total_overdue)}</Text>
          </View>
          <View style={styles.detailColumn}>
            <Text style={styles.detailLabel}>Days Overdue</Text>
            <Text style={styles.detailValue}>{item.days_overdue}</Text>
          </View>
          <View style={styles.detailColumn}>
            <Text style={styles.detailLabel}>Since</Text>
            <Text style={styles.detailValue}>
              {new Date(item.first_overdue_date).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </View>
        </View>

        {item.has_payment_plan && (
          <View style={styles.paymentPlanIndicator}>
            <Text style={styles.paymentPlanText}>Payment plan active</Text>
          </View>
        )}

        {item.last_action && (
          <View style={styles.lastAction}>
            <Text style={styles.lastActionLabel}>Last action:</Text>
            <Text style={styles.lastActionText}>
              {item.last_action.action_type.replace(/_/g, ' ')} -{' '}
              {new Date(item.last_action.created_at).toLocaleDateString('en-AU')}
            </Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

export default function ArrearsListScreen() {
  const [severityFilter, setSeverityFilter] = useState<ArrearsSeverity | 'all'>('all');
  const { arrears, loading, refreshArrears, summary } = useArrears(
    severityFilter !== 'all' ? { severity: severityFilter } : undefined
  );

  return (
    <View style={styles.container}>
      {/* Summary Header */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryAmount}>{formatDollars(summary.totalAmount)}</Text>
          <Text style={styles.summaryLabel}>Total in Arrears</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCount}>{summary.totalRecords}</Text>
          <Text style={styles.summaryLabel}>Tenants</Text>
        </View>
      </View>

      {/* Severity breakdown */}
      <View style={styles.breakdownContainer}>
        {(['critical', 'serious', 'moderate', 'minor'] as ArrearsSeverity[]).map(severity => {
          const config = ARREARS_SEVERITY_CONFIG[severity];
          const data = summary.bySeverity[severity];
          return (
            <TouchableOpacity
              key={severity}
              style={styles.breakdownItem}
              onPress={() => setSeverityFilter(severityFilter === severity ? 'all' : severity)}
            >
              <View style={[styles.breakdownDot, { backgroundColor: config.color }]} />
              <Text style={styles.breakdownCount}>{data.count}</Text>
              <Text style={styles.breakdownLabel}>{config.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Severity Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {SEVERITY_FILTERS.map(filter => (
            <Chip
              key={filter.value}
              label={filter.label}
              selected={severityFilter === filter.value}
              onPress={() => setSeverityFilter(filter.value)}
              containerStyle={styles.filterChip}
            />
          ))}
        </ScrollView>
      </View>

      {/* Arrears List */}
      <FlatList
        data={arrears}
        renderItem={({ item }) => <ArrearsCard item={item} />}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshArrears} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tenants in arrears</Text>
              <Text style={styles.emptyText}>
                All rent payments are up to date.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    paddingVertical: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: THEME.colors.border,
    marginHorizontal: THEME.spacing.md,
  },
  summaryAmount: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.error,
  },
  summaryCount: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  summaryLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  breakdownContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    justifyContent: 'space-around',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.xs,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownCount: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  breakdownLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
  },
  filterContainer: {
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingVertical: THEME.spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: THEME.spacing.base,
    gap: THEME.spacing.sm,
  },
  filterChip: {
    marginRight: THEME.spacing.xs,
  },
  content: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing['2xl'],
  },
  arrearsCard: {
    marginBottom: THEME.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.md,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  tenantName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  propertyAddress: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.sm,
  },
  severityText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  detailColumn: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  detailValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  paymentPlanIndicator: {
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  paymentPlanText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.success,
    fontWeight: THEME.fontWeight.medium,
  },
  lastAction: {
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.xs,
  },
  lastActionLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  lastActionText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: THEME.spacing['2xl'],
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
  },
});
