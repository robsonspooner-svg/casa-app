// Arrears Management Gateway Hook
// Mission 08: Arrears & Late Payment Management (Gateway for future implementation)
// This hook provides a navigation gateway and placeholder state for arrears features

import { useCallback, useMemo } from 'react';
import type {
  ArrearsRecord,
  PaymentPlan,
  ArrearsAction,
  ArrearsSeverity,
  GatewayListState,
} from '../../types/gateways';

export interface ArrearsGatewayState extends GatewayListState<ArrearsRecord> {
  totalInArrears: number;
  activePaymentPlans: PaymentPlan[];
  recentActions: ArrearsAction[];
  severityLevels: ArrearsSeverity[];
}

export interface ArrearsGatewayActions {
  // Navigation gateways
  navigateToArrearsDashboard: () => void;
  navigateToArrearsDetail: (arrearsRecordId: string) => void;
  navigateToPaymentPlan: (paymentPlanId: string) => void;
  navigateToCreatePaymentPlan: (arrearsRecordId: string) => void;
  // Arrears actions
  sendReminder: (arrearsRecordId: string, templateType: string) => Promise<void>;
  logPhoneCall: (arrearsRecordId: string, notes: string) => Promise<void>;
  createPaymentPlan: (data: CreatePaymentPlanInput) => Promise<string | null>;
  cancelPaymentPlan: (paymentPlanId: string, reason: string) => Promise<void>;
  recordPayment: (arrearsRecordId: string, amount: number) => Promise<void>;
  generateBreachNotice: (arrearsRecordId: string) => Promise<string | null>;
  sendBreachNotice: (arrearsRecordId: string) => Promise<void>;
}

export interface CreatePaymentPlanInput {
  arrears_record_id: string;
  tenancy_id: string;
  total_arrears: number;
  installment_amount: number;
  installment_frequency: 'weekly' | 'fortnightly' | 'monthly';
  start_date: string;
  notes?: string;
}

const SEVERITY_LEVELS: ArrearsSeverity[] = ['minor', 'moderate', 'serious', 'critical'];

/**
 * Gateway hook for arrears management features.
 * Provides navigation entry points and placeholder data for Mission 08.
 *
 * When Mission 08 is implemented, this hook will be replaced with full functionality.
 */
export function useArrearsGateway(
  tenancyId?: string | null
): ArrearsGatewayState & ArrearsGatewayActions {
  // Placeholder state
  const state: ArrearsGatewayState = useMemo(() => ({
    items: [],
    totalInArrears: 0,
    activePaymentPlans: [],
    recentActions: [],
    loading: false,
    error: null,
    isGateway: true,
    severityLevels: SEVERITY_LEVELS,
  }), []);

  // Navigation gateways
  const navigateToArrearsDashboard = useCallback(() => {
    console.log('[Gateway] Navigate to arrears dashboard');
  }, []);

  const navigateToArrearsDetail = useCallback((arrearsRecordId: string) => {
    console.log('[Gateway] Navigate to arrears detail:', arrearsRecordId);
  }, []);

  const navigateToPaymentPlan = useCallback((paymentPlanId: string) => {
    console.log('[Gateway] Navigate to payment plan:', paymentPlanId);
  }, []);

  const navigateToCreatePaymentPlan = useCallback((arrearsRecordId: string) => {
    console.log('[Gateway] Navigate to create payment plan for:', arrearsRecordId);
  }, []);

  // Arrears actions
  const sendReminder = useCallback(async (arrearsRecordId: string, templateType: string): Promise<void> => {
    console.log('[Gateway] Send reminder:', arrearsRecordId, templateType, '- Mission 08 required');
  }, []);

  const logPhoneCall = useCallback(async (arrearsRecordId: string, notes: string): Promise<void> => {
    console.log('[Gateway] Log phone call:', arrearsRecordId, notes, '- Mission 08 required');
  }, []);

  const createPaymentPlan = useCallback(async (_data: CreatePaymentPlanInput): Promise<string | null> => {
    console.log('[Gateway] Create payment plan - Mission 08 required');
    return null;
  }, []);

  const cancelPaymentPlan = useCallback(async (paymentPlanId: string, reason: string): Promise<void> => {
    console.log('[Gateway] Cancel payment plan:', paymentPlanId, reason, '- Mission 08 required');
  }, []);

  const recordPayment = useCallback(async (arrearsRecordId: string, amount: number): Promise<void> => {
    console.log('[Gateway] Record payment:', arrearsRecordId, amount, '- Mission 08 required');
  }, []);

  const generateBreachNotice = useCallback(async (arrearsRecordId: string): Promise<string | null> => {
    console.log('[Gateway] Generate breach notice:', arrearsRecordId, '- Mission 08 required');
    return null;
  }, []);

  const sendBreachNotice = useCallback(async (arrearsRecordId: string): Promise<void> => {
    console.log('[Gateway] Send breach notice:', arrearsRecordId, '- Mission 08 required');
  }, []);

  return {
    ...state,
    navigateToArrearsDashboard,
    navigateToArrearsDetail,
    navigateToPaymentPlan,
    navigateToCreatePaymentPlan,
    sendReminder,
    logPhoneCall,
    createPaymentPlan,
    cancelPaymentPlan,
    recordPayment,
    generateBreachNotice,
    sendBreachNotice,
  };
}

/**
 * Arrears severity configuration for UI display.
 */
export const ARREARS_SEVERITY_CONFIG: Record<ArrearsSeverity, {
  label: string;
  color: string;
  daysRange: string;
  description: string;
}> = {
  minor: {
    label: 'Minor',
    color: '#F59E0B', // Amber
    daysRange: '1-7 days',
    description: 'Friendly reminder stage',
  },
  moderate: {
    label: 'Moderate',
    color: '#F97316', // Orange
    daysRange: '8-14 days',
    description: 'Formal reminder required',
  },
  serious: {
    label: 'Serious',
    color: '#EF4444', // Red
    daysRange: '15-21 days',
    description: 'Final warning before legal action',
  },
  critical: {
    label: 'Critical',
    color: '#DC2626', // Dark red
    daysRange: '22+ days',
    description: 'Breach notice / legal action',
  },
};
