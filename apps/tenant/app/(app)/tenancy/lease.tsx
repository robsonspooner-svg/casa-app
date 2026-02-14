// Lease View Screen - Tenant App
// Mission 06: Tenancies & Leases

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useMyTenancy, getSupabaseClient } from '@casa/api';

export default function LeaseScreen() {
  const { tenancy, loading } = useMyTenancy();
  const [leaseDocumentId, setLeaseDocumentId] = useState<string | null>(null);

  // Fetch lease document ID from the documents table
  useEffect(() => {
    if (!tenancy) return;
    const fetchLeaseDoc = async () => {
      const supabase = getSupabaseClient();
      const { data } = await (supabase
        .from('documents') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('tenancy_id', (tenancy as any).id)
        .eq('document_type', 'lease')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setLeaseDocumentId((data as any).id);
    };
    fetchLeaseDoc();
  }, [tenancy]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
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
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Lease</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No lease available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const leaseDoc = tenancy.documents.find(d => d.document_type === 'lease');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lease Agreement</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Lease Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Residential Tenancy Agreement</Text>
          <Text style={styles.summaryAddress}>
            {tenancy.property?.address_line_1}, {tenancy.property?.suburb} {tenancy.property?.state}
          </Text>
        </View>

        {/* Key Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Terms</Text>
          <View style={styles.termsGrid}>
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Lease Period</Text>
              <Text style={styles.termValue}>
                {new Date(tenancy.lease_start_date).toLocaleDateString('en-AU')} –{' '}
                {new Date(tenancy.lease_end_date).toLocaleDateString('en-AU')}
              </Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Lease Type</Text>
              <Text style={styles.termValue}>{tenancy.lease_type.replace('_', ' ')}</Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Rent</Text>
              <Text style={styles.termValue}>${tenancy.rent_amount} {tenancy.rent_frequency}</Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Rent Due</Text>
              <Text style={styles.termValue}>Day {tenancy.rent_due_day} of each {tenancy.rent_frequency === 'monthly' ? 'month' : 'period'}</Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Bond</Text>
              <Text style={styles.termValue}>${tenancy.bond_amount}</Text>
            </View>
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Bond Status</Text>
              <Text style={[styles.termValue, { textTransform: 'capitalize' }]}>{tenancy.bond_status}</Text>
            </View>
            {tenancy.bond_lodgement_number && (
              <View style={[styles.termRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.termLabel}>Bond Number</Text>
                <Text style={styles.termValue}>{tenancy.bond_lodgement_number}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Signing Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signing Status</Text>
          <View style={styles.signingCard}>
            {tenancy.lease_signed_at ? (
              <>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.signedText}>
                  Signed on {new Date(tenancy.lease_signed_at).toLocaleDateString('en-AU')}
                </Text>
              </>
            ) : (
              <>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="10" stroke={THEME.colors.warning} strokeWidth={1.5} />
                  <Path d="M12 6v6l4 2" stroke={THEME.colors.warning} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.pendingText}>Awaiting signatures</Text>
              </>
            )}
          </View>
        </View>

        {/* Lease Document */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lease Document</Text>
          {leaseDoc ? (
            <TouchableOpacity
              style={styles.documentCard}
              onPress={() => leaseDocumentId && router.push(`/(app)/documents/${leaseDocumentId}` as any)}
            >
              <View>
                <Text style={styles.docTitle}>{leaseDoc.title}</Text>
                <Text style={styles.docFile}>{leaseDoc.file_name}</Text>
              </View>
              <Text style={styles.downloadIcon}>↓</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noDocCard}>
              <Text style={styles.noDocText}>
                The lease document will be available here once your landlord uploads it.
              </Text>
            </View>
          )}
        </View>
        {/* View Full Lease Document Button */}
        {leaseDocumentId ? (
          <TouchableOpacity
            style={styles.viewLeaseButton}
            onPress={() => router.push(`/(app)/documents/${leaseDocumentId}` as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.viewLeaseButtonText}>View Full Lease Document</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.noLeaseDocText}>
            No lease document has been uploaded yet
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: THEME.colors.brand },
  title: { fontSize: 20, fontWeight: '700', color: THEME.colors.textPrimary },
  headerRight: { width: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: THEME.colors.textSecondary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  summaryCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: THEME.colors.border, alignItems: 'center' },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 4 },
  summaryAddress: { fontSize: 14, color: THEME.colors.textSecondary },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 12 },
  termsGrid: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 16, borderWidth: 1, borderColor: THEME.colors.border },
  termRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  termLabel: { fontSize: 14, color: THEME.colors.textSecondary },
  termValue: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary, maxWidth: '60%', textAlign: 'right' },
  signingCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 20, borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  signedIcon: { },
  signedText: { fontSize: 15, color: THEME.colors.success, fontWeight: '600' },
  pendingIcon: { },
  pendingText: { fontSize: 15, color: THEME.colors.textSecondary },
  documentCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 16, borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docTitle: { fontSize: 15, fontWeight: '600', color: THEME.colors.textPrimary },
  docFile: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
  downloadIcon: { fontSize: 20, color: THEME.colors.brand, fontWeight: '700' },
  noDocCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 20, borderWidth: 1, borderColor: THEME.colors.border },
  noDocText: { fontSize: 14, color: THEME.colors.textSecondary, textAlign: 'center' },
  viewLeaseButton: { backgroundColor: THEME.colors.brand, borderRadius: THEME.radius.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: THEME.spacing.base },
  viewLeaseButtonText: { color: THEME.colors.textInverse, fontSize: 16, fontWeight: '700' },
  noLeaseDocText: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textTertiary, marginTop: THEME.spacing.base, textAlign: 'center' },
});
