// AI Entry/Exit Inspection Comparison - Casa Agent Analysis
// Mission 11: Property Inspections
// Core screen showing AI-powered comparison between entry and exit reports
// with actionable recommendations, bond suggestions, and evidence gathering
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, ConditionBadge } from '@casa/ui';
import {
  useInspection,
  useAIComparison,
  useAIComparisonMutations,
} from '@casa/api';
import type { InspectionAIIssueRow } from '@casa/api';

type ChangeType = 'wear_and_tear' | 'minor_damage' | 'major_damage' | 'missing' | 'tenant_damage' | 'improvement' | 'unchanged';

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  wear_and_tear: { label: 'Wear & Tear', color: THEME.colors.warning, bg: THEME.colors.warningBg, icon: 'clock' },
  minor_damage: { label: 'Minor Damage', color: '#EA580C', bg: '#FFF7ED', icon: 'alert' },
  major_damage: { label: 'Major Damage', color: THEME.colors.error, bg: THEME.colors.errorBg, icon: 'alert-circle' },
  tenant_damage: { label: 'Tenant Damage', color: THEME.colors.error, bg: THEME.colors.errorBg, icon: 'alert-circle' },
  missing: { label: 'Missing', color: THEME.colors.error, bg: THEME.colors.errorBg, icon: 'x-circle' },
  improvement: { label: 'Improvement', color: THEME.colors.success, bg: THEME.colors.successBg, icon: 'check' },
  unchanged: { label: 'Unchanged', color: THEME.colors.textTertiary, bg: THEME.colors.subtle, icon: 'minus' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  minor: { label: 'Minor', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  moderate: { label: 'Moderate', color: '#EA580C', bg: '#FFF7ED' },
  major: { label: 'Major', color: THEME.colors.error, bg: THEME.colors.errorBg },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function AIComparisonResults() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading: inspectionLoading, refreshInspection } = useInspection(id || null);
  const { comparison, issues, loading: comparisonLoading, error: comparisonError, refreshComparison } = useAIComparison(id || null);
  const { triggerComparison, updateIssueClassification, running } = useAIComparisonMutations();

  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'tenant' | 'wear_tear' | 'review'>('all');

  const loading = inspectionLoading || comparisonLoading;
  const hasComparison = comparison !== null;

  const handleTriggerComparison = useCallback(async () => {
    if (!inspection?.compare_to_inspection_id || !id) return;

    try {
      await triggerComparison(inspection.compare_to_inspection_id, id);
      refreshComparison();
    } catch (err) {
      Alert.alert('Analysis Failed', err instanceof Error ? err.message : 'Failed to run AI comparison');
    }
  }, [inspection, id, triggerComparison, refreshComparison]);

  const handleReclassify = useCallback(async (
    issueId: string,
    newType: ChangeType,
    estimatedCost?: number
  ) => {
    try {
      await updateIssueClassification(issueId, newType as any, estimatedCost);
      refreshComparison();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update classification');
    }
  }, [updateIssueClassification, refreshComparison]);

  const filteredIssues = issues.filter(issue => {
    switch (filter) {
      case 'tenant':
        return issue.is_tenant_responsible;
      case 'wear_tear':
        return issue.change_type === 'wear_and_tear';
      case 'review':
        return issue.confidence < 0.7 || issue.owner_agreed === null;
      default:
        return true;
    }
  });

  const tenantIssueCount = issues.filter(i => i.is_tenant_responsible).length;
  const totalEstimatedCost = issues.reduce((sum, i) => sum + (i.estimated_cost || 0), 0);
  const tenantCost = issues.filter(i => i.is_tenant_responsible).reduce((sum, i) => sum + (i.estimated_cost || 0), 0);
  const needsReview = issues.filter(i => i.confidence < 0.7 || i.owner_agreed === null).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Casa Agent Analysis</Text>
          <Text style={styles.headerSubtitle}>Entry vs Exit Comparison</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { refreshInspection(); refreshComparison(); }}
            tintColor={THEME.colors.brand}
          />
        }
      >
        {/* No comparison yet — trigger one */}
        {!hasComparison && !running && (
          <View style={styles.emptyState}>
            <View style={styles.agentIcon}>
              <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>Ready for AI Analysis</Text>
            <Text style={styles.emptyDescription}>
              Casa Agent will compare this exit inspection against the entry report,
              identify issues, classify wear-and-tear vs damage, and recommend bond deductions.
            </Text>
            {inspection?.compare_to_inspection_id ? (
              <Button
                title="Run Casa Agent Analysis"
                onPress={handleTriggerComparison}
              />
            ) : (
              <Text style={styles.emptyHint}>
                This inspection must be linked to an entry inspection to run comparison.
              </Text>
            )}
          </View>
        )}

        {/* Running indicator */}
        {running && (
          <View style={styles.runningCard}>
            <ActivityIndicator size="large" color={THEME.colors.brand} />
            <Text style={styles.runningTitle}>Casa Agent is analysing...</Text>
            <Text style={styles.runningDescription}>
              Comparing entry and exit conditions across all rooms and items.
              This may take a moment.
            </Text>
          </View>
        )}

        {/* Comparison Results */}
        {hasComparison && !running && (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Analysis Summary</Text>
              {comparison.summary && (
                <Text style={styles.summaryText}>{comparison.summary}</Text>
              )}

              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{issues.length}</Text>
                  <Text style={styles.metricLabel}>Issues Found</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: THEME.colors.error }]}>
                    {tenantIssueCount}
                  </Text>
                  <Text style={styles.metricLabel}>Tenant Responsible</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>
                    {formatCurrency(totalEstimatedCost)}
                  </Text>
                  <Text style={styles.metricLabel}>Est. Total Cost</Text>
                </View>
              </View>
            </View>

            {/* Bond Recommendation */}
            {comparison.bond_deduction_amount > 0 && (
              <View style={styles.bondCard}>
                <View style={styles.bondHeader}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.bondTitle}>Bond Recommendation</Text>
                </View>
                <View style={styles.bondAmounts}>
                  <View style={styles.bondRow}>
                    <Text style={styles.bondLabel}>Recommended Deduction</Text>
                    <Text style={styles.bondAmount}>
                      {formatCurrency(comparison.bond_deduction_amount)}
                    </Text>
                  </View>
                  <View style={styles.bondRow}>
                    <Text style={styles.bondLabel}>Tenant-Responsible Costs</Text>
                    <Text style={styles.bondSecondary}>{formatCurrency(tenantCost)}</Text>
                  </View>
                </View>
                {comparison.bond_deduction_reasoning && (
                  <Text style={styles.bondReasoning}>{comparison.bond_deduction_reasoning}</Text>
                )}
                <View style={styles.bondActions}>
                  <Button
                    title="Accept Recommendation"
                    onPress={() => Alert.alert(
                      'Bond Deduction',
                      `Apply ${formatCurrency(comparison.bond_deduction_amount)} deduction to bond claim?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Apply', onPress: () => {/* Bond claim logic */ } },
                      ]
                    )}
                  />
                  <TouchableOpacity
                    style={styles.bookTradeButton}
                    onPress={() => Alert.alert(
                      'Book Service Provider',
                      'Would you like Casa to find a service provider to handle repairs before your next tenant moves in?',
                      [
                        { text: 'Not Now', style: 'cancel' },
                        { text: 'Find Provider', onPress: () => router.push('/(app)/(tabs)/tasks' as any) },
                      ]
                    )}
                  >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.bookTradeText}>Book Service Provider for Repairs</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Needs Review Alert */}
            {needsReview > 0 && (
              <View style={styles.reviewAlert}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 9v4M12 17h.01" stroke={THEME.colors.warning} strokeWidth={2} strokeLinecap="round" />
                  <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={THEME.colors.warning} strokeWidth={1.5} />
                </Svg>
                <Text style={styles.reviewAlertText}>
                  {needsReview} issue{needsReview !== 1 ? 's' : ''} need{needsReview === 1 ? 's' : ''} your review
                </Text>
                <TouchableOpacity onPress={() => setFilter('review')}>
                  <Text style={styles.reviewAlertLink}>Review</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
              {([
                { key: 'all', label: `All (${issues.length})` },
                { key: 'tenant', label: `Tenant (${tenantIssueCount})` },
                { key: 'wear_tear', label: `Wear & Tear` },
                { key: 'review', label: `Review (${needsReview})` },
              ] as const).map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Issues List */}
            {filteredIssues.map(issue => {
              const isExpanded = expandedIssue === issue.id;
              const typeConfig = CHANGE_TYPE_CONFIG[issue.change_type] || CHANGE_TYPE_CONFIG.unchanged;
              const severityConfig = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.minor;

              return (
                <TouchableOpacity
                  key={issue.id}
                  style={styles.issueCard}
                  onPress={() => setExpandedIssue(isExpanded ? null : issue.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.issueHeader}>
                    <View style={styles.issueLeft}>
                      <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
                        <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>
                          {typeConfig.label}
                        </Text>
                      </View>
                      <View style={[styles.severityBadge, { backgroundColor: severityConfig.bg }]}>
                        <Text style={[styles.severityBadgeText, { color: severityConfig.color }]}>
                          {severityConfig.label}
                        </Text>
                      </View>
                    </View>
                    {issue.estimated_cost ? (
                      <Text style={styles.issueCost}>{formatCurrency(issue.estimated_cost)}</Text>
                    ) : null}
                  </View>

                  <Text style={styles.issueRoom}>{issue.room_name}</Text>
                  <Text style={styles.issueItem}>{issue.item_name}</Text>
                  <Text style={styles.issueDescription} numberOfLines={isExpanded ? undefined : 2}>
                    {issue.description}
                  </Text>

                  {/* Confidence indicator */}
                  <View style={styles.confidenceRow}>
                    <Text style={styles.confidenceLabel}>AI Confidence</Text>
                    <View style={styles.confidenceBar}>
                      <View
                        style={[
                          styles.confidenceFill,
                          {
                            width: `${issue.confidence * 100}%`,
                            backgroundColor: issue.confidence >= 0.7 ? THEME.colors.success : THEME.colors.warning,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.confidenceValue}>{Math.round(issue.confidence * 100)}%</Text>
                  </View>

                  {/* Expanded details */}
                  {isExpanded && (
                    <View style={styles.issueExpanded}>
                      {issue.evidence_notes && (
                        <View style={styles.evidenceSection}>
                          <Text style={styles.evidenceLabel}>Evidence Notes</Text>
                          <Text style={styles.evidenceText}>{issue.evidence_notes}</Text>
                        </View>
                      )}

                      {/* Reclassify options */}
                      <View style={styles.reclassifySection}>
                        <Text style={styles.reclassifyLabel}>Reclassify</Text>
                        <View style={styles.reclassifyOptions}>
                          {['wear_and_tear', 'tenant_damage', 'improvement', 'unchanged'].map(type => {
                            const config = CHANGE_TYPE_CONFIG[type] || CHANGE_TYPE_CONFIG.unchanged;
                            const isSelected = issue.change_type === type;
                            return (
                              <TouchableOpacity
                                key={type}
                                style={[
                                  styles.reclassifyChip,
                                  isSelected && { backgroundColor: config.color, borderColor: config.color },
                                ]}
                                onPress={() => {
                                  if (!isSelected) {
                                    handleReclassify(issue.id, type as ChangeType);
                                  }
                                }}
                              >
                                <Text style={[
                                  styles.reclassifyChipText,
                                  isSelected && { color: '#FFFFFF' },
                                ]}>
                                  {config.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Owner agree/disagree */}
                      <View style={styles.agreeSection}>
                        <Text style={styles.agreeLabel}>Do you agree with this assessment?</Text>
                        <View style={styles.agreeButtons}>
                          <TouchableOpacity
                            style={[styles.agreeButton, issue.owner_agreed === true && styles.agreeButtonActive]}
                            onPress={() => {
                              // Mark as agreed via reclassify (same type = agree)
                              handleReclassify(issue.id, issue.change_type as ChangeType);
                            }}
                          >
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                              <Path d="M20 6L9 17l-5-5" stroke={issue.owner_agreed === true ? '#FFFFFF' : THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                            <Text style={[styles.agreeButtonText, issue.owner_agreed === true && { color: '#FFFFFF' }]}>
                              Agree
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.agreeButton, styles.disagreeButton, issue.owner_agreed === false && styles.disagreeButtonActive]}
                            onPress={() => {
                              Alert.alert('Disagree', 'Add notes about why you disagree?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Skip Notes', onPress: () => handleReclassify(issue.id, 'unchanged' as ChangeType) },
                              ]);
                            }}
                          >
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                              <Path d="M18 6L6 18M6 6l12 12" stroke={issue.owner_agreed === false ? '#FFFFFF' : THEME.colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                            <Text style={[styles.disagreeButtonText, issue.owner_agreed === false && { color: '#FFFFFF' }]}>
                              Disagree
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {filteredIssues.length === 0 && (
              <View style={styles.noIssues}>
                <Text style={styles.noIssuesText}>
                  No issues match this filter.
                </Text>
              </View>
            )}

            {/* Actions Section */}
            <View style={styles.actionsSection}>
              <Button
                title="Generate Evidence Report"
                onPress={() => {
                  router.push({
                    pathname: '/(app)/inspections/[id]/evidence-report' as any,
                    params: { id: id! },
                  });
                }}
                variant="secondary"
              />
              <Button
                title="Re-run Analysis"
                onPress={handleTriggerComparison}
                variant="text"
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: THEME.spacing.base,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: THEME.spacing['2xl'],
    gap: THEME.spacing.md,
  },
  agentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.sm,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  emptyDescription: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  emptyHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Running
  runningCard: {
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.xl,
    marginVertical: THEME.spacing.xl,
    gap: THEME.spacing.md,
    ...THEME.shadow.md,
  },
  runningTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.brand,
  },
  runningDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Summary
  summaryCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  summaryTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  summaryText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    marginBottom: THEME.spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  metricItem: {
    alignItems: 'center',
    gap: THEME.spacing.xs,
  },
  metricValue: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.textPrimary,
  },
  metricLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  // Bond Card
  bondCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.brand,
    ...THEME.shadow.sm,
  },
  bondHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  bondTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  bondAmounts: {
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  bondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bondLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  bondAmount: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.brand,
  },
  bondSecondary: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  bondReasoning: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.md,
    fontStyle: 'italic',
  },
  bondActions: {
    gap: THEME.spacing.sm,
  },
  bookTradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
  },
  bookTradeText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.brand,
  },
  // Review Alert
  reviewAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.warningBg,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  reviewAlertText: {
    flex: 1,
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.warning,
    fontWeight: THEME.fontWeight.medium as any,
  },
  reviewAlertLink: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.brand,
  },
  // Filters
  filterRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  filterTab: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterTabActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  filterTabText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  // Issue Card
  issueCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.sm,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  issueLeft: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  typeBadgeText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
  },
  severityBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  severityBadgeText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
  },
  issueCost: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  issueRoom: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  issueItem: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  issueDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginTop: THEME.spacing.xs,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
  confidenceLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: THEME.colors.subtle,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceValue: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
    width: 32,
    textAlign: 'right',
  },
  // Expanded issue
  issueExpanded: {
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    gap: THEME.spacing.md,
  },
  evidenceSection: {
    gap: THEME.spacing.xs,
  },
  evidenceLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
  },
  evidenceText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    lineHeight: 20,
  },
  reclassifySection: {
    gap: THEME.spacing.sm,
  },
  reclassifyLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
  },
  reclassifyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  reclassifyChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  reclassifyChipText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
  },
  agreeSection: {
    gap: THEME.spacing.sm,
  },
  agreeLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
  },
  agreeButtons: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  agreeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.success,
  },
  agreeButtonActive: {
    backgroundColor: THEME.colors.success,
  },
  agreeButtonText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.success,
  },
  disagreeButton: {
    borderColor: THEME.colors.error,
  },
  disagreeButtonActive: {
    backgroundColor: THEME.colors.error,
  },
  disagreeButtonText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.error,
  },
  noIssues: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.xl,
  },
  noIssuesText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
  },
  actionsSection: {
    paddingVertical: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
});
