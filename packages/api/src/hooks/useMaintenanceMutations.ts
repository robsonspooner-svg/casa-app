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

      // Validate property exists
      const { data: property, error: propError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('id', input.property_id)
        .is('deleted_at', null)
        .single();

      if (propError || !property) {
        throw new Error('Property not found or has been deleted');
      }

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

      const requestId = (data as any)?.id || null;

      // Notify the property owner about the new maintenance request
      if (requestId) {
        try {
          const { data: propertyData } = await (supabase
            .from('properties') as ReturnType<typeof supabase.from>)
            .select('owner_id, address_line_1, suburb, state, postcode')
            .eq('id', input.property_id)
            .single();

          if (propertyData?.owner_id) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const urgencyLabel = input.urgency === 'emergency' ? 'EMERGENCY: ' : '';
              const propertyAddress = [
                (propertyData as any).address_line_1,
                (propertyData as any).suburb,
                (propertyData as any).state,
                (propertyData as any).postcode,
              ].filter(Boolean).join(', ');
              fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/dispatch-notification`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    user_id: (propertyData as any).owner_id,
                    type: 'maintenance_submitted',
                    title: `${urgencyLabel}New Maintenance Request`,
                    body: input.title,
                    data: {
                      request_id: requestId,
                      category: input.category,
                      urgency: input.urgency || 'routine',
                      property_address: propertyAddress,
                      issue_title: input.title,
                    },
                    related_type: 'maintenance_request',
                    related_id: requestId,
                    channels: ['push', 'email'],
                  }),
                }
              ).catch(() => {});
            }
          }
        } catch {
          // Non-blocking: notification failure shouldn't prevent request creation
        }
      }

      return requestId;
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

      // Notify tenant about the status change
      try {
        const { data: reqData } = await (supabase
          .from('maintenance_requests') as ReturnType<typeof supabase.from>)
          .select('tenant_id, title, property_id, properties!inner(address_line_1, suburb, state, postcode)')
          .eq('id', requestId)
          .single();

        if (reqData?.tenant_id) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const prop = (reqData as any).properties;
            const propertyAddress = [prop?.address_line_1, prop?.suburb, prop?.state, prop?.postcode].filter(Boolean).join(', ');
            const notifType = status === 'completed' ? 'maintenance_completed' : 'maintenance_status_update';
            const statusLabel = status.replace(/_/g, ' ');
            fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/dispatch-notification`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  user_id: (reqData as any).tenant_id,
                  type: notifType,
                  title: status === 'completed' ? 'Maintenance Completed' : 'Maintenance Update',
                  body: status === 'completed'
                    ? `The maintenance request "${(reqData as any).title}" has been completed.`
                    : `Your maintenance request "${(reqData as any).title}" has been updated to "${statusLabel}".`,
                  data: {
                    request_id: requestId,
                    new_status: status,
                    issue_title: (reqData as any).title,
                    tenant_name: '', // dispatch-notification looks up recipient name
                    property_address: propertyAddress,
                  },
                  related_type: 'maintenance_request',
                  related_id: requestId,
                  channels: ['push', 'email'],
                }),
              }
            ).catch(() => {});
          }
        }
      } catch {
        // Non-blocking: notification failure shouldn't prevent status update
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

      // Create manual_expenses record for financial reporting when actual cost is recorded
      if (actualCost !== undefined && actualCost > 0) {
        try {
          const { data: reqData } = await (supabase
            .from('maintenance_requests') as ReturnType<typeof supabase.from>)
            .select('title, property_id')
            .eq('id', requestId)
            .single();

          if (reqData) {
            await (supabase
              .from('manual_expenses') as ReturnType<typeof supabase.from>)
              .insert({
                owner_id: user.id,
                property_id: (reqData as any).property_id,
                description: `Maintenance: ${(reqData as any).title || 'Repair'}`,
                amount: actualCost,
                expense_date: new Date().toISOString().split('T')[0],
                is_tax_deductible: true,
                tax_category: 'repairs',
                notes: `Auto-created from maintenance request ${requestId}`,
              });
          }
        } catch {
          // Non-blocking: expense recording failure shouldn't prevent cost recording
        }
      }

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
