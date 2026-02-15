// Listing Detail Screen - Mission 04: Property Listings
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Badge, Chip, Button, THEME, useToast } from '@casa/ui';
import { useListing, useListingMutations, ListingStatus } from '@casa/api';

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

export default function ListingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listing, loading, error } = useListing(id || null);
  const { publishListing, pauseListing, closeListing, deleteListing } = useListingMutations();
  const toast = useToast();
  const [actionLoading, setActionLoading] = useState(false);

  const handlePublish = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await publishListing(id);
      toast.success('Listing published successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish listing');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    Alert.alert('Pause Listing', 'Are you sure you want to pause this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pause',
        onPress: async () => {
          setActionLoading(true);
          try {
            await pauseListing(id);
            toast.success('Listing paused.');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to pause listing');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleClose = async () => {
    if (!id) return;
    Alert.alert('Close Listing', 'Are you sure you want to close this listing? It will no longer be visible to tenants.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await closeListing(id, 'Manually closed');
            toast.success('Listing closed.');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to close listing');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Listing', 'Are you sure you want to delete this listing? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await deleteListing(id);
            toast.success('Listing deleted.');
            router.back();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete listing');
            setActionLoading(false);
          }
        },
      },
    ]);
  };

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
          onPress={() => router.push(`/(app)/listings/${id}/edit` as Href)}
          style={styles.editButton}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title & Status */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.listingTitle}>{listing.title}</Text>
            <Badge label={listing.status} variant={getStatusVariant(listing.status)} />
          </View>
          {listing.property && (
            <Text style={styles.address}>
              {listing.property.address_line_1}, {listing.property.suburb} {listing.property.state}
            </Text>
          )}
        </View>

        {/* Stats */}
        {listing.status === 'active' && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{listing.view_count}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push(`/(app)/listings/${id}/applications` as Href)}
              activeOpacity={0.7}
            >
              <Text style={styles.statNumber}>{listing.application_count}</Text>
              <Text style={styles.statLabelLink}>Applications</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* View Applications Button */}
        {(listing.status === 'active' || listing.status === 'paused' || listing.status === 'closed') && listing.application_count > 0 && (
          <TouchableOpacity
            style={styles.applicationsButton}
            onPress={() => router.push(`/(app)/listings/${id}/applications` as Href)}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2M9 7a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.applicationsButtonText}>
              View Applications ({listing.application_count})
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}

        {/* Rent & Terms */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rent & Terms</Text>
          <View style={styles.rentRow}>
            <Text style={styles.rentAmount}>${listing.rent_amount}</Text>
            <Text style={styles.rentFrequency}>{formatRentFrequency(listing.rent_frequency)}</Text>
          </View>
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
        </View>

        {/* Description */}
        {listing.description && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{listing.description}</Text>
          </View>
        )}

        {/* Policies */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Policies</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pets</Text>
            <Text style={styles.detailValue}>
              {listing.pets_allowed ? 'Allowed' : 'Not allowed'}
            </Text>
          </View>
          {listing.pets_allowed && listing.pets_description && (
            <Text style={styles.policyNote}>{listing.pets_description}</Text>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Smoking</Text>
            <Text style={styles.detailValue}>
              {listing.smoking_allowed ? 'Allowed' : 'Not allowed'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Furnished</Text>
            <Text style={styles.detailValue}>{listing.furnished ? 'Yes' : 'No'}</Text>
          </View>
        </View>

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

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {listing.status === 'draft' && (
            <Button
              title={actionLoading ? 'Publishing...' : 'Publish Listing'}
              onPress={handlePublish}
              disabled={actionLoading}
            />
          )}
          {listing.status === 'active' && (
            <Button
              title={actionLoading ? 'Pausing...' : 'Pause Listing'}
              onPress={handlePause}
              variant="secondary"
              disabled={actionLoading}
            />
          )}
          {listing.status === 'paused' && (
            <Button
              title={actionLoading ? 'Publishing...' : 'Reactivate Listing'}
              onPress={handlePublish}
              disabled={actionLoading}
            />
          )}
          {(listing.status === 'active' || listing.status === 'paused') && (
            <>
              <View style={styles.actionGap} />
              <Button
                title={actionLoading ? 'Closing...' : 'Close Listing'}
                onPress={handleClose}
                variant="secondary"
                disabled={actionLoading}
              />
            </>
          )}
          <View style={styles.actionGap} />
          <Button
            title={actionLoading ? 'Deleting...' : 'Delete Listing'}
            onPress={handleDelete}
            variant="secondary"
            disabled={actionLoading}
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
  editButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
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
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: THEME.spacing.md,
  },
  listingTitle: {
    flex: 1,
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  address: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  statNumber: {
    fontSize: THEME.fontSize.display,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  statLabelLink: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.brand,
    marginTop: THEME.spacing.xs,
    fontWeight: THEME.fontWeight.medium,
  },
  applicationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    gap: THEME.spacing.sm,
  },
  applicationsButtonText: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.brand,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  rentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: THEME.spacing.md,
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
  policyNote: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.sm,
    fontStyle: 'italic',
  },
  featureChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  actionsContainer: {
    marginTop: THEME.spacing.lg,
  },
  actionGap: {
    height: THEME.spacing.md,
  },
});
