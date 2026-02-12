import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { useAuth, useUnreadCount } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

function BellIcon({ size = 24, color = THEME.colors.textPrimary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface NotificationBellProps {
  size?: number;
  color?: string;
}

export function NotificationBell({ size = 24, color }: NotificationBellProps) {
  const { user } = useAuth();
  const { count } = useUnreadCount(user?.id);

  return (
    <Pressable
      onPress={() => router.push('/(app)/notifications' as never)}
      style={styles.container}
      hitSlop={8}
    >
      <BellIcon size={size} color={color || THEME.colors.textPrimary} />
      {count > 0 && (
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  badgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.error,
    borderWidth: 2,
    borderColor: THEME.colors.surface,
  },
});
