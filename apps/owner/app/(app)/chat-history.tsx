import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useAgentChat, AgentConversation } from '@casa/api';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArchiveIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChatBubbleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
        stroke={THEME.colors.brand}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ConversationItem({
  conversation,
  onPress,
  onArchive,
}: {
  conversation: AgentConversation;
  onPress: () => void;
  onArchive: () => void;
}) {
  const title = conversation.title || 'Untitled conversation';
  const summary = conversation.context_summary;
  const isActive = conversation.status === 'active';

  return (
    <TouchableOpacity style={styles.conversationItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.conversationIcon}>
        <ChatBubbleIcon />
      </View>
      <View style={styles.conversationContent}>
        <Text style={styles.conversationTitle} numberOfLines={1}>{title}</Text>
        {summary ? (
          <Text style={styles.conversationSummary} numberOfLines={2}>{summary}</Text>
        ) : (
          <Text style={styles.conversationSummary}>
            {isActive ? 'Active conversation' : 'Archived'}
          </Text>
        )}
        <Text style={styles.conversationDate}>{formatDate(conversation.updated_at)}</Text>
      </View>
      <TouchableOpacity
        style={styles.archiveButton}
        onPress={onArchive}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <ArchiveIcon />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function ChatHistoryScreen() {
  const { conversations, loadConversation, refreshConversations, loading } = useAgentChat();
  const [refreshing, setRefreshing] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  const handleOpenConversation = useCallback(async (conversationId: string) => {
    await loadConversation(conversationId);
    router.back();
  }, [loadConversation]);

  const handleArchive = useCallback((conversationId: string, title: string) => {
    Alert.alert(
      'Archive Chat',
      `Archive "${title || 'Untitled conversation'}"? You can still find it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setArchiving(conversationId);
            try {
              const { getSupabaseClient } = await import('@casa/api');
              const supabase = getSupabaseClient();
              const convTable = supabase.from('agent_conversations' as any) as any;
              await convTable
                .update({ status: 'archived' })
                .eq('id', conversationId);
              await refreshConversations();
            } finally {
              setArchiving(null);
            }
          },
        },
      ],
    );
  }, [refreshConversations]);

  // Only show active (non-archived) conversations
  const activeConversations = conversations.filter(c => c.status !== 'archived');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && conversations.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : activeConversations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <ChatBubbleIcon />
          </View>
          <Text style={styles.emptyTitle}>No past chats</Text>
          <Text style={styles.emptyText}>
            Your conversation history will appear here. Start a new chat to get going.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeConversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              onPress={() => handleOpenConversation(item.id)}
              onArchive={() => handleArchive(item.id, item.title || '')}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.colors.brand} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  conversationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  conversationSummary: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  conversationDate: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },
  archiveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
