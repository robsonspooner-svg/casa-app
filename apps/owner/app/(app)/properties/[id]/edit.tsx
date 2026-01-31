// Edit Property Screen - Mission 03: Properties CRUD
import { useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  Button,
  Input,
  ScreenContainer,
  THEME,
} from '@casa/ui';
import { useProperty, usePropertyMutations, PropertyType, PaymentFrequency } from '@casa/api';

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

export default function EditPropertyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { property, loading: fetchLoading, error } = useProperty(id || null);
  const { updateProperty } = usePropertyMutations();
  const [saving, setSaving] = useState(false);

  // Form state
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState('NSW');
  const [postcode, setPostcode] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  const [parkingSpaces, setParkingSpaces] = useState('0');
  const [rentAmount, setRentAmount] = useState('');
  const [rentFrequency, setRentFrequency] = useState<PaymentFrequency>('weekly');
  const [bondAmount, setBondAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Pre-populate form when property loads
  useEffect(() => {
    if (property) {
      setAddressLine1(property.address_line_1);
      setAddressLine2(property.address_line_2 || '');
      setSuburb(property.suburb);
      setState(property.state);
      setPostcode(property.postcode);
      setPropertyType(property.property_type);
      setBedrooms(String(property.bedrooms));
      setBathrooms(String(property.bathrooms));
      setParkingSpaces(String(property.parking_spaces));
      setRentAmount(String(property.rent_amount));
      setRentFrequency(property.rent_frequency);
      setBondAmount(property.bond_amount ? String(property.bond_amount) : '');
      setNotes(property.notes || '');
    }
  }, [property]);

  const handleSubmit = async () => {
    if (!id) return;

    // Validation
    if (!addressLine1.trim()) {
      Alert.alert('Error', 'Please enter a street address');
      return;
    }
    if (!suburb.trim()) {
      Alert.alert('Error', 'Please enter a suburb');
      return;
    }
    if (!postcode.trim()) {
      Alert.alert('Error', 'Please enter a postcode');
      return;
    }
    if (!rentAmount.trim() || isNaN(Number(rentAmount))) {
      Alert.alert('Error', 'Please enter a valid rent amount');
      return;
    }

    setSaving(true);
    try {
      await updateProperty(id, {
        address_line_1: addressLine1.trim(),
        address_line_2: addressLine2.trim() || null,
        suburb: suburb.trim(),
        state,
        postcode: postcode.trim(),
        property_type: propertyType,
        bedrooms: parseInt(bedrooms, 10) || 1,
        bathrooms: parseInt(bathrooms, 10) || 1,
        parking_spaces: parseInt(parkingSpaces, 10) || 0,
        rent_amount: parseFloat(rentAmount),
        rent_frequency: rentFrequency,
        bond_amount: bondAmount.trim() ? parseFloat(bondAmount) : null,
        notes: notes.trim() || null,
      });

      Alert.alert('Success', 'Property updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update property');
    } finally {
      setSaving(false);
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

  if (fetchLoading) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Property</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </ScreenContainer>
    );
  }

  if (error || !property) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Property</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Property not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Property</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Address Section */}
          <Text style={styles.sectionTitle}>Address</Text>

          <View style={styles.field}>
            <Input
              label="Street Address"
              placeholder="123 Example Street"
              value={addressLine1}
              onChangeText={setAddressLine1}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Input
              label="Unit/Apartment (optional)"
              placeholder="Unit 1, Level 2, etc."
              value={addressLine2}
              onChangeText={setAddressLine2}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Input
                label="Suburb"
                placeholder="Sydney"
                value={suburb}
                onChangeText={setSuburb}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.field, styles.smallField]}>
              <Input
                label="Postcode"
                placeholder="2000"
                value={postcode}
                onChangeText={setPostcode}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>

          {renderPicker(
            'State',
            AUSTRALIAN_STATES.map((s) => ({ value: s, label: s })),
            state,
            setState
          )}

          {/* Property Details */}
          <Text style={styles.sectionTitle}>Property Details</Text>

          {renderPicker('Property Type', PROPERTY_TYPES, propertyType, setPropertyType)}

          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Input
                label="Bedrooms"
                placeholder="1"
                value={bedrooms}
                onChangeText={setBedrooms}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.field, styles.flex]}>
              <Input
                label="Bathrooms"
                placeholder="1"
                value={bathrooms}
                onChangeText={setBathrooms}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.field, styles.flex]}>
              <Input
                label="Parking"
                placeholder="0"
                value={parkingSpaces}
                onChangeText={setParkingSpaces}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Financials */}
          <Text style={styles.sectionTitle}>Financials</Text>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Input
                label="Rent Amount ($)"
                placeholder="550"
                value={rentAmount}
                onChangeText={setRentAmount}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.field, styles.flex]}>
              <Input
                label="Bond ($)"
                placeholder="2200"
                value={bondAmount}
                onChangeText={setBondAmount}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {renderPicker('Payment Frequency', PAYMENT_FREQUENCIES, rentFrequency, setRentFrequency)}

          {/* Notes */}
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>

          <View style={styles.field}>
            <Input
              label="Notes"
              placeholder="Any additional details about the property..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.submitContainer}>
            <Button
              title={saving ? 'Saving...' : 'Save Changes'}
              onPress={handleSubmit}
              disabled={saving}
            />
          </View>
        </ScrollView>
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
  content: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
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
  submitContainer: {
    marginTop: THEME.spacing.xl,
  },
});
