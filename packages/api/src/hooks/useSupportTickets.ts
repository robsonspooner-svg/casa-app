// useSupportTickets Hook - Support Ticket Management
// Mission 20: Launch Preparation

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import type { SubscriptionTier } from '../types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TicketCategory = 'billing' | 'technical' | 'property' | 'general' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
export type TicketPriority = 'normal' | 'priority' | 'dedicated';

export interface SupportTicket {
  id: string;
  user_id: string;
  priority: TicketPriority;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  assigned_to: string | null;
  response_time_target: number | null;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
}

export interface SupportTicketsState {
  tickets: SupportTicket[];
  loading: boolean;
  error: string | null;
}

export interface UseSupportTicketsReturn extends SupportTicketsState {
  fetchTickets: () => Promise<void>;
  createTicket: (category: TicketCategory, subject: string, message: string) => Promise<SupportTicket | null>;
  fetchMessages: (ticketId: string) => Promise<SupportMessage[]>;
  sendMessage: (ticketId: string, message: string) => Promise<SupportMessage | null>;
  supportTier: 'standard' | 'priority' | 'dedicated';
  responseTimeMinutes: number;
}

// ─── Support tier mapping ────────────────────────────────────────────────────

const SUPPORT_TIER_MAP: Record<SubscriptionTier, { tier: 'standard' | 'priority' | 'dedicated'; responseMinutes: number; priority: TicketPriority }> = {
  starter: { tier: 'standard', responseMinutes: 1440, priority: 'normal' },     // 24 hours
  pro: { tier: 'priority', responseMinutes: 240, priority: 'priority' },         // 4 hours
  hands_off: { tier: 'dedicated', responseMinutes: 60, priority: 'dedicated' },  // 1 hour
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSupportTickets(): UseSupportTicketsReturn {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const [state, setState] = useState<SupportTicketsState>({
    tickets: [],
    loading: true,
    error: null,
  });

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const subscriptionTier = profile?.subscription_tier || 'starter';
  const supportConfig = SUPPORT_TIER_MAP[subscriptionTier];

  const fetchTickets = useCallback(async () => {
    if (!user || !supabase) {
      setState({ tickets: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await (supabase.from('support_tickets') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setState({
        tickets: (data as SupportTicket[]) || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tickets';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [user, supabase]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
    }
  }, [fetchTickets, isAuthenticated]);

  const createTicket = useCallback(async (
    category: TicketCategory,
    subject: string,
    message: string,
  ): Promise<SupportTicket | null> => {
    if (!user || !supabase) return null;

    try {
      // Urgent category always gets highest available priority
      const effectivePriority = category === 'urgent' ? 'dedicated' : supportConfig.priority;
      const effectiveResponseTime = category === 'urgent'
        ? Math.min(supportConfig.responseMinutes, 60)
        : supportConfig.responseMinutes;

      const { data: ticket, error: ticketError } = await (supabase.from('support_tickets') as any)
        .insert({
          user_id: user.id,
          category,
          subject,
          priority: effectivePriority,
          response_time_target: effectiveResponseTime,
          status: 'open',
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      const newTicket = ticket as SupportTicket;

      // Create the initial message
      const { error: msgError } = await (supabase.from('support_messages') as any)
        .insert({
          ticket_id: newTicket.id,
          sender_id: user.id,
          message,
          is_internal: false,
        });

      if (msgError) throw msgError;

      // Update local state
      setState(prev => ({
        ...prev,
        tickets: [newTicket, ...prev.tickets],
      }));

      return newTicket;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create ticket';
      setState(prev => ({ ...prev, error: errorMsg }));
      return null;
    }
  }, [user, supabase, supportConfig]);

  const fetchMessages = useCallback(async (ticketId: string): Promise<SupportMessage[]> => {
    if (!supabase) return [];

    try {
      const { data, error } = await (supabase.from('support_messages') as any)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data as SupportMessage[]) || [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch messages';
      setState(prev => ({ ...prev, error: errorMsg }));
      return [];
    }
  }, [supabase]);

  const sendMessage = useCallback(async (
    ticketId: string,
    message: string,
  ): Promise<SupportMessage | null> => {
    if (!user || !supabase) return null;

    try {
      const { data, error } = await (supabase.from('support_messages') as any)
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          message,
          is_internal: false,
        })
        .select()
        .single();

      if (error) throw error;

      return data as SupportMessage;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      setState(prev => ({ ...prev, error: errorMsg }));
      return null;
    }
  }, [user, supabase]);

  return {
    ...state,
    fetchTickets,
    createTicket,
    fetchMessages,
    sendMessage,
    supportTier: supportConfig.tier,
    responseTimeMinutes: supportConfig.responseMinutes,
  };
}
