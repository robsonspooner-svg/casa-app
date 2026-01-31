import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import Svg, { Path } from 'react-native-svg';
import { usePayments, useArrears, useDashboard, useCasaPropertyActions } from '@casa/api';

function CasaBanner({ message }: { message: string }) {
  return (
    <View style={styles.casaBanner}>
      <View style={styles.casaBannerIcon}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <Text style={styles.casaBannerText}>{message}</Text>
    </View>
  );
}

export function FinancialTab({ propertyId }: { propertyId: string }) {
  const { payments, loading: paymentsLoading } = usePayments({ limit: 10 });
  const { arrears } = useArrears({ isResolved: false });
  const { summary } = useDashboard({ propertyId });
  const { hasSentRentReminder, recentActions } = useCasaPropertyActions(propertyId);
  const financialAction = recentActions.find(a => a.type === 'financial');

  // Filter payments for this property (via tenancy)
  const propertyPayments = payments.filter(p => (p.tenancy as any)?.property_id === propertyId);
  const propertyArrears = arrears.filter(a => a.tenancy?.property_id === propertyId);

  const totalOverdue = propertyArrears.reduce((sum, a) => sum + a.total_overdue, 0);
  const rentCollected = summary?.rent_collected_this_month ? Number(summary.rent_collected_this_month) : 0;
  const totalRent = summary?.total_monthly_rent ? Number(summary.total_monthly_rent) : 0;

  const bannerMessage = hasSentRentReminder && financialAction
    ? `Casa sent automated rent reminders for this property`
    : null;

  return (
    <View style={styles.container}>
      {bannerMessage && <CasaBanner message={bannerMessage} />}

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Revenue (month)</Text>
          <Text style={styles.summaryValue}>${Math.round(rentCollected).toLocaleString()}</Text>
          {totalRent > 0 && (
            <Text style={styles.summarySubtext}>of ${Math.round(totalRent).toLocaleString()}</Text>
          )}
        </View>
        <View style={[styles.summaryCard, totalOverdue > 0 && styles.summaryCardWarning]}>
          <Text style={styles.summaryLabel}>Arrears</Text>
          <Text style={[styles.summaryValue, totalOverdue > 0 && { color: THEME.colors.error }]}>
            ${Math.round(totalOverdue).toLocaleString()}
          </Text>
          {propertyArrears.length > 0 && (
            <Text style={styles.summarySubtext}>{propertyArrears.length} record{propertyArrears.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      {/* Arrears Alert */}
      {propertyArrears.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arrears</Text>
          {propertyArrears.map(arr => (
            <TouchableOpacity
              key={arr.id}
              style={styles.arrearsCard}
              onPress={() => router.push(`/(app)/arrears/${arr.id}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.arrearsRow}>
                <Text style={styles.arrearsAmount}>${Math.round(arr.total_overdue).toLocaleString()}</Text>
                <View style={[styles.severityBadge, {
                  backgroundColor: arr.severity === 'critical' || arr.severity === 'serious' ? THEME.colors.errorBg : THEME.colors.warningBg,
                }]}>
                  <Text style={[styles.severityText, {
                    color: arr.severity === 'critical' || arr.severity === 'serious' ? THEME.colors.error : THEME.colors.warning,
                  }]}>{arr.severity}</Text>
                </View>
              </View>
              <Text style={styles.arrearsDays}>{arr.days_overdue} days overdue</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent Payments */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/payments' as any)} activeOpacity={0.7}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>
        {propertyPayments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No payments recorded yet.</Text>
          </View>
        ) : (
          <View style={styles.paymentList}>
            {propertyPayments.slice(0, 5).map(payment => {
              const statusColor = payment.status === 'completed' ? THEME.colors.success : payment.status === 'failed' ? THEME.colors.error : THEME.colors.warning;
              return (
                <View key={payment.id} style={styles.paymentRow}>
                  <View>
                    <Text style={styles.paymentType}>
                      {payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1)}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {new Date(payment.paid_at || payment.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={[styles.paymentAmount, { color: statusColor }]}>
                      ${Math.round(payment.amount).toLocaleString()}
                    </Text>
                    <Text style={[styles.paymentStatus, { color: statusColor }]}>
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Reports link */}
      <TouchableOpacity
        style={styles.reportsLink}
        onPress={() => router.push('/(app)/reports' as any)}
        activeOpacity={0.7}
      >
        <Text style={styles.reportsLinkText}>View Full Reports</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  summaryCardWarning: {
    borderColor: THEME.colors.error + '40',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  summarySubtext: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 2,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.brand,
  },
  arrearsCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.error + '40',
  },
  arrearsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  arrearsAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.error,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  arrearsDays: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  paymentList: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  paymentType: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  paymentDate: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentStatus: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
  },
  reportsLink: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  reportsLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  casaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.successBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  casaBannerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  casaBannerText: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.success,
    fontWeight: '500',
    lineHeight: 18,
  },
});
