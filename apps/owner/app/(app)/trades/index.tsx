// My Trade Network - Owner View
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, StarRating } from '@casa/ui';
import { useMyTrades, useTradeMutations } from '@casa/api';
import type { MaintenanceCategory, TradeWithNetwork } from '@casa/api';

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

type FilterMode = 'all' | 'favorites' | MaintenanceCategory;

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

export default function MyTradeNetwork() {
  const [activeFilter, setActiveFilter] = useState<FilterMode>('all');

  const filter = {
    favoritesOnly: activeFilter === 'favorites',
    category: ALL_CATEGORIES.includes(activeFilter as MaintenanceCategory)
      ? (activeFilter as MaintenanceCategory)
      : undefined,
  };

  const { trades, loading, error, refreshing, refreshTrades, summary } = useMyTrades(
    filter.favoritesOnly || filter.category ? filter : undefined,
  );
  const { toggleFavorite } = useTradeMutations();

  const handleToggleFavorite = useCallback(
    async (tradeId: string, currentFavorite: boolean) => {
      try {
        await toggleFavorite(tradeId, !currentFavorite);
        refreshTrades();
      } catch {
        // Error handled silently; refresh to revert UI
        refreshTrades();
      }
    },
    [toggleFavorite, refreshTrades],
  );

  const renderTradeCard = ({ item }: { item: TradeWithNetwork }) => {
    const initial = item.business_name.charAt(0).toUpperCase();
    const avatarBg = getAvatarColor(item.business_name);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/trades/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.businessName} numberOfLines={1}>
                {item.business_name}
              </Text>
              <TouchableOpacity
                onPress={() => handleToggleFavorite(item.id, item.is_favorite)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.favoriteButton}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                    stroke={item.is_favorite ? THEME.colors.error : THEME.colors.textTertiary}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill={item.is_favorite ? THEME.colors.error : 'none'}
                  />
                </Svg>
              </TouchableOpacity>
            </View>

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
        <Text style={styles.headerTitle}>My Trades</Text>
        <TouchableOpacity
          onPress={() => router.push('/(app)/trades/search' as any)}
          style={styles.backButton}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
              stroke={THEME.colors.textPrimary}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Summary row */}
      {!loading && summary.total > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{summary.favorites}</Text>
            <Text style={styles.summaryLabel}>Favorites</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {Object.keys(summary.byCategory).length}
            </Text>
            <Text style={styles.summaryLabel}>Categories</Text>
          </View>
        </View>
      )}

      {/* Filter chips — always pinned below header */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              activeFilter === 'favorites' && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter('favorites')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'favorites' && styles.filterChipTextActive,
              ]}
            >
              Favorites
            </Text>
          </TouchableOpacity>
          {ALL_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                activeFilter === cat && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(cat)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === cat && styles.filterChipTextActive,
                ]}
              >
                {CATEGORY_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
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
          <Text style={styles.emptyTitle}>No trades in your network yet</Text>
          <Text style={styles.emptySubtext}>
            Search for tradespeople or add them manually to build your network.
          </Text>
        </View>
      ) : (
        <FlatList
          data={trades}
          renderItem={renderTradeCard}
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

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/trades/add' as any)}
        activeOpacity={0.8}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14M5 12h14"
            stroke={THEME.colors.textInverse}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
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
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    alignItems: 'center',
    ...THEME.shadow.sm,
  },
  summaryNumber: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  summaryLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  filterRow: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
    gap: THEME.spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    height: 36,
    justifyContent: 'center',
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
    padding: THEME.spacing.base,
    ...THEME.shadow.sm,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  businessName: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  favoriteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
  fab: {
    position: 'absolute',
    bottom: THEME.spacing.base,
    right: THEME.spacing.base,
    width: THEME.components.fab.size,
    height: THEME.components.fab.size,
    borderRadius: THEME.components.fab.borderRadius,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow.lg,
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
