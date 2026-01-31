// Inspection Detail/Report - Owner View
// Mission 11: Property Inspections
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, ConditionBadge } from '@casa/ui';
import { useInspection, useInspectionMutations, useAIComparison } from '@casa/api';
import type { InspectionStatus, ConditionRating } from '@casa/api';

const STATUS_CONFIG: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: '#F5F5F5' },
  tenant_review: { label: 'Tenant Review', color: THEME.colors.brand, bg: '#EDE9FE' },
  disputed: { label: 'Disputed', color: THEME.colors.error, bg: THEME.colors.errorBg },
  finalized: { label: 'Finalized', color: THEME.colors.success, bg: THEME.colors.successBg },
};

export default function InspectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading, error, refreshing, refreshInspection } = useInspection(id || null);
  const { startInspection, completeInspection, cancelInspection, sendForTenantReview, finalizeInspection } = useInspectionMutations();
  const { comparison } = useAIComparison(id || null);
  const isExitInspection = inspection?.inspection_type === 'exit';
  const hasComparison = comparison !== null;

  const handleAction = async (action: string) => {
    if (!id) return;

    try {
      switch (action) {
        case 'start':
          await startInspection(id);
          break;
        case 'conduct':
          router.push({ pathname: '/(app)/inspections/[id]/conduct' as any, params: { id } });
          return;
        case 'complete':
          await completeInspection(id, inspection?.overall_condition || undefined, inspection?.summary_notes || undefined);
          break;
        case 'send_review':
          await sendForTenantReview(id);
          break;
        case 'finalize':
          await finalizeInspection(id);
          break;
        case 'cancel':
          Alert.alert('Cancel Inspection', 'Are you sure you want to cancel this inspection?', [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
              await cancelInspection(id);
              refreshInspection();
            }},
          ]);
          return;
      }
      refreshInspection();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !inspection) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inspection</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Inspection not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[inspection.status];
  const completedRooms = inspection.rooms.filter(r => r.completed_at).length;
  const totalRooms = inspection.rooms.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspection</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshInspection} tintColor={THEME.colors.brand} />
        }
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>
              {inspection.inspection_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>
              {new Date(inspection.scheduled_date).toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          </View>
          {inspection.scheduled_time && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>{inspection.scheduled_time.slice(0, 5)}</Text>
            </View>
          )}
          {inspection.property && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Property</Text>
              <Text style={styles.infoValue}>
                {inspection.property.address_line_1}, {inspection.property.suburb}
              </Text>
            </View>
          )}
          {inspection.overall_condition && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Overall</Text>
              <ConditionBadge condition={inspection.overall_condition} size="medium" />
            </View>
          )}
        </View>

        {/* Progress Bar */}
        {totalRooms > 0 && (
          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>
              Rooms ({completedRooms}/{totalRooms} complete)
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${totalRooms > 0 ? (completedRooms / totalRooms) * 100 : 0}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Rooms List */}
        {inspection.rooms.map(room => {
          const roomImages = inspection.images.filter(img => img.room_id === room.id);
          const checkedItems = room.items.filter(item => item.checked_at).length;

          return (
            <TouchableOpacity
              key={room.id}
              style={styles.roomCard}
              onPress={() => {
                if (inspection.status === 'in_progress') {
                  router.push({ pathname: '/(app)/inspections/[id]/rooms/[roomId]' as any, params: { id: inspection.id, roomId: room.id } });
                }
              }}
              activeOpacity={inspection.status === 'in_progress' ? 0.7 : 1}
            >
              <View style={styles.roomHeader}>
                <View style={styles.roomTitleRow}>
                  {room.completed_at ? (
                    <View style={styles.checkIcon}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                  ) : (
                    <View style={styles.pendingIcon} />
                  )}
                  <Text style={styles.roomName}>{room.name}</Text>
                </View>
                {room.overall_condition && (
                  <ConditionBadge condition={room.overall_condition} />
                )}
              </View>
              <View style={styles.roomMeta}>
                <Text style={styles.roomMetaText}>
                  {checkedItems}/{room.items.length} items checked
                </Text>
                {roomImages.length > 0 && (
                  <Text style={styles.roomMetaText}>{roomImages.length} photos</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Summary Notes */}
        {inspection.summary_notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Summary Notes</Text>
            <Text style={styles.notesText}>{inspection.summary_notes}</Text>
          </View>
        )}

        {/* Tenant Acknowledgment */}
        {inspection.tenant_acknowledged && (
          <View style={styles.acknowledgmentCard}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.acknowledgmentText}>
              Tenant acknowledged on {new Date(inspection.tenant_acknowledged_at || '').toLocaleDateString('en-AU')}
            </Text>
          </View>
        )}

        {inspection.tenant_disputes && (
          <View style={[styles.acknowledgmentCard, { backgroundColor: THEME.colors.errorBg }]}>
            <Text style={[styles.acknowledgmentText, { color: THEME.colors.error }]}>
              Tenant dispute: {inspection.tenant_disputes}
            </Text>
          </View>
        )}

        {/* Casa Agent Analysis - for exit inspections */}
        {isExitInspection && (inspection.status === 'completed' || inspection.status === 'tenant_review' || inspection.status === 'finalized' || inspection.status === 'disputed') && (
          <TouchableOpacity
            style={styles.agentCard}
            onPress={() => router.push({ pathname: '/(app)/inspections/[id]/comparison' as any, params: { id: inspection.id } })}
            activeOpacity={0.7}
          >
            <View style={styles.agentCardHeader}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <View style={styles.agentCardInfo}>
                <Text style={styles.agentCardTitle}>Casa Agent Analysis</Text>
                <Text style={styles.agentCardSubtitle}>
                  {hasComparison
                    ? `${comparison.total_issues} issues found · Bond recommendation available`
                    : 'Compare entry vs exit conditions with AI'
                  }
                </Text>
              </View>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            {hasComparison && comparison.bond_deduction_amount > 0 && (
              <View style={styles.agentBondPreview}>
                <Text style={styles.agentBondLabel}>Recommended bond deduction</Text>
                <Text style={styles.agentBondAmount}>
                  {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(comparison.bond_deduction_amount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Report Generation */}
        {(inspection.status === 'completed' || inspection.status === 'tenant_review' || inspection.status === 'finalized') && (
          <View style={styles.reportSection}>
            {inspection.report_url ? (
              <TouchableOpacity style={styles.reportCard} activeOpacity={0.7}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.success} strokeWidth={1.5} />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.success} strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
                <Text style={styles.reportCardText}>View Inspection Report</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.reportCard}
                onPress={async () => {
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
                        body: JSON.stringify({ inspection_id: id }),
                      }
                    );

                    if (!response.ok) throw new Error('Report generation failed');
                    Alert.alert('Report Generated', 'Inspection report has been created.');
                    refreshInspection();
                  } catch (err) {
                    Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate report');
                  }
                }}
                activeOpacity={0.7}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.brand} strokeWidth={1.5} />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
                <Text style={styles.reportCardText}>Generate Inspection Report</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          {inspection.status === 'scheduled' && (
            <>
              <Button title="Start Inspection" onPress={() => handleAction('start')} />
              <Button title="Cancel" onPress={() => handleAction('cancel')} variant="text" />
            </>
          )}
          {inspection.status === 'in_progress' && (
            <>
              <Button title="Continue Inspection" onPress={() => handleAction('conduct')} />
              <Button
                title="Complete Inspection"
                onPress={() => handleAction('complete')}
                variant="secondary"
              />
            </>
          )}
          {inspection.status === 'completed' && (
            <Button title="Send for Tenant Review" onPress={() => handleAction('send_review')} />
          )}
          {inspection.status === 'tenant_review' && (
            <Button title="Finalize Inspection" onPress={() => handleAction('finalize')} />
          )}
        </View>
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
  infoCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  infoLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  infoValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    marginLeft: THEME.spacing.md,
  },
  statusBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.full,
  },
  statusText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
  },
  progressSection: {
    marginBottom: THEME.spacing.md,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: THEME.colors.subtle,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.colors.success,
    borderRadius: 4,
  },
  roomCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.sm,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.xs,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  checkIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  roomName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  roomMeta: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginLeft: 28,
  },
  roomMetaText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  notesSection: {
    marginTop: THEME.spacing.md,
  },
  notesText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
  },
  acknowledgmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.successBg,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.md,
  },
  acknowledgmentText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.success,
    flex: 1,
  },
  agentCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.brand,
    ...THEME.shadow.md,
  },
  agentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  agentCardInfo: {
    flex: 1,
  },
  agentCardTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  agentCardSubtitle: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  agentBondPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  agentBondLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  agentBondAmount: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.brand,
  },
  reportSection: {
    marginTop: THEME.spacing.md,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    ...THEME.shadow.sm,
  },
  reportCardText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.brand,
  },
  actionsSection: {
    paddingVertical: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
});
