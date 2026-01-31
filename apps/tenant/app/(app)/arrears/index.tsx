// Tenant Arrears Status Screen
// Mission 08: Arrears & Late Payment Management

import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, Button } from '@casa/ui';
import { useMyArrears, formatDollars, ARREARS_SEVERITY_CONFIG } from '@casa/api';
import type { ArrearsAction, ArrearsSeverity } from '@casa/api';

function SeverityBanner({ severity }: { severity: ArrearsSeverity }) {
  const config = ARREARS_SEVERITY_CONFIG[severity];

  const messages: Record<ArrearsSeverity, string> = {
    minor: 'Your rent payment is slightly overdue. Please pay as soon as possible to avoid further action.',
    moderate: 'Your rent is now overdue. Please contact your landlord if you need to discuss a payment plan.',
    serious: 'Your rent is seriously overdue. Further action may be taken if payment is not received soon.',
    critical: 'Your rent is critically overdue. Legal action may be initiated. Please contact your landlord immediately.',
  };

  return (
    <View style={[styles.severityBanner, { backgroundColor: config.color + '15', borderColor: config.color }]}>
      <Text style={[styles.severityTitle, { color: config.color }]}>
        {config.label} Arrears
      </Text>
      <Text style={[styles.severityMessage, { color: config.color }]}>
        {messages[severity]}
      </Text>
    </View>
  );
}

function ActionItem({ action }: { action: ArrearsAction }) {
  const actionTypeLabels: Record<string, string> = {
    reminder_email: 'Email Reminder Sent',
    reminder_sms: 'SMS Reminder Sent',
    phone_call: 'Phone Call',
    letter_sent: 'Letter Sent',
    breach_notice: 'Breach Notice Sent',
    payment_plan_created: 'Payment Plan Created',
    payment_plan_updated: 'Payment Plan Updated',
    payment_received: 'Payment Received',
    note: 'Note',
  };

  return (
    <View style={styles.actionItem}>
      <View style={styles.actionDot} />
      <View style={styles.actionContent}>
        <Text style={styles.actionType}>
          {actionTypeLabels[action.action_type] || action.action_type}
        </Text>
        <Text style={styles.actionDate}>
          {new Date(action.created_at).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      </View>
    </View>
  );
}

export default function TenantArrearsScreen() {
  const { arrears, hasArrears, loading, refreshMyArrears } = useMyArrears();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  if (!hasArrears || !arrears) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.centeredContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshMyArrears} />
        }
      >
        <View style={styles.noArrearsContainer}>
          <Text style={styles.noArrearsEmoji}>&#10003;</Text>
          <Text style={styles.noArrearsTitle}>No Arrears</Text>
          <Text style={styles.noArrearsText}>
            Your rent payments are up to date. Keep up the great work!
          </Text>
        </View>
      </ScrollView>
    );
  }

  const property = arrears.tenancy?.property;
  const address = property
    ? `${property.address_line_1}, ${property.suburb}`
    : 'Your property';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshMyArrears} />
      }
    >
      {/* Severity Banner */}
      <SeverityBanner severity={arrears.severity} />

      {/* Arrears Amount */}
      <Card style={styles.amountCard}>
        <Text style={styles.amountLabel}>Total Overdue</Text>
        <Text style={styles.amountValue}>{formatDollars(arrears.total_overdue)}</Text>
        <View style={styles.amountDetails}>
          <View style={styles.amountDetailItem}>
            <Text style={styles.amountDetailLabel}>Days Overdue</Text>
            <Text style={styles.amountDetailValue}>{arrears.days_overdue}</Text>
          </View>
          <View style={styles.amountDetailItem}>
            <Text style={styles.amountDetailLabel}>Since</Text>
            <Text style={styles.amountDetailValue}>
              {new Date(arrears.first_overdue_date).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </View>
        </View>
      </Card>

      {/* Pay Now Button */}
      <View style={styles.payButtonContainer}>
        <Button
          title={`Pay ${formatDollars(arrears.total_overdue)} Now`}
          onPress={() => router.push('/(app)/payments/pay' as any)}
        />
      </View>

      {/* Payment Plan Section */}
      {arrears.has_payment_plan && arrears.payment_plan ? (
        <Card style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>Active Payment Plan</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>
                {arrears.payment_plan.status.charAt(0).toUpperCase() + arrears.payment_plan.status.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.planProgress}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      100,
                      (arrears.payment_plan.amount_paid / arrears.payment_plan.total_arrears) * 100
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {formatDollars(arrears.payment_plan.amount_paid)} of {formatDollars(arrears.payment_plan.total_arrears)} paid
            </Text>
          </View>

          <View style={styles.planDetails}>
            <View style={styles.planDetailRow}>
              <Text style={styles.planDetailLabel}>Installment Amount</Text>
              <Text style={styles.planDetailValue}>
                {formatDollars(arrears.payment_plan.installment_amount)}
              </Text>
            </View>
            <View style={styles.planDetailRow}>
              <Text style={styles.planDetailLabel}>Frequency</Text>
              <Text style={styles.planDetailValue}>
                {arrears.payment_plan.installment_frequency.charAt(0).toUpperCase() +
                  arrears.payment_plan.installment_frequency.slice(1)}
              </Text>
            </View>
            {arrears.payment_plan.next_due_date && (
              <View style={styles.planDetailRow}>
                <Text style={styles.planDetailLabel}>Next Payment Due</Text>
                <Text style={[styles.planDetailValue, { color: THEME.colors.error }]}>
                  {new Date(arrears.payment_plan.next_due_date).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            )}
            <View style={styles.planDetailRow}>
              <Text style={styles.planDetailLabel}>Remaining Installments</Text>
              <Text style={styles.planDetailValue}>
                {arrears.payment_plan.total_installments - arrears.payment_plan.installments_paid}
              </Text>
            </View>
          </View>

          <Button
            title="View Plan Details"
            variant="secondary"
            onPress={() => router.push('/(app)/arrears/payment-plan' as any)}
            style={styles.viewPlanButton}
          />
        </Card>
      ) : (
        <Card style={styles.noPlanCard}>
          <Text style={styles.noPlanTitle}>Need Help Paying?</Text>
          <Text style={styles.noPlanText}>
            If you're having difficulty paying the full amount, contact your landlord to discuss
            a payment plan that works for both of you.
          </Text>
        </Card>
      )}

      {/* Communication History */}
      {arrears.actions && arrears.actions.length > 0 && (
        <Card style={styles.historyCard}>
          <Text style={styles.historyTitle}>Recent Communications</Text>
          <View style={styles.historyList}>
            {arrears.actions.slice(0, 5).map(action => (
              <ActionItem key={action.id} action={action} />
            ))}
          </View>
        </Card>
      )}

      {/* Contact Info */}
      <Card style={styles.contactCard}>
        <Text style={styles.contactTitle}>Need to Talk?</Text>
        <Text style={styles.contactText}>
          If you're experiencing financial hardship or need to discuss your situation,
          please reach out to your landlord through the app's messaging feature.
        </Text>
        <Button
          title="Send Message"
          variant="secondary"
          onPress={() => router.push('/(app)/(tabs)/chat' as any)}
          style={styles.contactButton}
        />
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
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.base,
  },
  noArrearsContainer: {
    alignItems: 'center',
    padding: THEME.spacing['2xl'],
  },
  noArrearsEmoji: {
    fontSize: 48,
    marginBottom: THEME.spacing.md,
    color: THEME.colors.success,
  },
  noArrearsTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  noArrearsText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  severityBanner: {
    padding: THEME.spacing.base,
    borderBottomWidth: 2,
  },
  severityTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.bold,
    marginBottom: THEME.spacing.xs,
  },
  severityMessage: {
    fontSize: THEME.fontSize.body,
    lineHeight: 22,
  },
  amountCard: {
    margin: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
  },
  amountLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.error,
    marginVertical: THEME.spacing.sm,
  },
  amountDetails: {
    flexDirection: 'row',
    gap: THEME.spacing['2xl'],
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  amountDetailItem: {
    alignItems: 'center',
  },
  amountDetailLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  amountDetailValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  payButtonContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
  },
  planCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  planTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  planBadge: {
    backgroundColor: THEME.colors.success + '20',
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.sm,
  },
  planBadgeText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.success,
    fontWeight: THEME.fontWeight.medium,
  },
  planProgress: {
    marginBottom: THEME.spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: THEME.colors.subtle,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: THEME.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.colors.success,
    borderRadius: 4,
  },
  progressText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  planDetails: {
    gap: THEME.spacing.sm,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  planDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planDetailLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  planDetailValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  viewPlanButton: {
    marginTop: THEME.spacing.md,
  },
  noPlanCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    backgroundColor: THEME.colors.subtle,
  },
  noPlanTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  noPlanText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  historyCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  historyTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  historyList: {
    gap: THEME.spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.brand,
  },
  actionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionType: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  actionDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  contactCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  contactTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  contactText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.md,
  },
  contactButton: {},
  bottomSpacer: {
    height: THEME.spacing['2xl'],
  },
});
