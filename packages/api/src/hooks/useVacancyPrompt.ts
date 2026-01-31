// useVacancyPrompt Hook - Vacancy Detection
// Deferred from Mission 04, implemented in Mission 06

import { useMemo } from 'react';
import { useProfile } from './useProfile';
import { checkFeatureAccess } from './useFeatureGate';
import type { Property, Tenancy, SubscriptionTier } from '../types/database';

export interface VacancyPrompt {
  isVacant: boolean;
  daysSinceVacant: number;
  canCreateListing: boolean;
  addOnAvailable: boolean;
  previousTenancy?: Tenancy;
}

export function useVacancyPrompt(property: Property | null): VacancyPrompt {
  const { profile } = useProfile();

  return useMemo(() => {
    if (!property || property.status !== 'vacant') {
      return {
        isVacant: false,
        daysSinceVacant: 0,
        canCreateListing: false,
        addOnAvailable: false,
      };
    }

    const vacantSince = (property as any).vacant_since;
    const daysSinceVacant = vacantSince
      ? Math.max(0, Math.ceil((Date.now() - new Date(vacantSince).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const tier: SubscriptionTier = profile?.subscription_tier ?? 'starter';
    const canCreateListing = checkFeatureAccess(tier, 'tenantFinding');
    const addOnAvailable = !canCreateListing;

    return {
      isVacant: true,
      daysSinceVacant,
      canCreateListing,
      addOnAvailable,
    };
  }, [property, profile?.subscription_tier]);
}
