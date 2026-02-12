// useInspectionMutations Hook - Inspection CRUD Operations
// Mission 11: Property Inspections

import { useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  InspectionInsert,
  InspectionUpdate,
  InspectionStatus,
  InspectionRoomInsert,
  InspectionRoomUpdate,
  InspectionItemInsert,
  InspectionItemUpdate,
  InspectionImageInsert,
  ConditionRating,
  OutsourceMode,
} from '../types/database';

export interface ScheduleInspectionInput {
  property_id: string;
  inspection_type: InspectionInsert['inspection_type'];
  scheduled_date: string;
  tenancy_id?: string | null;
  scheduled_time?: string | null;
  compare_to_inspection_id?: string | null;
  is_outsourced?: boolean;
  outsource_mode?: OutsourceMode;
}

export interface AddRoomInput {
  inspection_id: string;
  name: string;
  display_order?: number;
}

export interface RateItemInput {
  item_id: string;
  condition: ConditionRating;
  notes?: string | null;
  action_required?: boolean;
  action_description?: string | null;
  estimated_cost?: number | null;
}

export function useInspectionMutations() {
  const { user } = useAuth();

  const scheduleInspection = useCallback(async (input: ScheduleInspectionInput): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const insertData: InspectionInsert = {
        property_id: input.property_id,
        inspector_id: user.id,
        inspection_type: input.inspection_type,
        scheduled_date: input.scheduled_date,
        tenancy_id: input.tenancy_id || null,
        scheduled_time: input.scheduled_time || null,
        compare_to_inspection_id: input.compare_to_inspection_id || null,
        status: 'scheduled',
        is_outsourced: input.is_outsourced || false,
        outsource_mode: input.outsource_mode || null,
      };

      const { data, error } = await (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to schedule inspection';
      throw new Error(message);
    }
  }, [user]);

  const updateInspection = useCallback(async (
    inspectionId: string,
    updates: InspectionUpdate
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', inspectionId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update inspection';
      throw new Error(message);
    }
  }, [user]);

  const startInspection = useCallback(async (inspectionId: string): Promise<boolean> => {
    return updateInspection(inspectionId, {
      status: 'in_progress',
      actual_date: new Date().toISOString().split('T')[0],
      actual_time: new Date().toTimeString().split(' ')[0],
    });
  }, [updateInspection]);

  const completeInspection = useCallback(async (
    inspectionId: string,
    overallCondition?: ConditionRating,
    summaryNotes?: string
  ): Promise<boolean> => {
    return updateInspection(inspectionId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      overall_condition: overallCondition || null,
      summary_notes: summaryNotes || null,
    });
  }, [updateInspection]);

  const cancelInspection = useCallback(async (inspectionId: string): Promise<boolean> => {
    return updateInspection(inspectionId, { status: 'cancelled' });
  }, [updateInspection]);

  const sendForTenantReview = useCallback(async (inspectionId: string): Promise<boolean> => {
    return updateInspection(inspectionId, { status: 'tenant_review' });
  }, [updateInspection]);

  const finalizeInspection = useCallback(async (inspectionId: string): Promise<boolean> => {
    return updateInspection(inspectionId, { status: 'finalized' });
  }, [updateInspection]);

  // Tenant-facing: acknowledge or dispute
  const acknowledgeInspection = useCallback(async (inspectionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .update({
          tenant_acknowledged: true,
          tenant_acknowledged_at: new Date().toISOString(),
          status: 'finalized',
        })
        .eq('id', inspectionId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to acknowledge inspection';
      throw new Error(message);
    }
  }, [user]);

  const disputeInspection = useCallback(async (
    inspectionId: string,
    disputes: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .update({
          tenant_disputes: disputes,
          status: 'disputed',
        })
        .eq('id', inspectionId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to dispute inspection';
      throw new Error(message);
    }
  }, [user]);

  // Room operations
  const addRoom = useCallback(async (input: AddRoomInput): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const insertData: InspectionRoomInsert = {
        inspection_id: input.inspection_id,
        name: input.name,
        display_order: input.display_order || 0,
      };

      const { data, error } = await (supabase
        .from('inspection_rooms') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to add room';
      throw new Error(message);
    }
  }, [user]);

  const updateRoom = useCallback(async (
    roomId: string,
    updates: InspectionRoomUpdate
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('inspection_rooms') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', roomId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update room';
      throw new Error(message);
    }
  }, [user]);

  const completeRoom = useCallback(async (
    roomId: string,
    overallCondition?: ConditionRating
  ): Promise<boolean> => {
    return updateRoom(roomId, {
      completed_at: new Date().toISOString(),
      overall_condition: overallCondition || null,
    });
  }, [updateRoom]);

  // Item operations
  const addItem = useCallback(async (input: InspectionItemInsert): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('inspection_items') as ReturnType<typeof supabase.from>)
        .insert(input)
        .select('id')
        .single();

      if (error) throw error;
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to add item';
      throw new Error(message);
    }
  }, [user]);

  const rateItem = useCallback(async (input: RateItemInput): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const updates: InspectionItemUpdate = {
        condition: input.condition,
        notes: input.notes || null,
        action_required: input.action_required || false,
        action_description: input.action_description || null,
        estimated_cost: input.estimated_cost || null,
        checked_at: new Date().toISOString(),
      };

      const { error } = await (supabase
        .from('inspection_items') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', input.item_id);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to rate item';
      throw new Error(message);
    }
  }, [user]);

  // Bulk add rooms from template
  const addRoomsFromTemplate = useCallback(async (
    inspectionId: string,
    templateRooms: { name: string; display_order: number; items: string[] }[]
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      // Insert all rooms
      const roomInserts: InspectionRoomInsert[] = templateRooms.map(tr => ({
        inspection_id: inspectionId,
        name: tr.name,
        display_order: tr.display_order,
      }));

      const { data: roomsData, error: roomsError } = await (supabase
        .from('inspection_rooms') as ReturnType<typeof supabase.from>)
        .insert(roomInserts)
        .select('id, name, display_order');

      if (roomsError) throw roomsError;

      const rooms = (roomsData || []) as { id: string; name: string; display_order: number }[];

      // Insert items for each room
      const allItemInserts: InspectionItemInsert[] = [];
      rooms.forEach(room => {
        const templateRoom = templateRooms.find(tr => tr.name === room.name);
        if (templateRoom) {
          templateRoom.items.forEach((itemName, index) => {
            allItemInserts.push({
              room_id: room.id,
              name: itemName,
              display_order: index,
            });
          });
        }
      });

      if (allItemInserts.length > 0) {
        const { error: itemsError } = await (supabase
          .from('inspection_items') as ReturnType<typeof supabase.from>)
          .insert(allItemInserts);

        if (itemsError) throw itemsError;
      }

      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to add rooms from template';
      throw new Error(message);
    }
  }, [user]);

  // Image upload with optional spatial metadata
  const uploadImage = useCallback(async (
    inspectionId: string,
    uri: string,
    fileName: string,
    mimeType: string,
    roomId?: string | null,
    itemId?: string | null,
    caption?: string | null,
    compassBearing?: number | null,
    devicePitch?: number | null,
    deviceRoll?: number | null,
    captureSequence?: number | null,
    isWideShot?: boolean,
    isCloseup?: boolean,
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const storagePath = `${user.id}/${inspectionId}/${Date.now()}_${fileName}`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('inspection-images')
        .upload(storagePath, blob, { contentType: mimeType });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('inspection-images')
        .getPublicUrl(storagePath);

      const imageInsert: InspectionImageInsert = {
        inspection_id: inspectionId,
        storage_path: storagePath,
        url: urlData.publicUrl,
        room_id: roomId || null,
        item_id: itemId || null,
        caption: caption || null,
        compass_bearing: compassBearing ?? null,
        device_pitch: devicePitch ?? null,
        device_roll: deviceRoll ?? null,
        capture_sequence: captureSequence ?? null,
        is_wide_shot: isWideShot ?? false,
        is_closeup: isCloseup ?? false,
      };

      const { error: insertError } = await (supabase
        .from('inspection_images') as ReturnType<typeof supabase.from>)
        .insert(imageInsert);

      if (insertError) throw insertError;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to upload image';
      throw new Error(message);
    }
  }, [user]);

  // Review submission management (owner reviewing tenant submissions)
  const reviewSubmission = useCallback(async (
    submissionId: string,
    action: 'approved' | 'rejected',
    notes?: string | null,
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase
        .from('inspection_tenant_submissions') as ReturnType<typeof supabase.from>)
        .update({
          status: action,
          reviewer_notes: notes || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', submissionId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to review submission';
      throw new Error(message);
    }
  }, [user]);

  // Respond to a dispute
  const respondToDispute = useCallback(async (
    disputeId: string,
    response: string,
    resolvedCondition?: ConditionRating | null,
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();
      const updates: Record<string, unknown> = {
        owner_response: response,
        status: 'owner_responded',
        updated_at: new Date().toISOString(),
      };
      if (resolvedCondition) {
        updates.resolved_condition = resolvedCondition;
        updates.status = 'resolved';
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await (supabase
        .from('inspection_item_disputes') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', disputeId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to respond to dispute';
      throw new Error(message);
    }
  }, [user]);

  // Sign inspection (records signature for owner or tenant)
  const signInspection = useCallback(async (
    inspectionId: string,
    role: 'owner' | 'tenant',
    signatureUrl: string,
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();
      const updates: Record<string, unknown> = {};

      if (role === 'owner') {
        updates.owner_signature_url = signatureUrl;
        updates.owner_signed_at = new Date().toISOString();
      } else {
        updates.tenant_signature_url = signatureUrl;
        updates.tenant_acknowledged = true;
        updates.tenant_acknowledged_at = new Date().toISOString();
      }

      const { error } = await (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', inspectionId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to sign inspection';
      throw new Error(message);
    }
  }, [user]);

  // AI auto-tagging: analyze inspection photos with Claude Vision
  const analyzePhotos = useCallback(async (
    inspectionId: string,
    imageIds?: string[],
  ): Promise<{ analyzed: number }> => {
    if (!user) return { analyzed: 0 };

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/analyze-inspection-photos`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inspection_id: inspectionId,
            image_ids: imageIds || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Photo analysis failed');
      }

      return (await response.json()) as { analyzed: number };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to analyze photos';
      throw new Error(message);
    }
  }, [user]);

  return {
    scheduleInspection,
    updateInspection,
    startInspection,
    completeInspection,
    cancelInspection,
    sendForTenantReview,
    finalizeInspection,
    acknowledgeInspection,
    disputeInspection,
    addRoom,
    updateRoom,
    completeRoom,
    addItem,
    rateItem,
    addRoomsFromTemplate,
    uploadImage,
    reviewSubmission,
    respondToDispute,
    signInspection,
    analyzePhotos,
  };
}
