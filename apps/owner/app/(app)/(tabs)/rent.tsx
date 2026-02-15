import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Modal, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, PaymentStatusBadge, CurrencyDisplay, Button, useToast } from '@casa/ui';
import { usePayments, useOwnerPayouts, useArrears, useTenancies, formatDollars, getSupabaseClient } from '@casa/api';

function ArrearsAlert() {
  const { arrears, loading } = useArrears();
  const activeArrears = arrears.filter((a) => !a.is_resolved);
  const totalOverdue = activeArrears.reduce((sum, a) => sum + Number(a.total_overdue), 0);

  if (loading || activeArrears.length === 0) return null;

  return (
    <TouchableOpacity
      style={styles.arrearsAlert}
      onPress={() => router.push('/(app)/arrears' as any)}
      activeOpacity={0.7}
    >
      <View style={styles.arrearsAlertLeft}>
        <View style={styles.arrearsAlertIcon}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={THEME.colors.surface} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 9v4M12 17h.01" stroke={THEME.colors.surface} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <View>
          <Text style={styles.arrearsAlertTitle}>{activeArrears.length} tenant{activeArrears.length !== 1 ? 's' : ''} in arrears</Text>
          <Text style={styles.arrearsAlertAmount}>${totalOverdue.toFixed(2)} total overdue</Text>
        </View>
      </View>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke={THEME.colors.surface} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );
}

function RecordPaymentModal({
  visible,
  onClose,
  tenancies,
  onRecorded,
}: {
  visible: boolean;
  onClose: () => void;
  tenancies: any[];
  onRecorded: () => void;
}) {
  const toast = useToast();
  const [selectedTenancy, setSelectedTenancy] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedTenancy || !amount) {
      toast.error('Please select a tenancy and enter an amount.');
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const tenancy = tenancies.find(t => t.id === selectedTenancy);
      if (!tenancy) throw new Error('Tenancy not found');

      // Find the next unpaid rent_schedule for this tenancy
      const { data: unpaidSchedule } = await (supabase
        .from('rent_schedules') as ReturnType<typeof supabase.from>)
        .select('id, due_date, amount')
        .eq('tenancy_id', selectedTenancy)
        .eq('is_paid', false)
        .order('due_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Record payment
      const { error: paymentError } = await (supabase
        .from('payments') as ReturnType<typeof supabase.from>)
        .insert({
          tenancy_id: selectedTenancy,
          tenant_id: tenancy.tenants?.[0]?.tenant_id,
          payment_type: 'rent',
          amount: amountNum,
          status: 'completed',
          description: reference ? `Bank transfer: ${reference}` : 'Bank transfer (manual)',
          paid_at: new Date().toISOString(),
        });

      if (paymentError) throw paymentError;

      // Mark rent schedule as paid if one matches
      if (unpaidSchedule) {
        await (supabase
          .from('rent_schedules') as ReturnType<typeof supabase.from>)
          .update({ is_paid: true, paid_at: new Date().toISOString() })
          .eq('id', unpaidSchedule.id);
      }

      toast.success('Payment recorded successfully.');
      setSelectedTenancy(null);
      setAmount('');
      setReference('');
      onClose();
      onRecorded();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Record Bank Transfer</Text>
          <Text style={styles.modalSubtitle}>
            Record a rent payment received via direct bank transfer.
          </Text>

          <Text style={styles.inputLabel}>Property / Tenancy</Text>
          {tenancies.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tenancyOption, selectedTenancy === t.id && styles.tenancyOptionSelected]}
              onPress={() => setSelectedTenancy(t.id)}
            >
              <Text style={[styles.tenancyOptionText, selectedTenancy === t.id && styles.tenancyOptionTextSelected]}>
                {t.property?.address_line_1 || t.property_address || 'Property'}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.inputLabel}>Amount ($)</Text>
          <TextInput
            style={styles.modalInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 450.00"
            placeholderTextColor={THEME.colors.textTertiary}
            keyboardType="decimal-pad"
          />

          <Text style={styles.inputLabel}>Reference (optional)</Text>
          <TextInput
            style={styles.modalInput}
            value={reference}
            onChangeText={setReference}
            placeholder="e.g. BSB transfer ref"
            placeholderTextColor={THEME.colors.textTertiary}
          />

          <View style={styles.modalButtons}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Record Payment" onPress={handleSave} loading={saving} disabled={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function RentScreen() {
  const { payments, loading: paymentsLoading, refreshPayments } = usePayments({ limit: 10 });
  const { isOnboarded, loading: payoutsLoading } = useOwnerPayouts();
  const { tenancies } = useTenancies({ status: 'active' });
  const [showRecordModal, setShowRecordModal] = useState(false);

  const loading = paymentsLoading || payoutsLoading;

  const completedPayments = payments.filter(p => p.status === 'completed');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const totalReceived = completedPayments.reduce((sum, p) => sum + Number(p.net_amount || p.amount), 0);

  const hasTenancies = tenancies.length > 0;
  const hasPayments = payments.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rent</Text>
        <Text style={styles.subtitle}>Track payments across your properties</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refreshPayments} />
        }
      >
        {/* Arrears Alert - always visible when arrears exist */}
        <ArrearsAlert />

        {/* Payout Status Banner */}
        {!isOnboarded && (
          <Card style={styles.onboardCard}>
            <Text style={styles.onboardTitle}>Set up payouts</Text>
            <Text style={styles.onboardText}>
              Connect your bank account to receive rent payments from tenants.
            </Text>
            <TouchableOpacity
              style={styles.onboardButton}
              onPress={() => router.push('/(app)/payments/onboard' as any)}
            >
              <Text style={styles.onboardButtonText}>Connect Bank Account</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Quick Actions */}
        <View style={styles.rentActions}>
          <TouchableOpacity
            style={styles.rentActionButton}
            onPress={() => router.push('/(app)/arrears' as any)}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={THEME.colors.error} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M12 9v4M12 17h.01" stroke={THEME.colors.error} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.rentActionLabel}>Arrears</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rentActionButton}
            onPress={() => setShowRecordModal(true)}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={THEME.colors.success} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.rentActionLabel}>Record</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rentActionButton}
            onPress={() => router.push('/(app)/payments' as any)}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.rentActionLabel}>Payments</Text>
          </TouchableOpacity>
        </View>

        {/* Revenue Summary - show when there are payments */}
        {hasPayments && (
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Received</Text>
              <CurrencyDisplay amount={totalReceived} size="md" color={THEME.colors.success} />
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Pending</Text>
              <CurrencyDisplay
                amount={pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0)}
                size="md"
                color={THEME.colors.warning}
              />
            </Card>
          </View>
        )}

        {/* Recent Payments */}
        {hasPayments && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            {payments.slice(0, 5).map(payment => (
              <Card key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentDate}>
                      {(payment.paid_at || payment.created_at) &&
                        new Date(payment.paid_at || payment.created_at).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                        })
                      }
                    </Text>
                    <Text style={styles.paymentAddress}>
                      {payment.tenancy?.property_address || 'Property'}
                    </Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>{formatDollars(Number(payment.amount))}</Text>
                    <PaymentStatusBadge status={payment.status} />
                  </View>
                </View>
              </Card>
            ))}
            {payments.length > 5 && (
              <TouchableOpacity
                style={styles.viewAllLink}
                onPress={() => router.push('/(app)/payments' as any)}
              >
                <Text style={styles.viewAllText}>View all payments</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Empty state - only when no tenancies exist at all */}
        {!hasTenancies && !hasPayments && !loading && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>No rent scheduled</Text>
            <Text style={styles.emptyText}>
              Once you have tenants, rent payments will appear here.
            </Text>
          </View>
        )}
      </ScrollView>

      <RecordPaymentModal
        visible={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        tenancies={tenancies}
        onRecorded={refreshPayments}
      />
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
    width: 72,
    height: 72,
    borderRadius: 36,
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
  onboardCard: {
    marginBottom: THEME.spacing.base,
    backgroundColor: THEME.colors.warningBg,
    borderWidth: 1,
    borderColor: THEME.colors.warning,
  },
  onboardTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  onboardText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  onboardButton: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.base,
    borderRadius: THEME.radius.sm,
    alignSelf: 'flex-start',
  },
  onboardButtonText: {
    color: THEME.colors.textInverse,
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.base,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: THEME.spacing.base,
  },
  statLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  paymentAddress: {
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
  viewAllLink: {
    paddingVertical: THEME.spacing.md,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  arrearsAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.error,
    marginBottom: THEME.spacing.base,
    padding: THEME.spacing.base,
    borderRadius: THEME.radius.md,
  },
  arrearsAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  arrearsAlertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrearsAlertTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.surface,
  },
  arrearsAlertAmount: {
    fontSize: THEME.fontSize.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  rentActions: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.base,
  },
  rentActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.surface,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  rentActionLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius.lg,
    borderTopRightRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    paddingBottom: THEME.spacing['2xl'],
  },
  modalTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  modalSubtitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
  },
  inputLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
    marginTop: THEME.spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    backgroundColor: THEME.colors.canvas,
  },
  tenancyOption: {
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.xs,
    backgroundColor: THEME.colors.canvas,
  },
  tenancyOptionSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.subtle,
  },
  tenancyOptionText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  tenancyOptionTextSelected: {
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.semibold,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
  },
});
