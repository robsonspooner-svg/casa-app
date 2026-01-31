// AI Agent Gateway Hook
// Mission 14: AI Agent Conversation UI (Gateway for future implementation)
// This hook provides a navigation gateway and placeholder state for agent features

import { useCallback, useMemo } from 'react';
import type {
  AgentConversation,
  AgentMessage,
  AgentPendingAction,
  AgentAutonomyLevel,
  GatewayListState,
} from '../../types/gateways';

export interface AgentGatewayState extends GatewayListState<AgentConversation> {
  currentConversation: AgentConversation | null;
  messages: AgentMessage[];
  pendingActions: AgentPendingAction[];
  isStreaming: boolean;
  isAgentReady: boolean;
}

export interface AgentGatewayActions {
  // Navigation gateways
  navigateToAgentChat: () => void;
  navigateToAgentConversation: (conversationId: string) => void;
  navigateToPendingActions: () => void;
  // Agent interaction placeholders
  sendMessage: (content: string) => Promise<string | null>;
  startNewConversation: () => Promise<string | null>;
  approveAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string, reason?: string) => Promise<void>;
  // Streaming subscription
  subscribeToStream: (onToken: (token: string) => void, onComplete: () => void) => () => void;
  // Context/memory
  rememberPreference: (key: string, value: string) => Promise<void>;
  recallPreferences: () => Promise<Record<string, string>>;
}

/**
 * Gateway hook for AI agent features.
 * Provides navigation entry points and placeholder data for Mission 14.
 *
 * When Mission 14 is implemented, this hook will be replaced with full functionality.
 * The agent will use Claude claude-sonnet-4-20250514 via Cloudflare Workers with streaming SSE.
 */
export function useAgentGateway(): AgentGatewayState & AgentGatewayActions {
  // Placeholder state
  const state: AgentGatewayState = useMemo(() => ({
    items: [],
    currentConversation: null,
    messages: [],
    pendingActions: [],
    isStreaming: false,
    isAgentReady: false, // Will be true when Mission 14 is complete
    loading: false,
    error: null,
    isGateway: true,
  }), []);

  // Navigation gateways
  const navigateToAgentChat = useCallback(() => {
    console.log('[Gateway] Navigate to agent chat');
  }, []);

  const navigateToAgentConversation = useCallback((conversationId: string) => {
    console.log('[Gateway] Navigate to agent conversation:', conversationId);
  }, []);

  const navigateToPendingActions = useCallback(() => {
    console.log('[Gateway] Navigate to pending actions');
  }, []);

  // Agent interaction placeholders
  const sendMessage = useCallback(async (content: string): Promise<string | null> => {
    console.log('[Gateway] Send message to agent:', content.substring(0, 50), '- Mission 14 required');
    return null;
  }, []);

  const startNewConversation = useCallback(async (): Promise<string | null> => {
    console.log('[Gateway] Start new agent conversation - Mission 14 required');
    return null;
  }, []);

  const approveAction = useCallback(async (actionId: string): Promise<void> => {
    console.log('[Gateway] Approve agent action:', actionId, '- Mission 14 required');
  }, []);

  const rejectAction = useCallback(async (actionId: string, reason?: string): Promise<void> => {
    console.log('[Gateway] Reject agent action:', actionId, reason, '- Mission 14 required');
  }, []);

  // Streaming subscription placeholder
  const subscribeToStream = useCallback((
    _onToken: (token: string) => void,
    _onComplete: () => void
  ): (() => void) => {
    console.log('[Gateway] Subscribe to agent stream - Mission 14 required');
    return () => {
      console.log('[Gateway] Unsubscribe from agent stream');
    };
  }, []);

  // Context/memory placeholders
  const rememberPreference = useCallback(async (key: string, value: string): Promise<void> => {
    console.log('[Gateway] Remember preference:', key, '=', value, '- Mission 14 required');
  }, []);

  const recallPreferences = useCallback(async (): Promise<Record<string, string>> => {
    console.log('[Gateway] Recall preferences - Mission 14 required');
    return {};
  }, []);

  return {
    ...state,
    navigateToAgentChat,
    navigateToAgentConversation,
    navigateToPendingActions,
    sendMessage,
    startNewConversation,
    approveAction,
    rejectAction,
    subscribeToStream,
    rememberPreference,
    recallPreferences,
  };
}

/**
 * Available agent autonomy levels and their behaviors.
 * Used by the UI to understand what actions require approval.
 */
export const AGENT_AUTONOMY_LEVELS: Record<AgentAutonomyLevel, {
  name: string;
  description: string;
  requiresApproval: boolean;
}> = {
  L0_inform: {
    name: 'Inform',
    description: 'Agent notifies only, no action taken',
    requiresApproval: false,
  },
  L1_suggest: {
    name: 'Suggest',
    description: 'Agent recommends, owner confirms before action',
    requiresApproval: true,
  },
  L2_draft: {
    name: 'Draft',
    description: 'Agent prepares content for review before sending',
    requiresApproval: true,
  },
  L3_execute: {
    name: 'Execute',
    description: 'Agent acts and reports after',
    requiresApproval: false,
  },
  L4_autonomous: {
    name: 'Autonomous',
    description: 'Agent acts silently, logged only',
    requiresApproval: false,
  },
};
