// Create Payment Plan Screen
// Mission 08: Arrears & Late Payment Management

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, Button, Chip } from '@casa/ui';
import { useArrearsMutations, formatDollars } from '@casa/api';
import type { PaymentFrequency } from '@casa/api';

const FREQUENCY_OPTIONS: { label: string; value: PaymentFrequency }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Fortnightly', value: 'fortnightly' },
  { label: 'Monthly', value: 'monthly' },
];

export default function CreatePaymentPlanScreen() {
  const { arrearsId, tenancyId, totalArrears } = useLocalSearchParams<{
    arrearsId: string;
    tenancyId: string;
    totalArrears: string;
  }>();

  const { createPaymentPlan, loading } = useArrearsMutations();

  const arrearsAmount = parseFloat(totalArrears || '0');

  const [installmentAmount, setInstallmentAmount] = useState('');
  const [frequency, setFrequency] = useState<PaymentFrequency>('weekly');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Default to 1 week from now
  );
  const [notes, setNotes] = useState('');

  const installmentValue = parseFloat(installmentAmount) || 0;
  const totalInstallments = installmentValue > 0 ? Math.ceil(arrearsAmount / installmentValue) : 0;

  const calculateEndDate = (): string => {
    if (totalInstallments === 0) return 'N/A';

    const start = new Date(startDate);
    let end = new Date(start);

    const intervals = totalInstallments - 1;
    switch (frequency) {
      case 'weekly':
        end.setDate(end.getDate() + intervals * 7);
        break;
      case 'fortnightly':
        end.setDate(end.getDate() + intervals * 14);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + intervals);
        break;
    }

    return end.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleSubmit = async () => {
    if (!arrearsId || !tenancyId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    if (installmentValue <= 0) {
      Alert.alert('Error', 'Please enter a valid installment amount');
      return;
    }

    if (installmentValue > arrearsAmount) {
      Alert.alert('Error', 'Installment amount cannot exceed total arrears');
      return;
    }

    const planId = await createPaymentPlan({
      arrears_record_id: arrearsId,
      tenancy_id: tenancyId,
      total_arrears: arrearsAmount,
      installment_amount: installmentValue,
      installment_frequency: frequency,
      start_date: startDate,
      notes: notes || undefined,
    });

    if (planId) {
      Alert.alert('Success', 'Payment plan created successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', 'Failed to create payment plan. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Summary */}
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Arrears</Text>
        <Text style={styles.summaryAmount}>{formatDollars(arrearsAmount)}</Text>
      </Card>

      {/* Installment Amount */}
      <Card style={styles.inputCard}>
        <Text style={styles.inputLabel}>Installment Amount</Text>
        <Text style={styles.inputDescription}>
          How much should the tenant pay each time?
        </Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={installmentAmount}
            onChangeText={setInstallmentAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={THEME.colors.textTertiary}
          />
        </View>

        {/* Quick amount buttons */}
        <View style={styles.quickAmounts}>
          {[50, 100, 150, 200].map(amount => (
            <Chip
              key={amount}
              label={`$${amount}`}
              selected={installmentAmount === amount.toString()}
              onPress={() => setInstallmentAmount(amount.toString())}
            />
          ))}
        </View>
      </Card>

      {/* Frequency */}
      <Card style={styles.inputCard}>
        <Text style={styles.inputLabel}>Payment Frequency</Text>
        <Text style={styles.inputDescription}>
          How often should payments be made?
        </Text>
        <View style={styles.frequencyOptions}>
          {FREQUENCY_OPTIONS.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              selected={frequency === option.value}
              onPress={() => setFrequency(option.value)}
            />
          ))}
        </View>
      </Card>

      {/* Start Date */}
      <Card style={styles.inputCard}>
        <Text style={styles.inputLabel}>Start Date</Text>
        <Text style={styles.inputDescription}>
          When should the first payment be due?
        </Text>
        <TextInput
          style={styles.dateInput}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={THEME.colors.textTertiary}
        />
      </Card>

      {/* Notes */}
      <Card style={styles.inputCard}>
        <Text style={styles.inputLabel}>Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional notes about the payment arrangement..."
          placeholderTextColor={THEME.colors.textTertiary}
          multiline
          numberOfLines={3}
        />
      </Card>

      {/* Plan Preview */}
      {totalInstallments > 0 && (
        <Card style={styles.previewCard}>
          <Text style={styles.previewTitle}>Plan Summary</Text>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Number of Installments</Text>
            <Text style={styles.previewValue}>{totalInstallments}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Each Payment</Text>
            <Text style={styles.previewValue}>{formatDollars(installmentValue)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Frequency</Text>
            <Text style={styles.previewValue}>{frequency.charAt(0).toUpperCase() + frequency.slice(1)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>First Payment</Text>
            <Text style={styles.previewValue}>
              {new Date(startDate).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Expected Completion</Text>
            <Text style={styles.previewValue}>{calculateEndDate()}</Text>
          </View>
        </Card>
      )}

      {/* Submit Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Create Payment Plan"
          onPress={handleSubmit}
          loading={loading}
          disabled={installmentValue <= 0}
        />
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  summaryCard: {
    margin: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
  },
  summaryLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.error,
    marginTop: THEME.spacing.xs,
  },
  inputCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  inputLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  inputDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    backgroundColor: THEME.colors.canvas,
  },
  currencySymbol: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
    marginRight: THEME.spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    paddingVertical: THEME.spacing.md,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
  },
  frequencyOptions: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    backgroundColor: THEME.colors.canvas,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    backgroundColor: THEME.colors.canvas,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  previewCard: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    backgroundColor: THEME.colors.subtle,
  },
  previewTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.xs,
  },
  previewLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  previewValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  buttonContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  bottomSpacer: {
    height: THEME.spacing['2xl'],
  },
});
