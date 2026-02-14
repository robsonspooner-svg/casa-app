import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { THEME } from '@casa/config';
import { useAuth, useProfile, isSupabaseConfigured, getSupabaseClient } from '@casa/api';

export default function RootScreen() {
  const { isAuthenticated, loading, user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const router = useRouter();
  const roleFixAttempted = useRef(false);

  // Ensure tenant role is set for OAuth users who may have been
  // assigned 'owner' by default in the handle_new_user trigger
  useEffect(() => {
    if (!user || !profile || roleFixAttempted.current) return;
    if (profile.role !== 'tenant') {
      roleFixAttempted.current = true;
      const supabase = getSupabaseClient();
      (supabase.from('profiles') as ReturnType<typeof supabase.from>)
        .update({ role: 'tenant' })
        .eq('id', user.id)
        .then();
    }
  }, [user, profile]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace('/(app)/(tabs)' as never);
      return;
    }

    // Wait for auth and profile to finish loading
    if (loading || (isAuthenticated && profileLoading)) return;

    if (isAuthenticated) {
      // If profile failed to load (network error etc.), go straight to app
      // rather than incorrectly sending an established user through onboarding
      if (profileError && !profile) {
        router.replace('/(app)/(tabs)' as never);
        return;
      }

      if (!profile || !profile.onboarding_completed) {
        // Before sending to onboarding, check if user has tenancies.
        // If they do, they're an established user whose onboarding_completed
        // flag may be null/false due to a DB issue. Fix it and go to app.
        if (user) {
          const supabase = getSupabaseClient();
          Promise.resolve(
            supabase
              .from('tenancy_tenants')
              .select('id', { count: 'exact', head: true })
              .eq('tenant_id', user.id)
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

      router.replace('/(app)/(tabs)' as never);
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, loading, profile, profileLoading, profileError, user]);

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
