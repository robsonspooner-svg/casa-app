// Messages Gateway Hook
// Mission 12: In-App Communications (Gateway for future implementation)
// This hook provides a navigation gateway and placeholder state for messaging features

import { useCallback, useMemo } from 'react';
import type {
  Conversation,
  Message,
  ConversationType,
  GatewayListState,
} from '../../types/gateways';

export interface MessagesGatewayState extends GatewayListState<Conversation> {
  unreadCount: number;
  activeConversation: Conversation | null;
  messages: Message[];
}

export interface MessagesGatewayActions {
  // Navigation gateways
  navigateToConversationsList: () => void;
  navigateToConversation: (conversationId: string) => void;
  navigateToNewConversation: (params: NewConversationParams) => void;
  // Placeholder actions
  createConversation: (params: CreateConversationInput) => Promise<string | null>;
  sendMessage: (conversationId: string, content: string, attachments?: string[]) => Promise<string | null>;
  markConversationRead: (conversationId: string) => Promise<void>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  // Real-time subscription placeholders
  subscribeToConversation: (conversationId: string, onMessage: (message: Message) => void) => () => void;
  subscribeToUnreadCount: (onUpdate: (count: number) => void) => () => void;
}

export interface NewConversationParams {
  recipientId: string;
  propertyId?: string;
  tenancyId?: string;
  linkedRecordId?: string;
  linkedRecordType?: 'maintenance_request' | 'application' | 'inspection';
}

export interface CreateConversationInput {
  conversation_type: ConversationType;
  participant_ids: string[];
  property_id?: string;
  tenancy_id?: string;
  linked_record_id?: string;
  linked_record_type?: string;
  title?: string;
  initial_message?: string;
}

/**
 * Gateway hook for in-app messaging features.
 * Provides navigation entry points and placeholder data for Mission 12.
 *
 * When Mission 12 is implemented, this hook will be replaced with full functionality.
 */
export function useMessagesGateway(
  conversationId?: string | null
): MessagesGatewayState & MessagesGatewayActions {
  // Placeholder state
  const state: MessagesGatewayState = useMemo(() => ({
    items: [],
    unreadCount: 0,
    activeConversation: null,
    messages: [],
    loading: false,
    error: null,
    isGateway: true,
  }), []);

  // Navigation gateways
  const navigateToConversationsList = useCallback(() => {
    console.log('[Gateway] Navigate to conversations list');
  }, []);

  const navigateToConversation = useCallback((convId: string) => {
    console.log('[Gateway] Navigate to conversation:', convId);
  }, []);

  const navigateToNewConversation = useCallback((params: NewConversationParams) => {
    console.log('[Gateway] Navigate to new conversation:', params);
  }, []);

  // Placeholder actions
  const createConversation = useCallback(async (_params: CreateConversationInput): Promise<string | null> => {
    console.log('[Gateway] Create conversation - Mission 12 required');
    return null;
  }, []);

  const sendMessage = useCallback(async (
    convId: string,
    content: string,
    attachments?: string[]
  ): Promise<string | null> => {
    console.log('[Gateway] Send message to', convId, ':', content.substring(0, 50), attachments?.length, '- Mission 12 required');
    return null;
  }, []);

  const markConversationRead = useCallback(async (convId: string): Promise<void> => {
    console.log('[Gateway] Mark conversation read:', convId, '- Mission 12 required');
  }, []);

  const getMessages = useCallback(async (convId: string): Promise<Message[]> => {
    console.log('[Gateway] Get messages for:', convId, '- Mission 12 required');
    return [];
  }, []);

  // Real-time subscription placeholders
  const subscribeToConversation = useCallback((
    convId: string,
    _onMessage: (message: Message) => void
  ): (() => void) => {
    console.log('[Gateway] Subscribe to conversation:', convId, '- Mission 12 required');
    return () => {
      console.log('[Gateway] Unsubscribe from conversation:', convId);
    };
  }, []);

  const subscribeToUnreadCount = useCallback((
    _onUpdate: (count: number) => void
  ): (() => void) => {
    console.log('[Gateway] Subscribe to unread count - Mission 12 required');
    return () => {
      console.log('[Gateway] Unsubscribe from unread count');
    };
  }, []);

  return {
    ...state,
    navigateToConversationsList,
    navigateToConversation,
    navigateToNewConversation,
    createConversation,
    sendMessage,
    markConversationRead,
    getMessages,
    subscribeToConversation,
    subscribeToUnreadCount,
  };
}
