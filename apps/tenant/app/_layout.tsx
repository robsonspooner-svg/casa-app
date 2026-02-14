import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '@casa/config';
import { initializeSupabase, getSupabaseClient, AuthProvider, AgentProvider } from '@casa/api';
import NotificationProvider from '../components/NotificationProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Initialize Supabase with environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  initializeSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default function RootLayout() {
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

      // Handle invite deep links (e.g. casa-tenant://invite?code=ABC123)
      if (url.includes('invite')) {
        const queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
          const query = url.substring(queryIndex + 1);
          const params = new URLSearchParams(query);
          const code = params.get('code');
          if (code) {
            AsyncStorage.setItem('casa_invite_code', code.toUpperCase()).catch(() => {});
          }
        }
        return;
      }

      // Handle email verification and password reset deep links
      // (e.g. casa-tenant://auth/verify#access_token=...&refresh_token=...)
      if (url.includes('auth/verify') || url.includes('auth/reset') || url.includes('auth/callback')) {
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
