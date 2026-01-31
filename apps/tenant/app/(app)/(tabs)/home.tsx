// My Home Tab - Tenant's tenancy details, property info, and quick actions
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Badge, CurrencyDisplay } from '@casa/ui';
import {
  useMyTenancy,
  useRentSchedule,
  useMyMaintenance,
  useMyArrears,
  formatDollars,
} from '@casa/api';

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.quickActionIcon}>{icon}</View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MyHomeScreen() {
  const insets = useSafeAreaInsets();
  const { tenancy, loading, refreshMyTenancy } = useMyTenancy();
  const { nextDue, totalOwed, refreshSchedule } = useRentSchedule(tenancy?.id);
  const { requests: maintenanceRequests, activeCount } = useMyMaintenance({ showCompleted: false });
  const { hasArrears } = useMyArrears();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshMyTenancy(), refreshSchedule()]);
    setRefreshing(false);
  }, [refreshMyTenancy, refreshSchedule]);

  if (!tenancy && !loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Home</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.emptyTitle}>No active tenancy</Text>
          <Text style={styles.emptyText}>
            Your property and tenancy details will appear here once your lease is set up.
          </Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => router.push('/(app)/search' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.searchButtonText}>Search Listings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const property = tenancy?.property;
  const leaseStart = tenancy?.lease_start_date
    ? new Date(tenancy.lease_start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';
  const leaseEnd = tenancy?.lease_end_date
    ? new Date(tenancy.lease_end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Periodic';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Home</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.colors.brand} />
        }
      >
        {/* Property Card */}
        {property && (
          <View style={styles.propertyCard}>
            <Text style={styles.propertyAddress}>{property.address_line_1}</Text>
            <Text style={styles.propertySuburb}>
              {property.suburb}, {property.state} {property.postcode}
            </Text>
            <View style={styles.propertyMeta}>
              {property.bedrooms != null && (
                <Text style={styles.metaItem}>{property.bedrooms} bed</Text>
              )}
              {property.bathrooms != null && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaItem}>{property.bathrooms} bath</Text>
                </>
              )}
              {property.parking_spaces != null && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaItem}>{property.parking_spaces} car</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Tenancy Info */}
        {tenancy && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lease Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Badge
                label={tenancy.status === 'active' ? 'Active' : tenancy.status.charAt(0).toUpperCase() + tenancy.status.slice(1)}
                variant={tenancy.status === 'active' ? 'success' : 'neutral'}
              />
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rent</Text>
              <Text style={styles.detailValue}>
                {formatDollars(Number(tenancy.rent_amount))}/{tenancy.rent_frequency === 'weekly' ? 'wk' : tenancy.rent_frequency === 'fortnightly' ? 'fn' : 'mo'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lease Start</Text>
              <Text style={styles.detailValue}>{leaseStart}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lease End</Text>
              <Text style={styles.detailValue}>{leaseEnd}</Text>
            </View>
            {tenancy.bond_amount && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bond</Text>
                <Text style={styles.detailValue}>{formatDollars(Number(tenancy.bond_amount))}</Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          <QuickAction
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            label="Pay Rent"
            onPress={() => router.push('/(app)/payments/pay' as any)}
          />
          <QuickAction
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            label="Request Repair"
            onPress={() => router.push('/(app)/maintenance/new' as any)}
          />
          <QuickAction
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            label="View Lease"
            onPress={() => router.push('/(app)/tenancy' as any)}
          />
          <QuickAction
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            label="Search Listings"
            onPress={() => router.push('/(app)/search' as any)}
          />
        </View>

        {/* Active Maintenance Requests */}
        {activeCount > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Maintenance</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/maintenance' as any)}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {maintenanceRequests.slice(0, 3).map(req => (
              <TouchableOpacity
                key={req.id}
                style={styles.maintenanceItem}
                onPress={() => router.push(`/(app)/maintenance/${req.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.maintenanceLeft}>
                  <Text style={styles.maintenanceTitle} numberOfLines={1}>{req.title}</Text>
                  <Text style={styles.maintenanceStatus}>
                    {req.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                </View>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            ))}
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },

  // Property Card
  propertyCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  propertyAddress: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  propertySuburb: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 10,
  },
  propertyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  metaDot: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
  },

  // Card
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },

  // Quick Actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  quickAction: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.brand,
  },

  // Maintenance items
  maintenanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  maintenanceLeft: {
    flex: 1,
  },
  maintenanceTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  maintenanceStatus: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  searchButton: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
});
