// Mission 13: Tax Summary Screen
// Australian Financial Year breakdown for tax time

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useFinancials } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getCurrentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function InfoRow({ label, amount, color, bold }: { label: string; amount: number; color?: string; bold?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.infoValue, bold && { fontWeight: '700' }, color ? { color } : {}]}>
        {formatCurrency(amount)}
      </Text>
    </View>
  );
}

export default function TaxSummaryScreen() {
  const insets = useSafeAreaInsets();
  const currentFY = getCurrentFinancialYear();
  const [selectedYear, setSelectedYear] = useState(currentFY);
  const { taxSummary, loading, refreshFinancials } = useFinancials({ financialYear: selectedYear });
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFinancials();
    setRefreshing(false);
  }, [refreshFinancials]);

  const totalIncome = useMemo(() => {
    if (!taxSummary) return 0;
    return Number(taxSummary.rental_income) + Number(taxSummary.bond_income) + Number(taxSummary.other_income);
  }, [taxSummary]);

  const totalExpenses = useMemo(() => {
    if (!taxSummary) return 0;
    return Number(taxSummary.maintenance_expenses) + Number(taxSummary.manual_expenses_total) +
      Number(taxSummary.platform_fees) + Number(taxSummary.processing_fees);
  }, [taxSummary]);

  const netIncome = totalIncome - totalExpenses;
  const fyLabel = `FY ${selectedYear - 1}-${String(selectedYear).slice(2)}`;

  // Available years (current + 2 previous)
  const years = [currentFY, currentFY - 1, currentFY - 2];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tax Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.colors.brand} />
        }
      >
        {/* Year Selector */}
        <View style={styles.yearRow}>
          {years.map(y => (
            <TouchableOpacity
              key={y}
              style={[styles.yearButton, selectedYear === y && styles.yearButtonActive]}
              onPress={() => setSelectedYear(y)}
            >
              <Text style={[styles.yearText, selectedYear === y && styles.yearTextActive]}>
                FY {y - 1}-{String(y).slice(2)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Period Info */}
        {taxSummary && (
          <Text style={styles.periodText}>
            {taxSummary.period_start} to {taxSummary.period_end}
          </Text>
        )}

        {/* Net Summary */}
        <View style={styles.netCard}>
          <Text style={styles.netLabel}>Net Taxable Income ({fyLabel})</Text>
          <Text style={[styles.netValue, { color: netIncome >= 0 ? THEME.colors.success : THEME.colors.error }]}>
            {formatCurrency(netIncome)}
          </Text>
        </View>

        {/* Income Section */}
        <Text style={styles.sectionLabel}>INCOME</Text>
        <View style={styles.card}>
          <InfoRow label="Rental Income" amount={Number(taxSummary?.rental_income ?? 0)} color={THEME.colors.success} />
          <InfoRow label="Bond Income" amount={Number(taxSummary?.bond_income ?? 0)} />
          <InfoRow label="Other Income" amount={Number(taxSummary?.other_income ?? 0)} />
          <View style={styles.divider} />
          <InfoRow label="Total Income" amount={totalIncome} color={THEME.colors.success} bold />
        </View>

        {/* Expenses Section */}
        <Text style={styles.sectionLabel}>DEDUCTIBLE EXPENSES</Text>
        <View style={styles.card}>
          <InfoRow label="Maintenance & Repairs" amount={Number(taxSummary?.maintenance_expenses ?? 0)} color={THEME.colors.error} />
          <InfoRow label="Manual Expenses" amount={Number(taxSummary?.manual_expenses_total ?? 0)} color={THEME.colors.error} />
          <InfoRow label="Platform Fees (Casa)" amount={Number(taxSummary?.platform_fees ?? 0)} color={THEME.colors.error} />
          <InfoRow label="Payment Processing Fees" amount={Number(taxSummary?.processing_fees ?? 0)} color={THEME.colors.error} />
          <View style={styles.divider} />
          <InfoRow label="Total Expenses" amount={totalExpenses} color={THEME.colors.error} bold />
        </View>

        {/* Tax Deductible */}
        <Text style={styles.sectionLabel}>TAX DEDUCTIBLE (MANUAL ENTRIES)</Text>
        <View style={styles.card}>
          <InfoRow label="Tax Deductible Expenses" amount={Number(taxSummary?.tax_deductible_expenses ?? 0)} color={THEME.colors.info} bold />
          {taxSummary?.expense_breakdown_by_category?.map((cat, i) => (
            <InfoRow key={i} label={cat.category.replace(/_/g, ' ')} amount={Number(cat.total)} />
          ))}
          {(!taxSummary?.expense_breakdown_by_category || taxSummary.expense_breakdown_by_category.length === 0) && (
            <Text style={styles.emptyText}>No categorized expenses recorded</Text>
          )}
        </View>

        {/* Per Property Breakdown */}
        <Text style={styles.sectionLabel}>PER PROPERTY</Text>
        <View style={styles.card}>
          {taxSummary?.per_property?.map((prop, i) => (
            <View key={i} style={[styles.propertyRow, i > 0 && { borderTopWidth: 1, borderTopColor: THEME.colors.border, paddingTop: 12 }]}>
              <Text style={styles.propertyAddress} numberOfLines={1}>{prop.address}</Text>
              <View style={styles.propertyNumbers}>
                <View style={styles.propertyCol}>
                  <Text style={styles.propertyColLabel}>Income</Text>
                  <Text style={[styles.propertyColValue, { color: THEME.colors.success }]}>{formatCurrency(Number(prop.rental_income))}</Text>
                </View>
                <View style={styles.propertyCol}>
                  <Text style={styles.propertyColLabel}>Expenses</Text>
                  <Text style={[styles.propertyColValue, { color: THEME.colors.error }]}>{formatCurrency(Number(prop.expenses))}</Text>
                </View>
                <View style={styles.propertyCol}>
                  <Text style={styles.propertyColLabel}>Net</Text>
                  <Text style={[styles.propertyColValue, { color: Number(prop.net_income) >= 0 ? THEME.colors.success : THEME.colors.error }]}>
                    {formatCurrency(Number(prop.net_income))}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          {(!taxSummary?.per_property || taxSummary.per_property.length === 0) && (
            <Text style={styles.emptyText}>No properties with financial data</Text>
          )}
        </View>

        <Text style={styles.disclaimer}>
          This summary is for informational purposes only and should not be considered tax advice.
          Please consult a registered tax agent for your tax return.
        </Text>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.colors.textInverse },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  yearRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  yearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  yearButtonActive: { backgroundColor: THEME.colors.brand, borderColor: THEME.colors.brand },
  yearText: { fontSize: 13, fontWeight: '600', color: THEME.colors.textSecondary },
  yearTextActive: { color: THEME.colors.textInverse },

  periodText: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    marginBottom: 16,
  },

  netCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  netLabel: { fontSize: 13, color: THEME.colors.textSecondary, marginBottom: 4 },
  netValue: { fontSize: 28, fontWeight: '700' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },

  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 14, color: THEME.colors.textSecondary },
  infoValue: { fontSize: 14, color: THEME.colors.textPrimary, fontWeight: '500' },

  divider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 4,
  },

  emptyText: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 12,
  },

  propertyRow: { marginBottom: 12 },
  propertyAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  propertyNumbers: { flexDirection: 'row', gap: 12 },
  propertyCol: { flex: 1, alignItems: 'center' },
  propertyColLabel: { fontSize: 11, color: THEME.colors.textTertiary, marginBottom: 2 },
  propertyColValue: { fontSize: 14, fontWeight: '600' },

  disclaimer: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
