import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { THEME } from '@casa/config';
import { lightTap } from '../utils/haptics';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'elevated';
}

/**
 * Card Component - Casa Design System
 *
 * Cards float above the canvas (#FAFAFA) with white background (#FFFFFF)
 *
 * Default: Standard shadow (sm)
 * Elevated: Larger shadow (lg) for primary actions
 *
 * Border Radius: 16px
 * Padding: 16px
 * Shadow: Soft, not harsh borders
 */
export function Card({
  children,
  title,
  subtitle,
  onPress,
  style,
  variant = 'default',
}: CardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    lightTap();
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: THEME.animation.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: THEME.animation.fast,
      useNativeDriver: true,
    }).start();
  };

  const content = (
    <View style={[styles.base, variant === 'elevated' ? styles.elevated : styles.default, style]}>
      {(title || subtitle) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
      <View style={title || subtitle ? styles.contentWithHeader : undefined}>
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          {content}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: THEME.components.card.borderRadius,
    backgroundColor: THEME.colors.surface,
    padding: THEME.components.card.padding,
    overflow: 'hidden',
  },
  default: {
    ...THEME.shadow.sm,
  },
  elevated: {
    ...THEME.shadow.lg,
  },
  header: {
    marginBottom: THEME.spacing.md,
  },
  title: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  contentWithHeader: {
    // No additional styles needed, just semantic separation
  },
});
