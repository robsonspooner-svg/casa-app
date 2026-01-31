// Tribunal Evidence Report - Casa Agent Generated
// Mission 11: Property Inspections
// Generates an auditable, timestamped evidence report for dispute resolution
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button } from '@casa/ui';
import {
  useInspection,
  useAIComparison,
} from '@casa/api';
import type { InspectionAIIssueRow } from '@casa/api';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function EvidenceReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading: inspectionLoading } = useInspection(id || null);
  const { comparison, issues, loading: comparisonLoading } = useAIComparison(id || null);
  const [generating, setGenerating] = useState(false);

  const loading = inspectionLoading || comparisonLoading;

  const handleGenerateReport = useCallback(async () => {
    if (!id || !inspection) return;

    setGenerating(true);
    try {
      const { getSupabaseClient } = await import('@casa/api');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/generate-inspection-report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inspection_id: id,
            report_type: 'evidence',
            include_ai_comparison: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Report generation failed' })) as { error?: string };
        throw new Error(errorData.error || `Failed: ${response.status}`);
      }

      const result = await response.json() as { success: boolean; report_url?: string; error?: string };
      if (result.success && result.report_url) {
        Alert.alert(
          'Report Generated',
          'The evidence report has been generated and saved. You can access it from your inspection reports.',
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(result.error || 'Report generation failed');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [id, inspection]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const tenantIssues = issues.filter(i => i.is_tenant_responsible);
  const totalTenantCost = tenantIssues.reduce((s, i) => s + (i.estimated_cost || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evidence Report</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Report Header */}
        <View style={styles.reportHeader}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.reportTitle}>Tribunal Evidence Report</Text>
          <Text style={styles.reportSubtitle}>
            Auditable record for dispute resolution
          </Text>
        </View>

        {/* Property Details */}
        {inspection && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>
                {inspection.property?.address_line_1}, {inspection.property?.suburb} {inspection.property?.state}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Inspection Type</Text>
              <Text style={styles.detailValue}>
                {inspection.inspection_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date Conducted</Text>
              <Text style={styles.detailValue}>{formatDate(inspection.actual_date || inspection.scheduled_date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Completed At</Text>
              <Text style={styles.detailValue}>{formatDate(inspection.completed_at)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Overall Condition</Text>
              <Text style={styles.detailValue}>
                {inspection.overall_condition?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Not assessed'}
              </Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Audit Trail</Text>
          <Text style={styles.timelineNote}>
            All events are timestamped and stored in an immutable audit log.
          </Text>
          <View style={styles.timeline}>
            {inspection && (
              <>
                <TimelineItem
                  label="Inspection Scheduled"
                  date={formatDate(inspection.created_at)}
                />
                {inspection.actual_date && (
                  <TimelineItem
                    label="Inspection Started"
                    date={formatDate(inspection.actual_date)}
                  />
                )}
                {inspection.completed_at && (
                  <TimelineItem
                    label="Inspection Completed"
                    date={formatDate(inspection.completed_at)}
                  />
                )}
                {comparison && (
                  <TimelineItem
                    label="AI Analysis Completed"
                    date={formatDate(comparison.created_at)}
                  />
                )}
                {inspection.tenant_acknowledged_at && (
                  <TimelineItem
                    label={inspection.tenant_disputes ? 'Tenant Disputed' : 'Tenant Acknowledged'}
                    date={formatDate(inspection.tenant_acknowledged_at)}
                    isWarning={!!inspection.tenant_disputes}
                  />
                )}
              </>
            )}
          </View>
        </View>

        {/* AI Analysis Summary */}
        {comparison && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Analysis Findings</Text>
            <Text style={styles.analysisNote}>
              Analysis performed by Casa Agent using condition data, photos, and
              Australian residential tenancy law for the applicable state.
            </Text>

            <View style={styles.findingsGrid}>
              <View style={styles.findingItem}>
                <Text style={styles.findingValue}>{issues.length}</Text>
                <Text style={styles.findingLabel}>Total Issues</Text>
              </View>
              <View style={styles.findingItem}>
                <Text style={[styles.findingValue, { color: THEME.colors.error }]}>
                  {tenantIssues.length}
                </Text>
                <Text style={styles.findingLabel}>Tenant Responsible</Text>
              </View>
              <View style={styles.findingItem}>
                <Text style={styles.findingValue}>{formatCurrency(totalTenantCost)}</Text>
                <Text style={styles.findingLabel}>Tenant Liable Cost</Text>
              </View>
            </View>
          </View>
        )}

        {/* Issue Evidence */}
        {tenantIssues.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tenant-Responsible Issues</Text>
            {tenantIssues.map((issue, idx) => (
              <View key={issue.id} style={styles.evidenceItem}>
                <View style={styles.evidenceHeader}>
                  <Text style={styles.evidenceNumber}>#{idx + 1}</Text>
                  <View style={styles.evidenceInfo}>
                    <Text style={styles.evidenceRoom}>{issue.room_name}</Text>
                    <Text style={styles.evidenceItemName}>{issue.item_name}</Text>
                  </View>
                  {issue.estimated_cost ? (
                    <Text style={styles.evidenceCost}>{formatCurrency(issue.estimated_cost)}</Text>
                  ) : null}
                </View>
                <Text style={styles.evidenceDescription}>{issue.description}</Text>
                {issue.evidence_notes && (
                  <Text style={styles.evidenceNotes}>{issue.evidence_notes}</Text>
                )}
                <View style={styles.evidenceMeta}>
                  <Text style={styles.evidenceMetaText}>
                    Severity: {issue.severity} · Confidence: {Math.round(issue.confidence * 100)}%
                  </Text>
                  {issue.owner_agreed !== null && (
                    <Text style={styles.evidenceMetaText}>
                      Owner {issue.owner_agreed ? 'agreed' : 'disagreed'}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tenant Disputes */}
        {inspection?.tenant_disputes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tenant Disputes</Text>
            <View style={styles.disputeCard}>
              <Text style={styles.disputeText}>{inspection.tenant_disputes}</Text>
              <Text style={styles.disputeDate}>
                Filed: {formatDate(inspection.tenant_acknowledged_at)}
              </Text>
            </View>
          </View>
        )}

        {/* Room-by-Room Summary */}
        {inspection && inspection.rooms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Room-by-Room Condition Summary</Text>
            {inspection.rooms.map(room => {
              const roomIssues = issues.filter(i => i.room_name.toLowerCase() === room.name.toLowerCase());
              return (
                <View key={room.id} style={styles.roomSummary}>
                  <View style={styles.roomSummaryHeader}>
                    <Text style={styles.roomSummaryName}>{room.name}</Text>
                    <Text style={styles.roomSummaryCondition}>
                      {room.overall_condition?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}
                    </Text>
                  </View>
                  <Text style={styles.roomSummaryItems}>
                    {room.items.length} items inspected · {roomIssues.length} issues flagged
                  </Text>
                  {room.notes && (
                    <Text style={styles.roomSummaryNotes}>{room.notes}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Generate Report */}
        <View style={styles.generateSection}>
          <Text style={styles.generateNote}>
            Generate a downloadable PDF evidence report containing all inspection data,
            photos, AI analysis, timestamps, and audit trail. This report is suitable
            for tribunal submissions.
          </Text>
          <Button
            title={generating ? 'Generating...' : 'Generate PDF Evidence Report'}
            onPress={handleGenerateReport}
            disabled={generating}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineItem({ label, date, isWarning }: { label: string; date: string; isWarning?: boolean }) {
  return (
    <View style={timelineStyles.item}>
      <View style={[timelineStyles.dot, isWarning && { backgroundColor: THEME.colors.warning }]} />
      <View style={timelineStyles.content}>
        <Text style={[timelineStyles.label, isWarning && { color: THEME.colors.warning }]}>{label}</Text>
        <Text style={timelineStyles.date}>{date}</Text>
      </View>
    </View>
  );
}

const timelineStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: THEME.colors.border,
    paddingLeft: THEME.spacing.base,
    marginLeft: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.colors.brand,
    position: 'absolute',
    left: -7,
    top: THEME.spacing.sm + 2,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
  },
  date: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: THEME.spacing.base,
  },
  reportHeader: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
    gap: THEME.spacing.sm,
  },
  reportTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.textPrimary,
  },
  reportSubtitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  section: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    marginLeft: THEME.spacing.md,
  },
  timelineNote: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: THEME.spacing.md,
  },
  timeline: {
    marginLeft: THEME.spacing.sm,
  },
  analysisNote: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.md,
  },
  findingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  findingItem: {
    alignItems: 'center',
    gap: THEME.spacing.xs,
  },
  findingValue: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.textPrimary,
  },
  findingLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  evidenceItem: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  evidenceNumber: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.brand,
  },
  evidenceInfo: {
    flex: 1,
  },
  evidenceRoom: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
  },
  evidenceItemName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  evidenceCost: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.error,
  },
  evidenceDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  evidenceNotes: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
    marginTop: THEME.spacing.xs,
  },
  evidenceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  evidenceMetaText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  disputeCard: {
    backgroundColor: THEME.colors.errorBg,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
  },
  disputeText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    lineHeight: 22,
  },
  disputeDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.sm,
  },
  roomSummary: {
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  roomSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomSummaryName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  roomSummaryCondition: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
  },
  roomSummaryItems: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  roomSummaryNotes: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: THEME.spacing.xs,
  },
  generateSection: {
    paddingVertical: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  generateNote: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
