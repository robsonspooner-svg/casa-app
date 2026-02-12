import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import type { SubscriptionTier } from '@casa/config';
import { useAutonomySettings, useAutonomyGraduation, useProfile, AutonomyPreset, AutonomyLevel } from '@casa/api';

const MAX_AUTONOMY_INDEX: Record<SubscriptionTier, number> = {
  starter: 1,  // L0-L1
  pro: 2,      // L0-L2
  hands_off: 4, // L0-L4
};

const TIER_LABELS: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  hands_off: 'Hands-Off',
};

function getNextTierForLevel(levelIndex: number): SubscriptionTier | null {
  if (levelIndex <= 1) return null; // Starter supports L0-L1
  if (levelIndex <= 2) return 'pro';
  return 'hands_off';
}

const PRESET_MIN_TIER: Record<AutonomyPreset, SubscriptionTier> = {
  cautious: 'starter',
  balanced: 'pro',
  hands_off: 'hands_off',
  custom: 'starter',
};

const TIER_RANK: Record<SubscriptionTier, number> = {
  starter: 0,
  pro: 1,
  hands_off: 2,
};

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
  { key: 'inspections', label: 'Inspections', description: 'Routine and entry/exit inspections' },
  { key: 'listings', label: 'Listings', description: 'Property listing creation and management' },
  { key: 'financial', label: 'Financial', description: 'Payment tracking, anomalies, and reports' },
  { key: 'insurance', label: 'Insurance', description: 'Landlord insurance renewal and claims' },
  { key: 'communication', label: 'Communication', description: 'Tenant messages, notices, and follow-ups' },
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
  isLocked = false,
  lockedTierLabel,
  onPress,
}: {
  preset: typeof PRESETS[number];
  isSelected: boolean;
  isLocked?: boolean;
  lockedTierLabel?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.presetCard,
        isSelected && styles.presetCardSelected,
        isLocked && styles.presetCardLocked,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.presetHeader}>
        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
        <Text style={[styles.presetTitle, isSelected && styles.presetTitleSelected, isLocked && styles.presetTitleLocked]}>
          {preset.title}
        </Text>
        {isLocked && lockedTierLabel && (
          <View style={styles.lockedBadge}>
            <Text style={styles.lockedBadgeText}>{lockedTierLabel}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.presetDescription, isLocked && styles.presetDescriptionLocked]}>
        {preset.description}
      </Text>
    </TouchableOpacity>
  );
}

function LevelSelector({
  category,
  currentLevel,
  onLevelChange,
  maxLevelIndex,
  onUpgradeRequired,
}: {
  category: typeof CATEGORIES[number];
  currentLevel: AutonomyLevel;
  onLevelChange: (level: AutonomyLevel) => void;
  maxLevelIndex: number;
  onUpgradeRequired: (levelIndex: number) => void;
}) {
  const currentIndex = AUTONOMY_LEVELS.findIndex(l => l.key === currentLevel);

  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryLabel}>{category.label}</Text>
        <Text style={styles.categoryDescription}>{category.description}</Text>
      </View>
      <View style={styles.levelButtons}>
        {AUTONOMY_LEVELS.map((level, idx) => {
          const isLocked = idx > maxLevelIndex;
          return (
            <TouchableOpacity
              key={level.key}
              style={[
                styles.levelButton,
                idx === currentIndex && styles.levelButtonActive,
                isLocked && styles.levelButtonLocked,
              ]}
              onPress={() => {
                if (isLocked) {
                  onUpgradeRequired(idx);
                } else {
                  onLevelChange(level.key);
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.levelButtonText,
                  idx === currentIndex && styles.levelButtonTextActive,
                  isLocked && styles.levelButtonTextLocked,
                ]}
              >
                {level.shortLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.levelDescription}>
        {AUTONOMY_LEVELS[currentIndex]?.description || ''}
      </Text>
    </View>
  );
}

function GraduationProgressCard({
  category,
  currentLevel,
  consecutiveApprovals,
  threshold,
  eligible,
  progressPct,
  onAccept,
  onDecline,
}: {
  category: string;
  currentLevel: number;
  consecutiveApprovals: number;
  threshold: number;
  eligible: boolean;
  progressPct: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const categoryLabel = CATEGORIES.find(c => c.key === category)?.label || category;
  const levelLabel = AUTONOMY_LEVELS[currentLevel]?.label || `L${currentLevel}`;
  const nextLevelLabel = currentLevel < 4 ? AUTONOMY_LEVELS[currentLevel + 1]?.label || `L${currentLevel + 1}` : null;

  return (
    <View style={[graduationStyles.card, eligible && graduationStyles.cardEligible]}>
      <View style={graduationStyles.topRow}>
        <Text style={graduationStyles.categoryLabel}>{categoryLabel}</Text>
        <View style={graduationStyles.levelBadge}>
          <Text style={graduationStyles.levelBadgeText}>L{currentLevel}</Text>
        </View>
      </View>

      <View style={graduationStyles.progressContainer}>
        <View style={graduationStyles.progressTrack}>
          <View style={[
            graduationStyles.progressFill,
            { width: `${progressPct}%` },
            eligible && { backgroundColor: THEME.colors.success },
          ]} />
        </View>
        <Text style={graduationStyles.progressLabel}>
          {consecutiveApprovals}/{threshold} approvals
        </Text>
      </View>

      {eligible && nextLevelLabel && (
        <View style={graduationStyles.upgradeSection}>
          <Text style={graduationStyles.upgradeText}>
            Ready to upgrade to {nextLevelLabel}
          </Text>
          <View style={graduationStyles.upgradeButtons}>
            <TouchableOpacity style={graduationStyles.acceptBtn} onPress={onAccept}>
              <Text style={graduationStyles.acceptBtnText}>Upgrade</Text>
            </TouchableOpacity>
            <TouchableOpacity style={graduationStyles.declineBtn} onPress={onDecline}>
              <Text style={graduationStyles.declineBtnText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const graduationStyles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    gap: THEME.spacing.sm,
    ...THEME.shadow.sm,
  },
  cardEligible: {
    borderWidth: 1.5,
    borderColor: THEME.colors.success,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.subtle,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  progressContainer: {
    gap: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.subtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.brand,
  },
  progressLabel: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
  },
  upgradeSection: {
    gap: THEME.spacing.sm,
    paddingTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  upgradeText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '500',
    color: THEME.colors.success,
  },
  upgradeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.success,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  declineBtn: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
});

export default function AutonomyScreen() {
  const {
    loading,
    error,
    preset,
    categoryLevels,
    updatePreset,
    updateCategoryLevel,
  } = useAutonomySettings();

  const { profile } = useProfile();
  const currentTier: SubscriptionTier = profile?.subscription_tier ?? 'starter';
  const maxLevelIndex = MAX_AUTONOMY_INDEX[currentTier];

  const {
    progress: graduationProgress,
    loading: graduationLoading,
    acceptGraduation,
    declineGraduation,
  } = useAutonomyGraduation();

  const handleUpgradeRequired = (levelIndex: number) => {
    const neededTier = getNextTierForLevel(levelIndex);
    const tierName = neededTier ? TIER_LABELS[neededTier] : 'a higher';
    Alert.alert(
      'Upgrade Required',
      `The ${AUTONOMY_LEVELS[levelIndex]?.label || ''} autonomy level requires the ${tierName} plan. Upgrade to unlock higher autonomy levels.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View Plans', onPress: () => router.push('/(app)/settings/subscription' as any) },
      ],
    );
  };

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
          {PRESETS.map((p) => {
            const minTier = PRESET_MIN_TIER[p.key];
            const isLocked = TIER_RANK[currentTier] < TIER_RANK[minTier];
            return (
              <PresetCard
                key={p.key}
                preset={p}
                isSelected={preset === p.key}
                isLocked={isLocked}
                lockedTierLabel={isLocked ? TIER_LABELS[minTier] : undefined}
                onPress={() => {
                  if (isLocked) {
                    Alert.alert(
                      'Upgrade Required',
                      `The ${p.title} preset requires the ${TIER_LABELS[minTier]} plan.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'View Plans', onPress: () => router.push('/(app)/settings/subscription' as any) },
                      ],
                    );
                  } else {
                    updatePreset(p.key);
                  }
                }}
              />
            );
          })}
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
              maxLevelIndex={maxLevelIndex}
              onUpgradeRequired={handleUpgradeRequired}
              onLevelChange={(level) => {
                if (preset !== 'custom') {
                  updatePreset('custom');
                }
                updateCategoryLevel(cat.key, level);
              }}
            />
          ))}
        </View>

        {/* Graduation Progress */}
        {graduationProgress.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Graduation Progress</Text>
            <Text style={styles.sectionHint}>
              When Casa consistently gets things right, it can earn more autonomy.
            </Text>
            <View style={styles.categoriesList}>
              {graduationProgress.map((gp) => (
                <GraduationProgressCard
                  key={gp.category}
                  category={gp.category}
                  currentLevel={gp.current_level}
                  consecutiveApprovals={gp.consecutive_approvals}
                  threshold={gp.threshold}
                  eligible={gp.eligible}
                  progressPct={gp.progress_pct}
                  onAccept={() => {
                    Alert.alert(
                      'Upgrade Autonomy',
                      `Allow Casa to operate at a higher level for ${CATEGORIES.find(c => c.key === gp.category)?.label || gp.category}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Upgrade',
                          onPress: async () => {
                            try {
                              await acceptGraduation(gp.category);
                            } catch (err: any) {
                              Alert.alert('Error', err.message || 'Failed to upgrade autonomy. Please try again.');
                            }
                          },
                        },
                      ],
                    );
                  }}
                  onDecline={async () => {
                    try {
                      await declineGraduation(gp.category);
                    } catch (err: any) {
                      Alert.alert('Error', err.message || 'Failed to decline graduation. Please try again.');
                    }
                  }}
                />
              ))}
            </View>
          </>
        )}

        {/* Quick Actions */}
        <TouchableOpacity
          style={styles.rulesLink}
          onPress={() => router.push('/(app)/settings/agent-rules' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.rulesLinkIcon}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rulesLinkTitle}>Manage Agent Rules</Text>
            <Text style={styles.rulesLinkDesc}>View, create, and manage rules Casa follows</Text>
          </View>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>

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
    backgroundColor: THEME.colors.brand + '10',
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
  presetCardLocked: {
    opacity: 0.6,
    borderColor: THEME.colors.border,
  },
  presetTitleLocked: {
    color: THEME.colors.textTertiary,
  },
  presetDescriptionLocked: {
    color: THEME.colors.textTertiary,
  },
  lockedBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.subtle,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: THEME.fontWeight.semibold,
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
  levelButtonLocked: {
    backgroundColor: THEME.colors.subtle,
    opacity: 0.5,
  },
  levelButtonTextLocked: {
    color: THEME.colors.textTertiary,
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
  // Rules link
  rulesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.lg,
    ...THEME.shadow.sm,
  },
  rulesLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rulesLinkTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  rulesLinkDesc: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 1,
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
