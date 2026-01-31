// useDirectInvite Hook - Owner Direct Invitation Management
// Direct Invitation System for Property Owners

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface DirectInvitation {
  id: string;
  owner_id: string;
  property_id: string;
  tenant_email: string;
  tenant_name: string | null;
  rent_amount: number;
  rent_frequency: string;
  lease_start_date: string | null;
  lease_end_date: string | null;
  bond_weeks: number;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvitationInput {
  property_id: string;
  tenant_email: string;
  tenant_name?: string;
  rent_amount: number;
  rent_frequency?: string;
  lease_start_date?: string;
  lease_end_date?: string;
  bond_weeks?: number;
  message?: string;
}

export interface DirectInviteState {
  invitations: DirectInvitation[];
  loading: boolean;
  error: string | null;
}

export interface UseDirectInviteReturn extends DirectInviteState {
  sendInvitation: (input: CreateInvitationInput) => Promise<boolean>;
  cancelInvitation: (id: string) => Promise<boolean>;
  refreshInvitations: () => Promise<void>;
}

/**
 * Hook for owners to manage direct invitations to tenants.
 * Allows sending invitations by email and tracking their status.
 */
export function useDirectInvite(): UseDirectInviteReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<DirectInviteState>({
    invitations: [],
    loading: true,
    error: null,
  });

  const fetchInvitations = useCallback(async () => {
    if (!user) {
      setState({ invitations: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('direct_invitations') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setState({
        invitations: (data || []) as DirectInvitation[],
        loading: false,
        error: null,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch invitations';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInvitations();
    }
  }, [fetchInvitations, isAuthenticated]);

  const sendInvitation = useCallback(async (input: CreateInvitationInput): Promise<boolean> => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'Must be authenticated' }));
      return false;
    }

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('direct_invitations') as ReturnType<typeof supabase.from>)
        .insert({
          owner_id: user.id,
          property_id: input.property_id,
          tenant_email: input.tenant_email.toLowerCase().trim(),
          tenant_name: input.tenant_name || null,
          rent_amount: input.rent_amount,
          rent_frequency: input.rent_frequency || 'weekly',
          lease_start_date: input.lease_start_date || null,
          lease_end_date: input.lease_end_date || null,
          bond_weeks: input.bond_weeks ?? 4,
          message: input.message || null,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      await fetchInvitations();
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to send invitation';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, fetchInvitations]);

  const cancelInvitation = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'Must be authenticated' }));
      return false;
    }

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('direct_invitations') as ReturnType<typeof supabase.from>)
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('owner_id', user.id);

      if (error) {
        throw error;
      }

      await fetchInvitations();
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to cancel invitation';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, fetchInvitations]);

  const refreshInvitations = useCallback(async () => {
    await fetchInvitations();
  }, [fetchInvitations]);

  return {
    ...state,
    sendInvitation,
    cancelInvitation,
    refreshInvitations,
  };
}
