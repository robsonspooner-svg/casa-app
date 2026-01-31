import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME } from '@casa/config';
import Svg, { Path } from 'react-native-svg';

export function DocumentsTab({ propertyId }: { propertyId: string }) {
  // Documents will be populated from tenancy documents, inspection reports, etc.
  // For now, show the empty state with future capability.
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.emptyTitle}>Documents</Text>
        <Text style={styles.emptyText}>
          Lease agreements, inspection reports, and compliance certificates for this property will appear here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
});
