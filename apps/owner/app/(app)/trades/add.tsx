// Add Trade Manually
// Mission 10: Tradesperson Network
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, Input, Checkbox } from '@casa/ui';
import { useTradeMutations } from '@casa/api';
import type { MaintenanceCategory } from '@casa/api';

const CATEGORY_OPTIONS: { value: MaintenanceCategory; label: string }[] = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'structural', label: 'Structural' },
  { value: 'pest', label: 'Pest Control' },
  { value: 'locks_security', label: 'Locks & Security' },
  { value: 'garden_outdoor', label: 'Garden & Outdoor' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
];

interface FormState {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  abn: string;
  categories: MaintenanceCategory[];
  service_areas: string;
  available_weekdays: boolean;
  available_weekends: boolean;
  available_after_hours: boolean;
}

const INITIAL_FORM: FormState = {
  business_name: '',
  contact_name: '',
  email: '',
  phone: '',
  abn: '',
  categories: [],
  service_areas: '',
  available_weekdays: true,
  available_weekends: false,
  available_after_hours: false,
};

export default function AddTrade() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const { addTrade } = useTradeMutations();

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors],
  );

  const toggleCategory = useCallback(
    (cat: MaintenanceCategory) => {
      setForm((prev) => {
        const exists = prev.categories.includes(cat);
        return {
          ...prev,
          categories: exists
            ? prev.categories.filter((c) => c !== cat)
            : [...prev.categories, cat],
        };
      });
      if (errors.categories) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.categories;
          return next;
        });
      }
    },
    [errors],
  );

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.business_name.trim()) {
      newErrors.business_name = 'Business name is required';
    }
    if (!form.contact_name.trim()) {
      newErrors.contact_name = 'Contact name is required';
    }
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (form.categories.length === 0) {
      newErrors.categories = 'Select at least one category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const serviceAreas = form.service_areas
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await addTrade({
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        abn: form.abn.trim() || null,
        categories: form.categories,
        service_areas: serviceAreas.length > 0 ? serviceAreas : null,
        available_weekdays: form.available_weekdays,
        available_weekends: form.available_weekends,
        available_after_hours: form.available_after_hours,
      });

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add trade';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  }, [form, validate, addTrade]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke={THEME.colors.textPrimary}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Trade</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Business details */}
          <Text style={styles.sectionTitle}>Business Details</Text>

          <Input
            label="Business Name"
            placeholder="e.g. Smith Plumbing"
            value={form.business_name}
            onChangeText={(val) => updateField('business_name', val)}
            error={errors.business_name}
            autoCapitalize="words"
            containerStyle={styles.fieldSpacing}
          />

          <Input
            label="Contact Name"
            placeholder="e.g. John Smith"
            value={form.contact_name}
            onChangeText={(val) => updateField('contact_name', val)}
            error={errors.contact_name}
            autoCapitalize="words"
            containerStyle={styles.fieldSpacing}
          />

          <Input
            label="Email"
            placeholder="john@smithplumbing.com.au"
            value={form.email}
            onChangeText={(val) => updateField('email', val)}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={styles.fieldSpacing}
          />

          <Input
            label="Phone"
            placeholder="0412 345 678"
            value={form.phone}
            onChangeText={(val) => updateField('phone', val)}
            error={errors.phone}
            keyboardType="phone-pad"
            containerStyle={styles.fieldSpacing}
          />

          <Input
            label="ABN (Optional)"
            placeholder="12 345 678 901"
            value={form.abn}
            onChangeText={(val) => updateField('abn', val)}
            keyboardType="number-pad"
            containerStyle={styles.fieldSpacing}
          />

          {/* Categories */}
          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
            Categories
          </Text>
          {errors.categories && (
            <Text style={styles.categoryError}>{errors.categories}</Text>
          )}
          <View style={styles.categoryGrid}>
            {CATEGORY_OPTIONS.map((opt) => {
              const isSelected = form.categories.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                  ]}
                  onPress={() => toggleCategory(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Service areas */}
          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
            Service Areas
          </Text>
          <Input
            label="Areas Serviced"
            placeholder="e.g. Sydney CBD, Inner West, Eastern Suburbs"
            value={form.service_areas}
            onChangeText={(val) => updateField('service_areas', val)}
            hint="Comma-separated list of suburbs or regions"
            autoCapitalize="words"
            containerStyle={styles.fieldSpacing}
          />

          {/* Availability */}
          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
            Availability
          </Text>
          <View style={styles.checkboxGroup}>
            <Checkbox
              checked={form.available_weekdays}
              onChange={(val) => updateField('available_weekdays', val)}
              label="Weekdays"
            />
            <Checkbox
              checked={form.available_weekends}
              onChange={(val) => updateField('available_weekends', val)}
              label="Weekends"
            />
            <Checkbox
              checked={form.available_after_hours}
              onChange={(val) => updateField('available_after_hours', val)}
              label="After Hours"
            />
          </View>

          {/* Submit */}
          <View style={styles.submitContainer}>
            <Button
              title={submitting ? 'Adding...' : 'Add Trade'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
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
  formContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  sectionSpacing: {
    marginTop: THEME.spacing.lg,
  },
  fieldSpacing: {
    marginBottom: THEME.spacing.base,
  },
  categoryError: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.error,
    marginBottom: THEME.spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  categoryChipSelected: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  categoryChipText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  categoryChipTextSelected: {
    color: THEME.colors.textInverse,
  },
  checkboxGroup: {
    gap: THEME.spacing.xs,
  },
  submitContainer: {
    marginTop: THEME.spacing.xl,
  },
});
