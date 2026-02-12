// Renew Lease Screen - Owner App
// Mission 06: Tenancies & Leases

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
import { useTenancy, useTenancyMutations, LeaseTerm, PaymentFrequency } from '@casa/api';

const LEASE_TERMS: { label: string; value: LeaseTerm }[] = [
  { label: '6 months', value: '6_months' },
  { label: '12 months', value: '12_months' },
  { label: '24 months', value: '24_months' },
];

export default function RenewLeaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading } = useTenancy(id || null);
  const { updateTenancy } = useTenancyMutations();

  const [newLeaseType, setNewLeaseType] = useState<LeaseTerm>('12_months');
  const [newRentAmount, setNewRentAmount] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tenancy) {
      setNewRentAmount(String(tenancy.rent_amount));
      setNewLeaseType(tenancy.lease_type);

      // Calculate new end date based on current end date + new term
      const currentEnd = new Date(tenancy.lease_end_date);
      const newEnd = new Date(currentEnd);
      if (newLeaseType === '6_months') newEnd.setMonth(newEnd.getMonth() + 6);
      else if (newLeaseType === '24_months') newEnd.setMonth(newEnd.getMonth() + 24);
      else newEnd.setMonth(newEnd.getMonth() + 12);
      setNewEndDate(newEnd.toISOString().split('T')[0]);
    }
  }, [tenancy]);

  useEffect(() => {
    if (tenancy) {
      const currentEnd = new Date(tenancy.lease_end_date);
      const newEnd = new Date(currentEnd);
      if (newLeaseType === '6_months') newEnd.setMonth(newEnd.getMonth() + 6);
      else if (newLeaseType === '24_months') newEnd.setMonth(newEnd.getMonth() + 24);
      else newEnd.setMonth(newEnd.getMonth() + 12);
      setNewEndDate(newEnd.toISOString().split('T')[0]);
    }
  }, [newLeaseType, tenancy]);

  const handleRenew = async () => {
    if (!tenancy) return;

    const rent = parseFloat(newRentAmount);
    if (isNaN(rent) || rent <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid rent amount.');
      return;
    }

    Alert.alert(
      'Confirm Renewal',
      `Renew lease until ${new Date(newEndDate).toLocaleDateString('en-AU')} at $${rent}/${tenancy.rent_frequency}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew',
          onPress: async () => {
            setSubmitting(true);
            try {
              await updateTenancy(tenancy.id, {
                lease_end_date: newEndDate,
                lease_type: newLeaseType,
                rent_amount: rent,
                is_periodic: false,
                status: 'active',
                notice_given_date: null,
              });
              Alert.alert('Lease Renewed', 'The lease has been renewed successfully.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to renew');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
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
        <Text style={styles.title}>Renew Lease</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.currentInfo}>
          <Text style={styles.currentLabel}>Current lease ends</Text>
          <Text style={styles.currentValue}>
            {tenancy ? new Date(tenancy.lease_end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New Lease Term</Text>
          <View style={styles.optionRow}>
            {LEASE_TERMS.map(term => (
              <TouchableOpacity
                key={term.value}
                style={[styles.optionChip, newLeaseType === term.value && styles.optionChipActive]}
                onPress={() => setNewLeaseType(term.value)}
              >
                <Text style={[styles.optionText, newLeaseType === term.value && styles.optionTextActive]}>
                  {term.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New End Date</Text>
          <TextInput
            style={styles.input}
            value={newEndDate}
            onChangeText={setNewEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={THEME.colors.textTertiary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rent Amount ($/{tenancy?.rent_frequency})</Text>
          <TextInput
            style={styles.input}
            value={newRentAmount}
            onChangeText={setNewRentAmount}
            keyboardType="decimal-pad"
            placeholder="650.00"
            placeholderTextColor={THEME.colors.textTertiary}
          />
          {tenancy && parseFloat(newRentAmount) > tenancy.rent_amount && (
            <Text style={styles.increaseNote}>
              +${(parseFloat(newRentAmount) - tenancy.rent_amount).toFixed(2)}/{tenancy.rent_frequency} increase
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.renewButton, submitting && styles.buttonDisabled]}
          onPress={handleRenew}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          ) : (
            <Text style={styles.renewButtonText}>Renew Lease</Text>
          )}
        </TouchableOpacity>
      </View>
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
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  currentInfo: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: THEME.colors.border, alignItems: 'center' },
  currentLabel: { fontSize: 13, color: THEME.colors.textSecondary, marginBottom: 4 },
  currentValue: { fontSize: 18, fontWeight: '700', color: THEME.colors.textPrimary },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 12 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: THEME.radius.full, backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.border },
  optionChipActive: { backgroundColor: THEME.colors.brand, borderColor: THEME.colors.brand },
  optionText: { fontSize: 14, color: THEME.colors.textSecondary, fontWeight: '500' },
  optionTextActive: { color: THEME.colors.textInverse },
  input: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: THEME.colors.textPrimary, borderWidth: 1, borderColor: THEME.colors.border },
  increaseNote: { fontSize: 13, color: THEME.colors.warning, fontWeight: '500', marginTop: 8 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  renewButton: { backgroundColor: THEME.colors.brand, borderRadius: THEME.radius.md, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  renewButtonText: { color: THEME.colors.textInverse, fontSize: 16, fontWeight: '700' },
});
