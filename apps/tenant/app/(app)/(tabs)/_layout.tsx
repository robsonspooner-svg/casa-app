import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

function ActivityIcon({ focused }: { focused: boolean }) {
  const color = focused ? THEME.colors.brand : THEME.colors.textTertiary;
  return (
    <View style={styles.iconContainer}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
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

function HomeIcon({ focused }: { focused: boolean }) {
  const color = focused ? THEME.colors.brand : THEME.colors.textTertiary;
  return (
    <View style={styles.iconContainer}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z"
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
          tabBarIcon: ({ focused }) => <ActivityIcon focused={focused} />,
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
        name="home"
        options={{
          title: 'My Home',
          tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
        }}
      />
      {/* Hide old tabs from tab bar */}
      <Tabs.Screen name="rent" options={{ href: null }} />
      <Tabs.Screen name="maintenance" options={{ href: null }} />
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
});
