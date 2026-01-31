import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

export interface ContactButtonProps {
  type: 'phone' | 'email';
  value: string;
  label?: string;
  containerStyle?: ViewStyle;
}

export function ContactButton({ type, value, label, containerStyle }: ContactButtonProps) {
  const handlePress = () => {
    if (type === 'phone') {
      Linking.openURL(`tel:${value}`);
    } else {
      Linking.openURL(`mailto:${value}`);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {type === 'phone' ? (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
            stroke={THEME.colors.brand}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
            stroke={THEME.colors.brand}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M22 6l-10 7L2 6"
            stroke={THEME.colors.brand}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      <Text style={styles.label}>{label || value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.base,
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    gap: THEME.spacing.sm,
    minHeight: 44,
  },
  label: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
});
