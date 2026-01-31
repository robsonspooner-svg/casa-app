// Tradesperson Network Gateway Hook
// Mission 10: Tradesperson Network (Gateway for future implementation)
// This hook provides a navigation gateway and placeholder state for trade features

import { useCallback, useMemo } from 'react';
import type {
  Trade,
  WorkOrder,
  TradeReview,
  MaintenanceCategory,
  GatewayListState,
} from '../../types/gateways';

export interface TradesGatewayState extends GatewayListState<Trade> {
  favorites: Trade[];
  workOrders: WorkOrder[];
}

export interface TradesGatewayActions {
  // Navigation gateways
  navigateToTradesList: () => void;
  navigateToTradeDetail: (tradeId: string) => void;
  navigateToTradeSearch: (category?: MaintenanceCategory) => void;
  navigateToWorkOrders: () => void;
  navigateToWorkOrderDetail: (workOrderId: string) => void;
  navigateToCreateWorkOrder: (maintenanceRequestId?: string) => void;
  // Placeholder actions
  addTradeToNetwork: (tradeId: string) => Promise<void>;
  removeTradeFromNetwork: (tradeId: string) => Promise<void>;
  setTradeFavorite: (tradeId: string, isFavorite: boolean) => Promise<void>;
  createWorkOrder: (data: CreateWorkOrderInput) => Promise<string | null>;
  approveQuote: (workOrderId: string) => Promise<void>;
  rejectQuote: (workOrderId: string, reason?: string) => Promise<void>;
  markJobComplete: (workOrderId: string) => Promise<void>;
  submitReview: (workOrderId: string, review: ReviewInput) => Promise<void>;
}

export interface CreateWorkOrderInput {
  maintenance_request_id?: string;
  property_id: string;
  trade_id: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  urgency: 'emergency' | 'urgent' | 'routine';
  budget_min?: number;
  budget_max?: number;
  quote_required: boolean;
}

export interface ReviewInput {
  rating: number;
  title?: string;
  content?: string;
  would_recommend?: boolean;
}

/**
 * Gateway hook for tradesperson network features.
 * Provides navigation entry points and placeholder data for Mission 10.
 *
 * When Mission 10 is implemented, this hook will be replaced with full functionality.
 */
export function useTradesGateway(): TradesGatewayState & TradesGatewayActions {
  // Placeholder state
  const state: TradesGatewayState = useMemo(() => ({
    items: [],
    favorites: [],
    workOrders: [],
    loading: false,
    error: null,
    isGateway: true,
  }), []);

  // Navigation gateways
  const navigateToTradesList = useCallback(() => {
    console.log('[Gateway] Navigate to trades list');
  }, []);

  const navigateToTradeDetail = useCallback((tradeId: string) => {
    console.log('[Gateway] Navigate to trade detail:', tradeId);
  }, []);

  const navigateToTradeSearch = useCallback((category?: MaintenanceCategory) => {
    console.log('[Gateway] Navigate to trade search, category:', category);
  }, []);

  const navigateToWorkOrders = useCallback(() => {
    console.log('[Gateway] Navigate to work orders');
  }, []);

  const navigateToWorkOrderDetail = useCallback((workOrderId: string) => {
    console.log('[Gateway] Navigate to work order detail:', workOrderId);
  }, []);

  const navigateToCreateWorkOrder = useCallback((maintenanceRequestId?: string) => {
    console.log('[Gateway] Navigate to create work order, maintenance:', maintenanceRequestId);
  }, []);

  // Placeholder actions
  const addTradeToNetwork = useCallback(async (tradeId: string): Promise<void> => {
    console.log('[Gateway] Add trade to network:', tradeId, '- Mission 10 required');
  }, []);

  const removeTradeFromNetwork = useCallback(async (tradeId: string): Promise<void> => {
    console.log('[Gateway] Remove trade from network:', tradeId, '- Mission 10 required');
  }, []);

  const setTradeFavorite = useCallback(async (tradeId: string, isFavorite: boolean): Promise<void> => {
    console.log('[Gateway] Set trade favorite:', tradeId, isFavorite, '- Mission 10 required');
  }, []);

  const createWorkOrder = useCallback(async (_data: CreateWorkOrderInput): Promise<string | null> => {
    console.log('[Gateway] Create work order - Mission 10 required');
    return null;
  }, []);

  const approveQuote = useCallback(async (workOrderId: string): Promise<void> => {
    console.log('[Gateway] Approve quote:', workOrderId, '- Mission 10 required');
  }, []);

  const rejectQuote = useCallback(async (workOrderId: string, reason?: string): Promise<void> => {
    console.log('[Gateway] Reject quote:', workOrderId, reason, '- Mission 10 required');
  }, []);

  const markJobComplete = useCallback(async (workOrderId: string): Promise<void> => {
    console.log('[Gateway] Mark job complete:', workOrderId, '- Mission 10 required');
  }, []);

  const submitReview = useCallback(async (workOrderId: string, _review: ReviewInput): Promise<void> => {
    console.log('[Gateway] Submit review for work order:', workOrderId, '- Mission 10 required');
  }, []);

  return {
    ...state,
    navigateToTradesList,
    navigateToTradeDetail,
    navigateToTradeSearch,
    navigateToWorkOrders,
    navigateToWorkOrderDetail,
    navigateToCreateWorkOrder,
    addTradeToNetwork,
    removeTradeFromNetwork,
    setTradeFavorite,
    createWorkOrder,
    approveQuote,
    rejectQuote,
    markJobComplete,
    submitReview,
  };
}
