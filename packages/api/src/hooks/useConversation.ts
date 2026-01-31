// useConversation Hook - Single Conversation with Real-Time Messages
// Mission 12: In-App Communications

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  ConversationRow,
  MessageRow,
  MessageAttachmentRow,
  MessageReactionRow,
  ConversationParticipantRow,
  Profile,
} from '../types/database';

export interface MessageListItem extends MessageRow {
  sender?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>;
  attachments: MessageAttachmentRow[];
  reactions: MessageReactionRow[];
  reply_to?: Pick<MessageRow, 'id' | 'content' | 'sender_id'> | null;
}

export interface ConversationParticipant extends ConversationParticipantRow {
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>;
}

export interface ConversationState {
  conversation: ConversationRow | null;
  messages: MessageListItem[];
  participants: ConversationParticipant[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  typingUsers: { userId: string; name: string }[];
}

const PAGE_SIZE = 50;

export function useConversation(conversationId: string | null): ConversationState & {
  refreshConversation: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendTyping: () => void;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ConversationState>({
    conversation: null,
    messages: [],
    participants: [],
    loading: true,
    error: null,
    refreshing: false,
    loadingMore: false,
    hasMore: false,
    typingUsers: [],
  });
  const messagesRef = useRef<MessageListItem[]>([]);
  const typingChannelRef = useRef<ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversation = useCallback(async (isRefresh = false) => {
    if (!user || !conversationId) {
      setState({ conversation: null, messages: [], participants: [], loading: false, error: null, refreshing: false, loadingMore: false, hasMore: false, typingUsers: [] });
      return;
    }

    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const supabase = getSupabaseClient();

      // Fetch conversation
      const { data: convData, error: convError } = await (supabase
        .from('conversations') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convError) throw convError;

      const conversation = convData as ConversationRow;

      // Fetch participants
      const { data: participantsData } = await supabase
        .from('conversation_participants')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_active', true);

      const participantRows = (participantsData || []) as ConversationParticipantRow[];
      const participantUserIds = participantRows.map(p => p.user_id);

      // Fetch participant profiles
      let profileMap: Record<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>> = {};
      if (participantUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', participantUserIds);

        profileMap = (profiles || []).reduce((map: Record<string, any>, p: any) => {
          map[p.id] = p;
          return map;
        }, {} as Record<string, any>);
      }

      const participants: ConversationParticipant[] = participantRows.map(p => ({
        ...p,
        profile: profileMap[p.user_id],
      }));

      // Fetch messages (most recent first)
      const { data: messagesData, error: messagesError } = await (supabase
        .from('messages') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (messagesError) throw messagesError;

      const rawMessages = (messagesData || []) as MessageRow[];

      // Fetch attachments for these messages
      const messageIds = rawMessages.map(m => m.id);
      let attachmentsMap: Record<string, MessageAttachmentRow[]> = {};
      let reactionsMap: Record<string, MessageReactionRow[]> = {};

      if (messageIds.length > 0) {
        const [attachmentsResult, reactionsResult] = await Promise.all([
          (supabase.from('message_attachments') as ReturnType<typeof supabase.from>)
            .select('*')
            .in('message_id', messageIds),
          (supabase.from('message_reactions') as ReturnType<typeof supabase.from>)
            .select('*')
            .in('message_id', messageIds),
        ]);

        const attachments = (attachmentsResult.data || []) as MessageAttachmentRow[];
        attachments.forEach(a => {
          if (!attachmentsMap[a.message_id]) attachmentsMap[a.message_id] = [];
          attachmentsMap[a.message_id].push(a);
        });

        const reactions = (reactionsResult.data || []) as MessageReactionRow[];
        reactions.forEach(r => {
          if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
          reactionsMap[r.message_id].push(r);
        });
      }

      // Fetch reply-to messages
      const replyToIds = rawMessages.filter(m => m.reply_to_id).map(m => m.reply_to_id!);
      let replyMap: Record<string, Pick<MessageRow, 'id' | 'content' | 'sender_id'>> = {};
      if (replyToIds.length > 0) {
        const { data: replyData } = await (supabase
          .from('messages') as ReturnType<typeof supabase.from>)
          .select('id, content, sender_id')
          .in('id', replyToIds);

        (replyData || []).forEach((r: any) => {
          replyMap[r.id] = r;
        });
      }

      // Build enriched messages (reverse to chronological order)
      const messages: MessageListItem[] = rawMessages.reverse().map(m => ({
        ...m,
        sender: profileMap[m.sender_id],
        attachments: attachmentsMap[m.id] || [],
        reactions: reactionsMap[m.id] || [],
        reply_to: m.reply_to_id ? replyMap[m.reply_to_id] || null : null,
      }));

      messagesRef.current = messages;

      // Mark conversation as read
      await (supabase.rpc as any)('mark_conversation_read', { p_conversation_id: conversationId });

      setState({
        conversation,
        messages,
        participants,
        typingUsers: [],
        loading: false,
        error: null,
        refreshing: false,
        loadingMore: false,
        hasMore: rawMessages.length === PAGE_SIZE,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch conversation';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, conversationId]);

  useEffect(() => {
    if (isAuthenticated && conversationId) {
      fetchConversation();
    }
  }, [fetchConversation, isAuthenticated, conversationId]);

  // Real-time: subscribe to new messages in this conversation
  useEffect(() => {
    if (!user || !conversationId || !isAuthenticated) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as MessageRow;

          // Skip if already in list
          if (messagesRef.current.some(m => m.id === newMessage.id)) return;

          // Fetch sender profile
          const { data: senderData } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .eq('id', newMessage.sender_id)
            .single();

          const enriched: MessageListItem = {
            ...newMessage,
            sender: senderData || undefined,
            attachments: [],
            reactions: [],
            reply_to: null,
          };

          messagesRef.current = [...messagesRef.current, enriched];
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, enriched],
          }));

          // Mark as read if from someone else
          if (newMessage.sender_id !== user.id) {
            await (supabase.rpc as any)('mark_conversation_read', { p_conversation_id: conversationId });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversationId, isAuthenticated]);

  // Typing indicator via Supabase broadcast channel
  useEffect(() => {
    if (!user || !conversationId || !isAuthenticated) return;

    const supabase = getSupabaseClient();
    const channel = supabase.channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, name } = payload.payload as { userId: string; name: string };
        if (userId === user.id) return;

        setState(prev => {
          const exists = prev.typingUsers.some(t => t.userId === userId);
          if (!exists) {
            return { ...prev, typingUsers: [...prev.typingUsers, { userId, name }] };
          }
          return prev;
        });

        // Clear this user's typing state after 3 seconds of no broadcasts
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            typingUsers: prev.typingUsers.filter(t => t.userId !== userId),
          }));
        }, 3000);
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [user, conversationId, isAuthenticated]);

  const sendTyping = useCallback(() => {
    if (!typingChannelRef.current || !user) return;

    // Throttle: don't send more than once per 2 seconds
    if (typingTimeoutRef.current) return;

    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, name: (user as any).user_metadata?.full_name || 'User' },
    });

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  }, [user]);

  const refreshConversation = useCallback(async () => {
    await fetchConversation(true);
  }, [fetchConversation]);

  const loadMoreMessages = useCallback(async () => {
    if (!user || !conversationId || state.loadingMore || !state.hasMore) return;

    setState(prev => ({ ...prev, loadingMore: true }));

    try {
      const supabase = getSupabaseClient();
      const oldestMessage = messagesRef.current[0];
      if (!oldestMessage) return;

      const { data: olderData, error: olderError } = await (supabase
        .from('messages') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .lt('created_at', oldestMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (olderError) throw olderError;

      const rawMessages = (olderData || []) as MessageRow[];

      // Fetch profiles for senders we don't have yet
      const existingSenderIds = new Set(messagesRef.current.map(m => m.sender_id));
      const newSenderIds = [...new Set(rawMessages.map(m => m.sender_id).filter(id => !existingSenderIds.has(id)))];

      let profileMap: Record<string, any> = {};
      if (newSenderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', newSenderIds);

        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      // Also include existing sender profiles
      messagesRef.current.forEach(m => {
        if (m.sender) profileMap[m.sender_id] = m.sender;
      });

      const olderMessages: MessageListItem[] = rawMessages.reverse().map(m => ({
        ...m,
        sender: profileMap[m.sender_id],
        attachments: [],
        reactions: [],
        reply_to: null,
      }));

      messagesRef.current = [...olderMessages, ...messagesRef.current];

      setState(prev => ({
        ...prev,
        messages: [...olderMessages, ...prev.messages],
        loadingMore: false,
        hasMore: rawMessages.length === PAGE_SIZE,
      }));
    } catch (caught) {
      setState(prev => ({ ...prev, loadingMore: false }));
    }
  }, [user, conversationId, state.loadingMore, state.hasMore]);

  return {
    ...state,
    refreshConversation,
    loadMoreMessages,
    sendTyping,
  };
}
