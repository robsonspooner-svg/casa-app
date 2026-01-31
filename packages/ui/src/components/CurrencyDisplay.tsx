import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { THEME } from '@casa/config';

export interface CurrencyDisplayProps {
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  showSign?: boolean;
  style?: ViewStyle;
}

export function CurrencyDisplay({
  amount,
  currency = 'AUD',
  size = 'md',
  color,
  showSign = false,
  style,
}: CurrencyDisplayProps) {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const dollars = Math.floor(absAmount);
  const cents = Math.round((absAmount - dollars) * 100);

  const textColor = color || (isNegative ? THEME.colors.error : THEME.colors.textPrimary);
  const sizeStyles = SIZE_MAP[size];

  const sign = showSign ? (isNegative ? '-' : '+') : (isNegative ? '-' : '');

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.symbol, sizeStyles.symbol, { color: textColor }]}>
        {sign}$
      </Text>
      <Text style={[styles.dollars, sizeStyles.dollars, { color: textColor }]}>
        {dollars.toLocaleString()}
      </Text>
      <Text style={[styles.cents, sizeStyles.cents, { color: textColor }]}>
        .{cents.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

const SIZE_MAP = {
  sm: {
    symbol: { fontSize: THEME.fontSize.bodySmall } as TextStyle,
    dollars: { fontSize: THEME.fontSize.body } as TextStyle,
    cents: { fontSize: THEME.fontSize.bodySmall } as TextStyle,
  },
  md: {
    symbol: { fontSize: THEME.fontSize.body } as TextStyle,
    dollars: { fontSize: THEME.fontSize.h2 } as TextStyle,
    cents: { fontSize: THEME.fontSize.body } as TextStyle,
  },
  lg: {
    symbol: { fontSize: THEME.fontSize.h3 } as TextStyle,
    dollars: { fontSize: THEME.fontSize.h1 } as TextStyle,
    cents: { fontSize: THEME.fontSize.h3 } as TextStyle,
  },
  xl: {
    symbol: { fontSize: THEME.fontSize.h2 } as TextStyle,
    dollars: { fontSize: THEME.fontSize.display } as TextStyle,
    cents: { fontSize: THEME.fontSize.h2 } as TextStyle,
  },
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  symbol: {
    fontWeight: THEME.fontWeight.medium,
  },
  dollars: {
    fontWeight: THEME.fontWeight.bold,
  },
  cents: {
    fontWeight: THEME.fontWeight.medium,
  },
});
