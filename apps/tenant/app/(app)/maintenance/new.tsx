// Submit New Maintenance Request - Tenant
// Mission 09: Maintenance Requests
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button } from '@casa/ui';
import { useMyTenancy, useMaintenanceMutations } from '@casa/api';
import type { MaintenanceCategory, MaintenanceUrgency } from '@casa/api';

const CATEGORIES: { value: MaintenanceCategory; label: string; icon: string }[] = [
  { value: 'plumbing', label: 'Plumbing', icon: 'water' },
  { value: 'electrical', label: 'Electrical', icon: 'bolt' },
  { value: 'appliance', label: 'Appliance', icon: 'device' },
  { value: 'hvac', label: 'Heating/Cooling', icon: 'temp' },
  { value: 'structural', label: 'Structural', icon: 'building' },
  { value: 'pest', label: 'Pest Control', icon: 'bug' },
  { value: 'locks_security', label: 'Locks & Security', icon: 'lock' },
  { value: 'garden_outdoor', label: 'Garden & Outdoor', icon: 'tree' },
  { value: 'cleaning', label: 'Cleaning', icon: 'clean' },
  { value: 'other', label: 'Other', icon: 'other' },
];

const URGENCY_OPTIONS: { value: MaintenanceUrgency; label: string; description: string; color: string }[] = [
  { value: 'emergency', label: 'Emergency', description: 'Immediate attention needed (water leak, no power, security issue)', color: THEME.colors.error },
  { value: 'urgent', label: 'Urgent', description: 'Needs attention within 24-48 hours', color: THEME.colors.warning },
  { value: 'routine', label: 'Routine', description: 'Standard maintenance - can be scheduled', color: THEME.colors.textSecondary },
];

const LOCATIONS = [
  'Kitchen', 'Bathroom', 'Master Bedroom', 'Bedroom 2', 'Bedroom 3',
  'Living Room', 'Dining Room', 'Laundry', 'Garage', 'Backyard',
  'Front Yard', 'Hallway', 'Balcony', 'Whole Property', 'Other',
];

export default function NewMaintenanceScreen() {
  const { tenancy } = useMyTenancy();
  const { createRequest } = useMaintenanceMutations();

  const [category, setCategory] = useState<MaintenanceCategory | null>(null);
  const [urgency, setUrgency] = useState<MaintenanceUrgency>('routine');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [preferredTimes, setPreferredTimes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = category && title.trim() && description.trim() && tenancy;

  const handleSubmit = async () => {
    if (!canSubmit || !tenancy) return;

    setSubmitting(true);
    try {
      const requestId = await createRequest({
        tenancy_id: tenancy.id,
        property_id: tenancy.property_id,
        category: category!,
        urgency,
        title: title.trim(),
        description: description.trim(),
        location_in_property: location || undefined,
        access_instructions: accessInstructions.trim() || undefined,
        preferred_times: preferredTimes.trim() || undefined,
      });

      if (requestId) {
        Alert.alert(
          'Request Submitted',
          urgency === 'emergency'
            ? 'Your emergency request has been submitted. Your property manager will be notified immediately.'
            : 'Your maintenance request has been submitted. Your property manager will review it shortly.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tenancy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Request</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No Active Tenancy</Text>
          <Text style={styles.emptySubtext}>
            You need an active tenancy to submit a maintenance request.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Request</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Category Selection */}
          <Text style={styles.sectionTitle}>What needs fixing?</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.categoryCard, category === cat.value && styles.categoryCardSelected]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={[styles.categoryLabel, category === cat.value && styles.categoryLabelSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Urgency */}
          <Text style={styles.sectionTitle}>How urgent is it?</Text>
          {URGENCY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.urgencyOption, urgency === opt.value && styles.urgencyOptionSelected]}
              onPress={() => setUrgency(opt.value)}
            >
              <View style={styles.urgencyHeader}>
                <View style={[styles.urgencyDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.urgencyLabel, urgency === opt.value && styles.urgencyLabelSelected]}>
                  {opt.label}
                </Text>
              </View>
              <Text style={styles.urgencyDesc}>{opt.description}</Text>
            </TouchableOpacity>
          ))}

          {/* Title */}
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Brief description of the issue"
            placeholderTextColor={THEME.colors.textTertiary}
            maxLength={100}
          />

          {/* Description */}
          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue in detail. When did it start? How bad is it?"
            placeholderTextColor={THEME.colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Location */}
          <Text style={styles.fieldLabel}>Location in Property</Text>
          <View style={styles.locationGrid}>
            {LOCATIONS.map(loc => (
              <TouchableOpacity
                key={loc}
                style={[styles.locationChip, location === loc && styles.locationChipSelected]}
                onPress={() => setLocation(location === loc ? '' : loc)}
              >
                <Text style={[styles.locationChipText, location === loc && styles.locationChipTextSelected]}>
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Access Instructions */}
          <Text style={styles.fieldLabel}>Access Instructions</Text>
          <TextInput
            style={styles.input}
            value={accessInstructions}
            onChangeText={setAccessInstructions}
            placeholder="e.g., Key in lockbox, pet in backyard"
            placeholderTextColor={THEME.colors.textTertiary}
          />

          {/* Preferred Times */}
          <Text style={styles.fieldLabel}>Preferred Times</Text>
          <TextInput
            style={styles.input}
            value={preferredTimes}
            onChangeText={setPreferredTimes}
            placeholder="e.g., Weekday mornings, after 2pm"
            placeholderTextColor={THEME.colors.textTertiary}
          />

          {/* Submit */}
          <View style={styles.submitContainer}>
            <Button
              title={submitting ? 'Submitting...' : 'Submit Request'}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              loading={submitting}
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
    paddingBottom: THEME.spacing.xl * 3,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  categoryCard: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  categoryCardSelected: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  categoryLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  categoryLabelSelected: {
    color: THEME.colors.textInverse,
  },
  urgencyOption: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  urgencyOptionSelected: {
    borderColor: THEME.colors.brand,
    borderWidth: 2,
  },
  urgencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.xs,
  },
  urgencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  urgencyLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  urgencyLabelSelected: {
    color: THEME.colors.brand,
  },
  urgencyDesc: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginLeft: 18,
  },
  fieldLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.lg,
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
    height: 120,
    paddingTop: THEME.spacing.md,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  locationChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  locationChipSelected: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  locationChipText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
  },
  locationChipTextSelected: {
    color: THEME.colors.textInverse,
    fontWeight: THEME.fontWeight.medium,
  },
  submitContainer: {
    marginTop: THEME.spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  emptySubtext: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
});
