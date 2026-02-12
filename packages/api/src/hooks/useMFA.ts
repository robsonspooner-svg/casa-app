// useMFA Hook - Multi-Factor Authentication Management
// Mission 18: Security Audit

import { useState, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface MFAState {
  isEnabled: boolean;
  isSetup: boolean;
  loading: boolean;
  error: string | null;
}

export interface UseMFAReturn extends MFAState {
  setupMFA: () => Promise<{ secret: string; qrUri: string } | null>;
  verifyAndEnable: (code: string) => Promise<boolean>;
  disableMFA: (code: string) => Promise<boolean>;
  verifyCode: (code: string) => Promise<boolean>;
  getRecoveryCodes: () => Promise<string[]>;
  refresh: () => Promise<void>;
}

export function useMFA(): UseMFAReturn {
  const { user } = useAuth();
  const [state, setState] = useState<MFAState>({
    isEnabled: false,
    isSetup: false,
    loading: true,
    error: null,
  });

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setState({ isEnabled: false, isSetup: false, loading: false, error: null });
      return;
    }

    try {
      const { data, error } = await (supabase.from('user_mfa') as any)
        .select('is_enabled, verified_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setState({
        isEnabled: data?.is_enabled ?? false,
        isSetup: !!data?.verified_at,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch MFA status',
      }));
    }
  }, [user, supabase]);

  const setupMFA = useCallback(async (): Promise<{ secret: string; qrUri: string } | null> => {
    if (!user || !supabase) return null;

    try {
      // Use Supabase's built-in MFA enrollment
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Casa Authenticator',
      });

      if (error) throw error;

      return {
        secret: data.totp.secret,
        qrUri: data.totp.uri,
      };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to setup MFA',
      }));
      return null;
    }
  }, [user, supabase]);

  const verifyAndEnable = useCallback(async (code: string): Promise<boolean> => {
    if (!user || !supabase) return false;

    try {
      // Get the unverified factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const unverifiedFactor = factors?.totp?.find(f => (f.status as string) === 'unverified');

      if (!unverifiedFactor) {
        setState(prev => ({ ...prev, error: 'No MFA setup in progress' }));
        return false;
      }

      // Create a challenge and verify
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: unverifiedFactor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: unverifiedFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) throw verifyError;

      // Update local MFA record
      await (supabase.from('user_mfa') as any).upsert({
        user_id: user.id,
        totp_secret: 'managed-by-supabase-auth',
        is_enabled: true,
        verified_at: new Date().toISOString(),
      });

      // Update profile flag
      await (supabase.from('profiles') as any).update({ mfa_enabled: true }).eq('id', user.id);

      setState(prev => ({ ...prev, isEnabled: true, isSetup: true, error: null }));
      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Invalid verification code',
      }));
      return false;
    }
  }, [user, supabase]);

  const disableMFA = useCallback(async (code: string): Promise<boolean> => {
    if (!user || !supabase) return false;

    try {
      // Get the verified factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');

      if (!verifiedFactor) {
        setState(prev => ({ ...prev, error: 'MFA not enabled' }));
        return false;
      }

      // Challenge and verify before unenrolling
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: verifiedFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) throw verifyError;

      // Unenroll the factor
      await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });

      // Update local records
      await (supabase.from('user_mfa') as any)
        .update({ is_enabled: false })
        .eq('user_id', user.id);

      await (supabase.from('profiles') as any).update({ mfa_enabled: false }).eq('id', user.id);

      setState(prev => ({ ...prev, isEnabled: false, error: null }));
      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to disable MFA',
      }));
      return false;
    }
  }, [user, supabase]);

  const verifyCode = useCallback(async (code: string): Promise<boolean> => {
    if (!user || !supabase) return false;

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.find(f => f.status === 'verified');

      if (!factor) return false;

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code,
      });

      return !verifyError;
    } catch {
      return false;
    }
  }, [user, supabase]);

  const getRecoveryCodes = useCallback(async (): Promise<string[]> => {
    if (!user || !supabase) return [];

    try {
      const { data, error } = await (supabase.from('user_recovery_codes') as any)
        .select('id')
        .eq('user_id', user.id)
        .is('used_at', null);

      if (error) throw error;
      return (data || []).map((row: { id: string }) => row.id.slice(0, 8).toUpperCase());
    } catch {
      return [];
    }
  }, [user, supabase]);

  return {
    ...state,
    setupMFA,
    verifyAndEnable,
    disableMFA,
    verifyCode,
    getRecoveryCodes,
    refresh,
  };
}
