import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, Button, CurrencyDisplay } from '@casa/ui';
import {
  useMyTenancy,
  useRentSchedule,
  usePaymentMethods,
  getSupabaseClient,
  formatDollars,
} from '@casa/api';

export default function PayScreen() {
  const { tenancy } = useMyTenancy();
  const { schedules, totalOwed, nextDue } = useRentSchedule(tenancy?.id);
  const { methods, defaultMethod } = usePaymentMethods();
  const [loading, setLoading] = useState(false);
  const params = useLocalSearchParams<{ success?: string; cancelled?: string }>();

  // Handle return from Stripe Checkout
  if (params.success === 'true') {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <View style={styles.successIcon}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.successTitle}>Payment Submitted</Text>
        <Text style={styles.successText}>
          Your payment is being processed. You will receive a confirmation shortly.
        </Text>
        <Button
          title="Done"
          onPress={() => router.replace('/(app)/payments' as any)}
          style={styles.payButton}
        />
      </View>
    );
  }

  // Determine what to pay: overdue first, then next due
  const overdueSchedules = schedules.filter(s => {
    const today = new Date().toISOString().split('T')[0];
    return !s.is_paid && s.due_date <= today;
  });

  const payableAmount = totalOwed > 0 ? totalOwed : (nextDue ? Number(nextDue.amount) : 0);
  // Amount in cents for Stripe
  const payableAmountCents = Math.round(payableAmount * 100);

  const handlePay = async () => {
    if (!tenancy || payableAmountCents === 0) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.functions.invoke('create-rent-checkout', {
        body: {
          tenancyId: tenancy.id,
          amount: payableAmountCents,
          paymentType: 'rent',
          description: overdueSchedules.length > 0
            ? `Rent payment (${overdueSchedules.length} overdue)`
            : 'Rent payment',
          rentScheduleId: overdueSchedules.length > 0
            ? overdueSchedules[0].id
            : nextDue?.id || undefined,
        },
      });

      if (error) {
        const errMsg = data?.error || error.message || 'Failed to start payment';
        throw new Error(errMsg);
      }

      if (!data?.sessionUrl) {
        throw new Error('No checkout URL returned');
      }

      // Open Stripe Checkout in an in-app browser
      await WebBrowser.openBrowserAsync(data.sessionUrl);
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!tenancy) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <Text style={styles.emptyText}>No active tenancy found.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card variant="elevated" style={styles.amountCard}>
        <Text style={styles.amountLabel}>
          {totalOwed > 0 ? 'Amount Due' : 'Next Payment'}
        </Text>
        <CurrencyDisplay
          amount={payableAmount}
          size="xl"
          color={totalOwed > 0 ? THEME.colors.error : THEME.colors.textPrimary}
        />
        {totalOwed > 0 && overdueSchedules.length > 0 && (
          <Text style={styles.overdueNote}>
            {overdueSchedules.length} overdue payment{overdueSchedules.length > 1 ? 's' : ''}
          </Text>
        )}
        {nextDue && totalOwed === 0 && (
          <Text style={styles.dueDate}>
            Due {new Date(nextDue.due_date).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        )}
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        {methods.length === 0 ? (
          <Card style={styles.noMethodCard}>
            <Text style={styles.noMethodText}>No payment methods saved</Text>
            <Text style={styles.noMethodSubtext}>
              You can add a payment method, or pay directly via card or bank account at checkout.
            </Text>
            <Button
              title="Add Payment Method"
              onPress={() => router.push('/(app)/payments/methods/add' as any)}
              style={styles.addMethodButton}
            />
          </Card>
        ) : (
          <Card style={styles.savedMethodCard}>
            <View style={styles.methodInfo}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <View style={styles.methodDetails}>
                <Text style={styles.methodType}>
                  {defaultMethod?.type === 'au_becs_debit' ? 'Bank Account' : defaultMethod?.brand || 'Card'}
                </Text>
                <Text style={styles.methodLast4}>
                  {defaultMethod?.type === 'au_becs_debit'
                    ? `BSB ****${defaultMethod?.last_four}`
                    : `****${defaultMethod?.last_four}`}
                </Text>
              </View>
            </View>
            <Text style={styles.savedMethodNote}>
              Your saved payment method will be available at checkout.
            </Text>
          </Card>
        )}
      </View>

      <Card style={styles.infoCard}>
        <Text style={styles.infoText}>
          You will be taken to a secure checkout page powered by Stripe to complete your payment.
        </Text>
      </Card>

      <Button
        title={loading ? '' : `Pay ${formatDollars(payableAmount)}`}
        onPress={handlePay}
        disabled={payableAmountCents === 0 || loading}
        style={styles.payButton}
      />
      {loading && (
        <ActivityIndicator size="small" color={THEME.colors.brand} style={styles.loader} />
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
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  amountCard: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.xl,
    marginBottom: THEME.spacing.lg,
  },
  amountLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  overdueNote: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.error,
    marginTop: THEME.spacing.sm,
  },
  dueDate: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.sm,
  },
  section: {
    marginBottom: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  noMethodCard: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
  },
  noMethodText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  noMethodSubtext: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
    lineHeight: 18,
  },
  addMethodButton: {
    minWidth: 200,
  },
  savedMethodCard: {
    paddingVertical: THEME.spacing.base,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  methodDetails: {
    flex: 1,
  },
  methodType: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  methodLast4: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  savedMethodNote: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    lineHeight: 16,
  },
  infoCard: {
    backgroundColor: THEME.colors.infoBg,
    marginBottom: THEME.spacing.lg,
  },
  infoText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  payButton: {
    marginBottom: THEME.spacing.base,
  },
  loader: {
    marginTop: -THEME.spacing.md,
    marginBottom: THEME.spacing.base,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  successTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  successText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
  },
});
