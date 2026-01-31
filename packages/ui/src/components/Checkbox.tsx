import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

export function Checkbox({ checked, onChange, label, disabled, containerStyle }: CheckboxProps) {
  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={() => !disabled && onChange(!checked)}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[
        styles.box,
        checked && styles.boxChecked,
        disabled && styles.boxDisabled,
      ]}>
        {checked && (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 6L9 17l-5-5"
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>
      {label && (
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  boxDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    marginLeft: THEME.spacing.md,
    flex: 1,
  },
  labelDisabled: {
    color: THEME.colors.textTertiary,
  },
});
