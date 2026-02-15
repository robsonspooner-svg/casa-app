// Create Tenancy Screen - Owner App
// Mission 06: Tenancies & Leases
// Creates a tenancy from an approved application

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useToast } from '@casa/ui';
import {
  useApplication,
  useTenancyMutations,
  LeaseTerm,
  PaymentFrequency,
} from '@casa/api';

const LEASE_TERMS: { label: string; value: LeaseTerm }[] = [
  { label: '6 months', value: '6_months' },
  { label: '12 months', value: '12_months' },
  { label: '24 months', value: '24_months' },
  { label: 'Flexible', value: 'flexible' },
];

const FREQUENCIES: { label: string; value: PaymentFrequency }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Fortnightly', value: 'fortnightly' },
  { label: 'Monthly', value: 'monthly' },
];

export default function CreateTenancyScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const { application, loading: appLoading } = useApplication(applicationId || null);
  const { createTenancy } = useTenancyMutations();
  const toast = useToast();

  const [leaseType, setLeaseType] = useState<LeaseTerm>('12_months');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [rentFrequency, setRentFrequency] = useState<PaymentFrequency>('weekly');
  const [rentDueDay, setRentDueDay] = useState('1');
  const [bondAmount, setBondAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-populate from application/listing
  useEffect(() => {
    if (application) {
      const listing = application.listing;
      if (listing) {
        setRentAmount(String(listing.rent_amount || ''));
        setRentFrequency((listing.rent_frequency as PaymentFrequency) || 'weekly');
        const calculatedBond = (listing.bond_weeks || 4) * listing.rent_amount;
        setBondAmount(String(calculatedBond));
        if (listing.lease_term) {
          setLeaseType(listing.lease_term as LeaseTerm);
        }
      }

      // Default start date to today
      const today = new Date();
      setStartDate(today.toISOString().split('T')[0]);

      // Calculate end date based on lease term
      const end = new Date(today);
      if (leaseType === '6_months') end.setMonth(end.getMonth() + 6);
      else if (leaseType === '12_months') end.setMonth(end.getMonth() + 12);
      else if (leaseType === '24_months') end.setMonth(end.getMonth() + 24);
      else end.setMonth(end.getMonth() + 12);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [application]);

  // Update end date when lease type or start date changes
  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) return;
      const end = new Date(start);
      if (leaseType === '6_months') end.setMonth(end.getMonth() + 6);
      else if (leaseType === '12_months') end.setMonth(end.getMonth() + 12);
      else if (leaseType === '24_months') end.setMonth(end.getMonth() + 24);
      else end.setMonth(end.getMonth() + 12);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [leaseType, startDate]);

  const handleCreate = async () => {
    if (!application) return;

    if (!startDate || !endDate || !rentAmount || !bondAmount) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    const rent = parseFloat(rentAmount);
    const bond = parseFloat(bondAmount);
    if (isNaN(rent) || isNaN(bond)) {
      Alert.alert('Invalid Amount', 'Please enter valid amounts for rent and bond.');
      return;
    }

    const dueDayNum = parseInt(rentDueDay) || 1;
    const maxDueDay = rentFrequency === 'weekly' ? 7 : rentFrequency === 'fortnightly' ? 14 : 28;
    if (dueDayNum < 1 || dueDayNum > maxDueDay) {
      Alert.alert('Invalid Due Day', `Due day must be between 1 and ${maxDueDay} for ${rentFrequency} payments.`);
      return;
    }

    setSubmitting(true);
    try {
      // Auto-activate tenancy if start date is today or in the past
      const today = new Date().toISOString().split('T')[0];
      const tenancyStatus = startDate <= today ? 'active' : 'pending';

      const tenancyId = await createTenancy(
        {
          property_id: application.listing?.property_id || '',
          listing_id: application.listing_id,
          application_id: application.id,
          lease_start_date: startDate,
          lease_end_date: endDate,
          lease_type: leaseType,
          rent_amount: rent,
          rent_frequency: rentFrequency,
          rent_due_day: dueDayNum,
          bond_amount: bond,
          status: tenancyStatus,
          notes: notes || undefined,
        },
        [application.tenant_id]
      );

      toast.success('Tenancy created successfully.');
      router.replace(`/(app)/tenancies/${tenancyId}` as any);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tenancy');
    } finally {
      setSubmitting(false);
    }
  };

  if (appLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Application not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Tenancy</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Tenant Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tenant</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoName}>
              {application.full_name}
            </Text>
            <Text style={styles.infoDetail}>{application.email}</Text>
            {application.phone && <Text style={styles.infoDetail}>{application.phone}</Text>}
          </View>
        </View>

        {/* Lease Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lease Details</Text>

          <Text style={styles.fieldLabel}>Lease Term</Text>
          <View style={styles.optionRow}>
            {LEASE_TERMS.map(term => (
              <TouchableOpacity
                key={term.value}
                style={[styles.optionChip, leaseType === term.value && styles.optionChipActive]}
                onPress={() => setLeaseType(term.value)}
              >
                <Text style={[styles.optionText, leaseType === term.value && styles.optionTextActive]}>
                  {term.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2024-03-01"
            placeholderTextColor={THEME.colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2025-03-01"
            placeholderTextColor={THEME.colors.textTertiary}
          />
        </View>

        {/* Rent Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rent</Text>

          <Text style={styles.fieldLabel}>Amount ($)</Text>
          <TextInput
            style={styles.input}
            value={rentAmount}
            onChangeText={setRentAmount}
            keyboardType="decimal-pad"
            placeholder="650.00"
            placeholderTextColor={THEME.colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.optionRow}>
            {FREQUENCIES.map(freq => (
              <TouchableOpacity
                key={freq.value}
                style={[styles.optionChip, rentFrequency === freq.value && styles.optionChipActive]}
                onPress={() => setRentFrequency(freq.value)}
              >
                <Text style={[styles.optionText, rentFrequency === freq.value && styles.optionTextActive]}>
                  {freq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            Due Day (1-{rentFrequency === 'weekly' ? '7' : rentFrequency === 'fortnightly' ? '14' : '28'})
          </Text>
          <TextInput
            style={styles.input}
            value={rentDueDay}
            onChangeText={setRentDueDay}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={THEME.colors.textTertiary}
          />
        </View>

        {/* Bond */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bond</Text>
          <Text style={styles.fieldLabel}>Bond Amount ($)</Text>
          <TextInput
            style={styles.input}
            value={bondAmount}
            onChangeText={setBondAmount}
            keyboardType="decimal-pad"
            placeholder="2600.00"
            placeholderTextColor={THEME.colors.textTertiary}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Any additional notes..."
            placeholderTextColor={THEME.colors.textTertiary}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, submitting && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          ) : (
            <Text style={styles.createButtonText}>Create Tenancy</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: THEME.colors.brand,
  },
  title: {
    fontSize: 20,
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
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  infoName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  infoDetail: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  optionChipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  optionText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  optionTextActive: {
    color: THEME.colors.textInverse,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  createButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: THEME.colors.error,
  },
});
