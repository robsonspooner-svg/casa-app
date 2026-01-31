import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, Button, CurrencyDisplay } from '@casa/ui';
import {
  useMyTenancy,
  useRentSchedule,
  usePaymentMethods,
  usePaymentMutations,
  formatDollars,
} from '@casa/api';

export default function PayScreen() {
  const { tenancy } = useMyTenancy();
  const { schedules, totalOwed, nextDue } = useRentSchedule(tenancy?.id);
  const { methods, defaultMethod } = usePaymentMethods();
  const { createPayment, loading: mutating } = usePaymentMutations();
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const activeMethod = selectedMethodId
    ? methods.find(m => m.id === selectedMethodId)
    : defaultMethod;

  // Determine what to pay: overdue first, then next due
  const overdueSchedules = schedules.filter(s => {
    const today = new Date().toISOString().split('T')[0];
    return !s.is_paid && s.due_date <= today;
  });

  const payableAmount = totalOwed > 0 ? totalOwed : (nextDue ? Number(nextDue.amount) : 0);

  const handlePay = async () => {
    if (!tenancy || !activeMethod || payableAmount === 0) return;

    try {
      await createPayment({
        tenancy_id: tenancy.id,
        payment_method_id: activeMethod.id,
        payment_type: 'rent',
        amount: payableAmount,
        description: overdueSchedules.length > 0
          ? `Rent payment (${overdueSchedules.length} overdue)`
          : 'Rent payment',
        due_date: overdueSchedules.length > 0
          ? overdueSchedules[0].due_date
          : nextDue?.due_date || null,
        status: 'pending',
      });

      Alert.alert(
        'Payment Submitted',
        'Your payment is being processed. You will receive a confirmation shortly.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Payment Failed', 'There was an error processing your payment. Please try again.');
    }
  };

  if (!tenancy) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
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
            <Button
              title="Add Payment Method"
              onPress={() => router.push('/(app)/payments/methods/add' as any)}
              style={styles.addMethodButton}
            />
          </Card>
        ) : (
          <>
            {methods.map(method => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodOption,
                  activeMethod?.id === method.id && styles.methodOptionSelected,
                ]}
                onPress={() => setSelectedMethodId(method.id)}
              >
                <View style={styles.methodInfo}>
                  <Text style={styles.methodType}>
                    {method.type === 'au_becs_debit' ? 'Bank Account' : method.brand || 'Card'}
                  </Text>
                  <Text style={styles.methodLast4}>
                    {method.type === 'au_becs_debit' ? `BSB ****${method.last_four}` : `****${method.last_four}`}
                  </Text>
                </View>
                <View style={[
                  styles.radio,
                  activeMethod?.id === method.id && styles.radioSelected,
                ]} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.addAnotherLink}
              onPress={() => router.push('/(app)/payments/methods/add' as any)}
            >
              <Text style={styles.addAnotherText}>Add another method</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Button
        title={`Pay ${formatDollars(payableAmount)}`}
        onPress={handlePay}
        loading={mutating}
        disabled={!activeMethod || payableAmount === 0 || mutating}
        style={styles.payButton}
      />
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
    marginBottom: THEME.spacing.md,
  },
  addMethodButton: {
    minWidth: 200,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.base,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.sm,
  },
  methodOptionSelected: {
    borderColor: THEME.colors.brand,
  },
  methodInfo: {
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
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: THEME.colors.border,
  },
  radioSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.brand,
  },
  addAnotherLink: {
    paddingVertical: THEME.spacing.sm,
  },
  addAnotherText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  payButton: {
    marginTop: THEME.spacing.base,
  },
});
