// Single Work Order Detail
// Mission 10: Tradesperson Network

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  WorkOrderWithDetails,
  WorkOrderRow,
  TradeRow,
  Property,
  MaintenanceRequest,
  TradeReviewRow,
} from '../types/database';

export interface WorkOrderState {
  workOrder: WorkOrderWithDetails | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useWorkOrder(workOrderId: string | null): WorkOrderState & {
  refreshWorkOrder: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<WorkOrderState>({
    workOrder: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchWorkOrder = useCallback(async (isRefresh = false) => {
    if (!user || !workOrderId) {
      setState({ workOrder: null, loading: false, error: null, refreshing: false });
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

      // Fetch the work order
      const { data: woData, error: woError } = await (supabase
        .from('work_orders') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', workOrderId)
        .single();

      if (woError) throw new Error(woError.message);
      if (!woData) throw new Error('Work order not found');

      const wo = woData as unknown as WorkOrderRow;

      // Fetch related data in parallel
      const promises: Promise<any>[] = [
        (supabase
          .from('trades') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('id', wo.trade_id)
          .single(),
        supabase
          .from('properties')
          .select('*')
          .eq('id', wo.property_id)
          .single(),
        (supabase
          .from('trade_reviews') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('work_order_id', workOrderId)
          .maybeSingle(),
      ];

      // Optionally fetch linked maintenance request
      if (wo.maintenance_request_id) {
        promises.push(
          (supabase.from('maintenance_requests') as ReturnType<typeof supabase.from>)
            .select('*')
            .eq('id', wo.maintenance_request_id)
            .single()
        );
      }

      const results = await Promise.all(promises);

      const enriched: WorkOrderWithDetails = {
        ...wo,
        trade: (results[0].data ?? undefined) as TradeRow | undefined,
        property: (results[1].data ?? undefined) as Property | undefined,
        review: (results[2].data ?? undefined) as TradeReviewRow | undefined,
        maintenance_request: wo.maintenance_request_id
          ? ((results[3]?.data ?? undefined) as MaintenanceRequest | undefined)
          : undefined,
      };

      setState({
        workOrder: enriched,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch work order';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, workOrderId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkOrder();
    }
  }, [fetchWorkOrder, isAuthenticated]);

  const refreshWorkOrder = useCallback(async () => {
    await fetchWorkOrder(true);
  }, [fetchWorkOrder]);

  return {
    ...state,
    refreshWorkOrder,
  };
}
