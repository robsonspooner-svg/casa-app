import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  Button,
  Input,
  Card,
  DatePicker,
  THEME,
} from '@casa/ui';
import {
  getSupabaseClient,
  useAuth,
  SUBSCRIPTION_TIERS,
} from '@casa/api';
import type {
  PropertyType,
  AutonomyPreset,
  SubscriptionTier,
} from '@casa/api';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'unit', label: 'Unit' },
  { value: 'townhouse', label: 'Townhouse' },
];

const AUTONOMY_OPTIONS: {
  value: AutonomyPreset;
  level: string;
  title: string;
  description: string;
  recommended: boolean;
}[] = [
  {
    value: 'cautious',
    level: 'Level 1',
    title: 'Cautious',
    description: 'I want to approve everything before it happens',
    recommended: false,
  },
  {
    value: 'balanced',
    level: 'Level 2',
    title: 'Balanced',
    description: 'Handle routine tasks, ask me for important decisions',
    recommended: true,
  },
  {
    value: 'hands_off',
    level: 'Level 3',
    title: 'Hands-Off',
    description: 'Manage everything, just keep me informed',
    recommended: false,
  },
];

const TOTAL_STEPS = 5;

const TIER_ORDER: SubscriptionTier[] = ['starter', 'pro', 'hands_off'];

function BackArrowIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke={THEME.colors.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="22" stroke={THEME.colors.success} strokeWidth={2.5} fill={THEME.colors.successBg} />
      <Path
        d="M15 24l6 6 12-12"
        stroke={THEME.colors.success}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function OnboardingSetupScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);

  // Step 1: Property Details
  const [address, setAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [postcode, setPostcode] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [bedrooms, setBedrooms] = useState('3');
  const [bathrooms, setBathrooms] = useState('1');
  const [rentAmount, setRentAmount] = useState('');
  const [rentDay, setRentDay] = useState('1');

  // Step 2: Tenant Details
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [leaseStart, setLeaseStart] = useState<Date | null>(null);
  const [leaseEnd, setLeaseEnd] = useState<Date | null>(null);
  const [bondAmount, setBondAmount] = useState('');

  // Step 3: Preferences
  const [autonomyPreset, setAutonomyPreset] = useState<AutonomyPreset>('balanced');

  // Step 4: Plan Selection
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('starter');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!address.trim()) newErrors.address = 'Address is required';
    if (!suburb.trim()) newErrors.suburb = 'Suburb is required';
    if (!stateValue.trim()) newErrors.state = 'State is required';
    if (!postcode.trim()) newErrors.postcode = 'Postcode is required';
    if (!rentAmount.trim() || isNaN(Number(rentAmount)) || Number(rentAmount) <= 0) {
      newErrors.rentAmount = 'Valid rent amount is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [address, suburb, stateValue, postcode, rentAmount]);

  const validateStep2 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!tenantName.trim()) newErrors.tenantName = 'Tenant name is required';
    if (!tenantEmail.trim()) {
      newErrors.tenantEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail.trim())) {
      newErrors.tenantEmail = 'Valid email is required';
    }
    if (!leaseStart) newErrors.leaseStart = 'Lease start date is required';
    if (!leaseEnd) newErrors.leaseEnd = 'Lease end date is required';
    if (leaseStart && leaseEnd && leaseEnd <= leaseStart) {
      newErrors.leaseEnd = 'End date must be after start date';
    }
    if (!bondAmount.trim() || isNaN(Number(bondAmount)) || Number(bondAmount) <= 0) {
      newErrors.bondAmount = 'Valid bond amount is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [tenantName, tenantEmail, leaseStart, leaseEnd, bondAmount]);

  const savePropertyAndTenancy = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      // Create property
      const { data: property, error: propertyError } = await (supabase
        .from('properties') as any)
        .insert({
          owner_id: user.id,
          address_line_1: address.trim(),
          suburb: suburb.trim(),
          state: stateValue.trim(),
          postcode: postcode.trim(),
          country: 'AU',
          property_type: propertyType,
          bedrooms: parseInt(bedrooms, 10) || 3,
          bathrooms: parseInt(bathrooms, 10) || 1,
          rent_amount: parseFloat(rentAmount),
          rent_frequency: 'weekly' as const,
          bond_amount: parseFloat(bondAmount) || null,
          status: 'occupied' as const,
        })
        .select('id')
        .single();

      if (propertyError) throw propertyError;
      if (!property) throw new Error('Failed to create property');

      setCreatedPropertyId(property.id);

      // Calculate lease term based on duration
      const startDate = leaseStart as Date;
      const endDate = leaseEnd as Date;
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth());
      let leaseTerm: '6_months' | '12_months' | '24_months' | 'flexible' = 'flexible';
      if (monthsDiff <= 6) leaseTerm = '6_months';
      else if (monthsDiff <= 12) leaseTerm = '12_months';
      else if (monthsDiff <= 24) leaseTerm = '24_months';

      // Create tenancy
      const { error: tenancyError } = await (supabase
        .from('tenancies') as any)
        .insert({
          property_id: property.id,
          lease_start_date: startDate.toISOString().split('T')[0],
          lease_end_date: endDate.toISOString().split('T')[0],
          lease_type: leaseTerm,
          rent_amount: parseFloat(rentAmount),
          rent_frequency: 'weekly' as const,
          rent_due_day: parseInt(rentDay, 10) || 1,
          bond_amount: parseFloat(bondAmount),
          bond_status: 'pending' as const,
          status: 'active' as const,
          notes: `Tenant: ${tenantName.trim()}, Email: ${tenantEmail.trim()}${tenantPhone.trim() ? `, Phone: ${tenantPhone.trim()}` : ''}`,
        });

      if (tenancyError) throw tenancyError;

      // Set autonomy preferences
      const { error: autonomyError } = await (supabase
        .from('agent_autonomy_settings') as any)
        .upsert({
          user_id: user.id,
          preset: autonomyPreset,
          category_overrides: {},
        }, { onConflict: 'user_id' });

      if (autonomyError) throw autonomyError;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', `Failed to save: ${message}`);
    } finally {
      setSaving(false);
    }
  }, [
    user, address, suburb, stateValue, postcode, propertyType,
    bedrooms, bathrooms, rentAmount, rentDay, tenantName, tenantEmail,
    tenantPhone, leaseStart, leaseEnd, bondAmount, autonomyPreset,
  ]);

  const createSubscription = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/manage-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'create', tier: selectedTier }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create subscription');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Subscription Error', `${message}\n\nYou can set up your subscription later in Settings.`);
    } finally {
      setSaving(false);
    }
  }, [user, selectedTier]);

  const handleNext = useCallback(async () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      await savePropertyAndTenancy();
      await createSubscription();
      // Mark onboarding complete immediately so the user doesn't loop
      // back if the app restarts before tapping "Start Managing"
      if (user) {
        const supabase = getSupabaseClient();
        await (supabase.from('profiles') as any)
          .update({ onboarding_completed: true })
          .eq('id', user.id);
      }
      setStep(5);
    }
  }, [step, validateStep1, validateStep2, savePropertyAndTenancy, createSubscription, user]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setErrors({});
      setStep(step - 1);
    } else {
      router.back();
    }
  }, [step]);

  const handleFinish = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Ensure onboarding_completed is set (may already be set from step 4)
      const supabase = getSupabaseClient();
      await (supabase.from('profiles') as any)
        .update({ onboarding_completed: true })
        .eq('id', user.id);
    } catch {
      // Non-blocking — the flag was already set in step 4
    }
    setSaving(false);
    router.replace('/(app)/(tabs)' as never);
  }, [user]);

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === step;
        const isCompleted = stepNum < step;
        return (
          <View key={i} style={styles.stepRow}>
            <View
              style={[
                styles.stepDot,
                isActive && styles.stepDotActive,
                isCompleted && styles.stepDotCompleted,
              ]}
            >
              <Text
                style={[
                  styles.stepDotText,
                  (isActive || isCompleted) && styles.stepDotTextActive,
                ]}
              >
                {isCompleted ? '\u2713' : stepNum}
              </Text>
            </View>
            {i < TOTAL_STEPS - 1 && (
              <View
                style={[
                  styles.stepLine,
                  isCompleted && styles.stepLineCompleted,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );

  const renderPropertyStep = () => (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.stepTitle}>Property Details</Text>
      <Text style={styles.stepSubtitle}>
        Tell us about your investment property
      </Text>

      <Input
        label="Street Address"
        placeholder="123 Main Street"
        value={address}
        onChangeText={(text) => { setAddress(text); setErrors(e => ({ ...e, address: '' })); }}
        error={errors.address}
        containerStyle={styles.fieldContainer}
        autoCapitalize="words"
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Input
            label="Suburb"
            placeholder="Richmond"
            value={suburb}
            onChangeText={(text) => { setSuburb(text); setErrors(e => ({ ...e, suburb: '' })); }}
            error={errors.suburb}
            containerStyle={styles.fieldContainer}
            autoCapitalize="words"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Input
            label="State"
            placeholder="VIC"
            value={stateValue}
            onChangeText={(text) => { setStateValue(text); setErrors(e => ({ ...e, state: '' })); }}
            error={errors.state}
            containerStyle={styles.fieldContainer}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.rowGap} />
        <View style={styles.flex1}>
          <Input
            label="Postcode"
            placeholder="3121"
            value={postcode}
            onChangeText={(text) => { setPostcode(text); setErrors(e => ({ ...e, postcode: '' })); }}
            error={errors.postcode}
            containerStyle={styles.fieldContainer}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Property Type</Text>
      <View style={styles.typeGrid}>
        {PROPERTY_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.typeOption,
              propertyType === type.value && styles.typeOptionSelected,
            ]}
            onPress={() => setPropertyType(type.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.typeOptionText,
                propertyType === type.value && styles.typeOptionTextSelected,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Input
            label="Bedrooms"
            value={bedrooms}
            onChangeText={setBedrooms}
            keyboardType="number-pad"
            containerStyle={styles.fieldContainer}
          />
        </View>
        <View style={styles.rowGap} />
        <View style={styles.flex1}>
          <Input
            label="Bathrooms"
            value={bathrooms}
            onChangeText={setBathrooms}
            keyboardType="number-pad"
            containerStyle={styles.fieldContainer}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Input
            label="Rent (weekly)"
            placeholder="550"
            value={rentAmount}
            onChangeText={(text) => { setRentAmount(text); setErrors(e => ({ ...e, rentAmount: '' })); }}
            error={errors.rentAmount}
            keyboardType="decimal-pad"
            containerStyle={styles.fieldContainer}
            leftIcon={<Text style={styles.currencyPrefix}>$</Text>}
          />
        </View>
        <View style={styles.rowGap} />
        <View style={styles.flex1}>
          <Input
            label="Rent Day"
            placeholder="1"
            value={rentDay}
            onChangeText={setRentDay}
            keyboardType="number-pad"
            containerStyle={styles.fieldContainer}
            hint="Day of week (1=Mon)"
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderTenantStep = () => (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.stepTitle}>Tenant Details</Text>
      <Text style={styles.stepSubtitle}>
        Tell us about your current tenant
      </Text>

      <Input
        label="Tenant Name"
        placeholder="Jane Smith"
        value={tenantName}
        onChangeText={(text) => { setTenantName(text); setErrors(e => ({ ...e, tenantName: '' })); }}
        error={errors.tenantName}
        containerStyle={styles.fieldContainer}
        autoCapitalize="words"
      />

      <Input
        label="Email"
        placeholder="jane@example.com"
        value={tenantEmail}
        onChangeText={(text) => { setTenantEmail(text); setErrors(e => ({ ...e, tenantEmail: '' })); }}
        error={errors.tenantEmail}
        containerStyle={styles.fieldContainer}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />

      <Input
        label="Phone (optional)"
        placeholder="0412 345 678"
        value={tenantPhone}
        onChangeText={setTenantPhone}
        containerStyle={styles.fieldContainer}
        keyboardType="phone-pad"
      />

      <DatePicker
        label="Lease Start Date"
        value={leaseStart}
        onChange={(date) => { setLeaseStart(date); setErrors(e => ({ ...e, leaseStart: '' })); }}
        error={errors.leaseStart}
        containerStyle={styles.fieldContainer}
      />

      <DatePicker
        label="Lease End Date"
        value={leaseEnd}
        onChange={(date) => { setLeaseEnd(date); setErrors(e => ({ ...e, leaseEnd: '' })); }}
        error={errors.leaseEnd}
        minimumDate={leaseStart || undefined}
        containerStyle={styles.fieldContainer}
      />

      <Input
        label="Bond Amount"
        placeholder="2200"
        value={bondAmount}
        onChangeText={(text) => { setBondAmount(text); setErrors(e => ({ ...e, bondAmount: '' })); }}
        error={errors.bondAmount}
        keyboardType="decimal-pad"
        containerStyle={styles.fieldContainer}
        leftIcon={<Text style={styles.currencyPrefix}>$</Text>}
      />
    </ScrollView>
  );

  const renderPreferencesStep = () => (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Your Preferences</Text>
      <Text style={styles.stepSubtitle}>
        How much should Casa handle on its own?
      </Text>

      {AUTONOMY_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.autonomyCard,
            autonomyPreset === option.value && styles.autonomyCardSelected,
          ]}
          onPress={() => setAutonomyPreset(option.value)}
          activeOpacity={0.7}
        >
          <View style={styles.autonomyHeader}>
            <View style={styles.autonomyTitleRow}>
              <Text style={styles.autonomyLevel}>{option.level}</Text>
              <Text
                style={[
                  styles.autonomyTitle,
                  autonomyPreset === option.value && styles.autonomyTitleSelected,
                ]}
              >
                {option.title}
              </Text>
            </View>
            {option.recommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recommended</Text>
              </View>
            )}
          </View>
          <Text style={styles.autonomyDescription}>{option.description}</Text>
          <View style={styles.radioRow}>
            <View
              style={[
                styles.radioOuter,
                autonomyPreset === option.value && styles.radioOuterSelected,
              ]}
            >
              {autonomyPreset === option.value && (
                <View style={styles.radioInner} />
              )}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderPlanStep = () => (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Choose Your Plan</Text>
      <Text style={styles.stepSubtitle}>
        Start with a 14-day free trial. Cancel anytime.
      </Text>

      {TIER_ORDER.map((tierId) => {
        const tier = SUBSCRIPTION_TIERS[tierId];
        const isSelected = selectedTier === tierId;

        return (
          <TouchableOpacity
            key={tierId}
            style={[
              styles.planCard,
              isSelected && styles.planCardSelected,
            ]}
            onPress={() => setSelectedTier(tierId)}
            activeOpacity={0.7}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                  {tier.name}
                </Text>
                <Text style={styles.planPrice}>{tier.priceFormatted}</Text>
              </View>
              {tierId === 'starter' && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>Most Popular</Text>
                </View>
              )}
            </View>

            <View style={styles.planFeatures}>
              {tier.features.map((feature) => (
                <View key={feature} style={styles.planFeatureRow}>
                  <Text style={styles.planFeatureCheck}>{'\u2713'}</Text>
                  <Text style={styles.planFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={styles.radioRow}>
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderCompletionStep = () => (
    <View style={styles.completionContainer}>
      <CheckCircleIcon />
      <Text style={styles.completionTitle}>All Set!</Text>
      <Text style={styles.completionSubtitle}>
        Your property is ready to be managed by Casa
      </Text>

      <Card variant="elevated" style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Property</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {address}, {suburb}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type</Text>
          <Text style={styles.summaryValue}>
            {PROPERTY_TYPES.find((t) => t.value === propertyType)?.label} - {bedrooms} bed, {bathrooms} bath
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rent</Text>
          <Text style={styles.summaryValue}>${rentAmount}/week</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tenant</Text>
          <Text style={styles.summaryValue}>{tenantName}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Lease</Text>
          <Text style={styles.summaryValue}>
            {leaseStart ? leaseStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} -{' '}
            {leaseEnd ? leaseEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>AI Mode</Text>
          <Text style={styles.summaryValue}>
            {AUTONOMY_OPTIONS.find((a) => a.value === autonomyPreset)?.title}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Plan</Text>
          <Text style={styles.summaryValue}>
            {SUBSCRIPTION_TIERS[selectedTier].name} ({SUBSCRIPTION_TIERS[selectedTier].priceFormatted})
          </Text>
        </View>
      </Card>
    </View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderPropertyStep();
      case 2: return renderTenantStep();
      case 3: return renderPreferencesStep();
      case 4: return renderPlanStep();
      case 5: return renderCompletionStep();
      default: return null;
    }
  };

  const stepTitles = ['Property Details', 'Tenant Details', 'Your Preferences', 'Choose Plan', 'All Set!'];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackArrowIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Step {step} of {TOTAL_STEPS}
        </Text>
        <View style={styles.backButton} />
      </View>

      {renderStepIndicator()}

      <View style={styles.body}>
        {renderCurrentStep()}
      </View>

      <View style={styles.footer}>
        {step < 5 ? (
          <View style={styles.footerButtons}>
            {step > 1 && (
              <Button
                title="Back"
                variant="secondary"
                onPress={handleBack}
                style={styles.footerBackButton}
                fullWidth={false}
              />
            )}
            <View style={styles.footerNextWrapper}>
              <Button
                title={step === 4 ? 'Start Free Trial' : 'Next'}
                onPress={handleNext}
                loading={saving}
                disabled={saving}
              />
            </View>
          </View>
        ) : (
          <Button
            title="Start Managing"
            onPress={handleFinish}
            loading={saving}
            disabled={saving}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
    paddingBottom: THEME.spacing.base,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.brand,
  },
  stepDotCompleted: {
    borderColor: THEME.colors.success,
    backgroundColor: THEME.colors.success,
  },
  stepDotText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
  },
  stepDotTextActive: {
    color: THEME.colors.textInverse,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: THEME.colors.border,
  },
  stepLineCompleted: {
    backgroundColor: THEME.colors.success,
  },
  body: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepContentInner: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl,
  },
  stepTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  stepSubtitle: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
  },
  fieldContainer: {
    marginBottom: THEME.spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  flex1: {
    flex: 1,
  },
  rowGap: {
    width: THEME.spacing.md,
  },
  sectionLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.xs,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.base,
  },
  typeOption: {
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.base,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  typeOptionSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.brand,
  },
  typeOptionText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  typeOptionTextSelected: {
    color: THEME.colors.textInverse,
  },
  currencyPrefix: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  // Autonomy cards
  autonomyCard: {
    padding: THEME.spacing.base,
    borderRadius: THEME.radius.lg,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    marginBottom: THEME.spacing.md,
  },
  autonomyCardSelected: {
    borderColor: THEME.colors.brand,
  },
  autonomyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.xs,
  },
  autonomyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  autonomyLevel: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  autonomyTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  autonomyTitleSelected: {
    color: THEME.colors.brand,
  },
  autonomyDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
    lineHeight: 18,
  },
  recommendedBadge: {
    backgroundColor: THEME.colors.successBg,
    paddingVertical: 2,
    paddingHorizontal: THEME.spacing.sm,
    borderRadius: THEME.radius.sm,
  },
  recommendedText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.success,
  },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: THEME.colors.brand,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.colors.brand,
  },
  // Plan selection step
  planCard: {
    padding: THEME.spacing.base,
    borderRadius: THEME.radius.lg,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    marginBottom: THEME.spacing.md,
  },
  planCardSelected: {
    borderColor: THEME.colors.brand,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  planName: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  planNameSelected: {
    color: THEME.colors.brand,
  },
  planPrice: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  planFeatures: {
    marginBottom: THEME.spacing.md,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: 4,
  },
  planFeatureCheck: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.success,
    fontWeight: THEME.fontWeight.semibold,
  },
  planFeatureText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  // Completion step
  completionContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing.xl,
  },
  completionTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.lg,
    marginBottom: THEME.spacing.xs,
  },
  completionSubtitle: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
  },
  summaryCard: {
    width: '100%',
  },
  summaryTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.base,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  summaryLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  summaryValue: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  // Footer
  footer: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.base,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  footerBackButton: {
    minWidth: 80,
  },
  footerNextWrapper: {
    flex: 1,
  },
});
