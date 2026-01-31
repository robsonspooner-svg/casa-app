import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { THEME } from '@casa/config';

export interface CasaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'compact' | 'wordmark';
  color?: 'dark' | 'light';
  style?: TextStyle;
}

/**
 * CasaLogo Component - Casa Design System
 *
 * Primary Logo: Casa
 * Compact: C
 * Wordmark: casa
 *
 * Font: SF Pro or system default
 * Weight: Bold (700)
 * Letter-spacing: -0.02em
 *
 * Colors:
 * - dark: Casa Navy #1B1464 (on light backgrounds)
 * - light: #FAFAFA (on dark backgrounds)
 */
export function CasaLogo({
  size = 'md',
  variant = 'full',
  color = 'dark',
  style,
}: CasaLogoProps) {
  const fontSize = SIZES[size];
  const textColor = color === 'dark' ? THEME.colors.brand : THEME.colors.textInverse;

  const getText = () => {
    switch (variant) {
      case 'compact':
        return 'C';
      case 'wordmark':
        return 'casa';
      default:
        return 'Casa';
    }
  };

  return (
    <Text
      style={[
        styles.logo,
        { fontSize, color: textColor },
        style,
      ]}
    >
      {getText()}
    </Text>
  );
}

const SIZES = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

const styles = StyleSheet.create({
  logo: {
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
    fontWeight: THEME.fontWeight.bold,
    letterSpacing: -0.48, // -0.02em at 24px base
  },
});
