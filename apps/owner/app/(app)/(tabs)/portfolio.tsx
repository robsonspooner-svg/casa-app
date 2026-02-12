import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useProperties, useTenancies, useMaintenance, useInspections, useArrears, useAgentTasks } from '@casa/api';
import type { PropertyWithImages } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

type StatusFilter = 'all' | 'occupied' | 'vacant' | 'maintenance';

function getNextAction(
  property: PropertyWithImages,
  tenancyMap: Map<string, { lease_end_date: string; rent_amount: number }>,
  maintenanceMap: Map<string, number>,
  inspectionMap: Map<string, { date: string; type: string }>,
  arrearsMap: Map<string, number>,
): { label: string; color: string } {
  // Priority: arrears > maintenance > inspection > lease expiry > all good
  const arrearsAmount = arrearsMap.get(property.id);
  if (arrearsAmount && arrearsAmount > 0) {
    return { label: `Arrears: $${Math.round(arrearsAmount).toLocaleString()}`, color: THEME.colors.error };
  }

  const maintenanceCount = maintenanceMap.get(property.id);
  if (maintenanceCount && maintenanceCount > 0) {
    return { label: `${maintenanceCount} active repair${maintenanceCount > 1 ? 's' : ''}`, color: THEME.colors.warning };
  }

  const inspection = inspectionMap.get(property.id);
  if (inspection) {
    const date = new Date(inspection.date);
    const formatted = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    return { label: `Inspection ${formatted}`, color: THEME.colors.info };
  }

  const tenancy = tenancyMap.get(property.id);
  if (tenancy) {
    const endDate = new Date(tenancy.lease_end_date);
    const daysUntil = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 90 && daysUntil > 0) {
      return { label: `Lease ends ${endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`, color: THEME.colors.warning };
    }
  }

  if (property.status === 'vacant') {
    return { label: 'Finding tenant', color: THEME.colors.brandIndigo };
  }

  return { label: 'All good', color: THEME.colors.success };
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    occupied: { label: 'Leased', bg: THEME.colors.successBg, color: THEME.colors.success },
    vacant: { label: 'Vacant', bg: THEME.colors.warningBg, color: THEME.colors.warning },
    maintenance: { label: 'Maintenance', bg: THEME.colors.infoBg, color: THEME.colors.info },
  }[status] || { label: status, bg: THEME.colors.subtle, color: THEME.colors.textSecondary };

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function PropertyCard({
  property,
  nextAction,
  rentDisplay,
  casaActive,
}: {
  property: PropertyWithImages;
  nextAction: { label: string; color: string };
  rentDisplay: string;
  casaActive: boolean;
}) {
  const primaryImage = property.images?.find(img => img.is_primary) || property.images?.[0];

  return (
    <TouchableOpacity
      style={styles.propertyCard}
      onPress={() => router.push(`/(app)/properties/${property.id}` as any)}
      activeOpacity={0.7}
    >
      {primaryImage?.url ? (
        <Image source={{ uri: primaryImage.url }} style={styles.propertyThumb} />
      ) : (
        <View style={[styles.propertyThumb, styles.propertyThumbPlaceholder]}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z"
              stroke={THEME.colors.textTertiary}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      )}
      <View style={styles.propertyCardContent}>
        <View style={styles.propertyTitleRow}>
          <Text style={styles.propertyAddress} numberOfLines={1}>
            {property.address_line_1}
          </Text>
          {casaActive && (
            <View style={styles.casaActiveIndicator}>
              <View style={styles.casaActiveDot} />
              <Text style={styles.casaActiveLabel}>Casa</Text>
            </View>
          )}
        </View>
        <Text style={styles.propertySuburb} numberOfLines={1}>
          {property.suburb}, {property.state} {property.postcode}
        </Text>
        <View style={styles.propertyCardRow}>
          <StatusBadge status={property.status} />
          <Text style={styles.propertyRent}>{rentDisplay}</Text>
        </View>
        <Text style={[styles.propertyNextAction, { color: nextAction.color }]} numberOfLines={1}>
          {nextAction.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.filterPill, active && styles.filterPillActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyPortfolio() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18"
            stroke={THEME.colors.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2"
            stroke={THEME.colors.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={styles.emptyTitle}>Your portfolio is empty</Text>
      <Text style={styles.emptyText}>
        Add your first property to start managing it with Casa.
      </Text>
      <TouchableOpacity
        style={styles.addPropertyButton}
        onPress={() => router.push('/(app)/properties/add' as any)}
        activeOpacity={0.7}
      >
        <Text style={styles.addPropertyButtonText}>Add Property</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { properties, loading: propsLoading, refreshing, error: propsError, refreshProperties } = useProperties();
  const { tenancies } = useTenancies({ status: 'active' });
  const { requests: maintenanceRequests } = useMaintenance({ excludeCompleted: true });
  const { inspections } = useInspections({ excludeCompleted: true });
  const { arrears } = useArrears({ isResolved: false });
  const { tasks } = useAgentTasks();

  // Build set of property IDs with active Casa tasks
  const casaActivePropertyIds = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach(t => {
      if ((t.status === 'in_progress' || t.status === 'scheduled') && t.related_entity_type === 'property' && t.related_entity_id) {
        ids.add(t.related_entity_id);
      }
    });
    return ids;
  }, [tasks]);

  // Build lookup maps for next-action computation
  const tenancyMap = useMemo(() => {
    const map = new Map<string, { lease_end_date: string; rent_amount: number }>();
    tenancies.forEach(t => {
      map.set(t.property_id, { lease_end_date: t.lease_end_date, rent_amount: t.rent_amount });
    });
    return map;
  }, [tenancies]);

  const maintenanceMap = useMemo(() => {
    const map = new Map<string, number>();
    maintenanceRequests.forEach(r => {
      map.set(r.property_id, (map.get(r.property_id) || 0) + 1);
    });
    return map;
  }, [maintenanceRequests]);

  const inspectionMap = useMemo(() => {
    const map = new Map<string, { date: string; type: string }>();
    inspections.forEach(i => {
      if (i.status === 'scheduled' && i.scheduled_date) {
        const existing = map.get(i.property_id);
        if (!existing || new Date(i.scheduled_date) < new Date(existing.date)) {
          map.set(i.property_id, { date: i.scheduled_date, type: i.inspection_type });
        }
      }
    });
    return map;
  }, [inspections]);

  const arrearsMap = useMemo(() => {
    const map = new Map<string, number>();
    arrears.forEach(a => {
      if (a.tenancy?.property_id) {
        map.set(a.tenancy.property_id, (map.get(a.tenancy.property_id) || 0) + a.total_overdue);
      }
    });
    return map;
  }, [arrears]);

  // Filter properties
  const filteredProperties = useMemo(() => {
    let result = properties;

    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.address_line_1.toLowerCase().includes(q) ||
        p.suburb.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.postcode.includes(q)
      );
    }

    return result;
  }, [properties, statusFilter, searchQuery]);

  const handleRefresh = useCallback(async () => {
    await refreshProperties();
  }, [refreshProperties]);

  const formatRent = (p: PropertyWithImages) => {
    if (!p.rent_amount) return '';
    const freq = p.rent_frequency === 'weekly' ? '/wk' : p.rent_frequency === 'fortnightly' ? '/fn' : '/mo';
    return `$${Math.round(p.rent_amount).toLocaleString()}${freq}`;
  };

  const propertyCount = properties.length;
  const occupiedCount = properties.filter(p => p.status === 'occupied').length;
  const occupancyRate = propertyCount > 0 ? Math.round((occupiedCount / propertyCount) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.headerTitleRow}>
              <Image
                source={require('../../../assets/casa_logo.png')}
                style={styles.headerLogo}
              />
              <Text style={styles.headerTitle}>Portfolio</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {propertyCount} {propertyCount === 1 ? 'property' : 'properties'} · {occupancyRate}% occupied
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/(app)/trades' as any)}
              activeOpacity={0.7}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
                  stroke={THEME.colors.textPrimary}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/(app)/reports' as any)}
              activeOpacity={0.7}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 20V10M12 20V4M6 20v-6"
                  stroke={THEME.colors.textPrimary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/(app)/properties/add' as any)}
              activeOpacity={0.7}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search & Filter */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
              <Path
                d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
                stroke={THEME.colors.textTertiary}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <TextInput
              style={styles.searchInput}
              placeholder="Search properties..."
              placeholderTextColor={THEME.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.filterRow}>
          <FilterPill label="All" active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
          <FilterPill label="Leased" active={statusFilter === 'occupied'} onPress={() => setStatusFilter('occupied')} />
          <FilterPill label="Vacant" active={statusFilter === 'vacant'} onPress={() => setStatusFilter('vacant')} />
          <FilterPill label="Maintenance" active={statusFilter === 'maintenance'} onPress={() => setStatusFilter('maintenance')} />
        </View>
      </View>

      {/* Property List */}
      {propsError && properties.length === 0 ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke={THEME.colors.warning}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.errorTitle}>Unable to load properties</Text>
          <Text style={styles.errorText}>{propsError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : propsLoading && properties.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : filteredProperties.length === 0 && properties.length === 0 ? (
        <EmptyPortfolio />
      ) : (
        <FlatList
          data={filteredProperties}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              nextAction={getNextAction(item, tenancyMap, maintenanceMap, inspectionMap, arrearsMap)}
              rentDisplay={formatRent(item)}
              casaActive={casaActivePropertyIds.has(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={THEME.colors.brand}
            />
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No properties match your filters</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: THEME.colors.textPrimary,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.colors.textInverse,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  propertyCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  propertyThumb: {
    width: 88,
    height: 'auto',
    minHeight: 100,
  },
  propertyThumbPlaceholder: {
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyCardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  propertyAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  propertySuburb: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  propertyCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  propertyRent: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  propertyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  casaActiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: THEME.colors.brand + '15',
    borderRadius: THEME.radius.sm,
  },
  casaActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.brandIndigo,
  },
  casaActiveLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.brandIndigo,
  },
  propertyNextAction: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noResultsText: {
    fontSize: 15,
    color: THEME.colors.textTertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  addPropertyButton: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  addPropertyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
});
