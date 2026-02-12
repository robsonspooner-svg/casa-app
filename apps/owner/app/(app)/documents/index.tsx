// Document Hub — Owner App
// Standalone document browser with folders, search, upload, and filtering

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import {
  useDocuments,
  useDocumentFolders,
  useDocumentUpload,
  useProperties,
} from '@casa/api';
import type { DocumentRow, CasaDocumentType, DocumentFolderRow } from '@casa/api';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Path } from 'react-native-svg';

// ============================================================
// Icons
// ============================================================

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function UploadIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FolderIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DocIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

// ============================================================
// Config
// ============================================================

const DOC_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  financial_report: { label: 'Financial', color: '#16A34A' },
  tax_report: { label: 'Tax', color: '#CA8A04' },
  lease: { label: 'Lease', color: '#1B1464' },
  notice: { label: 'Notice', color: '#DC2626' },
  condition_report: { label: 'Condition', color: '#2563EB' },
  compliance_certificate: { label: 'Compliance', color: '#7C3AED' },
  property_summary: { label: 'Summary', color: '#0891B2' },
  portfolio_report: { label: 'Portfolio', color: '#059669' },
  cash_flow_forecast: { label: 'Cash Flow', color: '#D97706' },
  evidence_report: { label: 'Evidence', color: '#6B7280' },
  inspection_report: { label: 'Inspection', color: '#2563EB' },
  insurance_certificate: { label: 'Insurance', color: '#7C3AED' },
  identity_document: { label: 'ID', color: '#4B5563' },
  financial_statement: { label: 'Statement', color: '#16A34A' },
  correspondence: { label: 'Letter', color: '#6366F1' },
  photo: { label: 'Photo', color: '#0891B2' },
  receipt: { label: 'Receipt', color: '#D97706' },
  other: { label: 'Other', color: '#6B7280' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: THEME.colors.textSecondary, bg: THEME.colors.canvas },
  pending_owner_signature: { label: 'Sign', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  pending_tenant_signature: { label: 'Sent', color: THEME.colors.info, bg: THEME.colors.infoBg },
  signed: { label: 'Signed', color: THEME.colors.success, bg: THEME.colors.successBg },
  archived: { label: 'Archived', color: THEME.colors.textTertiary, bg: THEME.colors.canvas },
};

function ChevronRightIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function HomeIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type FilterKey = 'all' | 'leases' | 'notices' | 'compliance' | 'reports' | 'uploaded';

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'leases', label: 'Leases' },
  { key: 'notices', label: 'Notices' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'reports', label: 'Reports' },
  { key: 'uploaded', label: 'Uploaded' },
];

const FILTER_TYPE_MAP: Record<FilterKey, CasaDocumentType[] | null | 'uploaded'> = {
  all: null,
  leases: ['lease'],
  notices: ['notice'],
  compliance: ['compliance_certificate', 'condition_report', 'evidence_report'],
  reports: ['financial_report', 'tax_report', 'property_summary', 'cash_flow_forecast', 'portfolio_report'],
  uploaded: 'uploaded',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Main Screen
// ============================================================

export default function DocumentsHubScreen() {
  const insets = useSafeAreaInsets();
  const { documents, loading, error, refreshDocuments } = useDocuments();
  const { properties } = useProperties();
  const { uploadDocument, upload } = useDocumentUpload();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Folder navigation — requires a property to be selected
  const selectedPropertyForFolders = selectedProperty || (properties.length === 1 ? properties[0]?.id : undefined);
  const { folders } = useDocumentFolders(selectedPropertyForFolders);

  // Pending signatures — proactive alert
  const pendingSignature = useMemo(
    () => documents.filter(d => d.status === 'pending_owner_signature'),
    [documents],
  );

  // Filter documents
  const filteredDocs = useMemo(() => {
    let result = documents;

    // Property filter
    if (selectedProperty) {
      result = result.filter(d => d.property_id === selectedProperty);
    }

    // Folder filter
    if (showFolders && currentFolderId) {
      result = result.filter(d => d.folder_id === currentFolderId);
    }

    // Type filter
    const filterConfig = FILTER_TYPE_MAP[activeFilter];
    if (filterConfig === 'uploaded') {
      result = result.filter(d => d.created_by === 'owner' || d.uploaded_by);
    } else if (filterConfig) {
      result = result.filter(d => filterConfig.includes(d.document_type));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(query) ||
        (d.description && d.description.toLowerCase().includes(query)) ||
        (d.tags && d.tags.some(t => t.toLowerCase().includes(query))),
      );
    }

    return result;
  }, [documents, activeFilter, searchQuery, selectedProperty, showFolders, currentFolderId]);

  // Folder helpers
  const currentFolder = useMemo(
    () => folders.find(f => f.id === currentFolderId) || null,
    [folders, currentFolderId],
  );
  const childFolders = useMemo(
    () => folders.filter(f => f.parent_id === currentFolderId),
    [folders, currentFolderId],
  );
  const breadcrumb = useMemo(() => {
    if (!currentFolderId) return [];
    const trail: DocumentFolderRow[] = [];
    let fid: string | null = currentFolderId;
    while (fid) {
      const f = folders.find(x => x.id === fid);
      if (!f) break;
      trail.unshift(f);
      fid = f.parent_id;
    }
    return trail;
  }, [folders, currentFolderId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  }, [refreshDocuments]);

  const handleUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const doc = await uploadDocument({
        fileUri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType || 'application/octet-stream',
        propertyId: selectedProperty || undefined,
      });

      if (doc) {
        await refreshDocuments();
        Alert.alert('Uploaded', `"${file.name}" has been uploaded successfully.`);
      }
    } catch (err) {
      Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to upload document.');
    }
  }, [uploadDocument, refreshDocuments, selectedProperty]);

  const renderDocCard = useCallback(({ item }: { item: DocumentRow }) => {
    const typeConfig = DOC_TYPE_CONFIG[item.document_type] || DOC_TYPE_CONFIG.other;
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
    const needsSignature = item.status === 'pending_owner_signature';
    const isUploaded = item.created_by === 'owner' || !!item.uploaded_by;

    return (
      <TouchableOpacity
        style={[styles.card, needsSignature && styles.cardNeedsAction]}
        onPress={() => router.push(`/(app)/documents/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardIcon, { backgroundColor: typeConfig.color + '12' }]}>
          {isUploaded && item.mime_type ? (
            <DocIcon color={typeConfig.color} />
          ) : (
            <DocIcon color={typeConfig.color} />
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '18' }]}>
              <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
            {item.file_size ? (
              <Text style={styles.fileSizeText}>{formatFileSize(item.file_size)}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
      </TouchableOpacity>
    );
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
        <TouchableOpacity
          onPress={handleUpload}
          style={styles.uploadButton}
          disabled={upload.uploading}
        >
          {upload.uploading ? (
            <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          ) : (
            <>
              <UploadIcon />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor={THEME.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearch}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Property selector */}
      {properties.length > 1 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: null, label: 'All Properties' }, ...properties.map(p => ({ id: p.id, label: p.address_line_1 || p.suburb || 'Property' }))]}
          keyExtractor={(item) => item.id || 'all'}
          style={styles.propertyScroll}
          contentContainerStyle={styles.propertyScrollContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.propertyChip, selectedProperty === item.id && styles.propertyChipActive]}
              onPress={() => setSelectedProperty(item.id)}
            >
              <Text
                style={[styles.propertyChipText, selectedProperty === item.id && styles.propertyChipTextActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Proactive banner — pending signatures */}
      {pendingSignature.length > 0 && (
        <TouchableOpacity
          style={styles.agentBanner}
          onPress={() => router.push(`/(app)/documents/${pendingSignature[0].id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.agentBannerIconWrap}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={styles.agentBannerContent}>
            <Text style={styles.agentBannerTitle}>
              {pendingSignature.length === 1
                ? 'Document ready for your signature'
                : `${pendingSignature.length} documents need your signature`}
            </Text>
            <Text style={styles.agentBannerSubtitle} numberOfLines={1}>
              {pendingSignature[0].title}
            </Text>
          </View>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}

      {/* Filter chips + folder toggle */}
      <View style={styles.filterRow}>
        {FILTER_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.filterChip, activeFilter === chip.key && !showFolders && styles.filterChipActive]}
            onPress={() => { setActiveFilter(chip.key); setShowFolders(false); setCurrentFolderId(null); }}
          >
            <Text style={[styles.filterChipText, activeFilter === chip.key && !showFolders && styles.filterChipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
        {selectedPropertyForFolders && folders.length > 0 && (
          <TouchableOpacity
            style={[styles.filterChip, showFolders && styles.filterChipActive]}
            onPress={() => { setShowFolders(!showFolders); setCurrentFolderId(null); }}
          >
            <FolderIcon color={showFolders ? THEME.colors.textInverse : THEME.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Folder breadcrumb */}
      {showFolders && breadcrumb.length > 0 && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={() => setCurrentFolderId(null)} style={styles.breadcrumbItem}>
            <HomeIcon />
          </TouchableOpacity>
          {breadcrumb.map((f, i) => (
            <View key={f.id} style={styles.breadcrumbSegment}>
              <ChevronRightIcon />
              <TouchableOpacity
                onPress={() => setCurrentFolderId(f.id)}
                style={styles.breadcrumbItem}
              >
                <Text
                  style={[styles.breadcrumbText, i === breadcrumb.length - 1 && styles.breadcrumbTextActive]}
                  numberOfLines={1}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Folder cards */}
      {showFolders && childFolders.length > 0 && (
        <View style={styles.folderGrid}>
          {childFolders.map(folder => {
            const docCount = documents.filter(d => d.folder_id === folder.id).length;
            return (
              <TouchableOpacity
                key={folder.id}
                style={styles.folderCard}
                onPress={() => setCurrentFolderId(folder.id)}
                activeOpacity={0.7}
              >
                <FolderIcon color={THEME.colors.brand} />
                <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                <Text style={styles.folderCount}>{docCount}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : filteredDocs.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <DocIcon color={THEME.colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching documents' : 'No documents yet'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Try a different search term or change your filters.'
              : 'Upload documents or ask Casa Agent to generate them for you.'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity style={styles.emptyUploadBtn} onPress={handleUpload}>
              <PlusIcon />
              <Text style={styles.emptyUploadBtnText}>Upload Document</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredDocs}
          keyExtractor={item => item.id}
          renderItem={renderDocCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={THEME.colors.brand}
            />
          }
        />
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    minWidth: 90,
    justifyContent: 'center',
  },
  uploadButtonText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    marginLeft: 8,
    paddingVertical: 0,
  },
  clearSearch: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.brand,
    fontWeight: '600',
  },
  propertyScroll: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  propertyScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  propertyChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    maxWidth: 160,
  },
  propertyChipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  propertyChipText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  propertyChipTextActive: {
    color: THEME.colors.textInverse,
  },
  agentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.brand + '20',
    borderRadius: THEME.radius.md,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
    gap: 10,
  },
  agentBannerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentBannerContent: {
    flex: 1,
  },
  agentBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  agentBannerSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  filterChipText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  filterChipTextActive: {
    color: THEME.colors.textInverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    marginBottom: 8,
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardNeedsAction: {
    borderColor: THEME.colors.warning,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.warning,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 3,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: THEME.radius.full,
  },
  typeBadgeText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: THEME.radius.full,
  },
  statusBadgeText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '600',
  },
  fileSizeText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  cardDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
    marginBottom: 16,
  },
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  emptyUploadBtnText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  errorText: {
    fontSize: 14,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  breadcrumbSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbItem: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    minWidth: 24,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.brand,
    fontWeight: '500',
    maxWidth: 100,
  },
  breadcrumbTextActive: {
    color: THEME.colors.textPrimary,
    fontWeight: '600',
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minWidth: 120,
    maxWidth: 180,
  },
  folderName: {
    flex: 1,
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  folderCount: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    fontWeight: '500',
  },
});
