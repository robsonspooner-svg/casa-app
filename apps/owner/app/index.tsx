import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '@casa/config';
import { useAuth, useProfile, isSupabaseConfigured } from '@casa/api';

const TOUR_SEEN_KEY = 'casa_tour_seen';

export default function RootScreen() {
  const { isAuthenticated, loading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const [tourChecked, setTourChecked] = useState(false);
  const [tourSeen, setTourSeen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_SEEN_KEY)
      .then((val) => {
        setTourSeen(val === 'true');
        setTourChecked(true);
      })
      .catch(() => {
        setTourChecked(true);
      });
  }, []);

  useEffect(() => {
    // If Supabase isn't configured, go directly to app (demo mode)
    if (!isSupabaseConfigured()) {
      router.replace('/(app)/(tabs)' as never);
      return;
    }

    // Wait for auth, profile, and tour check to finish loading
    if (loading || (isAuthenticated && profileLoading) || !tourChecked) return;

    // Redirect based on auth state
    if (isAuthenticated) {
      // Check if user has completed onboarding — route to onboarding if
      // profile is missing (not yet created) or onboarding is incomplete
      if (!profile || !profile.onboarding_completed) {
        router.replace('/(app)/onboarding' as never);
      } else if (!tourSeen) {
        router.replace('/(app)/onboarding/tour' as never);
      } else {
        router.replace('/(app)/(tabs)' as never);
      }
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, loading, profile, profileLoading, tourChecked, tourSeen]);

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
