import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import type { NotificationSettingsRow, NotificationSettingsUpdate } from '../types/database';

export interface NotificationSettingsState {
  settings: NotificationSettingsRow | null;
  loading: boolean;
  error: string | null;
}

export interface UseNotificationSettingsReturn extends NotificationSettingsState {
  updateSettings: (updates: NotificationSettingsUpdate) => Promise<void>;
  enableQuietHours: (start: string, end: string, timezone?: string) => Promise<void>;
  disableQuietHours: () => Promise<void>;
  setDoNotDisturb: (until: string | null) => Promise<void>;
  setEmailDigest: (frequency: 'immediate' | 'daily' | 'weekly' | 'none') => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotificationSettings(userId: string | undefined): UseNotificationSettingsReturn {
  const [settings, setSettings] = useState<NotificationSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    try { return getSupabaseClient(); } catch { return null; }
  }, []);

  const fetchSettings = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await (supabase
        .from('notification_settings') as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (err) throw err;
      setSettings(data as NotificationSettingsRow | null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: NotificationSettingsUpdate) => {
    if (!supabase || !userId) return;
    try {
      setError(null);

      const { data, error: err } = await (supabase
        .from('notification_settings') as any)
        .upsert(
          { user_id: userId, ...updates },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (err) throw err;
      setSettings(data as NotificationSettingsRow);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update settings');
    }
  }, [supabase, userId]);

  const enableQuietHours = useCallback(async (start: string, end: string, timezone?: string) => {
    await updateSettings({
      quiet_hours_enabled: true,
      quiet_start: start,
      quiet_end: end,
      ...(timezone ? { timezone } : {}),
    });
  }, [updateSettings]);

  const disableQuietHours = useCallback(async () => {
    await updateSettings({ quiet_hours_enabled: false });
  }, [updateSettings]);

  const setDoNotDisturb = useCallback(async (until: string | null) => {
    await updateSettings({ do_not_disturb_until: until });
  }, [updateSettings]);

  const setEmailDigest = useCallback(async (frequency: 'immediate' | 'daily' | 'weekly' | 'none') => {
    await updateSettings({ email_digest: frequency });
  }, [updateSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    enableQuietHours,
    disableQuietHours,
    setDoNotDisturb,
    setEmailDigest,
    refresh: fetchSettings,
  };
}
