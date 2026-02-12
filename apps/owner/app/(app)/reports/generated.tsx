// Mission 13: Generated Reports Screen
// View generated reports, create new ones, manage scheduled reports

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useReports, useProperties } from '@casa/api';
import type { ReportType, ReportFormat, GeneratedReportRow } from '@casa/api';
import Svg, { Path } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  financial_summary: 'Financial Summary',
  cash_flow: 'Cash Flow',
  tax_summary: 'Tax Summary',
  property_performance: 'Property Performance',
  maintenance_summary: 'Maintenance Summary',
  tenant_history: 'Tenant History',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  generating: { label: 'Generating', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Ready', color: THEME.colors.success, bg: THEME.colors.successBg },
  failed: { label: 'Failed', color: THEME.colors.error, bg: THEME.colors.errorBg },
};

export default function GeneratedReportsScreen() {
  const insets = useSafeAreaInsets();
  const { generatedReports, scheduledReports, loading, refreshReports, generateReport, deleteReport, toggleScheduledReport, deleteScheduledReport } = useReports();
  const { properties } = useProperties();
  const [refreshing, setRefreshing] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Generate form state
  const [genType, setGenType] = useState<ReportType>('financial_summary');
  const [genFormat, setGenFormat] = useState<ReportFormat>('pdf');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshReports();
    setRefreshing(false);
  }, [refreshReports]);

  const handleGenerate = useCallback(async () => {
    try {
      setGenerating(true);
      const now = new Date();
      const dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
      const dateTo = now.toISOString().split('T')[0];

      await generateReport({
        report_type: genType,
        title: `${REPORT_TYPE_LABELS[genType]} - ${formatDate(dateTo)}`,
        date_from: dateFrom,
        date_to: dateTo,
        format: genFormat,
      });

      setShowGenerate(false);
      Alert.alert('Report Generated', 'Your report has been generated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [genType, genFormat, generateReport]);

  const [sharingId, setSharingId] = useState<string | null>(null);

  const handleOpenReport = useCallback(async (report: GeneratedReportRow) => {
    if (report.status !== 'completed') return;

    // If this report has a linked document record, open in document viewer
    if ((report as any).document_id) {
      router.push(`/(app)/documents/${(report as any).document_id}`);
      return;
    }

    // Otherwise share the file directly from file_url
    if (!report.file_url) {
      Alert.alert('Unavailable', 'Report file is not available.');
      return;
    }

    try {
      setSharingId(report.id);
      const ext = report.format === 'pdf' ? 'pdf' : report.format === 'csv' ? 'csv' : 'xlsx';
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        csv: 'text/csv',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      const localUri = `${FileSystem.cacheDirectory}report_${report.id}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(report.file_url, localUri);
      await Sharing.shareAsync(uri, {
        mimeType: mimeTypes[ext] || 'application/octet-stream',
        dialogTitle: report.title,
      });
    } catch (err: any) {
      if (err?.message?.includes('cancel')) return;
      Alert.alert('Share Error', err?.message || 'Failed to share report.');
    } finally {
      setSharingId(null);
    }
  }, []);

  const handleDeleteReport = useCallback((id: string) => {
    Alert.alert('Delete Report', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteReport(id) },
    ]);
  }, [deleteReport]);

  const handleDeleteScheduled = useCallback((id: string) => {
    Alert.alert('Delete Schedule', 'This will stop this recurring report.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteScheduledReport(id) },
    ]);
  }, [deleteScheduledReport]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <TouchableOpacity onPress={() => setShowGenerate(!showGenerate)} style={styles.addButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.colors.brand} />
        }
      >
        {/* Generate Form */}
        {showGenerate && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Generate Report</Text>

            <Text style={styles.fieldLabel}>Report Type</Text>
            <View style={styles.chipRow}>
              {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, genType === type && styles.chipActive]}
                  onPress={() => setGenType(type)}
                >
                  <Text style={[styles.chipText, genType === type && styles.chipTextActive]}>
                    {REPORT_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Format</Text>
            <View style={styles.chipRow}>
              {(['pdf', 'csv', 'xlsx'] as ReportFormat[]).map(fmt => (
                <TouchableOpacity
                  key={fmt}
                  style={[styles.chip, genFormat === fmt && styles.chipActive]}
                  onPress={() => setGenFormat(fmt)}
                >
                  <Text style={[styles.chipText, genFormat === fmt && styles.chipTextActive]}>
                    {fmt.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.generateButton, generating && { opacity: 0.6 }]}
              onPress={handleGenerate}
              disabled={generating}
            >
              <Text style={styles.generateButtonText}>
                {generating ? 'Generating...' : 'Generate Report'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Generated Reports */}
        <Text style={styles.sectionLabel}>GENERATED REPORTS</Text>
        {generatedReports.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No reports generated yet</Text>
            <Text style={styles.emptySubtext}>Tap + to generate your first report</Text>
          </View>
        )}
        {generatedReports.map(report => {
          const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.failed;
          const isCompleted = report.status === 'completed';
          const isSharing = sharingId === report.id;
          return (
            <TouchableOpacity
              key={report.id}
              style={styles.reportItem}
              onPress={isCompleted ? () => handleOpenReport(report) : undefined}
              onLongPress={() => handleDeleteReport(report.id)}
              activeOpacity={isCompleted ? 0.7 : 1}
            >
              <View style={styles.reportIcon}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} />
                  <Path d="M14 2v6h6" stroke={THEME.colors.textSecondary} strokeWidth={1.5} />
                </Svg>
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle} numberOfLines={1}>{report.title}</Text>
                <Text style={styles.reportMeta}>
                  {report.format.toUpperCase()} · {formatDate(report.date_from)} - {formatDate(report.date_to)}
                </Text>
              </View>
              {isSharing ? (
                <ActivityIndicator size="small" color={THEME.colors.brand} style={{ marginRight: 4 }} />
              ) : isCompleted ? (
                <TouchableOpacity
                  style={styles.shareIconButton}
                  onPress={() => handleOpenReport(report)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              ) : null}
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Scheduled Reports */}
        <Text style={styles.sectionLabel}>SCHEDULED REPORTS</Text>
        {scheduledReports.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No scheduled reports</Text>
            <Text style={styles.emptySubtext}>Automatic reports coming in a future update</Text>
          </View>
        )}
        {scheduledReports.map(schedule => (
          <View key={schedule.id} style={styles.scheduleItem}>
            <View style={styles.scheduleContent}>
              <Text style={styles.scheduleTitle}>{schedule.title}</Text>
              <Text style={styles.scheduleMeta}>
                {schedule.frequency} · {schedule.format.toUpperCase()} · {schedule.email_to.join(', ')}
              </Text>
            </View>
            <View style={styles.scheduleActions}>
              <TouchableOpacity
                onPress={() => toggleScheduledReport(schedule.id, !schedule.is_active)}
                style={[styles.toggleBadge, schedule.is_active ? { backgroundColor: THEME.colors.successBg } : { backgroundColor: THEME.colors.errorBg }]}
              >
                <Text style={[styles.toggleText, { color: schedule.is_active ? THEME.colors.success : THEME.colors.error }]}>
                  {schedule.is_active ? 'Active' : 'Paused'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteScheduled(schedule.id)}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {generatedReports.length > 0 && (
          <Text style={styles.hintText}>Tap a report to view & share · Long press to delete</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.colors.textInverse },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: THEME.colors.textTertiary,
    letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },

  // Form
  formCard: {
    backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 16,
    borderWidth: 1, borderColor: THEME.colors.border, marginBottom: 8,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 12 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: THEME.colors.textTertiary,
    letterSpacing: 0.3, marginBottom: 6, marginTop: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.canvas, borderWidth: 1, borderColor: THEME.colors.border,
  },
  chipActive: { backgroundColor: THEME.colors.brandIndigo, borderColor: THEME.colors.brandIndigo },
  chipText: { fontSize: 13, color: THEME.colors.textSecondary },
  chipTextActive: { color: THEME.colors.textInverse },
  generateButton: {
    backgroundColor: THEME.colors.brand, borderRadius: THEME.radius.md, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  generateButtonText: { fontSize: 15, fontWeight: '700', color: THEME.colors.textInverse },

  // Report items
  reportItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: THEME.colors.border,
  },
  reportIcon: {
    width: 36, height: 36, borderRadius: THEME.radius.sm, backgroundColor: THEME.colors.subtle,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  reportContent: { flex: 1, marginRight: 8 },
  reportTitle: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary },
  reportMeta: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 2 },
  shareIconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: THEME.radius.md },
  statusText: { fontSize: 11, fontWeight: '600' },

  // Schedule items
  scheduleItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: THEME.colors.border,
  },
  scheduleContent: { flex: 1 },
  scheduleTitle: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary },
  scheduleMeta: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 2 },
  scheduleActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: THEME.radius.md },
  toggleText: { fontSize: 11, fontWeight: '600' },

  // Empty
  emptyCard: {
    backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.border,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: THEME.colors.textSecondary },
  emptySubtext: { fontSize: 13, color: THEME.colors.textTertiary, marginTop: 4 },
  hintText: { fontSize: 12, color: THEME.colors.textTertiary, textAlign: 'center', marginTop: 8 },
});
