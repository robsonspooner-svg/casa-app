// Mission 13: Financial Summary Screen
// Income vs expenses chart, monthly breakdown, cash flow

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useDashboard, useProperties } from '@casa/api';
import Svg, { Path, Rect, Line, Text as SvgText } from 'react-native-svg';

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return '$' + (amount / 1000).toFixed(1) + 'k';
  }
  return '$' + Math.round(amount).toLocaleString('en-AU');
}

function formatFullCurrency(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Simple bar chart component
function BarChart({ data, height = 200 }: {
  data: Array<{ label: string; income: number; expenses: number }>;
  height?: number;
}) {
  const maxValue = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);
  const barWidth = 20;
  const gap = 6;
  const pairWidth = barWidth * 2 + gap;
  const chartWidth = data.length * (pairWidth + 16);
  const chartHeight = height - 40; // Leave room for labels

  return (
    <View style={chartStyles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={Math.max(chartWidth, 300)} height={height}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => {
            const y = 10 + (chartHeight * (1 - fraction));
            return (
              <Line
                key={i}
                x1={0}
                y1={y}
                x2={Math.max(chartWidth, 300)}
                y2={y}
                stroke={THEME.colors.border}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            );
          })}

          {data.map((item, index) => {
            const x = 20 + index * (pairWidth + 16);
            const incomeHeight = (item.income / maxValue) * chartHeight;
            const expenseHeight = (item.expenses / maxValue) * chartHeight;

            return (
              <React.Fragment key={index}>
                {/* Income bar */}
                <Rect
                  x={x}
                  y={10 + chartHeight - incomeHeight}
                  width={barWidth}
                  height={Math.max(incomeHeight, 1)}
                  rx={4}
                  fill={THEME.colors.success}
                  opacity={0.85}
                />
                {/* Expense bar */}
                <Rect
                  x={x + barWidth + gap}
                  y={10 + chartHeight - expenseHeight}
                  width={barWidth}
                  height={Math.max(expenseHeight, 1)}
                  rx={4}
                  fill={THEME.colors.error}
                  opacity={0.7}
                />
                {/* Label */}
                <SvgText
                  x={x + pairWidth / 2}
                  y={height - 5}
                  textAnchor="middle"
                  fontSize={11}
                  fill={THEME.colors.textTertiary}
                >
                  {item.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>

      {/* Legend */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: THEME.colors.success }]} />
          <Text style={chartStyles.legendText}>Income</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: THEME.colors.error }]} />
          <Text style={chartStyles.legendText}>Expenses</Text>
        </View>
      </View>
    </View>
  );
}

import React from 'react';

export default function FinancialSummaryScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(undefined);
  const [months, setMonths] = useState(6);
  const { summary, monthlyFinancials, loading, refreshDashboard } = useDashboard({
    propertyId: selectedPropertyId,
    months,
  });
  const { properties } = useProperties();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDashboard();
    setRefreshing(false);
  }, [refreshDashboard]);

  // Calculate totals from monthly data
  const totals = useMemo(() => {
    const totalIncome = monthlyFinancials.reduce((sum, m) => sum + Number(m.income), 0);
    const totalExpenses = monthlyFinancials.reduce((sum, m) => sum + Number(m.expenses), 0);
    const totalFees = monthlyFinancials.reduce((sum, m) => sum + Number(m.fees), 0);
    return { totalIncome, totalExpenses, totalFees, net: totalIncome - totalExpenses - totalFees };
  }, [monthlyFinancials]);

  const chartData = monthlyFinancials.map(m => ({
    label: m.month_short,
    income: Number(m.income),
    expenses: Number(m.expenses) + Number(m.fees),
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Summary</Text>
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
        {/* Period Selector */}
        <View style={styles.periodRow}>
          {[3, 6, 12].map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.periodButton, months === m && styles.periodButtonActive]}
              onPress={() => setMonths(m)}
            >
              <Text style={[styles.periodText, months === m && styles.periodTextActive]}>{m}M</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Property Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedPropertyId && styles.filterChipActive]}
            onPress={() => setSelectedPropertyId(undefined)}
          >
            <Text style={[styles.filterChipText, !selectedPropertyId && styles.filterChipTextActive]}>
              All Properties
            </Text>
          </TouchableOpacity>
          {properties.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.filterChip, selectedPropertyId === p.id && styles.filterChipActive]}
              onPress={() => setSelectedPropertyId(p.id)}
            >
              <Text style={[styles.filterChipText, selectedPropertyId === p.id && styles.filterChipTextActive]}>
                {p.address_line_1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Summary Cards */}
        <View style={styles.totalsGrid}>
          <View style={[styles.totalCard, { backgroundColor: THEME.colors.successBg }]}>
            <Text style={styles.totalLabel}>Total Income</Text>
            <Text style={[styles.totalValue, { color: THEME.colors.success }]}>
              {formatFullCurrency(totals.totalIncome)}
            </Text>
          </View>
          <View style={[styles.totalCard, { backgroundColor: THEME.colors.errorBg }]}>
            <Text style={styles.totalLabel}>Total Expenses</Text>
            <Text style={[styles.totalValue, { color: THEME.colors.error }]}>
              {formatFullCurrency(totals.totalExpenses + totals.totalFees)}
            </Text>
          </View>
        </View>
        <View style={styles.netCard}>
          <Text style={styles.netLabel}>Net Cash Flow ({months} months)</Text>
          <Text style={[styles.netValue, { color: totals.net >= 0 ? THEME.colors.success : THEME.colors.error }]}>
            {formatFullCurrency(totals.net)}
          </Text>
        </View>

        {/* Chart */}
        <Text style={styles.sectionLabel}>INCOME VS EXPENSES</Text>
        <View style={styles.chartCard}>
          {chartData.length > 0 ? (
            <BarChart data={chartData} />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>No financial data yet</Text>
              <Text style={styles.emptySubtext}>Income and expenses will appear here once payments are recorded</Text>
            </View>
          )}
        </View>

        {/* Monthly Breakdown */}
        <Text style={styles.sectionLabel}>MONTHLY BREAKDOWN</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <Text style={[styles.breakdownHeaderText, { flex: 2 }]}>Month</Text>
            <Text style={styles.breakdownHeaderText}>Income</Text>
            <Text style={styles.breakdownHeaderText}>Expenses</Text>
            <Text style={styles.breakdownHeaderText}>Net</Text>
          </View>
          {monthlyFinancials.length === 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownCell, { flex: 2, color: THEME.colors.textTertiary }]}>No data</Text>
            </View>
          )}
          {monthlyFinancials.map((m, i) => {
            const net = Number(m.income) - Number(m.expenses) - Number(m.fees);
            return (
              <View key={i} style={[styles.breakdownRow, i % 2 === 0 && { backgroundColor: THEME.colors.subtle }]}>
                <Text style={[styles.breakdownCell, { flex: 2, fontWeight: '600' }]}>
                  {m.month_short} {m.year}
                </Text>
                <Text style={[styles.breakdownCell, { color: THEME.colors.success }]}>
                  {formatCurrency(Number(m.income))}
                </Text>
                <Text style={[styles.breakdownCell, { color: THEME.colors.error }]}>
                  {formatCurrency(Number(m.expenses) + Number(m.fees))}
                </Text>
                <Text style={[styles.breakdownCell, { color: net >= 0 ? THEME.colors.success : THEME.colors.error }]}>
                  {formatCurrency(net)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Collection Rate */}
        {summary && (
          <>
            <Text style={styles.sectionLabel}>COLLECTION RATE</Text>
            <View style={styles.collectionCard}>
              <View style={styles.collectionRow}>
                <Text style={styles.collectionLabel}>This Month</Text>
                <Text style={[styles.collectionValue, { color: THEME.colors.success }]}>
                  {summary.collection_rate}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(summary.collection_rate, 100)}%` }]} />
              </View>
              {Number(summary.total_arrears) > 0 && (
                <View style={styles.arrearsRow}>
                  <Text style={styles.arrearsLabel}>Total Arrears</Text>
                  <Text style={[styles.arrearsValue, { color: THEME.colors.error }]}>
                    {formatFullCurrency(Number(summary.total_arrears))}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Period selector
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  periodButtonActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  periodTextActive: {
    color: '#FFFFFF',
  },

  // Filter chips
  filterRow: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.brandIndigo,
    borderColor: THEME.colors.brandIndigo,
  },
  filterChipText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // Totals
  totalsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  totalCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  netCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  netLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  netValue: {
    fontSize: 24,
    fontWeight: '700',
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },

  // Chart
  chartCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  emptyChart: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Breakdown table
  breakdownCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  breakdownHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.subtle,
  },
  breakdownHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  breakdownRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  breakdownCell: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    textAlign: 'right',
  },

  // Collection rate
  collectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  collectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  collectionLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  collectionValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: THEME.colors.success,
  },
  arrearsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  arrearsLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  arrearsValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});
