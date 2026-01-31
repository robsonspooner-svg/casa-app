// useConversations Hook - Conversation List
// Mission 12: In-App Communications

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  ConversationRow,
  ConversationType,
  Property,
  Profile,
} from '../types/database';

export interface ConversationListItem extends ConversationRow {
  unread_count: number;
  other_participant?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>;
  property?: Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>;
}

export interface ConversationsFilter {
  type?: ConversationType;
  unreadOnly?: boolean;
  propertyId?: string;
}

export interface ConversationsState {
  conversations: ConversationListItem[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  totalUnread: number;
}

export function useConversations(filter?: ConversationsFilter): ConversationsState & {
  refreshConversations: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ConversationsState>({
    conversations: [],
    loading: true,
    error: null,
    refreshing: false,
    totalUnread: 0,
  });

  const fetchConversations = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ conversations: [], loading: false, error: null, refreshing: false, totalUnread: 0 });
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

      // Get conversations where user is an active participant
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, unread_count')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        setState({ conversations: [], loading: false, error: null, refreshing: false, totalUnread: 0 });
        return;
      }

      const conversationIds = participantData.map((p: any) => p.conversation_id);
      const unreadMap = participantData.reduce((map: Record<string, number>, p: any) => {
        map[p.conversation_id] = p.unread_count;
        return map;
      }, {} as Record<string, number>);

      // Fetch conversations
      let query = (supabase
        .from('conversations') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (filter?.type) {
        query = query.eq('conversation_type', filter.type);
      }
      if (filter?.propertyId) {
        query = query.eq('property_id', filter.propertyId);
      }

      const { data: conversationsData, error: conversationsError } = await query;
      if (conversationsError) throw conversationsError;

      const conversations = (conversationsData || []) as ConversationRow[];

      if (conversations.length === 0) {
        setState({ conversations: [], loading: false, error: null, refreshing: false, totalUnread: 0 });
        return;
      }

      // Fetch all participants for these conversations to find the "other" person
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversations.map(c => c.id))
        .eq('is_active', true)
        .neq('user_id', user.id);

      // Get unique other user IDs
      const otherUserIds = [...new Set((allParticipants || []).map((p: any) => p.user_id))];
      const participantConvMap = (allParticipants || []).reduce((map: Record<string, string>, p: any) => {
        map[p.conversation_id] = p.user_id;
        return map;
      }, {} as Record<string, string>);

      // Fetch other participant profiles
      let profileMap: Record<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>> = {};
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', otherUserIds);

        profileMap = (profiles || []).reduce((map: Record<string, any>, p: any) => {
          map[p.id] = p;
          return map;
        }, {} as Record<string, any>);
      }

      // Fetch properties if needed
      const propertyIds = [...new Set(conversations.filter(c => c.property_id).map(c => c.property_id!))];
      let propertyMap: Record<string, Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>> = {};
      if (propertyIds.length > 0) {
        const { data: properties } = await supabase
          .from('properties')
          .select('id, address_line_1, suburb, state')
          .in('id', propertyIds);

        propertyMap = (properties || []).reduce((map: Record<string, any>, p: any) => {
          map[p.id] = p;
          return map;
        }, {} as Record<string, any>);
      }

      // Build enriched list
      let enriched: ConversationListItem[] = conversations.map(c => ({
        ...c,
        unread_count: unreadMap[c.id] || 0,
        other_participant: participantConvMap[c.id] ? profileMap[participantConvMap[c.id]] : undefined,
        property: c.property_id ? propertyMap[c.property_id] : undefined,
      }));

      // Apply unread filter
      if (filter?.unreadOnly) {
        enriched = enriched.filter(c => c.unread_count > 0);
      }

      const totalUnread = Object.values(unreadMap).reduce((sum, count) => sum + count, 0);

      setState({
        conversations: enriched,
        loading: false,
        error: null,
        refreshing: false,
        totalUnread,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch conversations';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, filter?.type, filter?.unreadOnly, filter?.propertyId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
    }
  }, [fetchConversations, isAuthenticated]);

  // Subscribe to real-time participant changes (unread updates)
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`conversations:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh conversations when participant data changes
          fetchConversations(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAuthenticated, fetchConversations]);

  const refreshConversations = useCallback(async () => {
    await fetchConversations(true);
  }, [fetchConversations]);

  return {
    ...state,
    refreshConversations,
  };
}
