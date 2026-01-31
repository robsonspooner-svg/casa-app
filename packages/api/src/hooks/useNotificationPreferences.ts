// useNotificationPreferences Hook - User Notification Settings
// Mission 12: In-App Communications

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  rent_reminders: boolean;
  payment_receipts: boolean;
  maintenance_updates: boolean;
  message_notifications: boolean;
  marketing_emails: boolean;
  sms_phone: string | null;
  sms_phone_verified: boolean;
  whatsapp_phone: string | null;
  whatsapp_opted_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferencesState {
  preferences: NotificationPreferences | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
}

export function useNotificationPreferences(): NotificationPreferencesState & {
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  refreshPreferences: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<NotificationPreferencesState>({
    preferences: null,
    loading: true,
    error: null,
    saving: false,
  });

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setState({ preferences: null, loading: false, error: null, saving: false });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('notification_preferences') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create default preferences if none exist
        const { data: newPrefs, error: insertError } = await (supabase
          .from('notification_preferences') as ReturnType<typeof supabase.from>)
          .insert({
            user_id: user.id,
          })
          .select('*')
          .single();

        if (insertError) throw insertError;

        setState({
          preferences: newPrefs as NotificationPreferences,
          loading: false,
          error: null,
          saving: false,
        });
        return;
      }

      setState({
        preferences: data as NotificationPreferences,
        loading: false,
        error: null,
        saving: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to load preferences';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPreferences();
    }
  }, [fetchPreferences, isAuthenticated]);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!user || !state.preferences) return;

    setState(prev => ({ ...prev, saving: true }));

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('notification_preferences') as ReturnType<typeof supabase.from>)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        preferences: prev.preferences ? { ...prev.preferences, ...updates } : null,
        saving: false,
      }));
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to save preferences';
      setState(prev => ({ ...prev, saving: false, error: errorMessage }));
      throw caught;
    }
  }, [user, state.preferences]);

  const refreshPreferences = useCallback(async () => {
    await fetchPreferences();
  }, [fetchPreferences]);

  return {
    ...state,
    updatePreferences,
    refreshPreferences,
  };
}
