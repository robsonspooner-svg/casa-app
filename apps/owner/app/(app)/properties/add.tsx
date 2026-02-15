// Add Property Wizard - Mission 03: Properties CRUD
// Multi-step form for adding a new property
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  Button,
  Input,
  ScreenContainer,
  StepIndicator,
  UpgradePrompt,
  THEME,
} from '@casa/ui';
import {
  usePropertyMutations,
  useProperties,
  useProfile,
  useFeatureGate,
  useAuth,
  sendOwnerWelcomeMessage,
  PropertyType,
  PaymentFrequency,
} from '@casa/api';

const STEPS = ['Address', 'Details', 'Financials', 'Review'];

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'unit', label: 'Unit' },
  { value: 'studio', label: 'Studio' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

const AUSTRALIAN_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

// Form data type
interface PropertyFormData {
  addressLine1: string;
  addressLine2: string;
  suburb: string;
  state: string;
  postcode: string;
  propertyType: PropertyType;
  bedrooms: string;
  bathrooms: string;
  parkingSpaces: string;
  landSizeSqm: string;
  floorSizeSqm: string;
  yearBuilt: string;
  rentAmount: string;
  rentFrequency: PaymentFrequency;
  bondAmount: string;
  notes: string;
}

const initialFormData: PropertyFormData = {
  addressLine1: '',
  addressLine2: '',
  suburb: '',
  state: 'NSW',
  postcode: '',
  propertyType: 'house',
  bedrooms: '3',
  bathrooms: '2',
  parkingSpaces: '1',
  landSizeSqm: '',
  floorSizeSqm: '',
  yearBuilt: '',
  rentAmount: '',
  rentFrequency: 'weekly',
  bondAmount: '',
  notes: '',
};

export default function AddPropertyWizard() {
  const router = useRouter();
  const { user } = useAuth();
  const { createProperty } = usePropertyMutations();
  const { properties, loading: propertiesLoading } = useProperties();
  const { profile } = useProfile();
  const { featureValue, currentTier, requiredTier } = useFeatureGate(profile, 'maxProperties');
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);

  const maxProperties = typeof featureValue === 'number' ? featureValue : 3;
  const propertyLimitReached = maxProperties !== Infinity && properties.length >= maxProperties;

  const updateFormData = useCallback((key: keyof PropertyFormData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Address
        if (!formData.addressLine1.trim()) {
          Alert.alert('Required', 'Please enter a street address');
          return false;
        }
        if (!formData.suburb.trim()) {
          Alert.alert('Required', 'Please enter a suburb');
          return false;
        }
        if (!formData.postcode.trim() || !/^\d{4}$/.test(formData.postcode.trim())) {
          Alert.alert('Required', 'Please enter a valid 4-digit postcode');
          return false;
        }
        if (!formData.state?.trim()) {
          Alert.alert('Required', 'Please select a state');
          return false;
        }
        return true;
      case 1: // Details
        if (parseInt(formData.bedrooms, 10) < 0) {
          Alert.alert('Invalid', 'Bedrooms cannot be negative');
          return false;
        }
        return true;
      case 2: // Financials
        if (!formData.rentAmount.trim() || isNaN(Number(formData.rentAmount)) || Number(formData.rentAmount) <= 0) {
          Alert.alert('Required', 'Please enter a valid rent amount');
          return false;
        }
        return true;
      case 3: // Review
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      const isFirstProperty = properties.length === 0;

      const newProperty = await createProperty({
        address_line_1: formData.addressLine1.trim(),
        address_line_2: formData.addressLine2.trim() || null,
        suburb: formData.suburb.trim(),
        state: formData.state,
        postcode: formData.postcode.trim(),
        property_type: formData.propertyType,
        bedrooms: parseInt(formData.bedrooms, 10) || 1,
        bathrooms: parseInt(formData.bathrooms, 10) || 1,
        parking_spaces: parseInt(formData.parkingSpaces, 10) || 0,
        land_size_sqm: formData.landSizeSqm ? parseInt(formData.landSizeSqm, 10) : null,
        floor_size_sqm: formData.floorSizeSqm ? parseInt(formData.floorSizeSqm, 10) : null,
        year_built: formData.yearBuilt ? parseInt(formData.yearBuilt, 10) : null,
        rent_amount: parseFloat(formData.rentAmount),
        rent_frequency: formData.rentFrequency,
        bond_amount: formData.bondAmount.trim() ? parseFloat(formData.bondAmount) : null,
        notes: formData.notes.trim() || null,
      });

      // Send AI welcome message on first property (fire-and-forget, dedup-safe)
      if (isFirstProperty && user) {
        const propertyAddress = `${formData.addressLine1.trim()}, ${formData.suburb.trim()} ${formData.state}`;
        sendOwnerWelcomeMessage(user.id, propertyAddress, newProperty.id).catch(() => {});
      }

      Alert.alert('Success', 'Property added successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add property');
    } finally {
      setLoading(false);
    }
  };

  const renderPicker = <T extends string>(
    label: string,
    options: { value: T; label: string }[],
    selectedValue: T,
    onSelect: (value: T) => void
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.pickerOption,
              selectedValue === option.value && styles.pickerOptionSelected,
            ]}
            onPress={() => onSelect(option.value)}
          >
            <Text
              style={[
                styles.pickerOptionText,
                selectedValue === option.value && styles.pickerOptionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAddressStep = () => (
    <>
      <Text style={styles.stepTitle}>Property Address</Text>
      <Text style={styles.stepDescription}>
        Enter the full address of your rental property
      </Text>

      <View style={styles.field}>
        <Input
          label="Street Address"
          placeholder="123 Example Street"
          value={formData.addressLine1}
          onChangeText={(v) => updateFormData('addressLine1', v)}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.field}>
        <Input
          label="Unit/Apartment (optional)"
          placeholder="Unit 1, Level 2, etc."
          value={formData.addressLine2}
          onChangeText={(v) => updateFormData('addressLine2', v)}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.field, styles.flex]}>
          <Input
            label="Suburb"
            placeholder="Sydney"
            value={formData.suburb}
            onChangeText={(v) => updateFormData('suburb', v)}
            autoCapitalize="words"
          />
        </View>
        <View style={[styles.field, styles.smallField]}>
          <Input
            label="Postcode"
            placeholder="2000"
            value={formData.postcode}
            onChangeText={(v) => updateFormData('postcode', v)}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
      </View>

      {renderPicker(
        'State',
        AUSTRALIAN_STATES.map((s) => ({ value: s, label: s })),
        formData.state,
        (v) => updateFormData('state', v)
      )}
    </>
  );

  const renderDetailsStep = () => (
    <>
      <Text style={styles.stepTitle}>Property Details</Text>
      <Text style={styles.stepDescription}>
        Tell us about your property's features
      </Text>

      {renderPicker('Property Type', PROPERTY_TYPES, formData.propertyType, (v) => updateFormData('propertyType', v))}

      <View style={styles.row}>
        <View style={[styles.field, styles.flex]}>
          <Input
            label="Bedrooms"
            placeholder="3"
            value={formData.bedrooms}
            onChangeText={(v) => updateFormData('bedrooms', v)}
            keyboardType="number-pad"
          />
        </View>
        <View style={[styles.field, styles.flex]}>
          <Input
            label="Bathrooms"
            placeholder="2"
            value={formData.bathrooms}
            onChangeText={(v) => updateFormData('bathrooms', v)}
            keyboardType="number-pad"
          />
        </View>
        <View style={[styles.field, styles.flex]}>
          <Input
            label="Parking"
            placeholder="1"
            value={formData.parkingSpaces}
            onChangeText={(v) => updateFormData('parkingSpaces', v)}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.field, styles.flex]}>
          <Input
            label="Floor Size (m²)"
            placeholder="Optional"
            value={formData.floorSizeSqm}
            onChangeText={(v) => updateFormData('floorSizeSqm', v)}
            keyboardType="number-pad"
          />
        </View>
        <View style={[styles.field, styles.flex]}>
          <Input
            label="Land Size (m²)"
            placeholder="Optional"
            value={formData.landSizeSqm}
            onChangeText={(v) => updateFormData('landSizeSqm', v)}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Input
          label="Year Built"
          placeholder="Optional"
          value={formData.yearBuilt}
          onChangeText={(v) => updateFormData('yearBuilt', v)}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    </>
  );

  const renderFinancialsStep = () => (
    <>
      <Text style={styles.stepTitle}>Rent & Financials</Text>
      <Text style={styles.stepDescription}>
        Set your rent amount and payment terms
      </Text>

      <View style={styles.row}>
        <View style={[styles.field, styles.flex]}>
          <Input
            label="Rent Amount ($)"
            placeholder="550"
            value={formData.rentAmount}
            onChangeText={(v) => updateFormData('rentAmount', v)}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {renderPicker('Payment Frequency', PAYMENT_FREQUENCIES, formData.rentFrequency, (v) => updateFormData('rentFrequency', v))}

      <View style={styles.field}>
        <Input
          label="Bond Amount ($)"
          placeholder="4 weeks rent recommended"
          value={formData.bondAmount}
          onChangeText={(v) => updateFormData('bondAmount', v)}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.field}>
        <Input
          label="Notes (optional)"
          placeholder="Any additional details..."
          value={formData.notes}
          onChangeText={(v) => updateFormData('notes', v)}
          multiline
          numberOfLines={3}
        />
      </View>
    </>
  );

  const renderReviewStep = () => {
    const formatFrequency = (f: string) => {
      switch (f) {
        case 'weekly': return '/week';
        case 'fortnightly': return '/fortnight';
        case 'monthly': return '/month';
        default: return '';
      }
    };

    return (
      <>
        <Text style={styles.stepTitle}>Review Property</Text>
        <Text style={styles.stepDescription}>
          Please confirm all details are correct
        </Text>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Address</Text>
          <Text style={styles.reviewValue}>{formData.addressLine1}</Text>
          {formData.addressLine2 && (
            <Text style={styles.reviewValue}>{formData.addressLine2}</Text>
          )}
          <Text style={styles.reviewValue}>
            {formData.suburb}, {formData.state} {formData.postcode}
          </Text>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Property Type</Text>
          <Text style={styles.reviewValue}>
            {PROPERTY_TYPES.find(p => p.value === formData.propertyType)?.label || formData.propertyType}
          </Text>
        </View>

        <View style={styles.reviewRow}>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Bedrooms</Text>
            <Text style={styles.reviewValue}>{formData.bedrooms}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Bathrooms</Text>
            <Text style={styles.reviewValue}>{formData.bathrooms}</Text>
          </View>
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Parking</Text>
            <Text style={styles.reviewValue}>{formData.parkingSpaces}</Text>
          </View>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Rent</Text>
          <Text style={styles.reviewValueLarge}>
            ${formData.rentAmount}{formatFrequency(formData.rentFrequency)}
          </Text>
        </View>

        {formData.bondAmount && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Bond</Text>
            <Text style={styles.reviewValue}>${formData.bondAmount}</Text>
          </View>
        )}

        {formData.notes && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Notes</Text>
            <Text style={styles.reviewValue}>{formData.notes}</Text>
          </View>
        )}
      </>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderAddressStep();
      case 1:
        return renderDetailsStep();
      case 2:
        return renderFinancialsStep();
      case 3:
        return renderReviewStep();
      default:
        return null;
    }
  };

  if (propertiesLoading) {
    return (
      <ScreenContainer scrollable={false} padded={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Property</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </ScreenContainer>
    );
  }

  if (propertyLimitReached) {
    const tierLabel = currentTier === 'starter' ? 'Starter' : currentTier === 'pro' ? 'Pro' : 'Hands-Off';
    return (
      <ScreenContainer scrollable={false} padded={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Property</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.upgradeContainer}>
          <UpgradePrompt
            requiredTier={requiredTier ?? 'pro'}
            featureName="Property Limit Reached"
            featureDescription={`Your ${tierLabel} plan allows up to ${maxProperties} properties. Upgrade to manage more.`}
            onUpgrade={() => router.push('/(app)/settings/subscription' as any)}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Property</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Step Indicator */}
      <StepIndicator steps={STEPS} currentStep={currentStep} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          {currentStep < STEPS.length - 1 ? (
            <Button
              title="Continue"
              onPress={handleNext}
            />
          ) : (
            <Button
              title={loading ? 'Adding Property...' : 'Add Property'}
              onPress={handleSubmit}
              disabled={loading}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: THEME.spacing.xl,
  },
  stepTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  stepDescription: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
  },
  field: {
    marginBottom: THEME.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  smallField: {
    width: 100,
  },
  label: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  pickerOption: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  pickerOptionSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.brand,
  },
  pickerOptionText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  pickerOptionTextSelected: {
    color: THEME.colors.textInverse,
    fontWeight: THEME.fontWeight.medium,
  },
  footer: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl,
    backgroundColor: THEME.colors.canvas,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  // Review step styles
  reviewSection: {
    marginBottom: THEME.spacing.lg,
    paddingBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  reviewRow: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.lg,
    paddingBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  reviewItem: {
    flex: 1,
  },
  reviewLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.xs,
  },
  reviewValue: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  reviewValueLarge: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: THEME.spacing.base,
  },
});
