// Tenancy Documents Screen - Tenant App
// Mission 06: Tenancies & Leases

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useMyTenancy, TenancyDocument } from '@casa/api';

const DOC_TYPE_LABELS: Record<string, string> = {
  lease: 'Lease Agreement',
  condition_report_entry: 'Entry Condition Report',
  condition_report_exit: 'Exit Condition Report',
  notice_to_vacate: 'Notice to Vacate',
  notice_to_leave: 'Notice to Leave',
  bond_lodgement: 'Bond Lodgement',
  bond_claim: 'Bond Claim',
  rent_increase_notice: 'Rent Increase Notice',
  other: 'Other',
};

function DocumentRow({ document }: { document: TenancyDocument }) {
  return (
    <TouchableOpacity style={styles.docRow} activeOpacity={0.7}>
      <View style={styles.docIcon}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docTitle}>{document.title}</Text>
        <Text style={styles.docType}>{DOC_TYPE_LABELS[document.document_type] || document.document_type}</Text>
        <Text style={styles.docDate}>
          {new Date(document.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>
      <Text style={styles.downloadArrow}>↓</Text>
    </TouchableOpacity>
  );
}

export default function TenancyDocumentsScreen() {
  const { tenancy, loading } = useMyTenancy();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const documents = tenancy?.documents || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Documents</Text>
        <View style={styles.headerRight} />
      </View>

      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptySubtitle}>
            Documents related to your tenancy will appear here once uploaded by your landlord.
          </Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <DocumentRow document={item} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: THEME.colors.brand },
  title: { fontSize: 20, fontWeight: '700', color: THEME.colors.textPrimary },
  headerRight: { width: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: THEME.colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: THEME.colors.textSecondary, textAlign: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  docRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: THEME.colors.border },
  docIcon: { width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: `${THEME.colors.brand}10`, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  docIconText: { fontSize: 20 },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '600', color: THEME.colors.textPrimary },
  docType: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
  docDate: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 2 },
  downloadArrow: { fontSize: 18, color: THEME.colors.brand, fontWeight: '700' },
});
