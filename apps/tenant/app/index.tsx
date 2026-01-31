import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { useAuth, isSupabaseConfigured } from '@casa/api';

export default function RootScreen() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace('/(app)/(tabs)' as any);
      return;
    }

    if (loading) return;

    if (isAuthenticated) {
      router.replace('/(app)/(tabs)' as any);
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, loading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={THEME.colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.canvas,
  },
});
