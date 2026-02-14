// useTenancyMutations Hook - Tenancy CRUD Operations
// Mission 06: Tenancies & Leases

import { useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { TenancyInsert, TenancyUpdate, TenancyStatus } from '../types/database';

export interface TenancyMutations {
  createTenancy: (data: TenancyInsert, tenantIds: string[]) => Promise<string>;
  updateTenancy: (tenancyId: string, data: TenancyUpdate) => Promise<void>;
  updateTenancyStatus: (tenancyId: string, status: TenancyStatus, reason?: string) => Promise<void>;
  addTenant: (tenancyId: string, tenantId: string, isPrimary?: boolean) => Promise<void>;
  removeTenant: (tenancyId: string, tenantId: string) => Promise<void>;
  createRentIncrease: (data: RentIncreaseInput) => Promise<string>;
  cancelRentIncrease: (rentIncreaseId: string) => Promise<void>;
  uploadDocument: (tenancyId: string, doc: DocumentUpload) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
}

export interface RentIncreaseInput {
  tenancy_id: string;
  current_amount: number;
  new_amount: number;
  notice_date: string;
  effective_date: string;
  minimum_notice_days: number;
  justification?: string;
}

export interface DocumentUpload {
  document_type: string;
  title: string;
  file_name: string;
  storage_path: string;
  url: string;
}

export function useTenancyMutations(): TenancyMutations {
  const { user } = useAuth();

  const createTenancy = useCallback(async (data: TenancyInsert, tenantIds: string[]): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    // Create the tenancy
    const { data: tenancy, error } = await (supabase
      .from('tenancies') as ReturnType<typeof supabase.from>)
      .insert(data)
      .select('id')
      .single();

    if (error) throw error;
    const tenancyId = (tenancy as { id: string }).id;

    // Add tenants
    if (tenantIds.length > 0) {
      const tenantRecords = tenantIds.map((tenantId, index) => ({
        tenancy_id: tenancyId,
        tenant_id: tenantId,
        is_primary: index === 0,
        is_leaseholder: true,
        moved_in_date: data.lease_start_date,
      }));

      const { error: tenantsError } = await (supabase
        .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
        .insert(tenantRecords);

      if (tenantsError) throw tenantsError;
    }

    // Generate rent schedule for the tenancy
    // This populates the rent_schedules table with all due dates
    if (data.lease_start_date && data.lease_end_date && data.rent_amount && data.rent_frequency) {
      const rpcCall = supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>
      ) => Promise<{ error: Error | null }>;

      const { error: scheduleError } = await rpcCall('generate_rent_schedule', {
        p_tenancy_id: tenancyId,
        p_start_date: data.lease_start_date,
        p_end_date: data.lease_end_date,
        p_amount: data.rent_amount,
        p_frequency: data.rent_frequency,
      });

      if (scheduleError) {
        throw new Error(`Tenancy created but rent schedule failed: ${scheduleError.message || 'Unknown error'}`);
      }
    }

    return tenancyId;
  }, [user]);

  const updateTenancy = useCallback(async (tenancyId: string, data: TenancyUpdate): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('tenancies') as ReturnType<typeof supabase.from>)
      .update(data)
      .eq('id', tenancyId);

    if (error) throw error;

    // Regenerate rent schedule when lease terms change
    const leaseFieldsChanged = data.rent_amount !== undefined
      || data.rent_frequency !== undefined
      || data.lease_start_date !== undefined
      || data.lease_end_date !== undefined;

    if (leaseFieldsChanged) {
      // @ts-expect-error - RPC function types not generated for custom functions
      const { error: scheduleError } = await supabase.rpc('generate_rent_schedule', {
        p_tenancy_id: tenancyId,
      });

      if (scheduleError) {
        console.warn('Rent schedule regeneration failed:', scheduleError.message);
      }
    }
  }, [user]);

  const updateTenancyStatus = useCallback(async (
    tenancyId: string,
    status: TenancyStatus,
    reason?: string
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const updateData: TenancyUpdate = { status };

    if (status === 'ending') {
      updateData.notice_given_date = new Date().toISOString().split('T')[0];
    }

    if (status === 'ended' || status === 'terminated') {
      updateData.actual_end_date = new Date().toISOString().split('T')[0];
      if (reason) updateData.end_reason = reason;
    }

    const { error } = await (supabase
      .from('tenancies') as ReturnType<typeof supabase.from>)
      .update(updateData)
      .eq('id', tenancyId);

    if (error) throw error;
  }, [user]);

  const addTenant = useCallback(async (
    tenancyId: string,
    tenantId: string,
    isPrimary = false
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
      .insert({
        tenancy_id: tenancyId,
        tenant_id: tenantId,
        is_primary: isPrimary,
        is_leaseholder: true,
      });

    if (error) throw error;
  }, [user]);

  const removeTenant = useCallback(async (tenancyId: string, tenantId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('tenancy_id', tenancyId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }, [user]);

  const createRentIncrease = useCallback(async (data: RentIncreaseInput): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const increasePercentage = ((data.new_amount - data.current_amount) / data.current_amount) * 100;

    const { data: result, error } = await (supabase
      .from('rent_increases') as ReturnType<typeof supabase.from>)
      .insert({
        ...data,
        increase_percentage: Math.round(increasePercentage * 100) / 100,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) throw error;
    return (result as { id: string }).id;
  }, [user]);

  const cancelRentIncrease = useCallback(async (rentIncreaseId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('rent_increases') as ReturnType<typeof supabase.from>)
      .update({ status: 'cancelled' })
      .eq('id', rentIncreaseId);

    if (error) throw error;
  }, [user]);

  const uploadDocument = useCallback(async (tenancyId: string, doc: DocumentUpload): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('tenancy_documents') as ReturnType<typeof supabase.from>)
      .insert({
        tenancy_id: tenancyId,
        document_type: doc.document_type,
        title: doc.title,
        file_name: doc.file_name,
        storage_path: doc.storage_path,
        url: doc.url,
        uploaded_by: user.id,
      });

    if (error) throw error;
  }, [user]);

  const deleteDocument = useCallback(async (documentId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('tenancy_documents') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  }, [user]);

  return {
    createTenancy,
    updateTenancy,
    updateTenancyStatus,
    addTenant,
    removeTenant,
    createRentIncrease,
    cancelRentIncrease,
    uploadDocument,
    deleteDocument,
  };
}
