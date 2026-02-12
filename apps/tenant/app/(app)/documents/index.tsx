// Shared Documents — Tenant App
// Shows documents shared with the current tenant + documents they need to sign

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useDocuments } from '@casa/api';
import type { DocumentRow, CasaDocumentType } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
  other: { label: 'Other', color: '#6B7280' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: THEME.colors.textSecondary, bg: THEME.colors.canvas },
  pending_owner_signature: { label: 'Pending', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  pending_tenant_signature: { label: 'Sign Now', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  signed: { label: 'Signed', color: THEME.colors.success, bg: THEME.colors.successBg },
  archived: { label: 'Archived', color: THEME.colors.textTertiary, bg: THEME.colors.canvas },
};

type FilterKey = 'all' | 'action_needed' | 'signed';

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'action_needed', label: 'Needs Signature' },
  { key: 'signed', label: 'Signed' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TenantDocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { documents, loading, error, refreshDocuments } = useDocuments();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const pendingSignature = useMemo(
    () => documents.filter(d => d.status === 'pending_tenant_signature'),
    [documents],
  );

  const filteredDocs = useMemo(() => {
    switch (activeFilter) {
      case 'action_needed':
        return documents.filter(d => d.status === 'pending_tenant_signature');
      case 'signed':
        return documents.filter(d => d.status === 'signed');
      default:
        return documents;
    }
  }, [documents, activeFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  }, [refreshDocuments]);

  const renderDocCard = useCallback(({ item }: { item: DocumentRow }) => {
    const typeConfig = DOC_TYPE_CONFIG[item.document_type] || DOC_TYPE_CONFIG.other;
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
    const needsSignature = item.status === 'pending_tenant_signature';

    return (
      <TouchableOpacity
        style={[styles.card, needsSignature && styles.cardNeedsAction]}
        onPress={() => router.push(`/(app)/documents/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardIcon, { backgroundColor: typeConfig.color + '12' }]}>
          <DocIcon color={typeConfig.color} />
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Documents</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Proactive banner */}
      {pendingSignature.length > 0 && (
        <TouchableOpacity
          style={styles.agentBanner}
          onPress={() => router.push(`/(app)/documents/${pendingSignature[0].id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.agentBannerIconWrap}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={styles.agentBannerContent}>
            <Text style={styles.agentBannerTitle}>
              {pendingSignature.length === 1
                ? 'Document needs your signature'
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

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.filterChip, activeFilter === chip.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(chip.key)}
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
          <Text style={styles.emptyTitle}>No documents</Text>
          <Text style={styles.emptyText}>
            Documents shared with you by your landlord will appear here.
          </Text>
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
  headerRight: {
    width: 40,
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
  },
  errorText: {
    fontSize: 14,
    color: THEME.colors.error,
    textAlign: 'center',
  },
});
