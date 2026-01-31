// Properties List Screen - Mission 03: Properties CRUD
import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, THEME } from '@casa/ui';
import { useProperties, PropertyWithImages, PropertyStatus } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

function getStatusVariant(status: PropertyStatus): 'success' | 'info' | 'warning' | 'neutral' {
  switch (status) {
    case 'occupied':
      return 'success';
    case 'maintenance':
      return 'info';
    case 'vacant':
      return 'warning';
    default:
      return 'neutral';
  }
}

function getStatusLabel(status: PropertyStatus): string {
  switch (status) {
    case 'occupied':
      return 'Leased';
    case 'maintenance':
      return 'Maintenance';
    case 'vacant':
      return 'Vacant';
    default:
      return status;
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

function PropertyCard({ property, onPress }: { property: PropertyWithImages; onPress: () => void }) {
  const primaryImage = property.images.find(img => img.is_primary) || property.images[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Image */}
      <View style={styles.cardImageContainer}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage.url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
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
        <View style={styles.cardBadgeContainer}>
          <Badge label={getStatusLabel(property.status)} variant={getStatusVariant(property.status)} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={styles.cardAddress} numberOfLines={1}>
          {property.address_line_1}
        </Text>
        <Text style={styles.cardSuburb} numberOfLines={1}>
          {property.suburb}, {property.state} {property.postcode}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardRent}>
            ${property.rent_amount}{formatRentFrequency(property.rent_frequency)}
          </Text>
          <View style={styles.cardDetails}>
            <Text style={styles.cardDetailText}>{property.bedrooms} bed</Text>
            <Text style={styles.cardDetailDot}>·</Text>
            <Text style={styles.cardDetailText}>{property.bathrooms} bath</Text>
            {property.parking_spaces > 0 && (
              <>
                <Text style={styles.cardDetailDot}>·</Text>
                <Text style={styles.cardDetailText}>{property.parking_spaces} car</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z"
            stroke={THEME.colors.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={styles.emptyTitle}>No properties yet</Text>
      <Text style={styles.emptyDescription}>
        Add your first rental property to start managing it with Casa
      </Text>
      <Button title="Add Property" onPress={onAdd} />
    </View>
  );
}

export default function PropertiesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { properties, loading, refreshing, error, refreshProperties } = useProperties();

  const handleAddProperty = useCallback(() => {
    router.push('/(app)/properties/add' as Href);
  }, [router]);

  const handlePropertyPress = useCallback((id: string) => {
    router.push(`/(app)/properties/${id}` as Href);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: PropertyWithImages }) => (
    <PropertyCard property={item} onPress={() => handlePropertyPress(item.id)} />
  ), [handlePropertyPress]);

  const keyExtractor = useCallback((item: PropertyWithImages) => item.id, []);

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
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
          <Text style={styles.headerTitle}>Properties</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <Text style={styles.headerTitle}>Properties</Text>
        {properties.length > 0 ? (
          <TouchableOpacity onPress={handleAddProperty} style={styles.addButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 5v14M5 12h14"
                stroke={THEME.colors.brand}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* Error State */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* List or Empty State */}
      {properties.length === 0 && !loading ? (
        <EmptyState onAdd={handleAddProperty} />
      ) : (
        <FlatList
          data={properties}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshProperties}
              tintColor={THEME.colors.brand}
              colors={[THEME.colors.brand]}
            />
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
  errorBanner: {
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    padding: THEME.spacing.md,
    backgroundColor: THEME.colors.errorBg,
    borderRadius: THEME.radius.md,
  },
  errorText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  listContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  // Card Styles
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    marginBottom: THEME.spacing.md,
    overflow: 'hidden',
    ...THEME.shadow.sm,
  },
  cardImageContainer: {
    height: 160,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeContainer: {
    position: 'absolute',
    top: THEME.spacing.md,
    left: THEME.spacing.md,
  },
  cardContent: {
    padding: THEME.spacing.base,
  },
  cardAddress: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  cardSuburb: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: THEME.spacing.md,
  },
  cardRent: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDetailText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  cardDetailDot: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginHorizontal: THEME.spacing.xs,
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.lg,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
    lineHeight: 22,
  },
});
