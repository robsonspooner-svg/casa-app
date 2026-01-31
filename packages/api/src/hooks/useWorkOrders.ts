// Work Orders List
// Mission 10: Tradesperson Network

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { WorkOrderRow, WorkOrderStatus, TradeRow, Property, MaintenanceCategory } from '../types/database';

export interface WorkOrdersFilter {
  propertyId?: string;
  tradeId?: string;
  status?: WorkOrderStatus;
  excludeCompleted?: boolean;
}

export interface WorkOrderListItem extends WorkOrderRow {
  trade?: Pick<TradeRow, 'id' | 'business_name' | 'contact_name' | 'phone' | 'avatar_url'>;
  property?: Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>;
}

export interface WorkOrdersSummary {
  total: number;
  byStatus: Partial<Record<WorkOrderStatus, number>>;
  activeCount: number;
}

export function useWorkOrders(filter?: WorkOrdersFilter): {
  workOrders: WorkOrderListItem[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refreshWorkOrders: () => Promise<void>;
  summary: WorkOrdersSummary;
} {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkOrders = useCallback(async (isRefresh = false) => {
    if (!user) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const supabase = getSupabaseClient();

      let query = (supabase
        .from('work_orders') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (filter?.propertyId) {
        query = query.eq('property_id', filter.propertyId);
      }
      if (filter?.tradeId) {
        query = query.eq('trade_id', filter.tradeId);
      }
      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.excludeCompleted) {
        query = query.not('status', 'in', '("completed","cancelled")');
      }

      const { data: woData, error: woError } = await query;
      if (woError) throw new Error(woError.message);
      if (!woData || woData.length === 0) {
        setWorkOrders([]);
        return;
      }

      const orders = woData as unknown as WorkOrderRow[];

      // Collect unique trade and property IDs for enrichment
      const tradeIds = [...new Set(orders.map(wo => wo.trade_id))];
      const propertyIds = [...new Set(orders.map(wo => wo.property_id))];

      // Fetch trades and properties in parallel
      const [tradesResult, propertiesResult] = await Promise.all([
        (supabase
          .from('trades') as ReturnType<typeof supabase.from>)
          .select('id,business_name,contact_name,phone,avatar_url')
          .in('id', tradeIds),
        supabase
          .from('properties')
          .select('id,address_line_1,suburb,state')
          .in('id', propertyIds),
      ]);

      const tradeMap = new Map<string, any>();
      if (tradesResult.data) {
        for (const t of tradesResult.data) {
          tradeMap.set((t as any).id, t);
        }
      }

      const propertyMap = new Map<string, any>();
      if (propertiesResult.data) {
        for (const p of propertiesResult.data) {
          propertyMap.set((p as any).id, p);
        }
      }

      // Enrich orders
      const enriched: WorkOrderListItem[] = orders.map(wo => ({
        ...wo,
        trade: tradeMap.get(wo.trade_id),
        property: propertyMap.get(wo.property_id),
      }));

      setWorkOrders(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, filter?.propertyId, filter?.tradeId, filter?.status, filter?.excludeCompleted]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const refreshWorkOrders = useCallback(async () => {
    await fetchWorkOrders(true);
  }, [fetchWorkOrders]);

  const summary: WorkOrdersSummary = useMemo(() => {
    const byStatus: Partial<Record<WorkOrderStatus, number>> = {};
    let activeCount = 0;
    for (const wo of workOrders) {
      byStatus[wo.status] = (byStatus[wo.status] || 0) + 1;
      if (wo.status !== 'completed' && wo.status !== 'cancelled') {
        activeCount++;
      }
    }
    return { total: workOrders.length, byStatus, activeCount };
  }, [workOrders]);

  return { workOrders, loading, error, refreshing, refreshWorkOrders, summary };
}
