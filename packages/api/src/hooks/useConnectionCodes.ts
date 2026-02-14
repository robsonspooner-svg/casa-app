// useConnectionCodes Hook - Owner Connection Code Management
// Tenant-Owner Connection System

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  ConnectionCode,
  ConnectionCodeInsert,
  ConnectionCodeWithDetails,
  ConnectionAttempt,
} from '../types/database';

export interface ConnectionCodesState {
  codes: ConnectionCodeWithDetails[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export interface ConnectionCodesActions {
  createCode: (input: CreateConnectionCodeInput) => Promise<ConnectionCode | null>;
  revokeCode: (codeId: string) => Promise<void>;
  refreshCodes: () => Promise<void>;
}

export interface CreateConnectionCodeInput {
  propertyId?: string;
  tenancyId?: string;
  connectionType?: 'tenancy' | 'application' | 'property';
  maxUses?: number;
  expiresInDays?: number;
  label?: string;
}

/**
 * Hook for owners to manage connection codes.
 * Allows creating codes that tenants can use to connect to properties/tenancies.
 */
export function useConnectionCodes(): ConnectionCodesState & ConnectionCodesActions {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ConnectionCodesState>({
    codes: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchCodes = useCallback(async (isRefresh = false) => {
    console.log('[useConnectionCodes] fetchCodes called, user:', user?.id);
    if (!user) {
      console.log('[useConnectionCodes] No user, clearing codes');
      setState({ codes: [], loading: false, error: null, refreshing: false });
      return;
    }

    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const supabase = getSupabaseClient();

      // First, fetch just the connection codes without joins
      // This avoids issues if property_id or tenancy_id is NULL
      console.log('[useConnectionCodes] Fetching codes for owner_id:', user.id);
      const { data: codesData, error: codesError } = await (supabase
        .from('connection_codes') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      console.log('[useConnectionCodes] Query result:', { codesData, codesError });

      if (codesError) {
        console.error('Error fetching connection codes:', codesError);
        throw codesError;
      }

      // Then fetch related property/tenancy data separately if needed
      const data = codesData || [];
      console.log('[useConnectionCodes] Found', data.length, 'codes');
      const error = codesError;

      // Fetch attempts for each code
      const codesWithAttempts: ConnectionCodeWithDetails[] = await Promise.all(
        data.map(async (code: ConnectionCode) => {
          const { data: attempts } = await (supabase
            .from('connection_attempts') as ReturnType<typeof supabase.from>)
            .select('*')
            .eq('code_id', code.id)
            .order('created_at', { ascending: false })
            .limit(10);

          return {
            ...code,
            property: undefined,
            tenancy: undefined,
            attempts: (attempts || []) as ConnectionAttempt[],
          } as ConnectionCodeWithDetails;
        })
      );

      console.log('[useConnectionCodes] Setting state with', codesWithAttempts.length, 'codes');
      setState({
        codes: codesWithAttempts,
        loading: false,
        error: null,
        refreshing: false,
      });
      console.log('[useConnectionCodes] State updated');
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch connection codes';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCodes();
    }
  }, [fetchCodes, isAuthenticated]);

  const createCode = useCallback(async (input: CreateConnectionCodeInput): Promise<ConnectionCode | null> => {
    if (!user) throw new Error('Must be authenticated');

    try {
      const supabase = getSupabaseClient();

      // Generate a unique code using cryptographic random
      const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const randomValues = new Uint32Array(6);
      crypto.getRandomValues(randomValues);
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += codeChars[randomValues[i] % codeChars.length];
      }

      // Calculate expiry date if specified
      let expiresAt: string | null = null;
      if (input.expiresInDays) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + input.expiresInDays);
        expiresAt = expiry.toISOString();
      }

      const insertData: ConnectionCodeInsert = {
        owner_id: user.id,
        property_id: input.propertyId || null,
        tenancy_id: input.tenancyId || null,
        code,
        connection_type: input.connectionType || 'tenancy',
        max_uses: input.maxUses || 1,
        expires_at: expiresAt,
        label: input.label || null,
      };

      const { data, error } = await (supabase
        .from('connection_codes') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating connection code:', error);
        throw error;
      }

      console.log('Connection code created successfully:', data);

      // Refresh codes list
      console.log('Refreshing codes list...');
      await fetchCodes();
      console.log('Codes list refreshed');

      return data as ConnectionCode;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to create connection code';
      setState(prev => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, [user, fetchCodes]);

  const revokeCode = useCallback(async (codeId: string): Promise<void> => {
    if (!user) throw new Error('Must be authenticated');

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('connection_codes') as ReturnType<typeof supabase.from>)
        .update({ is_active: false })
        .eq('id', codeId)
        .eq('owner_id', user.id);

      if (error) throw error;

      // Refresh codes list
      await fetchCodes();
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to revoke connection code';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw caught;
    }
  }, [user, fetchCodes]);

  const refreshCodes = useCallback(async () => {
    await fetchCodes(true);
  }, [fetchCodes]);

  return {
    ...state,
    createCode,
    revokeCode,
    refreshCodes,
  };
}
