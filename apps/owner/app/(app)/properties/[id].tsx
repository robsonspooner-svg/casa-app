// Property Detail Screen - Unified property hub with horizontal sub-tabs
import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useProperty, usePropertyMutations, PropertyStatus } from '@casa/api';
import { Badge, Button } from '@casa/ui';

import { OverviewTab } from '../../../components/PropertySubTabs/OverviewTab';
import { TenancyTab } from '../../../components/PropertySubTabs/TenancyTab';
import { MaintenanceTab } from '../../../components/PropertySubTabs/MaintenanceTab';
import { FinancialTab } from '../../../components/PropertySubTabs/FinancialTab';
import { InspectionsTab } from '../../../components/PropertySubTabs/InspectionsTab';
import { DocumentsTab } from '../../../components/PropertySubTabs/DocumentsTab';

const SUB_TABS = ['Overview', 'Tenancy', 'Maintenance', 'Financial', 'Inspections', 'Documents'] as const;
type SubTab = typeof SUB_TABS[number];

function StatusBadge({ status }: { status: PropertyStatus }) {
  const config = {
    occupied: { label: 'Leased', variant: 'success' as const },
    maintenance: { label: 'Maintenance', variant: 'info' as const },
    vacant: { label: 'Vacant', variant: 'warning' as const },
  }[status] || { label: status, variant: 'neutral' as const };

  return <Badge label={config.label} variant={config.variant} />;
}

function SubTabBar({
  activeTab,
  onTabPress,
}: {
  activeTab: SubTab;
  onTabPress: (tab: SubTab) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={styles.tabBarContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarContent}
      >
        {SUB_TABS.map(tab => {
          const isActive = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => onTabPress(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabItemText, isActive && styles.tabItemTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function PropertyDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { property, loading, error } = useProperty(id || null);
  const { deleteProperty } = usePropertyMutations();
  const [activeTab, setActiveTab] = useState<SubTab>('Overview');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      'Delete Property',
      'Are you sure you want to delete this property? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setDeleting(true);
            try {
              await deleteProperty(id);
              Alert.alert('Success', 'Property deleted successfully', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete property');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Property</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  if (error || !property) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Property</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Property not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </View>
    );
  }

  const primaryImage = property.images?.find(img => img.is_primary) || property.images?.[0];

  function renderTabContent() {
    switch (activeTab) {
      case 'Overview':
        return <OverviewTab property={property!} />;
      case 'Tenancy':
        return <TenancyTab propertyId={id!} />;
      case 'Maintenance':
        return <MaintenanceTab propertyId={id!} />;
      case 'Financial':
        return <FinancialTab propertyId={id!} />;
      case 'Inspections':
        return <InspectionsTab propertyId={id!} />;
      case 'Documents':
        return <DocumentsTab propertyId={id!} />;
      default:
        return null;
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push(`/properties/${id}/edit` as Href)}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.moreButton}
            disabled={deleting}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z" stroke={THEME.colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Property Info Card */}
        <View style={styles.propertyInfo}>
          {primaryImage?.url && (
            <Image source={{ uri: primaryImage.url }} style={styles.heroImage} />
          )}
          <View style={styles.propertyDetails}>
            <Text style={styles.addressLine1}>{property.address_line_1}</Text>
            <Text style={styles.suburb}>
              {property.suburb}, {property.state} {property.postcode}
            </Text>
            <View style={styles.propertyMeta}>
              <StatusBadge status={property.status} />
              <Text style={styles.metaItem}>{property.bedrooms} bed</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaItem}>{property.bathrooms} bath</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaItem}>{property.parking_spaces} car</Text>
            </View>
          </View>
        </View>

        {/* Sub-tab bar (sticky) */}
        <SubTabBar activeTab={activeTab} onTabPress={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderTabContent()}
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 15,
    color: THEME.colors.brand,
    fontWeight: '500',
  },
  moreButton: {
    width: 40,
    height: 40,
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
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // Property Info
  propertyInfo: {
    backgroundColor: THEME.colors.surface,
  },
  heroImage: {
    width: '100%',
    height: 180,
  },
  propertyDetails: {
    padding: 16,
  },
  addressLine1: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  suburb: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    marginBottom: 10,
  },
  propertyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  metaDot: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
  },

  // Sub-tab bar
  tabBarContainer: {
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  tabBarContent: {
    paddingHorizontal: 12,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: THEME.colors.brand,
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textTertiary,
  },
  tabItemTextActive: {
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },

  // Tab content
  tabContent: {
    paddingHorizontal: 16,
  },
});
