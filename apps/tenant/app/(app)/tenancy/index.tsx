// My Tenancy Dashboard - Tenant App
// Mission 06: Tenancies & Leases

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useMyTenancy, TenancyStatus } from '@casa/api';

const STATUS_COLORS: Record<TenancyStatus, string> = {
  pending: THEME.colors.textTertiary,
  active: '#16A34A',
  ending: '#F59E0B',
  ended: THEME.colors.textTertiary,
  terminated: '#EF4444',
};

export default function MyTenancyScreen() {
  const { tenancy, loading, error, refreshMyTenancy } = useMyTenancy();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tenancy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>My Tenancy</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No active tenancy</Text>
          <Text style={styles.emptySubtitle}>
            Once your application is approved and a tenancy is created, it will appear here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const daysUntilEnd = Math.ceil(
    (new Date(tenancy.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const nextRentDue = getNextRentDueDate(tenancy.rent_due_day, tenancy.rent_frequency);
  const daysUntilRent = Math.ceil((nextRentDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Tenancy</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refreshMyTenancy}
            tintColor={THEME.colors.brand}
          />
        }
      >
        {/* Property & Status Card */}
        <View style={styles.heroCard}>
          <Text style={styles.propertyAddress}>
            {tenancy.property?.address_line_1}
          </Text>
          <Text style={styles.propertySuburb}>
            {tenancy.property?.suburb}, {tenancy.property?.state} {tenancy.property?.postcode}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[tenancy.status]}15` }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[tenancy.status] }]}>
              {tenancy.status.charAt(0).toUpperCase() + tenancy.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Rent Due Card */}
        <View style={styles.rentCard}>
          <Text style={styles.rentCardTitle}>Next Rent Due</Text>
          <View style={styles.rentRow}>
            <View>
              <Text style={styles.rentAmount}>${tenancy.rent_amount}</Text>
              <Text style={styles.rentFrequency}>per {tenancy.rent_frequency === 'weekly' ? 'week' : tenancy.rent_frequency === 'fortnightly' ? 'fortnight' : 'month'}</Text>
            </View>
            <View style={styles.rentDueInfo}>
              <Text style={[styles.rentDueDays, daysUntilRent <= 3 ? styles.urgentText : undefined]}>
                {daysUntilRent <= 0 ? 'Due today' : `In ${daysUntilRent} days`}
              </Text>
              <Text style={styles.rentDueDate}>
                {nextRentDue.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </View>
        </View>

        {/* Lease Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lease Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Start Date</Text>
              <Text style={styles.detailValue}>
                {new Date(tenancy.lease_start_date).toLocaleDateString('en-AU')}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>End Date</Text>
              <Text style={styles.detailValue}>
                {new Date(tenancy.lease_end_date).toLocaleDateString('en-AU')}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Days Remaining</Text>
              <Text style={[styles.detailValue, daysUntilEnd <= 30 ? styles.urgentText : daysUntilEnd <= 90 ? styles.warningText : undefined]}>
                {daysUntilEnd > 0 ? `${daysUntilEnd} days` : 'Expired'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lease Type</Text>
              <Text style={styles.detailValue}>{tenancy.lease_type.replace('_', ' ')}</Text>
            </View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Bond</Text>
              <Text style={styles.detailValue}>${tenancy.bond_amount} ({tenancy.bond_status})</Text>
            </View>
          </View>
        </View>

        {/* Co-tenants */}
        {tenancy.tenants.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Co-tenants</Text>
            {tenancy.tenants.map(t => (
              <View key={t.id} style={styles.coTenantRow}>
                <Text style={styles.coTenantName}>
                  {t.profile?.full_name || 'Unknown'}
                  {t.is_primary ? ' (Primary)' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Rent Increases */}
        {tenancy.rent_increases && tenancy.rent_increases.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rent Changes</Text>
            {tenancy.rent_increases.filter(r => r.status !== 'cancelled').map(increase => (
              <View key={increase.id} style={styles.increaseCard}>
                <Text style={styles.increaseText}>
                  ${increase.current_amount} → ${increase.new_amount} (+{increase.increase_percentage}%)
                </Text>
                <Text style={styles.increaseDate}>
                  Effective {new Date(increase.effective_date).toLocaleDateString('en-AU')}
                </Text>
                <Text style={styles.increaseStatus}>{increase.status.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/tenancy/lease' as any)}
            >
              <View style={styles.actionIconWrap}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.actionLabel}>View Lease</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/tenancy/documents' as any)}
            >
              <View style={styles.actionIconWrap}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.actionLabel}>Documents</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/(tabs)/rent' as any)}
            >
              <View style={styles.actionIconWrap}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.actionLabel}>Pay Rent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/maintenance' as any)}
            >
              <View style={styles.actionIconWrap}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.actionLabel}>Maintenance</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getNextRentDueDate(dueDay: number, frequency: string): Date {
  const now = new Date();
  const nextDue = new Date(now);

  if (frequency === 'monthly') {
    nextDue.setDate(dueDay);
    if (nextDue <= now) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }
  } else if (frequency === 'fortnightly') {
    const dayOfWeek = dueDay <= 7 ? dueDay : 1;
    nextDue.setDate(now.getDate() + ((dayOfWeek - now.getDay() + 7) % 7 || 14));
  } else {
    // Weekly
    const dayOfWeek = dueDay <= 7 ? dueDay : 1;
    nextDue.setDate(now.getDate() + ((dayOfWeek - now.getDay() + 7) % 7 || 7));
  }

  return nextDue;
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
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: { backgroundColor: THEME.colors.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: THEME.colors.border },
  propertyAddress: { fontSize: 20, fontWeight: '700', color: THEME.colors.textPrimary },
  propertySuburb: { fontSize: 14, color: THEME.colors.textSecondary, marginBottom: 12 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 13, fontWeight: '600' },
  rentCard: { backgroundColor: THEME.colors.brand, borderRadius: 16, padding: 20, marginBottom: 16 },
  rentCardTitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12, fontWeight: '600' },
  rentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rentAmount: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  rentFrequency: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  rentDueInfo: { alignItems: 'flex-end' },
  rentDueDays: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  rentDueDate: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  urgentText: { color: '#FCA5A5' },
  warningText: { color: '#F59E0B' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 12 },
  detailsGrid: { backgroundColor: THEME.colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: THEME.colors.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  detailLabel: { fontSize: 14, color: THEME.colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary },
  coTenantRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  coTenantName: { fontSize: 15, color: THEME.colors.textPrimary },
  increaseCard: { backgroundColor: THEME.colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: THEME.colors.border },
  increaseText: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary },
  increaseDate: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
  increaseStatus: { fontSize: 12, color: THEME.colors.textTertiary, marginTop: 4, textTransform: 'capitalize' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { width: '47%', backgroundColor: THEME.colors.surface, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.border },
  actionIconWrap: { marginBottom: 8 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: THEME.colors.textPrimary },
});
