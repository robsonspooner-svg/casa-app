// useTenantAvailability Hook - Tenant Availability for AI Matching
// Tenant-Owner Connection System

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  TenantAvailability,
  TenantAvailabilityInsert,
  TenantAvailabilityUpdate,
  TenantEmploymentStatus,
} from '../types/database';

export interface TenantAvailabilityState {
  availability: TenantAvailability | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
}

export interface TenantAvailabilityActions {
  createAvailability: (input: CreateAvailabilityInput) => Promise<TenantAvailability | null>;
  updateAvailability: (updates: UpdateAvailabilityInput) => Promise<TenantAvailability | null>;
  deactivate: () => Promise<void>;
  reactivate: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface CreateAvailabilityInput {
  preferredSuburbs?: string[];
  minBedrooms?: number;
  maxRentWeekly?: number;
  moveInDate?: string;
  hasPets?: boolean;
  petDetails?: string;
  employmentStatus?: TenantEmploymentStatus;
  rentalHistoryYears?: number;
  hasReferences?: boolean;
  notes?: string;
}

export interface UpdateAvailabilityInput {
  preferredSuburbs?: string[];
  minBedrooms?: number;
  maxRentWeekly?: number;
  moveInDate?: string;
  hasPets?: boolean;
  petDetails?: string;
  employmentStatus?: TenantEmploymentStatus;
  rentalHistoryYears?: number;
  hasReferences?: boolean;
  notes?: string;
}

/**
 * Hook for tenants to manage their availability profile for AI matching.
 * When active, the AI agent can suggest this tenant to property owners.
 */
export function useTenantAvailability(): TenantAvailabilityState & TenantAvailabilityActions {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<TenantAvailabilityState>({
    availability: null,
    loading: true,
    error: null,
    saving: false,
  });

  const fetchAvailability = useCallback(async () => {
    if (!user) {
      setState({ availability: null, loading: false, error: null, saving: false });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('tenant_availability') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenant_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      setState({
        availability: (data as TenantAvailability) || null,
        loading: false,
        error: null,
        saving: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch availability';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAvailability();
    }
  }, [fetchAvailability, isAuthenticated]);

  const createAvailability = useCallback(async (input: CreateAvailabilityInput): Promise<TenantAvailability | null> => {
    if (!user) throw new Error('Must be authenticated');

    setState(prev => ({ ...prev, saving: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const insertData: TenantAvailabilityInsert = {
        tenant_id: user.id,
        preferred_suburbs: input.preferredSuburbs || [],
        min_bedrooms: input.minBedrooms || 1,
        max_rent_weekly: input.maxRentWeekly || null,
        move_in_date: input.moveInDate || null,
        has_pets: input.hasPets || false,
        pet_details: input.petDetails || null,
        employment_status: input.employmentStatus || null,
        rental_history_years: input.rentalHistoryYears || 0,
        has_references: input.hasReferences || false,
        is_active: true,
        notes: input.notes || null,
      };

      const { data, error } = await (supabase
        .from('tenant_availability') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const availability = data as TenantAvailability;
      setState(prev => ({
        ...prev,
        availability,
        saving: false,
        error: null,
      }));

      return availability;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to create availability';
      setState(prev => ({ ...prev, saving: false, error: errorMessage }));
      return null;
    }
  }, [user]);

  const updateAvailability = useCallback(async (updates: UpdateAvailabilityInput): Promise<TenantAvailability | null> => {
    if (!user || !state.availability) throw new Error('Must be authenticated and have availability');

    setState(prev => ({ ...prev, saving: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const updateData: TenantAvailabilityUpdate = {};
      if (updates.preferredSuburbs !== undefined) updateData.preferred_suburbs = updates.preferredSuburbs;
      if (updates.minBedrooms !== undefined) updateData.min_bedrooms = updates.minBedrooms;
      if (updates.maxRentWeekly !== undefined) updateData.max_rent_weekly = updates.maxRentWeekly;
      if (updates.moveInDate !== undefined) updateData.move_in_date = updates.moveInDate;
      if (updates.hasPets !== undefined) updateData.has_pets = updates.hasPets;
      if (updates.petDetails !== undefined) updateData.pet_details = updates.petDetails;
      if (updates.employmentStatus !== undefined) updateData.employment_status = updates.employmentStatus;
      if (updates.rentalHistoryYears !== undefined) updateData.rental_history_years = updates.rentalHistoryYears;
      if (updates.hasReferences !== undefined) updateData.has_references = updates.hasReferences;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { data, error } = await (supabase
        .from('tenant_availability') as ReturnType<typeof supabase.from>)
        .update(updateData)
        .eq('id', state.availability.id)
        .eq('tenant_id', user.id)
        .select()
        .single();

      if (error) throw error;

      const availability = data as TenantAvailability;
      setState(prev => ({
        ...prev,
        availability,
        saving: false,
        error: null,
      }));

      return availability;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to update availability';
      setState(prev => ({ ...prev, saving: false, error: errorMessage }));
      return null;
    }
  }, [user, state.availability]);

  const deactivate = useCallback(async (): Promise<void> => {
    if (!user || !state.availability) throw new Error('Must be authenticated and have availability');

    setState(prev => ({ ...prev, saving: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('tenant_availability') as ReturnType<typeof supabase.from>)
        .update({ is_active: false })
        .eq('id', state.availability.id)
        .eq('tenant_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        availability: data as TenantAvailability,
        saving: false,
        error: null,
      }));
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to deactivate availability';
      setState(prev => ({ ...prev, saving: false, error: errorMessage }));
      throw caught;
    }
  }, [user, state.availability]);

  const reactivate = useCallback(async (): Promise<void> => {
    if (!user || !state.availability) throw new Error('Must be authenticated and have availability');

    setState(prev => ({ ...prev, saving: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('tenant_availability') as ReturnType<typeof supabase.from>)
        .update({ is_active: true, matched_at: null })
        .eq('id', state.availability.id)
        .eq('tenant_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        availability: data as TenantAvailability,
        saving: false,
        error: null,
      }));
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to reactivate availability';
      setState(prev => ({ ...prev, saving: false, error: errorMessage }));
      throw caught;
    }
  }, [user, state.availability]);

  const refresh = useCallback(async () => {
    await fetchAvailability();
  }, [fetchAvailability]);

  return {
    ...state,
    createAvailability,
    updateAvailability,
    deactivate,
    reactivate,
    refresh,
  };
}
