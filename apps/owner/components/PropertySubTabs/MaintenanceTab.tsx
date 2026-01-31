import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { useMaintenance, useCasaPropertyActions } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

const URGENCY_CONFIG = {
  low: { label: 'Low', color: THEME.colors.success, bg: THEME.colors.successBg },
  medium: { label: 'Medium', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  high: { label: 'High', color: THEME.colors.error, bg: THEME.colors.errorBg },
  emergency: { label: 'Emergency', color: THEME.colors.error, bg: THEME.colors.errorBg },
} as const;

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: THEME.colors.warning },
  acknowledged: { label: 'Acknowledged', color: THEME.colors.warning },
  awaiting_quote: { label: 'Awaiting Quote', color: THEME.colors.info },
  approved: { label: 'Approved', color: THEME.colors.info },
  scheduled: { label: 'Scheduled', color: THEME.colors.info },
  in_progress: { label: 'In Progress', color: THEME.colors.brand },
  completed: { label: 'Completed', color: THEME.colors.success },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary },
  on_hold: { label: 'On Hold', color: THEME.colors.textTertiary },
} as const;

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

export function MaintenanceTab({ propertyId }: { propertyId: string }) {
  const { requests, loading } = useMaintenance({ propertyId });
  const { hasActiveMaintenanceTask, recentActions } = useCasaPropertyActions(propertyId);
  const maintenanceAction = recentActions.find(a => a.type === 'maintenance');

  const active = requests.filter(r => r.status === 'submitted' || r.status === 'acknowledged' || r.status === 'awaiting_quote' || r.status === 'approved' || r.status === 'scheduled' || r.status === 'in_progress');
  const completed = requests.filter(r => r.status === 'completed' || r.status === 'cancelled');

  if (!loading && requests.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.emptyTitle}>No maintenance requests</Text>
        <Text style={styles.emptyText}>Maintenance requests for this property will appear here.</Text>
        <TouchableOpacity
          style={styles.newRequestBtn}
          onPress={() => router.push('/(app)/maintenance' as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.newRequestBtnText}>New Request</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bannerMessage = hasActiveMaintenanceTask && maintenanceAction
    ? `Casa ${maintenanceAction.title.toLowerCase()} on ${new Date(maintenanceAction.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
    : null;

  return (
    <View style={styles.container}>
      {bannerMessage && <CasaBanner message={bannerMessage} />}

      {/* New Request button */}
      <TouchableOpacity
        style={styles.newRequestTopBtn}
        onPress={() => router.push('/(app)/maintenance' as any)}
        activeOpacity={0.7}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <Text style={styles.newRequestTopBtnText}>New Request</Text>
      </TouchableOpacity>

      {/* Active */}
      {active.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active ({active.length})</Text>
          {active.map(req => {
            const urgency = URGENCY_CONFIG[req.urgency as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG.medium;
            const status = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted;
            return (
              <TouchableOpacity
                key={req.id}
                style={styles.requestCard}
                onPress={() => router.push(`/(app)/maintenance/${req.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.requestHeader}>
                  <Text style={styles.requestTitle} numberOfLines={1}>{req.title}</Text>
                  <View style={[styles.urgencyBadge, { backgroundColor: urgency.bg }]}>
                    <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
                  </View>
                </View>
                <View style={styles.requestMeta}>
                  <View style={styles.statusDot}>
                    <View style={[styles.dot, { backgroundColor: status.color }]} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                  <Text style={styles.requestDate}>
                    {new Date(req.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed ({completed.length})</Text>
          {completed.slice(0, 5).map(req => {
            const status = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.completed;
            return (
              <TouchableOpacity
                key={req.id}
                style={[styles.requestCard, styles.completedCard]}
                onPress={() => router.push(`/(app)/maintenance/${req.id}` as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.completedTitle} numberOfLines={1}>{req.title}</Text>
                <Text style={styles.requestDate}>
                  {new Date(req.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </Text>
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
  newRequestTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    backgroundColor: THEME.colors.brand,
    borderRadius: 10,
    marginBottom: 16,
  },
  newRequestTopBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  requestCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  requestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  requestDate: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
  completedCard: {
    opacity: 0.7,
  },
  completedTitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
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
  newRequestBtn: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newRequestBtnText: {
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
