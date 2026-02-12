import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useAuth, useNotifications } from '@casa/api';
import type { NotificationRow } from '@casa/api';
import Svg, { Path, Circle } from 'react-native-svg';

// Icons
function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SettingsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={THEME.colors.textSecondary} strokeWidth={2} />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={THEME.colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckAllIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M18 7l-8.5 8.5L5 11" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function getNotificationIcon(type: string): { emoji: string; color: string } {
  if (type.startsWith('payment')) return { emoji: '$', color: THEME.colors.success };
  if (type.startsWith('maintenance')) return { emoji: '🔧', color: THEME.colors.warning };
  if (type.startsWith('application')) return { emoji: '📋', color: THEME.colors.brand };
  if (type.startsWith('inspection')) return { emoji: '🔍', color: THEME.colors.brand };
  if (type.startsWith('compliance')) return { emoji: '⚖️', color: THEME.colors.error };
  if (type.startsWith('lease')) return { emoji: '📄', color: THEME.colors.info };
  if (type === 'message_received') return { emoji: '💬', color: THEME.colors.info };
  return { emoji: '🔔', color: THEME.colors.textSecondary };
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function getNotificationRoute(type: string, relatedId?: string | null): string | null {
  if (type.startsWith('payment')) return relatedId ? `/(app)/payments/${relatedId}` : '/(app)/(tabs)/payments';
  if (type.startsWith('maintenance')) return relatedId ? `/(app)/maintenance/${relatedId}` : '/(app)/maintenance';
  if (type.startsWith('application')) return relatedId ? `/(app)/applications/${relatedId}` : '/(app)/applications';
  if (type === 'message_received') return relatedId ? `/(app)/messages/${relatedId}` : '/(app)/messages';
  if (type.startsWith('inspection')) return relatedId ? `/(app)/inspections/${relatedId}` : '/(app)/inspections';
  if (type.startsWith('lease') || type === 'tenant_moved_out') return '/(app)/tenancies';
  if (type.startsWith('compliance')) return '/(app)/compliance';
  return null;
}

function NotificationItem({
  notification,
  onPress,
}: {
  notification: NotificationRow;
  onPress: (n: NotificationRow) => void;
}) {
  const { emoji, color } = getNotificationIcon(notification.type);

  return (
    <Pressable
      onPress={() => onPress(notification)}
      style={[styles.notificationItem, !notification.is_read && styles.unread]}
    >
      <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
        <Text style={styles.iconEmoji}>{emoji}</Text>
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, !notification.is_read && styles.unreadText]} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.notificationTime}>{formatTimeAgo(notification.created_at)}</Text>
      </View>
      {!notification.is_read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    notifications,
    loading,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications(user?.id);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications]
  );

  const handlePress = useCallback((notification: NotificationRow) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    const route = getNotificationRoute(notification.type, notification.related_id);
    if (route) {
      router.push(route as never);
    }
  }, [markAsRead]);

  const renderItem = useCallback(({ item }: { item: NotificationRow }) => (
    <NotificationItem notification={item} onPress={handlePress} />
  ), [handlePress]);

  const keyExtractor = useCallback((item: NotificationRow) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable onPress={markAllAsRead} hitSlop={8} style={styles.headerAction}>
              <CheckAllIcon />
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/(app)/notifications/settings' as never)}
            hitSlop={8}
            style={styles.headerAction}
          >
            <SettingsIcon />
          </Pressable>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl refreshing={loading && notifications.length > 0} onRefresh={refresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={THEME.colors.brand} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>
                You have no notifications. We'll let you know when something needs your attention.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          hasMore && notifications.length > 0 ? (
            <ActivityIndicator size="small" color={THEME.colors.brand} style={{ padding: 16 }} />
          ) : null
        }
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAction: {
    padding: 4,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  unread: {
    backgroundColor: THEME.colors.brand + '08',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 18,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  unreadText: {
    fontWeight: '700',
  },
  notificationBody: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.brand,
    marginLeft: 8,
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
