// Create Work Order Screen
// Mission 10: Tradesperson Network
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, Input, Chip } from '@casa/ui';
import { useMyTrades, useProperties, useTradeMutations } from '@casa/api';
import type { MaintenanceCategory, MaintenanceUrgency } from '@casa/api';

const CATEGORY_OPTIONS: { value: MaintenanceCategory; label: string }[] = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'structural', label: 'Structural' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'pest', label: 'Pest Control' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'garden_outdoor', label: 'Landscaping' },
  { value: 'locks_security', label: 'Locks & Security' },
  { value: 'hvac', label: 'Heating & Cooling' },
  { value: 'other', label: 'General' },
];

const URGENCY_OPTIONS: { value: MaintenanceUrgency; label: string }[] = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'routine', label: 'Routine' },
];

export default function CreateWorkOrderScreen() {
  const params = useLocalSearchParams<{
    tradeId?: string;
    propertyId?: string;
    maintenanceRequestId?: string;
    title?: string;
    description?: string;
    category?: string;
  }>();

  const { trades, loading: tradesLoading } = useMyTrades();
  const { properties, loading: propertiesLoading } = useProperties();
  const { createWorkOrder } = useTradeMutations();

  const [selectedTradeId, setSelectedTradeId] = useState<string>(params.tradeId || '');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(params.propertyId || '');
  const [title, setTitle] = useState(params.title || '');
  const [description, setDescription] = useState(params.description || '');
  const [category, setCategory] = useState<MaintenanceCategory | ''>((params.category as MaintenanceCategory) || '');
  const [urgency, setUrgency] = useState<MaintenanceUrgency>('routine');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [quoteRequired, setQuoteRequired] = useState(true);
  const [accessInstructions, setAccessInstructions] = useState('');
  const [tenantContactAllowed, setTenantContactAllowed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTradeDropdown, setShowTradeDropdown] = useState(false);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);

  useEffect(() => {
    if (params.tradeId) setSelectedTradeId(params.tradeId);
    if (params.propertyId) setSelectedPropertyId(params.propertyId);
    if (params.title) setTitle(params.title);
    if (params.description) setDescription(params.description);
    if (params.category) setCategory(params.category as MaintenanceCategory);
  }, [params.tradeId, params.propertyId, params.title, params.description, params.category]);

  const selectedTrade = trades.find(t => t.id === selectedTradeId);
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const canSubmit =
    selectedTradeId !== '' &&
    selectedPropertyId !== '' &&
    title.trim() !== '' &&
    description.trim() !== '' &&
    category !== '';

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const workOrderId = await createWorkOrder({
        trade_id: selectedTradeId,
        property_id: selectedPropertyId,
        title: title.trim(),
        description: description.trim(),
        category: category as MaintenanceCategory,
        urgency,
        budget_min: budgetMin ? parseFloat(budgetMin) : null,
        budget_max: budgetMax ? parseFloat(budgetMax) : null,
        quote_required: quoteRequired,
        access_instructions: accessInstructions.trim() || null,
        tenant_contact_allowed: tenantContactAllowed,
        maintenance_request_id: params.maintenanceRequestId || null,
      });

      if (workOrderId) {
        router.replace(`/(app)/work-orders/${workOrderId}` as any);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create work order');
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = tradesLoading || propertiesLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Work Order</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Work Order</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Trade Selector */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Trade *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => {
                setShowTradeDropdown(!showTradeDropdown);
                setShowPropertyDropdown(false);
              }}
            >
              <Text style={selectedTrade ? styles.selectorText : styles.selectorPlaceholder}>
                {selectedTrade ? selectedTrade.business_name : 'Select a tradesperson'}
              </Text>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9l6 6 6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            {showTradeDropdown && (
              <View style={styles.dropdown}>
                {trades.length === 0 ? (
                  <Text style={styles.dropdownEmpty}>No trades in your network</Text>
                ) : (
                  trades.map(trade => (
                    <TouchableOpacity
                      key={trade.id}
                      style={[styles.dropdownItem, trade.id === selectedTradeId && styles.dropdownItemSelected]}
                      onPress={() => {
                        setSelectedTradeId(trade.id);
                        setShowTradeDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, trade.id === selectedTradeId && styles.dropdownItemTextSelected]}>
                        {trade.business_name}
                      </Text>
                      <Text style={styles.dropdownItemSub}>{trade.contact_name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Property Selector */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Property *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => {
                setShowPropertyDropdown(!showPropertyDropdown);
                setShowTradeDropdown(false);
              }}
            >
              <Text style={selectedProperty ? styles.selectorText : styles.selectorPlaceholder}>
                {selectedProperty
                  ? `${selectedProperty.address_line_1}, ${selectedProperty.suburb}`
                  : 'Select a property'}
              </Text>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9l6 6 6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            {showPropertyDropdown && (
              <View style={styles.dropdown}>
                {properties.length === 0 ? (
                  <Text style={styles.dropdownEmpty}>No properties found</Text>
                ) : (
                  properties.map(property => (
                    <TouchableOpacity
                      key={property.id}
                      style={[styles.dropdownItem, property.id === selectedPropertyId && styles.dropdownItemSelected]}
                      onPress={() => {
                        setSelectedPropertyId(property.id);
                        setShowPropertyDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, property.id === selectedPropertyId && styles.dropdownItemTextSelected]}>
                        {property.address_line_1}
                      </Text>
                      <Text style={styles.dropdownItemSub}>{property.suburb}, {property.state}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Title */}
          <Input
            label="Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Fix leaking kitchen tap"
            containerStyle={styles.fieldContainer}
          />

          {/* Description */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Description *</Text>
            <TextInput
              style={styles.multilineInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the work needed in detail..."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Category */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Category *</Text>
            <View style={styles.chipRow}>
              {CATEGORY_OPTIONS.map(opt => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={category === opt.value}
                  onPress={() => setCategory(opt.value)}
                />
              ))}
            </View>
          </View>

          {/* Urgency */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Urgency</Text>
            <View style={styles.chipRow}>
              {URGENCY_OPTIONS.map(opt => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={urgency === opt.value}
                  onPress={() => setUrgency(opt.value)}
                />
              ))}
            </View>
          </View>

          {/* Budget Range */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Budget Range</Text>
            <View style={styles.budgetRow}>
              <View style={styles.budgetField}>
                <Input
                  label="Min ($)"
                  value={budgetMin}
                  onChangeText={setBudgetMin}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.budgetDash}>
                <Text style={styles.budgetDashText}>-</Text>
              </View>
              <View style={styles.budgetField}>
                <Input
                  label="Max ($)"
                  value={budgetMax}
                  onChangeText={setBudgetMax}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Quote Required */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleLabel}>Quote Required</Text>
              <Text style={styles.toggleHint}>Request a quote before work begins</Text>
            </View>
            <Switch
              value={quoteRequired}
              onValueChange={setQuoteRequired}
              trackColor={{ false: THEME.colors.border, true: THEME.colors.brand }}
              thumbColor={THEME.colors.textInverse}
            />
          </View>

          {/* Access Instructions */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Access Instructions</Text>
            <TextInput
              style={styles.multilineInput}
              value={accessInstructions}
              onChangeText={setAccessInstructions}
              placeholder="e.g. Key under mat, call tenant before arriving..."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Tenant Contact Allowed */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleLabel}>Tenant Contact Allowed</Text>
              <Text style={styles.toggleHint}>Allow tradesperson to contact the tenant directly</Text>
            </View>
            <Switch
              value={tenantContactAllowed}
              onValueChange={setTenantContactAllowed}
              trackColor={{ false: THEME.colors.border, true: THEME.colors.brand }}
              thumbColor={THEME.colors.textInverse}
            />
          </View>

          {/* Submit */}
          <View style={styles.submitContainer}>
            <Button
              title="Create Work Order"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  fieldContainer: {
    marginBottom: THEME.spacing.lg,
  },
  fieldLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: THEME.components.input.height,
    borderRadius: THEME.components.input.borderRadius,
    borderWidth: THEME.components.input.borderWidth,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.base,
  },
  selectorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  selectorPlaceholder: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
    flex: 1,
  },
  dropdown: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginTop: THEME.spacing.xs,
    maxHeight: 200,
    overflow: 'hidden',
    ...THEME.shadow.md,
  },
  dropdownItem: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: THEME.colors.infoBg,
  },
  dropdownItemText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  dropdownItemTextSelected: {
    color: THEME.colors.brand,
  },
  dropdownItemSub: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  dropdownEmpty: {
    padding: THEME.spacing.base,
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
  },
  multilineInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.components.input.borderRadius,
    borderWidth: THEME.components.input.borderWidth,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    minHeight: 100,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: THEME.spacing.sm,
  },
  budgetField: {
    flex: 1,
  },
  budgetDash: {
    paddingBottom: THEME.spacing.md,
  },
  budgetDashText: {
    fontSize: THEME.fontSize.h2,
    color: THEME.colors.textTertiary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.lg,
    ...THEME.shadow.sm,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  toggleLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  toggleHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  submitContainer: {
    marginTop: THEME.spacing.md,
  },
});
