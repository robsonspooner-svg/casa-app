// Arrears Detail Screen
// Mission 08: Arrears & Late Payment Management

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, Button } from '@casa/ui';
import {
  useArrearsDetail,
  useArrearsMutations,
  useReminderTemplates,
  formatDollars,
  ARREARS_SEVERITY_CONFIG,
} from '@casa/api';
import type { ArrearsAction, ArrearsSeverity } from '@casa/api';

function SeverityBadge({ severity }: { severity: ArrearsSeverity }) {
  const config = ARREARS_SEVERITY_CONFIG[severity];
  return (
    <View style={[styles.severityBadge, { backgroundColor: config.color + '20' }]}>
      <Text style={[styles.severityText, { color: config.color }]}>
        {config.label} ({config.daysRange})
      </Text>
    </View>
  );
}

function ActionItem({ action }: { action: ArrearsAction }) {
  const actionTypeLabels: Record<string, string> = {
    reminder_email: 'Email Reminder',
    reminder_sms: 'SMS Reminder',
    phone_call: 'Phone Call',
    letter_sent: 'Letter Sent',
    breach_notice: 'Breach Notice',
    payment_plan_created: 'Payment Plan Created',
    payment_plan_updated: 'Payment Plan Updated',
    payment_received: 'Payment Received',
    tribunal_application: 'Tribunal Application',
    note: 'Note',
  };

  const actionTypeColors: Record<string, string> = {
    reminder_email: THEME.colors.brand,
    reminder_sms: THEME.colors.brand,
    phone_call: THEME.colors.success,
    breach_notice: THEME.colors.error,
    payment_received: THEME.colors.success,
    note: THEME.colors.textSecondary,
    payment_plan_created: THEME.colors.brand,
    payment_plan_updated: THEME.colors.brand,
    tribunal_application: THEME.colors.error,
    letter_sent: THEME.colors.textSecondary,
  };

  return (
    <View style={styles.actionItem}>
      <View style={[styles.actionDot, { backgroundColor: actionTypeColors[action.action_type] || THEME.colors.textSecondary }]} />
      <View style={styles.actionContent}>
        <View style={styles.actionHeader}>
          <Text style={styles.actionType}>{actionTypeLabels[action.action_type] || action.action_type}</Text>
          <Text style={styles.actionDate}>
            {new Date(action.created_at).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Text style={styles.actionDescription}>{action.description}</Text>
        {action.sent_to && (
          <Text style={styles.actionMeta}>Sent to: {action.sent_to}</Text>
        )}
        {action.is_automated && (
          <Text style={styles.actionMeta}>Automated</Text>
        )}
      </View>
    </View>
  );
}

export default function ArrearsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { arrears, actions, loading, refreshArrearsDetail } = useArrearsDetail(id);
  const { sendReminder, sendBreachNotice, resolveArrears, loading: mutationLoading } = useArrearsMutations();
  const { getTemplateForDays } = useReminderTemplates();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  if (!arrears) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Arrears record not found</Text>
      </View>
    );
  }

  const property = arrears.tenancy?.property;
  const address = property
    ? `${property.address_line_1}, ${property.suburb} ${property.state} ${property.postcode}`
    : 'Unknown property';

  const tenantName = arrears.tenant?.full_name || 'Unknown tenant';
  const tenantEmail = arrears.tenant?.email || '';
  const tenantPhone = arrears.tenant?.phone || '';

  const handleSendReminder = async () => {
    const template = getTemplateForDays(arrears.days_overdue);
    if (!template) {
      Alert.alert('No Template', 'No reminder template found for this number of days overdue.');
      return;
    }

    Alert.alert(
      'Send Reminder',
      `Send "${template.name}" to ${tenantEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            const success = await sendReminder({
              arrears_record_id: arrears.id,
              template_id: template.id,
              tenant_email: tenantEmail,
              tenant_name: tenantName,
              amount: arrears.total_overdue,
              days_overdue: arrears.days_overdue,
              property_address: address,
              owner_name: 'Property Owner', // Would come from profile
            });

            if (success) {
              Alert.alert('Success', 'Reminder sent successfully');
              refreshArrearsDetail();
            }
          },
        },
      ]
    );
  };

  const handleSendBreachNotice = () => {
    const state = property?.state || 'NSW';

    Alert.alert(
      'Send Breach Notice',
      `This will send a formal ${state} breach notice to ${tenantEmail}. This is a legal document. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Notice',
          style: 'destructive',
          onPress: async () => {
            const success = await sendBreachNotice(arrears.id, tenantEmail, state);
            if (success) {
              Alert.alert('Success', 'Breach notice sent successfully');
              refreshArrearsDetail();
            }
          },
        },
      ]
    );
  };

  const handleResolve = () => {
    Alert.prompt(
      'Resolve Arrears',
      'Enter the reason for resolving this arrears record:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async (reason: string | undefined) => {
            if (reason) {
              const success = await resolveArrears(arrears.id, reason);
              if (success) {
                Alert.alert('Success', 'Arrears marked as resolved');
                router.back();
              }
            }
          },
        },
      ],
      'plain-text'
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshArrearsDetail} />
      }
    >
      {/* Tenant & Property Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Tenant</Text>
        <Text style={styles.tenantName}>{tenantName}</Text>
        {tenantEmail && <Text style={styles.contactText}>{tenantEmail}</Text>}
        {tenantPhone && <Text style={styles.contactText}>{tenantPhone}</Text>}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Property</Text>
        <Text style={styles.propertyAddress}>{address}</Text>
      </Card>

      {/* Arrears Status */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusAmount}>{formatDollars(arrears.total_overdue)}</Text>
          <SeverityBadge severity={arrears.severity} />
        </View>

        <View style={styles.statusDetails}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Days Overdue</Text>
            <Text style={styles.statusValue}>{arrears.days_overdue}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>First Overdue</Text>
            <Text style={styles.statusValue}>
              {new Date(arrears.first_overdue_date).toLocaleDateString('en-AU')}
            </Text>
          </View>
        </View>
      </Card>

      {/* Payment Plan (if exists) */}
      {arrears.payment_plan && (
        <Card style={styles.planCard}>
          <Text style={styles.sectionTitle}>Payment Plan</Text>

          <View style={styles.planDetails}>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Installment Amount</Text>
              <Text style={styles.planValue}>
                {formatDollars(arrears.payment_plan.installment_amount)} {arrears.payment_plan.installment_frequency}
              </Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Progress</Text>
              <Text style={styles.planValue}>
                {arrears.payment_plan.installments_paid} / {arrears.payment_plan.total_installments} installments
              </Text>
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Amount Paid</Text>
              <Text style={[styles.planValue, { color: THEME.colors.success }]}>
                {formatDollars(arrears.payment_plan.amount_paid)}
              </Text>
            </View>
            {arrears.payment_plan.next_due_date && (
              <View style={styles.planRow}>
                <Text style={styles.planLabel}>Next Due</Text>
                <Text style={styles.planValue}>
                  {new Date(arrears.payment_plan.next_due_date).toLocaleDateString('en-AU')}
                </Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Action Buttons */}
      <Card style={styles.actionsCard}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <View style={styles.actionButtons}>
          <Button
            title="Send Reminder"
            variant="secondary"
            onPress={handleSendReminder}
            loading={mutationLoading}
            style={styles.actionButton}
          />
          <Button
            title="Log Phone Call"
            variant="secondary"
            onPress={() => router.push({
              pathname: '/(app)/arrears/log-action' as any,
              params: { arrearsId: arrears.id, actionType: 'phone_call' },
            })}
            style={styles.actionButton}
          />
          {!arrears.has_payment_plan && (
            <Button
              title="Create Payment Plan"
              variant="secondary"
              onPress={() => router.push({
                pathname: '/(app)/arrears/create-plan' as any,
                params: {
                  arrearsId: arrears.id,
                  tenancyId: arrears.tenancy_id,
                  totalArrears: arrears.total_overdue.toString(),
                },
              })}
              style={styles.actionButton}
            />
          )}
          {arrears.days_overdue >= 14 && (
            <Button
              title="Send Breach Notice"
              variant="secondary"
              onPress={handleSendBreachNotice}
              loading={mutationLoading}
              style={styles.actionButton}
            />
          )}
          <Button
            title="Mark as Resolved"
            variant="secondary"
            onPress={handleResolve}
            loading={mutationLoading}
            style={styles.actionButton}
          />
        </View>
      </Card>

      {/* Communication Timeline */}
      <Card style={styles.timelineCard}>
        <View style={styles.timelineHeader}>
          <Text style={styles.sectionTitle}>Communication History</Text>
          <TouchableOpacity onPress={() => router.push({
            pathname: '/(app)/arrears/log-action' as any,
            params: { arrearsId: arrears.id, actionType: 'note' },
          })}>
            <Text style={styles.addNote}>Add Note</Text>
          </TouchableOpacity>
        </View>

        {actions.length === 0 ? (
          <Text style={styles.noActions}>No actions recorded yet</Text>
        ) : (
          <View style={styles.timeline}>
            {actions.map((action) => (
              <ActionItem key={action.id} action={action} />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.canvas,
    padding: THEME.spacing.base,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
  },
  infoCard: {
    margin: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.sm,
  },
  tenantName: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  contactText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: THEME.spacing.md,
  },
  propertyAddress: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  statusCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  statusAmount: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.error,
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
  statusDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  statusValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  planCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  planDetails: {
    gap: THEME.spacing.sm,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  planValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  actionsCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  actionButtons: {
    gap: THEME.spacing.sm,
  },
  actionButton: {
    borderColor: THEME.colors.border,
  },
  dangerButton: {
    borderColor: THEME.colors.error,
  },
  timelineCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  addNote: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  noActions: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  timeline: {
    gap: THEME.spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  actionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  actionContent: {
    flex: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  actionType: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  actionDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  actionDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  actionMeta: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  bottomSpacer: {
    height: THEME.spacing['2xl'],
  },
});
