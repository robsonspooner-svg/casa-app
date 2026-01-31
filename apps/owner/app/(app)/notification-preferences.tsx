// Notification Preferences Screen
// Mission 12: In-App Communications
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useNotificationPreferences } from '@casa/api';
import type { NotificationPreferences } from '@casa/api/src/hooks/useNotificationPreferences';

function SettingToggle({
  label,
  description,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: THEME.colors.border, true: THEME.colors.brand + '80' }}
        thumbColor={value ? THEME.colors.brand : THEME.colors.surface}
      />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function NotificationPreferencesScreen() {
  const { preferences, loading, error, saving, updatePreferences } = useNotificationPreferences();

  const handleToggle = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      await updatePreferences({ [key]: value });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update preference');
    }
  }, [updatePreferences]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Preferences</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !preferences) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Preferences</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Unable to load preferences'}</Text>
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
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 44 }}>
          {saving && <ActivityIndicator size="small" color={THEME.colors.brand} />}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Channels */}
        <SectionHeader title="Channels" />
        <View style={styles.card}>
          <SettingToggle
            label="Push Notifications"
            description="Receive alerts on your device"
            value={preferences.push_enabled}
            onToggle={(v) => handleToggle('push_enabled', v)}
            disabled={saving}
          />
          <SettingToggle
            label="Email Notifications"
            description="Receive updates via email"
            value={preferences.email_enabled}
            onToggle={(v) => handleToggle('email_enabled', v)}
            disabled={saving}
          />
          <SettingToggle
            label="SMS Notifications"
            description="Receive urgent alerts via text message"
            value={preferences.sms_enabled}
            onToggle={(v) => handleToggle('sms_enabled', v)}
            disabled={saving}
          />
        </View>

        {/* Notification Types */}
        <SectionHeader title="Notification Types" />
        <View style={styles.card}>
          <SettingToggle
            label="Messages"
            description="New messages from tenants"
            value={preferences.message_notifications}
            onToggle={(v) => handleToggle('message_notifications', v)}
            disabled={saving}
          />
          <SettingToggle
            label="Rent Reminders"
            description="Payment due date notifications"
            value={preferences.rent_reminders}
            onToggle={(v) => handleToggle('rent_reminders', v)}
            disabled={saving}
          />
          <SettingToggle
            label="Payment Receipts"
            description="Confirmation when payments are received"
            value={preferences.payment_receipts}
            onToggle={(v) => handleToggle('payment_receipts', v)}
            disabled={saving}
          />
          <SettingToggle
            label="Maintenance Updates"
            description="Status changes on maintenance requests"
            value={preferences.maintenance_updates}
            onToggle={(v) => handleToggle('maintenance_updates', v)}
            disabled={saving}
          />
          <SettingToggle
            label="Marketing"
            description="Product updates and tips"
            value={preferences.marketing_emails}
            onToggle={(v) => handleToggle('marketing_emails', v)}
            disabled={saving}
          />
        </View>

        {/* Quiet Hours */}
        <SectionHeader title="Quiet Hours" />
        <View style={styles.card}>
          <SettingToggle
            label="Enable Quiet Hours"
            description={preferences.quiet_hours_enabled
              ? `${preferences.quiet_hours_start} - ${preferences.quiet_hours_end} (${preferences.quiet_hours_timezone})`
              : 'Pause non-urgent notifications during set hours'
            }
            value={preferences.quiet_hours_enabled}
            onToggle={(v) => handleToggle('quiet_hours_enabled', v)}
            disabled={saving}
          />
          {preferences.quiet_hours_enabled && (
            <View style={styles.quietHoursInfo}>
              <View style={styles.quietHoursRow}>
                <Text style={styles.quietHoursLabel}>Start</Text>
                <Text style={styles.quietHoursValue}>{preferences.quiet_hours_start}</Text>
              </View>
              <View style={styles.quietHoursRow}>
                <Text style={styles.quietHoursLabel}>End</Text>
                <Text style={styles.quietHoursValue}>{preferences.quiet_hours_end}</Text>
              </View>
              <View style={styles.quietHoursRow}>
                <Text style={styles.quietHoursLabel}>Timezone</Text>
                <Text style={styles.quietHoursValue}>{preferences.quiet_hours_timezone}</Text>
              </View>
              <Text style={styles.quietHoursNote}>
                Urgent notifications (emergencies, overdue payments) will still come through during quiet hours.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing.md,
  },
  sectionHeader: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    ...THEME.shadow.sm,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  toggleContent: {
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  toggleLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
  },
  toggleDescription: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  quietHoursInfo: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
  },
  quietHoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.xs,
  },
  quietHoursLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  quietHoursValue: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
  },
  quietHoursNote: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.sm,
    fontStyle: 'italic',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});
