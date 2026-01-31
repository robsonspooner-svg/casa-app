// Tenant Payment Plan View Screen
// Mission 08: Arrears & Late Payment Management

import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, Button } from '@casa/ui';
import { useMyPaymentPlan, formatDollars } from '@casa/api';
import type { PaymentPlanInstallment } from '@casa/api';

function InstallmentItem({ installment }: { installment: PaymentPlanInstallment }) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !installment.is_paid && installment.due_date < today;
  const isDueToday = !installment.is_paid && installment.due_date === today;
  const isUpcoming = !installment.is_paid && installment.due_date > today;

  const getStatusColor = () => {
    if (installment.is_paid) return THEME.colors.success;
    if (isOverdue) return THEME.colors.error;
    if (isDueToday) return THEME.colors.warning;
    return THEME.colors.textTertiary;
  };

  const getStatusText = () => {
    if (installment.is_paid) return 'Paid';
    if (isOverdue) return 'Overdue';
    if (isDueToday) return 'Due Today';
    return 'Upcoming';
  };

  return (
    <View style={[styles.installmentItem, installment.is_paid && styles.installmentPaid]}>
      <View style={styles.installmentLeft}>
        <Text style={[styles.installmentNumber, installment.is_paid && styles.textMuted]}>
          #{installment.installment_number}
        </Text>
        <View style={styles.installmentDetails}>
          <Text style={[styles.installmentAmount, installment.is_paid && styles.textMuted]}>
            {formatDollars(installment.amount)}
          </Text>
          <Text style={[styles.installmentDate, installment.is_paid && styles.textMuted]}>
            Due: {new Date(installment.due_date).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>
    </View>
  );
}

export default function PaymentPlanScreen() {
  const { plan, loading, refreshPlan, progress } = useMyPaymentPlan();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Payment Plan</Text>
        <Text style={styles.emptyText}>
          You don't have an active payment plan. If you need to set up a payment arrangement,
          please contact your landlord.
        </Text>
      </View>
    );
  }

  const installments = plan.installments || [];
  const paidInstallments = installments.filter(i => i.is_paid);
  const unpaidInstallments = installments.filter(i => !i.is_paid);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshPlan} />
      }
    >
      {/* Progress Card */}
      <Card style={styles.progressCard}>
        <Text style={styles.progressTitle}>Payment Progress</Text>

        {/* Progress Circle/Bar */}
        <View style={styles.progressVisual}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressPercent}>
              {progress?.percentComplete || 0}%
            </Text>
            <Text style={styles.progressLabel}>Complete</Text>
          </View>
        </View>

        {/* Progress Stats */}
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <Text style={styles.statValue}>{formatDollars(plan.amount_paid)}</Text>
            <Text style={styles.statLabel}>Paid</Text>
          </View>
          <View style={styles.progressStatDivider} />
          <View style={styles.progressStat}>
            <Text style={[styles.statValue, { color: THEME.colors.error }]}>
              {formatDollars(progress?.remainingAmount || 0)}
            </Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
          <View style={styles.progressStatDivider} />
          <View style={styles.progressStat}>
            <Text style={styles.statValue}>{plan.total_installments}</Text>
            <Text style={styles.statLabel}>Total Payments</Text>
          </View>
        </View>

        {/* On Track Indicator */}
        {progress && (
          <View style={[
            styles.trackIndicator,
            { backgroundColor: progress.isOnTrack ? THEME.colors.success + '20' : THEME.colors.error + '20' }
          ]}>
            <Text style={[
              styles.trackText,
              { color: progress.isOnTrack ? THEME.colors.success : THEME.colors.error }
            ]}>
              {progress.isOnTrack
                ? 'You are on track with your payment plan'
                : `You have ${progress.overdueInstallments.length} overdue payment(s)`}
            </Text>
          </View>
        )}
      </Card>

      {/* Next Payment */}
      {progress?.nextInstallment && (
        <Card style={styles.nextPaymentCard}>
          <Text style={styles.nextPaymentTitle}>Next Payment</Text>
          <View style={styles.nextPaymentInfo}>
            <View>
              <Text style={styles.nextPaymentAmount}>
                {formatDollars(progress.nextInstallment.amount)}
              </Text>
              <Text style={styles.nextPaymentDate}>
                Due: {new Date(progress.nextInstallment.due_date).toLocaleDateString('en-AU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
            </View>
            <Button
              title="Pay Now"
              onPress={() => router.push('/(app)/payments/pay' as any)}
            />
          </View>
        </Card>
      )}

      {/* Plan Details */}
      <Card style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Plan Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Arrears</Text>
          <Text style={styles.detailValue}>{formatDollars(plan.total_arrears)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Installment Amount</Text>
          <Text style={styles.detailValue}>{formatDollars(plan.installment_amount)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Frequency</Text>
          <Text style={styles.detailValue}>
            {plan.installment_frequency.charAt(0).toUpperCase() + plan.installment_frequency.slice(1)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Start Date</Text>
          <Text style={styles.detailValue}>
            {new Date(plan.start_date).toLocaleDateString('en-AU')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Expected End Date</Text>
          <Text style={styles.detailValue}>
            {new Date(plan.expected_end_date).toLocaleDateString('en-AU')}
          </Text>
        </View>
      </Card>

      {/* Installments List */}
      <Card style={styles.installmentsCard}>
        <Text style={styles.installmentsTitle}>All Installments</Text>

        {/* Overdue first */}
        {progress?.overdueInstallments && progress.overdueInstallments.length > 0 && (
          <View style={styles.installmentSection}>
            <Text style={styles.installmentSectionTitle}>Overdue</Text>
            {progress.overdueInstallments.map(installment => (
              <InstallmentItem key={installment.id} installment={installment} />
            ))}
          </View>
        )}

        {/* Upcoming */}
        {unpaidInstallments.filter(i => !progress?.overdueInstallments.some(o => o.id === i.id)).length > 0 && (
          <View style={styles.installmentSection}>
            <Text style={styles.installmentSectionTitle}>Upcoming</Text>
            {unpaidInstallments
              .filter(i => !progress?.overdueInstallments.some(o => o.id === i.id))
              .map(installment => (
                <InstallmentItem key={installment.id} installment={installment} />
              ))}
          </View>
        )}

        {/* Paid */}
        {paidInstallments.length > 0 && (
          <View style={styles.installmentSection}>
            <Text style={styles.installmentSectionTitle}>Paid</Text>
            {paidInstallments.map(installment => (
              <InstallmentItem key={installment.id} installment={installment} />
            ))}
          </View>
        )}
      </Card>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.canvas,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.canvas,
    padding: THEME.spacing.base,
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
  },
  progressCard: {
    margin: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  progressTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.lg,
    textAlign: 'center',
  },
  progressVisual: {
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: THEME.colors.success + '20',
    borderWidth: 4,
    borderColor: THEME.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 32,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.success,
  },
  progressLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.success,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatDivider: {
    width: 1,
    backgroundColor: THEME.colors.border,
  },
  statValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  trackIndicator: {
    marginTop: THEME.spacing.md,
    padding: THEME.spacing.sm,
    borderRadius: THEME.radius.sm,
  },
  trackText: {
    fontSize: THEME.fontSize.bodySmall,
    textAlign: 'center',
    fontWeight: THEME.fontWeight.medium,
  },
  nextPaymentCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    backgroundColor: THEME.colors.brand + '10',
    borderColor: THEME.colors.brand,
    borderWidth: 1,
  },
  nextPaymentTitle: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.sm,
  },
  nextPaymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextPaymentAmount: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  nextPaymentDate: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  detailsCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  detailsTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.xs,
  },
  detailLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  installmentsCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  installmentsTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  installmentSection: {
    marginBottom: THEME.spacing.md,
  },
  installmentSectionTitle: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.sm,
  },
  installmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  installmentPaid: {
    opacity: 0.6,
  },
  installmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  installmentNumber: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    fontWeight: THEME.fontWeight.medium,
    width: 24,
  },
  installmentDetails: {},
  installmentAmount: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  installmentDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
  },
  textMuted: {
    color: THEME.colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.sm,
  },
  statusText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
  },
  bottomSpacer: {
    height: THEME.spacing['2xl'],
  },
});
