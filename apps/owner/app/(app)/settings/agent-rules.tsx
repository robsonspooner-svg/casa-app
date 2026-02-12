import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useAgentRules } from '@casa/api';
import type { AgentRule, RuleCategory } from '@casa/api';

const CATEGORY_OPTIONS: Array<{ key: RuleCategory; label: string }> = [
  { key: 'communication', label: 'Communication' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'financial', label: 'Financial' },
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'tenant_relations', label: 'Tenant Relations' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'general', label: 'General' },
];

const SOURCE_LABELS: Record<string, string> = {
  correction_pattern: 'Learned',
  explicit: 'Manual',
  inferred: 'Inferred',
  correction: 'From Correction',
};

const SOURCE_COLORS: Record<string, string> = {
  correction_pattern: THEME.colors.info,
  explicit: THEME.colors.brand,
  inferred: THEME.colors.warning,
  correction: THEME.colors.error,
};

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke={THEME.colors.error} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence >= 0.7 ? THEME.colors.success : confidence >= 0.4 ? THEME.colors.warning : THEME.colors.error;
  return (
    <View style={confStyles.container}>
      <View style={confStyles.track}>
        <View style={[confStyles.fill, { width: `${Math.round(confidence * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[confStyles.label, { color }]}>{Math.round(confidence * 100)}%</Text>
    </View>
  );
}

const confStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: THEME.colors.subtle },
  fill: { height: 4, borderRadius: 2 },
  label: { fontSize: 11, fontWeight: '600', width: 32, textAlign: 'right' },
});

function RuleCard({
  rule,
  onToggle,
  onDelete,
}: {
  rule: AgentRule;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <View style={[cardStyles.card, !rule.active && cardStyles.cardInactive]}>
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.sourceBadge, { backgroundColor: (SOURCE_COLORS[rule.source] || THEME.colors.textTertiary) + '20' }]}>
          <Text style={[cardStyles.sourceText, { color: SOURCE_COLORS[rule.source] || THEME.colors.textTertiary }]}>
            {SOURCE_LABELS[rule.source] || rule.source}
          </Text>
        </View>
        <View style={[cardStyles.categoryBadge]}>
          <Text style={cardStyles.categoryText}>{rule.category}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Switch
          value={rule.active}
          onValueChange={onToggle}
          trackColor={{ false: THEME.colors.subtle, true: THEME.colors.brand + '60' }}
          thumbColor={rule.active ? THEME.colors.brand : THEME.colors.textTertiary}
          style={{ transform: [{ scale: 0.8 }] }}
        />
      </View>

      <Text style={[cardStyles.ruleText, !rule.active && cardStyles.ruleTextInactive]}>
        {rule.rule_text}
      </Text>

      <View style={cardStyles.bottomRow}>
        <ConfidenceBar confidence={rule.confidence} />
        <View style={cardStyles.stats}>
          <Text style={cardStyles.statText}>{rule.applications_count} applied</Text>
          <Text style={cardStyles.statSeparator}>/</Text>
          <Text style={cardStyles.statText}>{rule.rejections_count} rejected</Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={cardStyles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <TrashIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    gap: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  cardInactive: {
    opacity: 0.6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.md,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.subtle,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  ruleText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    lineHeight: 22,
  },
  ruleTextInactive: {
    color: THEME.colors.textTertiary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
  },
  statSeparator: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
  },
  deleteBtn: {
    padding: 4,
  },
});

function AddRuleModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (ruleText: string, category: RuleCategory) => void;
}) {
  const [ruleText, setRuleText] = useState('');
  const [category, setCategory] = useState<RuleCategory>('general');

  if (!visible) return null;

  const handleSubmit = () => {
    if (!ruleText.trim()) return;
    onSubmit(ruleText.trim(), category);
    setRuleText('');
    setCategory('general');
  };

  return (
    <View style={modalStyles.overlay}>
      <View style={modalStyles.container}>
        <Text style={modalStyles.title}>Add a Rule</Text>
        <Text style={modalStyles.description}>
          Tell Casa what to do or avoid. This rule will be injected into every conversation.
        </Text>

        <Text style={modalStyles.label}>Rule</Text>
        <TextInput
          style={modalStyles.input}
          value={ruleText}
          onChangeText={setRuleText}
          placeholder="e.g. Always get my approval for quotes over $500"
          placeholderTextColor={THEME.colors.textTertiary}
          multiline
          maxLength={500}
        />

        <Text style={modalStyles.label}>Category</Text>
        <View style={modalStyles.categoryGrid}>
          {CATEGORY_OPTIONS.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                modalStyles.categoryChip,
                category === cat.key && modalStyles.categoryChipSelected,
              ]}
              onPress={() => setCategory(cat.key)}
            >
              <Text style={[
                modalStyles.categoryChipText,
                category === cat.key && modalStyles.categoryChipTextSelected,
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={modalStyles.actions}>
          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
            <Text style={modalStyles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.submitBtn, !ruleText.trim() && { opacity: 0.4 }]}
            onPress={handleSubmit}
            disabled={!ruleText.trim()}
          >
            <Text style={modalStyles.submitBtnText}>Add Rule</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  container: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    gap: THEME.spacing.md,
  },
  title: {
    fontSize: THEME.fontSize.h3,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  description: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  label: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  input: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.subtle,
  },
  categoryChipSelected: {
    backgroundColor: THEME.colors.brand,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: THEME.colors.textInverse,
  },
  actions: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  cancelBtnText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  submitBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.brand,
  },
  submitBtnText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
});

export default function AgentRulesScreen() {
  const { rules, loading, error, refetch, toggleRule, deleteRule, createRule } = useAgentRules();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'learned' | 'manual'>('all');

  const filteredRules = rules.filter((r) => {
    if (filter === 'active') return r.active;
    if (filter === 'learned') return r.source === 'correction_pattern' || r.source === 'inferred';
    if (filter === 'manual') return r.source === 'explicit';
    return true;
  });

  const learnedCount = rules.filter(r => r.source === 'correction_pattern' || r.source === 'inferred').length;
  const manualCount = rules.filter(r => r.source === 'explicit').length;

  const handleDelete = (rule: AgentRule) => {
    Alert.alert(
      'Delete Rule',
      `Are you sure you want to delete this rule?\n\n"${rule.rule_text.substring(0, 100)}${rule.rule_text.length > 100 ? '...' : ''}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRule(rule.id),
        },
      ],
    );
  };

  const handleAddRule = async (ruleText: string, category: RuleCategory) => {
    await createRule({ rule_text: ruleText, category });
    setShowAddModal(false);
  };

  if (loading && rules.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agent Rules</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agent Rules</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <PlusIcon />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
      >
        <Text style={styles.description}>
          Rules guide how Casa handles your properties. They're learned from your corrections or created manually.
        </Text>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{rules.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: THEME.colors.info }]}>{learnedCount}</Text>
            <Text style={styles.summaryLabel}>Learned</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: THEME.colors.brand }]}>{manualCount}</Text>
            <Text style={styles.summaryLabel}>Manual</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          {(['all', 'active', 'learned', 'manual'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'learned' ? 'Learned' : 'Manual'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rules List */}
        {filteredRules.length === 0 ? (
          <View style={styles.emptyState}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyTitle}>No Rules Yet</Text>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'Casa will learn rules from your corrections, or you can add them manually.'
                : `No ${filter} rules found.`}
            </Text>
            {filter === 'all' && (
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAddModal(true)}>
                <Text style={styles.emptyAddBtnText}>Add Your First Rule</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.rulesList}>
            {filteredRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={(active) => toggleRule(rule.id, active)}
                onDelete={() => handleDelete(rule)}
              />
            ))}
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <AddRuleModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddRule}
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
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.subtle,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.brand,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  filterTextActive: {
    color: THEME.colors.textInverse,
  },
  rulesList: {
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyAddBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.brand,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: THEME.colors.errorBg,
    borderRadius: THEME.radius.md,
  },
  errorText: {
    fontSize: 13,
    color: THEME.colors.error,
  },
});
