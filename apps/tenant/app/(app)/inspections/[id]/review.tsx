// Tenant Room-by-Room Review — Step through each room, review items, add photos,
// suggest changes, raise disputes, and sign each room before moving to the next.

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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '@casa/config';
import { ConditionBadge } from '@casa/ui';
import {
  useInspection,
  useInspectionReview,
  useInspectionMutations,
} from '@casa/api';
import type { ConditionRating, InspectionItemRow } from '@casa/api';
import SignaturePad from '../../../../components/SignaturePad';

const CONDITION_OPTIONS: { value: ConditionRating; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
];

export default function TenantInspectionReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading, refreshInspection } = useInspection(id || null);
  const review = useInspectionReview(id || null);
  const { signInspection } = useInspectionMutations();

  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showSuggestChange, setShowSuggestChange] = useState<InspectionItemRow | null>(null);
  const [showQuery, setShowQuery] = useState<InspectionItemRow | null>(null);
  const [showDispute, setShowDispute] = useState<InspectionItemRow | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showFinalSignature, setShowFinalSignature] = useState(false);

  // Form states
  const [changeDescription, setChangeDescription] = useState('');
  const [changeCondition, setChangeCondition] = useState<ConditionRating | null>(null);
  const [queryText, setQueryText] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeCondition, setDisputeCondition] = useState<ConditionRating | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [savedSignatureData, setSavedSignatureData] = useState<string | null>(null);

  const rooms = useMemo(() => {
    return (inspection?.rooms || []).sort((a, b) => a.display_order - b.display_order);
  }, [inspection?.rooms]);

  const currentRoom = rooms[currentRoomIndex];
  const roomImages = useMemo(() => {
    if (!inspection || !currentRoom) return [];
    return inspection.images.filter(img => img.room_id === currentRoom.id);
  }, [inspection, currentRoom]);

  const roomSubmissions = useMemo(() => {
    if (!currentRoom) return [];
    return review.getRoomSubmissions(currentRoom.id);
  }, [currentRoom, review]);

  const isCurrentRoomAcknowledged = currentRoom ? review.isRoomAcknowledged(currentRoom.id) : false;
  const acknowledgedCount = rooms.filter(r => review.isRoomAcknowledged(r.id)).length;
  const allRoomsAcknowledged = acknowledgedCount === rooms.length && rooms.length > 0;

  // Photo capture
  const handleAddPhoto = useCallback(async () => {
    if (!currentRoom || !id) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed.');
      return;
    }

    Alert.alert('Add Photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) {
            setSubmitting(true);
            try {
              await review.submitTenantPhoto(currentRoom.id, result.assets[0].uri);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload photo');
            } finally {
              setSubmitting(false);
            }
          }
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) {
            setSubmitting(true);
            try {
              await review.submitTenantPhoto(currentRoom.id, result.assets[0].uri);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload photo');
            } finally {
              setSubmitting(false);
            }
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [currentRoom, id, review]);

  // Suggest a change to an item description
  const handleSubmitSuggestChange = useCallback(async () => {
    if (!showSuggestChange || !currentRoom || !changeDescription.trim()) return;

    setSubmitting(true);
    try {
      const desc = changeCondition
        ? `${changeDescription}\n\nProposed condition: ${changeCondition}`
        : changeDescription;

      await review.submitTenantAddition(
        currentRoom.id,
        'description_alteration',
        desc,
        showSuggestChange.notes || showSuggestChange.name,
        showSuggestChange.id,
      );
      setShowSuggestChange(null);
      setChangeDescription('');
      setChangeCondition(null);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit change');
    } finally {
      setSubmitting(false);
    }
  }, [showSuggestChange, currentRoom, changeDescription, changeCondition, review]);

  // Submit a query
  const handleSubmitQuery = useCallback(async () => {
    if (!showQuery || !currentRoom || !queryText.trim()) return;

    setSubmitting(true);
    try {
      await review.submitTenantAddition(
        currentRoom.id,
        'query',
        queryText,
        null,
        showQuery.id,
      );
      setShowQuery(null);
      setQueryText('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit query');
    } finally {
      setSubmitting(false);
    }
  }, [showQuery, currentRoom, queryText, review]);

  // Raise a dispute
  const handleSubmitDispute = useCallback(async () => {
    if (!showDispute || !disputeReason.trim()) return;

    setSubmitting(true);
    try {
      await review.raiseItemDispute(
        showDispute.id,
        disputeReason,
        disputeCondition,
      );
      setShowDispute(null);
      setDisputeReason('');
      setDisputeCondition(null);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to raise dispute');
    } finally {
      setSubmitting(false);
    }
  }, [showDispute, disputeReason, disputeCondition, review]);

  // Add a new item
  const handleSubmitNewItem = useCallback(async () => {
    if (!currentRoom || !newItemName.trim()) return;

    setSubmitting(true);
    try {
      await review.submitTenantAddition(
        currentRoom.id,
        'new_item',
        `${newItemName}: ${newItemDescription}`,
      );
      setShowAddItem(false);
      setNewItemName('');
      setNewItemDescription('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  }, [currentRoom, newItemName, newItemDescription, review]);

  // Sign current room and move to next
  const handleSignRoom = useCallback(async (signatureImage: string) => {
    if (!currentRoom || !id) return;

    setSubmitting(true);
    try {
      // Save signature for reuse across rooms
      setSavedSignatureData(signatureImage);

      // Upload signature to storage
      const supabaseModule = await import('@casa/api');
      const supabase = supabaseModule.getSupabaseClient();
      const storagePath = `signatures/tenant/${id}/${currentRoom.id}_${Date.now()}.png`;
      const response = await fetch(signatureImage);
      const blob = await response.blob();
      await supabase.storage.from('inspection-images').upload(storagePath, blob, { contentType: 'image/png' });
      const { data: urlData } = supabase.storage.from('inspection-images').getPublicUrl(storagePath);

      await review.acknowledgeRoom(currentRoom.id, urlData.publicUrl);
      setShowSignature(false);

      // Auto-advance to next room
      if (currentRoomIndex < rooms.length - 1) {
        setCurrentRoomIndex(prev => prev + 1);
      }
      refreshInspection();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to sign room');
    } finally {
      setSubmitting(false);
    }
  }, [currentRoom, id, currentRoomIndex, rooms.length, review, refreshInspection]);

  // Final signature to complete the review
  const handleFinalSign = useCallback(async (signatureImage: string) => {
    if (!id) return;

    setSubmitting(true);
    try {
      const supabaseModule = await import('@casa/api');
      const supabase = supabaseModule.getSupabaseClient();
      const storagePath = `signatures/tenant/${id}/final_${Date.now()}.png`;
      const response = await fetch(signatureImage);
      const blob = await response.blob();
      await supabase.storage.from('inspection-images').upload(storagePath, blob, { contentType: 'image/png' });
      const { data: urlData } = supabase.storage.from('inspection-images').getPublicUrl(storagePath);

      await signInspection(id, 'tenant', urlData.publicUrl);
      setShowFinalSignature(false);
      Alert.alert(
        'Review Complete',
        'Your review has been submitted. The owner will be notified of any changes or disputes.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to complete review');
    } finally {
      setSubmitting(false);
    }
  }, [id, signInspection]);

  if (loading || !inspection) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (rooms.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No rooms to review</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Summary screen after all rooms reviewed
  if (allRoomsAcknowledged) {
    const pendingSubs = review.submissions.filter(s => s.status === 'pending').length;
    const openDisputes = review.disputes.filter(d => d.status === 'open').length;

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Complete</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.summaryContent} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.summaryTitle}>All Rooms Reviewed</Text>
            <Text style={styles.summarySubtitle}>
              {rooms.length} room{rooms.length !== 1 ? 's' : ''} reviewed and signed
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{pendingSubs}</Text>
              <Text style={styles.statLabel}>Changes Submitted</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, openDisputes > 0 && { color: THEME.colors.error }]}>{openDisputes}</Text>
              <Text style={styles.statLabel}>Disputes</Text>
            </View>
          </View>

          {/* Final sign-off */}
          <TouchableOpacity
            style={styles.finalSignButton}
            onPress={() => setShowFinalSignature(true)}
            activeOpacity={0.8}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={THEME.colors.textInverse} strokeWidth={1.5} />
              <Path d="M8 12l3 3 5-5" stroke={THEME.colors.textInverse} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.finalSignButtonText}>Sign & Complete Review</Text>
          </TouchableOpacity>
        </ScrollView>

        <SignaturePad
          visible={showFinalSignature}
          onClose={() => setShowFinalSignature(false)}
          onSign={async (sig) => { await handleFinalSign(sig); }}
          savedSignature={null}
          signing={submitting}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with progress */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (currentRoomIndex > 0) {
            setCurrentRoomIndex(prev => prev - 1);
          } else {
            router.back();
          }
        }} style={styles.headerButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{currentRoom.name}</Text>
          <Text style={styles.headerSubtitle}>{currentRoomIndex + 1} of {rooms.length}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        {rooms.map((r, i) => (
          <View
            key={r.id}
            style={[
              styles.progressSegment,
              review.isRoomAcknowledged(r.id) && styles.progressSegmentDone,
              i === currentRoomIndex && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Room Layout Sketch (if available) */}
        {currentRoom.layout_sketch_url && (
          <View style={styles.layoutPreview}>
            <Image source={{ uri: currentRoom.layout_sketch_url }} style={styles.layoutImage} resizeMode="contain" />
            <Text style={styles.layoutLabel}>Room Layout</Text>
          </View>
        )}

        {/* Room Photos */}
        {roomImages.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Photos ({roomImages.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {roomImages.map(img => (
                <View key={img.id} style={styles.photoCard}>
                  <Image source={{ uri: img.url }} style={styles.photoImage} />
                  {img.caption && <Text style={styles.photoCaption} numberOfLines={2}>{img.caption}</Text>}
                  {img.compass_bearing !== null && (
                    <View style={styles.bearingTag}>
                      <Text style={styles.bearingTagText}>{img.compass_bearing}°</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Tenant-submitted photos for this room */}
        {roomSubmissions.filter(s => s.submission_type === 'new_photo').length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Your Added Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {roomSubmissions.filter(s => s.submission_type === 'new_photo' && s.image_url).map(s => (
                <View key={s.id} style={styles.photoCard}>
                  <Image source={{ uri: s.image_url! }} style={styles.photoImage} />
                  <View style={[styles.statusBadge, s.status === 'approved' ? styles.statusApproved : s.status === 'rejected' ? styles.statusRejected : styles.statusPending]}>
                    <Text style={styles.statusBadgeText}>{s.status}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Items checklist */}
        <Text style={styles.sectionTitle}>Items</Text>
        {currentRoom.items.map(item => {
          const itemDisputes = review.getItemDisputes(item.id);
          const hasDispute = itemDisputes.length > 0;

          return (
            <View key={item.id} style={[styles.itemCard, hasDispute && styles.itemCardDisputed]}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.condition && <ConditionBadge condition={item.condition} />}
              </View>

              {item.notes && (
                <Text style={styles.itemNotes}>{item.notes}</Text>
              )}

              {hasDispute && (
                <View style={styles.disputeTag}>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 9v4M12 17h.01" stroke={THEME.colors.error} strokeWidth={2} strokeLinecap="round" />
                    <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={THEME.colors.error} strokeWidth={1.5} />
                  </Svg>
                  <Text style={styles.disputeTagText}>
                    Dispute: {itemDisputes[0].dispute_reason.substring(0, 50)}
                    {itemDisputes[0].dispute_reason.length > 50 ? '...' : ''}
                  </Text>
                </View>
              )}

              {/* Action buttons */}
              {!isCurrentRoomAcknowledged && (
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={[styles.actionChip, submitting && styles.actionChipDisabled]}
                    onPress={() => { setShowSuggestChange(item); setChangeDescription(''); setChangeCondition(null); }}
                    disabled={submitting}
                  >
                    <Text style={styles.actionChipText}>Suggest Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionChip, submitting && styles.actionChipDisabled]}
                    onPress={() => { setShowQuery(item); setQueryText(''); }}
                    disabled={submitting}
                  >
                    <Text style={styles.actionChipText}>Query</Text>
                  </TouchableOpacity>
                  {!hasDispute && (
                    <TouchableOpacity
                      style={[styles.actionChip, styles.actionChipDanger, submitting && styles.actionChipDisabled]}
                      onPress={() => { setShowDispute(item); setDisputeReason(''); setDisputeCondition(null); }}
                      disabled={submitting}
                    >
                      <Text style={[styles.actionChipText, styles.actionChipDangerText]}>Dispute</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Room submissions (non-photo) */}
        {roomSubmissions.filter(s => s.submission_type !== 'new_photo').length > 0 && (
          <View style={styles.submissionsSection}>
            <Text style={styles.sectionTitle}>Your Submissions</Text>
            {roomSubmissions.filter(s => s.submission_type !== 'new_photo').map(s => (
              <View key={s.id} style={styles.submissionCard}>
                <View style={styles.submissionHeader}>
                  <View style={[styles.typeBadge, s.submission_type === 'query' ? styles.typeBadgeQuery : s.submission_type === 'new_item' ? styles.typeBadgeNewItem : styles.typeBadgeChange]}>
                    <Text style={styles.typeBadgeText}>{s.submission_type.replace(/_/g, ' ')}</Text>
                  </View>
                  <View style={[styles.statusBadge, s.status === 'approved' ? styles.statusApproved : s.status === 'rejected' ? styles.statusRejected : styles.statusPending]}>
                    <Text style={styles.statusBadgeText}>{s.status}</Text>
                  </View>
                </View>
                <Text style={styles.submissionText}>{s.description}</Text>
                {s.reviewer_notes && (
                  <Text style={styles.reviewerNotes}>Owner: {s.reviewer_notes}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Add photo / Add item buttons */}
        {!isCurrentRoomAcknowledged && (
          <View style={styles.addSection}>
            <TouchableOpacity style={[styles.addButton, submitting && { opacity: 0.4 }]} onPress={handleAddPhoto} disabled={submitting}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={THEME.colors.brand} strokeWidth={1.5} />
                <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.brand} strokeWidth={1.5} />
              </Svg>
              <Text style={styles.addButtonText}>Add Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addButton, submitting && { opacity: 0.4 }]} onPress={() => { setShowAddItem(true); setNewItemName(''); setNewItemDescription(''); }} disabled={submitting}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={styles.addButtonText}>Add Item Not Listed</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Room notes */}
        {currentRoom.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Inspector Notes</Text>
            <Text style={styles.notesText}>{currentRoom.notes}</Text>
          </View>
        )}

        {/* Spacer for bottom actions */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {isCurrentRoomAcknowledged ? (
          <View style={styles.acknowledgedBar}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.acknowledgedText}>Room signed</Text>
            {currentRoomIndex < rooms.length - 1 && (
              <TouchableOpacity
                style={styles.nextRoomButton}
                onPress={() => setCurrentRoomIndex(prev => prev + 1)}
              >
                <Text style={styles.nextRoomText}>Next Room</Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.signButton}
            onPress={() => setShowSignature(true)}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Text style={styles.signButtonText}>Sign & Next Room</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Signature Modal */}
      <SignaturePad
        visible={showSignature}
        onClose={() => setShowSignature(false)}
        onSign={async (sig) => { await handleSignRoom(sig); }}
        savedSignature={null}
        signing={submitting}
      />

      {/* Suggest Change Modal */}
      <Modal visible={!!showSuggestChange} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Suggest Change</Text>
            {showSuggestChange && (
              <Text style={styles.modalSubtitle}>For: {showSuggestChange.name}</Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Describe the change you'd like..."
              value={changeDescription}
              onChangeText={setChangeDescription}
              multiline
              maxLength={1000}
              placeholderTextColor={THEME.colors.textTertiary}
              autoFocus
            />
            <Text style={styles.modalLabel}>Proposed Condition (optional)</Text>
            <View style={styles.conditionRow}>
              {CONDITION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.conditionChip, changeCondition === opt.value && styles.conditionChipActive]}
                  onPress={() => setChangeCondition(changeCondition === opt.value ? null : opt.value)}
                >
                  <Text style={[styles.conditionChipText, changeCondition === opt.value && styles.conditionChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSuggestChange(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, !changeDescription.trim() && styles.modalSubmitDisabled]}
                onPress={handleSubmitSuggestChange}
                disabled={submitting || !changeDescription.trim()}
              >
                <Text style={styles.modalSubmitText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Query Modal */}
      <Modal visible={!!showQuery} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Ask a Question</Text>
            {showQuery && (
              <Text style={styles.modalSubtitle}>About: {showQuery.name}</Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="What would you like to know about this item?"
              value={queryText}
              onChangeText={setQueryText}
              multiline
              maxLength={500}
              placeholderTextColor={THEME.colors.textTertiary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowQuery(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, !queryText.trim() && styles.modalSubmitDisabled]}
                onPress={handleSubmitQuery}
                disabled={submitting || !queryText.trim()}
              >
                <Text style={styles.modalSubmitText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={!!showDispute} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Raise Dispute</Text>
            {showDispute && (
              <Text style={styles.modalSubtitle}>Item: {showDispute.name} ({showDispute.condition || 'unrated'})</Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Explain why you disagree with this assessment..."
              value={disputeReason}
              onChangeText={setDisputeReason}
              multiline
              maxLength={1000}
              placeholderTextColor={THEME.colors.textTertiary}
              autoFocus
            />
            <Text style={styles.modalLabel}>What should the condition be?</Text>
            <View style={styles.conditionRow}>
              {CONDITION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.conditionChip, disputeCondition === opt.value && styles.conditionChipActive]}
                  onPress={() => setDisputeCondition(disputeCondition === opt.value ? null : opt.value)}
                >
                  <Text style={[styles.conditionChipText, disputeCondition === opt.value && styles.conditionChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDispute(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, styles.modalSubmitDanger, !disputeReason.trim() && styles.modalSubmitDisabled]}
                onPress={handleSubmitDispute}
                disabled={submitting || !disputeReason.trim()}
              >
                <Text style={styles.modalSubmitText}>{submitting ? 'Submitting...' : 'Raise Dispute'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={showAddItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add Missing Item</Text>
            <TextInput
              style={styles.modalInputShort}
              placeholder="Item name (e.g., Light fixture)"
              value={newItemName}
              onChangeText={setNewItemName}
              maxLength={100}
              placeholderTextColor={THEME.colors.textTertiary}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Description of current condition..."
              value={newItemDescription}
              onChangeText={setNewItemDescription}
              multiline
              maxLength={500}
              placeholderTextColor={THEME.colors.textTertiary}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddItem(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, !newItemName.trim() && styles.modalSubmitDisabled]}
                onPress={handleSubmitNewItem}
                disabled={submitting || !newItemName.trim()}
              >
                <Text style={styles.modalSubmitText}>{submitting ? 'Adding...' : 'Add Item'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: THEME.spacing.base, paddingVertical: THEME.spacing.md },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: THEME.fontSize.h2, fontWeight: THEME.fontWeight.semibold as any, color: THEME.colors.textPrimary },
  headerSubtitle: { fontSize: THEME.fontSize.caption, color: THEME.colors.textSecondary },
  progressBar: { flexDirection: 'row', paddingHorizontal: THEME.spacing.base, gap: 3, marginBottom: THEME.spacing.sm },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: THEME.colors.border },
  progressSegmentDone: { backgroundColor: THEME.colors.success },
  progressSegmentActive: { backgroundColor: THEME.colors.brand },
  content: { flex: 1, paddingHorizontal: THEME.spacing.base },
  layoutPreview: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, overflow: 'hidden', marginBottom: THEME.spacing.md, borderWidth: 1, borderColor: THEME.colors.border },
  layoutImage: { width: '100%', height: 120, backgroundColor: THEME.colors.canvas },
  layoutLabel: { fontSize: THEME.fontSize.caption, color: THEME.colors.textTertiary, textAlign: 'center', paddingVertical: 4 },
  photoSection: { marginBottom: THEME.spacing.md },
  sectionTitle: { fontSize: THEME.fontSize.h3, fontWeight: THEME.fontWeight.semibold as any, color: THEME.colors.textPrimary, marginBottom: THEME.spacing.sm },
  photoCard: { width: 120, height: 120, marginRight: 8, borderRadius: THEME.radius.md, overflow: 'hidden', backgroundColor: THEME.colors.subtle, position: 'relative' },
  photoImage: { width: '100%', height: '100%' },
  photoCaption: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', color: THEME.colors.textInverse, fontSize: 10, padding: 4 },
  bearingTag: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: THEME.radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  bearingTagText: { color: THEME.colors.textInverse, fontSize: 9, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: THEME.radius.md },
  statusPending: { backgroundColor: THEME.colors.warningBg },
  statusApproved: { backgroundColor: THEME.colors.successBg },
  statusRejected: { backgroundColor: THEME.colors.errorBg },
  statusBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  itemCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: THEME.spacing.base, marginBottom: THEME.spacing.sm, ...THEME.shadow.sm },
  itemCardDisputed: { borderLeftWidth: 3, borderLeftColor: THEME.colors.error },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: THEME.fontSize.body, fontWeight: THEME.fontWeight.medium as any, color: THEME.colors.textPrimary, flex: 1 },
  itemNotes: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  disputeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: THEME.colors.errorBg, padding: 8, borderRadius: THEME.radius.sm },
  disputeTagText: { fontSize: THEME.fontSize.caption, color: THEME.colors.error, flex: 1 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: THEME.radius.full, borderWidth: 1, borderColor: THEME.colors.brand, backgroundColor: THEME.colors.surface },
  actionChipText: { fontSize: THEME.fontSize.caption, fontWeight: THEME.fontWeight.medium as any, color: THEME.colors.brand },
  actionChipDisabled: { opacity: 0.4 },
  actionChipDanger: { borderColor: THEME.colors.error },
  actionChipDangerText: { color: THEME.colors.error },
  submissionsSection: { marginTop: THEME.spacing.md },
  submissionCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: THEME.spacing.base, marginBottom: THEME.spacing.sm, borderWidth: 1, borderColor: THEME.colors.border },
  submissionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: THEME.radius.md },
  typeBadgeQuery: { backgroundColor: THEME.colors.infoBg },
  typeBadgeNewItem: { backgroundColor: THEME.colors.brand + '20' },
  typeBadgeChange: { backgroundColor: THEME.colors.warningBg },
  typeBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  submissionText: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textPrimary },
  reviewerNotes: { fontSize: THEME.fontSize.caption, color: THEME.colors.info, marginTop: 6, fontStyle: 'italic' },
  addSection: { flexDirection: 'row', gap: 8, marginTop: THEME.spacing.md },
  addButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: THEME.radius.md, borderWidth: 1.5, borderColor: THEME.colors.brand, borderStyle: 'dashed' },
  addButtonText: { fontSize: THEME.fontSize.bodySmall, fontWeight: THEME.fontWeight.medium as any, color: THEME.colors.brand },
  notesSection: { marginTop: THEME.spacing.md },
  notesText: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, lineHeight: 20 },
  bottomBar: { paddingHorizontal: THEME.spacing.base, paddingVertical: 12, paddingBottom: 34, backgroundColor: THEME.colors.surface, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  signButton: { backgroundColor: THEME.colors.brand, borderRadius: THEME.radius.md, paddingVertical: 16, alignItems: 'center' },
  signButtonText: { color: THEME.colors.textInverse, fontSize: 16, fontWeight: '700' },
  acknowledgedBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  acknowledgedText: { fontSize: THEME.fontSize.body, fontWeight: THEME.fontWeight.medium as any, color: THEME.colors.success, flex: 1 },
  nextRoomButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: THEME.radius.md, backgroundColor: THEME.colors.brand },
  nextRoomText: { color: THEME.colors.textInverse, fontSize: 14, fontWeight: '600' },
  // Summary
  summaryContent: { flex: 1, paddingHorizontal: THEME.spacing.base },
  summaryCard: { alignItems: 'center', paddingVertical: THEME.spacing.xl, gap: THEME.spacing.sm },
  summaryIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: THEME.colors.successBg, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: THEME.fontSize.h2, fontWeight: THEME.fontWeight.semibold as any, color: THEME.colors.textPrimary },
  summarySubtitle: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: THEME.spacing.xl },
  statCard: { flex: 1, backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: THEME.spacing.base, alignItems: 'center', ...THEME.shadow.sm },
  statNumber: { fontSize: 28, fontWeight: '700', color: THEME.colors.brand },
  statLabel: { fontSize: THEME.fontSize.caption, color: THEME.colors.textSecondary, marginTop: 4 },
  finalSignButton: { backgroundColor: THEME.colors.brand, borderRadius: THEME.radius.md, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  finalSignButtonText: { color: THEME.colors.textInverse, fontSize: 16, fontWeight: '700' },
  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: THEME.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalTitle: { fontSize: THEME.fontSize.h2, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textSecondary, marginBottom: 16 },
  modalLabel: { fontSize: THEME.fontSize.bodySmall, fontWeight: '600', color: THEME.colors.textSecondary, marginTop: 12, marginBottom: 8 },
  modalInput: { backgroundColor: THEME.colors.canvas, borderRadius: THEME.radius.md, padding: 12, fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: THEME.colors.border },
  modalInputShort: { backgroundColor: THEME.colors.canvas, borderRadius: THEME.radius.md, padding: 12, fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary, borderWidth: 1, borderColor: THEME.colors.border, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: THEME.radius.md, borderWidth: 1.5, borderColor: THEME.colors.border },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: THEME.colors.textSecondary },
  modalSubmit: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: THEME.radius.md, backgroundColor: THEME.colors.brand },
  modalSubmitDanger: { backgroundColor: THEME.colors.error },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: THEME.colors.textInverse },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  conditionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: THEME.radius.full, borderWidth: 1, borderColor: THEME.colors.border },
  conditionChipActive: { borderColor: THEME.colors.brand, backgroundColor: THEME.colors.brand + '20' },
  conditionChipText: { fontSize: THEME.fontSize.caption, fontWeight: '500', color: THEME.colors.textPrimary },
  conditionChipTextActive: { color: THEME.colors.brand },
});
