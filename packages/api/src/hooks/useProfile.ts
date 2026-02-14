// useProfile Hook - Casa User Profile Management
// Mission 02: Authentication & User Profiles

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { Profile, ProfileUpdate } from '../types/database';

export interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export interface ProfileActions {
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  uploadAvatar: (file: Blob, fileName: string) => Promise<string>;
  refreshProfile: () => Promise<void>;
}

export interface ProfileContextValue extends ProfileState, ProfileActions {
  firstName: string | null;
  lastName: string | null;
}

export function useProfile(): ProfileContextValue {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ProfileState>({
    profile: null,
    loading: true,
    error: null,
  });

  // Fetch profile when user changes, with retry for race condition after signup
  const fetchProfile = useCallback(async (retryCount = 0) => {
    if (!user) {
      setState({ profile: null, loading: false, error: null });
      return;
    }

    if (retryCount === 0) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // Profile may not exist yet due to trigger race condition after signup.
        // Retry up to 3 times with increasing delay.
        if (retryCount < 3) {
          const delay = (retryCount + 1) * 800;
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchProfile(retryCount + 1);
        }
        throw error;
      }

      setState({
        profile: data as Profile,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({
        profile: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch profile',
      });
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    if (!user) {
      throw new Error('Not authenticated');
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      // Use type assertion to work around Supabase generic inference
      const { data, error } = await (supabase
        .from('profiles') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setState({
        profile: data as Profile,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, [user]);

  const uploadAvatar = useCallback(async (file: Blob, fileName: string): Promise<string> => {
    if (!user) {
      throw new Error('Not authenticated');
    }

    try {
      const supabase = getSupabaseClient();

      // Upload to user's folder
      const filePath = `${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: publicUrl });

      return publicUrl;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to upload avatar');
    }
  }, [user, updateProfile]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  // Parse name for convenience
  const nameParts = state.profile?.full_name?.trim().split(/\s+/) || [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  return {
    ...state,
    firstName,
    lastName,
    updateProfile,
    uploadAvatar,
    refreshProfile,
  };
}
