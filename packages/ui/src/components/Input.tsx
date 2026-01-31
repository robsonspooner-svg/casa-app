import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { THEME } from '@casa/config';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

/**
 * Input Component - Casa Design System
 *
 * Height: 48px
 * Border Radius: 12px
 * Border: 1.5px solid #E5E5E5
 * Focus: border-color #0A0A0A
 * Error: border-color #DC2626
 *
 * Labels above, errors/hints below
 */
export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return THEME.colors.error;
    if (isFocused) return THEME.colors.borderFocus;
    return THEME.colors.border;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          { borderColor: getBorderColor() },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            inputStyle,
          ]}
          placeholderTextColor={THEME.colors.textTertiary}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
          {...textInputProps}
        />

        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>

      {(error || hint) && (
        <Text style={[styles.helperText, error ? styles.errorText : styles.hintText]}>
          {error || hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: THEME.components.input.height,
    borderRadius: THEME.components.input.borderRadius,
    borderWidth: THEME.components.input.borderWidth,
    backgroundColor: THEME.colors.surface,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: THEME.spacing.base,
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.regular,
    color: THEME.colors.textPrimary,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  leftIcon: {
    paddingLeft: THEME.spacing.base,
    paddingRight: THEME.spacing.sm,
  },
  rightIcon: {
    paddingRight: THEME.spacing.base,
    paddingLeft: THEME.spacing.sm,
  },
  helperText: {
    fontSize: THEME.fontSize.bodySmall,
    marginTop: THEME.spacing.sm,
  },
  errorText: {
    color: THEME.colors.error,
  },
  hintText: {
    color: THEME.colors.textTertiary,
  },
});
