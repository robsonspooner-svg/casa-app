import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, Button } from '@casa/ui';
import { getSupabaseClient } from '@casa/api';

type MethodType = 'card' | 'becs';

export default function AddPaymentMethodScreen() {
  const [selectedType, setSelectedType] = useState<MethodType>('card');
  const [loading, setLoading] = useState(false);
  const params = useLocalSearchParams<{ setup?: string }>();

  // BECS form fields
  const [bsbNumber, setBsbNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [becsSuccess, setBecsSuccess] = useState(false);

  // Handle return from Stripe Checkout (card) or BECS success
  if (params.setup === 'success' || becsSuccess) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <View style={styles.successIcon}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.successTitle}>Payment Method Added</Text>
        <Text style={styles.successText}>Your payment method has been saved successfully.</Text>
        <Button
          title="Done"
          onPress={() => router.back()}
          style={styles.addButton}
        />
      </View>
    );
  }

  const handleAddMethod = async () => {
    if (selectedType === 'becs') {
      return handleAddBecs();
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.functions.invoke('stripe-setup-session', {
        body: {
          paymentMethodTypes: ['card'],
          successUrl: 'casa-tenant://payments/methods/add?setup=success',
          cancelUrl: 'casa-tenant://payments/methods/add?setup=cancelled',
        },
      });

      if (error || data?.error) {
        let errMsg = data?.error || error?.message || 'Failed to start payment setup';
        if (errMsg.includes('non-2xx') || errMsg.includes('status code')) {
          errMsg = 'Unable to connect to the payment service. Please check your internet connection and try again.';
        } else if (errMsg.includes('Network') || errMsg.includes('fetch')) {
          errMsg = 'Network error. Please check your internet connection and try again.';
        }
        throw new Error(errMsg);
      }

      if (!data?.sessionUrl || !data.sessionUrl.startsWith('http')) {
        throw new Error('Setup session could not be created. Please try again.');
      }

      await WebBrowser.openBrowserAsync(data.sessionUrl);
    } catch (err: any) {
      const message = err.message || 'Failed to set up payment method. Please try again.';
      Alert.alert(
        'Setup Error',
        message,
        [
          { text: 'OK', style: 'cancel' },
          ...(message.includes('internet') || message.includes('Network')
            ? [{ text: 'Retry', onPress: () => handleAddMethod() }]
            : []),
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddBecs = async () => {
    if (!accountHolderName.trim()) {
      Alert.alert('Required', 'Please enter the account holder name.');
      return;
    }
    const bsbClean = bsbNumber.replace(/[-\s]/g, '');
    if (!/^\d{6}$/.test(bsbClean)) {
      Alert.alert('Invalid BSB', 'BSB must be exactly 6 digits.');
      return;
    }
    const acctClean = accountNumber.replace(/[-\s]/g, '');
    if (!/^\d{5,9}$/.test(acctClean)) {
      Alert.alert('Invalid Account', 'Account number must be 5-9 digits.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.functions.invoke('stripe-setup-session', {
        body: {
          paymentMethodTypes: ['au_becs_debit'],
          bsbNumber: bsbClean,
          accountNumber: acctClean,
          accountHolderName: accountHolderName.trim(),
          successUrl: '',
          cancelUrl: '',
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to add bank account');
      }

      if (data?.success) {
        setBecsSuccess(true);
      } else {
        throw new Error(data?.error || 'Failed to save bank account. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Setup Error', err.message || 'Failed to add bank account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Choose method type</Text>

      <Card style={styles.becsRecommendation}>
        <View style={styles.becsRecommendationRow}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={THEME.colors.success} strokeWidth={1.5} />
            <Path d="M12 8v4M12 16h.01" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.becsRecommendationText}>
            Tip: Bank Account (BECS) has the lowest fees — max $3.50 per payment vs $35+ for cards. This saves your landlord money on every payment.
          </Text>
        </View>
      </Card>

      <View style={styles.typeOptions}>
        <TouchableOpacity
          style={[styles.typeCard, selectedType === 'card' && styles.typeCardSelected]}
          onPress={() => setSelectedType('card')}
          disabled={loading}
        >
          <View style={styles.typeIcon}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z" stroke={selectedType === 'card' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M1 10h22" stroke={selectedType === 'card' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} />
            </Svg>
          </View>
          <Text style={[styles.typeName, selectedType === 'card' && styles.typeNameSelected]}>
            Credit/Debit Card
          </Text>
          <Text style={styles.typeDesc}>Visa, Mastercard, Amex</Text>
          <Text style={styles.typeFee}>1.75% + $0.30 per payment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeCard, selectedType === 'becs' && styles.typeCardSelected]}
          onPress={() => setSelectedType('becs')}
          disabled={loading}
        >
          <View style={styles.typeIcon}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" stroke={selectedType === 'becs' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={[styles.typeName, selectedType === 'becs' && styles.typeNameSelected]}>
            Bank Account (BECS)
          </Text>
          <Text style={styles.typeDesc}>AU Direct Debit</Text>
          <Text style={[styles.typeFee, styles.typeFeeLowest]}>Lowest fees (max $3.50)</Text>
        </TouchableOpacity>
      </View>

      {selectedType === 'becs' && (
        <Card style={styles.becsInfo}>
          <Text style={styles.becsTitle}>Bank Account Details</Text>
          <Text style={styles.becsText}>
            Enter your Australian bank account details below. Processing fees are capped at $3.50 per transaction. Payments take 3-4 business days.
          </Text>
          <View style={styles.becsFormGroup}>
            <Text style={styles.becsFieldLabel}>Account Holder Name</Text>
            <TextInput
              style={styles.becsInput}
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder="Full name on account"
              placeholderTextColor={THEME.colors.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
          <View style={styles.becsFormRow}>
            <View style={[styles.becsFormGroup, { flex: 1 }]}>
              <Text style={styles.becsFieldLabel}>BSB</Text>
              <TextInput
                style={styles.becsInput}
                value={bsbNumber}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, 6);
                  setBsbNumber(digits.length > 3 ? digits.slice(0, 3) + '-' + digits.slice(3) : digits);
                }}
                placeholder="000-000"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="number-pad"
                maxLength={7}
                editable={!loading}
              />
            </View>
            <View style={[styles.becsFormGroup, { flex: 1.5 }]}>
              <Text style={styles.becsFieldLabel}>Account Number</Text>
              <TextInput
                style={styles.becsInput}
                value={accountNumber}
                onChangeText={(text) => setAccountNumber(text.replace(/\D/g, '').slice(0, 9))}
                placeholder="123456789"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="number-pad"
                maxLength={9}
                editable={!loading}
              />
            </View>
          </View>
          <Text style={styles.becsMandateText}>
            By providing your bank account details, you authorise Casa Intelligence Pty Ltd to debit your account through the BECS Direct Debit system for rent payments. You can cancel this authorisation at any time.
          </Text>
        </Card>
      )}

      {selectedType === 'card' && (
        <Card style={styles.feeComparisonCard}>
          <View style={styles.feeComparisonHeader}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01" stroke={THEME.colors.info} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.feeComparisonTitle}>Save on fees with BECS</Text>
          </View>
          <Text style={styles.feeComparisonText}>
            For a $2,000 rent payment, a card costs ~$35.30 in processing fees. BECS Direct Debit caps fees at just $3.50 — saving your landlord over $30 per payment.
          </Text>
        </Card>
      )}

      <Button
        title={loading ? '' : (selectedType === 'card' ? 'Add Card' : 'Add Bank Account')}
        onPress={handleAddMethod}
        style={styles.addButton}
        disabled={loading}
      />
      {loading && (
        <ActivityIndicator size="small" color={THEME.colors.brand} style={styles.loader} />
      )}

      <Text style={styles.securityNote}>
        Your payment details are securely handled by Stripe. Casa never stores your full card number or bank details. Casa charges no hidden fees on payments — your only cost is one recurring subscription.
      </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  becsRecommendation: {
    backgroundColor: THEME.colors.successBg,
    marginBottom: THEME.spacing.base,
  },
  becsRecommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: THEME.spacing.sm,
  },
  becsRecommendationText: {
    flex: 1,
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    padding: THEME.spacing.base,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  typeCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.brand + '08',
  },
  typeIcon: {
    marginBottom: THEME.spacing.sm,
  },
  typeName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  typeNameSelected: {
    color: THEME.colors.brand,
  },
  typeDesc: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  typeFee: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.xs,
    textAlign: 'center',
  },
  typeFeeLowest: {
    color: THEME.colors.success,
    fontWeight: THEME.fontWeight.medium,
  },
  feeComparisonCard: {
    marginBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.infoBg,
  },
  feeComparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  feeComparisonTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  feeComparisonText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  becsInfo: {
    marginBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.infoBg,
  },
  becsTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  becsText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.md,
  },
  becsFormGroup: {
    marginBottom: THEME.spacing.md,
  },
  becsFormRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  becsFieldLabel: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  becsInput: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.sm,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  becsMandateText: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    lineHeight: 15,
    marginTop: THEME.spacing.sm,
  },
  addButton: {
    marginBottom: THEME.spacing.base,
  },
  loader: {
    marginTop: -THEME.spacing.md,
    marginBottom: THEME.spacing.base,
  },
  securityNote: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
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
