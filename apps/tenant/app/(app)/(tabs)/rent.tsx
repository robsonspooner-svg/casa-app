import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, PaymentStatusBadge, CurrencyDisplay } from '@casa/ui';
import { useMyTenancy, useRentSchedule, usePayments, useMyArrears, formatDollars } from '@casa/api';

export default function RentScreen() {
  const { tenancy, loading: tenancyLoading } = useMyTenancy();
  const { schedules, nextDue, totalOwed, loading: scheduleLoading, refreshSchedule } = useRentSchedule(tenancy?.id);
  const { payments, loading: paymentsLoading, refreshPayments } = usePayments(
    tenancy ? { tenancyId: tenancy.id, limit: 5 } : undefined
  );

  const { arrears: myArrears, hasArrears, loading: arrearsLoading } = useMyArrears();
  const loading = tenancyLoading || scheduleLoading || paymentsLoading || arrearsLoading;

  const handleRefresh = async () => {
    await Promise.all([refreshSchedule(), refreshPayments()]);
  };

  if (!tenancy && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Rent</Text>
          <Text style={styles.subtitle}>Your payment history</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
                stroke={THEME.colors.brand}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.emptyTitle}>No payments yet</Text>
          <Text style={styles.emptyText}>
            Your rent schedule and payment history will appear here once your tenancy is active.
          </Text>
        </View>
      </View>
    );
  }

  const upcomingSchedules = schedules
    .filter(s => !s.is_paid)
    .slice(0, 5);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rent</Text>
        <Text style={styles.subtitle}>Your payment history</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} />
        }
      >
        {totalOwed > 0 && (
          <Card variant="elevated" style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Outstanding Balance</Text>
            <CurrencyDisplay amount={totalOwed} size="xl" color={THEME.colors.error} />
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => router.push('/(app)/payments/pay' as any)}
            >
              <Text style={styles.payButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </Card>
        )}

        {nextDue && totalOwed === 0 && (
          <Card variant="elevated" style={styles.nextDueCard}>
            <Text style={styles.nextDueLabel}>Next Payment Due</Text>
            <CurrencyDisplay amount={Number(nextDue.amount)} size="lg" />
            <Text style={styles.nextDueDate}>
              {new Date(nextDue.due_date).toLocaleDateString('en-AU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            <TouchableOpacity
              style={styles.payEarlyButton}
              onPress={() => router.push('/(app)/payments/pay' as any)}
            >
              <Text style={styles.payEarlyText}>Pay Early</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Failed payment banner */}
        {payments.find(p => p.status === 'failed') && (() => {
          const failedPayment = payments.find(p => p.status === 'failed')!;
          return (
            <TouchableOpacity
              style={styles.failedPaymentBanner}
              onPress={() => router.push('/(app)/payments/pay' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.failedPaymentIcon}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={THEME.colors.surface} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 9v4M12 17h.01" stroke={THEME.colors.surface} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.failedPaymentTitle}>Payment Failed</Text>
                <Text style={styles.failedPaymentText} numberOfLines={2}>
                  {failedPayment.status_reason || `Your payment of ${formatDollars(Number(failedPayment.amount))} was not successful.`}
                </Text>
              </View>
              <View style={styles.failedPaymentRetry}>
                <Text style={styles.failedPaymentRetryText}>Retry</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        {hasArrears && myArrears && (
          <TouchableOpacity
            style={styles.arrearsAlert}
            onPress={() => router.push('/(app)/arrears' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.arrearsAlertContent}>
              <Text style={styles.arrearsAlertTitle}>You have overdue rent</Text>
              <Text style={styles.arrearsAlertText}>
                {formatDollars(Number(myArrears.total_overdue))} overdue - Tap to view details
              </Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke={THEME.colors.surface} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/payments/methods' as any)}
          >
            <View style={styles.actionIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M1 10h22" stroke={THEME.colors.brand} strokeWidth={1.5} />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>Methods</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/payments/autopay' as any)}
          >
            <View style={styles.actionIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M23 4v6h-6M1 20v-6h6" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>Auto-Pay</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/payments/history' as any)}
          >
            <View style={styles.actionIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>History</Text>
          </TouchableOpacity>
        </View>

        {upcomingSchedules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {upcomingSchedules.map(schedule => (
              <Card key={schedule.id} style={styles.scheduleCard}>
                <View style={styles.scheduleRow}>
                  <View>
                    <Text style={styles.scheduleDate}>
                      {new Date(schedule.due_date).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                    {schedule.description && (
                      <Text style={styles.scheduleDesc}>{schedule.description}</Text>
                    )}
                    {schedule.is_prorata && (
                      <Text style={styles.proRataLabel}>Pro-rata</Text>
                    )}
                  </View>
                  <Text style={styles.scheduleAmount}>{formatDollars(Number(schedule.amount))}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            {payments.map(payment => (
              <Card key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentDate}>
                      {payment.paid_at
                        ? new Date(payment.paid_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                        : new Date(payment.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                      }
                    </Text>
                    <Text style={styles.paymentDesc}>{payment.description || 'Rent payment'}</Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>{formatDollars(Number(payment.amount))}</Text>
                    <PaymentStatusBadge status={payment.status} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing['2xl'],
    paddingBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  title: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing['2xl'],
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.base,
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
    textAlign: 'center',
    lineHeight: 22,
  },
  balanceCard: {
    marginBottom: THEME.spacing.base,
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
  },
  balanceLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  payButton: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.xl,
    borderRadius: THEME.radius.md,
    marginTop: THEME.spacing.base,
  },
  payButtonText: {
    color: THEME.colors.textInverse,
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
  },
  nextDueCard: {
    marginBottom: THEME.spacing.base,
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
  },
  nextDueLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  nextDueDate: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.sm,
  },
  payEarlyButton: {
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.md,
    marginTop: THEME.spacing.base,
  },
  payEarlyText: {
    color: THEME.colors.brand,
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.lg,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  actionIcon: {
    marginBottom: THEME.spacing.xs,
  },
  actionLabel: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  section: {
    marginBottom: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  scheduleCard: {
    marginBottom: THEME.spacing.sm,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleDate: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  scheduleDesc: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  proRataLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.info,
    marginTop: 2,
  },
  scheduleAmount: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  paymentCard: {
    marginBottom: THEME.spacing.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentInfo: {
    flex: 1,
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
  paymentRight: {
    alignItems: 'flex-end',
    gap: THEME.spacing.xs,
  },
  paymentAmount: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  failedPaymentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.warning,
    padding: THEME.spacing.base,
    borderRadius: THEME.radius.md,
    marginBottom: THEME.spacing.base,
    gap: THEME.spacing.md,
  },
  failedPaymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedPaymentTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.surface,
  },
  failedPaymentText: {
    fontSize: THEME.fontSize.caption,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    lineHeight: 16,
  },
  failedPaymentRetry: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.sm,
  },
  failedPaymentRetryText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.warning,
  },
  arrearsAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.error,
    padding: THEME.spacing.base,
    borderRadius: THEME.radius.md,
    marginBottom: THEME.spacing.base,
  },
  arrearsAlertContent: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  arrearsAlertTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.surface,
  },
  arrearsAlertText: {
    fontSize: THEME.fontSize.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});
