// Tenant Activity Feed
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Avatar, CurrencyDisplay } from '@casa/ui';
import {
  useProfile,
  useMyTenancy,
  useRentSchedule,
  usePayments,
  useMyArrears,
  useMyMaintenance,
  formatDollars,
} from '@casa/api';

export default function TenantActivityScreen() {
  const insets = useSafeAreaInsets();
  const { profile, firstName } = useProfile();
  const { tenancy, refreshMyTenancy } = useMyTenancy();
  const { nextDue, totalOwed, refreshSchedule } = useRentSchedule(tenancy?.id);
  const { payments, refreshPayments } = usePayments(
    tenancy ? { tenancyId: tenancy.id, limit: 5 } : undefined
  );
  const { arrears, hasArrears } = useMyArrears();
  const { requests: maintenanceRequests, activeCount: maintenanceActive } = useMyMaintenance({ showCompleted: false });
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshMyTenancy(), refreshSchedule(), refreshPayments()]);
    setRefreshing(false);
  }, [refreshMyTenancy, refreshSchedule, refreshPayments]);

  const displayName = firstName || 'there';
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const rentAmount = totalOwed > 0 ? totalOwed : nextDue ? Number(nextDue.amount) : 0;
  const isOverdue = totalOwed > 0;
  const rentDateLabel = isOverdue
    ? 'Payment overdue'
    : nextDue
      ? `Due ${new Date(nextDue.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}`
      : 'No active lease';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.push('/(app)/profile' as any)}>
            <Avatar
              source={profile?.avatar_url ? { uri: profile.avatar_url } : null}
              name={profile?.full_name || undefined}
              size="sm"
            />
          </TouchableOpacity>
          <View>
            <Text style={styles.greeting}>Hey {displayName}</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.colors.brand} />
        }
      >
        {/* Rent Status Card */}
        {tenancy && (
          <TouchableOpacity
            style={[styles.rentCard, isOverdue && styles.rentCardOverdue]}
            onPress={() => router.push('/(app)/payments/pay' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.rentCardHeader}>
              <Text style={styles.rentCardLabel}>
                {isOverdue ? 'Outstanding Balance' : 'Next Rent Due'}
              </Text>
              <View style={[styles.rentStatusDot, { backgroundColor: isOverdue ? THEME.colors.error : THEME.colors.success }]} />
            </View>
            <CurrencyDisplay
              amount={rentAmount}
              size="lg"
              color={isOverdue ? THEME.colors.error : THEME.colors.textPrimary}
            />
            <Text style={styles.rentDateLabel}>{rentDateLabel}</Text>
            <View style={styles.payButton}>
              <Text style={styles.payButtonText}>
                {isOverdue ? 'Pay Now' : 'Pay Rent'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Arrears Alert */}
        {hasArrears && arrears && (
          <TouchableOpacity
            style={styles.arrearsCard}
            onPress={() => router.push('/(app)/arrears' as any)}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" stroke={THEME.colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <View style={styles.arrearsContent}>
              <Text style={styles.arrearsTitle}>Overdue rent</Text>
              <Text style={styles.arrearsText}>
                {formatDollars(Number(arrears.total_overdue))} outstanding
              </Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke={THEME.colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}

        {/* Active Maintenance */}
        {maintenanceActive > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Maintenance</Text>
            {maintenanceRequests.slice(0, 3).map(req => (
              <TouchableOpacity
                key={req.id}
                style={styles.activityItem}
                onPress={() => router.push(`/(app)/maintenance/${req.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.activityIcon, { backgroundColor: THEME.colors.warningBg }]}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={THEME.colors.warning} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{req.title}</Text>
                  <Text style={styles.activitySubtext}>
                    {req.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                </View>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Payments */}
        {payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            {payments.slice(0, 5).map(payment => {
              const isPaid = payment.status === 'completed';
              return (
                <View key={payment.id} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: isPaid ? THEME.colors.successBg : THEME.colors.warningBg }]}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={isPaid ? THEME.colors.success : THEME.colors.warning} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>
                      {payment.description || 'Rent payment'}
                    </Text>
                    <Text style={styles.activitySubtext}>
                      {new Date(payment.paid_at || payment.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={[styles.activityAmount, { color: isPaid ? THEME.colors.success : THEME.colors.textPrimary }]}>
                    {formatDollars(Number(payment.amount))}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty state for new tenants */}
        {!tenancy && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>Welcome to Casa</Text>
            <Text style={styles.emptyText}>
              Your tenancy details, rent payments, and activity will appear here once your lease is set up.
            </Text>
          </View>
        )}
      </ScrollView>
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
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  dateText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },

  // Rent Status Card
  rentCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  rentCardOverdue: {
    borderColor: THEME.colors.error + '40',
  },
  rentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rentCardLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rentStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rentDateLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  payButton: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: THEME.radius.md,
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },

  // Arrears
  arrearsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.errorBg,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  arrearsContent: {
    flex: 1,
  },
  arrearsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.error,
  },
  arrearsText: {
    fontSize: 13,
    color: THEME.colors.error,
    opacity: 0.8,
    marginTop: 1,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 10,
  },

  // Activity Items
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  activitySubtext: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
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
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
});
