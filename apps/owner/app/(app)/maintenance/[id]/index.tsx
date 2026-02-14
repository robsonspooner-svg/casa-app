// Maintenance Request Detail & Management - Owner View
// Mission 09: Maintenance Requests
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button } from '@casa/ui';
import { useMaintenanceRequest, useMaintenanceMutations, useAuth } from '@casa/api';
import type { MaintenanceStatus, MaintenanceComment } from '@casa/api';

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Submitted', color: THEME.colors.info, bg: THEME.colors.infoBg },
  acknowledged: { label: 'Acknowledged', color: THEME.colors.brand, bg: THEME.colors.brand + '20' },
  awaiting_quote: { label: 'Awaiting Quote', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  approved: { label: 'Approved', color: THEME.colors.success, bg: THEME.colors.successBg },
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: THEME.colors.subtle },
  on_hold: { label: 'On Hold', color: THEME.colors.warning, bg: THEME.colors.warningBg },
};

const URGENCY_LABELS: Record<string, string> = {
  emergency: 'Emergency',
  urgent: 'Urgent',
  routine: 'Routine',
};

// Status transitions: what statuses can be moved to from current
const STATUS_TRANSITIONS: Partial<Record<MaintenanceStatus, { value: MaintenanceStatus; label: string }[]>> = {
  submitted: [
    { value: 'acknowledged', label: 'Acknowledge' },
    { value: 'cancelled', label: 'Cancel' },
  ],
  acknowledged: [
    { value: 'awaiting_quote', label: 'Request Quote' },
    { value: 'in_progress', label: 'Start Work' },
    { value: 'on_hold', label: 'Put on Hold' },
  ],
  awaiting_quote: [
    { value: 'approved', label: 'Approve Quote' },
    { value: 'on_hold', label: 'Put on Hold' },
  ],
  approved: [
    { value: 'scheduled', label: 'Schedule' },
    { value: 'in_progress', label: 'Start Work' },
  ],
  scheduled: [
    { value: 'in_progress', label: 'Start Work' },
    { value: 'on_hold', label: 'Put on Hold' },
  ],
  in_progress: [
    { value: 'completed', label: 'Mark Complete' },
    { value: 'on_hold', label: 'Put on Hold' },
  ],
  on_hold: [
    { value: 'acknowledged', label: 'Resume' },
    { value: 'cancelled', label: 'Cancel' },
  ],
};

export default function OwnerMaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { request, loading, refreshing, error, refreshRequest } = useMaintenanceRequest(id || null);
  const { updateStatus, addComment, recordCost } = useMaintenanceMutations();

  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Cost recording
  const [showCostForm, setShowCostForm] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [savingCost, setSavingCost] = useState(false);

  const handleStatusUpdate = async (newStatus: MaintenanceStatus) => {
    if (!id) return;

    const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;

    if (newStatus === 'cancelled') {
      Alert.alert(
        'Cancel Request',
        'Are you sure you want to cancel this maintenance request?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              setUpdatingStatus(true);
              try {
                await updateStatus(id, newStatus);
                await refreshRequest();
              } catch (err) {
                Alert.alert('Error', 'Failed to update status');
              } finally {
                setUpdatingStatus(false);
              }
            },
          },
        ]
      );
      return;
    }

    setUpdatingStatus(true);
    try {
      await updateStatus(id, newStatus);
      await refreshRequest();
    } catch (err) {
      Alert.alert('Error', `Failed to ${statusLabel.toLowerCase()}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !user || !id) return;

    setSendingComment(true);
    try {
      await addComment({
        request_id: id,
        author_id: user.id,
        content: newComment.trim(),
        is_internal: isInternal,
      });
      setNewComment('');
      await refreshRequest();
    } catch (err) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSendingComment(false);
    }
  };

  const handleSaveCost = async () => {
    if (!id) return;

    setSavingCost(true);
    try {
      await recordCost(
        id,
        estimatedCost ? parseFloat(estimatedCost) : undefined,
        actualCost ? parseFloat(actualCost) : undefined,
        'owner'
      );
      setShowCostForm(false);
      await refreshRequest();
    } catch (err) {
      Alert.alert('Error', 'Failed to save cost');
    } finally {
      setSavingCost(false);
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

  if (error || !request) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Request not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[request.status] || { label: request.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: THEME.colors.textSecondary, bg: THEME.colors.subtle };
  const transitions = STATUS_TRANSITIONS[request.status] || [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshRequest} tintColor={THEME.colors.brand} />
        }
      >
        {/* Emergency Alert */}
        {request.urgency === 'emergency' && request.status !== 'completed' && request.status !== 'cancelled' && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerText}>
              Emergency Request — Immediate attention required
            </Text>
          </View>
        )}

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>{request.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.heroMeta}>
            <Text style={styles.metaText}>
              {request.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={[styles.metaText, request.urgency === 'emergency' && { color: THEME.colors.error }]}>
              {URGENCY_LABELS[request.urgency]}
            </Text>
          </View>

          <Text style={styles.dateText}>
            Submitted {new Date(request.created_at).toLocaleDateString('en-AU', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>

        {/* Tenant & Property Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tenant & Property</Text>
          {request.tenant && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tenant</Text>
              <Text style={styles.detailValue}>{request.tenant.full_name || request.tenant.email}</Text>
            </View>
          )}
          {request.property && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Property</Text>
              <Text style={styles.detailValue}>{request.property.address_line_1}</Text>
            </View>
          )}
          {request.location_in_property && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{request.location_in_property}</Text>
            </View>
          )}
          {request.preferred_times && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Preferred Times</Text>
              <Text style={styles.detailValue}>{request.preferred_times}</Text>
            </View>
          )}
          {request.access_instructions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Access</Text>
              <Text style={styles.detailValue}>{request.access_instructions}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{request.description}</Text>
        </View>

        {/* Tenant Photos */}
        {request.images && request.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos ({request.images.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageScroll}
            >
              {request.images.map((img) => (
                <View key={img.id} style={styles.imageCard}>
                  <Image
                    source={{ uri: img.url }}
                    style={styles.maintenanceImage}
                    resizeMode="cover"
                  />
                  {img.caption && (
                    <Text style={styles.imageCaption} numberOfLines={2}>
                      {img.caption}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Status Actions */}
        {transitions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsGrid}>
              {transitions.map(t => (
                <Button
                  key={t.value}
                  title={updatingStatus ? '...' : t.label}
                  onPress={() => handleStatusUpdate(t.value)}
                  variant={t.value === 'cancelled' ? 'text' : (t === transitions[0] ? 'primary' : 'secondary')}
                  disabled={updatingStatus}
                />
              ))}
            </View>
          </View>
        )}

        {/* Create Work Order */}
        {request.status !== 'completed' && request.status !== 'cancelled' && (
          <View style={styles.section}>
            <Button
              title="Create Work Order"
              onPress={() => router.push({
                pathname: '/(app)/work-orders/create',
                params: {
                  maintenanceRequestId: request.id,
                  propertyId: request.property_id,
                  title: request.title,
                  description: request.description,
                  category: request.category,
                },
              } as any)}
              variant="secondary"
            />
          </View>
        )}

        {/* Cost Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Costs</Text>
            {!showCostForm && (
              <TouchableOpacity onPress={() => setShowCostForm(true)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {request.estimated_cost != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated</Text>
              <Text style={styles.detailValue}>${request.estimated_cost.toFixed(2)}</Text>
            </View>
          )}
          {request.actual_cost != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Actual</Text>
              <Text style={styles.detailValue}>${request.actual_cost.toFixed(2)}</Text>
            </View>
          )}
          {request.cost_responsibility && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Responsibility</Text>
              <Text style={styles.detailValue}>
                {request.cost_responsibility.charAt(0).toUpperCase() + request.cost_responsibility.slice(1)}
              </Text>
            </View>
          )}

          {showCostForm && (
            <View style={styles.costForm}>
              <Text style={styles.fieldLabel}>Estimated Cost ($)</Text>
              <TextInput
                style={styles.costInput}
                value={estimatedCost}
                onChangeText={setEstimatedCost}
                placeholder={request.estimated_cost?.toFixed(2) || '0.00'}
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.fieldLabel}>Actual Cost ($)</Text>
              <TextInput
                style={styles.costInput}
                value={actualCost}
                onChangeText={setActualCost}
                placeholder={request.actual_cost?.toFixed(2) || '0.00'}
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <View style={styles.costActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowCostForm(false)}
                  variant="text"
                />
                <Button
                  title={savingCost ? 'Saving...' : 'Save'}
                  onPress={handleSaveCost}
                  disabled={savingCost}
                />
              </View>
            </View>
          )}
        </View>

        {/* Status Timeline */}
        {request.status_history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {request.status_history.map((entry, idx) => (
              <View key={entry.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                {idx < request.status_history.length - 1 && <View style={styles.timelineLine} />}
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>
                    {entry.old_status
                      ? `${STATUS_CONFIG[entry.old_status]?.label || entry.old_status} → ${STATUS_CONFIG[entry.new_status]?.label || entry.new_status}`
                      : STATUS_CONFIG[entry.new_status]?.label || entry.new_status}
                  </Text>
                  {entry.notes && <Text style={styles.timelineNotes}>{entry.notes}</Text>}
                  <Text style={styles.timelineDate}>
                    {new Date(entry.created_at).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Satisfaction */}
        {request.satisfaction_rating != null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tenant Satisfaction</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <Svg key={star} width={24} height={24} viewBox="0 0 24 24" fill={request.satisfaction_rating! >= star ? THEME.colors.warning : 'none'}>
                  <Path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    stroke={THEME.colors.warning}
                    strokeWidth={1.5}
                  />
                </Svg>
              ))}
            </View>
          </View>
        )}

        {/* Comments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Communication ({request.comments.length})
          </Text>
          {request.comments.length === 0 ? (
            <Text style={styles.noComments}>No messages yet</Text>
          ) : (
            request.comments.map((comment: MaintenanceComment) => (
              <View key={comment.id} style={styles.commentItem}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>
                    {comment.author_id === user?.id ? 'You' : (request.tenant?.full_name || 'Tenant')}
                  </Text>
                  {comment.is_internal && (
                    <View style={styles.internalBadge}>
                      <Text style={styles.internalBadgeText}>Internal</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.commentText}>{comment.content}</Text>
                <Text style={styles.commentDate}>
                  {new Date(comment.created_at).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment Input */}
      {request.status !== 'completed' && request.status !== 'cancelled' && (
        <View style={styles.commentInputArea}>
          <View style={styles.commentToggle}>
            <TouchableOpacity
              style={[styles.toggleOption, !isInternal && styles.toggleOptionActive]}
              onPress={() => setIsInternal(false)}
            >
              <Text style={[styles.toggleText, !isInternal && styles.toggleTextActive]}>To Tenant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, isInternal && styles.toggleOptionActive]}
              onPress={() => setIsInternal(true)}
            >
              <Text style={[styles.toggleText, isInternal && styles.toggleTextActive]}>Internal Note</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentTextInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder={isInternal ? 'Add internal note...' : 'Message tenant...'}
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
              onPress={handleSendComment}
              disabled={!newComment.trim() || sendingComment}
            >
              {sendingComment ? (
                <ActivityIndicator size="small" color={THEME.colors.textInverse} />
              ) : (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  flex: {
    flex: 1,
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
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  content: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 3,
  },
  emergencyBanner: {
    backgroundColor: THEME.colors.error,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  emergencyBannerText: {
    color: THEME.colors.textInverse,
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    textAlign: 'center',
  },
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.base,
    ...THEME.shadow.sm,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.sm,
  },
  heroTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.full,
  },
  statusText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.xs,
  },
  metaText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  metaDot: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  dateText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  section: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  editLink: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  descriptionText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: THEME.spacing.md,
  },
  actionsGrid: {
    gap: THEME.spacing.sm,
  },
  costForm: {
    marginTop: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  fieldLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  costInput: {
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  costActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.md,
    position: 'relative',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.brand,
    marginTop: 4,
    marginRight: THEME.spacing.md,
  },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 14,
    bottom: -THEME.spacing.md,
    width: 2,
    backgroundColor: THEME.colors.border,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  timelineNotes: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  timelineDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  noComments: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
  },
  commentItem: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.xs,
  },
  commentAuthor: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  internalBadge: {
    backgroundColor: THEME.colors.warningBg,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  internalBadgeText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.warning,
    fontWeight: THEME.fontWeight.medium,
  },
  commentText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  commentDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.xs,
  },
  commentInputArea: {
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
  },
  commentToggle: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.sm,
    gap: THEME.spacing.sm,
  },
  toggleOption: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.canvas,
  },
  toggleOptionActive: {
    backgroundColor: THEME.colors.brand,
  },
  toggleText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    fontWeight: THEME.fontWeight.medium,
  },
  toggleTextActive: {
    color: THEME.colors.textInverse,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: THEME.spacing.sm,
  },
  commentTextInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  imageScroll: {
    gap: THEME.spacing.sm,
  },
  imageCard: {
    width: Dimensions.get('window').width * 0.6,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    backgroundColor: THEME.colors.canvas,
  },
  maintenanceImage: {
    width: '100%',
    height: 180,
    borderRadius: THEME.radius.md,
  },
  imageCaption: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    paddingHorizontal: THEME.spacing.xs,
    paddingVertical: THEME.spacing.xs,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
});
