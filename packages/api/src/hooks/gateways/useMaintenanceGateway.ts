// Maintenance Requests Gateway Hook
// Mission 09: Maintenance Requests (Gateway for future implementation)
// This hook provides a navigation gateway and placeholder state for maintenance features

import { useCallback, useMemo } from 'react';
import type {
  MaintenanceRequest,
  MaintenanceCategory,
  MaintenanceUrgency,
  GatewayListState,
} from '../../types/gateways';

export interface MaintenanceGatewayState extends GatewayListState<MaintenanceRequest> {
  categories: MaintenanceCategory[];
  urgencyLevels: MaintenanceUrgency[];
}

export interface MaintenanceGatewayActions {
  // Navigation gateways
  navigateToMaintenanceList: () => void;
  navigateToMaintenanceDetail: (requestId: string) => void;
  navigateToCreateMaintenance: (tenancyId: string) => void;
  // Placeholder actions (will be implemented in Mission 09)
  submitRequest: (data: CreateMaintenanceInput) => Promise<string | null>;
  acknowledgeRequest: (requestId: string) => Promise<void>;
  updateStatus: (requestId: string, status: MaintenanceRequest['status']) => Promise<void>;
}

export interface CreateMaintenanceInput {
  tenancy_id: string;
  property_id: string;
  category: MaintenanceCategory;
  urgency: MaintenanceUrgency;
  title: string;
  description: string;
  location?: string;
  photos?: string[];
}

const CATEGORIES: MaintenanceCategory[] = [
  'plumbing',
  'electrical',
  'appliance',
  'hvac',
  'structural',
  'pest',
  'locks',
  'garden',
  'cleaning',
  'other',
];

const URGENCY_LEVELS: MaintenanceUrgency[] = ['emergency', 'urgent', 'routine'];

/**
 * Gateway hook for maintenance request features.
 * Provides navigation entry points and placeholder data for Mission 09.
 *
 * When Mission 09 is implemented, this hook will be replaced with full functionality.
 */
export function useMaintenanceGateway(
  tenancyId?: string | null
): MaintenanceGatewayState & MaintenanceGatewayActions {
  // Placeholder state - returns empty list
  const state: MaintenanceGatewayState = useMemo(() => ({
    items: [],
    loading: false,
    error: null,
    isGateway: true,
    categories: CATEGORIES,
    urgencyLevels: URGENCY_LEVELS,
  }), []);

  // Navigation gateways - these work now and will route to real screens
  const navigateToMaintenanceList = useCallback(() => {
    // Will be: router.push('/(app)/maintenance')
    console.log('[Gateway] Navigate to maintenance list');
  }, []);

  const navigateToMaintenanceDetail = useCallback((requestId: string) => {
    // Will be: router.push(`/(app)/maintenance/${requestId}`)
    console.log('[Gateway] Navigate to maintenance detail:', requestId);
  }, []);

  const navigateToCreateMaintenance = useCallback((tenancyIdParam: string) => {
    // Will be: router.push(`/(app)/maintenance/create?tenancyId=${tenancyId}`)
    console.log('[Gateway] Navigate to create maintenance for tenancy:', tenancyIdParam);
  }, []);

  // Placeholder actions - will be implemented in Mission 09
  const submitRequest = useCallback(async (_data: CreateMaintenanceInput): Promise<string | null> => {
    console.log('[Gateway] Submit maintenance request - Mission 09 required');
    return null;
  }, []);

  const acknowledgeRequest = useCallback(async (requestId: string): Promise<void> => {
    console.log('[Gateway] Acknowledge maintenance request:', requestId, '- Mission 09 required');
  }, []);

  const updateStatus = useCallback(async (
    requestId: string,
    status: MaintenanceRequest['status']
  ): Promise<void> => {
    console.log('[Gateway] Update maintenance status:', requestId, status, '- Mission 09 required');
  }, []);

  return {
    ...state,
    navigateToMaintenanceList,
    navigateToMaintenanceDetail,
    navigateToCreateMaintenance,
    submitRequest,
    acknowledgeRequest,
    updateStatus,
  };
}
