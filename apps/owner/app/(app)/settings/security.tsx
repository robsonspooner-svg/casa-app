import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useUserSessions, useSecurityAlerts, useAuditLog, useMFA } from '@casa/api';
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

function LockIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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

function ClockIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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

function EyeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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

const ACTION_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  success: { bg: THEME.colors.successBg, text: THEME.colors.success },
  failure: { bg: THEME.colors.errorBg, text: THEME.colors.error },
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

function StatusDot({ status }: { status: string }) {
  const colors = ACTION_STATUS_COLORS[status] || ACTION_STATUS_COLORS.success;
  return (
    <View style={[styles.statusDot, { backgroundColor: colors.text }]} />
  );
}

export default function SecuritySettingsScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, loading: sessionsLoading, revokeSession, revokeAllOtherSessions } = useUserSessions();
  const { alerts, loading: alertsLoading, acknowledgeAlert } = useSecurityAlerts();
  const { entries, loading: auditLoading } = useAuditLog();
  const { isEnabled: mfaEnabled, loading: mfaLoading, refresh: refreshMFA } = useMFA();

  useEffect(() => {
    refreshMFA();
  }, [refreshMFA]);

  const loading = sessionsLoading || alertsLoading || auditLoading || mfaLoading;

  const handleMFAToggle = (value: boolean) => {
    if (value) {
      router.push('/(app)/settings/mfa-setup' as any);
    } else {
      Alert.alert(
        'Disable MFA',
        'Are you sure you want to disable multi-factor authentication? This will make your account less secure.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => {
              router.push('/(app)/settings/mfa-setup' as any);
            },
          },
        ]
      );
    }
  };

  const handleRevokeAll = () => {
    if (sessions.length <= 1) return;
    Alert.alert(
      'Revoke All Sessions',
      'This will sign out all other devices. You will remain signed in on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke All',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeAllOtherSessions();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to revoke sessions.');
            }
          },
        },
      ]
    );
  };

  const handleRevokeSession = (sessionId: string, deviceName: string) => {
    Alert.alert(
      'Revoke Session',
      `Sign out "${deviceName}"? They will need to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeSession(sessionId);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to revoke session.');
            }
          },
        },
      ]
    );
  };

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
        {/* MFA Section */}
        <Text style={styles.sectionTitle}>Multi-Factor Authentication</Text>
        <View style={styles.card}>
          <View style={styles.mfaRow}>
            <View style={styles.mfaIcon}>
              <LockIcon />
            </View>
            <View style={styles.mfaInfo}>
              <Text style={styles.mfaLabel}>Two-Factor Authentication</Text>
              <Text style={styles.mfaDescription}>
                {mfaEnabled
                  ? 'Your account is protected with MFA'
                  : 'Add an extra layer of security to your account'}
              </Text>
            </View>
            <Switch
              value={mfaEnabled}
              onValueChange={handleMFAToggle}
              trackColor={{ false: THEME.colors.border, true: THEME.colors.brand + '66' }}
              thumbColor={mfaEnabled ? THEME.colors.brand : THEME.colors.canvas}
            />
          </View>
          {!mfaEnabled && (
            <Pressable
              style={styles.mfaSetupButton}
              onPress={() => router.push('/(app)/settings/mfa-setup' as any)}
            >
              <Text style={styles.mfaSetupButtonText}>Set Up MFA</Text>
            </Pressable>
          )}
        </View>

        {/* Active Sessions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          {sessions.length > 1 && (
            <Pressable onPress={handleRevokeAll} hitSlop={8}>
              <Text style={styles.revokeAllText}>Revoke all others</Text>
            </Pressable>
          )}
        </View>
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
                    {session.ip_address ? `${session.ip_address} \u00b7 ` : ''}
                    Last active {formatRelativeTime(session.last_active_at)}
                  </Text>
                </View>
                {index > 0 && (
                  <Pressable
                    onPress={() => handleRevokeSession(
                      session.id,
                      session.device_name || session.device_type || 'Unknown Device'
                    )}
                    style={styles.revokeButton}
                    hitSlop={6}
                  >
                    <Text style={styles.revokeText}>Revoke</Text>
                  </Pressable>
                )}
                {index === 0 && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Login History */}
        <Text style={styles.sectionTitle}>Login History</Text>
        <View style={styles.card}>
          {entries.length === 0 ? (
            <View style={styles.emptyRow}>
              <ClockIcon />
              <Text style={[styles.emptyText, { marginLeft: 8 }]}>No login activity recorded</Text>
            </View>
          ) : (
            entries
              .filter(e => e.action_type === 'auth' || e.resource_type === 'auth' || e.action.toLowerCase().includes('login') || e.action.toLowerCase().includes('sign'))
              .slice(0, 10)
              .map((entry, index, filteredArr) => (
                <View
                  key={entry.id}
                  style={[
                    styles.loginRow,
                    index < filteredArr.length - 1 && styles.borderBottom,
                  ]}
                >
                  <StatusDot status={entry.status} />
                  <View style={styles.loginInfo}>
                    <Text style={styles.loginAction}>{entry.action}</Text>
                    <Text style={styles.loginMeta}>
                      {entry.ip_address ? `${entry.ip_address} \u00b7 ` : ''}
                      {formatRelativeTime(entry.created_at)}
                    </Text>
                  </View>
                  <View style={[
                    styles.loginStatusBadge,
                    { backgroundColor: entry.status === 'success' ? THEME.colors.successBg : THEME.colors.errorBg },
                  ]}>
                    <Text style={[
                      styles.loginStatusText,
                      { color: entry.status === 'success' ? THEME.colors.success : THEME.colors.error },
                    ]}>
                      {entry.status === 'success' ? 'Success' : 'Failed'}
                    </Text>
                  </View>
                </View>
              ))
          )}
          {entries.filter(e => e.action_type === 'auth' || e.resource_type === 'auth' || e.action.toLowerCase().includes('login') || e.action.toLowerCase().includes('sign')).length === 0 && entries.length > 0 && (
            <View style={styles.emptyRow}>
              <ClockIcon />
              <Text style={[styles.emptyText, { marginLeft: 8 }]}>No login activity recorded</Text>
            </View>
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
                {(alert.status === 'unread' || alert.status === 'new') && (
                  <Pressable
                    onPress={() => acknowledgeAlert(alert.id)}
                    style={styles.acknowledgeButton}
                    hitSlop={6}
                  >
                    <Text style={styles.acknowledgeText}>Acknowledge</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>

        {/* Navigate to Privacy */}
        <Text style={styles.sectionTitle}>Privacy</Text>
        <Pressable
          style={styles.navRow}
          onPress={() => router.push('/(app)/settings/privacy' as any)}
        >
          <View style={styles.navIcon}>
            <EyeIcon />
          </View>
          <View style={styles.navInfo}>
            <Text style={styles.navLabel}>Privacy & Data</Text>
            <Text style={styles.navDescription}>Consent, data export, and account deletion</Text>
          </View>
          <ChevronRight />
        </Pressable>

        {/* Audit Log */}
        <Text style={styles.sectionTitle}>Audit Log</Text>
        <View style={styles.card}>
          {entries.length === 0 ? (
            <View style={styles.emptyRow}>
              <ClockIcon />
              <Text style={[styles.emptyText, { marginLeft: 8 }]}>No activity recorded</Text>
            </View>
          ) : (
            entries.slice(0, 20).map((entry, index) => (
              <View
                key={entry.id}
                style={[
                  styles.auditRow,
                  index < Math.min(entries.length, 20) - 1 && styles.borderBottom,
                ]}
              >
                <View style={styles.auditHeader}>
                  <Text style={styles.auditAction}>{entry.action}</Text>
                  <Text style={styles.auditTime}>{formatRelativeTime(entry.created_at)}</Text>
                </View>
                <Text style={styles.auditResource}>
                  {entry.resource_type}{entry.resource_id ? ` #${entry.resource_id.slice(0, 8)}` : ''}
                </Text>
                {entry.agent_execution && (
                  <View style={styles.agentBadge}>
                    <Text style={styles.agentBadgeText}>Agent</Text>
                  </View>
                )}
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
    fontSize: THEME.fontSize.h2,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 24,
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
  // MFA
  mfaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mfaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mfaInfo: {
    flex: 1,
    marginRight: 12,
  },
  mfaLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  mfaDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  mfaSetupButton: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
  },
  mfaSetupButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  // Sessions
  revokeAllText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.error,
  },
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
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  sessionMeta: {
    fontSize: THEME.fontSize.bodySmall,
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
  currentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.successBg,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.success,
  },
  // Login History
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  loginInfo: {
    flex: 1,
  },
  loginAction: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  loginMeta: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  loginStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  loginStatusText: {
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  alertDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  acknowledgeButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.infoBg,
  },
  acknowledgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.info,
  },
  // Privacy navigation
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
  },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navInfo: {
    flex: 1,
  },
  navLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  navDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  // Audit Log
  auditRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  auditAction: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  auditTime: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  auditResource: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  agentBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.colors.brand + '14',
  },
  agentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
});
