import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  Card,
  Button,
  Badge,
  ScreenContainer,
  THEME,
} from '@casa/ui';

// This is a legacy route — the real properties screen is at (app)/(tabs)/portfolio.tsx
// and property detail at (app)/properties/[id].tsx. This screen renders an empty state
// with a redirect to the real add-property flow.
type PropertyItem = {
  id: string;
  address: string;
  suburb: string;
  type: string;
  status: 'vacant' | 'leased' | 'listed';
  rent: number;
  bedrooms: number;
  bathrooms: number;
};

export default function PropertiesScreen() {
  const router = useRouter();

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'leased':
        return 'success';
      case 'listed':
        return 'info';
      case 'vacant':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const properties: PropertyItem[] = [];

  const renderProperty = ({ item }: { item: PropertyItem }) => (
    <Card
      variant="elevated"
      style={styles.propertyCard}
      onPress={() => router.push(`/(app)/properties/${item.id}` as any)}
    >
      <View style={styles.propertyHeader}>
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyAddress}>{item.address}</Text>
          <Text style={styles.propertySuburb}>{item.suburb}</Text>
        </View>
        <Badge label={item.status} variant={getStatusVariant(item.status)} />
      </View>

      <View style={styles.propertyDetails}>
        <Text style={styles.propertyType}>{item.type}</Text>
        <Text style={styles.propertySpecs}>
          {item.bedrooms} bed · {item.bathrooms} bath
        </Text>
      </View>

      <View style={styles.propertyFooter}>
        <Text style={styles.rentAmount}>${item.rent}</Text>
        <Text style={styles.rentPeriod}>/week</Text>
      </View>
    </Card>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
          <Path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <Text style={styles.emptyTitle}>No Properties Yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first property to start managing it with Casa's AI assistance.
      </Text>
      <Button
        title="Add Your First Property"
        onPress={() => router.push('/(app)/properties/add' as any)}
      />
    </View>
  );

  return (
    <ScreenContainer scrollable={false} padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Properties</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        renderItem={renderProperty}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          properties.length === 0 ? styles.emptyList : styles.list
        }
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  backIcon: {
    fontSize: THEME.fontSize.h1,
    color: THEME.colors.textPrimary,
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  list: {
    padding: THEME.spacing.base,
    gap: THEME.spacing.md,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    padding: THEME.spacing.base,
  },
  propertyCard: {
    marginBottom: THEME.spacing.md,
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.md,
  },
  propertyInfo: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  propertyAddress: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  propertySuburb: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  propertyDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  propertyType: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  propertySpecs: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginLeft: THEME.spacing.sm,
  },
  propertyFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rentAmount: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  rentPeriod: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginLeft: THEME.spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: THEME.spacing.xl,
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
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
    maxWidth: 280,
    lineHeight: 22,
  },
});
