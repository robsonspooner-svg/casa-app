// Edit Listing Screen - Mission 04: Property Listings
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Input, Button, Chip, DatePicker, THEME } from '@casa/ui';
import {
  useListing,
  useListingMutations,
  useFeatureOptions,
  LeaseTerm,
  PaymentFrequency,
} from '@casa/api';

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

export default function EditListingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listing, loading, error } = useListing(id || null);
  const { updateListing } = useListingMutations();
  const { featuresByCategory } = useFeatureOptions();

  const [submitting, setSubmitting] = useState(false);
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

  // Pre-populate from existing listing
  useEffect(() => {
    if (listing) {
      setTitle(listing.title);
      setDescription(listing.description || '');
      setAvailableDate(new Date(listing.available_date));
      setLeaseTerm(listing.lease_term);
      setRentAmount(listing.rent_amount.toString());
      setRentFrequency(listing.rent_frequency);
      setBondWeeks(listing.bond_weeks.toString());
      setPetsAllowed(listing.pets_allowed);
      setPetsDescription(listing.pets_description || '');
      setSmokingAllowed(listing.smoking_allowed);
      setFurnished(listing.furnished);
      setSelectedFeatures(listing.features);
    }
  }, [listing]);

  const toggleFeature = (featureName: string) => {
    setSelectedFeatures(prev =>
      prev.includes(featureName)
        ? prev.filter(f => f !== featureName)
        : [...prev, featureName]
    );
  };

  const handleSave = async () => {
    if (!id || !title || !availableDate || !rentAmount) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await updateListing(
        id,
        {
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
        },
        selectedFeatures
      );

      Alert.alert('Success', 'Listing updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update listing');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Listing</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Listing</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Listing not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Listing</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {listing.property && (
          <View style={styles.propertyBanner}>
            <Text style={styles.propertyBannerText}>
              {listing.property.address_line_1}, {listing.property.suburb}
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
          placeholder="Describe the property..."
          multiline
          numberOfLines={4}
          inputStyle={styles.textArea}
        />

        <View style={styles.fieldGap} />

        <DatePicker
          label="Available Date"
          value={availableDate}
          onChange={setAvailableDate}
          placeholder="Select available date"
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

        <View style={styles.sectionDivider} />

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
          title={submitting ? 'Saving...' : 'Save Changes'}
          onPress={handleSave}
          disabled={submitting}
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
    gap: THEME.spacing.lg,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  scrollContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  propertyBanner: {
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  propertyBannerText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    fontWeight: THEME.fontWeight.medium,
  },
  fieldGap: {
    height: THEME.spacing.lg,
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
  sectionDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: THEME.spacing.xl,
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
});
