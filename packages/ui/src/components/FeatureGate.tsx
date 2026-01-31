import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import type { SubscriptionTier } from '@casa/config';

export interface FeatureGateProps {
  hasAccess: boolean;
  requiredTier: SubscriptionTier | null;
  featureName: string;
  featureDescription?: string;
  onUpgrade?: () => void;
  children: ReactNode;
}

/**
 * Wraps content that requires a specific subscription tier.
 * Shows the content if the user has access, or an upgrade prompt otherwise.
 */
export function FeatureGate({
  hasAccess,
  requiredTier,
  featureName,
  featureDescription,
  onUpgrade,
  children,
}: FeatureGateProps) {
  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <UpgradePrompt
      requiredTier={requiredTier}
      featureName={featureName}
      featureDescription={featureDescription}
      onUpgrade={onUpgrade}
    />
  );
}

export interface UpgradePromptProps {
  requiredTier: SubscriptionTier | null;
  featureName: string;
  featureDescription?: string;
  onUpgrade?: () => void;
  compact?: boolean;
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  hands_off: 'Hands-Off',
};

/**
 * Shows a prompt to upgrade to a higher tier.
 * Displays the feature benefit and a CTA button.
 */
export function UpgradePrompt({
  requiredTier,
  featureName,
  featureDescription,
  onUpgrade,
  compact = false,
}: UpgradePromptProps) {
  const tierLabel = requiredTier ? TIER_LABELS[requiredTier] : 'a higher';

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onUpgrade}
        activeOpacity={0.8}
      >
        <Text style={styles.compactText}>
          Upgrade to {tierLabel} for {featureName}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"
            stroke={THEME.colors.textSecondary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={styles.title}>{featureName}</Text>
      {featureDescription && (
        <Text style={styles.description}>{featureDescription}</Text>
      )}
      <TouchableOpacity
        style={styles.upgradeButton}
        onPress={onUpgrade}
        activeOpacity={0.8}
      >
        <Text style={styles.upgradeButtonText}>
          Upgrade to {tierLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.components.card.borderRadius,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadow.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  title: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
    textAlign: 'center',
  },
  description: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.base,
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.components.button.borderRadius,
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.sm,
  },
  upgradeButtonText: {
    color: THEME.colors.textInverse,
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
  },
  compactContainer: {
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.sm,
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
    alignItems: 'center',
  },
  compactText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
});
