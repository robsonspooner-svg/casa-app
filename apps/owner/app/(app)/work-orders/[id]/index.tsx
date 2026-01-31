// Work Order Detail Screen
// Mission 10: Tradesperson Network
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, StarRating } from '@casa/ui';
import { useWorkOrder, useTradeMutations } from '@casa/api';
import type { WorkOrderStatus } from '@casa/api';

const STATUS_CONFIG: Record<WorkOrderStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: THEME.colors.textTertiary, bg: '#F5F5F5' },
  sent: { label: 'Sent', color: THEME.colors.info, bg: THEME.colors.infoBg },
  quoted: { label: 'Quoted', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  approved: { label: 'Approved', color: THEME.colors.success, bg: THEME.colors.successBg },
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: '#F5F5F5' },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  emergency: { label: 'Emergency', color: THEME.colors.error, bg: THEME.colors.errorBg },
  urgent: { label: 'Urgent', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  routine: { label: 'Routine', color: THEME.colors.textSecondary, bg: '#F5F5F5' },
};

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '-';
  return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WorkOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workOrder, loading, error, refreshing, refreshWorkOrder } = useWorkOrder(id || null);
  const { updateWorkOrderStatus, updateWorkOrder } = useTradeMutations();

  // Inline form states
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quotedAmount, setQuotedAmount] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTimeStart, setScheduledTimeStart] = useState('');
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState('');

  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [finalAmount, setFinalAmount] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  const handleStatusUpdate = async (
    newStatus: WorkOrderStatus,
    confirmMessage: string,
    additionalUpdates?: Record<string, unknown>
  ) => {
    Alert.alert(
      'Confirm',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            if (!workOrder) return;
            setActionLoading(true);
            try {
              await updateWorkOrderStatus(workOrder.id, newStatus, additionalUpdates);
              await refreshWorkOrder();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRecordQuote = async () => {
    if (!workOrder || !quotedAmount) {
      Alert.alert('Missing Fields', 'Please enter the quoted amount.');
      return;
    }
    setActionLoading(true);
    try {
      await updateWorkOrderStatus(workOrder.id, 'quoted', {
        quoted_amount: parseFloat(quotedAmount),
        quoted_at: new Date().toISOString(),
        quote_notes: quoteNotes.trim() || null,
      });
      setShowQuoteForm(false);
      setQuotedAmount('');
      setQuoteNotes('');
      await refreshWorkOrder();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record quote');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!workOrder || !scheduledDate) {
      Alert.alert('Missing Fields', 'Please enter the scheduled date.');
      return;
    }
    setActionLoading(true);
    try {
      await updateWorkOrderStatus(workOrder.id, 'scheduled', {
        scheduled_date: scheduledDate,
        scheduled_time_start: scheduledTimeStart || null,
        scheduled_time_end: scheduledTimeEnd || null,
      });
      setShowScheduleForm(false);
      setScheduledDate('');
      setScheduledTimeStart('');
      setScheduledTimeEnd('');
      await refreshWorkOrder();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!workOrder) return;
    setActionLoading(true);
    try {
      await updateWorkOrderStatus(workOrder.id, 'completed', {
        completion_notes: completionNotes.trim() || null,
        final_amount: finalAmount ? parseFloat(finalAmount) : null,
        actual_end_time: new Date().toISOString(),
      });
      setShowCompleteForm(false);
      setCompletionNotes('');
      setFinalAmount('');
      await refreshWorkOrder();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to complete');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Work Order</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !workOrder) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Work Order</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Work order not found'}</Text>
          <Button title="Retry" onPress={refreshWorkOrder} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[workOrder.status];
  const urgencyConfig = URGENCY_CONFIG[workOrder.urgency] || URGENCY_CONFIG.routine;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Work Order</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshWorkOrder}
            tintColor={THEME.colors.brand}
          />
        }
      >
        {/* Hero Card */}
        <View style={styles.section}>
          <Text style={styles.heroTitle}>{workOrder.title}</Text>
          <View style={styles.heroMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <View style={[styles.urgencyPill, { backgroundColor: urgencyConfig.bg }]}>
              <Text style={[styles.urgencyPillText, { color: urgencyConfig.color }]}>
                {urgencyConfig.label}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{formatCategory(workOrder.category)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{formatDate(workOrder.created_at)}</Text>
          </View>
        </View>

        {/* Trade Info */}
        {workOrder.trade && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trade</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Business</Text>
              <Text style={styles.detailValue}>{workOrder.trade.business_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact</Text>
              <Text style={styles.detailValue}>{workOrder.trade.contact_name}</Text>
            </View>
            {workOrder.trade.phone && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${workOrder.trade!.phone}`)}>
                  <Text style={[styles.detailValue, styles.linkText]}>{workOrder.trade.phone}</Text>
                </TouchableOpacity>
              </View>
            )}
            {workOrder.trade.email && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${workOrder.trade!.email}`)}>
                  <Text style={[styles.detailValue, styles.linkText]}>{workOrder.trade.email}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Property Info */}
        {workOrder.property && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>
                {workOrder.property.address_line_1}, {workOrder.property.suburb} {workOrder.property.state}
              </Text>
            </View>
          </View>
        )}

        {/* Job Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Details</Text>
          <Text style={styles.descriptionText}>{workOrder.description}</Text>
          {workOrder.access_instructions && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Access Instructions</Text>
              <Text style={styles.detailBlockValue}>{workOrder.access_instructions}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tenant Contact</Text>
            <Text style={styles.detailValue}>{workOrder.tenant_contact_allowed ? 'Allowed' : 'Not Allowed'}</Text>
          </View>
        </View>

        {/* Budget Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget & Quote</Text>
          {(workOrder.budget_min != null || workOrder.budget_max != null) && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Budget Range</Text>
              <Text style={styles.detailValue}>
                {workOrder.budget_min != null && workOrder.budget_max != null
                  ? `${formatCurrency(workOrder.budget_min)} - ${formatCurrency(workOrder.budget_max)}`
                  : workOrder.budget_min != null
                    ? `From ${formatCurrency(workOrder.budget_min)}`
                    : `Up to ${formatCurrency(workOrder.budget_max)}`}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Quote Required</Text>
            <Text style={styles.detailValue}>{workOrder.quote_required ? 'Yes' : 'No'}</Text>
          </View>
          {workOrder.quoted_amount != null && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quoted Amount</Text>
                <Text style={[styles.detailValue, styles.detailValueBold]}>{formatCurrency(workOrder.quoted_amount)}</Text>
              </View>
              {workOrder.quote_notes && (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Quote Notes</Text>
                  <Text style={styles.detailBlockValue}>{workOrder.quote_notes}</Text>
                </View>
              )}
              {workOrder.quote_valid_until && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Valid Until</Text>
                  <Text style={styles.detailValue}>{formatDate(workOrder.quote_valid_until)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Schedule Section */}
        {(workOrder.scheduled_date || workOrder.actual_start_time || workOrder.actual_end_time) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            {workOrder.scheduled_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Scheduled Date</Text>
                <Text style={styles.detailValue}>{formatDate(workOrder.scheduled_date)}</Text>
              </View>
            )}
            {workOrder.scheduled_time_start && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>
                  {workOrder.scheduled_time_start}
                  {workOrder.scheduled_time_end ? ` - ${workOrder.scheduled_time_end}` : ''}
                </Text>
              </View>
            )}
            {workOrder.actual_start_time && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Actual Start</Text>
                <Text style={styles.detailValue}>{formatTime(workOrder.actual_start_time)}</Text>
              </View>
            )}
            {workOrder.actual_end_time && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Actual End</Text>
                <Text style={styles.detailValue}>{formatTime(workOrder.actual_end_time)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Completion Section */}
        {workOrder.status === 'completed' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completion</Text>
            {workOrder.completion_notes && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Completion Notes</Text>
                <Text style={styles.detailBlockValue}>{workOrder.completion_notes}</Text>
              </View>
            )}
            {workOrder.final_amount != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Final Amount</Text>
                <Text style={[styles.detailValue, styles.detailValueBold]}>{formatCurrency(workOrder.final_amount)}</Text>
              </View>
            )}
            {workOrder.invoice_number && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Invoice</Text>
                <Text style={styles.detailValue}>#{workOrder.invoice_number}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Paid</Text>
              <Text style={styles.detailValue}>{workOrder.paid_at ? formatDate(workOrder.paid_at) : 'Not yet'}</Text>
            </View>
          </View>
        )}

        {/* Review Section */}
        {workOrder.review && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Review</Text>
            <StarRating rating={workOrder.review.rating} size={20} />
            {workOrder.review.title && (
              <Text style={styles.reviewTitle}>{workOrder.review.title}</Text>
            )}
            {workOrder.review.content && (
              <Text style={styles.reviewContent}>{workOrder.review.content}</Text>
            )}
            {workOrder.review.would_recommend != null && (
              <Text style={styles.reviewRecommend}>
                {workOrder.review.would_recommend ? 'Would recommend' : 'Would not recommend'}
              </Text>
            )}
          </View>
        )}

        {/* Write Review Button */}
        {workOrder.status === 'completed' && !workOrder.review && (
          <View style={styles.section}>
            <Button
              title="Write Review"
              onPress={() => router.push(`/(app)/work-orders/${workOrder.id}/review` as any)}
              variant="secondary"
            />
          </View>
        )}

        {/* Inline Quote Form */}
        {showQuoteForm && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Record Quote</Text>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>Quoted Amount *</Text>
              <TextInput
                style={styles.inlineInput}
                value={quotedAmount}
                onChangeText={setQuotedAmount}
                placeholder="0.00"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>Quote Notes</Text>
              <TextInput
                style={[styles.inlineInput, styles.multilineInlineInput]}
                value={quoteNotes}
                onChangeText={setQuoteNotes}
                placeholder="Any notes about the quote..."
                placeholderTextColor={THEME.colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.inlineActions}>
              <Button title="Cancel" onPress={() => setShowQuoteForm(false)} variant="secondary" style={styles.inlineActionButton} />
              <Button title="Save Quote" onPress={handleRecordQuote} loading={actionLoading} style={styles.inlineActionButton} />
            </View>
          </View>
        )}

        {/* Inline Schedule Form */}
        {showScheduleForm && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule Work</Text>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>Date * (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.inlineInput}
                value={scheduledDate}
                onChangeText={setScheduledDate}
                placeholder="2025-01-15"
                placeholderTextColor={THEME.colors.textTertiary}
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>Start Time (e.g. 09:00)</Text>
              <TextInput
                style={styles.inlineInput}
                value={scheduledTimeStart}
                onChangeText={setScheduledTimeStart}
                placeholder="09:00"
                placeholderTextColor={THEME.colors.textTertiary}
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>End Time (e.g. 17:00)</Text>
              <TextInput
                style={styles.inlineInput}
                value={scheduledTimeEnd}
                onChangeText={setScheduledTimeEnd}
                placeholder="17:00"
                placeholderTextColor={THEME.colors.textTertiary}
              />
            </View>
            <View style={styles.inlineActions}>
              <Button title="Cancel" onPress={() => setShowScheduleForm(false)} variant="secondary" style={styles.inlineActionButton} />
              <Button title="Schedule" onPress={handleSchedule} loading={actionLoading} style={styles.inlineActionButton} />
            </View>
          </View>
        )}

        {/* Inline Complete Form */}
        {showCompleteForm && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mark Complete</Text>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>Completion Notes</Text>
              <TextInput
                style={[styles.inlineInput, styles.multilineInlineInput]}
                value={completionNotes}
                onChangeText={setCompletionNotes}
                placeholder="Describe the completed work..."
                placeholderTextColor={THEME.colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>Final Amount</Text>
              <TextInput
                style={styles.inlineInput}
                value={finalAmount}
                onChangeText={setFinalAmount}
                placeholder="0.00"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inlineActions}>
              <Button title="Cancel" onPress={() => setShowCompleteForm(false)} variant="secondary" style={styles.inlineActionButton} />
              <Button title="Complete" onPress={handleComplete} loading={actionLoading} style={styles.inlineActionButton} />
            </View>
          </View>
        )}

        {/* Status Actions */}
        {!showQuoteForm && !showScheduleForm && !showCompleteForm && (
          <View style={styles.actionsSection}>
            {workOrder.status === 'draft' && (
              <>
                <Button
                  title="Send to Trade"
                  onPress={() => handleStatusUpdate('sent', 'Send this work order to the tradesperson?')}
                  loading={actionLoading}
                />
                <View style={styles.actionSpacer} />
                <Button
                  title="Cancel Work Order"
                  onPress={() => handleStatusUpdate('cancelled', 'Are you sure you want to cancel this work order?')}
                  variant="secondary"
                  loading={actionLoading}
                />
              </>
            )}

            {workOrder.status === 'sent' && (
              <>
                <Button
                  title="Record Quote"
                  onPress={() => setShowQuoteForm(true)}
                />
                <View style={styles.actionSpacer} />
                <Button
                  title="Cancel Work Order"
                  onPress={() => handleStatusUpdate('cancelled', 'Are you sure you want to cancel this work order?')}
                  variant="secondary"
                  loading={actionLoading}
                />
              </>
            )}

            {workOrder.status === 'quoted' && (
              <>
                <Button
                  title="Approve Quote"
                  onPress={() => handleStatusUpdate('approved', `Approve the quote of ${formatCurrency(workOrder.quoted_amount)}?`)}
                  loading={actionLoading}
                />
                <View style={styles.actionSpacer} />
                <Button
                  title="Cancel Work Order"
                  onPress={() => handleStatusUpdate('cancelled', 'Are you sure you want to cancel this work order?')}
                  variant="secondary"
                  loading={actionLoading}
                />
              </>
            )}

            {workOrder.status === 'approved' && (
              <>
                <Button
                  title="Schedule"
                  onPress={() => setShowScheduleForm(true)}
                />
                <View style={styles.actionSpacer} />
                <Button
                  title="Start Work"
                  onPress={() => handleStatusUpdate('in_progress', 'Mark work as started?', { actual_start_time: new Date().toISOString() })}
                  variant="secondary"
                  loading={actionLoading}
                />
                <View style={styles.actionSpacer} />
                <Button
                  title="Cancel Work Order"
                  onPress={() => handleStatusUpdate('cancelled', 'Are you sure you want to cancel this work order?')}
                  variant="text"
                  loading={actionLoading}
                />
              </>
            )}

            {workOrder.status === 'scheduled' && (
              <>
                <Button
                  title="Start Work"
                  onPress={() => handleStatusUpdate('in_progress', 'Mark work as started?', { actual_start_time: new Date().toISOString() })}
                  loading={actionLoading}
                />
                <View style={styles.actionSpacer} />
                <Button
                  title="Put on Hold"
                  onPress={() => handleStatusUpdate('approved', 'Put this work order on hold? It will return to approved status.')}
                  variant="secondary"
                  loading={actionLoading}
                />
              </>
            )}

            {workOrder.status === 'in_progress' && (
              <Button
                title="Mark Complete"
                onPress={() => setShowCompleteForm(true)}
              />
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
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
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
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  heroTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
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
  urgencyPill: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.full,
  },
  urgencyPillText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: THEME.spacing.xs,
  },
  detailLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },
  detailValueBold: {
    fontWeight: THEME.fontWeight.semibold,
    fontSize: THEME.fontSize.body,
  },
  linkText: {
    color: THEME.colors.info,
    textDecorationLine: 'underline',
  },
  descriptionText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    marginBottom: THEME.spacing.md,
  },
  detailBlock: {
    marginBottom: THEME.spacing.md,
  },
  detailBlockValue: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.xs,
    lineHeight: 20,
  },
  reviewTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.sm,
  },
  reviewContent: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
    lineHeight: 20,
  },
  reviewRecommend: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.success,
    fontWeight: THEME.fontWeight.medium,
    marginTop: THEME.spacing.sm,
  },
  actionsSection: {
    marginTop: THEME.spacing.sm,
  },
  actionSpacer: {
    height: THEME.spacing.md,
  },
  inlineField: {
    marginBottom: THEME.spacing.md,
  },
  inlineFieldLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  inlineInput: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  multilineInlineInput: {
    minHeight: 80,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  inlineActionButton: {
    flex: 1,
  },
});
