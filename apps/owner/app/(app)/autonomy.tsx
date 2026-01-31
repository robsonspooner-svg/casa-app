import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useAutonomySettings, AutonomyPreset, AutonomyLevel } from '@casa/api';

const PRESETS: Array<{
  key: AutonomyPreset;
  title: string;
  description: string;
}> = [
  {
    key: 'cautious',
    title: 'Cautious',
    description: 'Casa drafts actions and waits for your approval. Best for new users who want full control.',
  },
  {
    key: 'balanced',
    title: 'Balanced',
    description: 'Routine actions run automatically. Financial and legal decisions need your approval.',
  },
  {
    key: 'hands_off',
    title: 'Hands Off',
    description: 'Maximum autonomy. Casa handles everything except critical legal actions.',
  },
  {
    key: 'custom',
    title: 'Custom',
    description: 'Fine-tune autonomy per category to match your preferences.',
  },
];

const CATEGORIES: Array<{
  key: string;
  label: string;
  description: string;
}> = [
  { key: 'tenant_finding', label: 'Tenant Finding', description: 'Listing, screening, and selecting tenants' },
  { key: 'lease_management', label: 'Lease Management', description: 'Renewals, terminations, and lease changes' },
  { key: 'rent_collection', label: 'Rent Collection', description: 'Reminders, receipts, and arrears management' },
  { key: 'maintenance', label: 'Maintenance', description: 'Repair requests, tradesperson coordination' },
  { key: 'compliance', label: 'Compliance', description: 'Legal documents, notices, and regulatory tasks' },
  { key: 'general', label: 'General', description: 'Queries, reports, and other tasks' },
];

const AUTONOMY_LEVELS: Array<{
  key: AutonomyLevel;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  { key: 'L0', label: 'Disabled', shortLabel: 'Off', description: 'Agent cannot act in this category' },
  { key: 'L1', label: 'Suggest Only', shortLabel: 'Suggest', description: 'Agent suggests, you decide' },
  { key: 'L2', label: 'Draft & Approve', shortLabel: 'Draft', description: 'Agent drafts, you approve' },
  { key: 'L3', label: 'Auto with Notice', shortLabel: 'Auto', description: 'Agent acts and notifies you' },
  { key: 'L4', label: 'Full Auto', shortLabel: 'Full', description: 'Agent acts silently' },
];

function PresetCard({
  preset,
  isSelected,
  onPress,
}: {
  preset: typeof PRESETS[number];
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.presetCard, isSelected && styles.presetCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.presetHeader}>
        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
        <Text style={[styles.presetTitle, isSelected && styles.presetTitleSelected]}>
          {preset.title}
        </Text>
      </View>
      <Text style={styles.presetDescription}>{preset.description}</Text>
    </TouchableOpacity>
  );
}

function LevelSelector({
  category,
  currentLevel,
  onLevelChange,
}: {
  category: typeof CATEGORIES[number];
  currentLevel: AutonomyLevel;
  onLevelChange: (level: AutonomyLevel) => void;
}) {
  const currentIndex = AUTONOMY_LEVELS.findIndex(l => l.key === currentLevel);

  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryLabel}>{category.label}</Text>
        <Text style={styles.categoryDescription}>{category.description}</Text>
      </View>
      <View style={styles.levelButtons}>
        {AUTONOMY_LEVELS.map((level, idx) => (
          <TouchableOpacity
            key={level.key}
            style={[
              styles.levelButton,
              idx === currentIndex && styles.levelButtonActive,
            ]}
            onPress={() => onLevelChange(level.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.levelButtonText,
                idx === currentIndex && styles.levelButtonTextActive,
              ]}
            >
              {level.shortLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.levelDescription}>
        {AUTONOMY_LEVELS[currentIndex]?.description || ''}
      </Text>
    </View>
  );
}

export default function AutonomyScreen() {
  const {
    loading,
    error,
    preset,
    categoryLevels,
    updatePreset,
    updateCategoryLevel,
  } = useAutonomySettings();

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agent Autonomy</Text>
          <View style={{ width: 40 }} />
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
            <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agent Autonomy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionDescription}>
          Control how much your Casa AI agent can do without asking. Higher autonomy means less interruptions but more trust required.
        </Text>

        {/* Preset Selector */}
        <Text style={styles.sectionTitle}>Preset</Text>
        <View style={styles.presetList}>
          {PRESETS.map((p) => (
            <PresetCard
              key={p.key}
              preset={p}
              isSelected={preset === p.key}
              onPress={() => updatePreset(p.key)}
            />
          ))}
        </View>

        {/* Per-Category Controls (shown for Custom, or read-only for others) */}
        <Text style={styles.sectionTitle}>
          {preset === 'custom' ? 'Category Settings' : 'Current Levels'}
        </Text>
        {preset !== 'custom' && (
          <Text style={styles.sectionHint}>
            Switch to Custom to adjust individual categories.
          </Text>
        )}

        <View style={styles.categoriesList}>
          {CATEGORIES.map((cat) => (
            <LevelSelector
              key={cat.key}
              category={cat}
              currentLevel={(categoryLevels[cat.key] as AutonomyLevel) || 'L2'}
              onLevelChange={(level) => {
                if (preset !== 'custom') {
                  updatePreset('custom');
                }
                updateCategoryLevel(cat.key, level);
              }}
            />
          ))}
        </View>

        {/* Autonomy Level Legend */}
        <Text style={styles.sectionTitle}>Level Guide</Text>
        <View style={styles.legendContainer}>
          {AUTONOMY_LEVELS.map((level) => (
            <View key={level.key} style={styles.legendRow}>
              <View style={styles.legendBadge}>
                <Text style={styles.legendBadgeText}>{level.key}</Text>
              </View>
              <View style={styles.legendText}>
                <Text style={styles.legendLabel}>{level.label}</Text>
                <Text style={styles.legendDescription}>{level.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
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
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing['2xl'],
    paddingBottom: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing['3xl'],
  },
  sectionDescription: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    marginBottom: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
  },
  sectionHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginBottom: THEME.spacing.md,
    fontStyle: 'italic',
  },
  // Presets
  presetList: {
    gap: THEME.spacing.md,
  },
  presetCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  presetCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: '#F8F7FF',
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: THEME.colors.brand,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.brand,
  },
  presetTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  presetTitleSelected: {
    color: THEME.colors.brand,
  },
  presetDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
    paddingLeft: 32,
  },
  // Categories
  categoriesList: {
    gap: THEME.spacing.base,
  },
  categoryRow: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    ...THEME.shadow.sm,
  },
  categoryInfo: {
    marginBottom: THEME.spacing.md,
  },
  categoryLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  levelButtons: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: THEME.spacing.sm,
  },
  levelButton: {
    flex: 1,
    paddingVertical: THEME.spacing.sm,
    alignItems: 'center',
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.sm,
  },
  levelButtonActive: {
    backgroundColor: THEME.colors.brand,
  },
  levelButtonText: {
    fontSize: 11,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  levelButtonTextActive: {
    color: THEME.colors.textInverse,
    fontWeight: THEME.fontWeight.semibold,
  },
  levelDescription: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
  },
  // Legend
  legendContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    gap: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  legendBadge: {
    width: 32,
    height: 24,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendBadgeText: {
    fontSize: 11,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textSecondary,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  legendDescription: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  // Error
  errorContainer: {
    marginTop: THEME.spacing.base,
    padding: THEME.spacing.md,
    backgroundColor: THEME.colors.errorBg,
    borderRadius: THEME.radius.md,
  },
  errorText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.error,
  },
});
