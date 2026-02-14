// Terminate Tenancy Screen - Owner App
// Mission 06: Tenancies & Leases

import { useState } from 'react';
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
import { useTenancy, useTenancyMutations, TERMINATION_NOTICE_PERIODS } from '@casa/api';

const END_REASONS = [
  'End of fixed term',
  'Mutual agreement',
  'Breach of lease',
  'Non-payment of rent',
  'Property sale',
  'Owner moving in',
  'Other',
];

export default function TerminateTenancyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading } = useTenancy(id || null);
  const { updateTenancyStatus } = useTenancyMutations();

  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const state = tenancy?.property?.state || 'NSW';
  const noticePeriod = TERMINATION_NOTICE_PERIODS[state];

  const handleTerminate = async () => {
    if (!tenancy) return;
    const finalReason = reason === 'Other' ? customReason : reason;
    if (!finalReason) {
      Alert.alert('Required', 'Please select a reason for termination.');
      return;
    }

    Alert.alert(
      'Confirm Termination',
      `This will end the tenancy and mark the property as vacant. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await updateTenancyStatus(tenancy.id, 'terminated', finalReason);
              Alert.alert('Tenancy Terminated', 'The tenancy has been ended.', [
                { text: 'OK', onPress: () => router.replace('/(app)/tenancies' as any) },
              ]);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to terminate');
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
        <Text style={styles.title}>End Tenancy</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {noticePeriod && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Notice Requirements ({state})</Text>
            <Text style={styles.noticeText}>No grounds: {noticePeriod.noGrounds} days</Text>
            <Text style={styles.noticeText}>End of lease: {noticePeriod.endOfLease} days</Text>
            <Text style={styles.noticeText}>Breach: {noticePeriod.breach} days</Text>
            {reason && (() => {
              const days = reason === 'Breach of lease' || reason === 'Non-payment of rent'
                ? noticePeriod.breach
                : reason === 'End of fixed term'
                  ? noticePeriod.endOfLease
                  : noticePeriod.noGrounds;
              const earliest = new Date();
              earliest.setDate(earliest.getDate() + days);
              return (
                <Text style={[styles.noticeText, { fontWeight: '600', marginTop: 8 }]}>
                  Earliest end date: {earliest.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              );
            })()}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Termination</Text>
          {END_REASONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.reasonOption, reason === r && styles.reasonOptionActive]}
              onPress={() => setReason(r)}
            >
              <View style={[styles.radio, reason === r && styles.radioActive]} />
              <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}

          {reason === 'Other' && (
            <TextInput
              style={styles.input}
              value={customReason}
              onChangeText={setCustomReason}
              placeholder="Specify reason..."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.terminateButton, submitting && styles.buttonDisabled]}
          onPress={handleTerminate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          ) : (
            <Text style={styles.terminateButtonText}>End Tenancy</Text>
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
  noticeBox: { backgroundColor: THEME.colors.warningBg, borderRadius: THEME.radius.md, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: THEME.colors.warning + '40' },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: THEME.colors.warning, marginBottom: 8 },
  noticeText: { fontSize: 13, color: THEME.colors.warning, marginBottom: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 12 },
  reasonOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: THEME.radius.md, marginBottom: 8, backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.border },
  reasonOptionActive: { borderColor: THEME.colors.brand, backgroundColor: `${THEME.colors.brand}08` },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: THEME.colors.border, marginRight: 12 },
  radioActive: { borderColor: THEME.colors.brand, backgroundColor: THEME.colors.brand },
  reasonText: { fontSize: 15, color: THEME.colors.textPrimary },
  reasonTextActive: { fontWeight: '600' },
  input: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: THEME.colors.textPrimary, borderWidth: 1, borderColor: THEME.colors.border, marginTop: 12, minHeight: 60, textAlignVertical: 'top' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  terminateButton: { backgroundColor: THEME.colors.error, borderRadius: THEME.radius.md, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  terminateButtonText: { color: THEME.colors.textInverse, fontSize: 16, fontWeight: '700' },
});
