// Tenancy Documents Screen - Owner App
// Mission 06: Tenancies & Leases

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
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useTenancy, useTenancyMutations } from '@casa/api';

const DOCUMENT_TYPES = [
  { value: 'lease_agreement', label: 'Lease Agreement' },
  { value: 'condition_report', label: 'Condition Report' },
  { value: 'bond_receipt', label: 'Bond Receipt' },
  { value: 'notice', label: 'Notice' },
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'rent_increase_notice', label: 'Rent Increase Notice' },
  { value: 'other', label: 'Other' },
];

function getDocTypeLabel(type: string): string {
  return DOCUMENT_TYPES.find(d => d.value === type)?.label || type.replace(/_/g, ' ');
}

export default function TenancyDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading, error, refreshTenancy } = useTenancy(id || null);
  const { deleteDocument } = useTenancyMutations();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = (documentId: string, title: string) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(documentId);
            try {
              await deleteDocument(documentId);
              await refreshTenancy();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete');
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !tenancy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'Tenancy not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Documents</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.propertyAddress}>
          {tenancy.property?.address_line_1}, {tenancy.property?.suburb}
        </Text>

        {tenancy.documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Documents</Text>
            <Text style={styles.emptySubtitle}>
              Documents uploaded for this tenancy will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.documentsList}>
            {tenancy.documents.map(doc => (
              <View key={doc.id} style={styles.documentCard}>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                  <Text style={styles.docType}>{getDocTypeLabel(doc.document_type)}</Text>
                  <Text style={styles.docDate}>
                    Added {new Date(doc.created_at).toLocaleDateString('en-AU')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(doc.id, doc.title)}
                  style={styles.deleteButton}
                  disabled={deleting === doc.id}
                >
                  {deleting === doc.id ? (
                    <ActivityIndicator size="small" color={THEME.colors.error} />
                  ) : (
                    <Text style={styles.deleteText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.uploadSection}>
          <Text style={styles.uploadNote}>
            Document upload via the app will be available once storage integration is complete.
            For now, documents can be managed through the Casa web portal.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: THEME.colors.brand,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  propertyAddress: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  documentsList: {
    gap: 12,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  docType: {
    fontSize: 13,
    color: THEME.colors.brand,
    fontWeight: '500',
    marginBottom: 2,
  },
  docDate: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteText: {
    fontSize: 13,
    color: THEME.colors.error,
    fontWeight: '500',
  },
  uploadSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  uploadNote: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 16,
    color: THEME.colors.error,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  retryText: {
    color: THEME.colors.textInverse,
    fontWeight: '600',
  },
});
