// Mission 13: Expense Tracker Screen
// Manual expense entry, categories, and listing

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useExpenses, useProperties, getSupabaseClient, useDocumentExtraction } from '@casa/api';
import type { ReceiptExtraction } from '@casa/api';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TAX_CATEGORIES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'council_rates', label: 'Council Rates' },
  { value: 'strata', label: 'Strata/Body Corporate' },
  { value: 'repairs', label: 'Repairs & Maintenance' },
  { value: 'interest', label: 'Loan Interest' },
  { value: 'depreciation', label: 'Depreciation' },
  { value: 'water_rates', label: 'Water Rates' },
  { value: 'land_tax', label: 'Land Tax' },
  { value: 'legal', label: 'Legal Fees' },
  { value: 'accounting', label: 'Accounting Fees' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'other', label: 'Other' },
];

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { properties } = useProperties();
  const { expenses, totalExpenses, loading, refreshExpenses, addExpense, deleteExpense } = useExpenses();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTaxCategory, setFormTaxCategory] = useState('other');
  const [formIsTaxDeductible, setFormIsTaxDeductible] = useState(true);
  const [receiptImage, setReceiptImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);
  const { extracting, extractData, uploadAndExtract } = useDocumentExtraction();
  const [extractedData, setExtractedData] = useState<ReceiptExtraction | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshExpenses();
    setRefreshing(false);
  }, [refreshExpenses]);

  // Auto-extract receipt data after picking an image
  const handleReceiptPicked = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    setReceiptImage(asset);
    setExtractedData(null);

    // Upload to temp storage and extract
    const tempPath = `receipts/temp_${Date.now()}.jpg`;
    const result = await uploadAndExtract(asset.uri, 'receipt', tempPath, formPropertyId || undefined);

    if (result?.extracted) {
      const data = result.extracted as ReceiptExtraction;
      setExtractedData(data);

      // Auto-fill form fields from extraction
      if (data.description && !formDescription.trim()) {
        setFormDescription(data.description);
      }
      if (data.amount != null && !formAmount) {
        setFormAmount(data.amount.toFixed(2));
      }
      if (data.date && formDate === new Date().toISOString().split('T')[0]) {
        setFormDate(data.date);
      }
      if (data.category_suggestion) {
        const validCategory = TAX_CATEGORIES.find(c => c.value === data.category_suggestion);
        if (validCategory) {
          setFormTaxCategory(data.category_suggestion);
        }
      }
      if (data.is_tax_deductible != null) {
        setFormIsTaxDeductible(data.is_tax_deductible);
      }
    }
  }, [uploadAndExtract, formPropertyId, formDescription, formAmount, formDate]);

  const handlePickReceipt = useCallback(async () => {
    Alert.alert('Scan Receipt', 'Casa will auto-extract the details for you', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to take photos.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!result.canceled && result.assets[0]) {
            handleReceiptPicked(result.assets[0]);
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });
          if (!result.canceled && result.assets[0]) {
            handleReceiptPicked(result.assets[0]);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handleReceiptPicked]);

  const uploadReceiptImage = useCallback(async (expenseId: string): Promise<string | null> => {
    if (!receiptImage) return null;
    setUploadingReceipt(true);
    try {
      const supabase = getSupabaseClient();
      const fileName = `${expenseId}_${Date.now()}.jpg`;
      const storagePath = `receipts/${fileName}`;

      const response = await fetch(receiptImage.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error } = await supabase.storage
        .from('reports')
        .upload(storagePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
      return urlData?.publicUrl || null;
    } catch (err) {
      console.error('Receipt upload failed:', err);
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  }, [receiptImage]);

  const handleAddExpense = useCallback(async () => {
    if (!formPropertyId || !formDescription.trim() || !formAmount) {
      Alert.alert('Missing Fields', 'Please fill in property, description, and amount.');
      return;
    }
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    try {
      setSaving(true);
      const expense = await addExpense({
        property_id: formPropertyId,
        description: formDescription.trim(),
        amount,
        expense_date: formDate,
        tax_category: formTaxCategory,
        is_tax_deductible: formIsTaxDeductible,
      });

      // Upload receipt if one was selected
      if (receiptImage && expense?.id) {
        const receiptUrl = await uploadReceiptImage(expense.id);
        if (receiptUrl) {
          const supabase = getSupabaseClient();
          await (supabase.from('manual_expenses') as ReturnType<typeof supabase.from>)
            .update({ receipt_url: receiptUrl })
            .eq('id', expense.id);
        }
      }

      // Reset form
      setFormDescription('');
      setFormAmount('');
      setFormTaxCategory('other');
      setReceiptImage(null);
      setShowAddForm(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  }, [formPropertyId, formDescription, formAmount, formDate, formTaxCategory, formIsTaxDeductible, receiptImage, addExpense, uploadReceiptImage]);

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(id);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete');
          }
        },
      },
    ]);
  }, [deleteExpense]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Tracker</Text>
        <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)} style={styles.addButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Expenses</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalExpenses)}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.colors.brand} />
        }
      >
        {/* Add Expense Form */}
        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Expense</Text>

            {/* Property selector */}
            <Text style={styles.fieldLabel}>Property</Text>
            <View style={styles.chipRow}>
              {properties.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, formPropertyId === p.id && styles.chipActive]}
                  onPress={() => setFormPropertyId(p.id)}
                >
                  <Text style={[styles.chipText, formPropertyId === p.id && styles.chipTextActive]} numberOfLines={1}>
                    {p.address_line_1}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.input}
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="e.g. Quarterly insurance premium"
              placeholderTextColor={THEME.colors.textTertiary}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Amount ($)</Text>
                <TextInput
                  style={styles.input}
                  value={formAmount}
                  onChangeText={setFormAmount}
                  placeholder="0.00"
                  placeholderTextColor={THEME.colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={formDate}
                  onChangeText={setFormDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={THEME.colors.textTertiary}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Tax Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {TAX_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.chip, formTaxCategory === cat.value && styles.chipActive]}
                  onPress={() => setFormTaxCategory(cat.value)}
                >
                  <Text style={[styles.chipText, formTaxCategory === cat.value && styles.chipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Receipt Photo with Smart Scan */}
            <Text style={styles.fieldLabel}>Receipt Photo</Text>
            {receiptImage ? (
              <View>
                <View style={styles.receiptPreview}>
                  <Image source={{ uri: receiptImage.uri }} style={styles.receiptImage} />
                  <TouchableOpacity
                    style={styles.receiptRemove}
                    onPress={() => { setReceiptImage(null); setExtractedData(null); }}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                  </TouchableOpacity>
                  {(uploadingReceipt || extracting) && (
                    <View style={styles.receiptUploading}>
                      <ActivityIndicator size="small" color={THEME.colors.textInverse} />
                      <Text style={styles.receiptUploadingText}>
                        {extracting ? 'Scanning...' : 'Uploading...'}
                      </Text>
                    </View>
                  )}
                </View>
                {extractedData && (
                  <View style={styles.extractedBanner}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.extractedBannerText}>
                      Fields auto-filled from receipt
                      {extractedData.vendor ? ` — ${extractedData.vendor}` : ''}
                    </Text>
                  </View>
                )}
                {extracting && (
                  <View style={styles.extractingBanner}>
                    <ActivityIndicator size="small" color={THEME.colors.brandIndigo} />
                    <Text style={styles.extractingBannerText}>
                      Casa is reading your receipt...
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity style={styles.receiptButton} onPress={handlePickReceipt}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.brand} strokeWidth={1.5} />
                </Svg>
                <Text style={styles.receiptButtonText}>Scan Receipt — auto-fills details</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setFormIsTaxDeductible(!formIsTaxDeductible)}
            >
              <View style={[styles.toggle, formIsTaxDeductible && styles.toggleActive]}>
                {formIsTaxDeductible && (
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </View>
              <Text style={styles.toggleLabel}>Tax Deductible</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleAddExpense}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Add Expense'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Expense List */}
        {expenses.length === 0 && !showAddForm && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No expenses recorded</Text>
            <Text style={styles.emptySubtitle}>
              Track manual expenses like insurance, rates, and strata fees for tax reporting
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowAddForm(true)}
            >
              <Text style={styles.emptyButtonText}>Add First Expense</Text>
            </TouchableOpacity>
          </View>
        )}

        {expenses.map(expense => (
          <TouchableOpacity
            key={expense.id}
            style={styles.expenseItem}
            onLongPress={() => handleDelete(expense.id)}
            activeOpacity={0.7}
          >
            <View style={styles.expenseLeft}>
              <Text style={styles.expenseDescription} numberOfLines={1}>{expense.description}</Text>
              <Text style={styles.expenseMeta}>
                {formatDate(expense.expense_date)}
                {expense.tax_category ? ` · ${expense.tax_category.replace(/_/g, ' ')}` : ''}
                {expense.is_tax_deductible ? ' · Tax deductible' : ''}
                {(expense as any).receipt_url ? ' · Receipt attached' : ''}
              </Text>
            </View>
            <Text style={styles.expenseAmount}>{formatCurrency(Number(expense.amount))}</Text>
          </TouchableOpacity>
        ))}

        {expenses.length > 0 && (
          <Text style={styles.hintText}>Long press an expense to delete it</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.colors.textInverse },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  totalLabel: { fontSize: 14, color: THEME.colors.textSecondary },
  totalValue: { fontSize: 20, fontWeight: '700', color: THEME.colors.error },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Form
  formCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.colors.textPrimary,
    backgroundColor: THEME.colors.canvas,
  },
  row: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipScroll: { marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginRight: 6,
    marginBottom: 6,
  },
  chipActive: {
    backgroundColor: THEME.colors.brandIndigo,
    borderColor: THEME.colors.brandIndigo,
  },
  chipText: { fontSize: 13, color: THEME.colors.textSecondary },
  chipTextActive: { color: THEME.colors.textInverse },

  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 },
  toggle: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: THEME.colors.success,
    borderColor: THEME.colors.success,
  },
  toggleLabel: { fontSize: 14, color: THEME.colors.textSecondary },

  saveButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { fontSize: 15, fontWeight: '700', color: THEME.colors.textInverse },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: THEME.colors.textPrimary },
  emptySubtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  emptyButtonText: { fontSize: 14, fontWeight: '700', color: THEME.colors.textInverse },

  // Expense list items
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  expenseLeft: { flex: 1, marginRight: 12 },
  expenseDescription: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary },
  expenseMeta: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 4 },
  expenseAmount: { fontSize: 15, fontWeight: '700', color: THEME.colors.error },

  hintText: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    borderStyle: 'dashed',
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    backgroundColor: THEME.colors.canvas,
  },
  receiptButtonText: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
    fontWeight: '500',
  },
  receiptPreview: {
    width: 100,
    height: 100,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  receiptRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptUploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  receiptUploadingText: {
    fontSize: 11,
    color: THEME.colors.textInverse,
    fontWeight: '600',
  },
  extractedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.successBg,
    borderRadius: THEME.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  extractedBannerText: {
    fontSize: 12,
    color: THEME.colors.success,
    fontWeight: '600',
    flex: 1,
  },
  extractingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.infoBg,
    borderRadius: THEME.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  extractingBannerText: {
    fontSize: 12,
    color: THEME.colors.brandIndigo,
    fontWeight: '500',
  },
});
