// useConnection Hook - Tenant Connection to Properties/Owners
// Tenant-Owner Connection System

import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { ConnectionType } from '../types/database';

export interface ConnectionResult {
  success: boolean;
  message: string;
  connectionType: ConnectionType | null;
  propertyId: string | null;
  tenancyId: string | null;
  ownerId: string | null;
}

export interface ConnectionState {
  connecting: boolean;
  error: string | null;
  lastResult: ConnectionResult | null;
}

export interface ConnectionActions {
  useCode: (code: string) => Promise<ConnectionResult>;
  connectToTenancy: (tenancyId: string, code: string) => Promise<boolean>;
  connectToProperty: (propertyId: string, ownerId: string, code: string) => Promise<boolean>;
  clearError: () => void;
}

/**
 * Hook for tenants to connect to properties/tenancies using connection codes.
 */
export function useConnection(): ConnectionState & ConnectionActions {
  const { user } = useAuth();
  const [state, setState] = useState<ConnectionState>({
    connecting: false,
    error: null,
    lastResult: null,
  });

  /**
   * Validate and use a connection code.
   * Returns the connection details if valid.
   */
  const useCode = useCallback(async (code: string): Promise<ConnectionResult> => {
    if (!user) {
      return {
        success: false,
        message: 'You must be signed in to use a connection code',
        connectionType: null,
        propertyId: null,
        tenancyId: null,
        ownerId: null,
      };
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // Call the RPC function to validate and use the code
      // @ts-expect-error - RPC function types not generated for custom functions
      const { data, error } = await supabase.rpc('use_connection_code', {
        p_code: code.toUpperCase().trim(),
        p_user_id: user.id,
      });

      if (error) throw error;

      // RPC returns an array for table-returning functions
      const results = data as Array<{
        success: boolean;
        message: string;
        connection_type: ConnectionType | null;
        property_id: string | null;
        tenancy_id: string | null;
        owner_id: string | null;
      }> | null;

      const result = results?.[0];
      if (!result) {
        throw new Error('Invalid response from server');
      }

      const connectionResult: ConnectionResult = {
        success: result.success,
        message: result.message,
        connectionType: result.connection_type,
        propertyId: result.property_id,
        tenancyId: result.tenancy_id,
        ownerId: result.owner_id,
      };

      setState(prev => ({
        ...prev,
        connecting: false,
        error: result.success ? null : result.message,
        lastResult: connectionResult,
      }));

      return connectionResult;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to validate code';
      setState(prev => ({
        ...prev,
        connecting: false,
        error: errorMessage,
        lastResult: null,
      }));
      return {
        success: false,
        message: errorMessage,
        connectionType: null,
        propertyId: null,
        tenancyId: null,
        ownerId: null,
      };
    }
  }, [user]);

  /**
   * Connect tenant to a tenancy after code validation.
   * Creates the tenancy_tenants record to officially link them.
   */
  const connectToTenancy = useCallback(async (tenancyId: string, code: string): Promise<boolean> => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'Must be authenticated' }));
      return false;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // First, check if already connected
      const { data: existing } = await (supabase
        .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('tenancy_id', tenancyId)
        .eq('tenant_id', user.id)
        .single();

      if (existing) {
        setState(prev => ({
          ...prev,
          connecting: false,
          error: 'You are already connected to this tenancy'
        }));
        return false;
      }

      // Create the tenancy_tenant record
      const { data, error } = await (supabase
        .from('tenancy_tenants') as ReturnType<typeof supabase.from>)
        .insert({
          tenancy_id: tenancyId,
          tenant_id: user.id,
          is_primary: false, // Additional tenant
          is_leaseholder: false,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update the connection attempt to success
      await (supabase
        .from('connection_attempts') as ReturnType<typeof supabase.from>)
        .update({
          status: 'success',
          processed_at: new Date().toISOString(),
          created_tenancy_tenant_id: (data as { id: string }).id,
        })
        .eq('code_text', code.toUpperCase().trim())
        .eq('user_id', user.id)
        .eq('status', 'pending');

      setState(prev => ({ ...prev, connecting: false, error: null }));
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to connect to tenancy';
      setState(prev => ({
        ...prev,
        connecting: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [user]);

  /**
   * Connect tenant to a property by creating a new tenancy.
   * Uses a database function with SECURITY DEFINER to bypass RLS.
   */
  const connectToProperty = useCallback(async (
    propertyId: string,
    _ownerId: string,
    code: string
  ): Promise<boolean> => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'Must be authenticated' }));
      return false;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // Call the database function that handles tenancy creation with elevated privileges
      // @ts-expect-error - RPC function types not generated for custom functions
      const { data, error } = await supabase.rpc('connect_tenant_to_property', {
        p_property_id: propertyId,
        p_tenant_id: user.id,
        p_code: code,
      });

      if (error) throw error;

      // RPC returns an array for table-returning functions
      const results = data as Array<{
        success: boolean;
        message: string;
        tenancy_id: string | null;
        tenancy_tenant_id: string | null;
      }> | null;

      const result = results?.[0];
      if (!result) {
        throw new Error('Invalid response from server');
      }

      if (!result.success) {
        setState(prev => ({
          ...prev,
          connecting: false,
          error: result.message,
        }));
        return false;
      }

      setState(prev => ({ ...prev, connecting: false, error: null }));
      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to connect to property';
      setState(prev => ({
        ...prev,
        connecting: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [user]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    useCode,
    connectToTenancy,
    connectToProperty,
    clearError,
  };
}
