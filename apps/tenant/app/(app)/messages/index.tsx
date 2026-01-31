// Conversations List - Tenant View
// Mission 12: In-App Communications
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useConversations } from '@casa/api';
import type { ConversationListItem } from '@casa/api/src/hooks/useConversations';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function ConversationCard({ item }: { item: ConversationListItem }) {
  const name = item.other_participant?.full_name || item.title || 'Property Manager';
  const initials = getInitials(item.other_participant?.full_name);
  const hasUnread = item.unread_count > 0;

  return (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => router.push(`/(app)/messages/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, hasUnread && styles.avatarUnread]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardName, hasUnread && styles.cardNameUnread]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.cardTime, hasUnread && styles.cardTimeUnread]}>
            {formatTime(item.last_message_at)}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={[styles.cardPreview, hasUnread && styles.cardPreviewUnread]} numberOfLines={1}>
            {item.last_message_preview || 'No messages yet'}
          </Text>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
        {item.property && (
          <Text style={styles.cardProperty} numberOfLines={1}>
            {item.property.address_line_1}, {item.property.suburb}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TenantConversationsList() {
  const { conversations, loading, error, refreshing, totalUnread, refreshConversations } = useConversations();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <Text style={styles.headerSubtitle}>{totalUnread} unread</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/(app)/messages/new' as any)}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 8v4M10 10h4" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centered}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
            <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Your conversations with your landlord will appear here.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(app)/messages/new' as any)}
          >
            <Text style={styles.emptyButtonText}>Message Landlord</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ConversationCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshConversations}
              tintColor={THEME.colors.brand}
            />
          }
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.brand,
    textAlign: 'center',
  },
  newButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: THEME.spacing.base,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.sm,
  },
  avatarUnread: {
    backgroundColor: THEME.colors.brand,
  },
  avatarText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: '#FFFFFF',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  cardNameUnread: {
    fontWeight: THEME.fontWeight.semibold as any,
  },
  cardTime: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  cardTimeUnread: {
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium as any,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPreview: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  cardPreviewUnread: {
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium as any,
  },
  unreadBadge: {
    backgroundColor: THEME.colors.brand,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: THEME.fontWeight.semibold as any,
    color: '#FFFFFF',
  },
  cardProperty: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.md,
  },
  emptySubtitle: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
  emptyButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: '#FFFFFF',
  },
});
