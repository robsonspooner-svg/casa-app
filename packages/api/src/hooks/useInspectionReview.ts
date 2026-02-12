// useInspectionReview — Tenant review workflow for condition report inspections
// Handles submissions, room acknowledgments, and item-level disputes

import { useState, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  InspectionTenantSubmissionRow,
  InspectionTenantSubmissionInsert,
  InspectionRoomAcknowledgmentRow,
  InspectionRoomAcknowledgmentInsert,
  InspectionItemDisputeRow,
  InspectionItemDisputeInsert,
  TenantSubmissionType,
  ConditionRating,
} from '../types/database';

export interface InspectionReviewState {
  submissions: InspectionTenantSubmissionRow[];
  acknowledgments: InspectionRoomAcknowledgmentRow[];
  disputes: InspectionItemDisputeRow[];
  loading: boolean;
  error: string | null;
}

export function useInspectionReview(inspectionId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<InspectionReviewState>({
    submissions: [],
    acknowledgments: [],
    disputes: [],
    loading: false,
    error: null,
  });

  const fetchReviewData = useCallback(async () => {
    if (!inspectionId || !user) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const [submissionsRes, acknowledgementsRes, disputesRes] = await Promise.all([
        (supabase.from('inspection_tenant_submissions') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('inspection_id', inspectionId)
          .order('created_at', { ascending: true }),
        (supabase.from('inspection_room_acknowledgments') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('inspection_id', inspectionId),
        (supabase.from('inspection_item_disputes') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('inspection_id', inspectionId)
          .order('created_at', { ascending: true }),
      ]);

      if (submissionsRes.error) throw submissionsRes.error;
      if (acknowledgementsRes.error) throw acknowledgementsRes.error;
      if (disputesRes.error) throw disputesRes.error;

      setState({
        submissions: (submissionsRes.data || []) as InspectionTenantSubmissionRow[],
        acknowledgments: (acknowledgementsRes.data || []) as InspectionRoomAcknowledgmentRow[],
        disputes: (disputesRes.data || []) as InspectionItemDisputeRow[],
        loading: false,
        error: null,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to load review data';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [inspectionId, user]);

  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  // Submit a tenant addition or alteration
  const submitTenantAddition = useCallback(async (
    roomId: string,
    submissionType: TenantSubmissionType,
    description?: string | null,
    originalDescription?: string | null,
    itemId?: string | null,
  ): Promise<string | null> => {
    if (!user || !inspectionId) return null;

    try {
      const supabase = getSupabaseClient();

      const insert: InspectionTenantSubmissionInsert = {
        inspection_id: inspectionId,
        room_id: roomId,
        item_id: itemId || null,
        submitted_by: user.id,
        submission_type: submissionType,
        description: description || null,
        original_description: originalDescription || null,
      };

      const { data, error } = await (supabase
        .from('inspection_tenant_submissions') as ReturnType<typeof supabase.from>)
        .insert(insert)
        .select('id')
        .single();

      if (error) throw error;
      await fetchReviewData();
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to submit addition';
      throw new Error(message);
    }
  }, [user, inspectionId, fetchReviewData]);

  // Submit a photo from tenant (with file size validation and cleanup on failure)
  const submitTenantPhoto = useCallback(async (
    roomId: string,
    uri: string,
    caption?: string | null,
  ): Promise<boolean> => {
    if (!user || !inspectionId) return false;

    const supabase = getSupabaseClient();
    const storagePath = `tenant-submissions/${user.id}/${inspectionId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;

    try {
      // Fetch and validate file size (max 10MB)
      const response = await fetch(uri);
      const blob = await response.blob();
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (blob.size > MAX_FILE_SIZE) {
        throw new Error('Photo exceeds 10MB limit. Please use a smaller image.');
      }

      const { error: uploadError } = await supabase.storage
        .from('inspection-images')
        .upload(storagePath, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('inspection-images')
        .getPublicUrl(storagePath);

      // Create submission record
      const insert: InspectionTenantSubmissionInsert = {
        inspection_id: inspectionId,
        room_id: roomId,
        submitted_by: user.id,
        submission_type: 'new_photo',
        description: caption || null,
        image_url: urlData.publicUrl,
        storage_path: storagePath,
      };

      const { error } = await (supabase
        .from('inspection_tenant_submissions') as ReturnType<typeof supabase.from>)
        .insert(insert);

      if (error) {
        // Cleanup orphaned storage file if DB insert fails
        await supabase.storage.from('inspection-images').remove([storagePath]);
        throw error;
      }

      await fetchReviewData();
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to upload photo';
      throw new Error(message);
    }
  }, [user, inspectionId, fetchReviewData]);

  // Acknowledge a room (tenant signs off on this room)
  const acknowledgeRoom = useCallback(async (
    roomId: string,
    signatureUrl?: string | null,
  ): Promise<boolean> => {
    if (!user || !inspectionId) return false;

    try {
      const supabase = getSupabaseClient();

      const insert: InspectionRoomAcknowledgmentInsert = {
        inspection_id: inspectionId,
        room_id: roomId,
        acknowledged_by: user.id,
        role: 'tenant',
        signature_url: signatureUrl || null,
      };

      const { error } = await (supabase
        .from('inspection_room_acknowledgments') as ReturnType<typeof supabase.from>)
        .insert(insert);

      if (error) throw error;

      // Also update room's tenant_reviewed_at
      await (supabase
        .from('inspection_rooms') as ReturnType<typeof supabase.from>)
        .update({ tenant_reviewed_at: new Date().toISOString() })
        .eq('id', roomId);

      await fetchReviewData();
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to acknowledge room';
      throw new Error(message);
    }
  }, [user, inspectionId, fetchReviewData]);

  // Raise an item-level dispute (prevents duplicate open disputes on same item)
  const raiseItemDispute = useCallback(async (
    itemId: string,
    reason: string,
    proposedCondition?: ConditionRating | null,
  ): Promise<string | null> => {
    if (!user || !inspectionId) return null;

    // Check for existing open dispute on this item by this user
    const existingDispute = state.disputes.find(
      d => d.item_id === itemId && d.raised_by === user.id && (d.status === 'open' || d.status === 'owner_responded')
    );
    if (existingDispute) {
      throw new Error('You already have an active dispute on this item. Please wait for the owner to respond before raising another.');
    }

    try {
      const supabase = getSupabaseClient();

      const insert: InspectionItemDisputeInsert = {
        inspection_id: inspectionId,
        item_id: itemId,
        raised_by: user.id,
        dispute_reason: reason,
        proposed_condition: proposedCondition || null,
      };

      const { data, error } = await (supabase
        .from('inspection_item_disputes') as ReturnType<typeof supabase.from>)
        .insert(insert)
        .select('id')
        .single();

      if (error) throw error;
      await fetchReviewData();
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to raise dispute';
      throw new Error(message);
    }
  }, [user, inspectionId, state.disputes, fetchReviewData]);

  // Helper: check if a room is acknowledged
  const isRoomAcknowledged = useCallback((roomId: string): boolean => {
    return state.acknowledgments.some(a => a.room_id === roomId && a.role === 'tenant');
  }, [state.acknowledgments]);

  // Helper: get submissions for a specific room
  const getRoomSubmissions = useCallback((roomId: string): InspectionTenantSubmissionRow[] => {
    return state.submissions.filter(s => s.room_id === roomId);
  }, [state.submissions]);

  // Helper: get disputes for a specific item
  const getItemDisputes = useCallback((itemId: string): InspectionItemDisputeRow[] => {
    return state.disputes.filter(d => d.item_id === itemId);
  }, [state.disputes]);

  // Count of pending submissions (for owner badge)
  const pendingSubmissionCount = state.submissions.filter(s => s.status === 'pending').length;
  const openDisputeCount = state.disputes.filter(d => d.status === 'open' || d.status === 'owner_responded').length;

  return {
    ...state,
    refreshReviewData: fetchReviewData,
    submitTenantAddition,
    submitTenantPhoto,
    acknowledgeRoom,
    raiseItemDispute,
    isRoomAcknowledged,
    getRoomSubmissions,
    getItemDisputes,
    pendingSubmissionCount,
    openDisputeCount,
  };
}
