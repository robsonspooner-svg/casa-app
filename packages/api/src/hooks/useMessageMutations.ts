// useMessageMutations Hook - Messaging Actions
// Mission 12: In-App Communications

import { useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  ConversationType,
  ConversationRow,
  MessageRow,
} from '../types/database';

export interface CreateConversationInput {
  participant_ids: string[];
  conversation_type?: ConversationType;
  property_id?: string;
  tenancy_id?: string;
  linked_record_id?: string;
  linked_record_type?: string;
  title?: string;
  initial_message?: string;
}

export interface SendMessageInput {
  conversation_id: string;
  content: string;
  content_type?: 'text' | 'image' | 'document' | 'system';
  reply_to_id?: string;
  metadata?: Record<string, unknown>;
}

export function useMessageMutations() {
  const { user } = useAuth();

  /**
   * Create a new conversation with participants and optionally send an initial message.
   * Returns the new conversation ID.
   */
  const createConversation = useCallback(async (input: CreateConversationInput): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    // Check for existing direct conversation between these two users
    if (
      input.conversation_type === 'direct' &&
      input.participant_ids.length === 1 &&
      !input.linked_record_id
    ) {
      const otherUserId = input.participant_ids[0];

      // Find conversations where both users are participants
      const { data: myConversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (myConversations && myConversations.length > 0) {
        const myConvIds = myConversations.map((c: any) => c.conversation_id);

        const { data: sharedConversations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .eq('is_active', true)
          .in('conversation_id', myConvIds);

        if (sharedConversations && sharedConversations.length > 0) {
          // Check if any of these is a 'direct' conversation
          const sharedIds = sharedConversations.map((c: any) => c.conversation_id);
          const { data: existingDirect } = await (supabase
            .from('conversations') as ReturnType<typeof supabase.from>)
            .select('id')
            .in('id', sharedIds)
            .eq('conversation_type', 'direct')
            .limit(1);

          if (existingDirect && existingDirect.length > 0) {
            const existingId = (existingDirect[0] as any).id;
            // Send initial message if provided
            if (input.initial_message) {
              await sendMessage({
                conversation_id: existingId,
                content: input.initial_message,
              });
            }
            return existingId;
          }
        }
      }
    }

    // Create the conversation
    const { data: convData, error: convError } = await (supabase
      .from('conversations') as ReturnType<typeof supabase.from>)
      .insert({
        conversation_type: input.conversation_type || 'direct',
        property_id: input.property_id || null,
        tenancy_id: input.tenancy_id || null,
        linked_record_id: input.linked_record_id || null,
        linked_record_type: input.linked_record_type || null,
        title: input.title || null,
      })
      .select('id')
      .single();

    if (convError) throw convError;
    const conversationId = (convData as any).id;

    // Add current user as participant
    const allParticipantIds = [user.id, ...input.participant_ids.filter(id => id !== user.id)];

    const participantInserts = allParticipantIds.map(uid => ({
      conversation_id: conversationId,
      user_id: uid,
    }));

    const { error: participantError } = await (supabase
      .from('conversation_participants') as ReturnType<typeof supabase.from>)
      .insert(participantInserts);

    if (participantError) throw participantError;

    // Send initial message if provided
    if (input.initial_message) {
      await sendMessage({
        conversation_id: conversationId,
        content: input.initial_message,
      });
    }

    return conversationId;
  }, [user]);

  /**
   * Send a message to a conversation.
   * Returns the new message.
   */
  const sendMessage = useCallback(async (input: SendMessageInput): Promise<MessageRow> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { data, error } = await (supabase
      .from('messages') as ReturnType<typeof supabase.from>)
      .insert({
        conversation_id: input.conversation_id,
        sender_id: user.id,
        content: input.content,
        content_type: input.content_type || 'text',
        reply_to_id: input.reply_to_id || null,
        status: 'sent',
        metadata: input.metadata || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as MessageRow;
  }, [user]);

  /**
   * Edit a message (within the conversation).
   */
  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    // Get original content first
    const { data: original, error: fetchError } = await (supabase
      .from('messages') as ReturnType<typeof supabase.from>)
      .select('content')
      .eq('id', messageId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await (supabase
      .from('messages') as ReturnType<typeof supabase.from>)
      .update({
        content: newContent,
        edited_at: new Date().toISOString(),
        original_content: (original as any).content,
      })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (error) throw error;
  }, [user]);

  /**
   * Soft-delete a message.
   */
  const deleteMessage = useCallback(async (messageId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('messages') as ReturnType<typeof supabase.from>)
      .update({
        deleted_at: new Date().toISOString(),
        content: '[Message deleted]',
      })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (error) throw error;
  }, [user]);

  /**
   * Add a reaction to a message.
   */
  const addReaction = useCallback(async (messageId: string, reaction: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('message_reactions') as ReturnType<typeof supabase.from>)
      .insert({
        message_id: messageId,
        user_id: user.id,
        reaction,
      });

    if (error && !(error as any).message?.includes('duplicate')) throw error;
  }, [user]);

  /**
   * Remove a reaction from a message.
   */
  const removeReaction = useCallback(async (messageId: string, reaction: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('message_reactions') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('reaction', reaction);

    if (error) throw error;
  }, [user]);

  /**
   * Mark a conversation as read.
   */
  const markRead = useCallback(async (conversationId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();
    await (supabase.rpc as any)('mark_conversation_read', { p_conversation_id: conversationId });
  }, [user]);

  /**
   * Mute/unmute a conversation.
   */
  const muteConversation = useCallback(async (conversationId: string, muteUntil: string | null): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('conversation_participants') as ReturnType<typeof supabase.from>)
      .update({
        muted_until: muteUntil,
        notifications_enabled: muteUntil === null,
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    if (error) throw error;
  }, [user]);

  /**
   * Leave a conversation.
   */
  const leaveConversation = useCallback(async (conversationId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('conversation_participants') as ReturnType<typeof supabase.from>)
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    if (error) throw error;
  }, [user]);

  /**
   * Create or update a custom message template.
   */
  const saveTemplate = useCallback(async (
    name: string,
    content: string,
    category?: string,
    templateId?: string
  ): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    if (templateId) {
      const { error } = await (supabase
        .from('message_templates') as ReturnType<typeof supabase.from>)
        .update({ name, content, category: category || null })
        .eq('id', templateId)
        .eq('owner_id', user.id);

      if (error) throw error;
      return templateId;
    }

    const { data, error } = await (supabase
      .from('message_templates') as ReturnType<typeof supabase.from>)
      .insert({
        owner_id: user.id,
        name,
        content,
        category: category || null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return (data as any).id;
  }, [user]);

  /**
   * Increment usage count for a template.
   */
  const useTemplate = useCallback(async (templateId: string): Promise<void> => {
    const supabase = getSupabaseClient();

    // Use RPC or raw update — increment usage_count
    const { data: current } = await (supabase
      .from('message_templates') as ReturnType<typeof supabase.from>)
      .select('usage_count')
      .eq('id', templateId)
      .single();

    if (current) {
      await (supabase
        .from('message_templates') as ReturnType<typeof supabase.from>)
        .update({ usage_count: ((current as any).usage_count || 0) + 1 })
        .eq('id', templateId);
    }
  }, []);

  return {
    createConversation,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    markRead,
    muteConversation,
    leaveConversation,
    saveTemplate,
    useTemplate,
  };
}
