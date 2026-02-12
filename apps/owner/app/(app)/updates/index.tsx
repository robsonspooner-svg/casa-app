import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useRegulatoryUpdates } from '@casa/api';
import type { RegulatoryUpdate } from '@casa/api';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const IMPACT_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: THEME.colors.infoBg, text: THEME.colors.info },
  medium: { bg: THEME.colors.warningBg, text: THEME.colors.warning },
  high: { bg: THEME.colors.errorBg, text: THEME.colors.error },
  critical: { bg: THEME.colors.error, text: THEME.colors.textInverse },
};

function UpdateCard({
  update,
  isAcknowledged,
  onAcknowledge,
}: {
  update: RegulatoryUpdate;
  isAcknowledged: boolean;
  onAcknowledge: (id: string) => void;
}) {
  const impact = IMPACT_COLORS[update.impact_level] || IMPACT_COLORS.low;
  const effectiveDate = new Date(update.effective_date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={[styles.updateCard, isAcknowledged && styles.updateCardAcknowledged]}>
      <View style={styles.updateHeader}>
        <View style={[styles.impactBadge, { backgroundColor: impact.bg }]}>
          <Text style={[styles.impactText, { color: impact.text }]}>
            {update.impact_level.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.updateState}>{update.state}</Text>
        <Text style={styles.updateDate}>Effective: {effectiveDate}</Text>
      </View>

      <Text style={styles.updateTitle}>{update.title}</Text>
      <Text style={styles.updateDescription} numberOfLines={3}>{update.description}</Text>

      {update.action_required && (
        <View style={styles.actionRequired}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={THEME.colors.warning} strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
          <Text style={styles.actionRequiredText}>{update.action_required}</Text>
        </View>
      )}

      <View style={styles.updateFooter}>
        {update.source_url && (
          <TouchableOpacity
            onPress={() => Linking.openURL(update.source_url!)}
            activeOpacity={0.7}
          >
            <Text style={styles.sourceLink}>View source</Text>
          </TouchableOpacity>
        )}

        {!isAcknowledged ? (
          <TouchableOpacity
            style={styles.acknowledgeBtn}
            onPress={() => onAcknowledge(update.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.acknowledgeBtnText}>Acknowledge</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.acknowledgedBadge}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.acknowledgedText}>Acknowledged</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const STATES = ['All', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export default function RegulatoryUpdatesScreen() {
  const { updates, notifications, loading, fetchUpdates, acknowledgeUpdate } = useRegulatoryUpdates();
  const [selectedState, setSelectedState] = useState('All');

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    fetchUpdates({ state: state === 'All' ? undefined : state });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Regulatory Updates</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        {STATES.map(state => (
          <TouchableOpacity
            key={state}
            style={[styles.chip, selectedState === state && styles.chipActive]}
            onPress={() => handleStateChange(state)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selectedState === state && styles.chipTextActive]}>
              {state}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : updates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No updates</Text>
          <Text style={styles.emptyText}>
            Regulatory updates for your state will appear here when published.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {updates.map(update => (
            <UpdateCard
              key={update.id}
              update={update}
              isAcknowledged={!!notifications[update.id]?.acknowledged_at}
              onAcknowledge={acknowledgeUpdate}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.colors.textPrimary },
  chipScroll: { maxHeight: 50, marginTop: 12 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  chipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  chipText: { fontSize: 13, color: THEME.colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: THEME.colors.textInverse },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: THEME.fontSize.h3, fontWeight: '600', color: THEME.colors.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  updateCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    gap: 10,
    ...THEME.shadow.sm,
  },
  updateCardAcknowledged: { opacity: 0.75 },
  updateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  impactBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: THEME.radius.md },
  impactText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  updateState: { fontSize: 12, color: THEME.colors.textTertiary, fontWeight: '500' },
  updateDate: { fontSize: 11, color: THEME.colors.textTertiary, marginLeft: 'auto' },
  updateTitle: { fontSize: THEME.fontSize.body, fontWeight: '600', color: THEME.colors.textPrimary },
  updateDescription: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textSecondary, lineHeight: 20 },
  actionRequired: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: THEME.colors.warningBg,
    borderRadius: THEME.radius.sm,
  },
  actionRequiredText: { flex: 1, fontSize: THEME.fontSize.bodySmall, color: THEME.colors.warning, lineHeight: 18 },
  updateFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceLink: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.brand, fontWeight: '500' },
  acknowledgeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  acknowledgeBtnText: { fontSize: THEME.fontSize.bodySmall, fontWeight: '600', color: THEME.colors.textInverse },
  acknowledgedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  acknowledgedText: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.success, fontWeight: '500' },
});
