// Tenancies List Screen - Owner App
// Mission 06: Tenancies & Leases

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useTenancies, TenancyStatus, TenancyWithDetails } from '@casa/api';

const STATUS_FILTERS: { label: string; value: TenancyStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'active' },
  { label: 'Ending', value: 'ending' },
  { label: 'Pending', value: 'pending' },
  { label: 'Ended', value: 'ended' },
];

const STATUS_COLORS: Record<TenancyStatus, string> = {
  pending: THEME.colors.textTertiary,
  active: '#16A34A',
  ending: '#F59E0B',
  ended: THEME.colors.textTertiary,
  terminated: '#EF4444',
};

function TenancyCard({ tenancy }: { tenancy: TenancyWithDetails }) {
  const primaryTenant = tenancy.tenants.find(t => t.is_primary);
  const tenantName = primaryTenant?.profile
    ? (primaryTenant.profile.full_name || 'Unknown')
    : 'No tenant assigned';

  const propertyAddress = tenancy.property
    ? `${tenancy.property.address_line_1}, ${tenancy.property.suburb}`
    : 'Unknown property';

  const daysUntilEnd = Math.ceil(
    (new Date(tenancy.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/tenancies/${tenancy.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardAddress} numberOfLines={1}>{propertyAddress}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[tenancy.status]}15` }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[tenancy.status] }]}>
            {tenancy.status.charAt(0).toUpperCase() + tenancy.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.tenantName}>{tenantName}</Text>

      <View style={styles.cardDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Rent</Text>
          <Text style={styles.detailValue}>
            ${tenancy.rent_amount}/{tenancy.rent_frequency === 'weekly' ? 'wk' : tenancy.rent_frequency === 'fortnightly' ? 'fn' : 'mo'}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Lease End</Text>
          <Text style={styles.detailValue}>
            {new Date(tenancy.lease_end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        {tenancy.status === 'active' && daysUntilEnd <= 90 && daysUntilEnd > 0 && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Expires in</Text>
            <Text style={[styles.detailValue, daysUntilEnd <= 30 ? styles.urgentText : styles.warningText]}>
              {daysUntilEnd} days
            </Text>
          </View>
        )}
      </View>

      {tenancy.bond_status !== 'pending' && (
        <View style={styles.bondRow}>
          <Text style={styles.bondLabel}>Bond: ${tenancy.bond_amount}</Text>
          <Text style={styles.bondStatus}>{tenancy.bond_status}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function TenanciesListScreen() {
  const [statusFilter, setStatusFilter] = useState<TenancyStatus | undefined>(undefined);
  const { tenancies, loading, refreshing, error, refreshTenancies } = useTenancies({ status: statusFilter });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tenancies</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={item => item.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                statusFilter === item.value && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(item.value)}
            >
              <Text style={[
                styles.filterChipText,
                statusFilter === item.value && styles.filterChipTextActive,
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refreshTenancies} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : tenancies.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No tenancies yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a tenancy after approving a tenant application.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tenancies}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <TenancyCard tenancy={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshTenancies}
              tintColor={THEME.colors.brand}
            />
          }
        />
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: THEME.colors.brand,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 40,
  },
  filterContainer: {
    paddingBottom: 12,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  filterChipText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tenantName: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 12,
  },
  cardDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {},
  detailLabel: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  warningText: {
    color: '#F59E0B',
  },
  urgentText: {
    color: '#EF4444',
  },
  bondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  bondLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  bondStatus: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
    textTransform: 'capitalize',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: THEME.colors.brand,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
