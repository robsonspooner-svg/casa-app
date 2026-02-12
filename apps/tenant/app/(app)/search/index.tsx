// Listing Search Screen (Tenant) - Mission 04: Enhanced Marketplace
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { SearchInput, THEME } from '@casa/ui';
import { usePublicListings, ListingWithDetails, PublicListingsSearchParams, useSavedSearches, useFavourites } from '@casa/api';

function formatRentFrequency(frequency: string): string {
  switch (frequency) {
    case 'weekly': return '/wk';
    case 'fortnightly': return '/fn';
    case 'monthly': return '/mo';
    default: return '';
  }
}

type SortOption = 'newest' | 'price_low' | 'price_high';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low' },
  { value: 'price_high', label: 'Price: High' },
];

const PROPERTY_TYPES = [
  { value: '', label: 'All' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'unit', label: 'Unit' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'studio', label: 'Studio' },
];

const BED_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 1, label: '1+' },
  { value: 2, label: '2+' },
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ListingSearchCard({ listing, onPress, isFav, onToggleFav }: { listing: ListingWithDetails; onPress: () => void; isFav: boolean; onToggleFav: () => void }) {
  const primaryImage = listing.property?.images?.find(img => img.is_primary) || listing.property?.images?.[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardImageContainer}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage.url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        )}
        {listing.pets_allowed && (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>Pets OK</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.cardFavButton}
          onPress={(e) => { e.stopPropagation(); onToggleFav(); }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill={isFav ? THEME.colors.error : 'none'}>
            <Path
              d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
              stroke={isFav ? THEME.colors.error : THEME.colors.textInverse}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
        {listing.property && (
          <Text style={styles.cardAddress} numberOfLines={1}>
            {listing.property.address_line_1}, {listing.property.suburb}
          </Text>
        )}
        <View style={styles.cardDetailsRow}>
          {listing.property && (
            <Text style={styles.cardSpecs}>
              {listing.property.bedrooms} bed · {listing.property.bathrooms} bath · {listing.property.parking_spaces} park
            </Text>
          )}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.cardRent}>
            <Text style={styles.cardRentAmount}>${listing.rent_amount}</Text>
            <Text style={styles.cardRentFrequency}>{formatRentFrequency(listing.rent_frequency)}</Text>
          </View>
          <Text style={styles.cardAvailable}>
            Avail {new Date(listing.available_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<PublicListingsSearchParams>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  const { saveSearch } = useSavedSearches();
  const [savingSearch, setSavingSearch] = useState(false);
  const { isFavourite, toggleFavourite } = useFavourites();

  // Temp filter state for filter modal
  const [tempMinRent, setTempMinRent] = useState('');
  const [tempMaxRent, setTempMaxRent] = useState('');
  const [tempBeds, setTempBeds] = useState(0);
  const [tempPropertyType, setTempPropertyType] = useState('');
  const [tempPets, setTempPets] = useState(false);
  const [tempFurnished, setTempFurnished] = useState(false);

  const activeParams = useMemo(() => ({
    ...filters,
    sortBy,
  }), [filters, sortBy]);

  const { listings, loading, refreshing, refreshListings, searchListings } = usePublicListings(activeParams);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minRent) count++;
    if (filters.maxRent) count++;
    if (filters.minBedrooms && filters.minBedrooms > 0) count++;
    if (filters.propertyType) count++;
    if (filters.petsAllowed) count++;
    if (filters.furnished) count++;
    return count;
  }, [filters]);

  const handleSearch = useCallback(() => {
    const newFilters = {
      ...filters,
      suburb: searchText.trim() || undefined,
    };
    setFilters(newFilters);
    searchListings({ ...newFilters, sortBy });
  }, [searchText, filters, sortBy, searchListings]);

  const openFilters = useCallback(() => {
    setTempMinRent(filters.minRent ? String(filters.minRent) : '');
    setTempMaxRent(filters.maxRent ? String(filters.maxRent) : '');
    setTempBeds(filters.minBedrooms || 0);
    setTempPropertyType(filters.propertyType || '');
    setTempPets(filters.petsAllowed || false);
    setTempFurnished(filters.furnished || false);
    setShowFilters(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    const newFilters: PublicListingsSearchParams = {
      suburb: searchText.trim() || undefined,
      minRent: tempMinRent ? Number(tempMinRent) : undefined,
      maxRent: tempMaxRent ? Number(tempMaxRent) : undefined,
      minBedrooms: tempBeds > 0 ? tempBeds : undefined,
      propertyType: tempPropertyType || undefined,
      petsAllowed: tempPets || undefined,
      furnished: tempFurnished || undefined,
    };
    setFilters(newFilters);
    searchListings({ ...newFilters, sortBy });
    setShowFilters(false);
  }, [searchText, tempMinRent, tempMaxRent, tempBeds, tempPropertyType, tempPets, tempFurnished, sortBy, searchListings]);

  const clearFilters = useCallback(() => {
    setTempMinRent('');
    setTempMaxRent('');
    setTempBeds(0);
    setTempPropertyType('');
    setTempPets(false);
    setTempFurnished(false);
  }, []);

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSortBy(newSort);
    setShowSortMenu(false);
    searchListings({ ...filters, suburb: searchText.trim() || undefined, sortBy: newSort });
  }, [filters, searchText, searchListings]);

  const handleSaveSearch = useCallback(async () => {
    if (!saveSearchName.trim() || savingSearch) return;
    setSavingSearch(true);
    const filtersToSave = {
      ...filters,
      suburb: searchText.trim() || undefined,
    };
    const success = await saveSearch(saveSearchName.trim(), filtersToSave);
    setSavingSearch(false);
    if (success) {
      setShowSaveSearch(false);
      setSaveSearchName('');
      Alert.alert('Saved', 'Your search has been saved. You\'ll be notified of new matches.');
    }
  }, [saveSearchName, savingSearch, filters, searchText, saveSearch]);

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search</Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by suburb..."
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          <FilterChip
            label={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            active={activeFilterCount > 0}
            onPress={openFilters}
          />
          <FilterChip
            label={SORT_OPTIONS.find(s => s.value === sortBy)?.label || 'Sort'}
            active={sortBy !== 'newest'}
            onPress={() => setShowSortMenu(true)}
          />
          <FilterChip
            label="Save Search"
            active={false}
            onPress={() => setShowSaveSearch(true)}
          />
        </ScrollView>
        <Text style={styles.resultCount}>{listings.length} listing{listings.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Results */}
      <FlatList
        data={listings}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ListingSearchCard
            listing={item}
            onPress={() => router.push(`/(app)/search/${item.id}` as Href)}
            isFav={isFavourite(item.id)}
            onToggleFav={() => toggleFavourite(item.id)}
          />
        )}
        contentContainerStyle={listings.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>No listings found</Text>
            <Text style={styles.emptyText}>
              Try searching a different suburb or adjusting your filters.
            </Text>
          </View>
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

      {/* Sort Menu Modal */}
      <Modal visible={showSortMenu} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortMenu(false)}
        >
          <View style={styles.sortMenu}>
            <Text style={styles.sortMenuTitle}>Sort By</Text>
            {SORT_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[styles.sortOption, sortBy === option.value && styles.sortOptionActive]}
                onPress={() => handleSortChange(option.value)}
              >
                <Text style={[styles.sortOptionText, sortBy === option.value && styles.sortOptionTextActive]}>
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Save Search Modal */}
      <Modal visible={showSaveSearch} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSaveSearch(false)}
        >
          <View style={styles.sortMenu} onStartShouldSetResponder={() => true}>
            <Text style={styles.sortMenuTitle}>Save Search</Text>
            <Text style={styles.saveSearchHint}>
              Get notified when new listings match your filters.
            </Text>
            <View style={styles.rentInput}>
              <TextInput
                style={styles.rentInputField}
                value={saveSearchName}
                onChangeText={setSaveSearchName}
                placeholder="Search name (e.g. Bondi 2BR)"
                placeholderTextColor={THEME.colors.textTertiary}
                autoFocus
              />
            </View>
            <View style={styles.saveSearchActions}>
              <TouchableOpacity onPress={() => setShowSaveSearch(false)}>
                <Text style={styles.filterModalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveSearchButton, (!saveSearchName.trim() || savingSearch) && styles.saveSearchButtonDisabled]}
                onPress={handleSaveSearch}
                disabled={!saveSearchName.trim() || savingSearch}
                activeOpacity={0.8}
              >
                <Text style={styles.saveSearchButtonText}>{savingSearch ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filters Modal */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.filterModal}>
          <View style={styles.filterModalHeader}>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={styles.filterModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.filterModalTitle}>Filters</Text>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.filterModalClear}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterModalContent} showsVerticalScrollIndicator={false}>
            {/* Rent Range */}
            <Text style={styles.filterSectionTitle}>Rent Range ($/wk)</Text>
            <View style={styles.rentRangeRow}>
              <View style={styles.rentInput}>
                <TextInput
                  style={styles.rentInputField}
                  value={tempMinRent}
                  onChangeText={setTempMinRent}
                  placeholder="Min"
                  keyboardType="number-pad"
                  placeholderTextColor={THEME.colors.textTertiary}
                />
              </View>
              <Text style={styles.rentRangeDash}>–</Text>
              <View style={styles.rentInput}>
                <TextInput
                  style={styles.rentInputField}
                  value={tempMaxRent}
                  onChangeText={setTempMaxRent}
                  placeholder="Max"
                  keyboardType="number-pad"
                  placeholderTextColor={THEME.colors.textTertiary}
                />
              </View>
            </View>

            {/* Bedrooms */}
            <Text style={styles.filterSectionTitle}>Bedrooms</Text>
            <View style={styles.optionRow}>
              {BED_OPTIONS.map(option => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  active={tempBeds === option.value}
                  onPress={() => setTempBeds(option.value)}
                />
              ))}
            </View>

            {/* Property Type */}
            <Text style={styles.filterSectionTitle}>Property Type</Text>
            <View style={styles.optionRow}>
              {PROPERTY_TYPES.map(type => (
                <FilterChip
                  key={type.value}
                  label={type.label}
                  active={tempPropertyType === type.value}
                  onPress={() => setTempPropertyType(type.value)}
                />
              ))}
            </View>

            {/* Toggle Filters */}
            <Text style={styles.filterSectionTitle}>Preferences</Text>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setTempPets(!tempPets)}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Pets allowed</Text>
              <View style={[styles.toggleTrack, tempPets && styles.toggleTrackActive]}>
                <View style={[styles.toggleThumb, tempPets && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setTempFurnished(!tempFurnished)}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Furnished</Text>
              <View style={[styles.toggleTrack, tempFurnished && styles.toggleTrackActive]}>
                <View style={[styles.toggleThumb, tempFurnished && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Apply Button */}
          <View style={styles.filterModalFooter}>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters} activeOpacity={0.8}>
              <Text style={styles.applyButtonText}>Show Results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.sm,
  },

  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
  },
  filterChips: {
    paddingHorizontal: THEME.spacing.base,
    gap: THEME.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  filterChipText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  filterChipTextActive: {
    color: THEME.colors.textInverse,
  },
  resultCount: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginLeft: 'auto',
  },

  // List
  listContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
    gap: THEME.spacing.md,
  },
  emptyListContent: {
    flex: 1,
  },

  // Card
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardImageContainer: {
    height: 160,
    backgroundColor: THEME.colors.subtle,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: THEME.spacing.sm,
    left: THEME.spacing.sm,
    backgroundColor: THEME.colors.success,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  cardContent: {
    padding: THEME.spacing.base,
  },
  cardTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  cardAddress: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  cardDetailsRow: {
    marginTop: THEME.spacing.sm,
  },
  cardSpecs: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: THEME.spacing.md,
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
    marginLeft: 2,
  },
  cardAvailable: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  cardFavButton: {
    position: 'absolute',
    top: THEME.spacing.sm,
    right: THEME.spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
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
  },

  // Sort Menu
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
  },
  sortMenu: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    width: '100%',
    maxWidth: 300,
  },
  sortMenuTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  sortOptionActive: {
    borderBottomColor: THEME.colors.brand,
  },
  sortOptionText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  sortOptionTextActive: {
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.semibold,
  },

  // Filter Modal
  filterModal: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  filterModalCancel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  filterModalTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  filterModalClear: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
  },
  filterModalContent: {
    flex: 1,
    padding: THEME.spacing.base,
  },
  filterSectionTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
  },
  rentRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  rentInput: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.md,
  },
  rentInputField: {
    height: 44,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  rentRangeDash: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  toggleLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: THEME.colors.brand,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.surface,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },

  // Filter Modal Footer
  filterModalFooter: {
    padding: THEME.spacing.base,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  applyButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textInverse,
  },

  // Save Search Modal
  saveSearchHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  saveSearchActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: THEME.spacing.md,
  },
  saveSearchButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.sm,
  },
  saveSearchButtonDisabled: {
    opacity: 0.5,
  },
  saveSearchButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textInverse,
  },
});
