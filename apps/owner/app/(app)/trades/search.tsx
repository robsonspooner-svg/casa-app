// Find Trades - Search & Browse
// Mission 10: Tradesperson Network
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, SearchInput, StarRating } from '@casa/ui';
import { useTrades, useTradeMutations } from '@casa/api';
import type { MaintenanceCategory, TradeRow } from '@casa/api';

const CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  appliance: 'Appliance',
  hvac: 'HVAC',
  structural: 'Structural',
  pest: 'Pest Control',
  locks_security: 'Locks & Security',
  garden_outdoor: 'Garden & Outdoor',
  cleaning: 'Cleaning',
  other: 'Other',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as MaintenanceCategory[];

function getAvatarColor(name: string): string {
  const colors = [
    '#4338CA', '#7C3AED', '#2563EB', '#0891B2',
    '#059669', '#CA8A04', '#DC2626', '#DB2777',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function FindTrades() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaintenanceCategory | null>(null);
  const [addingTradeId, setAddingTradeId] = useState<string | null>(null);

  const filter = {
    searchTerm: searchTerm.length >= 2 ? searchTerm : undefined,
    category: selectedCategory || undefined,
  };

  const { trades, loading, error, refreshing, refreshTrades } = useTrades(
    filter.searchTerm || filter.category ? filter : undefined,
  );
  const { addToNetwork } = useTradeMutations();

  const handleAddToNetwork = useCallback(
    async (tradeId: string) => {
      setAddingTradeId(tradeId);
      try {
        await addToNetwork(tradeId);
        Alert.alert('Added', 'Trade added to your network.');
        refreshTrades();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add trade';
        Alert.alert('Error', message);
      } finally {
        setAddingTradeId(null);
      }
    },
    [addToNetwork, refreshTrades],
  );

  const renderTradeResult = ({ item }: { item: TradeRow }) => {
    const initial = item.business_name.charAt(0).toUpperCase();
    const avatarBg = getAvatarColor(item.business_name);
    const isAdding = addingTradeId === item.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          onPress={() => router.push(`/(app)/trades/${item.id}` as any)}
          activeOpacity={0.7}
          style={styles.cardTouchable}
        >
          <View style={styles.cardRow}>
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.businessName} numberOfLines={1}>
                {item.business_name}
              </Text>
              <Text style={styles.contactName} numberOfLines={1}>
                {item.contact_name}
              </Text>

              {/* Category chips */}
              <View style={styles.categoryRow}>
                {item.categories.slice(0, 3).map((cat) => (
                  <View key={cat} style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>
                      {CATEGORY_LABELS[cat] || cat}
                    </Text>
                  </View>
                ))}
                {item.categories.length > 3 && (
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>
                      +{item.categories.length - 3}
                    </Text>
                  </View>
                )}
              </View>

              {/* Rating and jobs */}
              <View style={styles.cardFooter}>
                <View style={styles.ratingRow}>
                  {item.average_rating != null ? (
                    <>
                      <StarRating rating={item.average_rating} size={14} />
                      <Text style={styles.ratingText}>
                        {item.average_rating.toFixed(1)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.noRatingText}>No reviews</Text>
                  )}
                </View>
                <Text style={styles.jobsText}>
                  {item.total_jobs} {item.total_jobs === 1 ? 'job' : 'jobs'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Add to network button */}
        <View style={styles.addButtonContainer}>
          <Button
            title={isAdding ? 'Adding...' : 'Add to Network'}
            onPress={() => handleAddToNetwork(item.id)}
            variant="secondary"
            loading={isAdding}
            disabled={isAdding}
            fullWidth
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke={THEME.colors.textPrimary}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Trades</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <SearchInput
          placeholder="Search by name..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedCategory === null && styles.filterChipActive,
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedCategory === null && styles.filterChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {ALL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterChip,
              selectedCategory === cat && styles.filterChipActive,
            ]}
            onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === cat && styles.filterChipTextActive,
              ]}
            >
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={refreshTrades} variant="secondary" />
        </View>
      ) : trades.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No trades found</Text>
          <Text style={styles.emptySubtext}>
            {searchTerm
              ? 'Try a different search term or category.'
              : 'No trades are currently available.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={trades}
          renderItem={renderTradeResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshTrades}
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
  searchContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
  },
  filterRow: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
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
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    marginBottom: THEME.spacing.md,
    overflow: 'hidden',
    ...THEME.shadow.sm,
  },
  cardTouchable: {
    padding: THEME.spacing.base,
  },
  cardRow: {
    flexDirection: 'row',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.md,
  },
  avatarText: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: '#FFFFFF',
  },
  cardContent: {
    flex: 1,
  },
  businessName: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  contactName: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.xs,
    marginBottom: THEME.spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.subtle,
  },
  categoryChipText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.xs,
  },
  ratingText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  noRatingText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  jobsText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  addButtonContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.base,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  emptySubtext: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
});
