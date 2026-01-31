// Inspection Detail + Acknowledge/Dispute - Tenant View
// Mission 11: Property Inspections
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, ConditionBadge } from '@casa/ui';
import { useInspection, useInspectionMutations } from '@casa/api';
import type { InspectionStatus } from '@casa/api';

const STATUS_CONFIG: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: '#F5F5F5' },
  tenant_review: { label: 'Your Review', color: THEME.colors.brand, bg: '#EDE9FE' },
  disputed: { label: 'Disputed', color: THEME.colors.error, bg: THEME.colors.errorBg },
  finalized: { label: 'Finalized', color: THEME.colors.success, bg: THEME.colors.successBg },
};

export default function TenantInspectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading, error, refreshing, refreshInspection } = useInspection(id || null);
  const { acknowledgeInspection, disputeInspection } = useInspectionMutations();

  const [disputeText, setDisputeText] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAcknowledge = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await acknowledgeInspection(id);
      Alert.alert('Acknowledged', 'You have acknowledged the inspection report.');
      refreshInspection();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to acknowledge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = async () => {
    if (!id || !disputeText.trim()) {
      Alert.alert('Required', 'Please describe your dispute.');
      return;
    }
    setSubmitting(true);
    try {
      await disputeInspection(id, disputeText.trim());
      Alert.alert('Dispute Submitted', 'Your dispute has been recorded and the owner will be notified.');
      setShowDisputeForm(false);
      refreshInspection();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit dispute');
    } finally {
      setSubmitting(false);
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
  const needsReview = inspection.status === 'tenant_review';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspection Report</Text>
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

        {/* Rooms */}
        <Text style={styles.sectionTitle}>Rooms</Text>
        {inspection.rooms.map(room => (
          <View key={room.id} style={styles.roomCard}>
            <View style={styles.roomHeader}>
              <Text style={styles.roomName}>{room.name}</Text>
              {room.overall_condition && (
                <ConditionBadge condition={room.overall_condition} />
              )}
            </View>
            {room.notes && (
              <Text style={styles.roomNotes}>{room.notes}</Text>
            )}
            {room.items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.condition ? (
                  <ConditionBadge condition={item.condition} />
                ) : (
                  <Text style={styles.itemUnchecked}>-</Text>
                )}
              </View>
            ))}
          </View>
        ))}

        {/* Summary Notes */}
        {inspection.summary_notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Inspector Notes</Text>
            <Text style={styles.notesText}>{inspection.summary_notes}</Text>
          </View>
        )}

        {/* Acknowledgment */}
        {inspection.tenant_acknowledged && (
          <View style={styles.acknowledgmentCard}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.acknowledgmentText}>
              You acknowledged this report on {new Date(inspection.tenant_acknowledged_at || '').toLocaleDateString('en-AU')}
            </Text>
          </View>
        )}

        {inspection.tenant_disputes && (
          <View style={[styles.acknowledgmentCard, { backgroundColor: THEME.colors.errorBg }]}>
            <Text style={[styles.acknowledgmentText, { color: THEME.colors.error }]}>
              Your dispute: {inspection.tenant_disputes}
            </Text>
          </View>
        )}

        {/* Action Buttons (for tenant review) */}
        {needsReview && !inspection.tenant_acknowledged && (
          <View style={styles.actionsSection}>
            {!showDisputeForm ? (
              <>
                <Button
                  title={submitting ? 'Processing...' : 'Acknowledge Report'}
                  onPress={handleAcknowledge}
                  disabled={submitting}
                />
                <Button
                  title="Dispute Report"
                  onPress={() => setShowDisputeForm(true)}
                  variant="text"
                  disabled={submitting}
                />
              </>
            ) : (
              <View style={styles.disputeForm}>
                <Text style={styles.disputeTitle}>Describe Your Dispute</Text>
                <TextInput
                  style={styles.disputeInput}
                  placeholder="Describe what you disagree with in the report..."
                  value={disputeText}
                  onChangeText={setDisputeText}
                  multiline
                  placeholderTextColor={THEME.colors.textTertiary}
                />
                <Button
                  title={submitting ? 'Submitting...' : 'Submit Dispute'}
                  onPress={handleDispute}
                  disabled={submitting || !disputeText.trim()}
                />
                <Button
                  title="Cancel"
                  onPress={() => { setShowDisputeForm(false); setDisputeText(''); }}
                  variant="text"
                />
              </View>
            )}
          </View>
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
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
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
    marginBottom: THEME.spacing.sm,
  },
  roomName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  roomNotes: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  itemName: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
  },
  itemUnchecked: {
    fontSize: THEME.fontSize.bodySmall,
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
  actionsSection: {
    paddingVertical: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  disputeForm: {
    gap: THEME.spacing.md,
  },
  disputeTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  disputeInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: THEME.colors.border,
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
