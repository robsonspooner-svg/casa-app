import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, PaymentStatusBadge, CurrencyDisplay } from '@casa/ui';
import { usePayments, formatDollars } from '@casa/api';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { payments } = usePayments();
  const payment = payments.find(p => p.id === id);

  if (!payment) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Payment not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card variant="elevated" style={styles.amountCard}>
        <CurrencyDisplay amount={Number(payment.amount)} size="xl" />
        <PaymentStatusBadge status={payment.status} style={styles.statusBadge} />
        {payment.description && (
          <Text style={styles.description}>{payment.description}</Text>
        )}
      </Card>

      <Card style={styles.detailsCard}>
        <Text style={styles.sectionTitle}>Payment Details</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {(payment.paid_at || payment.created_at) &&
              new Date(payment.paid_at || payment.created_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            }
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>
            {payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1)}
          </Text>
        </View>

        {payment.tenancy?.property_address && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Property</Text>
            <Text style={styles.detailValue}>{payment.tenancy.property_address}</Text>
          </View>
        )}

        {payment.due_date && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due Date</Text>
            <Text style={styles.detailValue}>
              {new Date(payment.due_date).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        )}

        {payment.payment_method && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Method</Text>
            <Text style={styles.detailValue}>
              {payment.payment_method.brand || payment.payment_method.type} ****{payment.payment_method.last_four}
            </Text>
          </View>
        )}
      </Card>

      {(payment.stripe_fee || payment.platform_fee || payment.net_amount) && (
        <Card style={styles.feesCard}>
          <Text style={styles.sectionTitle}>Fee Breakdown</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Gross Amount</Text>
            <Text style={styles.detailValue}>{formatDollars(Number(payment.amount))}</Text>
          </View>

          {payment.stripe_fee && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Processing Fee</Text>
              <Text style={[styles.detailValue, styles.feeValue]}>
                -{formatDollars(Number(payment.stripe_fee))}
              </Text>
            </View>
          )}

          {payment.platform_fee && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Platform Fee</Text>
              <Text style={[styles.detailValue, styles.feeValue]}>
                -{formatDollars(Number(payment.platform_fee))}
              </Text>
            </View>
          )}

          {payment.net_amount && (
            <View style={[styles.detailRow, styles.netRow]}>
              <Text style={styles.netLabel}>Net Amount</Text>
              <Text style={styles.netValue}>{formatDollars(Number(payment.net_amount))}</Text>
            </View>
          )}
        </Card>
      )}

      {payment.receipt_url && (
        <Card style={styles.receiptCard}>
          <Text style={styles.receiptText}>Receipt available</Text>
          {payment.receipt_number && (
            <Text style={styles.receiptNumber}>#{payment.receipt_number}</Text>
          )}
        </Card>
      )}
    </ScrollView>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  amountCard: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.xl,
    marginBottom: THEME.spacing.base,
  },
  statusBadge: {
    marginTop: THEME.spacing.md,
  },
  description: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.sm,
  },
  detailsCard: {
    marginBottom: THEME.spacing.base,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  feesCard: {
    marginBottom: THEME.spacing.base,
  },
  feeValue: {
    color: THEME.colors.error,
  },
  netRow: {
    borderBottomWidth: 0,
    paddingTop: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
    borderTopWidth: 2,
    borderTopColor: THEME.colors.border,
  },
  netLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  netValue: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.success,
  },
  receiptCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  receiptNumber: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
});
