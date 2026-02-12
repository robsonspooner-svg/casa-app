// VacancyBanner Component
// Deferred from Mission 04, implemented in Mission 06
// Shows when property status is 'vacant' after tenancy ends

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { useVacancyPrompt, Property } from '@casa/api';

interface VacancyBannerProps {
  property: Property;
  compact?: boolean;
}

export function VacancyBanner({ property, compact = false }: VacancyBannerProps) {
  const { isVacant, daysSinceVacant, canCreateListing, addOnAvailable } = useVacancyPrompt(property);

  if (!isVacant) return null;

  if (compact) {
    return (
      <View style={styles.compactBanner}>
        <View style={styles.compactDot} />
        <Text style={styles.compactText}>
          Vacant {daysSinceVacant > 0 ? `${daysSinceVacant}d` : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <View style={styles.bannerHeader}>
        <Text style={styles.bannerTitle}>Property Vacant</Text>
        {daysSinceVacant > 0 && (
          <Text style={styles.daysBadge}>{daysSinceVacant} days</Text>
        )}
      </View>

      {canCreateListing ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push(`/(app)/listings/create?propertyId=${property.id}` as any)}
        >
          <Text style={styles.primaryButtonText}>Create Listing with AI</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.starterActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/settings/subscription' as any)}
          >
            <Text style={styles.secondaryButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: THEME.colors.warningBg,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.warning + '40',
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.warning,
  },
  daysBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.warning,
    backgroundColor: THEME.colors.warning + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  primaryButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  starterActions: {
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.brand,
  },
  secondaryButtonText: {
    color: THEME.colors.brand,
    fontSize: 14,
    fontWeight: '600',
  },
  compactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.warning,
  },
  compactText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.warning,
  },
});
