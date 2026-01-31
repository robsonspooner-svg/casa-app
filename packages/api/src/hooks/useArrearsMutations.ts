// useArrearsMutations Hook - Arrears Actions & Mutations
// Mission 08: Arrears & Late Payment Management

import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  ArrearsActionInsert,
  ArrearsActionType,
  PaymentPlanInsert,
  PaymentFrequency,
} from '../types/database';

export interface CreatePaymentPlanInput {
  arrears_record_id: string;
  tenancy_id: string;
  total_arrears: number;
  installment_amount: number;
  installment_frequency: PaymentFrequency;
  start_date: string;
  notes?: string;
}

export interface LogActionInput {
  arrears_record_id: string;
  action_type: ArrearsActionType;
  description: string;
  sent_to?: string;
  metadata?: Record<string, unknown>;
}

export interface SendReminderInput {
  arrears_record_id: string;
  template_id?: string;
  tenant_email: string;
  tenant_name: string;
  amount: number;
  days_overdue: number;
  property_address: string;
  owner_name: string;
}

export function useArrearsMutations() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a payment plan for a tenant in arrears
  const createPaymentPlan = useCallback(async (input: CreatePaymentPlanInput): Promise<string | null> => {
    if (!user) {
      setError('Not authenticated');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Calculate expected end date and total installments
      const totalInstallments = Math.ceil(input.total_arrears / input.installment_amount);

      // Create the payment plan
      const planData: PaymentPlanInsert = {
        arrears_record_id: input.arrears_record_id,
        tenancy_id: input.tenancy_id,
        total_arrears: input.total_arrears,
        installment_amount: input.installment_amount,
        installment_frequency: input.installment_frequency,
        start_date: input.start_date,
        total_installments: totalInstallments,
        notes: input.notes,
      };

      const { data: plan, error: planError } = await (supabase
        .from('payment_plans') as any)
        .insert(planData)
        .select()
        .single();

      if (planError) throw planError;

      // Generate installments via RPC function
      const { error: installmentsError } = await (supabase.rpc as any)('generate_payment_plan_installments', {
        p_plan_id: plan.id,
        p_total_amount: input.total_arrears,
        p_installment_amount: input.installment_amount,
        p_frequency: input.installment_frequency,
        p_start_date: input.start_date,
      });

      if (installmentsError) {
        console.warn('Failed to generate installments via RPC, installments may need manual creation:', installmentsError);
      }

      // Update arrears record to link payment plan
      const { error: updateError } = await (supabase
        .from('arrears_records') as any)
        .update({
          has_payment_plan: true,
          payment_plan_id: plan.id,
        })
        .eq('id', input.arrears_record_id);

      if (updateError) throw updateError;

      // Log the action
      await logAction({
        arrears_record_id: input.arrears_record_id,
        action_type: 'payment_plan_created',
        description: `Payment plan created: $${input.installment_amount} ${input.installment_frequency} starting ${input.start_date}`,
        metadata: {
          plan_id: plan.id,
          total_arrears: input.total_arrears,
          installment_amount: input.installment_amount,
          installment_frequency: input.installment_frequency,
        },
      });

      return plan.id;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to create payment plan';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Cancel a payment plan
  const cancelPaymentPlan = useCallback(async (paymentPlanId: string, reason: string, arrearsRecordId: string): Promise<boolean> => {
    if (!user) {
      setError('Not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Update payment plan status
      const { error: planError } = await (supabase
        .from('payment_plans') as any)
        .update({ status: 'cancelled' })
        .eq('id', paymentPlanId);

      if (planError) throw planError;

      // Update arrears record
      const { error: arrearsError } = await (supabase
        .from('arrears_records') as any)
        .update({
          has_payment_plan: false,
          payment_plan_id: null,
        })
        .eq('id', arrearsRecordId);

      if (arrearsError) throw arrearsError;

      // Log the action
      await logAction({
        arrears_record_id: arrearsRecordId,
        action_type: 'payment_plan_updated',
        description: `Payment plan cancelled: ${reason}`,
        metadata: { plan_id: paymentPlanId, reason },
      });

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to cancel payment plan';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Log an action (phone call, note, etc.)
  const logAction = useCallback(async (input: LogActionInput): Promise<boolean> => {
    if (!user) {
      setError('Not authenticated');
      return false;
    }

    try {
      const supabase = getSupabaseClient();

      const actionData: ArrearsActionInsert = {
        arrears_record_id: input.arrears_record_id,
        action_type: input.action_type,
        description: input.description,
        sent_to: input.sent_to,
        performed_by: user.id,
        is_automated: false,
        metadata: input.metadata,
      };

      const { error: actionError } = await (supabase
        .from('arrears_actions') as any)
        .insert(actionData);

      if (actionError) throw actionError;

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to log action';
      setError(errorMessage);
      return false;
    }
  }, [user]);

  // Log a phone call
  const logPhoneCall = useCallback(async (arrearsRecordId: string, notes: string): Promise<boolean> => {
    return logAction({
      arrears_record_id: arrearsRecordId,
      action_type: 'phone_call',
      description: notes,
    });
  }, [logAction]);

  // Log a note
  const logNote = useCallback(async (arrearsRecordId: string, note: string): Promise<boolean> => {
    return logAction({
      arrears_record_id: arrearsRecordId,
      action_type: 'note',
      description: note,
    });
  }, [logAction]);

  // Send a reminder email (calls Edge Function)
  const sendReminder = useCallback(async (input: SendReminderInput): Promise<boolean> => {
    if (!user) {
      setError('Not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Get the session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Call the send-arrears-reminder Edge Function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-arrears-reminder`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            arrears_record_id: input.arrears_record_id,
            template_id: input.template_id,
            tenant_email: input.tenant_email,
            tenant_name: input.tenant_name,
            amount: input.amount,
            days_overdue: input.days_overdue,
            property_address: input.property_address,
            owner_name: input.owner_name,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to send reminder');
      }

      // Log the action
      await logAction({
        arrears_record_id: input.arrears_record_id,
        action_type: 'reminder_email',
        description: `Reminder email sent to ${input.tenant_email}`,
        sent_to: input.tenant_email,
        metadata: {
          template_id: input.template_id,
          days_overdue: input.days_overdue,
          amount: input.amount,
        },
      });

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to send reminder';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, logAction]);

  // Send a breach notice
  const sendBreachNotice = useCallback(async (
    arrearsRecordId: string,
    tenantEmail: string,
    state: string
  ): Promise<boolean> => {
    if (!user) {
      setError('Not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Get the session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Call the send-breach-notice Edge Function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-breach-notice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            arrears_record_id: arrearsRecordId,
            state,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to send breach notice');
      }

      // Log the action
      await logAction({
        arrears_record_id: arrearsRecordId,
        action_type: 'breach_notice',
        description: `Breach notice (${state}) sent to ${tenantEmail}`,
        sent_to: tenantEmail,
        metadata: { state },
      });

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to send breach notice';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, logAction]);

  // Resolve arrears manually (e.g., payment received outside system)
  const resolveArrears = useCallback(async (arrearsRecordId: string, reason: string): Promise<boolean> => {
    if (!user) {
      setError('Not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const { error: updateError } = await (supabase
        .from('arrears_records') as any)
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_reason: reason,
        })
        .eq('id', arrearsRecordId);

      if (updateError) throw updateError;

      // Log the action
      await logAction({
        arrears_record_id: arrearsRecordId,
        action_type: 'note',
        description: `Arrears resolved: ${reason}`,
      });

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to resolve arrears';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, logAction]);

  return {
    loading,
    error,
    createPaymentPlan,
    cancelPaymentPlan,
    logAction,
    logPhoneCall,
    logNote,
    sendReminder,
    sendBreachNotice,
    resolveArrears,
  };
}
