// Mission 13: Expense Tracker Screen
// Manual expense entry, categories, and listing

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Alert } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useExpenses, useProperties } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

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
  const [saving, setSaving] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshExpenses();
    setRefreshing(false);
  }, [refreshExpenses]);

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
      await addExpense({
        property_id: formPropertyId,
        description: formDescription.trim(),
        amount,
        expense_date: formDate,
        tax_category: formTaxCategory,
        is_tax_deductible: formIsTaxDeductible,
      });
      // Reset form
      setFormDescription('');
      setFormAmount('');
      setFormTaxCategory('other');
      setShowAddForm(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  }, [formPropertyId, formDescription, formAmount, formDate, formTaxCategory, formIsTaxDeductible, addExpense]);

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
            <Path d="M15 18l-6-6 6-6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Tracker</Text>
        <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)} style={styles.addButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
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

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setFormIsTaxDeductible(!formIsTaxDeductible)}
            >
              <View style={[styles.toggle, formIsTaxDeductible && styles.toggleActive]}>
                {formIsTaxDeductible && (
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

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
    borderRadius: 12,
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
    borderRadius: 8,
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
    borderRadius: 16,
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
  chipTextActive: { color: '#FFFFFF' },

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
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

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
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  emptyButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Expense list items
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: 10,
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
});
