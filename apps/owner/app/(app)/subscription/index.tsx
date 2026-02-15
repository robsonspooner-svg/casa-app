import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, Button, Badge } from '@casa/ui';
import { useProfile, SUBSCRIPTION_TIERS, getSupabaseClient } from '@casa/api';
import type { SubscriptionTier } from '@casa/api';

export default function SubscriptionScreen() {
  const { profile, refreshProfile } = useProfile();
  const [loading, setLoading] = useState<string | null>(null);

  const currentTier = (profile?.subscription_tier || 'starter') as SubscriptionTier;
  const currentStatus = profile?.subscription_status || 'active';
  const tierInfo = SUBSCRIPTION_TIERS[currentTier];

  const tiers: SubscriptionTier[] = ['starter', 'pro', 'hands_off'];

  const callSubscriptionApi = async (action: string, tier?: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('manage-subscription', {
      body: { action, tier },
    });

    if (error) {
      const errMsg = data?.error || error.message || 'Something went wrong';
      throw new Error(errMsg);
    }
    // Edge Function returns 200 with { success: false, error: '...' } on failure
    if (data?.error || data?.success === false) {
      throw new Error(data.error || 'Something went wrong');
    }
    return data;
  };

  const handleChangePlan = (tier: SubscriptionTier) => {
    if (tier === currentTier) return;

    const targetTier = SUBSCRIPTION_TIERS[tier];
    const isUpgrade = targetTier.price > tierInfo.price;
    const hasStripeSubscription = !!profile?.stripe_customer_id;

    // New subscribers: create subscription directly via Edge Function
    if (!hasStripeSubscription && isUpgrade) {
      Alert.alert(
        `Subscribe to ${targetTier.name}`,
        `Start your 14-day free trial of ${targetTier.name} (${targetTier.priceFormatted}). No payment required during trial.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Free Trial',
            onPress: async () => {
              setLoading(tier);
              try {
                await callSubscriptionApi('create', tier);
                await refreshProfile();
                Alert.alert(
                  'Trial Started!',
                  `Your 14-day free trial of ${targetTier.name} has begun. You can add a payment method anytime before your trial ends.`
                );
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to start subscription. Please try again.');
              } finally {
                setLoading(null);
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      `${isUpgrade ? 'Upgrade' : 'Downgrade'} to ${targetTier.name}`,
      isUpgrade
        ? `You'll be charged ${targetTier.priceFormatted} starting immediately (prorated for this billing period).`
        : `Your plan will change to ${targetTier.name} at the end of your current billing period.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isUpgrade ? 'Upgrade' : 'Downgrade',
          onPress: async () => {
            setLoading(tier);
            try {
              await callSubscriptionApi(isUpgrade ? 'upgrade' : 'downgrade', tier);
              await refreshProfile();
              Alert.alert(
                'Plan Updated',
                isUpgrade
                  ? `You've been upgraded to ${targetTier.name}!`
                  : `Your plan will change to ${targetTier.name} at the end of your billing period.`
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update plan. Please try again.');
            } finally {
              setLoading(null);
            }
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
          onPress: async () => {
            setLoading('cancel');
            try {
              const result = await callSubscriptionApi('cancel');
              await refreshProfile();
              const endDate = result?.cancel_at
                ? new Date(result.cancel_at * 1000).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : 'the end of your billing period';
              Alert.alert(
                'Subscription Cancelled',
                `Your subscription will remain active until ${endDate}.`
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel subscription.');
            } finally {
              setLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleResume = async () => {
    setLoading('resume');
    try {
      await callSubscriptionApi('resume');
      await refreshProfile();
      Alert.alert('Subscription Resumed', 'Your subscription has been resumed.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resume subscription.');
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!profile?.stripe_customer_id) {
      Alert.alert(
        'No Active Subscription',
        'Subscribe to a plan first to access billing management.',
      );
      return;
    }
    setLoading('billing');
    try {
      const result = await callSubscriptionApi('get_portal_url');
      if (result?.url) {
        await WebBrowser.openBrowserAsync(result.url);
      } else {
        throw new Error('No billing portal URL returned');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to open billing portal.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current Plan */}
      <Card variant="elevated" style={styles.currentPlanCard}>
        <View style={styles.currentPlanHeader}>
          <Text style={styles.currentPlanLabel}>Current Plan</Text>
          <Badge
            label={currentStatus === 'trialing' ? 'Trial' : currentStatus === 'active' ? 'Active' : currentStatus === 'cancelled' ? 'Cancelled' : currentStatus}
            variant={currentStatus === 'active' ? 'success' : currentStatus === 'trialing' ? 'info' : 'warning'}
          />
        </View>
        <Text style={styles.currentPlanName}>{tierInfo.name}</Text>
        <Text style={styles.currentPlanPrice}>{tierInfo.priceFormatted}</Text>
        {currentStatus === 'trialing' && profile?.trial_ends_at && (
          <Text style={styles.trialEndText}>
            Trial ends {new Date(profile.trial_ends_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        )}
      </Card>

      {/* Trial — Add Payment Method */}
      {currentStatus === 'trialing' && (
        <Card style={styles.trialCard}>
          <Text style={styles.trialCardTitle}>Add a payment method</Text>
          <Text style={styles.trialCardText}>
            Add a card to keep using Casa after your free trial ends. You won't be charged until your trial is over.
          </Text>
          <Button
            title="Add Payment Method"
            onPress={() => router.push('/(app)/subscription/add-payment-method' as any)}
            style={styles.trialCardButton}
          />
        </Card>
      )}

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
        const isLoading = loading === tier;

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
                title={isLoading ? '' : (info.price > tierInfo.price ? 'Upgrade' : 'Downgrade')}
                onPress={() => handleChangePlan(tier)}
                style={styles.planButton}
                disabled={!!loading}
              />
            )}
            {isLoading && (
              <ActivityIndicator size="small" color={THEME.colors.brand} style={styles.planLoader} />
            )}
          </Card>
        );
      })}

      {/* Manage Billing */}
      <TouchableOpacity
        style={styles.actionLink}
        onPress={handleManageBilling}
        disabled={!!loading}
      >
        <Text style={styles.actionLinkText}>Manage Billing & Invoices</Text>
        {loading === 'billing' ? (
          <ActivityIndicator size="small" color={THEME.colors.brand} />
        ) : (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </TouchableOpacity>

      {/* Add-ons */}
      <TouchableOpacity
        style={styles.actionLink}
        onPress={() => router.push('/(app)/subscription/add-ons' as any)}
      >
        <Text style={styles.actionLinkText}>View Add-On Services</Text>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>

      {/* Cancel / Resume — only show if user has an active subscription */}
      {!profile?.stripe_customer_id ? null : currentStatus === 'cancelled' ? (
        <TouchableOpacity
          style={styles.resumeLink}
          onPress={handleResume}
          disabled={!!loading}
        >
          {loading === 'resume' ? (
            <ActivityIndicator size="small" color={THEME.colors.brand} />
          ) : (
            <Text style={styles.resumeText}>Resume subscription</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.cancelLink} onPress={handleCancel} disabled={!!loading}>
          {loading === 'cancel' ? (
            <ActivityIndicator size="small" color={THEME.colors.textTertiary} />
          ) : (
            <Text style={styles.cancelText}>Cancel subscription</Text>
          )}
        </TouchableOpacity>
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
  trialEndText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.info,
    marginTop: THEME.spacing.xs,
  },
  trialCard: {
    marginBottom: THEME.spacing.base,
    backgroundColor: THEME.colors.infoBg,
    borderWidth: 1,
    borderColor: THEME.colors.info + '30',
  },
  trialCardTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  trialCardText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.md,
  },
  trialCardButton: {
    alignSelf: 'flex-start' as const,
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
  planLoader: {
    marginTop: THEME.spacing.sm,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.base,
    marginTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  actionLinkText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  resumeLink: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
  },
  resumeText: {
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
