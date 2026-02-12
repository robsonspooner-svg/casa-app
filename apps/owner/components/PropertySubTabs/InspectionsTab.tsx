import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { useInspections, useCasaPropertyActions } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  tenant_review: { label: 'Tenant Review', color: THEME.colors.brand, bg: THEME.colors.brand + '20' },
  disputed: { label: 'Disputed', color: THEME.colors.error, bg: THEME.colors.errorBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: THEME.colors.subtle },
  finalized: { label: 'Finalized', color: THEME.colors.success, bg: THEME.colors.successBg },
} as const;

const TYPE_LABELS: Record<string, string> = {
  entry: 'Entry',
  exit: 'Exit',
  periodic: 'Periodic',
  routine: 'Routine',
  damage: 'Damage',
  compliance: 'Compliance',
};

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

export function InspectionsTab({ propertyId }: { propertyId: string }) {
  const { inspections, loading } = useInspections({ propertyId });
  const { hasScheduledInspection, recentActions } = useCasaPropertyActions(propertyId);
  const inspectionAction = recentActions.find(a => a.type === 'inspection');

  const active = inspections.filter(i => i.status === 'in_progress' || i.status === 'tenant_review' || i.status === 'disputed');
  const upcoming = inspections.filter(i => i.status === 'scheduled');
  const past = inspections.filter(i => i.status === 'completed' || i.status === 'finalized' || i.status === 'cancelled');

  if (!loading && inspections.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.emptyTitle}>No inspections</Text>
        <Text style={styles.emptyText}>Schedule an inspection to keep your property in top shape.</Text>
        <TouchableOpacity
          style={styles.scheduleBtn}
          onPress={() => router.push('/(app)/inspections' as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.scheduleBtnText}>Schedule Inspection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bannerMessage = hasScheduledInspection && inspectionAction
    ? `Casa scheduled an inspection for ${new Date(inspectionAction.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
    : null;

  return (
    <View style={styles.container}>
      {bannerMessage && <CasaBanner message={bannerMessage} />}

      <TouchableOpacity
        style={styles.scheduleTopBtn}
        onPress={() => router.push('/(app)/inspections' as any)}
        activeOpacity={0.7}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <Text style={styles.scheduleTopBtnText}>Schedule New</Text>
      </TouchableOpacity>

      {/* Active — in progress, tenant review, disputed */}
      {active.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active</Text>
          {active.map(insp => {
            const status = STATUS_CONFIG[insp.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.in_progress;
            const typeLabel = TYPE_LABELS[insp.inspection_type] || insp.inspection_type;
            const date = new Date(insp.scheduled_date);
            return (
              <TouchableOpacity
                key={insp.id}
                style={[styles.inspCard, styles.activeCard]}
                onPress={() => router.push(`/(app)/inspections/${insp.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.inspHeader}>
                  <Text style={styles.inspType}>{typeLabel} Inspection</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.inspDate}>
                  {date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {upcoming.map(insp => {
            const status = STATUS_CONFIG[insp.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.scheduled;
            const typeLabel = TYPE_LABELS[insp.inspection_type] || insp.inspection_type;
            const date = new Date(insp.scheduled_date);
            return (
              <TouchableOpacity
                key={insp.id}
                style={styles.inspCard}
                onPress={() => router.push(`/(app)/inspections/${insp.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.inspHeader}>
                  <Text style={styles.inspType}>{typeLabel} Inspection</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.inspDate}>
                  {date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Past */}
      {past.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Inspections</Text>
          {past.map(insp => {
            const status = STATUS_CONFIG[insp.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.completed;
            const typeLabel = TYPE_LABELS[insp.inspection_type] || insp.inspection_type;
            const date = new Date(insp.completed_at || insp.scheduled_date);
            return (
              <TouchableOpacity
                key={insp.id}
                style={[styles.inspCard, styles.pastCard]}
                onPress={() => router.push(`/(app)/inspections/${insp.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.inspHeader}>
                  <Text style={styles.pastType}>{typeLabel}</Text>
                  <Text style={styles.pastDate}>
                    {date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
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
  scheduleTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    marginBottom: 16,
  },
  scheduleTopBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  inspCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  inspHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inspType: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  inspDate: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  activeCard: {
    borderColor: THEME.colors.warningBg,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.warning,
  },
  pastCard: {
    opacity: 0.7,
  },
  pastType: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  pastDate: {
    fontSize: 12,
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
    marginBottom: 20,
  },
  scheduleBtn: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
  },
  scheduleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  casaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.successBg,
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  casaBannerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.surface,
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
