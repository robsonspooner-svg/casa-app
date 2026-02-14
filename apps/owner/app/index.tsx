import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '@casa/config';
import { useAuth, useProfile, isSupabaseConfigured, getSupabaseClient } from '@casa/api';

const TOUR_SEEN_KEY = 'casa_tour_seen';

export default function RootScreen() {
  const { isAuthenticated, loading, user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
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
      // If profile failed to load (network error etc.), go straight to app
      // rather than incorrectly sending an established user through onboarding
      if (profileError && !profile) {
        router.replace('/(app)/(tabs)' as never);
        return;
      }

      if (!profile || !profile.onboarding_completed) {
        // Before sending to onboarding, check if user has properties.
        // If they do, they're an established user whose onboarding_completed
        // flag may be null/false due to a DB issue. Fix it and go to app.
        if (user) {
          const supabase = getSupabaseClient();
          Promise.resolve(
            supabase
              .from('properties')
              .select('id', { count: 'exact', head: true })
              .eq('owner_id', user.id)
              .is('deleted_at', null)
          )
            .then(({ count }) => {
              if (count && count > 0) {
                (supabase.from('profiles') as any)
                  .update({ onboarding_completed: true })
                  .eq('id', user.id)
                  .then(() => {});
                router.replace('/(app)/(tabs)' as never);
              } else {
                router.replace('/(app)/onboarding' as never);
              }
            })
            .catch(() => {
              router.replace('/(app)/onboarding' as never);
            });
          return;
        }
        router.replace('/(app)/onboarding' as never);
        return;
      }

      // Profile exists and onboarding is complete.
      // If AsyncStorage lost the tour flag (e.g. new TestFlight build),
      // skip the tour — the user has already onboarded.
      if (!tourSeen) {
        AsyncStorage.setItem(TOUR_SEEN_KEY, 'true').catch(() => {});
      }
      router.replace('/(app)/(tabs)' as never);
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, loading, profile, profileLoading, profileError, tourChecked, tourSeen, user]);

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
