import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { THEME } from '@casa/config';
import Svg, { Path } from 'react-native-svg';
import { useAgentContext } from '@casa/api';

function ActivityIcon({ focused }: { focused: boolean }) {
  const color = focused ? THEME.colors.brand : THEME.colors.textTertiary;
  return (
    <View style={styles.iconContainer}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"
          stroke={color}
          strokeWidth={focused ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={focused ? color : 'none'}
        />
        <Path
          d="M13.73 21a2 2 0 01-3.46 0"
          stroke={color}
          strokeWidth={focused ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function ChatIcon({ focused }: { focused: boolean }) {
  const color = focused ? THEME.colors.brand : THEME.colors.textTertiary;
  return (
    <View style={styles.iconContainer}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
          stroke={color}
          strokeWidth={focused ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={focused ? color : 'none'}
        />
      </Svg>
    </View>
  );
}

function PortfolioIcon({ focused }: { focused: boolean }) {
  const color = focused ? THEME.colors.brand : THEME.colors.textTertiary;
  return (
    <View style={styles.iconContainer}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18"
          stroke={color}
          strokeWidth={focused ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={focused ? color : 'none'}
        />
        <Path
          d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2"
          stroke={color}
          strokeWidth={focused ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M10 6h4M10 10h4M10 14h4M10 18h4"
          stroke={focused ? THEME.colors.textInverse : color}
          strokeWidth={focused ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function NotificationBadge() {
  const { pendingCount } = useAgentContext();
  if (pendingCount <= 0) return null;
  return (
    <View style={styles.badge}>
      <View style={styles.badgeDot} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: THEME.colors.brand,
        tabBarInactiveTintColor: THEME.colors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Activity',
          tabBarIcon: ({ focused }) => (
            <View>
              <ActivityIcon focused={focused} />
              <NotificationBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <ChatIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused }) => <PortfolioIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    height: 88,
    paddingTop: 8,
    paddingBottom: 28,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.error,
    borderWidth: 1.5,
    borderColor: THEME.colors.surface,
  },
});
