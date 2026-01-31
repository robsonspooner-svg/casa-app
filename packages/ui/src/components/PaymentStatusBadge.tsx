import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { THEME } from '@casa/config';

export type PaymentStatusType = 'scheduled' | 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentStatusBadgeProps {
  status: PaymentStatusType;
  style?: ViewStyle;
}

const STATUS_CONFIG: Record<PaymentStatusType, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: 'SCHEDULED', color: '#6366F1', bgColor: '#EEF2FF' },
  pending: { label: 'PENDING', color: THEME.colors.warning, bgColor: THEME.colors.warningBg },
  completed: { label: 'PAID', color: THEME.colors.success, bgColor: THEME.colors.successBg },
  failed: { label: 'FAILED', color: THEME.colors.error, bgColor: THEME.colors.errorBg },
  cancelled: { label: 'CANCELLED', color: THEME.colors.textSecondary, bgColor: THEME.colors.subtle },
  refunded: { label: 'REFUNDED', color: THEME.colors.info, bgColor: THEME.colors.infoBg },
};

export function PaymentStatusBadge({ status, style }: PaymentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <View style={[styles.badge, { backgroundColor: config.bgColor }, style]}>
      <Text style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

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
    letterSpacing: 0.55,
  },
});
