// Lease Renewal Response - Tenant View
// Sprint 5: The Loop — Tenant lease renewal response
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
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button } from '@casa/ui';
import { useMyTenancy, getSupabaseClient, useAuth } from '@casa/api';

export default function LeaseRenewalScreen() {
  const { user } = useAuth();
  const { tenancy, loading } = useMyTenancy();
  const [response, setResponse] = useState<'accept' | 'decline' | 'negotiate' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentRent = tenancy ? `$${((tenancy as any).rent_amount || 0).toFixed(2)}` : '';
  const proposedRent = tenancy ? `$${((tenancy as any).proposed_rent_amount || (tenancy as any).rent_amount || 0).toFixed(2)}` : '';
  const leaseEnd = (tenancy as any)?.lease_end_date
    ? new Date((tenancy as any).lease_end_date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Not set';

  const handleSubmit = async () => {
    if (!response || !tenancy || !user) return;
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();

      // Record the renewal response
      await (supabase
        .from('tenancies') as ReturnType<typeof supabase.from>)
        .update({
          renewal_response: response,
          renewal_response_notes: notes.trim() || null,
          renewal_response_date: new Date().toISOString(),
        })
        .eq('id', (tenancy as any).id);

      // Notify owner (fire-and-forget)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: propData } = await (supabase
            .from('properties') as ReturnType<typeof supabase.from>)
            .select('owner_id, address_line_1, suburb')
            .eq('id', (tenancy as any).property_id)
            .single();

          const { data: tenantProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          if (propData && (propData as any).owner_id) {
            const responseLabel = response === 'accept' ? 'accepted' : response === 'decline' ? 'declined' : 'wants to negotiate';
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
                  type: 'lease_renewal_response',
                  title: 'Lease Renewal Response',
                  body: `${(tenantProfile as any)?.full_name || 'Tenant'} has ${responseLabel} the lease renewal for ${(propData as any).address_line_1}.`,
                  data: {
                    tenancy_id: (tenancy as any).id,
                    response,
                    tenant_name: (tenantProfile as any)?.full_name || 'Tenant',
                    property_address: `${(propData as any).address_line_1}, ${(propData as any).suburb}`,
                  },
                  related_type: 'tenancy',
                  related_id: (tenancy as any).id,
                  channels: ['push', 'email'],
                }),
              }
            ).catch(() => {});
          }
        }
      } catch { /* non-blocking */ }

      const messages: Record<string, string> = {
        accept: 'You have accepted the lease renewal. Your landlord will be notified.',
        decline: 'You have declined the lease renewal. Your landlord will be notified.',
        negotiate: 'Your response has been sent. Your landlord will review your request.',
      };

      Alert.alert('Response Sent', messages[response], [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit response');
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

  if (!tenancy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No active tenancy found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Button title="Back" variant="text" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Lease Renewal</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                stroke={THEME.colors.brand}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.cardTitle}>Renewal Offer</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current Lease Ends</Text>
            <Text style={styles.detailValue}>{leaseEnd}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current Rent</Text>
            <Text style={styles.detailValue}>{currentRent}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Proposed Rent</Text>
            <Text style={[styles.detailValue, styles.proposedRent]}>{proposedRent}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your Response</Text>

        {(['accept', 'decline', 'negotiate'] as const).map(option => (
          <Button
            key={option}
            title={option === 'accept' ? 'Accept Renewal' : option === 'decline' ? 'Decline Renewal' : 'Negotiate Terms'}
            variant={response === option ? 'primary' : 'secondary'}
            onPress={() => setResponse(option)}
            style={response === option ? undefined : styles.optionBtn}
          />
        ))}

        {(response === 'decline' || response === 'negotiate') && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>
              {response === 'negotiate' ? 'What terms would you like to discuss?' : 'Reason for declining (optional)'}
            </Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder={response === 'negotiate'
                ? 'e.g. I would like to discuss the rent amount, or request a shorter lease term.'
                : 'e.g. I plan to move to a different area.'}
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        )}

        {response && (
          <Button
            title="Submit Response"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
          />
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
  },
  emptyText: {
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
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: THEME.spacing.base,
    gap: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl,
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
    fontWeight: THEME.fontWeight.semibold,
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
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  proposedRent: {
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.bold,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.sm,
  },
  optionBtn: {
    borderColor: THEME.colors.border,
  },
  notesSection: {
    gap: THEME.spacing.sm,
  },
  notesLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
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
});
