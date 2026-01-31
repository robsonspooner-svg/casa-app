import React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { THEME } from '@casa/config';

export interface AvatarProps {
  source?: { uri: string } | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle | ImageStyle;
}

/**
 * Avatar Component - Casa Design System
 *
 * Sizes:
 * - sm: 32px (compact lists)
 * - md: 40px (list items)
 * - lg: 64px (profile headers)
 * - xl: 80px (profile detail)
 *
 * Fallback: Initials on subtle background
 * Border Radius: 9999px (circle)
 */
export function Avatar({
  source,
  name,
  size = 'md',
  style,
}: AvatarProps) {
  const dimensions = SIZES[size];
  const initials = getInitials(name);

  if (source?.uri) {
    return (
      <Image
        source={source}
        style={[
          styles.image,
          { width: dimensions, height: dimensions, borderRadius: dimensions / 2 },
          style as ImageStyle,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: dimensions, height: dimensions, borderRadius: dimensions / 2 },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: dimensions * 0.4 }]}>
        {initials}
      </Text>
    </View>
  );
}

const SIZES = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 80,
};

function getInitials(name?: string): string {
  if (!name) return '?';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: THEME.colors.subtle,
  },
  fallback: {
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: THEME.colors.textSecondary,
    fontWeight: THEME.fontWeight.semibold,
  },
});
