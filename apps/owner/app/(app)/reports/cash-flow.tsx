// Mission 13: Cash Flow Forecast Screen
// Projects forward 3, 6, or 12 months based on historical data

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useCashFlowForecast } from '@casa/api';
import Svg, { Path, Line, Rect, Text as SvgText } from 'react-native-svg';
import React from 'react';

function formatCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return (amount < 0 ? '-' : '') + '$' + (Math.abs(amount) / 1000).toFixed(1) + 'k';
  }
  return '$' + Math.round(amount).toLocaleString('en-AU');
}

function formatFullCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return sign + '$' + Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function CashFlowForecastScreen() {
  const insets = useSafeAreaInsets();
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const { historicalMonths, projectedMonths, assumptions, risks, loading, refreshForecast } = useCashFlowForecast({ months });
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshForecast();
    setRefreshing(false);
  }, [refreshForecast]);

  const totalProjectedIncome = projectedMonths.reduce((s, m) => s + m.projected_income, 0);
  const totalProjectedExpenses = projectedMonths.reduce((s, m) => s + m.projected_expenses, 0);
  const totalProjectedNet = totalProjectedIncome - totalProjectedExpenses;

  // Chart data: last 3 historical months + projected months
  const chartHistorical = historicalMonths.slice(-3);
  const chartData = [...chartHistorical, ...projectedMonths.slice(0, months)];
  const maxVal = Math.max(...chartData.map(d => Math.max(d.projected_income, d.projected_expenses)), 1);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash Flow Forecast</Text>
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
          {([3, 6, 12] as const).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.periodButton, months === m && styles.periodButtonActive]}
              onPress={() => setMonths(m)}
            >
              <Text style={[styles.periodText, months === m && styles.periodTextActive]}>
                {m} Months
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Projection Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: THEME.colors.successBg }]}>
            <Text style={styles.summaryLabel}>Projected Income</Text>
            <Text style={[styles.summaryValue, { color: THEME.colors.success }]}>
              {formatFullCurrency(totalProjectedIncome)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: THEME.colors.errorBg }]}>
            <Text style={styles.summaryLabel}>Projected Expenses</Text>
            <Text style={[styles.summaryValue, { color: THEME.colors.error }]}>
              {formatFullCurrency(totalProjectedExpenses)}
            </Text>
          </View>
        </View>

        <View style={styles.netCard}>
          <Text style={styles.netLabel}>Projected Net Cash Flow ({months} months)</Text>
          <Text style={[styles.netValue, { color: totalProjectedNet >= 0 ? THEME.colors.success : THEME.colors.error }]}>
            {formatFullCurrency(totalProjectedNet)}
          </Text>
        </View>

        {/* Chart */}
        <Text style={styles.sectionLabel}>CASH FLOW PROJECTION</Text>
        <View style={styles.chartCard}>
          {chartData.length > 0 ? (
            <View style={styles.chartContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Svg width={Math.max(chartData.length * 62, 300)} height={200}>
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => {
                    const y = 10 + (150 * (1 - fraction));
                    return (
                      <Line key={i} x1={0} y1={y} x2={chartData.length * 62} y2={y}
                        stroke={THEME.colors.border} strokeWidth={0.5} strokeDasharray="4,4" />
                    );
                  })}

                  {chartData.map((item, index) => {
                    const x = 16 + index * 62;
                    const incomeH = (item.projected_income / maxVal) * 150;
                    const expenseH = (item.projected_expenses / maxVal) * 150;
                    const opacity = item.is_projection ? 0.5 : 0.85;

                    return (
                      <React.Fragment key={index}>
                        <Rect x={x} y={10 + 150 - incomeH} width={18} height={Math.max(incomeH, 1)}
                          rx={3} fill={THEME.colors.success} opacity={opacity} />
                        <Rect x={x + 22} y={10 + 150 - expenseH} width={18} height={Math.max(expenseH, 1)}
                          rx={3} fill={THEME.colors.error} opacity={opacity} />
                        {item.is_projection && (
                          <Line x1={x - 4} y1={10} x2={x - 4} y2={160}
                            stroke={THEME.colors.border} strokeWidth={0} />
                        )}
                        <SvgText x={x + 20} y={185} textAnchor="middle" fontSize={10} fill={THEME.colors.textTertiary}>
                          {item.month_short}
                        </SvgText>
                        {item.is_projection && index === chartHistorical.length && (
                          <SvgText x={x + 10} y={198} textAnchor="middle" fontSize={8} fill={THEME.colors.brandIndigo}>
                            forecast
                          </SvgText>
                        )}
                      </React.Fragment>
                    );
                  })}
                </Svg>
              </ScrollView>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: THEME.colors.success }]} />
                  <Text style={styles.legendText}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: THEME.colors.error }]} />
                  <Text style={styles.legendText}>Expenses</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: THEME.colors.brandIndigo, opacity: 0.5 }]} />
                  <Text style={styles.legendText}>Projected</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>No data available</Text>
              <Text style={styles.emptySubtext}>Cash flow projections will appear once you have payment history</Text>
            </View>
          )}
        </View>

        {/* Monthly Breakdown */}
        <Text style={styles.sectionLabel}>PROJECTED MONTHLY</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <Text style={[styles.breakdownHeaderText, { flex: 2, textAlign: 'left' }]}>Month</Text>
            <Text style={styles.breakdownHeaderText}>Income</Text>
            <Text style={styles.breakdownHeaderText}>Expenses</Text>
            <Text style={styles.breakdownHeaderText}>Net</Text>
            <Text style={styles.breakdownHeaderText}>Cumulative</Text>
          </View>
          {projectedMonths.map((m, i) => (
            <View key={i} style={[styles.breakdownRow, i % 2 === 0 && { backgroundColor: THEME.colors.subtle }]}>
              <Text style={[styles.breakdownCell, { flex: 2, fontWeight: '600', textAlign: 'left' }]}>
                {m.month_short} {m.year}
              </Text>
              <Text style={[styles.breakdownCell, { color: THEME.colors.success }]}>
                {formatCurrency(m.projected_income)}
              </Text>
              <Text style={[styles.breakdownCell, { color: THEME.colors.error }]}>
                {formatCurrency(m.projected_expenses)}
              </Text>
              <Text style={[styles.breakdownCell, { color: m.projected_net >= 0 ? THEME.colors.success : THEME.colors.error }]}>
                {formatCurrency(m.projected_net)}
              </Text>
              <Text style={[styles.breakdownCell, { color: m.cumulative_net >= 0 ? THEME.colors.success : THEME.colors.error, fontWeight: '600' }]}>
                {formatCurrency(m.cumulative_net)}
              </Text>
            </View>
          ))}
        </View>

        {/* Assumptions */}
        <Text style={styles.sectionLabel}>ASSUMPTIONS</Text>
        <View style={styles.card}>
          <View style={styles.assumptionRow}>
            <Text style={styles.assumptionLabel}>Occupancy Rate</Text>
            <Text style={styles.assumptionValue}>{assumptions.occupancy_rate}%</Text>
          </View>
          <View style={styles.assumptionRow}>
            <Text style={styles.assumptionLabel}>Expense Growth Rate</Text>
            <Text style={[styles.assumptionValue, assumptions.expense_growth_rate > 0 ? { color: THEME.colors.error } : {}]}>
              {assumptions.expense_growth_rate > 0 ? '+' : ''}{assumptions.expense_growth_rate}%
            </Text>
          </View>
          <View style={styles.assumptionRow}>
            <Text style={styles.assumptionLabel}>Pending Rent Increases</Text>
            <Text style={styles.assumptionValue}>{assumptions.pending_rent_increases}</Text>
          </View>
        </View>

        {/* Risks */}
        {risks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>RISKS</Text>
            <View style={styles.card}>
              {risks.map((risk, i) => (
                <View key={i} style={[styles.riskRow, i > 0 && { borderTopWidth: 1, borderTopColor: THEME.colors.border }]}>
                  <View style={styles.riskContent}>
                    <Text style={styles.riskDescription}>{risk.description}</Text>
                    <Text style={styles.riskImpact}>
                      Impact: {formatFullCurrency(risk.impact)} | Likelihood: {risk.likelihood}
                    </Text>
                  </View>
                  <View style={[
                    styles.riskBadge,
                    risk.likelihood === 'high' ? { backgroundColor: THEME.colors.errorBg } :
                    risk.likelihood === 'medium' ? { backgroundColor: THEME.colors.warningBg } :
                    { backgroundColor: THEME.colors.successBg },
                  ]}>
                    <Text style={[
                      styles.riskBadgeText,
                      risk.likelihood === 'high' ? { color: THEME.colors.error } :
                      risk.likelihood === 'medium' ? { color: THEME.colors.warning } :
                      { color: THEME.colors.success },
                    ]}>
                      {risk.likelihood}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.disclaimerText}>
          Projections are based on historical averages and may not reflect actual future results.
          Consult a financial advisor for investment decisions.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: {
    backgroundColor: THEME.colors.brand, paddingHorizontal: 16, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodButton: {
    flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: THEME.colors.surface,
    borderWidth: 1, borderColor: THEME.colors.border, alignItems: 'center',
  },
  periodButtonActive: { backgroundColor: THEME.colors.brand, borderColor: THEME.colors.brand },
  periodText: { fontSize: 13, fontWeight: '600', color: THEME.colors.textSecondary },
  periodTextActive: { color: '#FFFFFF' },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  summaryCard: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: THEME.colors.textSecondary, letterSpacing: 0.3 },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },

  netCard: {
    backgroundColor: THEME.colors.surface, borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: THEME.colors.border, marginBottom: 16,
  },
  netLabel: { fontSize: 13, color: THEME.colors.textSecondary },
  netValue: { fontSize: 24, fontWeight: '700', marginTop: 4 },

  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: THEME.colors.textTertiary,
    letterSpacing: 0.5, marginBottom: 8, marginTop: 8,
  },

  chartCard: {
    backgroundColor: THEME.colors.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: THEME.colors.border, marginBottom: 16,
  },
  chartContainer: { paddingVertical: 8 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: THEME.colors.textSecondary },
  emptyChart: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600', color: THEME.colors.textSecondary },
  emptySubtext: { fontSize: 13, color: THEME.colors.textTertiary, marginTop: 4, textAlign: 'center' },

  breakdownCard: {
    backgroundColor: THEME.colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: THEME.colors.border, overflow: 'hidden', marginBottom: 16,
  },
  breakdownHeader: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.border, backgroundColor: THEME.colors.subtle,
  },
  breakdownHeaderText: {
    flex: 1, fontSize: 10, fontWeight: '700', color: THEME.colors.textTertiary,
    letterSpacing: 0.3, textAlign: 'right',
  },
  breakdownRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10 },
  breakdownCell: { flex: 1, fontSize: 12, color: THEME.colors.textPrimary, textAlign: 'right' },

  card: {
    backgroundColor: THEME.colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: THEME.colors.border, overflow: 'hidden', marginBottom: 16,
  },
  assumptionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.border,
  },
  assumptionLabel: { fontSize: 14, color: THEME.colors.textSecondary },
  assumptionValue: { fontSize: 15, fontWeight: '600', color: THEME.colors.textPrimary },

  riskRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  riskContent: { flex: 1, marginRight: 12 },
  riskDescription: { fontSize: 14, fontWeight: '500', color: THEME.colors.textPrimary },
  riskImpact: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 2 },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  riskBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },

  disclaimerText: {
    fontSize: 12, color: THEME.colors.textTertiary, fontStyle: 'italic',
    textAlign: 'center', marginTop: 8, paddingHorizontal: 16,
  },
});
