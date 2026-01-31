import { useMemo } from 'react';
import { TIER_FEATURES, type SubscriptionTier } from '@casa/config';
import type { Profile } from '../types/database';

export type FeatureKey = keyof typeof TIER_FEATURES.starter;

export interface FeatureGateResult {
  hasAccess: boolean;
  currentTier: SubscriptionTier;
  requiredTier: SubscriptionTier | null;
  featureValue: string | number | boolean;
}

/**
 * Determines the minimum tier required for a given feature.
 * Returns null if no tier provides the feature.
 */
function getRequiredTier(feature: FeatureKey): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ['starter', 'pro', 'hands_off'];
  for (const tier of tiers) {
    const value = TIER_FEATURES[tier][feature];
    if (value === true || (typeof value === 'string' && value !== 'basic') || (typeof value === 'number' && value > 0)) {
      return tier;
    }
  }
  return null;
}

/**
 * Hook to check if the current user's subscription tier grants access to a feature.
 *
 * Usage:
 * ```tsx
 * const { hasAccess, requiredTier } = useFeatureGate(profile, 'tenantFinding');
 * if (!hasAccess) {
 *   return <UpgradePrompt requiredTier={requiredTier} feature="tenantFinding" />;
 * }
 * ```
 */
export function useFeatureGate(
  profile: Profile | null,
  feature: FeatureKey,
): FeatureGateResult {
  return useMemo(() => {
    const currentTier: SubscriptionTier = profile?.subscription_tier ?? 'starter';
    const featureValue = TIER_FEATURES[currentTier][feature];

    // Boolean features: true = has access
    if (typeof featureValue === 'boolean') {
      return {
        hasAccess: featureValue,
        currentTier,
        requiredTier: featureValue ? null : getRequiredTier(feature),
        featureValue,
      };
    }

    // String features: 'full' = has access, 'basic' = limited
    if (typeof featureValue === 'string') {
      return {
        hasAccess: featureValue === 'full',
        currentTier,
        requiredTier: featureValue === 'full' ? null : getRequiredTier(feature),
        featureValue,
      };
    }

    // Number features (maxProperties): Infinity = unlimited
    return {
      hasAccess: featureValue === Infinity || featureValue > 0,
      currentTier,
      requiredTier: null,
      featureValue,
    };
  }, [profile?.subscription_tier, feature]);
}

/**
 * Simple utility to check feature access without React hooks.
 * Useful in non-component contexts.
 */
export function checkFeatureAccess(
  tier: SubscriptionTier,
  feature: FeatureKey,
): boolean {
  const value = TIER_FEATURES[tier][feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'full';
  return value === Infinity || value > 0;
}
