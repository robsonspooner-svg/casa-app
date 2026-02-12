// Tenancy Edit Screen - Owner App
// Mission 06: Tenancies & Leases

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useTenancy, useTenancyMutations, PaymentFrequency } from '@casa/api';

const FREQUENCY_OPTIONS: { value: PaymentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function TenancyEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading, error } = useTenancy(id || null);
  const { updateTenancy } = useTenancyMutations();
  const [saving, setSaving] = useState(false);

  const [rentAmount, setRentAmount] = useState('');
  const [rentFrequency, setRentFrequency] = useState<PaymentFrequency>('weekly');
  const [rentDueDay, setRentDueDay] = useState('');
  const [bondAmount, setBondAmount] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (tenancy) {
      setRentAmount(String(tenancy.rent_amount));
      setRentFrequency(tenancy.rent_frequency);
      setRentDueDay(String(tenancy.rent_due_day));
      setBondAmount(String(tenancy.bond_amount));
      setLeaseEndDate(tenancy.lease_end_date);
      setNotes(tenancy.notes || '');
    }
  }, [tenancy]);

  const handleSave = async () => {
    if (!tenancy) return;

    const amount = parseFloat(rentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid rent amount');
      return;
    }

    const dueDay = parseInt(rentDueDay);
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 28) {
      Alert.alert('Error', 'Rent due day must be between 1 and 28');
      return;
    }

    const bond = parseFloat(bondAmount);
    if (isNaN(bond) || bond < 0) {
      Alert.alert('Error', 'Please enter a valid bond amount');
      return;
    }

    setSaving(true);
    try {
      await updateTenancy(tenancy.id, {
        rent_amount: amount,
        rent_frequency: rentFrequency,
        rent_due_day: dueDay,
        bond_amount: bond,
        lease_end_date: leaseEndDate,
        notes: notes || null,
      });
      Alert.alert('Success', 'Tenancy updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update tenancy');
    } finally {
      setSaving(false);
    }
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

  if (error || !tenancy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'Tenancy not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Tenancy</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rent</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount ($)</Text>
            <TextInput
              style={styles.input}
              value={rentAmount}
              onChangeText={setRentAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={THEME.colors.textTertiary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.segmentedControl}>
              {FREQUENCY_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.segmentButton,
                    rentFrequency === option.value && styles.segmentButtonActive,
                  ]}
                  onPress={() => setRentFrequency(option.value)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      rentFrequency === option.value && styles.segmentTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Due Day (1-28)</Text>
            <TextInput
              style={styles.input}
              value={rentDueDay}
              onChangeText={setRentDueDay}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={THEME.colors.textTertiary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bond</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bond Amount ($)</Text>
            <TextInput
              style={styles.input}
              value={bondAmount}
              onChangeText={setBondAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={THEME.colors.textTertiary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lease</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={leaseEndDate}
              onChangeText={setLeaseEndDate}
              placeholder="2025-12-31"
              placeholderTextColor={THEME.colors.textTertiary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholder="Additional notes..."
            placeholderTextColor={THEME.colors.textTertiary}
            textAlignVertical="top"
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
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    paddingVertical: 4,
  },
  backText: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  saveButton: {
    paddingVertical: 4,
  },
  saveText: {
    fontSize: 16,
    color: THEME.colors.brand,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: THEME.colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: THEME.colors.brand,
  },
  segmentText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  segmentTextActive: {
    color: THEME.colors.textInverse,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: THEME.colors.error,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  retryText: {
    color: THEME.colors.textInverse,
    fontWeight: '600',
  },
});
