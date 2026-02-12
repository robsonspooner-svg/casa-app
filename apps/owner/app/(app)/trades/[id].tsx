// Trade Profile Detail
// Mission 10: Tradesperson Network
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, StarRating } from '@casa/ui';
import { useTradeReviews, useTradeMutations, getSupabaseClient } from '@casa/api';
import type { TradeRow, TradeReviewWithDetails, MaintenanceCategory } from '@casa/api';

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

export default function TradeProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trade, setTrade] = useState<TradeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const { reviews, loading: reviewsLoading, summary: reviewsSummary, refreshReviews } =
    useTradeReviews(id || null);
  const { removeFromNetwork } = useTradeMutations();

  const fetchTrade = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: queryError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', id)
        .single();

      if (queryError) throw new Error(queryError.message);
      setTrade(data as unknown as TradeRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trade');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTrade();
  }, [fetchTrade]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchTrade(), refreshReviews()]);
  }, [fetchTrade, refreshReviews]);

  const handleRemoveFromNetwork = useCallback(() => {
    if (!id) return;

    Alert.alert(
      'Remove from Network',
      'Are you sure you want to remove this tradesperson from your network?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeFromNetwork(id);
              router.back();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to remove';
              Alert.alert('Error', message);
              setRemoving(false);
            }
          },
        },
      ],
    );
  }, [id, removeFromNetwork]);

  const handleCallPhone = useCallback(() => {
    if (trade?.phone) {
      Linking.openURL(`tel:${trade.phone}`);
    }
  }, [trade]);

  const handleSendEmail = useCallback(() => {
    if (trade?.email) {
      Linking.openURL(`mailto:${trade.email}`);
    }
  }, [trade]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
          <Text style={styles.headerTitle}>Trade Profile</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !trade) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
          <Text style={styles.headerTitle}>Trade Profile</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Trade not found'}</Text>
          <Button title="Retry" onPress={fetchTrade} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const initial = trade.business_name.charAt(0).toUpperCase();
  const avatarBg = getAvatarColor(trade.business_name);

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
        <Text style={styles.headerTitle}>Trade Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={THEME.colors.brand}
          />
        }
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={[styles.heroAvatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.heroAvatarText}>{initial}</Text>
          </View>
          <Text style={styles.heroBusinessName}>{trade.business_name}</Text>
          <Text style={styles.heroContactName}>{trade.contact_name}</Text>

          {/* Contact buttons */}
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactButton} onPress={handleCallPhone}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
                  stroke={THEME.colors.brand}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.contactButtonText}>{trade.phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={handleSendEmail}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6"
                  stroke={THEME.colors.brand}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.contactButtonText} numberOfLines={1}>
                {trade.email}
              </Text>
            </TouchableOpacity>
          </View>

          {trade.abn && (
            <Text style={styles.abnText}>ABN: {trade.abn}</Text>
          )}
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoryRow}>
            {trade.categories.map((cat) => (
              <View key={cat} style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>
                  {CATEGORY_LABELS[cat] || cat}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {trade.average_rating != null ? trade.average_rating.toFixed(1) : '--'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
            {trade.average_rating != null && (
              <StarRating rating={trade.average_rating} size={12} />
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{trade.total_reviews}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{trade.total_jobs}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
        </View>

        {/* Service areas */}
        {trade.service_areas && trade.service_areas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Areas</Text>
            <View style={styles.serviceAreaList}>
              {trade.service_areas.map((area, idx) => (
                <View key={idx} style={styles.serviceAreaItem}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"
                      stroke={THEME.colors.textTertiary}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M12 13a3 3 0 100-6 3 3 0 000 6z"
                      stroke={THEME.colors.textTertiary}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={styles.serviceAreaText}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <View style={styles.availabilityRow}>
            <View
              style={[
                styles.availabilityBadge,
                trade.available_weekdays && styles.availabilityBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.availabilityText,
                  trade.available_weekdays && styles.availabilityTextActive,
                ]}
              >
                Weekdays
              </Text>
            </View>
            <View
              style={[
                styles.availabilityBadge,
                trade.available_weekends && styles.availabilityBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.availabilityText,
                  trade.available_weekends && styles.availabilityTextActive,
                ]}
              >
                Weekends
              </Text>
            </View>
            <View
              style={[
                styles.availabilityBadge,
                trade.available_after_hours && styles.availabilityBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.availabilityText,
                  trade.available_after_hours && styles.availabilityTextActive,
                ]}
              >
                After Hours
              </Text>
            </View>
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Reviews
            {reviewsSummary.total > 0 && ` (${reviewsSummary.total})`}
          </Text>

          {reviewsLoading ? (
            <ActivityIndicator
              size="small"
              color={THEME.colors.brand}
              style={styles.reviewsLoading}
            />
          ) : reviews.length === 0 ? (
            <Text style={styles.noReviewsText}>No reviews yet</Text>
          ) : (
            reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Button
            title="Create Work Order"
            onPress={() =>
              router.push(
                `/(app)/work-orders/create?tradeId=${id}` as any,
              )
            }
          />
          <View style={styles.actionSpacing} />
          <Button
            title={removing ? 'Removing...' : 'Remove from Network'}
            onPress={handleRemoveFromNetwork}
            variant="secondary"
            loading={removing}
            disabled={removing}
            style={styles.removeButton}
            textStyle={styles.removeButtonText}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReviewCard({ review }: { review: TradeReviewWithDetails }) {
  const reviewerName = review.reviewer?.full_name || 'Anonymous';
  const dateStr = new Date(review.created_at).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={reviewStyles.card}>
      <View style={reviewStyles.header}>
        <View style={reviewStyles.headerLeft}>
          <Text style={reviewStyles.reviewerName}>{reviewerName}</Text>
          <StarRating rating={review.rating} size={14} />
        </View>
        <Text style={reviewStyles.date}>{dateStr}</Text>
      </View>
      {review.title && (
        <Text style={reviewStyles.title}>{review.title}</Text>
      )}
      {review.content && (
        <Text style={reviewStyles.content}>{review.content}</Text>
      )}
      {review.would_recommend != null && (
        <Text style={reviewStyles.recommend}>
          {review.would_recommend ? 'Would recommend' : 'Would not recommend'}
        </Text>
      )}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.sm,
  },
  headerLeft: {
    gap: THEME.spacing.xs,
  },
  reviewerName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  date: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  title: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  content: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  recommend: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.success,
    marginTop: THEME.spacing.sm,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  flex: {
    flex: 1,
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
  scrollContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },

  // Hero card
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginBottom: THEME.spacing.base,
    ...THEME.shadow.sm,
  },
  heroAvatar: {
    width: 80,
    height: 80,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  heroAvatarText: {
    fontSize: THEME.fontSize.display,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textInverse,
  },
  heroBusinessName: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: THEME.spacing.xs,
  },
  heroContactName: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.base,
  },
  contactRow: {
    width: '100%',
    gap: THEME.spacing.sm,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.base,
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    gap: THEME.spacing.md,
  },
  contactButtonText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
    flex: 1,
  },
  abnText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.md,
  },

  // Sections
  section: {
    marginBottom: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },

  // Categories
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  categoryChipText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    alignItems: 'center',
    ...THEME.shadow.sm,
  },
  statNumber: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    marginBottom: THEME.spacing.xs,
  },

  // Service areas
  serviceAreaList: {
    gap: THEME.spacing.sm,
  },
  serviceAreaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  serviceAreaText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },

  // Availability
  availabilityRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  availabilityBadge: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.subtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  availabilityBadgeActive: {
    backgroundColor: THEME.colors.successBg,
    borderColor: THEME.colors.success,
  },
  availabilityText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textTertiary,
  },
  availabilityTextActive: {
    color: THEME.colors.success,
  },

  // Reviews
  reviewsLoading: {
    paddingVertical: THEME.spacing.lg,
  },
  noReviewsText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
  },

  // Actions
  actionsSection: {
    marginTop: THEME.spacing.lg,
  },
  actionSpacing: {
    height: THEME.spacing.md,
  },
  removeButton: {
    borderColor: THEME.colors.error,
  },
  removeButtonText: {
    color: THEME.colors.error,
  },
});
