import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useUserSessions, useSecurityAlerts } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShieldIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DeviceIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: THEME.colors.errorBg, text: THEME.colors.error, label: 'Critical' },
  warning: { bg: THEME.colors.warningBg, text: THEME.colors.warning, label: 'Warning' },
  info: { bg: THEME.colors.infoBg, text: THEME.colors.info, label: 'Info' },
  high: { bg: THEME.colors.errorBg, text: THEME.colors.error, label: 'High' },
  medium: { bg: THEME.colors.warningBg, text: THEME.colors.warning, label: 'Medium' },
  low: { bg: THEME.colors.infoBg, text: THEME.colors.info, label: 'Low' },
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function SeverityBadge({ severity }: { severity: string }) {
  const config = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  return (
    <View style={[styles.severityBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.severityText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

export default function TenantSecuritySettingsScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, loading: sessionsLoading, revokeSession } = useUserSessions();
  const { alerts, loading: alertsLoading } = useSecurityAlerts();

  const loading = sessionsLoading || alertsLoading;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Security</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Active Sessions */}
        <Text style={styles.sectionTitle}>Active Sessions</Text>
        <View style={styles.card}>
          {sessions.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No active sessions</Text>
            </View>
          ) : (
            sessions.map((session, index) => (
              <View
                key={session.id}
                style={[
                  styles.sessionRow,
                  index < sessions.length - 1 && styles.borderBottom,
                ]}
              >
                <View style={styles.sessionIcon}>
                  <DeviceIcon />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionDevice}>
                    {session.device_name || session.device_type || 'Unknown Device'}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    Last active {formatRelativeTime(session.last_active_at)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => revokeSession(session.id)}
                  style={styles.revokeButton}
                  hitSlop={6}
                >
                  <Text style={styles.revokeText}>Revoke</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Security Alerts */}
        <Text style={styles.sectionTitle}>Security Alerts</Text>
        <View style={styles.card}>
          {alerts.length === 0 ? (
            <View style={styles.emptyRow}>
              <ShieldIcon />
              <Text style={[styles.emptyText, { marginLeft: 8 }]}>No security alerts</Text>
            </View>
          ) : (
            alerts.slice(0, 10).map((alert, index) => (
              <View
                key={alert.id}
                style={[
                  styles.alertRow,
                  index < Math.min(alerts.length, 10) - 1 && styles.borderBottom,
                ]}
              >
                <View style={styles.alertHeader}>
                  <SeverityBadge severity={alert.severity} />
                  <Text style={styles.alertTime}>{formatRelativeTime(alert.created_at)}</Text>
                </View>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertDescription}>{alert.description}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 24,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
  },
  // Sessions
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDevice: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  sessionMeta: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  revokeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.errorBg,
  },
  revokeText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.error,
  },
  // Alerts
  alertRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  alertTime: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  alertDescription: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
});
