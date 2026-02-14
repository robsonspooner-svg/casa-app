// Generate Lease Agreement Screen - Owner App
// Mission 06: Tenancies & Leases

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useTenancy, useProfile, generateLeaseHTML, getSupabaseClient, type LeaseData } from '@casa/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={THEME.colors.brand}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DocumentIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        stroke={THEME.colors.brand}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke={THEME.colors.brand}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildPropertyAddress(property: {
  address_line_1: string;
  address_line_2?: string | null;
  suburb: string;
  state: string;
  postcode: string;
}): string {
  const parts = [property.address_line_1];
  if (property.address_line_2) {
    parts.push(property.address_line_2);
  }
  parts.push(`${property.suburb} ${property.state} ${property.postcode}`);
  return parts.join(', ');
}

function getRentFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'weekly':
      return 'per week';
    case 'fortnightly':
      return 'per fortnight';
    case 'monthly':
      return 'per month';
    default:
      return frequency;
  }
}

export default function GenerateLeaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading, error } = useTenancy(id || null);
  const { profile, loading: profileLoading } = useProfile();

  const [specialConditions, setSpecialConditions] = useState('');
  const [generating, setGenerating] = useState(false);

  const leaseData: LeaseData | null = useMemo(() => {
    if (!tenancy || !tenancy.property) return null;

    const property = tenancy.property;
    const primaryTenant = tenancy.tenants.find(t => t.is_primary) || tenancy.tenants[0];

    const rentAmount = tenancy.rent_amount;
    const bondAmount = tenancy.bond_amount;
    // Derive bond weeks from bond amount and rent amount
    const bondWeeks = rentAmount > 0 ? Math.round(bondAmount / rentAmount) : 4;

    return {
      ownerName: profile?.full_name || '',
      ownerEmail: profile?.email || '',
      tenantName: primaryTenant?.profile?.full_name || 'Unknown Tenant',
      tenantEmail: primaryTenant?.profile?.email || '',
      propertyAddress: buildPropertyAddress(property),
      propertyType: property.property_type,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parkingSpaces: property.parking_spaces,
      leaseStartDate: tenancy.lease_start_date,
      leaseEndDate: tenancy.lease_end_date,
      rentAmount,
      rentFrequency: tenancy.rent_frequency as LeaseData['rentFrequency'],
      bondAmount,
      bondWeeks,
      state: property.state,
      petsAllowed: undefined,
      smokingAllowed: undefined,
      furnished: undefined,
      specialConditions: specialConditions.trim() || undefined,
    };
  }, [tenancy, profile, specialConditions]);

  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  const handleGeneratePDF = async () => {
    if (!leaseData) {
      Alert.alert('Missing Data', 'Tenancy data is not available to generate the lease.');
      return;
    }

    if (!leaseData.ownerName) {
      Alert.alert('Missing Owner Name', 'Please update your profile with your full name before generating a lease.');
      return;
    }

    setGenerating(true);
    try {
      const html = generateLeaseHTML(leaseData);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Save to documents table
      const { data: doc, error: docErr } = await (supabase
        .from('documents') as any)
        .insert({
          owner_id: user.id,
          property_id: tenancy!.property?.id || null,
          tenancy_id: id,
          document_type: 'lease',
          title: `Lease Agreement — ${tenancy!.property?.address_line_1 || 'Property'}`,
          html_content: html,
          status: 'draft',
          requires_signature: true,
        })
        .select('id')
        .single();

      if (docErr) throw new Error(docErr.message);
      setSavedDocId(doc.id);

      // Offer to send to tenant
      const tenantEmail = primaryTenant?.profile?.email;
      const tenantName = primaryTenant?.profile?.full_name || 'the tenant';

      if (tenantEmail) {
        Alert.alert(
          'Lease Saved',
          `The lease has been saved to your documents. Would you like to send it to ${tenantName} (${tenantEmail})?`,
          [
            { text: 'Just Save', style: 'cancel', onPress: () => {
              Alert.alert('Saved', 'Lease saved to your documents tab.');
              router.push(`/(app)/documents/${doc.id}` as never);
            }},
            { text: 'Send to Tenant', onPress: () => sendToTenant(doc.id, tenantEmail, tenantName) },
            { text: 'Share PDF', onPress: () => sharePDF(html) },
          ],
        );
      } else {
        Alert.alert(
          'Lease Saved',
          'The lease has been saved to your documents tab.',
          [
            { text: 'View Document', onPress: () => router.push(`/(app)/documents/${doc.id}` as never) },
            { text: 'Share PDF', onPress: () => sharePDF(html) },
          ],
        );
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate the lease.');
    } finally {
      setGenerating(false);
    }
  };

  const sendToTenant = async (docId: string, _email: string, name: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call the send-document-email Edge Function — handles everything:
      // branded lease email template, HTML attachment, tenant_id + status update
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-document-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ documentId: docId }),
        },
      );

      const result = await resp.json();

      if (resp.ok && result.success) {
        Alert.alert('Sent', `Lease sent to ${result.tenantName || name}.`, [
          { text: 'View Document', onPress: () => router.push(`/(app)/documents/${docId}` as never) },
        ]);
      } else {
        Alert.alert('Send Failed', result.error || 'Could not send the email. The lease is still saved in your documents.');
        router.push(`/(app)/documents/${docId}` as never);
      }
    } catch {
      Alert.alert('Send Failed', 'Could not send the email. The lease is still saved in your documents.');
      router.push(`/(app)/documents/${docId}` as never);
    }
  };

  const sharePDF = async (html: string) => {
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Lease Agreement',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancel')) return;
      Alert.alert('Error', 'Failed to share PDF.');
    }
  };

  if (loading || profileLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
          <Text style={styles.loadingText}>Loading tenancy details...</Text>
        </View>
      </View>
    );
  }

  if (error || !tenancy) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lease Agreement</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'Tenancy not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const property = tenancy.property;
  const primaryTenant = tenancy.tenants.find(t => t.is_primary) || tenancy.tenants[0];
  const rentAmount = tenancy.rent_amount;
  const bondAmount = tenancy.bond_amount;
  const bondWeeks = rentAmount > 0 ? Math.round(bondAmount / rentAmount) : 4;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lease Agreement</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Document Preview Icon */}
        <View style={styles.documentIconContainer}>
          <DocumentIcon />
          <Text style={styles.documentTitle}>Residential Tenancy Agreement</Text>
          <Text style={styles.documentSubtitle}>
            {property?.state?.toUpperCase() || 'AU'} Standard Form
          </Text>
        </View>

        {/* Parties Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parties</Text>

          <View style={styles.partySection}>
            <Text style={styles.partyLabel}>Landlord (Owner)</Text>
            <Text style={styles.partyValue}>{profile?.full_name || 'Not set'}</Text>
            <Text style={styles.partyDetail}>{profile?.email || ''}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.partySection}>
            <Text style={styles.partyLabel}>Tenant</Text>
            <Text style={styles.partyValue}>
              {primaryTenant?.profile?.full_name || 'Unknown'}
            </Text>
            <Text style={styles.partyDetail}>
              {primaryTenant?.profile?.email || ''}
            </Text>
            {tenancy.tenants.length > 1 && (
              <Text style={styles.additionalTenants}>
                +{tenancy.tenants.length - 1} additional tenant{tenancy.tenants.length > 2 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Property Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Property</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue}>
              {property
                ? buildPropertyAddress(property)
                : 'Unknown'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>
              {property?.property_type
                ? property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1).replace(/_/g, ' ')
                : 'Not specified'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Layout</Text>
            <Text style={styles.detailValue}>
              {property
                ? `${property.bedrooms} bed, ${property.bathrooms} bath, ${property.parking_spaces} parking`
                : 'Not specified'}
            </Text>
          </View>
        </View>

        {/* Lease Terms Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lease Terms</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Start Date</Text>
            <Text style={styles.detailValue}>
              {formatDateDisplay(tenancy.lease_start_date)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>End Date</Text>
            <Text style={styles.detailValue}>
              {formatDateDisplay(tenancy.lease_end_date)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rent</Text>
            <Text style={styles.detailValue}>
              ${rentAmount.toFixed(2)} {getRentFrequencyLabel(tenancy.rent_frequency)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bond</Text>
            <Text style={styles.detailValue}>
              ${bondAmount.toFixed(2)} ({bondWeeks} weeks)
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>State</Text>
            <Text style={styles.detailValue}>
              {property?.state?.toUpperCase() || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Special Conditions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Special Conditions</Text>
          <Text style={styles.specialConditionsHint}>
            Add any additional terms or conditions for this lease agreement. These will appear as a separate section in the generated document.
          </Text>
          <TextInput
            style={styles.specialConditionsInput}
            value={specialConditions}
            onChangeText={setSpecialConditions}
            placeholder="e.g. Tenant is permitted to install a wall-mounted TV bracket..."
            placeholderTextColor={THEME.colors.textTertiary}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteText}>
            This generates a standard residential tenancy agreement based on your tenancy details. Both parties should review and sign the document. Seek independent legal advice if required.
          </Text>
        </View>
      </ScrollView>

      {/* Footer with Generate Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.buttonDisabled]}
          onPress={handleGeneratePDF}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          ) : (
            <Text style={styles.generateButtonText}>Generate & Save Lease</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  documentIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  documentTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.md,
  },
  documentSubtitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  partySection: {
    paddingVertical: 8,
  },
  partyLabel: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '500',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  partyValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  partyDetail: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  additionalTenants: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.brand,
    fontWeight: '500',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1.5,
    textAlign: 'right',
  },
  specialConditionsHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  specialConditionsInput: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minHeight: 100,
    lineHeight: 22,
  },
  infoNote: {
    backgroundColor: THEME.colors.infoBg,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginBottom: 8,
  },
  infoNoteText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.info,
    lineHeight: 18,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  generateButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: THEME.colors.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  errorButtonText: {
    color: THEME.colors.textInverse,
    fontWeight: '600',
    fontSize: THEME.fontSize.body,
  },
});
