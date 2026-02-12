// NotificationProvider — Handles push notification setup, permissions, token registration,
// notification listeners, and deep link routing from push notifications for the tenant app.

import { useEffect, useRef, useCallback, createContext, useContext, type ReactNode } from 'react';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuth, usePushToken } from '@casa/api';

// Configure notification handler — how to display notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

interface NotificationContextType {
  expoPushToken: string | null;
  requestPermissions: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  requestPermissions: async () => false,
});

export function useNotificationContext() {
  return useContext(NotificationContext);
}

interface NotificationProviderProps {
  children: ReactNode;
}

export default function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  const { registerToken, token: registeredToken } = usePushToken(user?.id);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Request permissions and get push token
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    // Get Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      });
      tokenRef.current = tokenData.data;

      // Register with backend
      if (user?.id && tokenData.data) {
        await registerToken(tokenData.data);
      }

      return true;
    } catch (err) {
      console.error('Failed to get push token:', err);
      return false;
    }
  }, [user?.id, registerToken]);

  // Set up Android notification channels
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0D7377',
      });

      Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgent Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500],
        lightColor: '#FF4444',
        sound: 'default',
      });

      Notifications.setNotificationChannelAsync('rent', {
        name: 'Rent Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        lightColor: '#FF9500',
      });
    }
  }, []);

  // Request permissions on mount (if user is logged in)
  useEffect(() => {
    if (user?.id) {
      requestPermissions();
    }
  }, [user?.id, requestPermissions]);

  // Listen for incoming notifications (foreground)
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // Notification received while app is in foreground
      // The handler above controls display behavior
    });

    // Listen for notification taps (open app from notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      handleNotificationDeepLink(data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Handle app state changes — refresh badge count
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active') {
        // Clear badge when app becomes active
        await Notifications.setBadgeCountAsync(0);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <NotificationContext.Provider value={{ expoPushToken: tokenRef.current, requestPermissions }}>
      {children}
    </NotificationContext.Provider>
  );
}

/** Route tenant user to the correct screen based on notification deep link data */
function handleNotificationDeepLink(data: Record<string, unknown> | undefined) {
  if (!data) return;

  const deepLink = data.deep_link as string | undefined;
  const screen = data.screen as string | undefined;
  const entityType = data.entity_type as string | undefined;
  const entityId = data.entity_id as string | undefined;

  // Direct deep link path
  if (deepLink) {
    try {
      router.push(deepLink as never);
      return;
    } catch {
      // Fall through to screen-based routing
    }
  }

  // Screen-based routing
  if (screen) {
    try {
      router.push(screen as never);
      return;
    } catch {
      // Fall through
    }
  }

  // Entity-based routing for tenant app
  if (entityType && entityId) {
    switch (entityType) {
      case 'payment':
      case 'rent':
        router.push('/(app)/payments' as never);
        break;
      case 'maintenance':
        router.push(`/(app)/maintenance/${entityId}` as never);
        break;
      case 'inspection':
        router.push(`/(app)/inspections/${entityId}` as never);
        break;
      case 'document':
        router.push(`/(app)/documents/${entityId}` as never);
        break;
      case 'message':
        router.push('/(app)/(tabs)/chat' as never);
        break;
      case 'application':
        router.push(`/(app)/applications/${entityId}` as never);
        break;
      case 'tenancy':
        router.push('/(app)/tenancy' as never);
        break;
      default:
        router.push('/(app)/(tabs)/index' as never);
    }
  }
}
