// Mission 13: Property Performance Screen
// Per-property metrics, vacancy, ROI, maintenance costs

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useDashboard } from '@casa/api';
import Svg, { Path, Circle } from 'react-native-svg';

function formatCurrency(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-AU');
}

function StatusBadge({ label, color, bgColor }: { label: string; color: string; bgColor: string }) {
  return (
    <View style={[ppStyles.badge, { backgroundColor: bgColor }]}>
      <Text style={[ppStyles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function PropertyPerformanceScreen() {
  const insets = useSafeAreaInsets();
  const { summary, propertyMetrics, loading, refreshDashboard } = useDashboard();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDashboard();
    setRefreshing(false);
  }, [refreshDashboard]);

  // Portfolio totals
  const portfolioStats = useMemo(() => {
    const totalIncome12m = propertyMetrics.reduce((sum, p) => sum + Number(p.total_income_12m), 0);
    const totalMaintenance12m = propertyMetrics.reduce((sum, p) => sum + Number(p.maintenance_cost_12m), 0);
    const occupiedCount = propertyMetrics.filter(p => !p.is_vacant).length;
    const occupancyRate = propertyMetrics.length > 0
      ? Math.round((occupiedCount / propertyMetrics.length) * 100)
      : 0;

    return { totalIncome12m, totalMaintenance12m, occupancyRate, occupiedCount };
  }, [propertyMetrics]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Property Performance</Text>
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
        {/* Portfolio Overview */}
        <View style={styles.overviewGrid}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{portfolioStats.occupancyRate}%</Text>
            <Text style={styles.overviewLabel}>Occupancy</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: THEME.colors.success }]}>
              {formatCurrency(portfolioStats.totalIncome12m)}
            </Text>
            <Text style={styles.overviewLabel}>Income (12m)</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: THEME.colors.error }]}>
              {formatCurrency(portfolioStats.totalMaintenance12m)}
            </Text>
            <Text style={styles.overviewLabel}>Maintenance (12m)</Text>
          </View>
        </View>

        {/* Per Property Cards */}
        <Text style={styles.sectionLabel}>PROPERTY BREAKDOWN</Text>

        {propertyMetrics.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No property data available</Text>
            <Text style={styles.emptySubtext}>Add properties and record transactions to see performance metrics</Text>
          </View>
        )}

        {propertyMetrics.map(property => {
          const maintenanceRatio = Number(property.total_income_12m) > 0
            ? Math.round((Number(property.maintenance_cost_12m) / Number(property.total_income_12m)) * 100)
            : 0;

          // Annualized rent yield
          const annualRent = property.current_rent
            ? property.rent_frequency === 'weekly' ? Number(property.current_rent) * 52
              : property.rent_frequency === 'fortnightly' ? Number(property.current_rent) * 26
              : Number(property.current_rent) * 12
            : 0;

          return (
            <View key={property.property_id} style={styles.propertyCard}>
              {/* Property Header */}
              <View style={styles.propertyHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propertyAddress} numberOfLines={1}>{property.address_line_1}</Text>
                  <Text style={styles.propertyLocation}>{property.suburb}, {property.state}</Text>
                </View>
                <StatusBadge
                  label={property.is_vacant ? 'Vacant' : 'Occupied'}
                  color={property.is_vacant ? THEME.colors.error : THEME.colors.success}
                  bgColor={property.is_vacant ? THEME.colors.errorBg : THEME.colors.successBg}
                />
              </View>

              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Income (12m)</Text>
                  <Text style={[styles.metricValue, { color: THEME.colors.success }]}>
                    {formatCurrency(Number(property.total_income_12m))}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Maintenance (12m)</Text>
                  <Text style={[styles.metricValue, { color: THEME.colors.error }]}>
                    {formatCurrency(Number(property.maintenance_cost_12m))}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Maintenance Ratio</Text>
                  <Text style={[styles.metricValue, { color: maintenanceRatio > 30 ? THEME.colors.error : THEME.colors.textPrimary }]}>
                    {maintenanceRatio}%
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Annual Rent</Text>
                  <Text style={styles.metricValue}>
                    {annualRent > 0 ? formatCurrency(annualRent) : '-'}
                  </Text>
                </View>
              </View>

              {/* Status Row */}
              <View style={styles.statusRow}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Open Requests</Text>
                  <Text style={[styles.statusValue, Number(property.open_maintenance_requests) > 0 ? { color: THEME.colors.warning } : {}]}>
                    {property.open_maintenance_requests}
                  </Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Arrears</Text>
                  <Text style={[styles.statusValue, Number(property.current_arrears) > 0 ? { color: THEME.colors.error } : {}]}>
                    {Number(property.current_arrears) > 0 ? formatCurrency(Number(property.current_arrears)) : '$0'}
                  </Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Lease Expiry</Text>
                  <Text style={[styles.statusValue,
                    property.days_until_lease_expiry !== null && Number(property.days_until_lease_expiry) <= 30
                      ? { color: THEME.colors.warning }
                      : {}
                  ]}>
                    {property.days_until_lease_expiry !== null ? `${property.days_until_lease_expiry}d` : '-'}
                  </Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Payments (12m)</Text>
                  <Text style={styles.statusValue}>{property.payments_received_12m}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const ppStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.md,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

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

  overviewGrid: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 16,
    marginBottom: 16,
  },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewValue: { fontSize: 20, fontWeight: '700', color: THEME.colors.textPrimary },
  overviewLabel: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 4 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: '600', color: THEME.colors.textSecondary },
  emptySubtext: { fontSize: 13, color: THEME.colors.textTertiary, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },

  propertyCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 16,
    marginBottom: 12,
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  propertyAddress: { fontSize: 15, fontWeight: '600', color: THEME.colors.textPrimary },
  propertyLocation: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metricItem: {
    width: '50%',
    paddingVertical: 8,
  },
  metricLabel: { fontSize: 11, color: THEME.colors.textTertiary, marginBottom: 2 },
  metricValue: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary },

  statusRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: 12,
  },
  statusItem: { flex: 1, alignItems: 'center' },
  statusLabel: { fontSize: 10, color: THEME.colors.textTertiary, marginBottom: 2 },
  statusValue: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary },
});
