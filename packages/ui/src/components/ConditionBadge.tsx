import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { THEME } from '@casa/config';

export type ConditionRatingValue =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'damaged'
  | 'missing'
  | 'not_applicable';

export interface ConditionBadgeProps {
  condition: ConditionRatingValue | null;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

const CONDITION_CONFIG: Record<ConditionRatingValue, { label: string; color: string; bg: string }> = {
  excellent: { label: 'Excellent', color: THEME.colors.success, bg: THEME.colors.successBg },
  good: { label: 'Good', color: '#16A34A', bg: '#F0FDF4' },
  fair: { label: 'Fair', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  poor: { label: 'Poor', color: '#EA580C', bg: '#FFF7ED' },
  damaged: { label: 'Damaged', color: THEME.colors.error, bg: THEME.colors.errorBg },
  missing: { label: 'Missing', color: THEME.colors.error, bg: THEME.colors.errorBg },
  not_applicable: { label: 'N/A', color: THEME.colors.textTertiary, bg: THEME.colors.subtle },
};

export function ConditionBadge({ condition, size = 'small', style }: ConditionBadgeProps) {
  if (!condition) {
    return (
      <View style={[styles.badge, styles.unchecked, size === 'medium' && styles.badgeMedium, style]}>
        <Text style={[styles.text, styles.uncheckedText, size === 'medium' && styles.textMedium]}>
          Unchecked
        </Text>
      </View>
    );
  }

  const config = CONDITION_CONFIG[condition];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'medium' && styles.badgeMedium, style]}>
      <Text style={[styles.text, { color: config.color }, size === 'medium' && styles.textMedium]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  badgeMedium: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.xs,
  },
  text: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
  },
  textMedium: {
    fontSize: THEME.fontSize.bodySmall,
  },
  unchecked: {
    backgroundColor: THEME.colors.subtle,
  },
  uncheckedText: {
    color: THEME.colors.textTertiary,
  },
});
