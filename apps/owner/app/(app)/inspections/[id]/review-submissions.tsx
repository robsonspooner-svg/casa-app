// Owner Review Submissions — Review tenant additions, alterations, photos, and disputes
// Approve/reject each submission, respond to disputes, then sign to finalize

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { ConditionBadge } from '@casa/ui';
import {
  useInspection,
  useInspectionReview,
  useInspectionMutations,
} from '@casa/api';
import type { InspectionTenantSubmissionRow, InspectionItemDisputeRow, ConditionRating } from '@casa/api';
import SignaturePad from '../../../../components/SignaturePad';

const CONDITION_OPTIONS: { value: ConditionRating; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
];

export default function ReviewSubmissions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading, refreshInspection } = useInspection(id || null);
  const review = useInspectionReview(id || null);
  const { reviewSubmission, respondToDispute, signInspection, finalizeInspection } = useInspectionMutations();

  const [processing, setProcessing] = useState<string | null>(null);
  const [disputeResponse, setDisputeResponse] = useState('');
  const [resolvedCondition, setResolvedCondition] = useState<ConditionRating | null>(null);
  const [activeDispute, setActiveDispute] = useState<InspectionItemDisputeRow | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [signing, setSigning] = useState(false);

  const rooms = useMemo(() =>
    (inspection?.rooms || []).sort((a, b) => a.display_order - b.display_order),
  [inspection?.rooms]);

  // Group submissions by room
  const submissionsByRoom = useMemo(() => {
    const grouped: Record<string, InspectionTenantSubmissionRow[]> = {};
    for (const sub of review.submissions) {
      if (!grouped[sub.room_id]) grouped[sub.room_id] = [];
      grouped[sub.room_id].push(sub);
    }
    return grouped;
  }, [review.submissions]);

  // Group disputes by room (via item → room mapping)
  const disputesByRoom = useMemo(() => {
    const grouped: Record<string, InspectionItemDisputeRow[]> = {};
    for (const dispute of review.disputes) {
      // Find which room this item belongs to
      const room = rooms.find(r => r.items.some(i => i.id === dispute.item_id));
      const roomId = room?.id || 'unknown';
      if (!grouped[roomId]) grouped[roomId] = [];
      grouped[roomId].push(dispute);
    }
    return grouped;
  }, [review.disputes, rooms]);

  const handleApprove = useCallback(async (submissionId: string) => {
    setProcessing(submissionId);
    try {
      await reviewSubmission(submissionId, 'approved');
      await review.refreshReviewData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  }, [reviewSubmission, review]);

  const handleReject = useCallback(async (submissionId: string) => {
    if (typeof Alert.prompt === 'function') {
      Alert.prompt('Rejection Reason', 'Optionally explain why this is rejected:', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (notes?: string) => {
            setProcessing(submissionId);
            try {
              await reviewSubmission(submissionId, 'rejected', notes);
              await review.refreshReviewData();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]);
    } else {
      // Fallback for Android (no Alert.prompt)
      setProcessing(submissionId);
      try {
        await reviewSubmission(submissionId, 'rejected');
        await review.refreshReviewData();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject');
      } finally {
        setProcessing(null);
      }
    }
  }, [reviewSubmission, review]);

  const handleResolveDispute = useCallback(async () => {
    if (!activeDispute || !disputeResponse.trim()) return;

    setProcessing(activeDispute.id);
    try {
      await respondToDispute(activeDispute.id, disputeResponse, resolvedCondition);
      setActiveDispute(null);
      setDisputeResponse('');
      setResolvedCondition(null);
      await review.refreshReviewData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setProcessing(null);
    }
  }, [activeDispute, disputeResponse, resolvedCondition, respondToDispute, review]);

  const handleSign = useCallback(async (signatureImage: string) => {
    if (!id) return;
    setSigning(true);
    try {
      const supabaseModule = await import('@casa/api');
      const supabase = supabaseModule.getSupabaseClient();
      const storagePath = `signatures/owner/${id}/final_${Date.now()}.png`;
      const response = await fetch(signatureImage);
      const blob = await response.blob();
      await supabase.storage.from('inspection-images').upload(storagePath, blob, { contentType: 'image/png' });
      const { data: urlData } = supabase.storage.from('inspection-images').getPublicUrl(storagePath);

      await signInspection(id, 'owner', urlData.publicUrl);
      await finalizeInspection(id);
      setShowSignature(false);
      refreshInspection();
      Alert.alert(
        'Inspection Finalized',
        'The condition report has been finalized with both signatures.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to sign');
    } finally {
      setSigning(false);
    }
  }, [id, signInspection, finalizeInspection, refreshInspection]);

  if (loading || review.loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const pendingCount = review.submissions.filter(s => s.status === 'pending').length;
  const openDisputes = review.disputes.filter(d => d.status === 'open' || d.status === 'owner_responded').length;
  const allReviewed = pendingCount === 0 && openDisputes === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tenant Submissions</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, pendingCount > 0 && { color: THEME.colors.warning }]}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, openDisputes > 0 && { color: THEME.colors.error }]}>{openDisputes}</Text>
          <Text style={styles.summaryLabel}>Disputes</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{review.submissions.filter(s => s.status === 'approved').length}</Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {rooms.map(room => {
          const roomSubs = submissionsByRoom[room.id] || [];
          const roomDisputes = disputesByRoom[room.id] || [];
          if (roomSubs.length === 0 && roomDisputes.length === 0) return null;

          return (
            <View key={room.id} style={styles.roomSection}>
              <Text style={styles.roomTitle}>{room.name}</Text>

              {/* Submissions */}
              {roomSubs.map(sub => (
                <View key={sub.id} style={styles.submissionCard}>
                  <View style={styles.subHeader}>
                    <View style={[styles.typeBadge, getTypeBadgeStyle(sub.submission_type)]}>
                      <Text style={styles.typeBadgeText}>{sub.submission_type.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={[styles.statusBadge, getStatusStyle(sub.status)]}>
                      <Text style={styles.statusBadgeText}>{sub.status}</Text>
                    </View>
                  </View>

                  {/* Photo submission */}
                  {sub.submission_type === 'new_photo' && sub.image_url && (
                    <Image source={{ uri: sub.image_url }} style={styles.submissionImage} />
                  )}

                  {/* Description alteration */}
                  {sub.submission_type === 'description_alteration' && sub.original_description && (
                    <View style={styles.diffView}>
                      <Text style={styles.diffOriginal}>Original: {sub.original_description}</Text>
                      <Text style={styles.diffProposed}>Proposed: {sub.description}</Text>
                    </View>
                  )}

                  {/* Other submissions */}
                  {sub.submission_type !== 'description_alteration' && sub.description && (
                    <Text style={styles.subDescription}>{sub.description}</Text>
                  )}

                  {sub.reviewer_notes && (
                    <Text style={styles.reviewerNote}>Your note: {sub.reviewer_notes}</Text>
                  )}

                  {/* Action buttons */}
                  {sub.status === 'pending' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleReject(sub.id)}
                        disabled={processing === sub.id}
                      >
                        {processing === sub.id ? (
                          <ActivityIndicator size="small" color={THEME.colors.error} />
                        ) : (
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => handleApprove(sub.id)}
                        disabled={processing === sub.id}
                      >
                        {processing === sub.id ? (
                          <ActivityIndicator size="small" color={THEME.colors.textInverse} />
                        ) : (
                          <Text style={styles.approveButtonText}>Approve</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              {/* Disputes */}
              {roomDisputes.map(dispute => {
                const item = room.items.find(i => i.id === dispute.item_id);
                return (
                  <View key={dispute.id} style={styles.disputeCard}>
                    <View style={styles.disputeHeader}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={THEME.colors.error} strokeWidth={1.5} />
                      </Svg>
                      <Text style={styles.disputeItemName}>{item?.name || 'Unknown Item'}</Text>
                      <View style={[styles.statusBadge, getDisputeStatusStyle(dispute.status)]}>
                        <Text style={styles.statusBadgeText}>{dispute.status.replace(/_/g, ' ')}</Text>
                      </View>
                    </View>

                    <Text style={styles.disputeReason}>{dispute.dispute_reason}</Text>

                    {dispute.proposed_condition && (
                      <View style={styles.proposedCondition}>
                        <Text style={styles.proposedLabel}>Tenant proposes:</Text>
                        <ConditionBadge condition={dispute.proposed_condition} />
                      </View>
                    )}

                    {dispute.owner_response && (
                      <Text style={styles.ownerResponse}>Your response: {dispute.owner_response}</Text>
                    )}

                    {(dispute.status === 'open') && (
                      <TouchableOpacity
                        style={styles.respondButton}
                        onPress={() => { setActiveDispute(dispute); setDisputeResponse(''); setResolvedCondition(null); }}
                      >
                        <Text style={styles.respondButtonText}>Respond to Dispute</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        {review.submissions.length === 0 && review.disputes.length === 0 && (
          <View style={styles.emptyState}>
            {inspection?.status === 'tenant_review' ? (
              <>
                <Text style={styles.emptyText}>Waiting for tenant to review</Text>
                <Text style={styles.emptySubtext}>The tenant hasn't submitted any changes or disputes yet. They may still be reviewing the inspection report.</Text>
              </>
            ) : inspection?.status === 'completed' ? (
              <>
                <Text style={styles.emptyText}>Not yet sent for review</Text>
                <Text style={styles.emptySubtext}>Send this inspection for tenant review from the inspection detail screen.</Text>
              </>
            ) : (
              <Text style={styles.emptyText}>No submissions or disputes from tenant</Text>
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom: Sign & Finalize */}
      <View style={styles.bottomBar}>
        {allReviewed ? (
          <TouchableOpacity
            style={styles.finalizeButton}
            onPress={() => setShowSignature(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.finalizeButtonText}>Sign & Finalize Report</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.pendingHint}>
            <Text style={styles.pendingHintText}>
              Review all submissions and disputes before finalizing
            </Text>
          </View>
        )}
      </View>

      {/* Dispute Response Sheet */}
      {activeDispute && (
        <View style={styles.disputeSheet}>
          <View style={styles.disputeSheetContent}>
            <Text style={styles.disputeSheetTitle}>Respond to Dispute</Text>
            <TextInput
              style={styles.disputeInput}
              placeholder="Your response..."
              value={disputeResponse}
              onChangeText={setDisputeResponse}
              multiline
              placeholderTextColor={THEME.colors.textTertiary}
              autoFocus
            />
            <Text style={styles.conditionLabel}>Resolved Condition (optional)</Text>
            <View style={styles.conditionRow}>
              {CONDITION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.condChip, resolvedCondition === opt.value && styles.condChipActive]}
                  onPress={() => setResolvedCondition(resolvedCondition === opt.value ? null : opt.value)}
                >
                  <Text style={[styles.condChipText, resolvedCondition === opt.value && styles.condChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.disputeActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveDispute(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, !disputeResponse.trim() && { opacity: 0.5 }]}
                onPress={handleResolveDispute}
                disabled={!disputeResponse.trim() || !!processing}
              >
                <Text style={styles.submitBtnText}>{processing ? 'Submitting...' : 'Submit Response'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <SignaturePad
        visible={showSignature}
        onClose={() => setShowSignature(false)}
        onSign={async (sig) => { await handleSign(sig); }}
        savedSignature={null}
        signing={signing}
      />
    </SafeAreaView>
  );
}

function getTypeBadgeStyle(type: string) {
  switch (type) {
    case 'new_photo': return { backgroundColor: THEME.colors.brand + '20' };
    case 'description_alteration': return { backgroundColor: THEME.colors.warningBg };
    case 'new_item': return { backgroundColor: THEME.colors.infoBg };
    case 'query': return { backgroundColor: THEME.colors.infoBg };
    default: return { backgroundColor: THEME.colors.subtle };
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'approved': return { backgroundColor: THEME.colors.successBg };
    case 'rejected': return { backgroundColor: THEME.colors.errorBg };
    default: return { backgroundColor: THEME.colors.warningBg };
  }
}

function getDisputeStatusStyle(status: string) {
  switch (status) {
    case 'resolved': return { backgroundColor: THEME.colors.successBg };
    case 'owner_responded': return { backgroundColor: THEME.colors.infoBg };
    default: return { backgroundColor: THEME.colors.errorBg };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: THEME.spacing.base, paddingVertical: THEME.spacing.md },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: THEME.fontSize.h2, fontWeight: THEME.fontWeight.semibold as any, color: THEME.colors.textPrimary },
  summaryBar: { flexDirection: 'row', paddingHorizontal: THEME.spacing.base, paddingVertical: THEME.spacing.sm, backgroundColor: THEME.colors.surface, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNumber: { fontSize: 20, fontWeight: '700', color: THEME.colors.brand },
  summaryLabel: { fontSize: THEME.fontSize.caption, color: THEME.colors.textSecondary },
  summaryDivider: { width: 1, backgroundColor: THEME.colors.border },
  content: { flex: 1, paddingHorizontal: THEME.spacing.base, paddingTop: THEME.spacing.md },
  roomSection: { marginBottom: THEME.spacing.lg },
  roomTitle: { fontSize: THEME.fontSize.h3, fontWeight: THEME.fontWeight.semibold as any, color: THEME.colors.textPrimary, marginBottom: THEME.spacing.sm },
  submissionCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: THEME.spacing.base, marginBottom: THEME.spacing.sm, ...THEME.shadow.sm },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: THEME.radius.md },
  typeBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: THEME.radius.md },
  statusBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  submissionImage: { width: '100%', height: 180, borderRadius: THEME.radius.md, marginBottom: 8 },
  diffView: { gap: 6 },
  diffOriginal: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.error, textDecorationLine: 'line-through' },
  diffProposed: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.success, fontWeight: '500' },
  subDescription: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textPrimary },
  reviewerNote: { fontSize: THEME.fontSize.caption, color: THEME.colors.info, marginTop: 6, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rejectButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: THEME.radius.md, borderWidth: 1.5, borderColor: THEME.colors.error },
  rejectButtonText: { fontSize: 14, fontWeight: '600', color: THEME.colors.error },
  approveButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: THEME.radius.md, backgroundColor: THEME.colors.success },
  approveButtonText: { fontSize: 14, fontWeight: '600', color: THEME.colors.textInverse },
  disputeCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: THEME.spacing.base, marginBottom: THEME.spacing.sm, borderLeftWidth: 3, borderLeftColor: THEME.colors.error, ...THEME.shadow.sm },
  disputeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  disputeItemName: { flex: 1, fontSize: THEME.fontSize.body, fontWeight: '600', color: THEME.colors.textPrimary },
  disputeReason: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textPrimary, marginBottom: 8 },
  proposedCondition: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  proposedLabel: { fontSize: THEME.fontSize.caption, color: THEME.colors.textSecondary },
  ownerResponse: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.info, fontStyle: 'italic', marginBottom: 8 },
  respondButton: { paddingVertical: 10, alignItems: 'center', borderRadius: THEME.radius.md, borderWidth: 1.5, borderColor: THEME.colors.brand },
  respondButtonText: { fontSize: 14, fontWeight: '600', color: THEME.colors.brand },
  emptyState: { paddingVertical: THEME.spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, fontWeight: THEME.fontWeight.medium as any },
  emptySubtext: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textTertiary, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: THEME.spacing.lg },
  bottomBar: { paddingHorizontal: THEME.spacing.base, paddingVertical: 12, paddingBottom: 34, backgroundColor: THEME.colors.surface, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  finalizeButton: { backgroundColor: THEME.colors.brand, borderRadius: THEME.radius.md, paddingVertical: 16, alignItems: 'center' },
  finalizeButtonText: { color: THEME.colors.textInverse, fontSize: 16, fontWeight: '700' },
  pendingHint: { paddingVertical: 12 },
  pendingHintText: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textTertiary, textAlign: 'center' },
  disputeSheet: { position: 'absolute', inset: 0, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  disputeSheetContent: { backgroundColor: THEME.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  disputeSheetTitle: { fontSize: THEME.fontSize.h2, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 16 },
  disputeInput: { backgroundColor: THEME.colors.canvas, borderRadius: THEME.radius.md, padding: 12, fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: THEME.colors.border },
  conditionLabel: { fontSize: THEME.fontSize.bodySmall, fontWeight: '600', color: THEME.colors.textSecondary, marginTop: 12, marginBottom: 8 },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  condChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: THEME.radius.full, borderWidth: 1, borderColor: THEME.colors.border },
  condChipActive: { borderColor: THEME.colors.brand, backgroundColor: THEME.colors.brand + '20' },
  condChipText: { fontSize: THEME.fontSize.caption, fontWeight: '500', color: THEME.colors.textPrimary },
  condChipTextActive: { color: THEME.colors.brand },
  disputeActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: THEME.radius.md, borderWidth: 1.5, borderColor: THEME.colors.border },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: THEME.colors.textSecondary },
  submitBtn: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: THEME.radius.md, backgroundColor: THEME.colors.brand },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: THEME.colors.textInverse },
});
