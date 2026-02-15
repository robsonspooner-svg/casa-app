// Inspection Time Response - Tenant View
// Sprint 5: The Loop — Tenant inspection time negotiation
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, useToast } from '@casa/ui';
import { useInspection, useInspectionMutations, getSupabaseClient } from '@casa/api';

export default function InspectionRespondScreen() {
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading } = useInspection(id || null);
  const { updateInspection } = useInspectionMutations();

  const [proposedTimes, setProposedTimes] = useState('');
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

  const handleConfirm = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await updateInspection(id, { tenant_confirmed: true } as any);

      // Notify owner (fire-and-forget)
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
                  type: 'inspection_time_confirmed',
                  title: 'Inspection Time Confirmed',
                  body: `Tenant confirmed the ${(inspection as any).inspection_type} inspection time for ${(propData as any).address_line_1}.`,
                  data: {
                    inspection_id: id,
                    property_address: `${(propData as any).address_line_1}, ${(propData as any).suburb}`,
                  },
                  channels: ['push'],
                }),
              }
            ).catch(() => {});
          }
        }
      } catch { /* non-blocking */ }

      toast.success('Inspection time confirmed.');
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePropose = async () => {
    if (!id || !proposedTimes.trim()) {
      Alert.alert('Required', 'Please enter your preferred times.');
      return;
    }
    setSubmitting(true);
    try {
      await updateInspection(id, { tenant_notes: proposedTimes.trim() } as any);

      // Notify owner (fire-and-forget)
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
                  type: 'inspection_time_proposed',
                  title: 'Alternative Inspection Time Proposed',
                  body: `Tenant has proposed alternative times for the ${(inspection as any).inspection_type} inspection at ${(propData as any).address_line_1}.`,
                  data: {
                    inspection_id: id,
                    property_address: `${(propData as any).address_line_1}, ${(propData as any).suburb}`,
                    proposed_times: proposedTimes.trim(),
                  },
                  channels: ['push', 'email'],
                }),
              }
            ).catch(() => {});
          }
        }
      } catch { /* non-blocking */ }

      toast.success('Preferred times sent to the owner.');
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
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
        <View style={styles.centered}>
          <Text style={styles.errorText}>Inspection not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Button title="Back" variant="text" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Respond to Inspection</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
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
              {((inspection as any).inspection_type || 'routine').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confirm This Time</Text>
          <Text style={styles.sectionDesc}>
            If the scheduled time works for you, confirm it below.
          </Text>
          <Button
            title="Confirm Inspection Time"
            onPress={handleConfirm}
            loading={submitting}
            disabled={submitting}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Propose Alternative Times</Text>
          <Text style={styles.sectionDesc}>
            If the scheduled time doesn't work, suggest alternatives below. The owner will review your request.
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
          <Button
            title="Send Preferred Times"
            variant="secondary"
            onPress={handlePropose}
            loading={submitting}
            disabled={submitting || !proposedTimes.trim()}
          />
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: THEME.spacing.base,
    gap: THEME.spacing.lg,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
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
  section: {
    gap: THEME.spacing.md,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  sectionDesc: {
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
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.base,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  dividerText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    fontWeight: THEME.fontWeight.medium as any,
  },
});
