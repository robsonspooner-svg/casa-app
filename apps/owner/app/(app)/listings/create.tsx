// Create Listing Screen - Mission 04: Property Listings
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  Input,
  Button,
  Checkbox,
  Chip,
  DatePicker,
  THEME,
} from '@casa/ui';
import {
  useProperties,
  useListingMutations,
  useFeatureOptions,
  useGenerateListing,
  PropertyWithImages,
  LeaseTerm,
  PaymentFrequency,
} from '@casa/api';

type Step = 'property' | 'details' | 'policies' | 'review';

const LEASE_TERMS: { value: LeaseTerm; label: string }[] = [
  { value: '6_months', label: '6 months' },
  { value: '12_months', label: '12 months' },
  { value: '24_months', label: '24 months' },
  { value: 'flexible', label: 'Flexible' },
];

const RENT_FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function CreateListingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ propertyId?: string }>();
  const { properties, loading: propertiesLoading } = useProperties();
  const { createListing } = useListingMutations();
  const { features: featureOptions, featuresByCategory } = useFeatureOptions();
  const { generating, generateListing } = useGenerateListing();

  const [step, setStep] = useState<Step>(params.propertyId ? 'details' : 'property');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithImages | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availableDate, setAvailableDate] = useState<Date | null>(null);
  const [leaseTerm, setLeaseTerm] = useState<LeaseTerm>('12_months');
  const [rentAmount, setRentAmount] = useState('');
  const [rentFrequency, setRentFrequency] = useState<PaymentFrequency>('weekly');
  const [bondWeeks, setBondWeeks] = useState('4');
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [petsDescription, setPetsDescription] = useState('');
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [furnished, setFurnished] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // Auto-populate from property if propertyId provided
  useEffect(() => {
    if (params.propertyId && properties.length > 0) {
      const property = properties.find(p => p.id === params.propertyId);
      if (property) {
        setSelectedProperty(property);
        setRentAmount(property.rent_amount.toString());
        setRentFrequency(property.rent_frequency);
        setTitle(`${property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1)} in ${property.suburb}`);
      }
    }
  }, [params.propertyId, properties]);

  const handleSelectProperty = (property: PropertyWithImages) => {
    setSelectedProperty(property);
    setRentAmount(property.rent_amount.toString());
    setRentFrequency(property.rent_frequency);
    setTitle(`${property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1)} in ${property.suburb}`);
    setStep('details');
  };

  const toggleFeature = (featureName: string) => {
    setSelectedFeatures(prev =>
      prev.includes(featureName)
        ? prev.filter(f => f !== featureName)
        : [...prev, featureName]
    );
  };

  const handleSubmit = async (publish: boolean) => {
    if (!selectedProperty || !title || !availableDate || !rentAmount) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const listing = await createListing(
        {
          property_id: selectedProperty.id,
          title,
          description: description || null,
          available_date: availableDate.toISOString().split('T')[0],
          lease_term: leaseTerm,
          rent_amount: parseFloat(rentAmount),
          rent_frequency: rentFrequency,
          bond_weeks: parseInt(bondWeeks) || 4,
          pets_allowed: petsAllowed,
          pets_description: petsAllowed ? petsDescription || null : null,
          smoking_allowed: smokingAllowed,
          furnished,
          status: publish ? 'active' : 'draft',
        },
        selectedFeatures.length > 0 ? selectedFeatures : undefined
      );

      Alert.alert(
        'Success',
        publish ? 'Listing published successfully.' : 'Listing saved as draft.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedToDetails = selectedProperty !== null;
  const canProceedToPolicies = title.trim() !== '' && availableDate !== null && rentAmount.trim() !== '';
  const canSubmit = canProceedToDetails && canProceedToPolicies;

  // Property Selection Step
  if (step === 'property') {
    const vacantProperties = properties.filter(p => p.status === 'vacant');

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Property</Text>
          <View style={styles.headerRight} />
        </View>

        {propertiesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.colors.brand} />
          </View>
        ) : (
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {vacantProperties.length === 0 && (
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  All properties shown below. Vacant properties are recommended for new listings.
                </Text>
              </View>
            )}
            {properties.map(property => (
              <TouchableOpacity
                key={property.id}
                style={styles.propertyCard}
                onPress={() => handleSelectProperty(property)}
                activeOpacity={0.7}
              >
                <View style={styles.propertyCardContent}>
                  <Text style={styles.propertyCardAddress}>{property.address_line_1}</Text>
                  <Text style={styles.propertyCardSuburb}>{property.suburb}, {property.state}</Text>
                  <View style={styles.propertyCardDetails}>
                    <Text style={styles.propertyCardDetail}>
                      {property.bedrooms} bed, {property.bathrooms} bath
                    </Text>
                    <Text style={styles.propertyCardStatus}>
                      {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // Details Step
  if (step === 'details') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('property')} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Listing Details</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {selectedProperty && (
            <View style={styles.selectedPropertyBanner}>
              <Text style={styles.selectedPropertyText}>
                {selectedProperty.address_line_1}, {selectedProperty.suburb}
              </Text>
            </View>
          )}

          <Input
            label="Listing Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Modern apartment in Surry Hills"
          />

          <View style={styles.fieldGap} />

          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the property, neighbourhood, and lifestyle..."
            multiline
            numberOfLines={4}
            inputStyle={styles.textArea}
          />

          {selectedProperty && (
            <TouchableOpacity
              style={styles.generateButton}
              onPress={async () => {
                const result = await generateListing(selectedProperty.id, title || undefined);
                if (result) {
                  if (!title && result.title) setTitle(result.title);
                  if (result.description) setDescription(result.description);
                }
              }}
              disabled={generating}
              activeOpacity={0.7}
            >
              {generating ? (
                <ActivityIndicator size="small" color={THEME.colors.brand} />
              ) : (
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
              <Text style={styles.generateButtonText}>
                {generating ? 'Generating...' : 'Generate with AI'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.fieldGap} />

          <DatePicker
            label="Available Date"
            value={availableDate}
            onChange={setAvailableDate}
            placeholder="Select available date"
            minimumDate={new Date()}
          />

          <View style={styles.fieldGap} />

          <Text style={styles.fieldLabel}>Lease Term</Text>
          <View style={styles.chipRow}>
            {LEASE_TERMS.map(term => (
              <Chip
                key={term.value}
                label={term.label}
                selected={leaseTerm === term.value}
                onPress={() => setLeaseTerm(term.value)}
              />
            ))}
          </View>

          <View style={styles.fieldGap} />

          <View style={styles.row}>
            <View style={styles.rowField}>
              <Input
                label="Rent Amount"
                value={rentAmount}
                onChangeText={setRentAmount}
                placeholder="450"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.rowField}>
              <Text style={styles.fieldLabel}>Frequency</Text>
              <View style={styles.chipColumn}>
                {RENT_FREQUENCIES.map(freq => (
                  <Chip
                    key={freq.value}
                    label={freq.label}
                    selected={rentFrequency === freq.value}
                    onPress={() => setRentFrequency(freq.value)}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.fieldGap} />

          <Input
            label="Bond (weeks)"
            value={bondWeeks}
            onChangeText={setBondWeeks}
            placeholder="4"
            keyboardType="numeric"
          />

          <View style={styles.fieldGap} />
          <View style={styles.fieldGap} />

          <Button
            title="Next: Policies & Features"
            onPress={() => setStep('policies')}
            disabled={!canProceedToPolicies}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Policies & Features Step
  if (step === 'policies') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('details')} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Policies & Features</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Policies</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Pets Allowed</Text>
            <Switch
              value={petsAllowed}
              onValueChange={setPetsAllowed}
              trackColor={{ false: THEME.colors.border, true: THEME.colors.brand }}
            />
          </View>

          {petsAllowed && (
            <Input
              placeholder="e.g. Small dogs and cats welcome"
              value={petsDescription}
              onChangeText={setPetsDescription}
              containerStyle={styles.indentedField}
            />
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Smoking Allowed</Text>
            <Switch
              value={smokingAllowed}
              onValueChange={setSmokingAllowed}
              trackColor={{ false: THEME.colors.border, true: THEME.colors.brand }}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Furnished</Text>
            <Switch
              value={furnished}
              onValueChange={setFurnished}
              trackColor={{ false: THEME.colors.border, true: THEME.colors.brand }}
            />
          </View>

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionTitle}>Features & Amenities</Text>

          {Object.entries(featuresByCategory).map(([category, options]) => (
            <View key={category} style={styles.featureCategory}>
              <Text style={styles.featureCategoryLabel}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
              <View style={styles.featureChipRow}>
                {options.map(option => (
                  <Chip
                    key={option.id}
                    label={option.name}
                    selected={selectedFeatures.includes(option.name)}
                    onPress={() => toggleFeature(option.name)}
                  />
                ))}
              </View>
            </View>
          ))}

          <View style={styles.fieldGap} />
          <View style={styles.fieldGap} />

          <Button
            title="Review Listing"
            onPress={() => setStep('review')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Review Step
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('policies')} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Property */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Property</Text>
          <Text style={styles.reviewValue}>
            {selectedProperty?.address_line_1}, {selectedProperty?.suburb}
          </Text>
        </View>

        {/* Title & Description */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Title</Text>
          <Text style={styles.reviewValue}>{title}</Text>
        </View>

        {description && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Description</Text>
            <Text style={styles.reviewValue}>{description}</Text>
          </View>
        )}

        {/* Rent & Terms */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Rent</Text>
          <Text style={styles.reviewValue}>
            ${rentAmount} {rentFrequency}
          </Text>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Available</Text>
          <Text style={styles.reviewValue}>
            {availableDate ? availableDate.toLocaleDateString() : 'Not set'}
          </Text>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Lease Term</Text>
          <Text style={styles.reviewValue}>
            {LEASE_TERMS.find(t => t.value === leaseTerm)?.label}
          </Text>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Bond</Text>
          <Text style={styles.reviewValue}>{bondWeeks} weeks</Text>
        </View>

        {/* Policies */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Policies</Text>
          <Text style={styles.reviewValue}>
            Pets: {petsAllowed ? 'Yes' : 'No'}
            {petsAllowed && petsDescription ? ` (${petsDescription})` : ''}
            {'\n'}Smoking: {smokingAllowed ? 'Yes' : 'No'}
            {'\n'}Furnished: {furnished ? 'Yes' : 'No'}
          </Text>
        </View>

        {/* Features */}
        {selectedFeatures.length > 0 && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Features</Text>
            <View style={styles.reviewChips}>
              {selectedFeatures.map(feature => (
                <Chip key={feature} label={feature} selected />
              ))}
            </View>
          </View>
        )}

        <View style={styles.fieldGap} />

        {/* Action Buttons */}
        <Button
          title={submitting ? 'Publishing...' : 'Publish Listing'}
          onPress={() => handleSubmit(true)}
          disabled={submitting || !canSubmit}
        />
        <View style={styles.smallGap} />
        <Button
          title={submitting ? 'Saving...' : 'Save as Draft'}
          onPress={() => handleSubmit(false)}
          variant="secondary"
          disabled={submitting || !canSubmit}
        />
      </ScrollView>
    </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  selectedPropertyBanner: {
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  selectedPropertyText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    fontWeight: THEME.fontWeight.medium,
  },
  infoCard: {
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  infoText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  propertyCardContent: {
    flex: 1,
  },
  propertyCardAddress: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  propertyCardSuburb: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  propertyCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
  },
  propertyCardDetail: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  propertyCardStatus: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    fontWeight: THEME.fontWeight.medium,
  },
  fieldGap: {
    height: THEME.spacing.lg,
  },
  smallGap: {
    height: THEME.spacing.md,
  },
  fieldLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  chipColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  rowField: {
    flex: 1,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: THEME.spacing.md,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingVertical: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderStyle: 'dashed',
  },
  generateButtonText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.brand,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  switchLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  indentedField: {
    marginLeft: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: THEME.spacing.xl,
  },
  featureCategory: {
    marginBottom: THEME.spacing.lg,
  },
  featureCategoryLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.sm,
  },
  featureChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  reviewSection: {
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  reviewLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  reviewValue: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    lineHeight: 22,
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
});
