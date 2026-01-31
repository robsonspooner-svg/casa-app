// useMessageSearch Hook - Search across messages
// Mission 12: In-App Communications

import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { MessageRow, Profile } from '../types/database';

export interface MessageSearchResult {
  id: string;
  conversation_id: string;
  content: string;
  sender_name: string | null;
  created_at: string;
  conversation_title: string | null;
}

export interface MessageSearchState {
  results: MessageSearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  hasSearched: boolean;
}

export function useMessageSearch(): MessageSearchState & {
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
} {
  const { user } = useAuth();
  const [state, setState] = useState<MessageSearchState>({
    results: [],
    loading: false,
    error: null,
    query: '',
    hasSearched: false,
  });

  const search = useCallback(async (query: string) => {
    if (!user || !query.trim()) {
      setState(prev => ({ ...prev, results: [], query: '', hasSearched: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null, query, hasSearched: true }));

    try {
      const supabase = getSupabaseClient();

      // Get conversations user participates in
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!participantData || participantData.length === 0) {
        setState(prev => ({ ...prev, results: [], loading: false }));
        return;
      }

      const conversationIds = participantData.map((p: any) => p.conversation_id);

      // Search messages using ilike (case-insensitive pattern match)
      const searchTerm = `%${query.trim()}%`;
      const { data: messagesData, error: messagesError } = await (supabase
        .from('messages') as ReturnType<typeof supabase.from>)
        .select('id, conversation_id, content, sender_id, created_at')
        .in('conversation_id', conversationIds)
        .is('deleted_at', null)
        .ilike('content', searchTerm)
        .order('created_at', { ascending: false })
        .limit(50);

      if (messagesError) throw messagesError;

      const messages = (messagesData || []) as Pick<MessageRow, 'id' | 'conversation_id' | 'content' | 'sender_id' | 'created_at'>[];

      if (messages.length === 0) {
        setState(prev => ({ ...prev, results: [], loading: false }));
        return;
      }

      // Fetch sender profiles
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds);

      const profileMap = (profiles || []).reduce((map: Record<string, string | null>, p: any) => {
        map[p.id] = p.full_name;
        return map;
      }, {} as Record<string, string | null>);

      // Fetch conversation titles
      const convIds = [...new Set(messages.map(m => m.conversation_id))];
      const { data: convData } = await (supabase
        .from('conversations') as ReturnType<typeof supabase.from>)
        .select('id, title')
        .in('id', convIds);

      const convMap = (convData || []).reduce((map: Record<string, string | null>, c: any) => {
        map[c.id] = c.title;
        return map;
      }, {} as Record<string, string | null>);

      const results: MessageSearchResult[] = messages.map(m => ({
        id: m.id,
        conversation_id: m.conversation_id,
        content: m.content,
        sender_name: profileMap[m.sender_id] || null,
        created_at: m.created_at,
        conversation_title: convMap[m.conversation_id] || null,
      }));

      setState(prev => ({ ...prev, results, loading: false }));
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Search failed';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
    }
  }, [user]);

  const clearSearch = useCallback(() => {
    setState({ results: [], loading: false, error: null, query: '', hasSearched: false });
  }, []);

  return {
    ...state,
    search,
    clearSearch,
  };
}
