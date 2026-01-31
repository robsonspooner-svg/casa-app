import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { THEME } from '@casa/config';
import { useAuth } from '@casa/api';

export default function AppLayout() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, loading]);

  if (loading || !isAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: THEME.colors.canvas,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="properties" />
      <Stack.Screen name="listings" />
      <Stack.Screen name="tenancies" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="arrears" />
      <Stack.Screen name="maintenance" />
      <Stack.Screen name="trades" />
      <Stack.Screen name="work-orders" />
      <Stack.Screen name="inspections" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="connections" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="autonomy" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.canvas,
  },
});
