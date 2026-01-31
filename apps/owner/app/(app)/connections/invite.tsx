// Direct Invite Screen - Owner sends lease terms to tenant by email
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button } from '@casa/ui';
import { useProperties, useDirectInvite } from '@casa/api';

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function DirectInviteScreen() {
  const { properties } = useProperties();
  const { sendInvitation } = useDirectInvite();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [rentFrequency, setRentFrequency] = useState('weekly');
  const [bondWeeks, setBondWeeks] = useState('4');
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = selectedPropertyId && tenantEmail.trim() && rentAmount && Number(rentAmount) > 0;

  const handleSend = async () => {
    if (!canSend || !selectedPropertyId) return;

    setSending(true);
    const success = await sendInvitation({
      property_id: selectedPropertyId,
      tenant_email: tenantEmail.trim(),
      tenant_name: tenantName.trim() || undefined,
      rent_amount: Number(rentAmount),
      rent_frequency: rentFrequency,
      bond_weeks: bondWeeks ? Number(bondWeeks) : 4,
      lease_start_date: leaseStartDate || undefined,
      lease_end_date: leaseEndDate || undefined,
      message: message.trim() || undefined,
    });
    setSending(false);

    if (success) {
      Alert.alert(
        'Invitation Sent',
        `An invitation has been sent to ${tenantEmail.trim()}. They'll receive it when they log in to the Casa app.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } else {
      Alert.alert('Error', 'Failed to send invitation. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Tenant</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.description}>
            Invite a tenant directly with lease terms. They'll receive the invitation in their Casa app and can accept or decline.
          </Text>

          {/* Property Selection */}
          <Text style={styles.fieldLabel}>Property *</Text>
          <View style={styles.picker}>
            {properties.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.pickerOption,
                  selectedPropertyId === p.id && styles.pickerOptionSelected,
                ]}
                onPress={() => setSelectedPropertyId(p.id)}
              >
                <Text style={selectedPropertyId === p.id ? styles.pickerTextSelected : styles.pickerText}>
                  {p.address_line_1}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tenant Details */}
          <Text style={styles.fieldLabel}>Tenant Email *</Text>
          <TextInput
            style={styles.input}
            value={tenantEmail}
            onChangeText={setTenantEmail}
            placeholder="tenant@example.com"
            placeholderTextColor={THEME.colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Tenant Name</Text>
          <TextInput
            style={styles.input}
            value={tenantName}
            onChangeText={setTenantName}
            placeholder="John Smith"
            placeholderTextColor={THEME.colors.textTertiary}
          />

          {/* Lease Terms */}
          <Text style={styles.sectionTitle}>Lease Terms</Text>

          <Text style={styles.fieldLabel}>Rent Amount (AUD) *</Text>
          <TextInput
            style={styles.input}
            value={rentAmount}
            onChangeText={setRentAmount}
            placeholder="650"
            placeholderTextColor={THEME.colors.textTertiary}
            keyboardType="decimal-pad"
          />

          <Text style={styles.fieldLabel}>Rent Frequency</Text>
          <View style={styles.picker}>
            {FREQUENCY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pickerOption,
                  rentFrequency === opt.value && styles.pickerOptionSelected,
                ]}
                onPress={() => setRentFrequency(opt.value)}
              >
                <Text style={rentFrequency === opt.value ? styles.pickerTextSelected : styles.pickerText}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Bond (weeks)</Text>
          <TextInput
            style={styles.input}
            value={bondWeeks}
            onChangeText={setBondWeeks}
            placeholder="4"
            placeholderTextColor={THEME.colors.textTertiary}
            keyboardType="number-pad"
          />

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Lease Start (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={leaseStartDate}
                onChangeText={setLeaseStartDate}
                placeholder="2025-03-01"
                placeholderTextColor={THEME.colors.textTertiary}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Lease End (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={leaseEndDate}
                onChangeText={setLeaseEndDate}
                placeholder="2026-03-01"
                placeholderTextColor={THEME.colors.textTertiary}
              />
            </View>
          </View>

          {/* Message */}
          <Text style={styles.fieldLabel}>Personal Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Hi, I'd like to invite you to rent this property..."
            placeholderTextColor={THEME.colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Send Button */}
          <View style={styles.buttonContainer}>
            <Button
              title={sending ? 'Sending...' : 'Send Invitation'}
              onPress={handleSend}
              disabled={!canSend || sending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  flex: {
    flex: 1,
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
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  content: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  description: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    marginBottom: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.xl,
    marginBottom: THEME.spacing.md,
  },
  fieldLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
  },
  input: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  textArea: {
    height: 100,
    paddingTop: THEME.spacing.md,
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  pickerOption: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  pickerText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
  },
  pickerTextSelected: {
    fontSize: THEME.fontSize.bodySmall,
    color: '#FFFFFF',
    fontWeight: THEME.fontWeight.medium,
  },
  dateRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  dateField: {
    flex: 1,
  },
  buttonContainer: {
    marginTop: THEME.spacing.xl,
  },
});
