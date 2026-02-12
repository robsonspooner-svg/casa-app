import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { THEME } from '@casa/config';
import { useAuth, useProfile, isSupabaseConfigured } from '@casa/api';

export default function RootScreen() {
  const { isAuthenticated, loading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace('/(app)/(tabs)' as never);
      return;
    }

    // Wait for auth and profile to finish loading
    if (loading || (isAuthenticated && profileLoading)) return;

    if (isAuthenticated) {
      // Route to onboarding if profile is missing or onboarding incomplete
      if (!profile || !profile.onboarding_completed) {
        router.replace('/(app)/onboarding' as never);
      } else {
        router.replace('/(app)/(tabs)' as never);
      }
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, loading, profile, profileLoading]);

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
