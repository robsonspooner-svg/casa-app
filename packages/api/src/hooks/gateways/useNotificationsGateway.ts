// Notifications Gateway Hook
// Mission 17: Push Notifications & Alerts (Gateway for future implementation)
// This hook provides a navigation gateway and placeholder state for notification features

import { useCallback, useMemo } from 'react';
import type {
  Notification,
  NotificationPreference,
  NotificationSettings,
  NotificationType,
  GatewayListState,
} from '../../types/gateways';

export interface NotificationsGatewayState extends GatewayListState<Notification> {
  unreadCount: number;
  preferences: NotificationPreference[];
  settings: NotificationSettings | null;
  notificationTypes: NotificationType[];
}

export interface NotificationsGatewayActions {
  // Navigation gateways
  navigateToNotificationCenter: () => void;
  navigateToNotificationSettings: () => void;
  // Notification actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  // Push token management
  registerPushToken: (token: string, platform: 'ios' | 'android' | 'web') => Promise<void>;
  unregisterPushToken: (token: string) => Promise<void>;
  // Preference management
  updatePreference: (type: NotificationType, updates: Partial<NotificationPreference>) => Promise<void>;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  // Deep linking
  handleNotificationPress: (notification: Notification) => void;
  // Real-time subscription
  subscribeToNotifications: (onNotification: (notification: Notification) => void) => () => void;
}

const NOTIFICATION_TYPES: NotificationType[] = [
  'payment_received',
  'payment_due',
  'payment_overdue',
  'autopay_scheduled',
  'autopay_failed',
  'maintenance_submitted',
  'maintenance_acknowledged',
  'maintenance_scheduled',
  'maintenance_completed',
  'application_received',
  'application_status_changed',
  'message_received',
  'inspection_scheduled',
  'inspection_reminder',
  'inspection_completed',
  'compliance_due_soon',
  'compliance_overdue',
  'lease_expiring_soon',
  'lease_renewed',
  'tenant_moved_out',
  'system_announcement',
  'feature_update',
];

/**
 * Gateway hook for notification features.
 * Provides navigation entry points and placeholder data for Mission 17.
 *
 * When Mission 17 is implemented, this hook will be replaced with full functionality.
 * Push notifications will use Expo Push Notifications + SendGrid for email fallback.
 */
export function useNotificationsGateway(): NotificationsGatewayState & NotificationsGatewayActions {
  // Placeholder state
  const state: NotificationsGatewayState = useMemo(() => ({
    items: [],
    unreadCount: 0,
    preferences: [],
    settings: null,
    loading: false,
    error: null,
    isGateway: true,
    notificationTypes: NOTIFICATION_TYPES,
  }), []);

  // Navigation gateways
  const navigateToNotificationCenter = useCallback(() => {
    console.log('[Gateway] Navigate to notification center');
  }, []);

  const navigateToNotificationSettings = useCallback(() => {
    console.log('[Gateway] Navigate to notification settings');
  }, []);

  // Notification actions
  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    console.log('[Gateway] Mark notification as read:', notificationId, '- Mission 17 required');
  }, []);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    console.log('[Gateway] Mark all notifications as read - Mission 17 required');
  }, []);

  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
    console.log('[Gateway] Delete notification:', notificationId, '- Mission 17 required');
  }, []);

  const clearAll = useCallback(async (): Promise<void> => {
    console.log('[Gateway] Clear all notifications - Mission 17 required');
  }, []);

  // Push token management
  const registerPushToken = useCallback(async (
    token: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<void> => {
    console.log('[Gateway] Register push token:', platform, token.substring(0, 20), '- Mission 17 required');
  }, []);

  const unregisterPushToken = useCallback(async (token: string): Promise<void> => {
    console.log('[Gateway] Unregister push token:', token.substring(0, 20), '- Mission 17 required');
  }, []);

  // Preference management
  const updatePreference = useCallback(async (
    type: NotificationType,
    updates: Partial<NotificationPreference>
  ): Promise<void> => {
    console.log('[Gateway] Update notification preference:', type, updates, '- Mission 17 required');
  }, []);

  const updateSettings = useCallback(async (updates: Partial<NotificationSettings>): Promise<void> => {
    console.log('[Gateway] Update notification settings:', updates, '- Mission 17 required');
  }, []);

  // Deep linking
  const handleNotificationPress = useCallback((notification: Notification): void => {
    console.log('[Gateway] Handle notification press:', notification.notification_type, notification.related_id);
    // This will deep link to the relevant screen based on notification type
    // e.g., payment_received → payments screen, maintenance_submitted → maintenance detail
  }, []);

  // Real-time subscription placeholder
  const subscribeToNotifications = useCallback((
    _onNotification: (notification: Notification) => void
  ): (() => void) => {
    console.log('[Gateway] Subscribe to notifications - Mission 17 required');
    return () => {
      console.log('[Gateway] Unsubscribe from notifications');
    };
  }, []);

  return {
    ...state,
    navigateToNotificationCenter,
    navigateToNotificationSettings,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    registerPushToken,
    unregisterPushToken,
    updatePreference,
    updateSettings,
    handleNotificationPress,
    subscribeToNotifications,
  };
}

/**
 * Helper to get the deep link route for a notification type.
 * Used by handleNotificationPress to navigate to the correct screen.
 */
export function getNotificationRoute(
  type: NotificationType,
  relatedId?: string | null
): string | null {
  switch (type) {
    case 'payment_received':
    case 'payment_due':
    case 'payment_overdue':
    case 'autopay_scheduled':
    case 'autopay_failed':
      return relatedId ? `/(app)/payments/${relatedId}` : '/(app)/(tabs)/payments';
    case 'maintenance_submitted':
    case 'maintenance_acknowledged':
    case 'maintenance_scheduled':
    case 'maintenance_completed':
      return relatedId ? `/(app)/maintenance/${relatedId}` : '/(app)/maintenance';
    case 'application_received':
    case 'application_status_changed':
      return relatedId ? `/(app)/applications/${relatedId}` : '/(app)/applications';
    case 'message_received':
      return relatedId ? `/(app)/messages/${relatedId}` : '/(app)/messages';
    case 'inspection_scheduled':
    case 'inspection_reminder':
    case 'inspection_completed':
      return relatedId ? `/(app)/inspections/${relatedId}` : '/(app)/inspections';
    case 'lease_expiring_soon':
    case 'lease_renewed':
    case 'tenant_moved_out':
      return relatedId ? `/(app)/tenancies/${relatedId}` : '/(app)/tenancies';
    case 'compliance_due_soon':
    case 'compliance_overdue':
      return '/(app)/compliance';
    case 'system_announcement':
    case 'feature_update':
      return '/(app)/notifications';
    default:
      return null;
  }
}
