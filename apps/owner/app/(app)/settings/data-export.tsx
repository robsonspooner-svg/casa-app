import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useAuth, getSupabaseClient } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DataExport {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  format: string;
  file_url: string | null;
  file_size: number | null;
  expires_at: string | null;
  requested_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DownloadIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PackageIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RefreshIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M23 4v6h-6M1 20v-6h6" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: THEME.colors.warningBg, text: THEME.colors.warning, label: 'Pending' },
  processing: { bg: THEME.colors.infoBg, text: THEME.colors.info, label: 'Processing' },
  completed: { bg: THEME.colors.successBg, text: THEME.colors.success, label: 'Completed' },
  failed: { bg: THEME.colors.errorBg, text: THEME.colors.error, label: 'Failed' },
  expired: { bg: THEME.colors.subtle, text: THEME.colors.textSecondary, label: 'Expired' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DataExportScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [exports, setExports] = useState<DataExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const fetchExports = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: err } = await (supabase.from('data_exports') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(20);

      if (err) throw err;
      setExports((data as DataExport[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exports');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  const handleRequestExport = useCallback(async () => {
    if (!user || !supabase) return;

    // Check for already-pending export
    const hasPending = exports.some(e => e.status === 'pending' || e.status === 'processing');
    if (hasPending) {
      Alert.alert(
        'Export In Progress',
        'You already have a data export being prepared. Please wait for it to complete before requesting a new one.',
      );
      return;
    }

    setExporting(true);
    try {
      const { data, error: err } = await (supabase.from('data_exports') as any)
        .insert({
          user_id: user.id,
          status: 'pending',
          format: 'zip',
        })
        .select()
        .single();

      if (err) throw err;

      const newExport = data as DataExport;
      setExports(prev => [newExport, ...prev]);

      Alert.alert(
        'Export Requested',
        'Your data export has been queued. This includes all your properties, tenancies, financial records, documents, and messages in ZIP format (CSV + PDF). You will be notified when it is ready.',
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to request export');
    } finally {
      setExporting(false);
    }
  }, [user, supabase, exports]);

  const handleDownload = useCallback(async (fileUrl: string) => {
    try {
      await Linking.openURL(fileUrl);
    } catch {
      Alert.alert('Error', 'Unable to open download link');
    }
  }, []);

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
        <Text style={styles.headerTitle}>Data Export</Text>
        <Pressable onPress={fetchExports} hitSlop={8} style={styles.refreshButton}>
          <RefreshIcon />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Export CTA */}
        <View style={styles.exportCard}>
          <PackageIcon />
          <Text style={styles.exportTitle}>Export All My Data</Text>
          <Text style={styles.exportDescription}>
            Download a complete copy of all your data including properties, tenancies, financial records, documents, and communications. Exported as a ZIP file containing CSV and PDF files.
          </Text>

          <View style={styles.formatRow}>
            <View style={styles.formatTag}>
              <Text style={styles.formatTagText}>ZIP</Text>
            </View>
            <View style={styles.formatTag}>
              <Text style={styles.formatTagText}>CSV</Text>
            </View>
            <View style={styles.formatTag}>
              <Text style={styles.formatTagText}>PDF</Text>
            </View>
          </View>

          <Pressable
            style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
            onPress={handleRequestExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={THEME.colors.textInverse} />
            ) : (
              <>
                <DownloadIcon />
                <Text style={styles.exportButtonText}>Request Data Export</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Export History */}
        <Text style={styles.sectionTitle}>Export History</Text>
        <View style={styles.card}>
          {exports.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No exports requested yet</Text>
            </View>
          ) : (
            exports.map((exportItem, index) => (
              <View
                key={exportItem.id}
                style={[
                  styles.exportRow,
                  index < exports.length - 1 && styles.borderBottom,
                ]}
              >
                <View style={styles.exportRowHeader}>
                  <Text style={styles.exportRowDate}>
                    {formatDate(exportItem.requested_at)}
                  </Text>
                  <StatusBadge status={exportItem.status} />
                </View>

                <Text style={styles.exportRowFormat}>
                  Format: {exportItem.format.toUpperCase()}
                  {exportItem.file_size ? ` - ${formatFileSize(exportItem.file_size)}` : ''}
                </Text>

                {exportItem.status === 'completed' && exportItem.file_url && (
                  <Pressable
                    style={styles.downloadButton}
                    onPress={() => handleDownload(exportItem.file_url!)}
                  >
                    <Text style={styles.downloadButtonText}>Download</Text>
                  </Pressable>
                )}

                {exportItem.status === 'failed' && exportItem.error_message && (
                  <Text style={styles.errorText}>{exportItem.error_message}</Text>
                )}

                {exportItem.expires_at && exportItem.status === 'completed' && (
                  <Text style={styles.expiresText}>
                    Expires {formatDate(exportItem.expires_at)}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  refreshButton: {
    padding: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Export CTA card
  exportCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    ...THEME.shadow.sm,
  },
  exportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  exportDescription: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  formatTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.subtle,
  },
  formatTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    width: '100%',
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },

  // Section
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Card
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },

  // Empty state
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

  // Export row
  exportRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  exportRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  exportRowDate: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  exportRowFormat: {
    fontSize: 13,
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
  downloadButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.brand,
  },
  downloadButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },
  errorText: {
    fontSize: 13,
    color: THEME.colors.error,
    marginTop: 4,
  },
  expiresText: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },
});
