import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@casa/config';
import type { PropertyWithImages } from '@casa/api';

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function AttributeBadge({ label }: { label: string }) {
  return (
    <View style={styles.attributeBadge}>
      <Text style={styles.attributeBadgeText}>{label}</Text>
    </View>
  );
}

export function OverviewTab({ property }: { property: PropertyWithImages }) {
  const typeLabel = property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1);
  const freqLabel = property.rent_frequency === 'weekly' ? '/wk' : property.rent_frequency === 'fortnightly' ? '/fn' : '/mo';

  return (
    <View style={styles.container}>
      {/* Key Attributes */}
      <View style={styles.attributeRow}>
        <AttributeBadge label={`${property.bedrooms} bed`} />
        <AttributeBadge label={`${property.bathrooms} bath`} />
        <AttributeBadge label={`${property.parking_spaces} car`} />
        <AttributeBadge label={typeLabel} />
      </View>

      {/* Rent */}
      <View style={styles.rentCard}>
        <Text style={styles.rentLabel}>Rent</Text>
        <View style={styles.rentRow}>
          <Text style={styles.rentAmount}>${Math.round(property.rent_amount).toLocaleString()}</Text>
          <Text style={styles.rentFreq}>{freqLabel}</Text>
        </View>
        {property.bond_amount != null && property.bond_amount > 0 && (
          <Text style={styles.bondText}>Bond: ${Math.round(property.bond_amount).toLocaleString()}</Text>
        )}
      </View>

      {/* Property Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailsCard}>
          <DetailRow label="Property Type" value={typeLabel} />
          <DetailRow label="Bedrooms" value={property.bedrooms} />
          <DetailRow label="Bathrooms" value={property.bathrooms} />
          <DetailRow label="Parking" value={property.parking_spaces} />
          {property.floor_size_sqm && <DetailRow label="Floor Size" value={`${property.floor_size_sqm} m²`} />}
          {property.land_size_sqm && <DetailRow label="Land Size" value={`${property.land_size_sqm} m²`} />}
          {property.year_built && <DetailRow label="Year Built" value={property.year_built} />}
        </View>
      </View>

      {/* Notes */}
      {property.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{property.notes}</Text>
          </View>
        </View>
      )}

      {/* Photos */}
      {property.images && property.images.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.notesCard}>
            <Text style={styles.photoCount}>{property.images.length} photo{property.images.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  attributeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  attributeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.colors.subtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  attributeBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  rentCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  rentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  rentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rentAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  rentFreq: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    marginLeft: 4,
  },
  bondText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  detailsCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  notesCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  notesText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  photoCount: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
});
