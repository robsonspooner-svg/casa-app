import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { THEME } from '@casa/config';
import { useAuth, isSupabaseConfigured } from '@casa/api';

export default function RootScreen() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If Supabase isn't configured, go directly to app (demo mode)
    if (!isSupabaseConfigured()) {
      router.replace('/(app)/(tabs)' as any);
      return;
    }

    // Wait for auth to finish loading
    if (loading) return;

    // Redirect based on auth state
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
