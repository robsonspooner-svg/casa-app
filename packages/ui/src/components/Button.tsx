import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import { THEME } from '@casa/config';
import { lightTap } from '../utils/haptics';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * Button Component - Casa Design System
 *
 * Primary: Casa Black background, inverse text
 * Secondary: Transparent with border
 * Text: No background, just text
 *
 * Height: 48px (touch-friendly)
 * Border Radius: 12px
 * Font: 15px, semibold (600)
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  fullWidth = true,
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    lightTap();
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: THEME.animation.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: THEME.animation.fast,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && styles.fullWidth]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[
          styles.base,
          styles[variant],
          isDisabled && styles.disabled,
          style,
        ]}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? THEME.colors.textInverse : THEME.colors.brand}
          />
        ) : (
          <Text
            style={[
              styles.buttonText,
              styles[`text_${variant}`],
              textStyle,
            ]}
          >
            {title}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    height: THEME.components.button.height,
    borderRadius: THEME.components.button.borderRadius,
    paddingHorizontal: THEME.components.button.paddingHorizontal,
  },
  fullWidth: {
    width: '100%',
  },
  // Primary: Casa Black background
  primary: {
    backgroundColor: THEME.colors.brand,
  },
  // Secondary: Transparent with border
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  // Text: No background
  text: {
    backgroundColor: 'transparent',
    height: 'auto' as unknown as number,
    paddingHorizontal: 0,
  },
  disabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontWeight: THEME.fontWeight.semibold,
    fontSize: THEME.fontSize.body,
  },
  text_primary: {
    color: THEME.colors.textInverse,
  },
  text_secondary: {
    color: THEME.colors.textPrimary,
  },
  text_text: {
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
});
