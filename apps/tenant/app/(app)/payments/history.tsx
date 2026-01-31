import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { THEME } from '@casa/config';
import { Card, PaymentStatusBadge } from '@casa/ui';
import { useMyTenancy, usePayments, formatDollars } from '@casa/api';
import type { PaymentWithDetails } from '@casa/api';

export default function PaymentHistoryScreen() {
  const { tenancy } = useMyTenancy();
  const { payments, loading, refreshPayments } = usePayments(
    tenancy ? { tenancyId: tenancy.id } : undefined
  );

  const renderPayment = ({ item }: { item: PaymentWithDetails }) => (
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
          <Text style={styles.paymentDesc}>{item.description || 'Rent payment'}</Text>
          {item.payment_method && (
            <Text style={styles.paymentMethod}>
              {item.payment_method.type === 'au_becs_debit' ? 'Bank' : item.payment_method.brand}
              {' '}****{item.payment_method.last_four}
            </Text>
          )}
        </View>
        <View style={styles.paymentRight}>
          <Text style={styles.paymentAmount}>{formatDollars(Number(item.amount))}</Text>
          <PaymentStatusBadge status={item.status} />
        </View>
      </View>
      {item.receipt_url && (
        <Text style={styles.receiptLink}>View receipt</Text>
      )}
    </Card>
  );

  return (
    <View style={styles.container}>
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
              <Text style={styles.emptyTitle}>No payment history</Text>
              <Text style={styles.emptyText}>
                Your completed payments will appear here.
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
  paymentDesc: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  paymentMethod: {
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
  receiptLink: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.brand,
    marginTop: THEME.spacing.md,
    fontWeight: THEME.fontWeight.medium,
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
