import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useAuth, useProfile, useAutonomySettings } from '@casa/api';
import Svg, { Path, Circle } from 'react-native-svg';

const AUTONOMY_LABELS: Record<string, string> = {
  manual: 'Manual',
  supervised: 'Supervised',
  balanced: 'Balanced',
  proactive: 'Proactive',
  autonomous: 'Autonomous',
};

function SettingsRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  showChevron = true,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingsIconBox, { backgroundColor: iconColor + '15' }]}>{icon}</View>
      <View style={styles.settingsRowContent}>
        <Text style={styles.settingsRowTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingsRowSubtitle}>{subtitle}</Text>}
      </View>
      {showChevron && (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { settings } = useAutonomySettings();

  const autonomyLabel = settings?.preset
    ? AUTONOMY_LABELS[settings.preset] || settings.preset
    : 'Balanced';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={7} r={4} stroke={THEME.colors.brand} strokeWidth={1.5} />
              </Svg>
            }
            iconColor={THEME.colors.brand}
            title="Profile"
            subtitle={profile?.full_name || profile?.email || undefined}
            onPress={() => router.push('/(app)/profile' as any)}
          />
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            iconColor={THEME.colors.brandIndigo}
            title="Subscription"
            subtitle={profile?.subscription_tier ? profile.subscription_tier.charAt(0).toUpperCase() + profile.subscription_tier.slice(1) : 'Free'}
            onPress={() => router.push('/(app)/subscription' as any)}
          />
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22" stroke={THEME.colors.success} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            iconColor={THEME.colors.success}
            title="Payment Setup"
            onPress={() => router.push('/(app)/payments' as any)}
          />
        </View>

        {/* Casa AI */}
        <SectionHeader title="Casa AI" />
        <View style={styles.card}>
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            iconColor={THEME.colors.brandIndigo}
            title="Autonomy Level"
            subtitle={`Currently: ${autonomyLabel}`}
            onPress={() => router.push('/(app)/autonomy' as any)}
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={THEME.colors.warning} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            iconColor={THEME.colors.warning}
            title="Notification Preferences"
            subtitle="Push, email, SMS, quiet hours"
            onPress={() => router.push('/(app)/notification-preferences' as any)}
          />
        </View>

        {/* Support */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={10} stroke={THEME.colors.info} strokeWidth={1.5} />
                <Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" stroke={THEME.colors.info} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            iconColor={THEME.colors.info}
            title="Help & FAQ"
            onPress={() => {}}
          />
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M22 6l-10 7L2 6" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            iconColor={THEME.colors.textSecondary}
            title="Contact Support"
            onPress={() => {}}
          />
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Casa v1.0.0</Text>
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
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  settingsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsRowContent: {
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  settingsRowSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 24,
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.error + '30',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.error,
  },
  versionText: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    marginTop: 16,
  },
});
