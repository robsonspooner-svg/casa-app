import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, Button, Badge } from '@casa/ui';
import { useProfile, SUBSCRIPTION_TIERS } from '@casa/api';
import type { SubscriptionTier } from '@casa/api';

export default function SubscriptionScreen() {
  const { profile } = useProfile();

  const currentTier = (profile?.subscription_tier || 'starter') as SubscriptionTier;
  const currentStatus = profile?.subscription_status || 'active';
  const tierInfo = SUBSCRIPTION_TIERS[currentTier];

  const tiers: SubscriptionTier[] = ['starter', 'pro', 'hands_off'];

  const handleChangePlan = (tier: SubscriptionTier) => {
    if (tier === currentTier) return;

    const targetTier = SUBSCRIPTION_TIERS[tier];
    const isUpgrade = targetTier.price > tierInfo.price;

    Alert.alert(
      `${isUpgrade ? 'Upgrade' : 'Downgrade'} to ${targetTier.name}`,
      isUpgrade
        ? `You'll be charged ${targetTier.priceFormatted} starting immediately (prorated for this billing period).`
        : `Your plan will change to ${targetTier.name} at the end of your current billing period.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isUpgrade ? 'Upgrade' : 'Downgrade',
          onPress: () => {
            // In production, this calls the backend to update Stripe subscription
            Alert.alert(
              'Stripe Integration Required',
              'Plan changes require Stripe Billing integration. This will be processed when Stripe keys are configured.'
            );
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? You will lose access to paid features at the end of your billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Stripe Integration Required',
              'Cancellation requires Stripe Billing integration.'
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current Plan */}
      <Card variant="elevated" style={styles.currentPlanCard}>
        <View style={styles.currentPlanHeader}>
          <Text style={styles.currentPlanLabel}>Current Plan</Text>
          <Badge
            label={currentStatus === 'active' ? 'Active' : currentStatus}
            variant={currentStatus === 'active' ? 'success' : 'warning'}
          />
        </View>
        <Text style={styles.currentPlanName}>{tierInfo.name}</Text>
        <Text style={styles.currentPlanPrice}>{tierInfo.priceFormatted}</Text>
      </Card>

      {currentStatus === 'past_due' && (
        <Card style={styles.warningCard}>
          <Text style={styles.warningTitle}>Payment past due</Text>
          <Text style={styles.warningText}>
            Your last payment failed. Please update your payment method to avoid service interruption.
          </Text>
        </Card>
      )}

      {/* Available Plans */}
      <Text style={styles.sectionTitle}>Available Plans</Text>

      {tiers.map(tier => {
        const info = SUBSCRIPTION_TIERS[tier];
        const isCurrent = tier === currentTier;

        return (
          <Card
            key={tier}
            style={{ ...styles.planCard, ...(isCurrent ? styles.planCardCurrent : {}) }}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{info.name}</Text>
                <Text style={styles.planPrice}>{info.priceFormatted}</Text>
              </View>
              {isCurrent && <Badge label="Current" variant="info" />}
            </View>

            <View style={styles.featuresList}>
              {info.features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {!isCurrent && (
              <Button
                title={info.price > tierInfo.price ? 'Upgrade' : 'Downgrade'}
                onPress={() => handleChangePlan(tier)}
                style={styles.planButton}
              />
            )}
          </Card>
        );
      })}

      {/* Add-ons */}
      <TouchableOpacity
        style={styles.addOnsLink}
        onPress={() => router.push('/(app)/subscription/add-ons' as any)}
      >
        <Text style={styles.addOnsText}>View Add-On Services</Text>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>

      {/* Billing History */}
      <TouchableOpacity
        style={styles.addOnsLink}
        onPress={() => router.push('/(app)/subscription/billing-history' as any)}
      >
        <Text style={styles.addOnsText}>Billing History</Text>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>

      {/* Cancel */}
      <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
        <Text style={styles.cancelText}>Cancel subscription</Text>
      </TouchableOpacity>
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
  currentPlanCard: {
    marginBottom: THEME.spacing.base,
    paddingVertical: THEME.spacing.lg,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  currentPlanLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentPlanName: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  currentPlanPrice: {
    fontSize: THEME.fontSize.h3,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  warningCard: {
    marginBottom: THEME.spacing.base,
    backgroundColor: THEME.colors.errorBg,
    borderWidth: 1,
    borderColor: THEME.colors.error,
  },
  warningTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.error,
    marginBottom: THEME.spacing.xs,
  },
  warningText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
    marginTop: THEME.spacing.md,
  },
  planCard: {
    marginBottom: THEME.spacing.md,
  },
  planCardCurrent: {
    borderWidth: 2,
    borderColor: THEME.colors.brand,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.md,
  },
  planName: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  planPrice: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  featuresList: {
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  featureText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  planButton: {
    marginTop: THEME.spacing.sm,
  },
  addOnsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.base,
    marginTop: THEME.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  addOnsText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
  },
  cancelText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
});
