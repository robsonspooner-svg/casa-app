// Public Listing View (Tenant) - Mission 04: Property Listings
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Chip, Button, THEME } from '@casa/ui';
import { usePublicListings, ListingWithDetails, useFavourites } from '@casa/api';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@casa/api';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatLeaseTerm(term: string): string {
  switch (term) {
    case '6_months': return '6 months';
    case '12_months': return '12 months';
    case '24_months': return '24 months';
    case 'flexible': return 'Flexible';
    default: return term;
  }
}

function formatRentFrequency(frequency: string): string {
  switch (frequency) {
    case 'weekly': return 'per week';
    case 'fortnightly': return 'per fortnight';
    case 'monthly': return 'per month';
    default: return '';
  }
}

export default function PublicListingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<ListingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isFavourite, toggleFavourite } = useFavourites();
  const isFav = id ? isFavourite(id) : false;

  useEffect(() => {
    async function fetchListing() {
      if (!id) {
        setLoading(false);
        setError('Listing not found');
        return;
      }

      try {
        const supabase = getSupabaseClient();

        // Fetch listing (public - active listings only)
        const { data: listingData, error: listingError } = await (supabase
          .from('listings') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('id', id)
          .eq('status', 'active')
          .single();

        if (listingError) throw listingError;

        // Fetch features
        const { data: featuresData } = await (supabase
          .from('listing_features') as ReturnType<typeof supabase.from>)
          .select('feature')
          .eq('listing_id', id);

        // Fetch property
        const { data: propertyData } = await (supabase
          .from('properties') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('id', (listingData as any).property_id)
          .single();

        // Fetch property images
        let images: any[] = [];
        if (propertyData) {
          const { data: imagesData } = await (supabase
            .from('property_images') as ReturnType<typeof supabase.from>)
            .select('*')
            .eq('property_id', (propertyData as any).id)
            .order('display_order', { ascending: true });
          images = imagesData || [];
        }

        // Increment view count
        await (supabase.rpc as any)('increment_listing_views', { listing_uuid: id });

        setListing({
          ...(listingData as any),
          features: ((featuresData || []) as any[]).map(f => f.feature),
          property: propertyData ? { ...(propertyData as any), images } : undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    }

    fetchListing();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Listing</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Listing</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Listing not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </View>
    );
  }

  const primaryImage = listing.property?.images?.find((img: any) => img.is_primary) || listing.property?.images?.[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Listing</Text>
        <TouchableOpacity
          style={styles.favouriteButton}
          onPress={() => id && toggleFavourite(id)}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={isFav ? THEME.colors.error : 'none'}>
            <Path
              d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
              stroke={isFav ? THEME.colors.error : THEME.colors.textSecondary}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        {primaryImage ? (
          <Image source={{ uri: primaryImage.url }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        )}

        {/* Title & Address */}
        <View style={styles.section}>
          <Text style={styles.listingTitle}>{listing.title}</Text>
          {listing.property && (
            <Text style={styles.address}>
              {listing.property.address_line_1}, {listing.property.suburb} {listing.property.state} {listing.property.postcode}
            </Text>
          )}
        </View>

        {/* Rent */}
        <View style={styles.rentSection}>
          <Text style={styles.rentAmount}>${listing.rent_amount}</Text>
          <Text style={styles.rentFrequency}>{formatRentFrequency(listing.rent_frequency)}</Text>
        </View>

        {/* Property Specs */}
        {listing.property && (
          <View style={styles.specsRow}>
            <View style={styles.specItem}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M3 7v11a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.specText}>{listing.property.bedrooms} Bed</Text>
            </View>
            <View style={styles.specItem}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M4 12h16v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5zM6 12V5a2 2 0 012-2h2a2 2 0 012 2v7" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.specText}>{listing.property.bathrooms} Bath</Text>
            </View>
            <View style={styles.specItem}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 17H5l7-12 7 12zM5 17v2h14v-2" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.specText}>{listing.property.parking_spaces} Park</Text>
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Available</Text>
            <Text style={styles.detailValue}>{formatDate(listing.available_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Lease Term</Text>
            <Text style={styles.detailValue}>{formatLeaseTerm(listing.lease_term)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bond</Text>
            <Text style={styles.detailValue}>{listing.bond_weeks} weeks</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pets</Text>
            <Text style={styles.detailValue}>{listing.pets_allowed ? 'Allowed' : 'Not allowed'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Smoking</Text>
            <Text style={styles.detailValue}>{listing.smoking_allowed ? 'Allowed' : 'Not allowed'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Furnished</Text>
            <Text style={styles.detailValue}>{listing.furnished ? 'Yes' : 'No'}</Text>
          </View>
        </View>

        {/* Description */}
        {listing.description && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About this property</Text>
            <Text style={styles.descriptionText}>{listing.description}</Text>
          </View>
        )}

        {/* Features */}
        {listing.features.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featureChips}>
              {listing.features.map(feature => (
                <Chip key={feature} label={feature} selected />
              ))}
            </View>
          </View>
        )}

        {/* Apply Button */}
        <View style={styles.applyContainer}>
          <Button
            title="Apply Now"
            onPress={() => {
              router.push(`/(app)/applications/apply?listingId=${id}` as Href);
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

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
  favouriteButton: {
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
    gap: THEME.spacing.lg,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  content: {
    paddingBottom: THEME.spacing.xl * 2,
  },
  heroImage: {
    width: '100%',
    height: 220,
  },
  heroPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    padding: THEME.spacing.base,
  },
  listingTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  address: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  rentSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.lg,
  },
  rentAmount: {
    fontSize: THEME.fontSize.display,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  rentFrequency: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginLeft: THEME.spacing.sm,
  },
  specsRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.lg,
    gap: THEME.spacing.xl,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  specText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    fontWeight: THEME.fontWeight.medium,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    marginHorizontal: THEME.spacing.base,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  descriptionText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
  },
  featureChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  applyContainer: {
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.lg,
  },
});
