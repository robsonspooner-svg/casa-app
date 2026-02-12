// Applications List for a Listing (Owner) - Mission 05: Applications
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Badge, THEME } from '@casa/ui';
import { useApplications, useApplicationMutations, ApplicationWithDetails, ApplicationStatus } from '@casa/api';

function getStatusVariant(status: ApplicationStatus): 'success' | 'info' | 'warning' | 'neutral' {
  switch (status) {
    case 'submitted':
      return 'info';
    case 'under_review':
      return 'warning';
    case 'shortlisted':
      return 'info';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'neutral';
    case 'withdrawn':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function formatStatus(status: ApplicationStatus): string {
  switch (status) {
    case 'submitted': return 'Submitted';
    case 'under_review': return 'Under Review';
    case 'shortlisted': return 'Shortlisted';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'withdrawn': return 'Withdrawn';
    case 'draft': return 'Draft';
    default: return status;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatEmploymentType(type: string): string {
  switch (type) {
    case 'full_time': return 'Full-time';
    case 'part_time': return 'Part-time';
    case 'casual': return 'Casual';
    case 'self_employed': return 'Self-employed';
    case 'unemployed': return 'Unemployed';
    case 'retired': return 'Retired';
    case 'student': return 'Student';
    default: return type;
  }
}

type FilterOption = 'all' | 'submitted' | 'under_review' | 'shortlisted' | 'approved' | 'rejected';

function ApplicationCard({ application, onPress, selectMode, selected, onToggle }: {
  application: ApplicationWithDetails;
  onPress: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={selectMode ? onToggle : onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        {selectMode && (
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && (
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </View>
        )}
        <Text style={[styles.cardName, selectMode && { flex: 1 }]}>{application.full_name}</Text>
        <Badge label={formatStatus(application.status)} variant={getStatusVariant(application.status)} />
      </View>
      <Text style={styles.cardEmail}>{application.email}</Text>
      <View style={styles.cardDetails}>
        <Text style={styles.cardDetail}>
          {formatEmploymentType(application.employment_type)}
        </Text>
        {application.annual_income && (
          <Text style={styles.cardDetail}>
            ${application.annual_income.toLocaleString()}/yr
          </Text>
        )}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>
          Applied {application.submitted_at ? formatDate(application.submitted_at) : formatDate(application.created_at)}
        </Text>
        <Text style={styles.cardMoveIn}>
          Move-in: {formatDate(application.move_in_date)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ListingApplicationsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [filter, setFilter] = useState<FilterOption>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const statusFilter = filter === 'all' ? undefined : filter;
  const { applications, loading, refreshing, refreshApplications } = useApplications(id || null, { status: statusFilter as ApplicationStatus | undefined });
  const { shortlistApplication } = useApplicationMutations();

  const toggleSelect = (appId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const handleBulkShortlist = async () => {
    if (selected.size === 0) return;
    Alert.alert(
      'Shortlist Applications',
      `Shortlist ${selected.size} application${selected.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Shortlist',
          onPress: async () => {
            try {
              for (const appId of selected) {
                await shortlistApplication(appId);
              }
              Alert.alert('Done', `${selected.size} application${selected.size > 1 ? 's' : ''} shortlisted.`);
              setSelected(new Set());
              setSelectMode(false);
              refreshApplications();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to shortlist');
            }
          },
        },
      ]
    );
  };

  const filters: { key: FilterOption; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'submitted', label: 'New' },
    { key: 'under_review', label: 'Reviewing' },
    { key: 'shortlisted', label: 'Shortlisted' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Applications</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
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
        <Text style={styles.headerTitle}>Applications</Text>
        <TouchableOpacity
          onPress={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
          style={styles.selectButton}
        >
          <Text style={styles.selectButtonText}>{selectMode ? 'Cancel' : 'Select'}</Text>
        </TouchableOpacity>
      </View>

      {/* Bulk Action Bar */}
      {selectMode && selected.size > 0 && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkBarText}>{selected.size} selected</Text>
          <TouchableOpacity onPress={handleBulkShortlist} style={styles.bulkButton}>
            <Text style={styles.bulkButtonText}>Shortlist</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Chips */}
      <FlatList
        horizontal
        data={filters}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
            onPress={() => setFilter(item.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, filter === item.key && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.filtersContainer}
        showsHorizontalScrollIndicator={false}
      />

      {/* Applications List */}
      <FlatList
        data={applications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ApplicationCard
            application={item}
            onPress={() => router.push(`/(app)/listings/${id}/applications/${item.id}` as Href)}
            selectMode={selectMode}
            selected={selected.has(item.id)}
            onToggle={() => toggleSelect(item.id)}
          />
        )}
        contentContainerStyle={applications.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2M9 7a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>No applications</Text>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'No applications have been received for this listing yet.'
                : `No ${filter.replace('_', ' ')} applications.`}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshApplications}
            tintColor={THEME.colors.brand}
          />
        }
        showsVerticalScrollIndicator={false}
      />
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
  selectButton: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
  },
  selectButtonText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.subtle,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  bulkBarText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  bulkButton: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
  },
  bulkButtonText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textInverse,
    fontWeight: THEME.fontWeight.semibold,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.sm,
  },
  checkboxSelected: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.subtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  filterChipText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    fontWeight: THEME.fontWeight.medium,
  },
  filterChipTextActive: {
    color: THEME.colors.textInverse,
  },
  listContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
    gap: THEME.spacing.md,
  },
  emptyListContent: {
    flex: 1,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.xs,
  },
  cardName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  cardEmail: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  cardDetails: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  cardDetail: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: THEME.spacing.sm,
  },
  cardDate: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  cardMoveIn: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.base,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
