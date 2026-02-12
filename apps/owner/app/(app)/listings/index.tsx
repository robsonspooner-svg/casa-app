// Listings List Screen - Mission 04: Property Listings
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
import { useRouter, Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Badge, THEME } from '@casa/ui';
import {
  useListings,
  ListingStatus,
  ListingWithDetails,
} from '@casa/api';

type FilterOption = 'all' | ListingStatus;

const FILTERS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Drafts' },
  { key: 'paused', label: 'Paused' },
  { key: 'closed', label: 'Closed' },
];

function getStatusVariant(status: ListingStatus): 'success' | 'info' | 'warning' | 'neutral' {
  switch (status) {
    case 'active':
      return 'success';
    case 'draft':
      return 'info';
    case 'paused':
      return 'warning';
    case 'closed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function formatRentFrequency(frequency: string): string {
  switch (frequency) {
    case 'weekly':
      return '/wk';
    case 'fortnightly':
      return '/fn';
    case 'monthly':
      return '/mo';
    default:
      return '';
  }
}

function ListingCard({ listing, onPress }: { listing: ListingWithDetails; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
          <Badge label={listing.status} variant={getStatusVariant(listing.status)} />
        </View>
        {listing.property && (
          <Text style={styles.cardAddress} numberOfLines={1}>
            {listing.property.address_line_1}, {listing.property.suburb}
          </Text>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.cardRent}>
          <Text style={styles.cardRentAmount}>${listing.rent_amount}</Text>
          <Text style={styles.cardRentFrequency}>{formatRentFrequency(listing.rent_frequency)}</Text>
        </View>

        <View style={styles.cardStats}>
          {listing.status === 'active' && (
            <>
              <View style={styles.cardStat}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.cardStatText}>{listing.view_count}</Text>
              </View>
              <View style={styles.cardStat}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.cardStatText}>{listing.application_count}</Text>
              </View>
            </>
          )}
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ filter, onCreatePress }: { filter: FilterOption; onCreatePress: () => void }) {
  const message = filter === 'all'
    ? 'Create your first listing to start finding tenants.'
    : `No ${filter} listings found.`;

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
          <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <Text style={styles.emptyTitle}>No listings</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {filter === 'all' && (
        <TouchableOpacity style={styles.emptyButton} onPress={onCreatePress} activeOpacity={0.7}>
          <Text style={styles.emptyButtonText}>Create Listing</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ListingsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  const filterParam = activeFilter === 'all' ? undefined : activeFilter;
  const { listings, loading, refreshing, refreshListings } = useListings(
    filterParam ? { status: filterParam } : undefined
  );

  const handleCreateListing = () => {
    router.push('/(app)/listings/create' as Href);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Listings</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Listings</Text>
        <TouchableOpacity onPress={handleCreateListing} style={styles.addButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        {FILTERS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterPill, activeFilter === key && styles.filterPillActive]}
            onPress={() => setActiveFilter(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, activeFilter === key && styles.filterPillTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Listings List */}
      <FlatList
        data={listings}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onPress={() => router.push(`/(app)/listings/${item.id}` as Href)}
          />
        )}
        contentContainerStyle={listings.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={
          <EmptyState filter={activeFilter} onCreatePress={handleCreateListing} />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshListings}
            tintColor={THEME.colors.brand}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
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
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  filterPill: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.subtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  filterPillText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.colors.textInverse,
  },
  listContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
    gap: THEME.spacing.md,
  },
  emptyListContent: {
    flex: 1,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardHeader: {
    marginBottom: THEME.spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  cardAddress: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardRent: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cardRentAmount: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  cardRentFrequency: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginLeft: THEME.spacing.xs,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  cardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardStatText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.base,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: THEME.spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.md,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
  },
  emptyButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textInverse,
  },
});
