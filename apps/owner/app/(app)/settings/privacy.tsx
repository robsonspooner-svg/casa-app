import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useConsent, useDataExport } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DownloadIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke={THEME.colors.error} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ExternalLinkIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke={THEME.colors.info} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FileIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface ConsentRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  isLast?: boolean;
}

function ConsentRow({ label, description, value, onValueChange, isLast }: ConsentRowProps) {
  return (
    <View style={[styles.settingRow, !isLast && styles.borderBottom]}>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: THEME.colors.border, true: THEME.colors.brand + '66' }}
        thumbColor={value ? THEME.colors.brand : THEME.colors.canvas}
      />
    </View>
  );
}

interface DocumentLinkProps {
  label: string;
  description: string;
  url: string;
  isLast?: boolean;
}

function DocumentLink({ label, description, url, isLast }: DocumentLinkProps) {
  return (
    <Pressable
      style={[styles.documentRow, !isLast && styles.borderBottom]}
      onPress={() => Linking.openURL(url)}
    >
      <View style={styles.documentIcon}>
        <FileIcon />
      </View>
      <View style={styles.documentContent}>
        <Text style={styles.documentLabel}>{label}</Text>
        <Text style={styles.documentDescription}>{description}</Text>
      </View>
      <ExternalLinkIcon />
    </Pressable>
  );
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: THEME.colors.warningBg, text: THEME.colors.warning, label: 'Pending' },
  processing: { bg: THEME.colors.infoBg, text: THEME.colors.info, label: 'Processing' },
  completed: { bg: THEME.colors.successBg, text: THEME.colors.success, label: 'Completed' },
  failed: { bg: THEME.colors.errorBg, text: THEME.colors.error, label: 'Failed' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const { consents, loading: consentLoading, recordConsent, hasConsented } = useConsent();
  const { requests, loading: requestsLoading, requestExport, requestDeletion } = useDataExport();
  const [exporting, setExporting] = useState(false);

  const loading = consentLoading || requestsLoading;

  const handleTermsToggle = useCallback(async (value: boolean) => {
    if (!value) {
      Alert.alert(
        'Terms of Service',
        'Accepting the Terms of Service is required to use Casa. You cannot withdraw this consent while maintaining an active account.',
        [{ text: 'OK' }]
      );
      return;
    }
    await recordConsent('terms_of_service', '1.0', value);
  }, [recordConsent]);

  const handlePrivacyPolicyToggle = useCallback(async (value: boolean) => {
    if (!value) {
      Alert.alert(
        'Privacy Policy',
        'Accepting the Privacy Policy is required to use Casa. You cannot withdraw this consent while maintaining an active account.',
        [{ text: 'OK' }]
      );
      return;
    }
    await recordConsent('privacy_policy', '1.0', value);
  }, [recordConsent]);

  const handleMarketingToggle = useCallback(async (value: boolean) => {
    await recordConsent('marketing_emails', '1.0', value);
  }, [recordConsent]);

  const handleAnalyticsToggle = useCallback(async (value: boolean) => {
    await recordConsent('analytics', '1.0', value);
  }, [recordConsent]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await requestExport();
      Alert.alert(
        'Export Requested',
        'Your data export has been queued. You will receive a notification when it is ready to download.'
      );
    } finally {
      setExporting(false);
    }
  }, [requestExport]);

  const handleDeletion = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.\n\nYou will have 30 days to cancel this request before your data is permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            await requestDeletion();
            Alert.alert(
              'Deletion Requested',
              'Your account deletion request has been submitted. This process may take up to 30 days. You can cancel this request by contacting support.'
            );
          },
        },
      ]
    );
  }, [requestDeletion]);

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
        <Text style={styles.headerTitle}>Privacy & Data</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Legal Documents */}
        <Text style={styles.sectionTitle}>Legal Documents</Text>
        <View style={styles.card}>
          <DocumentLink
            label="Terms of Service"
            description="View the Casa Terms of Service"
            url="https://getcasa.com.au/terms"
          />
          <DocumentLink
            label="Privacy Policy"
            description="How we collect, use, and protect your data"
            url="https://getcasa.com.au/privacy"
            isLast
          />
        </View>

        {/* Consent Management */}
        <Text style={styles.sectionTitle}>Consent Management</Text>
        <View style={styles.card}>
          <ConsentRow
            label="Terms of Service"
            description="Required to use Casa"
            value={hasConsented('terms_of_service')}
            onValueChange={handleTermsToggle}
          />
          <ConsentRow
            label="Privacy Policy"
            description="Required to use Casa"
            value={hasConsented('privacy_policy')}
            onValueChange={handlePrivacyPolicyToggle}
          />
          <ConsentRow
            label="Marketing Emails"
            description="Receive product updates and promotional content"
            value={hasConsented('marketing_emails')}
            onValueChange={handleMarketingToggle}
          />
          <ConsentRow
            label="Analytics"
            description="Help improve Casa by sharing anonymous usage data"
            value={hasConsented('analytics')}
            onValueChange={handleAnalyticsToggle}
            isLast
          />
        </View>

        {/* Your Data */}
        <Text style={styles.sectionTitle}>Your Data</Text>
        <View style={styles.card}>
          <Pressable
            onPress={handleExport}
            disabled={exporting}
            style={[styles.dataActionRow, styles.borderBottom]}
          >
            <View style={styles.dataActionIcon}>
              <DownloadIcon />
            </View>
            <View style={styles.dataActionContent}>
              <Text style={styles.dataActionLabel}>Export My Data</Text>
              <Text style={styles.dataActionDescription}>
                Download a copy of all your personal data
              </Text>
            </View>
            {exporting && <ActivityIndicator size="small" color={THEME.colors.brand} />}
          </Pressable>
          <Pressable onPress={handleDeletion} style={styles.dataActionRow}>
            <View style={[styles.dataActionIcon, { backgroundColor: THEME.colors.errorBg }]}>
              <TrashIcon />
            </View>
            <View style={styles.dataActionContent}>
              <Text style={[styles.dataActionLabel, { color: THEME.colors.error }]}>Delete My Account</Text>
              <Text style={styles.dataActionDescription}>
                Permanently remove your account and all data
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Data Requests */}
        {requests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Data Requests</Text>
            <View style={styles.card}>
              {requests.map((request, index) => (
                <View
                  key={request.id}
                  style={[
                    styles.requestRow,
                    index < requests.length - 1 && styles.borderBottom,
                  ]}
                >
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestType}>
                      {request.request_type === 'export' ? 'Data Export' : 'Account Deletion'}
                    </Text>
                    <StatusBadge status={request.status} />
                  </View>
                  <Text style={styles.requestDate}>
                    Requested {formatDate(request.created_at)}
                  </Text>
                  {request.export_url && request.status === 'completed' && (
                    <Pressable
                      style={styles.downloadLink}
                      onPress={() => Linking.openURL(request.export_url!)}
                    >
                      <DownloadIcon />
                      <Text style={styles.downloadLinkText}>Download</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Data Retention Info */}
        <Text style={styles.sectionTitle}>Data Retention</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>
              Your data is stored securely in Australia (Sydney region) and is retained for the duration of your account. After account deletion, personal data is permanently removed within 30 days. Anonymised analytics data may be retained indefinitely.
            </Text>
          </View>
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
  // Legal Documents
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  documentDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  // Consent switches
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  settingDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  // Data actions
  dataActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dataActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dataActionContent: {
    flex: 1,
  },
  dataActionLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  dataActionDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  // Data requests
  requestRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  requestType: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  requestDate: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  downloadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  downloadLinkText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  // Info row
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
});
