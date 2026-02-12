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

      if (error) {
        const errMsg = data?.error || error.message || 'Failed to start onboarding';
        throw new Error(errMsg);
      }

      // If already fully onboarded, refresh the local state
      if (data?.alreadyOnboarded) {
        await refreshPayouts();
        return;
      }

      if (!data?.onboardingUrl) {
        throw new Error('No onboarding URL returned');
      }

      // Open Stripe Connect onboarding in an in-app browser
      await WebBrowser.openBrowserAsync(data.onboardingUrl);

      // After returning from Stripe, refresh the account status
      await refreshPayouts();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start payout onboarding. Please try again.');
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
        <Text style={styles.sectionTitle}>Fees</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Card payments</Text>
          <Text style={styles.detailValue}>1.75% + $0.30</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>BECS Direct Debit</Text>
          <Text style={styles.detailValue}>1.0% (max $3.50)</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Platform fee</Text>
          <Text style={styles.detailValue}>1.5%</Text>
        </View>
        <Text style={styles.feeNote}>
          Processing fees are paid by the tenant. Platform fee is deducted from payouts.
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
    marginBottom: THEME.spacing.lg,
  },
  feeNote: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.md,
    lineHeight: 16,
  },
  connectButton: {
    marginBottom: THEME.spacing.base,
  },
  loader: {
    marginTop: -THEME.spacing.md,
    marginBottom: THEME.spacing.base,
  },
});
