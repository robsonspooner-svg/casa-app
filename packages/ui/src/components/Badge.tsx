import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { THEME } from '@casa/config';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

/**
 * Badge/StatusPill Component - Casa Design System
 *
 * Border Radius: 9999px (pill)
 * Padding: 4px 12px
 * Font: 11px, 500 weight, uppercase
 * Letter Spacing: 0.05em
 *
 * Variants:
 * - success: green
 * - warning: amber
 * - error: red
 * - info: blue
 * - neutral: gray
 */
export function Badge({
  label,
  variant = 'neutral',
  style,
}: BadgeProps) {
  const colors = VARIANT_COLORS[variant];

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const VARIANT_COLORS = {
  success: {
    bg: THEME.colors.successBg,
    text: THEME.colors.success,
  },
  warning: {
    bg: THEME.colors.warningBg,
    text: THEME.colors.warning,
  },
  error: {
    bg: THEME.colors.errorBg,
    text: THEME.colors.error,
  },
  info: {
    bg: THEME.colors.infoBg,
    text: THEME.colors.info,
  },
  neutral: {
    bg: THEME.colors.subtle,
    text: THEME.colors.textSecondary,
  },
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    letterSpacing: 0.55, // 0.05em at 11px
  },
});
