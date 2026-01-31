// useRentSchedule Hook - Rent Schedule for a Tenancy
// Mission 07: Rent Collection & Payments

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { RentSchedule } from '../types/database';

export interface RentScheduleState {
  schedules: RentSchedule[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  nextDue: RentSchedule | null;
  totalOwed: number;
}

export function useRentSchedule(tenancyId?: string): RentScheduleState & { refreshSchedule: () => Promise<void> } {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<RentScheduleState>({
    schedules: [],
    loading: true,
    error: null,
    refreshing: false,
    nextDue: null,
    totalOwed: 0,
  });

  const fetchSchedule = useCallback(async (isRefresh = false) => {
    if (!user || !tenancyId) {
      setState({ schedules: [], loading: false, error: null, refreshing: false, nextDue: null, totalOwed: 0 });
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

      const { data, error } = await (supabase
        .from('rent_schedules') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const schedules = (data || []) as RentSchedule[];

      // Find next unpaid due date
      const today = new Date().toISOString().split('T')[0];
      const nextDue = schedules.find(s => !s.is_paid && s.due_date >= today) || null;

      // Calculate total owed (all unpaid up to and including today)
      const totalOwed = schedules
        .filter(s => !s.is_paid && s.due_date <= today)
        .reduce((sum, s) => sum + Number(s.amount), 0);

      setState({
        schedules,
        loading: false,
        error: null,
        refreshing: false,
        nextDue,
        totalOwed,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch rent schedule';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, tenancyId]);

  useEffect(() => {
    if (isAuthenticated && tenancyId) {
      fetchSchedule();
    }
  }, [fetchSchedule, isAuthenticated, tenancyId]);

  const refreshSchedule = useCallback(async () => {
    await fetchSchedule(true);
  }, [fetchSchedule]);

  return {
    ...state,
    refreshSchedule,
  };
}
