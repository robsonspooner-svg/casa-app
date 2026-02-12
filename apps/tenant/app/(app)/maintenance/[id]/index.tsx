// Maintenance Request Detail - Tenant View
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

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { request, loading, refreshing, error, refreshRequest } = useMaintenanceRequest(id || null);
  const { addComment, rateSatisfaction } = useMaintenanceMutations();

  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [rating, setRating] = useState(0);

  const handleSendComment = async () => {
    if (!newComment.trim() || !user || !id) return;

    setSendingComment(true);
    try {
      await addComment({
        request_id: id,
        author_id: user.id,
        content: newComment.trim(),
      });
      setNewComment('');
      await refreshRequest();
    } catch (err) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSendingComment(false);
    }
  };

  const handleRate = async (stars: number) => {
    if (!id) return;
    setRating(stars);
    try {
      await rateSatisfaction(id, stars, stars >= 3);
      Alert.alert('Thank You', 'Your feedback has been recorded.');
      await refreshRequest();
    } catch (err) {
      Alert.alert('Error', 'Failed to submit rating');
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

  const statusConfig = STATUS_CONFIG[request.status];

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

          {request.property && (
            <Text style={styles.propertyAddress}>
              {request.property.address_line_1}
            </Text>
          )}

          <Text style={styles.dateText}>
            Submitted {new Date(request.created_at).toLocaleDateString('en-AU', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{request.description}</Text>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {request.location_in_property && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{request.location_in_property}</Text>
            </View>
          )}
          {request.scheduled_date && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Scheduled</Text>
              <Text style={styles.detailValue}>
                {new Date(request.scheduled_date).toLocaleDateString('en-AU', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
                {request.scheduled_time_start && ` at ${request.scheduled_time_start}`}
              </Text>
            </View>
          )}
          {request.estimated_cost != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated Cost</Text>
              <Text style={styles.detailValue}>${request.estimated_cost.toFixed(2)}</Text>
            </View>
          )}
          {request.actual_cost != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Actual Cost</Text>
              <Text style={styles.detailValue}>${request.actual_cost.toFixed(2)}</Text>
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

        {/* Satisfaction Rating (only when completed) */}
        {request.status === 'completed' && !request.satisfaction_rating && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rate this repair</Text>
            <Text style={styles.rateSubtext}>How satisfied are you with the repair work?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => handleRate(star)} style={styles.starButton}>
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill={rating >= star ? THEME.colors.warning : 'none'}>
                    <Path
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                      stroke={THEME.colors.warning}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {request.satisfaction_rating && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Rating</Text>
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
            Messages ({request.comments.length})
          </Text>
          {request.comments.length === 0 ? (
            <Text style={styles.noComments}>No messages yet</Text>
          ) : (
            request.comments.map((comment: MaintenanceComment) => (
              <View
                key={comment.id}
                style={[
                  styles.commentBubble,
                  comment.author_id === user?.id ? styles.commentOwn : styles.commentOther,
                ]}
              >
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
        <View style={styles.commentInput}>
          <TextInput
            style={styles.commentTextInput}
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add a message..."
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
  propertyAddress: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginBottom: THEME.spacing.xs,
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
  timelineDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  rateSubtext: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  starButton: {
    padding: THEME.spacing.xs,
  },
  noComments: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
  },
  commentBubble: {
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    maxWidth: '85%',
  },
  commentOwn: {
    backgroundColor: THEME.colors.brand,
    alignSelf: 'flex-end',
  },
  commentOther: {
    backgroundColor: THEME.colors.subtle,
    alignSelf: 'flex-start',
  },
  commentText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  commentDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.xs,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
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
