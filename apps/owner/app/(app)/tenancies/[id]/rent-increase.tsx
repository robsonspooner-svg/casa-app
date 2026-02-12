// Rent Increase Screen - Owner App
// Mission 06: Tenancies & Leases

import { useState, useMemo } from 'react';
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
import {
  useTenancy,
  useTenancyMutations,
  RENT_INCREASE_RULES,
  calculateMinimumEffectiveDate,
  canIncreaseRent,
} from '@casa/api';

export default function RentIncreaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading } = useTenancy(id || null);
  const { createRentIncrease } = useTenancyMutations();

  const [newAmount, setNewAmount] = useState('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const state = tenancy?.property?.state || 'NSW';
  const rules = RENT_INCREASE_RULES[state];

  const lastIncrease = tenancy?.rent_increases?.[0];
  const lastIncreaseDate = lastIncrease ? new Date(lastIncrease.effective_date) : null;

  const eligibility = useMemo(() => {
    if (!tenancy) return { allowed: false, reason: 'Loading...' };
    return canIncreaseRent(
      state,
      lastIncreaseDate,
      tenancy.is_periodic,
      !tenancy.is_periodic
    );
  }, [tenancy, state, lastIncreaseDate]);

  const newAmountNum = parseFloat(newAmount) || 0;
  const currentAmount = tenancy?.rent_amount || 0;
  const increasePercentage = currentAmount > 0
    ? ((newAmountNum - currentAmount) / currentAmount * 100).toFixed(1)
    : '0';

  const minimumEffectiveDate = useMemo(() => {
    if (!rules) return null;
    return calculateMinimumEffectiveDate(state, new Date());
  }, [state, rules]);

  const handleSubmit = async () => {
    if (!tenancy || !minimumEffectiveDate) return;

    if (!newAmount || newAmountNum <= currentAmount) {
      Alert.alert('Invalid Amount', 'New rent must be higher than current rent.');
      return;
    }

    if (!eligibility.allowed) {
      Alert.alert('Not Allowed', eligibility.reason || 'Cannot increase rent at this time.');
      return;
    }

    setSubmitting(true);
    try {
      await createRentIncrease({
        tenancy_id: tenancy.id,
        current_amount: currentAmount,
        new_amount: newAmountNum,
        notice_date: new Date().toISOString().split('T')[0],
        effective_date: minimumEffectiveDate.toISOString().split('T')[0],
        minimum_notice_days: rules.minimumNoticeDays,
        justification: justification || undefined,
      });

      Alert.alert(
        'Rent Increase Created',
        `A draft rent increase notice has been created. The tenant will be notified once you send it.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create rent increase');
    } finally {
      setSubmitting(false);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Rent Increase</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* State Rules Info */}
        <View style={styles.rulesBox}>
          <Text style={styles.rulesTitle}>{state} Rent Increase Rules</Text>
          <Text style={styles.rulesText}>Minimum notice: {rules?.minimumNoticeDays} days</Text>
          <Text style={styles.rulesText}>Max frequency: Once every {rules?.maxFrequency === '12_months' ? '12' : '6'} months</Text>
          <Text style={styles.rulesText}>Tribunal: {rules?.tribunal}</Text>
        </View>

        {!eligibility.allowed && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{eligibility.reason}</Text>
            {eligibility.nextAllowedDate && (
              <Text style={styles.warningDate}>
                Next allowed: {eligibility.nextAllowedDate.toLocaleDateString('en-AU')}
              </Text>
            )}
          </View>
        )}

        {/* Current vs New */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proposed Increase</Text>

          <View style={styles.comparisonRow}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>Current</Text>
              <Text style={styles.comparisonValue}>${currentAmount}</Text>
              <Text style={styles.comparisonFreq}>/{tenancy?.rent_frequency}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>New</Text>
              <TextInput
                style={styles.amountInput}
                value={newAmount}
                onChangeText={setNewAmount}
                keyboardType="decimal-pad"
                placeholder={String(currentAmount + 20)}
                placeholderTextColor={THEME.colors.textTertiary}
              />
              <Text style={styles.comparisonFreq}>/{tenancy?.rent_frequency}</Text>
            </View>
          </View>

          {newAmountNum > currentAmount && (
            <View style={styles.percentageRow}>
              <Text style={styles.percentageLabel}>Increase:</Text>
              <Text style={styles.percentageValue}>+{increasePercentage}% (${(newAmountNum - currentAmount).toFixed(2)}/week more)</Text>
            </View>
          )}
        </View>

        {/* Effective Date */}
        {minimumEffectiveDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            <View style={styles.timelineInfo}>
              <Text style={styles.timelineLabel}>Notice sent:</Text>
              <Text style={styles.timelineValue}>Today</Text>
            </View>
            <View style={styles.timelineInfo}>
              <Text style={styles.timelineLabel}>Earliest effective:</Text>
              <Text style={styles.timelineValue}>
                {minimumEffectiveDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>
        )}

        {/* Justification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Justification (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={justification}
            onChangeText={setJustification}
            multiline
            numberOfLines={3}
            placeholder="Market rates, CPI increase, property improvements..."
            placeholderTextColor={THEME.colors.textTertiary}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!eligibility.allowed || submitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!eligibility.allowed || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          ) : (
            <Text style={styles.submitButtonText}>Create Draft Notice</Text>
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
  rulesBox: { backgroundColor: THEME.colors.infoBg, borderRadius: THEME.radius.md, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: THEME.colors.info + '40' },
  rulesTitle: { fontSize: 14, fontWeight: '700', color: THEME.colors.info, marginBottom: 8 },
  rulesText: { fontSize: 13, color: THEME.colors.info, marginBottom: 4 },
  warningBox: { backgroundColor: THEME.colors.errorBg, borderRadius: THEME.radius.md, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: THEME.colors.error + '40' },
  warningText: { fontSize: 14, color: THEME.colors.error, fontWeight: '500' },
  warningDate: { fontSize: 13, color: THEME.colors.error, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 12 },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 20, borderWidth: 1, borderColor: THEME.colors.border },
  comparisonItem: { alignItems: 'center' },
  comparisonLabel: { fontSize: 12, color: THEME.colors.textTertiary, marginBottom: 4 },
  comparisonValue: { fontSize: 24, fontWeight: '700', color: THEME.colors.textPrimary },
  comparisonFreq: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2 },
  arrow: { fontSize: 24, color: THEME.colors.textTertiary },
  amountInput: { fontSize: 24, fontWeight: '700', color: THEME.colors.brand, textAlign: 'center', minWidth: 80, borderBottomWidth: 2, borderBottomColor: THEME.colors.brand, paddingVertical: 4 },
  percentageRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  percentageLabel: { fontSize: 14, color: THEME.colors.textSecondary },
  percentageValue: { fontSize: 14, fontWeight: '600', color: THEME.colors.warning },
  timelineInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  timelineLabel: { fontSize: 14, color: THEME.colors.textSecondary },
  timelineValue: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary },
  input: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: THEME.colors.textPrimary, borderWidth: 1, borderColor: THEME.colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  submitButton: { backgroundColor: THEME.colors.brand, borderRadius: THEME.radius.md, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  submitButtonText: { color: THEME.colors.textInverse, fontSize: 16, fontWeight: '700' },
});
