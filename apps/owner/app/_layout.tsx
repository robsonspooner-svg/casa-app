import { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { THEME } from '@casa/config';
import { initializeSupabase, getSupabaseClient, AuthProvider, AgentProvider } from '@casa/api';
import NotificationProvider from '../components/NotificationProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Initialize Supabase with environment variables
// These should be set in .env.local for local development
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize on module load
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  initializeSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default function RootLayout() {
  // Check for OTA updates on launch and apply immediately if available
  useEffect(() => {
    async function checkForUpdates() {
      try {
        if (!Updates.isEnabled) return;
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Silently handle update check failures
      }
    }
    checkForUpdates();
  }, []);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn(
        'Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local'
      );
      return;
    }

    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      if (!url) return;

      // Handle OAuth, email verification, and password reset deep links
      if (url.includes('auth/callback') || url.includes('auth/verify') || url.includes('auth/reset')) {
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return;

        const hash = url.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const supabase = getSupabaseClient();
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    };

    // Handle deep links when app is already running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle cold-start deep links
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    }).catch(() => {
      // Silently handle getInitialURL failures — not critical
    });

    return () => subscription.remove();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AgentProvider>
            <NotificationProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: THEME.colors.canvas,
                  },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </NotificationProvider>
          </AgentProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
