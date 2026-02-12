// Tenancy Detail Screen - Owner App
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
import { useTenancy, useTenancyMutations, TenancyStatus } from '@casa/api';
import { StatusTimeline, TimelineEvent } from '@casa/ui';

const STATUS_COLORS: Record<TenancyStatus, string> = {
  pending: THEME.colors.textTertiary,
  active: THEME.colors.success,
  ending: THEME.colors.warning,
  ended: THEME.colors.textTertiary,
  terminated: THEME.colors.error,
};

function buildTimeline(status: TenancyStatus, tenancy: any): TimelineEvent[] {
  const statuses: TenancyStatus[] = ['pending', 'active', 'ending', 'ended'];
  const currentIndex = statuses.indexOf(status === 'terminated' ? 'ended' : status);

  return [
    {
      label: 'Created',
      date: tenancy.created_at ? new Date(tenancy.created_at).toLocaleDateString('en-AU') : undefined,
      status: currentIndex >= 0 ? 'completed' : 'pending',
    },
    {
      label: 'Active',
      date: tenancy.lease_start_date ? new Date(tenancy.lease_start_date).toLocaleDateString('en-AU') : undefined,
      status: currentIndex >= 1 ? 'completed' : currentIndex === 0 ? 'current' : 'pending',
    },
    {
      label: 'Notice Given',
      date: tenancy.notice_given_date ? new Date(tenancy.notice_given_date).toLocaleDateString('en-AU') : undefined,
      status: currentIndex >= 2 ? 'completed' : currentIndex === 1 ? 'current' : 'pending',
    },
    {
      label: status === 'terminated' ? 'Terminated' : 'Ended',
      date: tenancy.actual_end_date ? new Date(tenancy.actual_end_date).toLocaleDateString('en-AU') : undefined,
      status: currentIndex >= 3 ? 'completed' : currentIndex === 2 ? 'current' : 'pending',
    },
  ];
}

export default function TenancyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading, error, refreshTenancy } = useTenancy(id || null);
  const { updateTenancyStatus } = useTenancyMutations();
  const [actionLoading, setActionLoading] = useState(false);

  const handleActivate = async () => {
    if (!tenancy) return;
    Alert.alert('Activate Tenancy', 'This will set the tenancy as active and mark the property as occupied.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Activate',
        onPress: async () => {
          setActionLoading(true);
          try {
            await updateTenancyStatus(tenancy.id, 'active');
            await refreshTenancy();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to activate');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleGiveNotice = async () => {
    if (!tenancy) return;
    Alert.alert('Give Notice', 'This will begin the notice period for this tenancy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Give Notice',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await updateTenancyStatus(tenancy.id, 'ending');
            await refreshTenancy();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleEndTenancy = async () => {
    if (!tenancy) return;
    router.push(`/(app)/tenancies/${tenancy.id}/terminate` as any);
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

  const primaryTenant = tenancy.tenants.find(t => t.is_primary);
  const daysUntilEnd = Math.ceil(
    (new Date(tenancy.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tenancy Details</Text>
        <TouchableOpacity
          onPress={() => router.push(`/(app)/tenancies/${tenancy.id}/edit` as any)}
          style={styles.editButton}
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Property & Status */}
        <View style={styles.heroCard}>
          <Text style={styles.propertyAddress}>
            {tenancy.property?.address_line_1}, {tenancy.property?.suburb}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[tenancy.status]}15` }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[tenancy.status] }]}>
              {tenancy.status.charAt(0).toUpperCase() + tenancy.status.slice(1)}
            </Text>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>${tenancy.rent_amount}</Text>
              <Text style={styles.heroStatLabel}>/{tenancy.rent_frequency === 'weekly' ? 'week' : tenancy.rent_frequency === 'fortnightly' ? 'fortnight' : 'month'}</Text>
            </View>
            {tenancy.status === 'active' && daysUntilEnd > 0 && (
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, daysUntilEnd <= 30 ? styles.urgentText : daysUntilEnd <= 90 ? styles.warningText : undefined]}>
                  {daysUntilEnd}
                </Text>
                <Text style={styles.heroStatLabel}>days left</Text>
              </View>
            )}
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <StatusTimeline events={buildTimeline(tenancy.status, tenancy)} />
        </View>

        {/* Lease Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lease Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Start Date</Text>
              <Text style={styles.detailValue}>
                {new Date(tenancy.lease_start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>End Date</Text>
              <Text style={styles.detailValue}>
                {new Date(tenancy.lease_end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lease Type</Text>
              <Text style={styles.detailValue}>{tenancy.lease_type.replace('_', ' ')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Periodic</Text>
              <Text style={styles.detailValue}>{tenancy.is_periodic ? 'Yes' : 'No'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rent Due Day</Text>
              <Text style={styles.detailValue}>Day {tenancy.rent_due_day}</Text>
            </View>
          </View>
        </View>

        {/* Tenants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tenants ({tenancy.tenants.length})</Text>
          {tenancy.tenants.map(tenant => (
            <View key={tenant.id} style={styles.tenantCard}>
              <View style={styles.tenantInfo}>
                <Text style={styles.tenantName}>
                  {tenant.profile?.full_name || 'Unknown'}
                  {tenant.is_primary && <Text style={styles.primaryBadge}> (Primary)</Text>}
                </Text>
                <Text style={styles.tenantEmail}>{tenant.profile?.email}</Text>
              </View>
              {tenant.is_leaseholder && (
                <Text style={styles.leaseholderBadge}>Leaseholder</Text>
              )}
            </View>
          ))}
        </View>

        {/* Bond */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bond</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>${tenancy.bond_amount}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={[styles.detailValue, { textTransform: 'capitalize' }]}>{tenancy.bond_status}</Text>
            </View>
            {tenancy.bond_lodgement_number && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Lodgement #</Text>
                <Text style={styles.detailValue}>{tenancy.bond_lodgement_number}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents ({tenancy.documents.length})</Text>
          {tenancy.documents.length === 0 ? (
            <Text style={styles.emptyText}>No documents uploaded yet.</Text>
          ) : (
            tenancy.documents.map(doc => (
              <View key={doc.id} style={styles.docRow}>
                <Text style={styles.docTitle}>{doc.title}</Text>
                <Text style={styles.docType}>{doc.document_type.replace(/_/g, ' ')}</Text>
              </View>
            ))
          )}
          <TouchableOpacity
            style={styles.addDocButton}
            onPress={() => router.push(`/(app)/tenancies/${tenancy.id}/documents` as any)}
          >
            <Text style={styles.addDocText}>Manage Documents</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addDocButton}
            onPress={() => router.push(`/(app)/tenancies/${tenancy.id}/compliance` as any)}
          >
            <Text style={styles.addDocText}>Compliance Checklist</Text>
          </TouchableOpacity>
        </View>

        {/* Rent Increases */}
        {tenancy.rent_increases && tenancy.rent_increases.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rent Increases</Text>
            {tenancy.rent_increases.map(increase => (
              <View key={increase.id} style={styles.increaseCard}>
                <View style={styles.increaseHeader}>
                  <Text style={styles.increaseAmount}>
                    ${increase.current_amount} → ${increase.new_amount}
                  </Text>
                  <Text style={styles.increasePercentage}>
                    +{increase.increase_percentage}%
                  </Text>
                </View>
                <Text style={styles.increaseDate}>
                  Effective: {new Date(increase.effective_date).toLocaleDateString('en-AU')}
                </Text>
                <Text style={[styles.increaseStatus, { textTransform: 'capitalize' }]}>
                  {increase.status.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Document Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generate Documents</Text>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push(`/(app)/tenancies/${tenancy.id}/generate-lease` as any)}
          >
            <Text style={styles.secondaryActionText}>Generate Lease Agreement</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push(`/(app)/tenancies/${tenancy.id}/condition-report` as any)}
          >
            <Text style={styles.secondaryActionText}>Generate Condition Report</Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {tenancy.status === 'pending' && (
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={handleActivate}
              disabled={actionLoading}
            >
              <Text style={styles.primaryActionText}>Activate Tenancy</Text>
            </TouchableOpacity>
          )}

          {tenancy.status === 'active' && (
            <>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => router.push(`/(app)/tenancies/${tenancy.id}/rent-increase` as any)}
              >
                <Text style={styles.secondaryActionText}>Propose Rent Increase</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => router.push(`/(app)/tenancies/${tenancy.id}/renew` as any)}
              >
                <Text style={styles.secondaryActionText}>Renew Lease</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.destructiveAction}
                onPress={handleGiveNotice}
                disabled={actionLoading}
              >
                <Text style={styles.destructiveActionText}>Give Notice</Text>
              </TouchableOpacity>
            </>
          )}

          {tenancy.status === 'ending' && (
            <TouchableOpacity
              style={styles.destructiveAction}
              onPress={handleEndTenancy}
              disabled={actionLoading}
            >
              <Text style={styles.destructiveActionText}>End Tenancy</Text>
            </TouchableOpacity>
          )}
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
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editText: {
    fontSize: 14,
    color: THEME.colors.brand,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  propertyAddress: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: THEME.radius.md,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 24,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  heroStatLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginLeft: 2,
  },
  warningText: {
    color: THEME.colors.warning,
  },
  urgentText: {
    color: THEME.colors.error,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  detailsGrid: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  tenantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tenantInfo: {},
  tenantName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  primaryBadge: {
    fontSize: 12,
    color: THEME.colors.brand,
    fontWeight: '500',
  },
  tenantEmail: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  leaseholderBadge: {
    fontSize: 11,
    color: THEME.colors.brand,
    fontWeight: '600',
    backgroundColor: `${THEME.colors.brand}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  docType: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    textTransform: 'capitalize',
  },
  addDocButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    borderStyle: 'dashed',
  },
  addDocText: {
    fontSize: 14,
    color: THEME.colors.brand,
    fontWeight: '600',
  },
  increaseCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  increaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  increaseAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  increasePercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.warning,
  },
  increaseDate: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  increaseStatus: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },
  actionsSection: {
    marginTop: 8,
    gap: 12,
  },
  primaryAction: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryActionText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryAction: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.brand,
  },
  secondaryActionText: {
    color: THEME.colors.brand,
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveAction: {
    backgroundColor: THEME.colors.errorBg,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.error + '40',
  },
  destructiveActionText: {
    color: THEME.colors.error,
    fontSize: 15,
    fontWeight: '600',
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
