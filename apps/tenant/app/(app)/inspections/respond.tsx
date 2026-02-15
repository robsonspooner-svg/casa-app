// Inspection Time Response - Tenant View
// WP10.1: Tenant inspection time negotiation
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, useToast } from '@casa/ui';
import { useInspection, useInspectionMutations, getSupabaseClient } from '@casa/api';

type ResponseOption = 'confirm' | 'propose' | 'decline';

export default function InspectionRespondScreen() {
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading } = useInspection(id || null);
  const { updateInspection } = useInspectionMutations();

  const [selectedOption, setSelectedOption] = useState<ResponseOption | null>(null);
  const [proposedTimes, setProposedTimes] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const scheduledDate = inspection?.scheduled_date
    ? new Date(inspection.scheduled_date).toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Not yet scheduled';

  const scheduledTime = inspection?.scheduled_date
    ? new Date(inspection.scheduled_date).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const propertyAddress = inspection?.property
    ? `${(inspection.property as any).address_line_1 || ''}, ${(inspection.property as any).suburb || ''}`
    : '';

  const handleSubmit = async () => {
    if (!id || !selectedOption) return;

    if (selectedOption === 'propose' && !proposedTimes.trim()) {
      Alert.alert('Required', 'Please enter your preferred times.');
      return;
    }

    if (selectedOption === 'decline' && !declineReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for declining.');
      return;
    }

    setSubmitting(true);
    try {
      const updatePayload: Record<string, unknown> = {};

      if (selectedOption === 'confirm') {
        updatePayload.tenant_confirmed = true;
      } else if (selectedOption === 'propose') {
        updatePayload.tenant_notes = proposedTimes.trim();
      } else if (selectedOption === 'decline') {
        updatePayload.tenant_notes = `DECLINED: ${declineReason.trim()}`;
        updatePayload.status = 'cancelled';
      }

      await updateInspection(id, updatePayload as any);

      // Notify owner
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session && inspection) {
          const { data: propData } = await (supabase
            .from('properties') as ReturnType<typeof supabase.from>)
            .select('owner_id, address_line_1, suburb')
            .eq('id', (inspection as any).property_id)
            .single();

          if (propData && (propData as any).owner_id) {
            const notificationTypes: Record<ResponseOption, { type: string; title: string; bodyText: string }> = {
              confirm: {
                type: 'inspection_time_confirmed',
                title: 'Inspection Time Confirmed',
                bodyText: `Tenant confirmed the ${(inspection as any).inspection_type} inspection time for ${(propData as any).address_line_1}.`,
              },
              propose: {
                type: 'inspection_time_proposed',
                title: 'Alternative Inspection Time Proposed',
                bodyText: `Tenant has proposed alternative times for the ${(inspection as any).inspection_type} inspection at ${(propData as any).address_line_1}.`,
              },
              decline: {
                type: 'inspection_time_declined',
                title: 'Inspection Time Declined',
                bodyText: `Tenant has declined the ${(inspection as any).inspection_type} inspection at ${(propData as any).address_line_1}. Reason: ${declineReason.trim()}`,
              },
            };

            const notification = notificationTypes[selectedOption];

            fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/dispatch-notification`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  user_id: (propData as any).owner_id,
                  type: notification.type,
                  title: notification.title,
                  body: notification.bodyText,
                  data: {
                    inspection_id: id,
                    property_address: `${(propData as any).address_line_1}, ${(propData as any).suburb}`,
                    ...(selectedOption === 'propose' ? { proposed_times: proposedTimes.trim() } : {}),
                    ...(selectedOption === 'decline' ? { decline_reason: declineReason.trim() } : {}),
                  },
                  channels: ['push', 'email'],
                }),
              }
            ).catch(() => {});
          }
        }
      } catch { /* non-blocking */ }

      const messages: Record<ResponseOption, string> = {
        confirm: 'Inspection time confirmed.',
        propose: 'Preferred times sent to the owner.',
        decline: 'Inspection declined. The owner has been notified.',
      };

      toast.success(messages[selectedOption]);
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit response');
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

  if (!inspection) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Respond to Inspection</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Inspection not found.</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Respond to Inspection</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Inspection Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                stroke={THEME.colors.brand}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.cardTitle}>Scheduled Inspection</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>
              {((inspection as any).inspection_type || 'routine')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{scheduledDate}</Text>
          </View>

          {scheduledTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{scheduledTime}</Text>
            </View>
          )}

          {propertyAddress && (
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Property</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: 'right', marginLeft: THEME.spacing.md }]}>
                {propertyAddress}
              </Text>
            </View>
          )}
        </View>

        {/* Response Options */}
        <Text style={styles.sectionTitle}>Your Response</Text>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedOption === 'confirm' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedOption('confirm')}
          activeOpacity={0.7}
        >
          <View style={[styles.optionIcon, { backgroundColor: THEME.colors.successBg }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Confirm Time</Text>
            <Text style={styles.optionDesc}>The scheduled time works for me</Text>
          </View>
          <View style={[styles.radio, selectedOption === 'confirm' && styles.radioSelected]}>
            {selectedOption === 'confirm' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedOption === 'propose' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedOption('propose')}
          activeOpacity={0.7}
        >
          <View style={[styles.optionIcon, { backgroundColor: THEME.colors.infoBg }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke={THEME.colors.info} strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Propose Alternative</Text>
            <Text style={styles.optionDesc}>Suggest different times that suit me</Text>
          </View>
          <View style={[styles.radio, selectedOption === 'propose' && styles.radioSelected]}>
            {selectedOption === 'propose' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedOption === 'decline' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedOption('decline')}
          activeOpacity={0.7}
        >
          <View style={[styles.optionIcon, { backgroundColor: THEME.colors.errorBg }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke={THEME.colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Decline</Text>
            <Text style={styles.optionDesc}>I cannot attend this inspection</Text>
          </View>
          <View style={[styles.radio, selectedOption === 'decline' && styles.radioSelected]}>
            {selectedOption === 'decline' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* Propose Alternative Input */}
        {selectedOption === 'propose' && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Preferred Times</Text>
            <Text style={styles.inputHint}>
              Suggest times that work for you. The owner will review your request.
            </Text>
            <TextInput
              style={styles.textArea}
              value={proposedTimes}
              onChangeText={setProposedTimes}
              placeholder="e.g. I'm available weekday mornings between 9am-12pm, or Saturday afternoon after 2pm."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        )}

        {/* Decline Reason Input */}
        {selectedOption === 'decline' && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Reason for Declining</Text>
            <TextInput
              style={styles.textArea}
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="Please explain why you cannot attend this inspection."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        )}

        {/* Submit Button */}
        {selectedOption && (
          <View style={styles.submitSection}>
            <Button
              title={submitting ? 'Submitting...' : 'Submit Response'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={
                submitting ||
                (selectedOption === 'propose' && !proposedTimes.trim()) ||
                (selectedOption === 'decline' && !declineReason.trim())
              }
            />
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
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
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.lg,
    ...THEME.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.base,
  },
  cardTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    gap: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  optionCardSelected: {
    borderColor: THEME.colors.brand,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  optionDesc: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: THEME.colors.brand,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.colors.brand,
  },
  inputSection: {
    marginTop: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  inputLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  inputHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.base,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitSection: {
    paddingVertical: THEME.spacing.xl,
  },
});
