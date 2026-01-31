import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

export function Chip({ label, selected, onPress, onRemove, disabled, containerStyle }: ChipProps) {
  const content = (
    <View style={[
      styles.container,
      selected && styles.containerSelected,
      disabled && styles.containerDisabled,
      containerStyle,
    ]}>
      <Text style={[
        styles.label,
        selected && styles.labelSelected,
      ]}>{label}</Text>
      {onRemove && selected && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke={THEME.colors.surface}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  containerSelected: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
  removeButton: {
    marginLeft: THEME.spacing.xs,
  },
});
