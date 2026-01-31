// useInspectionOutsourcing Hook - Inspection Outsourcing Management
// Mission 11 Phase K: Professional Inspection Outsourcing

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  InspectionAssignmentRow,
  InspectionAssignmentInsert,
  InspectionAssignmentUpdate,
  InspectorAccessTokenRow,
  InspectorAccessTokenInsert,
} from '../types/database';

export interface InspectionOutsourcingState {
  assignment: InspectionAssignmentRow | null;
  accessTokens: InspectorAccessTokenRow[];
  loading: boolean;
  error: string | null;
}

export function useInspectionOutsourcing(inspectionId: string | null) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<InspectionOutsourcingState>({
    assignment: null,
    accessTokens: [],
    loading: true,
    error: null,
  });

  const fetchOutsourcing = useCallback(async (isRefresh = false) => {
    if (!user || !inspectionId) {
      setState({ assignment: null, accessTokens: [], loading: false, error: null });
      return;
    }

    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      error: null,
    }));

    try {
      const supabase = getSupabaseClient();

      // Fetch assignment for this inspection
      const { data: assignmentData, error: assignmentError } = await (supabase
        .from('inspection_assignments') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assignmentError) throw assignmentError;

      // Fetch access tokens for this inspection
      const { data: tokensData, error: tokensError } = await (supabase
        .from('inspector_access_tokens') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: false });

      if (tokensError) throw tokensError;

      setState({
        assignment: (assignmentData as InspectionAssignmentRow) || null,
        accessTokens: (tokensData || []) as InspectorAccessTokenRow[],
        loading: false,
        error: null,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch outsourcing data';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user, inspectionId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOutsourcing();
    }
  }, [fetchOutsourcing, isAuthenticated]);

  const refreshOutsourcing = useCallback(async () => {
    await fetchOutsourcing(true);
  }, [fetchOutsourcing]);

  return {
    ...state,
    refreshOutsourcing,
  };
}

export function useInspectionOutsourcingMutations() {
  const { user } = useAuth();

  const createAssignment = useCallback(async (input: InspectionAssignmentInsert): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('inspection_assignments') as ReturnType<typeof supabase.from>)
        .insert(input)
        .select('id')
        .single();

      if (error) throw error;

      // Update the inspection to mark it as outsourced
      const { error: updateError } = await (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .update({
          is_outsourced: true,
          outsource_mode: 'professional',
        })
        .eq('id', input.inspection_id);

      if (updateError) throw updateError;

      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to create assignment';
      throw new Error(message);
    }
  }, [user]);

  const updateAssignment = useCallback(async (
    id: string,
    update: InspectionAssignmentUpdate
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('inspection_assignments') as ReturnType<typeof supabase.from>)
        .update(update)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update assignment';
      throw new Error(message);
    }
  }, [user]);

  const acceptAssignment = useCallback(async (
    id: string,
    confirmedDate: string,
    confirmedTime: string
  ): Promise<boolean> => {
    return updateAssignment(id, {
      accepted: true,
      accepted_at: new Date().toISOString(),
      confirmed_date: confirmedDate,
      confirmed_time: confirmedTime,
    });
  }, [updateAssignment]);

  const declineAssignment = useCallback(async (
    id: string,
    reason: string
  ): Promise<boolean> => {
    return updateAssignment(id, {
      accepted: false,
      declined_reason: reason,
    });
  }, [updateAssignment]);

  const completeAssignment = useCallback(async (id: string): Promise<boolean> => {
    return updateAssignment(id, {
      completed_at: new Date().toISOString(),
    });
  }, [updateAssignment]);

  const rateInspector = useCallback(async (
    id: string,
    rating: number,
    reviewText?: string
  ): Promise<boolean> => {
    return updateAssignment(id, {
      rating,
      review_text: reviewText || null,
    });
  }, [updateAssignment]);

  const generateAccessToken = useCallback(async (
    inspectionId: string,
    assignmentId: string,
    email: string
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      // Generate a random 32-character hex string
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const token = Array.from(tokenBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Token expires in 48 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const insertData: InspectorAccessTokenInsert = {
        inspection_id: inspectionId,
        assignment_id: assignmentId,
        token,
        email,
        expires_at: expiresAt.toISOString(),
      };

      const { error } = await (supabase
        .from('inspector_access_tokens') as ReturnType<typeof supabase.from>)
        .insert(insertData);

      if (error) throw error;
      return token;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to generate access token';
      throw new Error(message);
    }
  }, [user]);

  const revokeAccessToken = useCallback(async (tokenId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('inspector_access_tokens') as ReturnType<typeof supabase.from>)
        .update({
          revoked: true,
          revoked_at: new Date().toISOString(),
        })
        .eq('id', tokenId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to revoke access token';
      throw new Error(message);
    }
  }, [user]);

  return {
    createAssignment,
    updateAssignment,
    acceptAssignment,
    declineAssignment,
    completeAssignment,
    rateInspector,
    generateAccessToken,
    revokeAccessToken,
  };
}
