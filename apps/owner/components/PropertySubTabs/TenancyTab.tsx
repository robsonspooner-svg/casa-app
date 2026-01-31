import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { useTenancies, useCasaPropertyActions } from '@casa/api';
import type { TenancyWithDetails } from '@casa/api';
import Svg, { Path, Circle } from 'react-native-svg';

function TenancyCard({ tenancy }: { tenancy: TenancyWithDetails }) {
  const statusConfig = {
    active: { label: 'Active', bg: THEME.colors.successBg, color: THEME.colors.success },
    pending: { label: 'Pending', bg: THEME.colors.warningBg, color: THEME.colors.warning },
    ending: { label: 'Ending', bg: THEME.colors.warningBg, color: THEME.colors.warning },
    ended: { label: 'Ended', bg: THEME.colors.subtle, color: THEME.colors.textTertiary },
    terminated: { label: 'Terminated', bg: THEME.colors.errorBg, color: THEME.colors.error },
  }[tenancy.status] || { label: tenancy.status, bg: THEME.colors.subtle, color: THEME.colors.textSecondary };

  const leaseStart = new Date(tenancy.lease_start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const leaseEnd = new Date(tenancy.lease_end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const freq = tenancy.rent_frequency === 'weekly' ? '/wk' : tenancy.rent_frequency === 'fortnightly' ? '/fn' : '/mo';

  return (
    <TouchableOpacity
      style={styles.tenancyCard}
      onPress={() => router.push(`/(app)/tenancies/${tenancy.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.tenancyHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
        <Text style={styles.tenancyRent}>${Math.round(tenancy.rent_amount).toLocaleString()}{freq}</Text>
      </View>

      <Text style={styles.tenancyDates}>{leaseStart} — {leaseEnd}</Text>

      {/* Tenants */}
      {tenancy.tenants && tenancy.tenants.length > 0 && (
        <View style={styles.tenantList}>
          {tenancy.tenants.map(tt => (
            <View key={tt.id} style={styles.tenantRow}>
              <View style={styles.tenantAvatar}>
                <Text style={styles.tenantAvatarText}>
                  {(tt.profile?.full_name || tt.profile?.email || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.tenantInfo}>
                <Text style={styles.tenantName}>{tt.profile?.full_name || tt.profile?.email || 'Unknown'}</Text>
                {tt.profile?.phone && <Text style={styles.tenantContact}>{tt.profile.phone}</Text>}
                {tt.profile?.email && <Text style={styles.tenantContact}>{tt.profile.email}</Text>}
              </View>
              {tt.is_primary && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>Primary</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Bond */}
      {tenancy.bond_amount != null && tenancy.bond_amount > 0 && (
        <View style={styles.bondRow}>
          <Text style={styles.bondLabel}>Bond: ${Math.round(tenancy.bond_amount).toLocaleString()}</Text>
          <View style={[styles.bondStatusBadge, {
            backgroundColor: tenancy.bond_status === 'lodged' ? THEME.colors.successBg : THEME.colors.warningBg,
          }]}>
            <Text style={[styles.bondStatusText, {
              color: tenancy.bond_status === 'lodged' ? THEME.colors.success : THEME.colors.warning,
            }]}>{(tenancy.bond_status || 'pending').charAt(0).toUpperCase() + (tenancy.bond_status || 'pending').slice(1)}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function VacantState({ propertyId }: { propertyId: string }) {
  return (
    <View style={styles.vacantState}>
      <View style={styles.vacantIcon}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={8.5} cy={7} r={4} stroke={THEME.colors.textTertiary} strokeWidth={1.5} />
          <Path d="M20 8v6M23 11h-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      </View>
      <Text style={styles.vacantTitle}>No active tenancy</Text>
      <Text style={styles.vacantText}>This property is currently vacant.</Text>
      <TouchableOpacity
        style={styles.findTenantBtn}
        onPress={() => router.push('/(app)/connections' as any)}
        activeOpacity={0.7}
      >
        <Text style={styles.findTenantBtnText}>Find Tenant</Text>
      </TouchableOpacity>
    </View>
  );
}

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

export function TenancyTab({ propertyId }: { propertyId: string }) {
  const { tenancies, loading } = useTenancies({ propertyId });
  const { hasCommunicatedWithTenant, lastTenantCommunication } = useCasaPropertyActions(propertyId);

  const activeTenancies = tenancies.filter(t => t.status === 'active' || t.status === 'pending' || t.status === 'ending');
  const pastTenancies = tenancies.filter(t => t.status === 'ended' || t.status === 'terminated');

  if (!loading && activeTenancies.length === 0 && pastTenancies.length === 0) {
    return <VacantState propertyId={propertyId} />;
  }

  const bannerMessage = hasCommunicatedWithTenant && lastTenantCommunication
    ? `Casa ${lastTenantCommunication.title.toLowerCase()} on ${new Date(lastTenantCommunication.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
    : null;

  return (
    <View style={styles.container}>
      {bannerMessage && <CasaBanner message={bannerMessage} />}

      {/* Active tenancies */}
      {activeTenancies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Tenancy</Text>
          {activeTenancies.map(t => (
            <TenancyCard key={t.id} tenancy={t} />
          ))}
        </View>
      )}

      {/* Past tenancies */}
      {pastTenancies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Tenancies</Text>
          {pastTenancies.map(t => (
            <TenancyCard key={t.id} tenancy={t} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
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
  tenancyCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tenancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tenancyRent: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  tenancyDates: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 10,
  },
  tenantList: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: 10,
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  tenantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  tenantAvatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  tenantContact: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.colors.infoBg,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.info,
  },
  bondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: 10,
    marginTop: 6,
  },
  bondLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  bondStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bondStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  vacantState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  vacantIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  vacantTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  vacantText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 20,
  },
  findTenantBtn: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  findTenantBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textInverse,
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
