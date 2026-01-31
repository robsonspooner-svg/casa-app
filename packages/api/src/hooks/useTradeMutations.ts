// Trade Mutations — Network management, work order lifecycle, reviews
// Mission 10: Tradesperson Network

import { useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  TradeInsert,
  TradeUpdate,
  OwnerTradeInsert,
  OwnerTradeUpdate,
  WorkOrderInsert,
  WorkOrderUpdate,
  WorkOrderStatus,
  TradeReviewInsert,
} from '../types/database';

// --- Add Trade Manually ---
export interface AddTradeInput {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  categories: TradeInsert['categories'];
  abn?: string | null;
  license_number?: string | null;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  insurance_expiry?: string | null;
  service_areas?: string[] | null;
  available_weekdays?: boolean;
  available_weekends?: boolean;
  available_after_hours?: boolean;
  bio?: string | null;
  years_experience?: number | null;
}

// --- Create Work Order ---
export interface CreateWorkOrderInput {
  property_id: string;
  trade_id: string;
  title: string;
  description: string;
  category: WorkOrderInsert['category'];
  maintenance_request_id?: string | null;
  urgency?: WorkOrderInsert['urgency'];
  access_instructions?: string | null;
  tenant_contact_allowed?: boolean;
  budget_min?: number | null;
  budget_max?: number | null;
  quote_required?: boolean;
}

// --- Submit Review ---
export interface SubmitReviewInput {
  trade_id: string;
  work_order_id: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  would_recommend?: boolean | null;
}

export function useTradeMutations() {
  const { user } = useAuth();

  // ==================== Trade Network ====================

  const addTrade = useCallback(async (input: AddTradeInput): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const insertData: TradeInsert = {
        business_name: input.business_name,
        contact_name: input.contact_name,
        email: input.email,
        phone: input.phone,
        categories: input.categories,
        abn: input.abn || null,
        license_number: input.license_number || null,
        insurance_provider: input.insurance_provider || null,
        insurance_policy_number: input.insurance_policy_number || null,
        insurance_expiry: input.insurance_expiry || null,
        service_areas: input.service_areas || null,
        available_weekdays: input.available_weekdays ?? true,
        available_weekends: input.available_weekends ?? false,
        available_after_hours: input.available_after_hours ?? false,
        bio: input.bio || null,
        years_experience: input.years_experience ?? null,
        status: 'active',
      };

      const { data, error } = await (supabase
        .from('trades') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;
      const tradeId = (data as any)?.id;
      if (!tradeId) throw new Error('Failed to get trade ID');

      // Auto-add to owner's network
      const ownerTradeInsert: OwnerTradeInsert = {
        owner_id: user.id,
        trade_id: tradeId,
      };

      const { error: otError } = await (supabase
        .from('owner_trades') as ReturnType<typeof supabase.from>)
        .insert(ownerTradeInsert);

      if (otError) throw otError;

      return tradeId;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to add trade';
      throw new Error(message);
    }
  }, [user]);

  const addToNetwork = useCallback(async (tradeId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const insertData: OwnerTradeInsert = {
        owner_id: user.id,
        trade_id: tradeId,
      };

      const { error } = await (supabase
        .from('owner_trades') as ReturnType<typeof supabase.from>)
        .insert(insertData);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to add trade to network';
      throw new Error(message);
    }
  }, [user]);

  const removeFromNetwork = useCallback(async (tradeId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('owner_trades') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('owner_id', user.id)
        .eq('trade_id', tradeId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to remove trade from network';
      throw new Error(message);
    }
  }, [user]);

  const toggleFavorite = useCallback(async (tradeId: string, isFavorite: boolean): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const updateData: OwnerTradeUpdate = { is_favorite: isFavorite };

      const { error } = await (supabase
        .from('owner_trades') as ReturnType<typeof supabase.from>)
        .update(updateData)
        .eq('owner_id', user.id)
        .eq('trade_id', tradeId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to toggle favorite';
      throw new Error(message);
    }
  }, [user]);

  const updateTradeNotes = useCallback(async (tradeId: string, notes: string | null): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const updateData: OwnerTradeUpdate = { notes };

      const { error } = await (supabase
        .from('owner_trades') as ReturnType<typeof supabase.from>)
        .update(updateData)
        .eq('owner_id', user.id)
        .eq('trade_id', tradeId);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update notes';
      throw new Error(message);
    }
  }, [user]);

  // ==================== Work Orders ====================

  const createWorkOrder = useCallback(async (input: CreateWorkOrderInput): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const insertData: WorkOrderInsert = {
        property_id: input.property_id,
        owner_id: user.id,
        trade_id: input.trade_id,
        title: input.title,
        description: input.description,
        category: input.category,
        maintenance_request_id: input.maintenance_request_id || null,
        urgency: input.urgency || 'routine',
        access_instructions: input.access_instructions || null,
        tenant_contact_allowed: input.tenant_contact_allowed ?? false,
        budget_min: input.budget_min ?? null,
        budget_max: input.budget_max ?? null,
        quote_required: input.quote_required ?? true,
        status: 'draft',
      };

      const { data, error } = await (supabase
        .from('work_orders') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to create work order';
      throw new Error(message);
    }
  }, [user]);

  const updateWorkOrder = useCallback(async (
    workOrderId: string,
    updates: WorkOrderUpdate
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('work_orders') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', workOrderId)
        .eq('owner_id', user.id);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update work order';
      throw new Error(message);
    }
  }, [user]);

  const updateWorkOrderStatus = useCallback(async (
    workOrderId: string,
    status: WorkOrderStatus,
    additionalUpdates?: WorkOrderUpdate
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const updateData: WorkOrderUpdate = {
        ...additionalUpdates,
        status,
      };

      const { error } = await (supabase
        .from('work_orders') as ReturnType<typeof supabase.from>)
        .update(updateData)
        .eq('id', workOrderId)
        .eq('owner_id', user.id);

      if (error) throw error;

      // If linked to a maintenance request, update that too
      if (status === 'in_progress') {
        await syncMaintenanceStatus(workOrderId, 'in_progress');
      } else if (status === 'completed') {
        await syncMaintenanceStatus(workOrderId, 'completed');
      }

      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update status';
      throw new Error(message);
    }
  }, [user]);

  const syncMaintenanceStatus = useCallback(async (
    workOrderId: string,
    maintenanceStatus: 'in_progress' | 'completed'
  ): Promise<void> => {
    try {
      const supabase = getSupabaseClient();

      // Get the work order to find linked maintenance request
      const { data: wo } = await (supabase
        .from('work_orders') as ReturnType<typeof supabase.from>)
        .select('maintenance_request_id')
        .eq('id', workOrderId)
        .single();

      const maintenanceRequestId = (wo as any)?.maintenance_request_id;
      if (!maintenanceRequestId) return;

      // Update maintenance request status
      await (supabase.from('maintenance_requests') as ReturnType<typeof supabase.from>)
        .update({ status: maintenanceStatus })
        .eq('id', maintenanceRequestId);
    } catch {
      // Non-critical: don't block the work order status update
    }
  }, []);

  // ==================== Reviews ====================

  const submitReview = useCallback(async (input: SubmitReviewInput): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const insertData: TradeReviewInsert = {
        trade_id: input.trade_id,
        work_order_id: input.work_order_id,
        reviewer_id: user.id,
        rating: input.rating,
        title: input.title || null,
        content: input.content || null,
        would_recommend: input.would_recommend ?? null,
      };

      const { data, error } = await (supabase
        .from('trade_reviews') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to submit review';
      throw new Error(message);
    }
  }, [user]);

  const updateReview = useCallback(async (
    reviewId: string,
    updates: { rating?: number; title?: string | null; content?: string | null; would_recommend?: boolean | null }
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('trade_reviews') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', reviewId)
        .eq('reviewer_id', user.id);

      if (error) throw error;
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update review';
      throw new Error(message);
    }
  }, [user]);

  return {
    // Trade network
    addTrade,
    addToNetwork,
    removeFromNetwork,
    toggleFavorite,
    updateTradeNotes,
    // Work orders
    createWorkOrder,
    updateWorkOrder,
    updateWorkOrderStatus,
    // Reviews
    submitReview,
    updateReview,
  };
}
