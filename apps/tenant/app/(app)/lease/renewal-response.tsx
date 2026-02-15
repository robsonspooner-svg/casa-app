// Lease Renewal Response - Tenant View
// WP10.2: Tenant lease renewal response UI
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, useToast } from '@casa/ui';
import { useMyTenancy, getSupabaseClient, useAuth } from '@casa/api';

type ResponseOption = 'accept' | 'negotiate' | 'decline';

export default function LeaseRenewalResponseScreen() {
  const toast = useToast();
  const { user } = useAuth();
  const { tenancy, loading } = useMyTenancy();

  const [selectedOption, setSelectedOption] = useState<ResponseOption | null>(null);
  const [counterOfferRent, setCounterOfferRent] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentRent = tenancy ? Number((tenancy as any).rent_amount || 0) : 0;
  const proposedRent = tenancy ? Number((tenancy as any).proposed_rent_amount || (tenancy as any).rent_amount || 0) : 0;
  const rentFrequency = (tenancy as any)?.rent_frequency || 'weekly';
  const proposedDuration = (tenancy as any)?.proposed_lease_duration || '12 months';
  const proposedConditions = (tenancy as any)?.proposed_conditions || null;

  const leaseEnd = (tenancy as any)?.lease_end_date
    ? new Date((tenancy as any).lease_end_date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Not set';

  const propertyAddress = tenancy?.property
    ? `${(tenancy.property as any).address_line_1 || ''}, ${(tenancy.property as any).suburb || ''} ${(tenancy.property as any).state || ''}`
    : '';

  const rentChanged = proposedRent !== currentRent;

  const handleSubmit = async () => {
    if (!selectedOption || !tenancy || !user) return;

    if (selectedOption === 'negotiate' && !counterOfferRent.trim() && !notes.trim()) {
      toast.error('Please provide a counter-offer amount or notes.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();

      const updatePayload: Record<string, unknown> = {
        renewal_response: selectedOption,
        renewal_response_notes: notes.trim() || null,
        renewal_response_date: new Date().toISOString(),
      };

      if (selectedOption === 'negotiate' && counterOfferRent.trim()) {
        updatePayload.counter_offer_rent = parseFloat(counterOfferRent);
      }

      await (supabase
        .from('tenancies') as ReturnType<typeof supabase.from>)
        .update(updatePayload)
        .eq('id', (tenancy as any).id);

      // Notify owner
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
            const responseLabel =
              selectedOption === 'accept'
                ? 'accepted'
                : selectedOption === 'decline'
                  ? 'declined'
                  : 'wants to negotiate';

            const bodyParts = [
              `${(tenantProfile as any)?.full_name || 'Tenant'} has ${responseLabel} the lease renewal for ${(propData as any).address_line_1}.`,
            ];

            if (selectedOption === 'negotiate' && counterOfferRent.trim()) {
              bodyParts.push(`Counter-offer: $${counterOfferRent} ${rentFrequency}.`);
            }
            if (notes.trim()) {
              bodyParts.push(`Notes: ${notes.trim()}`);
            }

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
                  body: bodyParts.join(' '),
                  data: {
                    tenancy_id: (tenancy as any).id,
                    response: selectedOption,
                    tenant_name: (tenantProfile as any)?.full_name || 'Tenant',
                    property_address: `${(propData as any).address_line_1}, ${(propData as any).suburb}`,
                    ...(counterOfferRent.trim() ? { counter_offer_rent: counterOfferRent } : {}),
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

      const messages: Record<ResponseOption, string> = {
        accept: 'You have accepted the lease renewal. Your landlord will be notified.',
        decline: 'You have declined the lease renewal. Your landlord will be notified.',
        negotiate: 'Your counter-offer has been sent. Your landlord will review it.',
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

  if (!tenancy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lease Renewal</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No active tenancy found.</Text>
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
        <Text style={styles.headerTitle}>Lease Renewal</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Property Info */}
        {propertyAddress ? (
          <Text style={styles.propertyAddress}>{propertyAddress}</Text>
        ) : null}

        {/* Proposed Terms Card */}
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
            <Text style={styles.detailValue}>${currentRent.toFixed(2)} {rentFrequency}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Proposed Rent</Text>
            <Text style={[styles.detailValue, rentChanged ? styles.proposedRentHighlight : undefined]}>
              ${proposedRent.toFixed(2)} {rentFrequency}
            </Text>
          </View>

          {rentChanged && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Change</Text>
              <Text style={[
                styles.detailValue,
                { color: proposedRent > currentRent ? THEME.colors.error : THEME.colors.success },
              ]}>
                {proposedRent > currentRent ? '+' : ''}${(proposedRent - currentRent).toFixed(2)} {rentFrequency}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Proposed Duration</Text>
            <Text style={styles.detailValue}>{proposedDuration}</Text>
          </View>

          {proposedConditions && (
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Conditions</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: 'right', marginLeft: THEME.spacing.md }]}>
                {proposedConditions}
              </Text>
            </View>
          )}
        </View>

        {/* Response Options */}
        <Text style={styles.sectionTitle}>Your Response</Text>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedOption === 'accept' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedOption('accept')}
          activeOpacity={0.7}
        >
          <View style={[styles.optionIcon, { backgroundColor: THEME.colors.successBg }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Accept Renewal</Text>
            <Text style={styles.optionDesc}>I agree to the proposed terms</Text>
          </View>
          <View style={[styles.radio, selectedOption === 'accept' && styles.radioSelected]}>
            {selectedOption === 'accept' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedOption === 'negotiate' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedOption('negotiate')}
          activeOpacity={0.7}
        >
          <View style={[styles.optionIcon, { backgroundColor: THEME.colors.infoBg }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={THEME.colors.info} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Negotiate Terms</Text>
            <Text style={styles.optionDesc}>Propose a counter-offer</Text>
          </View>
          <View style={[styles.radio, selectedOption === 'negotiate' && styles.radioSelected]}>
            {selectedOption === 'negotiate' && <View style={styles.radioInner} />}
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
            <Text style={styles.optionTitle}>Decline Renewal</Text>
            <Text style={styles.optionDesc}>I do not wish to renew my lease</Text>
          </View>
          <View style={[styles.radio, selectedOption === 'decline' && styles.radioSelected]}>
            {selectedOption === 'decline' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* Negotiate Input */}
        {selectedOption === 'negotiate' && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Counter-Offer Rent ({rentFrequency})</Text>
            <View style={styles.rentInputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.rentInput}
                value={counterOfferRent}
                onChangeText={setCounterOfferRent}
                placeholder={currentRent.toFixed(2)}
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="decimal-pad"
                maxLength={10}
              />
            </View>

            <Text style={[styles.inputLabel, { marginTop: THEME.spacing.md }]}>Notes (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. I would like to discuss the rent amount, or request a shorter lease term."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        )}

        {/* Decline Notes */}
        {selectedOption === 'decline' && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Reason for declining (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. I plan to move to a different area."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        )}

        {/* Accept Notes */}
        {selectedOption === 'accept' && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Additional notes (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional comments for your landlord."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={3}
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
                (selectedOption === 'negotiate' && !counterOfferRent.trim() && !notes.trim())
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
  propertyAddress: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
    textAlign: 'center',
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
  proposedRentHighlight: {
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.bold as any,
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
  rentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.base,
  },
  dollarSign: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textSecondary,
    marginRight: THEME.spacing.xs,
  },
  rentInput: {
    flex: 1,
    height: 48,
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
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
