// useAgentChat Hook - Agent Chat Conversation
// Mission 14: AI Agent Chat System

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  AgentMessage,
  AgentConversation,
  InlineAction,
} from '../types/database';

/** Convert snake_case tool names to readable labels (e.g. "send_email" → "Send email") */
function humaniseToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/, c => c.toUpperCase());
}

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
  submitFeedback: (messageId: string, feedback: 'positive' | 'negative') => Promise<void>;
  clearError: () => void;
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
        .neq('status', 'archived')
        .not('title', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50);

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

    // Don't create a DB row here — the edge function creates the conversation
    // when the first message is sent with no conversationId. This prevents
    // orphaned empty conversations from cluttering the history.
    setState(prev => ({
      ...prev,
      currentConversation: null,
      messages: [],
      error: null,
    }));

    return null;
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

      // Retry loop for rate limiting (429) — up to 3 attempts with backoff
      const MAX_SEND_RETRIES = 3;
      let data: any = null;
      let lastError: any = null;

      for (let attempt = 0; attempt < MAX_SEND_RETRIES; attempt++) {
        if (attempt > 0) {
          // Show user that we're retrying
          setState(prev => ({
            ...prev,
            error: 'Casa is busy — retrying automatically...',
          }));
          await new Promise(r => setTimeout(r, 5000 * Math.pow(2, attempt - 1)));
        }

        const result = await supabase.functions.invoke('agent-chat', {
          body: {
            message: content,
            conversationId: targetConversationId,
          },
        });

        if (!result.error) {
          data = result.data;
          lastError = null;
          break;
        }

        // Extract actual error message from the Edge Function response body
        let errMsg = '';

        // Try to read the response body from the error context (FunctionsHttpError stores the Response object)
        const errContext = (result.error as any)?.context;
        if (errContext && typeof errContext.json === 'function') {
          try {
            const errBody = await errContext.json();
            errMsg = errBody?.error || '';
          } catch {
            // Response body already consumed or not JSON
          }
        }

        // Fallback: check result.data (may be populated in some SDK versions)
        if (!errMsg && result.data && typeof result.data === 'object' && 'error' in result.data) {
          errMsg = (result.data as { error: string }).error;
        }

        // Last fallback: use the error message itself
        if (!errMsg) {
          errMsg = result.error?.message || '';
        }

        console.warn('[agent-chat] Error:', errMsg, result.error);

        // Check if error is retryable (429 rate limit or overloaded)
        const isRateLimit = errMsg.includes('429') || errMsg.includes('busy') || errMsg.includes('retry') || errMsg.includes('overloaded');
        if (isRateLimit && attempt < MAX_SEND_RETRIES - 1) {
          lastError = result.error;
          continue;
        }

        throw new Error(errMsg || 'Edge function error');
      }

      if (lastError) throw lastError;
      if (!data) throw new Error('No response from agent');

      const response = data as {
        conversationId: string;
        message: string;
        tokensUsed: number;
        toolsUsed: string[];
        pendingActions?: Array<{ id: string; tool_name: string; tool_params?: Record<string, unknown>; description: string; category: string }>;
        inlineActions?: Array<{ type: string; label: string; route: string; params?: Record<string, string> }>;
      };

      // Build inline actions from pending actions (autonomy-gated tools)
      const inlineActions: InlineAction[] = [];
      if (response.pendingActions && response.pendingActions.length > 0) {
        for (const pa of response.pendingActions) {
          inlineActions.push({
            id: pa.id,
            type: 'approval',
            label: humaniseToolName(pa.tool_name),
            description: pa.description,
            pendingActionId: pa.id,
            category: pa.category,
            status: 'pending',
          });
        }
      }

      // Add navigation actions from tool results (e.g., document creation)
      if (response.inlineActions && response.inlineActions.length > 0) {
        for (const ia of response.inlineActions) {
          inlineActions.push({
            id: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'navigation',
            label: ia.label,
            route: ia.route,
            params: ia.params,
            status: 'pending',
          });
        }
      }

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
        inline_actions: inlineActions.length > 0 ? inlineActions : null,
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
          const autoTitle = content.length <= 60
            ? content
            : content.substring(0, 57) + '...';
          updatedConversation = {
            id: response.conversationId,
            user_id: user.id,
            property_id: null,
            title: autoTitle,
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
      // Replace generic SDK error messages with a readable fallback
      if (errorMessage === 'Edge Function returned a non-2xx status code' || errorMessage === 'Edge function error') {
        errorMessage = 'Could not reach Casa. Please try again.';
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

  const updateInlineActionStatus = useCallback((actionId: string, newStatus: 'approved' | 'rejected') => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m => {
        if (!m.inline_actions) return m;
        const updated = m.inline_actions.map(a =>
          a.pendingActionId === actionId ? { ...a, status: newStatus as InlineAction['status'] } : a,
        );
        return { ...m, inline_actions: updated };
      }),
    }));
  }, []);

  const approveAction = useCallback(async (actionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      // Invoke the Edge Function which handles: DB status update, tool execution,
      // learning pipeline feedback, and decision logging
      const { data, error } = await supabase.functions.invoke('agent-chat', {
        body: {
          message: 'Approved action',
          conversationId: state.currentConversation?.id,
          action: { type: 'approve', pendingActionId: actionId },
        },
      });

      if (error) throw error;

      updateInlineActionStatus(actionId, 'approved');

      // If the Edge Function returned a message, append it to the conversation
      if (data?.message) {
        const resultMessage: AgentMessage = {
          id: `assistant-${Date.now()}`,
          conversation_id: state.currentConversation?.id || '',
          role: 'assistant',
          content: data.message,
          tool_calls: null,
          tool_results: null,
          feedback: null,
          tokens_used: data.tokensUsed || null,
          created_at: new Date().toISOString(),
        };
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, resultMessage],
        }));
      }

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to approve action';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, state.currentConversation?.id, updateInlineActionStatus]);

  const rejectAction = useCallback(async (actionId: string, reason?: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      // Invoke the Edge Function which handles: DB status update, learning rule creation,
      // and decision logging for the rejection
      const { data, error } = await supabase.functions.invoke('agent-chat', {
        body: {
          message: reason || 'Rejected action',
          conversationId: state.currentConversation?.id,
          action: { type: 'reject', pendingActionId: actionId },
        },
      });

      if (error) throw error;

      updateInlineActionStatus(actionId, 'rejected');

      // If the Edge Function returned a message, append it to the conversation
      if (data?.message) {
        const resultMessage: AgentMessage = {
          id: `assistant-${Date.now()}`,
          conversation_id: state.currentConversation?.id || '',
          role: 'assistant',
          content: data.message,
          tool_calls: null,
          tool_results: null,
          feedback: null,
          tokens_used: data.tokensUsed || null,
          created_at: new Date().toISOString(),
        };
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, resultMessage],
        }));
      }

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to reject action';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, state.currentConversation?.id, updateInlineActionStatus]);

  const submitFeedback = useCallback(async (messageId: string, feedback: 'positive' | 'negative') => {
    if (!user) return;

    // Optimistically update the message feedback in local state
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m =>
        m.id === messageId ? { ...m, feedback } : m,
      ),
    }));

    try {
      const supabase = getSupabaseClient();

      // Persist the feedback to the database
      const { error } = await (supabase
        .from('agent_messages') as ReturnType<typeof supabase.from>)
        .update({ feedback })
        .eq('id', messageId);

      if (error) throw error;

      // Fire-and-forget: feed into the learning pipeline
      supabase.functions.invoke('agent-learning', {
        body: {
          action: 'process_message_feedback',
          user_id: user.id,
          message_id: messageId,
          feedback,
          category: 'general',
        },
      }).catch(() => {});
    } catch (caught) {
      // Revert optimistic update on failure
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(m =>
          m.id === messageId ? { ...m, feedback: null } : m,
        ),
      }));
    }
  }, [user]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    sendMessage,
    startNewConversation,
    loadConversation,
    refreshConversations,
    approveAction,
    rejectAction,
    submitFeedback,
    clearError,
  };
}
