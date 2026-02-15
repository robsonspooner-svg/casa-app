import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, Button } from '@casa/ui';
import { useOwnerPayouts, getSupabaseClient } from '@casa/api';

export default function PayoutOnboardScreen() {
  const { stripeAccount, isOnboarded, refreshPayouts } = useOwnerPayouts();
  const [loading, setLoading] = useState(false);

  const handleStartOnboarding = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: {
          refreshUrl: 'casa-owner://payments/onboard',
          returnUrl: 'casa-owner://payments/onboard',
        },
      });

      // Check for errors from both the supabase invoke wrapper and the function response body
      if (error || data?.error) {
        let errMsg = 'Failed to start onboarding';
        if (data?.error) {
          // Function returned a detailed error in the body
          errMsg = data.error;
        } else if (error?.message) {
          errMsg = error.message;
        }
        // Translate generic/cryptic errors into helpful messages
        if (errMsg.includes('non-2xx') || errMsg.includes('status code')) {
          errMsg = 'Unable to connect to the payment service. Please check your internet connection and try again.';
        } else if (errMsg.includes('Network') || errMsg.includes('fetch')) {
          errMsg = 'Network error. Please check your internet connection and try again.';
        } else if (errMsg.includes('Only property owners')) {
          errMsg = 'Only property owners can set up payout accounts. Please ensure your account is set to owner role.';
        } else if (errMsg.includes('STRIPE_SECRET_KEY')) {
          errMsg = 'Payment service is not configured yet. Please contact Casa support.';
        } else if (errMsg.includes('Invalid authentication') || errMsg.includes('Missing authorization')) {
          errMsg = 'Your session has expired. Please log out and log back in, then try again.';
        }
        throw new Error(errMsg);
      }

      // If already fully onboarded, refresh the local state
      if (data?.alreadyOnboarded) {
        await refreshPayouts();
        Alert.alert('Already Connected', 'Your bank account is already connected and payouts are enabled.');
        return;
      }

      if (!data?.onboardingUrl || !data.onboardingUrl.startsWith('http')) {
        throw new Error(`Onboarding session could not be created. Please try again. (URL: ${data?.onboardingUrl || 'none'})`);
      }

      // Open Stripe Connect onboarding in an in-app browser
      await WebBrowser.openBrowserAsync(data.onboardingUrl);

      // After returning from Stripe, refresh the account status
      await refreshPayouts();
    } catch (err: any) {
      const message = err.message || 'Failed to start payout onboarding. Please try again.';
      Alert.alert(
        'Connection Error',
        message,
        [
          { text: 'OK', style: 'cancel' },
          ...(message.includes('internet') || message.includes('Network')
            ? [{ text: 'Retry', onPress: () => handleStartOnboarding() }]
            : []),
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  if (isOnboarded) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card variant="elevated" style={styles.statusCard}>
          <View style={styles.checkIcon}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.statusTitle}>Payouts Active</Text>
          <Text style={styles.statusText}>
            Your bank account is connected and payouts are enabled.
          </Text>
        </Card>

        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Type</Text>
            <Text style={styles.detailValue}>{stripeAccount?.account_type || 'Express'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payout Schedule</Text>
            <Text style={styles.detailValue}>{stripeAccount?.payout_schedule || 'Daily'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Charges Enabled</Text>
            <Text style={[styles.detailValue, { color: THEME.colors.success }]}>Yes</Text>
          </View>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
            <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.heroTitle}>Set Up Payouts</Text>
        <Text style={styles.heroText}>
          Connect your bank account to receive rent payments directly from your tenants.
        </Text>
      </View>

      <Card style={styles.benefitsCard}>
        <Text style={styles.sectionTitle}>How it works</Text>
        {[
          'Tenants pay rent through the app',
          'Payments are processed securely via Stripe',
          'Funds are deposited directly to your bank',
          'Track all payments in real-time',
        ].map((benefit, index) => (
          <View key={index} style={styles.benefitRow}>
            <View style={styles.bulletPoint} />
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.feeCard}>
        <Text style={styles.sectionTitle}>Processing Fees</Text>
        <Text style={styles.feeIntro}>
          Stripe charges a small processing fee on each rent payment, deducted from your payout. Casa adds no fees on top — your only cost is your subscription.
        </Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Card payments</Text>
          <Text style={styles.detailValue}>1.75% + $0.30</Text>
        </View>
        <View style={[styles.detailRow, styles.becsHighlightRow]}>
          <View>
            <Text style={styles.detailLabel}>BECS Direct Debit</Text>
            <Text style={styles.becsSavingsLabel}>Recommended — lowest fees</Text>
          </View>
          <Text style={[styles.detailValue, { color: THEME.colors.success }]}>Max $3.50</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Casa platform fee</Text>
          <Text style={[styles.detailValue, { color: THEME.colors.success }]}>None</Text>
        </View>
      </Card>

      <Card style={styles.savingsCard}>
        <View style={styles.savingsHeader}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={THEME.colors.success} strokeWidth={1.5} />
            <Path d="M12 8v4M12 16h.01" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.savingsTitle}>Save with BECS Direct Debit</Text>
        </View>
        <Text style={styles.savingsText}>
          On a $2,000 rent payment, card processing costs ~$35.30. With BECS, it is capped at just $3.50 — saving you over $30 per payment. Ask your tenant to set up BECS as their payment method for the best deal.
        </Text>
      </Card>

      <Card style={styles.transparencyCard}>
        <Text style={styles.transparencyTitle}>Casa's commitment: No hidden fees</Text>
        <Text style={styles.transparencyText}>
          Casa only charges one recurring subscription. We never add markups, platform fees, or hidden charges on rent payments. The only processing fees are Stripe's standard rates, which we pass through at cost. We actively work to minimise these fees so owners and tenants get the best deal.
        </Text>
      </Card>

      <Button
        title={loading ? 'Connecting...' : 'Connect Bank Account'}
        onPress={handleStartOnboarding}
        style={styles.connectButton}
        disabled={loading}
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.base,
  },
  heroTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  heroText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.xl,
    marginBottom: THEME.spacing.base,
  },
  checkIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  statusTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  statusText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
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
  },
  benefitsCard: {
    marginBottom: THEME.spacing.base,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    gap: THEME.spacing.md,
  },
  bulletPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.brand,
  },
  benefitText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  feeCard: {
    marginBottom: THEME.spacing.base,
  },
  feeIntro: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.md,
  },
  becsHighlightRow: {
    backgroundColor: THEME.colors.successBg,
    marginHorizontal: -THEME.spacing.base,
    paddingHorizontal: THEME.spacing.base,
    borderRadius: THEME.radius.sm,
  },
  becsSavingsLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.success,
    fontWeight: THEME.fontWeight.medium,
    marginTop: 2,
  },
  savingsCard: {
    marginBottom: THEME.spacing.base,
    backgroundColor: THEME.colors.successBg,
  },
  savingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  savingsTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.success,
  },
  savingsText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  transparencyCard: {
    marginBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.brand + '08',
    borderWidth: 1,
    borderColor: THEME.colors.brand + '20',
  },
  transparencyTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  transparencyText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  connectButton: {
    marginBottom: THEME.spacing.base,
  },
  loader: {
    marginTop: -THEME.spacing.md,
    marginBottom: THEME.spacing.base,
  },
});
