// Property Documents Tab — Lists documents for a specific property
// Manual generation + proactive Casa Agent prompting for outstanding items

import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { useDocuments, useCasaPropertyActions } from '@casa/api';
import type { DocumentRow, CasaDocumentType } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

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

type FilterKey = 'all' | 'leases' | 'notices' | 'compliance' | 'reports';

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'leases', label: 'Leases' },
  { key: 'notices', label: 'Notices' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'reports', label: 'Reports' },
];

const FILTER_TYPE_MAP: Record<FilterKey, CasaDocumentType[] | null> = {
  all: null,
  leases: ['lease'],
  notices: ['notice'],
  compliance: ['compliance_certificate', 'condition_report', 'evidence_report'],
  reports: ['financial_report', 'tax_report', 'property_summary', 'cash_flow_forecast'],
};

// Document generation options — routes to chat with pre-filled prompt
const GENERATE_OPTIONS: { key: string; label: string; icon: string; prompt: string }[] = [
  {
    key: 'lease',
    label: 'Lease Agreement',
    icon: 'lease',
    prompt: 'Generate a residential lease agreement for this property. Include all standard clauses required under the relevant state legislation.',
  },
  {
    key: 'notice',
    label: 'Notice',
    icon: 'notice',
    prompt: 'I need to generate a notice for this property. What type of notice do you need? (e.g., notice to vacate, rent increase, breach notice, entry notice)',
  },
  {
    key: 'condition_report',
    label: 'Condition Report',
    icon: 'condition',
    prompt: 'Generate a condition report document for this property based on the latest completed inspection.',
  },
  {
    key: 'financial',
    label: 'Financial Summary',
    icon: 'financial',
    prompt: 'Generate a financial summary report for this property covering the current financial year.',
  },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function GenerateOptionIcon({ type, color }: { type: string; color: string }) {
  // Document icon with slight variation by type
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DocumentsTab({ propertyId }: { propertyId: string }) {
  const { documents, loading, error, refreshDocuments, setFilter } = useDocuments({ property_id: propertyId });
  const { recentActions } = useCasaPropertyActions(propertyId);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  // Check for pending signature documents — proactive prompt
  const pendingSignature = useMemo(
    () => documents.filter(d => d.status === 'pending_owner_signature'),
    [documents],
  );

  const filteredDocs = useMemo(() => {
    const allowedTypes = FILTER_TYPE_MAP[activeFilter];
    if (!allowedTypes) return documents;
    return documents.filter(d => allowedTypes.includes(d.document_type));
  }, [documents, activeFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  }, [refreshDocuments]);

  const handleFilterChange = useCallback((key: FilterKey) => {
    setActiveFilter(key);
  }, []);

  const handleGenerateOption = useCallback((option: typeof GENERATE_OPTIONS[0]) => {
    setShowGenerate(false);
    // Navigate to chat with pre-filled message about this property
    router.push({
      pathname: '/(app)/(tabs)/chat' as any,
      params: { prefill: `[Property: ${propertyId}] ${option.prompt}` },
    });
  }, [propertyId]);

  const renderDocCard = useCallback(({ item }: { item: DocumentRow }) => {
    const typeConfig = DOC_TYPE_CONFIG[item.document_type] || DOC_TYPE_CONFIG.other;
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
    const needsSignature = item.status === 'pending_owner_signature';

    return (
      <TouchableOpacity
        style={[styles.card, needsSignature && styles.cardNeedsAction]}
        onPress={() => router.push(`/(app)/documents/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardIcon}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              stroke={typeConfig.color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
              stroke={typeConfig.color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
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
          </View>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
      </TouchableOpacity>
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* Proactive agent banner — pending signatures */}
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

      {/* Generate document button + options */}
      <TouchableOpacity
        style={styles.generateBtn}
        onPress={() => setShowGenerate(!showGenerate)}
        activeOpacity={0.7}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <Text style={styles.generateBtnText}>Generate Document</Text>
      </TouchableOpacity>

      {showGenerate && (
        <View style={styles.generateOptions}>
          {GENERATE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={styles.generateOptionCard}
              onPress={() => handleGenerateOption(opt)}
              activeOpacity={0.7}
            >
              <GenerateOptionIcon type={opt.key} color={DOC_TYPE_CONFIG[opt.key]?.color || THEME.colors.brand} />
              <Text style={styles.generateOptionText}>{opt.label}</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ))}
          <Text style={styles.generateHint}>
            Casa Agent can also proactively generate documents when they're needed.
          </Text>
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.filterChip, activeFilter === chip.key && styles.filterChipActive]}
            onPress={() => handleFilterChange(chip.key)}
          >
            <Text style={[styles.filterChipText, activeFilter === chip.key && styles.filterChipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={THEME.colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : filteredDocs.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptyText}>
            Tap "Generate Document" above, or ask Casa Agent in chat to create documents for this property.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocs}
          keyExtractor={item => item.id}
          renderItem={renderDocCard}
          scrollEnabled={false}
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

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  // Agent proactive banner
  agentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.brand + '20',
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 10,
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
  // Generate button + options
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    marginBottom: 10,
  },
  generateBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  generateOptions: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  generateOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  generateOptionText: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  generateHint: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
    lineHeight: 15,
  },
  // Filter chips
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 12,
    gap: 6,
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
    paddingVertical: 40,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    marginBottom: 6,
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
    backgroundColor: THEME.colors.canvas,
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
  cardDate: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
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
  errorText: {
    fontSize: 14,
    color: THEME.colors.error,
    textAlign: 'center',
  },
});
