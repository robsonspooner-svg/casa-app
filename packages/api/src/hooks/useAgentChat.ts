// useAgentChat Hook - Agent Chat Conversation
// Mission 14: AI Agent Chat System

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  AgentMessage,
  AgentConversation,
} from '../types/database';

export interface AgentChatState {
  messages: AgentMessage[];
  conversations: AgentConversation[];
  currentConversation: AgentConversation | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
}

export interface UseAgentChatReturn extends AgentChatState {
  sendMessage: (content: string, conversationId?: string) => Promise<AgentMessage | null>;
  startNewConversation: () => Promise<string | null>;
  loadConversation: (conversationId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  approveAction: (actionId: string) => Promise<boolean>;
  rejectAction: (actionId: string, reason?: string) => Promise<boolean>;
}

export function useAgentChat(): UseAgentChatReturn {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<AgentChatState>({
    messages: [],
    conversations: [],
    currentConversation: null,
    loading: true,
    sending: false,
    error: null,
  });

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, conversations: [], loading: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('agent_conversations') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        conversations: (data || []) as AgentConversation[],
        loading: false,
        error: null,
      }));
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch conversations';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
    }
  }, [fetchConversations, isAuthenticated]);

  const refreshConversations = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);

  const loadConversation = useCallback(async (conversationId: string) => {
    if (!user) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // Fetch the conversation
      const { data: conversationData, error: conversationError } = await (supabase
        .from('agent_conversations') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (conversationError) throw conversationError;

      // Fetch messages for the conversation
      const { data: messagesData, error: messagesError } = await (supabase
        .from('agent_messages') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      setState(prev => ({
        ...prev,
        currentConversation: conversationData as AgentConversation,
        messages: (messagesData || []) as AgentMessage[],
        loading: false,
        error: null,
      }));
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to load conversation';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  const startNewConversation = useCallback(async (): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('agent_conversations') as ReturnType<typeof supabase.from>)
        .insert({
          user_id: user.id,
          status: 'active',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const conversation = data as AgentConversation;

      setState(prev => ({
        ...prev,
        currentConversation: conversation,
        messages: [],
        conversations: [conversation, ...prev.conversations],
      }));

      return conversation.id;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to start conversation';
      setState(prev => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, [user]);

  const sendMessage = useCallback(async (content: string, conversationId?: string): Promise<AgentMessage | null> => {
    if (!user) return null;

    const targetConversationId = conversationId || state.currentConversation?.id;

    setState(prev => ({ ...prev, sending: true, error: null }));

    // Optimistically add the user message
    const optimisticMessage: AgentMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: targetConversationId || '',
      role: 'user',
      content,
      tool_calls: null,
      tool_results: null,
      feedback: null,
      tokens_used: null,
      created_at: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, optimisticMessage],
    }));

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.functions.invoke('agent-chat', {
        body: {
          message: content,
          conversationId: targetConversationId,
        },
      });

      if (error) throw error;

      const response = data as {
        conversationId: string;
        message: string;
        tokensUsed: number;
        toolsUsed: string[];
        pendingActions?: Array<{ id: string; tool_name: string; description: string; category: string }>;
      };

      // Build the assistant message from the Edge Function response
      const assistantMessage: AgentMessage = {
        id: `assistant-${Date.now()}`,
        conversation_id: response.conversationId,
        role: 'assistant',
        content: response.message,
        tool_calls: response.toolsUsed?.length > 0
          ? response.toolsUsed.map(name => ({ name }))
          : null,
        tool_results: null,
        feedback: null,
        tokens_used: response.tokensUsed || null,
        created_at: new Date().toISOString(),
      };

      // Replace the optimistic message with the real one and append the agent response
      setState(prev => {
        const messagesWithoutOptimistic = prev.messages.filter(m => m.id !== optimisticMessage.id);

        // Update optimistic user message with real conversation ID
        const realUserMessage: AgentMessage = {
          ...optimisticMessage,
          conversation_id: response.conversationId,
        };

        // If a new conversation was created by the Edge Function, update state
        let updatedConversation = prev.currentConversation;
        if (!targetConversationId && response.conversationId) {
          updatedConversation = {
            id: response.conversationId,
            user_id: user.id,
            property_id: null,
            title: null,
            context_summary: null,
            status: 'active',
            model: null,
            total_tokens_used: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }

        return {
          ...prev,
          messages: [...messagesWithoutOptimistic, realUserMessage, assistantMessage],
          currentConversation: updatedConversation,
          sending: false,
          error: null,
        };
      });

      return assistantMessage;
    } catch (caught) {
      let errorMessage = caught instanceof Error ? caught.message : 'Failed to send message';
      // Provide user-friendly error for edge function failures
      if (errorMessage.includes('non-2xx') || errorMessage.includes('Edge Function')) {
        errorMessage = 'Casa is temporarily unavailable. The AI service may be starting up — please try again in a moment.';
      }
      // Remove optimistic message on failure
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== optimisticMessage.id),
        sending: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [user, state.currentConversation?.id]);

  const approveAction = useCallback(async (actionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('agent_pending_actions') as ReturnType<typeof supabase.from>)
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', actionId)
        .eq('user_id', user.id);

      if (error) throw error;

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to approve action';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user]);

  const rejectAction = useCallback(async (actionId: string, reason?: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const updateData: Record<string, unknown> = {
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      };

      if (reason) {
        updateData.recommendation = reason;
      }

      const { error } = await (supabase
        .from('agent_pending_actions') as ReturnType<typeof supabase.from>)
        .update(updateData)
        .eq('id', actionId)
        .eq('user_id', user.id);

      if (error) throw error;

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to reject action';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user]);

  return {
    ...state,
    sendMessage,
    startNewConversation,
    loadConversation,
    refreshConversations,
    approveAction,
    rejectAction,
  };
}
