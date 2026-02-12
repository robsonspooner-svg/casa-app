import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getSupabaseClient } from '../client';
import type { PushTokenPlatform } from '../types/database';

// Lazy-import Platform to avoid pulling in react-native at module level
// (breaks Vitest/Rollup which can't parse Flow-typed RN index.js)
let _Platform: { OS: string; Version: string | number } | null = null;
function getPlatform(): { OS: string; Version: string | number } {
  if (!_Platform) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _Platform = require('react-native').Platform;
    } catch {
      _Platform = { OS: 'web', Version: '0' };
    }
  }
  return _Platform!;
}

export interface UsePushTokenReturn {
  token: string | null;
  registered: boolean;
  registering: boolean;
  error: string | null;
  registerToken: (expoPushToken: string) => Promise<void>;
  unregisterToken: () => Promise<void>;
}

export function usePushToken(userId: string | undefined): UsePushTokenReturn {
  const [token, setToken] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const supabase = useMemo(() => {
    try { return getSupabaseClient(); } catch { return null; }
  }, []);

  const platform: PushTokenPlatform = useMemo(() => {
    const Platform = getPlatform();
    if (Platform.OS === 'ios') return 'ios';
    if (Platform.OS === 'android') return 'android';
    return 'web';
  }, []);

  // Check if user already has a token registered
  useEffect(() => {
    if (!supabase || !userId) return;

    (async () => {
      const { data } = await (supabase
        .from('push_tokens') as any)
        .select('token')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('platform', platform)
        .limit(1)
        .maybeSingle();

      if (data) {
        setToken((data as { token: string }).token);
        tokenRef.current = (data as { token: string }).token;
        setRegistered(true);
      }
    })();
  }, [supabase, userId, platform]);

  const registerToken = useCallback(async (expoPushToken: string) => {
    if (!supabase || !userId) return;
    try {
      setRegistering(true);
      setError(null);

      // Upsert: if this token already exists, reactivate it for this user
      const { error: err } = await (supabase
        .from('push_tokens') as any)
        .upsert(
          {
            user_id: userId,
            token: expoPushToken,
            platform,
            is_active: true,
            last_used_at: new Date().toISOString(),
            device_info: {
              os: getPlatform().OS,
              version: String(getPlatform().Version),
            },
          },
          { onConflict: 'token' }
        );

      if (err) throw err;

      setToken(expoPushToken);
      tokenRef.current = expoPushToken;
      setRegistered(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to register push token');
    } finally {
      setRegistering(false);
    }
  }, [supabase, userId, platform]);

  const unregisterToken = useCallback(async () => {
    if (!supabase || !tokenRef.current) return;
    try {
      setError(null);

      const { error: err } = await (supabase
        .from('push_tokens') as any)
        .update({ is_active: false })
        .eq('token', tokenRef.current);

      if (err) throw err;

      setToken(null);
      tokenRef.current = null;
      setRegistered(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to unregister push token');
    }
  }, [supabase]);

  return {
    token,
    registered,
    registering,
    error,
    registerToken,
    unregisterToken,
  };
}
