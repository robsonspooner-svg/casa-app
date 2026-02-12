// Mission 13: Reports Hub
// Overview of all report types with navigation to specific reports

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useDashboard } from '@casa/api';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

function formatCurrency(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-AU');
}

function ReportCard({ icon, title, subtitle, onPress }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.reportCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.reportCardIcon}>{icon}</View>
      <View style={styles.reportCardContent}>
        <Text style={styles.reportCardTitle}>{title}</Text>
        <Text style={styles.reportCardSubtitle}>{subtitle}</Text>
      </View>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );
}

export default function ReportsHubScreen() {
  const insets = useSafeAreaInsets();
  const { summary, loading, refreshDashboard } = useDashboard();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDashboard();
    setRefreshing(false);
  }, [refreshDashboard]);

  const netIncome = (summary?.rent_collected_this_month ?? 0) - (summary?.expenses_this_month ?? 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income (MTD)</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary?.rent_collected_this_month ?? 0)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Expenses (MTD)</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary?.expenses_this_month ?? 0)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Net Income</Text>
          <Text style={[styles.summaryValue, { color: netIncome >= 0 ? THEME.colors.success : THEME.colors.error }]}>
            {formatCurrency(netIncome)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.colors.brand} />
        }
      >
        {/* Financial Reports */}
        <Text style={styles.sectionLabel}>FINANCIAL</Text>
        <View style={styles.cardGroup}>
          <ReportCard
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Line x1="12" y1="20" x2="12" y2="10" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" />
                <Line x1="18" y1="20" x2="18" y2="4" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" />
                <Line x1="6" y1="20" x2="6" y2="16" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            }
            title="Financial Summary"
            subtitle="Income, expenses, and cash flow"
            onPress={() => router.push('/(app)/reports/financial' as any)}
          />
          <ReportCard
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="3" width="20" height="18" rx="2" stroke={THEME.colors.warning} strokeWidth={1.5} />
                <Path d="M8 7h8M8 11h5M8 15h8" stroke={THEME.colors.warning} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            }
            title="Tax Summary"
            subtitle="Australian FY breakdown for tax time"
            onPress={() => router.push('/(app)/reports/tax' as any)}
          />
          <ReportCard
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke={THEME.colors.error} strokeWidth={1.5} />
                <Path d="M12 6v6l4 2" stroke={THEME.colors.error} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            }
            title="Expense Tracker"
            subtitle="Manual expenses, rates, insurance"
            onPress={() => router.push('/(app)/reports/expenses' as any)}
          />
          <ReportCard
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            title="Cash Flow Forecast"
            subtitle="Project forward 3, 6, or 12 months"
            onPress={() => router.push('/(app)/reports/cash-flow' as any)}
          />
        </View>

        {/* Property Reports */}
        <Text style={styles.sectionLabel}>PROPERTY</Text>
        <View style={styles.cardGroup}>
          <ReportCard
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            title="Property Performance"
            subtitle="ROI, vacancy, maintenance costs"
            onPress={() => router.push('/(app)/reports/property-performance' as any)}
          />
        </View>

        {/* Generated Reports */}
        <Text style={styles.sectionLabel}>REPORTS</Text>
        <View style={styles.cardGroup}>
          <ReportCard
            icon={
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.info} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.info} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            title="Generated Reports"
            subtitle="View and generate PDF/CSV reports"
            onPress={() => router.push('/(app)/reports/generated' as any)}
          />
        </View>

        {/* Portfolio Snapshot */}
        {summary && (
          <>
            <Text style={styles.sectionLabel}>PORTFOLIO SNAPSHOT</Text>
            <View style={styles.snapshotGrid}>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{summary.total_properties}</Text>
                <Text style={styles.snapshotLabel}>Properties</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{summary.occupied_properties}</Text>
                <Text style={styles.snapshotLabel}>Occupied</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{summary.vacant_properties}</Text>
                <Text style={styles.snapshotLabel}>Vacant</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={[styles.snapshotValue, { color: THEME.colors.success }]}>
                  {summary.collection_rate}%
                </Text>
                <Text style={styles.snapshotLabel}>Collection</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{summary.open_maintenance}</Text>
                <Text style={styles.snapshotLabel}>Maintenance</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={[styles.snapshotValue, summary.leases_expiring_30d > 0 ? { color: THEME.colors.warning } : {}]}>
                  {summary.leases_expiring_30d}
                </Text>
                <Text style={styles.snapshotLabel}>Expiring 30d</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

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
    color: THEME.colors.textInverse,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  cardGroup: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  reportCardIcon: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportCardContent: {
    flex: 1,
  },
  reportCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  reportCardSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 8,
  },
  snapshotItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  snapshotValue: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  snapshotLabel: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },
});
