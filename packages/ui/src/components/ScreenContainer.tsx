import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';

export interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * ScreenContainer Component - Casa Design System
 *
 * Handles:
 * - Canvas background (#FAFAFA)
 * - Safe area insets
 * - Standard horizontal padding (16px)
 * - Scroll behavior
 *
 * Every screen should be wrapped in this component.
 */
export function ScreenContainer({
  children,
  scrollable = true,
  padded = true,
  style,
  contentContainerStyle,
  refreshing,
  onRefresh,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    style,
  ];

  const contentStyle = [
    padded && styles.padded,
    contentContainerStyle,
  ];

  if (scrollable) {
    return (
      <View style={containerStyle}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.canvas} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing ?? false}
                onRefresh={onRefresh}
                tintColor={THEME.colors.brand}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[containerStyle, contentStyle]}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.canvas} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  scrollView: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.lg,
  },
});
