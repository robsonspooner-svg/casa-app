import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useToast } from '@casa/ui';
import { useProfile, useAuth, SUBSCRIPTION_TIERS, getSupabaseClient } from '@casa/api';
import type { SubscriptionTier } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CrownIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M2 20h20M4 20V10l4 4 4-8 4 8 4-4v10" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ExternalLinkIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_ORDER: SubscriptionTier[] = ['starter', 'pro', 'hands_off'];

function getTierIndex(tier: SubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  const toast = useToast();
  const [actionLoading, setActionLoading] = useState(false);

  const currentTier = profile?.subscription_tier || 'starter';
  const subscriptionStatus = profile?.subscription_status || 'active';
  const isCancelled = subscriptionStatus === 'cancelled';
  const isTrialing = subscriptionStatus === 'trialing';

  const callManageSubscription = useCallback(async (
    action: string,
    tier?: SubscriptionTier,
  ): Promise<Record<string, unknown> | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/manage-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action, tier }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Request failed');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', message);
      return null;
    }
  }, []);

  const handleChangePlan = useCallback(async (tier: SubscriptionTier) => {
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const currentIndex = getTierIndex(currentTier);
    const newIndex = getTierIndex(tier);
    const isUpgrade = newIndex > currentIndex;
    const action = isUpgrade ? 'upgrade' : 'downgrade';

    Alert.alert(
      `${isUpgrade ? 'Upgrade' : 'Downgrade'} to ${tierInfo.name}?`,
      isUpgrade
        ? `You'll be charged a prorated amount for the remainder of this billing period. Your new rate will be ${tierInfo.priceFormatted}.`
        : `Your plan will change to ${tierInfo.name} (${tierInfo.priceFormatted}) at the end of your current billing period.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isUpgrade ? 'Upgrade' : 'Downgrade',
          onPress: async () => {
            setActionLoading(true);
            const result = await callManageSubscription(action, tier);
            if (result?.success) {
              await refreshProfile();
              toast.success(`Your plan has been changed to ${tierInfo.name}.`);
            }
            setActionLoading(false);
          },
        },
      ],
    );
  }, [currentTier, callManageSubscription, refreshProfile]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Subscription',
      'Your subscription will remain active until the end of your current billing period. After that, you will lose access to premium features.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await callManageSubscription('cancel');
            if (result?.success) {
              await refreshProfile();
              toast.success('Subscription cancelled. It remains active until the end of your billing period.');
            }
            setActionLoading(false);
          },
        },
      ],
    );
  }, [callManageSubscription, refreshProfile]);

  const handleResume = useCallback(async () => {
    setActionLoading(true);
    const result = await callManageSubscription('resume');
    if (result?.success) {
      await refreshProfile();
      toast.success('Your subscription has been reactivated.');
    }
    setActionLoading(false);
  }, [callManageSubscription, refreshProfile]);

  const handleBillingPortal = useCallback(async () => {
    setActionLoading(true);
    const result = await callManageSubscription('get_portal_url');
    setActionLoading(false);

    if (result?.url && typeof result.url === 'string') {
      await Linking.openURL(result.url);
    } else if (result) {
      toast.error('Unable to open billing portal. Please try again.');
    }
  }, [callManageSubscription]);

  if (profileLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Subscription</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Current Plan Banner */}
        <View style={styles.currentPlanBanner}>
          <View style={styles.currentPlanHeader}>
            <CrownIcon />
            <Text style={styles.currentPlanLabel}>Current Plan</Text>
          </View>
          <Text style={styles.currentPlanName}>{SUBSCRIPTION_TIERS[currentTier].name}</Text>
          <Text style={styles.currentPlanPrice}>{SUBSCRIPTION_TIERS[currentTier].priceFormatted}</Text>

          {isTrialing && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>
                Trial ends {formatDate(profile?.trial_ends_at ?? null)}
              </Text>
            </View>
          )}

          {isCancelled && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledBadgeText}>Cancelled - Active until period end</Text>
            </View>
          )}

          {!isCancelled && !isTrialing && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>

        {/* Plan Options */}
        <Text style={styles.sectionTitle}>Plans</Text>
        {TIER_ORDER.map((tierId) => {
          const tier = SUBSCRIPTION_TIERS[tierId];
          const isCurrent = tierId === currentTier;
          const isHigher = getTierIndex(tierId) > getTierIndex(currentTier);

          return (
            <View
              key={tierId}
              style={[styles.planCard, isCurrent && styles.planCardCurrent]}
            >
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>{tier.name}</Text>
                  <Text style={styles.planPrice}>{tier.priceFormatted}</Text>
                </View>
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
              </View>

              <View style={styles.featuresList}>
                {tier.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <CheckIcon color={isCurrent ? THEME.colors.brand : THEME.colors.textSecondary} />
                    <Text style={[styles.featureText, isCurrent && styles.featureTextCurrent]}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              {!isCurrent && !isCancelled && (
                <Pressable
                  style={[styles.planButton, isHigher ? styles.planButtonUpgrade : styles.planButtonDowngrade]}
                  onPress={() => handleChangePlan(tierId)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={THEME.colors.textInverse} />
                  ) : (
                    <Text style={[styles.planButtonText, !isHigher && styles.planButtonTextDowngrade]}>
                      {isHigher ? 'Upgrade' : 'Downgrade'}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Billing Actions */}
        <Text style={styles.sectionTitle}>Billing</Text>
        <View style={styles.card}>
          <Pressable
            onPress={handleBillingPortal}
            style={[styles.actionRow, styles.borderBottom]}
            disabled={actionLoading}
          >
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Manage Billing</Text>
              <Text style={styles.actionDescription}>
                View invoices, update payment method
              </Text>
            </View>
            <ExternalLinkIcon />
          </Pressable>

          {isCancelled ? (
            <Pressable
              onPress={handleResume}
              style={styles.actionRow}
              disabled={actionLoading}
            >
              <View style={styles.actionContent}>
                <Text style={[styles.actionLabel, { color: THEME.colors.brand }]}>
                  Resume Subscription
                </Text>
                <Text style={styles.actionDescription}>
                  Reactivate your subscription
                </Text>
              </View>
              {actionLoading && <ActivityIndicator size="small" color={THEME.colors.brand} />}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleCancel}
              style={styles.actionRow}
              disabled={actionLoading}
            >
              <View style={styles.actionContent}>
                <Text style={[styles.actionLabel, { color: THEME.colors.error }]}>
                  Cancel Subscription
                </Text>
                <Text style={styles.actionDescription}>
                  Cancel at end of billing period
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Current plan banner
  currentPlanBanner: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: THEME.colors.brand,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  currentPlanLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentPlanName: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  currentPlanPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.brand,
    marginTop: 2,
  },
  trialBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.infoBg,
  },
  trialBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.info,
  },
  cancelledBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.errorBg,
  },
  cancelledBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.error,
  },
  activeBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.successBg,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.success,
  },

  // Section
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },

  // Plan cards
  planCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  planCardCurrent: {
    borderColor: THEME.colors.brand,
    borderWidth: 2,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  planPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  currentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.brand + '14',
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.brand,
  },
  featuresList: {
    gap: 8,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  featureTextCurrent: {
    color: THEME.colors.textPrimary,
    fontWeight: '500',
  },
  planButton: {
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    marginTop: 4,
  },
  planButtonUpgrade: {
    backgroundColor: THEME.colors.brand,
  },
  planButtonDowngrade: {
    backgroundColor: THEME.colors.subtle,
  },
  planButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },
  planButtonTextDowngrade: {
    color: THEME.colors.textSecondary,
  },

  // Billing actions
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  actionDescription: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
});
