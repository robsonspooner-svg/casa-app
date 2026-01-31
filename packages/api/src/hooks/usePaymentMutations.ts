// usePaymentMutations Hook - Payment Operations
// Mission 07: Rent Collection & Payments

import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { PaymentInsert, PaymentMethod } from '../types/database';

export interface PaymentMutations {
  createPayment: (payment: Omit<PaymentInsert, 'tenant_id'>) => Promise<string>;
  setDefaultMethod: (methodId: string) => Promise<void>;
  removeMethod: (methodId: string) => Promise<void>;
  updateAutoPay: (tenancyId: string, settings: AutoPayInput) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export interface AutoPayInput {
  paymentMethodId: string;
  isEnabled: boolean;
  daysBeforeDue: number;
  maxAmount?: number;
}

export function usePaymentMutations(): PaymentMutations {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPayment = useCallback(async (payment: Omit<PaymentInsert, 'tenant_id'>): Promise<string> => {
    if (!user) throw new Error('Must be authenticated');

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const { data, error: insertError } = await (supabase
        .from('payments') as ReturnType<typeof supabase.from>)
        .insert({
          ...payment,
          tenant_id: user.id,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      return (data as { id: string }).id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create payment';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const setDefaultMethod = useCallback(async (methodId: string): Promise<void> => {
    if (!user) throw new Error('Must be authenticated');

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Remove default from all methods
      await (supabase
        .from('payment_methods') as ReturnType<typeof supabase.from>)
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      const { error: updateError } = await (supabase
        .from('payment_methods') as ReturnType<typeof supabase.from>)
        .update({ is_default: true })
        .eq('id', methodId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set default method';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const removeMethod = useCallback(async (methodId: string): Promise<void> => {
    if (!user) throw new Error('Must be authenticated');

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Soft delete - mark as inactive
      const { error: updateError } = await (supabase
        .from('payment_methods') as ReturnType<typeof supabase.from>)
        .update({ is_active: false })
        .eq('id', methodId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove payment method';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateAutoPay = useCallback(async (tenancyId: string, settings: AutoPayInput): Promise<void> => {
    if (!user) throw new Error('Must be authenticated');

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const { error: upsertError } = await (supabase
        .from('autopay_settings') as ReturnType<typeof supabase.from>)
        .upsert({
          tenancy_id: tenancyId,
          tenant_id: user.id,
          payment_method_id: settings.paymentMethodId,
          is_enabled: settings.isEnabled,
          days_before_due: settings.daysBeforeDue,
          max_amount: settings.maxAmount,
        }, { onConflict: 'tenancy_id' });

      if (upsertError) throw upsertError;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update auto-pay settings';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    createPayment,
    setDefaultMethod,
    removeMethod,
    updateAutoPay,
    loading,
    error,
  };
}
