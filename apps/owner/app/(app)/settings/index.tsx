import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRight() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const SETTINGS_ITEMS = [
  {
    title: 'Agent Autonomy',
    description: 'Control how much Casa can do without asking',
    route: '/(app)/autonomy',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    title: 'Agent Rules',
    description: 'Manage learned and manual rules for Casa',
    route: '/(app)/settings/agent-rules',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  },
  {
    title: 'Compliance',
    description: 'Track safety and regulatory requirements',
    route: '/(app)/compliance',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  },
];

const ACCOUNT_ITEMS = [
  {
    title: 'Subscription',
    description: 'Manage your plan, billing, and invoices',
    route: '/(app)/settings/subscription',
    icon: 'M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4M20 12a2 2 0 010 4H6a2 2 0 01-2-2c0-1.1.9-2 2-2h14z',
  },
  {
    title: 'Data Export',
    description: 'Download a copy of all your data',
    route: '/(app)/settings/data-export',
    icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  },
  {
    title: 'Support',
    description: 'Get help, submit tickets',
    route: '/(app)/support',
    icon: 'M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z',
  },
];

const SECURITY_ITEMS = [
  {
    title: 'Security',
    description: 'MFA, sessions, login history, and alerts',
    route: '/(app)/settings/security',
    icon: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
  },
  {
    title: 'Privacy & Data',
    description: 'Consent, data export, and account deletion',
    route: '/(app)/settings/privacy',
    icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
  },
];

const KNOWLEDGE_ITEMS = [
  {
    title: 'Learning Hub',
    description: 'Guides and articles for landlords',
    route: '/(app)/learn',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    title: 'Regulatory Updates',
    description: 'Tenancy law and safety changes',
    route: '/(app)/updates',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
];

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Casa AI</Text>
        {SETTINGS_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.settingsRow}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.settingsIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d={item.icon} stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={styles.settingsInfo}>
              <Text style={styles.settingsTitle}>{item.title}</Text>
              <Text style={styles.settingsDescription}>{item.description}</Text>
            </View>
            <ChevronRight />
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Account</Text>
        {ACCOUNT_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.settingsRow}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.settingsIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d={item.icon} stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={styles.settingsInfo}>
              <Text style={styles.settingsTitle}>{item.title}</Text>
              <Text style={styles.settingsDescription}>{item.description}</Text>
            </View>
            <ChevronRight />
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Security & Privacy</Text>
        {SECURITY_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.settingsRow}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.settingsIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d={item.icon} stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={styles.settingsInfo}>
              <Text style={styles.settingsTitle}>{item.title}</Text>
              <Text style={styles.settingsDescription}>{item.description}</Text>
            </View>
            <ChevronRight />
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Knowledge</Text>
        {KNOWLEDGE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.settingsRow}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.settingsIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d={item.icon} stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={styles.settingsInfo}>
              <Text style={styles.settingsTitle}>{item.title}</Text>
              <Text style={styles.settingsDescription}>{item.description}</Text>
            </View>
            <ChevronRight />
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    marginBottom: 8,
    ...THEME.shadow.sm,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsInfo: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  settingsDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
});
