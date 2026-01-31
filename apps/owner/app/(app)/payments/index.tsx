import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, PaymentStatusBadge, Chip } from '@casa/ui';
import { usePayments, formatDollars } from '@casa/api';
import type { PaymentWithDetails, PaymentStatus } from '@casa/api';

const STATUS_FILTERS: { label: string; value: PaymentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
];

export default function PaymentsListScreen() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const { payments, loading, refreshPayments } = usePayments(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );

  const renderPayment = ({ item }: { item: PaymentWithDetails }) => (
    <TouchableOpacity onPress={() => router.push(`/(app)/payments/${item.id}` as any)}>
      <Card style={styles.paymentCard}>
        <View style={styles.paymentRow}>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentDate}>
              {(item.paid_at || item.created_at) &&
                new Date(item.paid_at || item.created_at).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              }
            </Text>
            <Text style={styles.paymentAddress}>
              {item.tenancy?.property_address || 'Property'}
            </Text>
            <Text style={styles.paymentType}>
              {item.payment_type === 'rent' ? 'Rent' : item.description || 'Payment'}
            </Text>
          </View>
          <View style={styles.paymentRight}>
            <Text style={styles.paymentAmount}>{formatDollars(Number(item.amount))}</Text>
            <PaymentStatusBadge status={item.status} />
            {item.net_amount && (
              <Text style={styles.netAmount}>Net: {formatDollars(Number(item.net_amount))}</Text>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Status Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {STATUS_FILTERS.map(filter => (
            <Chip
              key={filter.value}
              label={filter.label}
              selected={statusFilter === filter.value}
              onPress={() => setStatusFilter(filter.value)}
              containerStyle={styles.filterChip}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={payments}
        renderItem={renderPayment}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshPayments} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No payments yet</Text>
              <Text style={styles.emptyText}>
                Payments from your tenants will appear here.
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
  paymentCard: {
    marginBottom: THEME.spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentInfo: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  paymentDate: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  paymentAddress: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  paymentType: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: THEME.spacing.xs,
  },
  paymentAmount: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  netAmount: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.success,
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
