// useMaintenanceMutations Hook - Create, Update, Comment on Maintenance Requests
// Mission 09: Maintenance Requests

import { useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  MaintenanceRequestInsert,
  MaintenanceRequestUpdate,
  MaintenanceCommentInsert,
  MaintenanceImageInsert,
  MaintenanceStatus,
} from '../types/database';

export interface CreateMaintenanceInput {
  tenancy_id: string;
  property_id: string;
  category: MaintenanceRequestInsert['category'];
  urgency?: MaintenanceRequestInsert['urgency'];
  title: string;
  description: string;
  location_in_property?: string;
  preferred_contact_method?: 'app' | 'phone' | 'email';
  preferred_times?: string;
  access_instructions?: string;
}

export function useMaintenanceMutations() {
  const { user } = useAuth();

  const createRequest = useCallback(async (input: CreateMaintenanceInput): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const insertData: MaintenanceRequestInsert = {
        tenancy_id: input.tenancy_id,
        property_id: input.property_id,
        tenant_id: user.id,
        category: input.category,
        urgency: input.urgency || 'routine',
        title: input.title,
        description: input.description,
        location_in_property: input.location_in_property || null,
        preferred_contact_method: input.preferred_contact_method || 'app',
        preferred_times: input.preferred_times || null,
        access_instructions: input.access_instructions || null,
      };

      const { data, error } = await (supabase
        .from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to create request';
      throw new Error(message);
    }
  }, [user]);

  const updateRequest = useCallback(async (
    requestId: string,
    updates: MaintenanceRequestUpdate
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      // If updating status, set the changed_by field
      const updateData = { ...updates };
      if (updates.status) {
        updateData.status_changed_by = user.id;
      }

      const { error } = await (supabase
        .from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update request';
      throw new Error(message);
    }
  }, [user]);

  const updateStatus = useCallback(async (
    requestId: string,
    status: MaintenanceStatus,
    notes?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .update({
          status,
          status_changed_by: user.id,
        })
        .eq('id', requestId);

      if (error) throw error;

      // Add a comment with the status change note if provided
      if (notes) {
        await addComment({
          request_id: requestId,
          author_id: user.id,
          content: notes,
          is_internal: false,
        });
      }

      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update status';
      throw new Error(message);
    }
  }, [user]);

  const addComment = useCallback(async (input: MaintenanceCommentInsert): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('maintenance_comments') as ReturnType<typeof supabase.from>)
        .insert(input);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to add comment';
      throw new Error(message);
    }
  }, []);

  const uploadImage = useCallback(async (
    requestId: string,
    uri: string,
    fileName: string,
    mimeType: string,
    isBefore = true
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      // Upload file to storage
      const storagePath = `${user.id}/${requestId}/${Date.now()}_${fileName}`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('maintenance')
        .upload(storagePath, blob, { contentType: mimeType });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('maintenance')
        .getPublicUrl(storagePath);

      // Create image record
      const imageInsert: MaintenanceImageInsert = {
        request_id: requestId,
        uploaded_by: user.id,
        storage_path: storagePath,
        url: urlData.publicUrl,
        file_type: mimeType.startsWith('video/') ? 'video' : 'image',
        mime_type: mimeType,
        file_size: blob.size,
        is_before: isBefore,
      };

      const { error: insertError } = await (supabase
        .from('maintenance_images') as ReturnType<typeof supabase.from>)
        .insert(imageInsert);

      if (insertError) throw insertError;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to upload image';
      throw new Error(message);
    }
  }, [user]);

  const recordCost = useCallback(async (
    requestId: string,
    estimatedCost?: number,
    actualCost?: number,
    costResponsibility?: 'owner' | 'tenant' | 'split' | 'insurance'
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const updates: MaintenanceRequestUpdate = {};
      if (estimatedCost !== undefined) updates.estimated_cost = estimatedCost;
      if (actualCost !== undefined) updates.actual_cost = actualCost;
      if (costResponsibility) updates.cost_responsibility = costResponsibility;

      const { error } = await (supabase
        .from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', requestId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to record cost';
      throw new Error(message);
    }
  }, [user]);

  const rateSatisfaction = useCallback(async (
    requestId: string,
    rating: number,
    satisfied: boolean
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .update({
          satisfaction_rating: rating,
          tenant_satisfied: satisfied,
        })
        .eq('id', requestId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to submit rating';
      throw new Error(message);
    }
  }, [user]);

  return {
    createRequest,
    updateRequest,
    updateStatus,
    addComment,
    uploadImage,
    recordCost,
    rateSatisfaction,
  };
}
