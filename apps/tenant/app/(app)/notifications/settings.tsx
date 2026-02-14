import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useAuth, useNotificationSettings, useNotificationPreferences } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SettingRow({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (val: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDesc}>{description}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: THEME.colors.border, true: THEME.colors.brand + '66' }} thumbColor={value ? THEME.colors.brand : THEME.colors.canvas} />
    </View>
  );
}

export default function TenantNotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { settings, loading: settingsLoading, enableQuietHours, disableQuietHours } = useNotificationSettings(user?.id);
  const { preferences, loading: prefsLoading, updatePreferences } = useNotificationPreferences();
  const loading = settingsLoading || prefsLoading;

  const handleToggleChannel = useCallback(async (channel: 'push_enabled' | 'email_enabled' | 'sms_enabled', value: boolean) => {
    await updatePreferences({ [channel]: value });
  }, [updatePreferences]);

  const handleQuietHoursToggle = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Sydney';
      await enableQuietHours('22:00', '07:00', deviceTz);
    } else {
      await disableQuietHours();
    }
  }, [enableQuietHours, disableQuietHours]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Notification Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Notification Channels</Text>
        <View style={styles.card}>
          <SettingRow label="Push Notifications" description="Receive alerts on your device" value={preferences?.push_enabled ?? true} onValueChange={(val) => handleToggleChannel('push_enabled', val)} />
          <SettingRow label="Email Notifications" description="Get updates via email" value={preferences?.email_enabled ?? true} onValueChange={(val) => handleToggleChannel('email_enabled', val)} />
          <SettingRow label="SMS Notifications" description="Text messages for urgent matters" value={preferences?.sms_enabled ?? false} onValueChange={(val) => handleToggleChannel('sms_enabled', val)} />
        </View>

        <Text style={styles.sectionTitle}>Quiet Hours</Text>
        <View style={styles.card}>
          <SettingRow label="Enable Quiet Hours" description="Silence push notifications 10pm - 7am" value={settings?.quiet_hours_enabled ?? false} onValueChange={handleQuietHoursToggle} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: THEME.colors.surface, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: THEME.colors.textPrimary },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: THEME.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 24 },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  settingContent: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 16, fontWeight: '600', color: THEME.colors.textPrimary },
  settingDesc: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
});
