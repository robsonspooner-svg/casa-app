// Compliance Checklist Screen - Owner App
// Mission 06: Tenancies & Leases

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import { THEME } from '@casa/config';
import { useTenancy, getComplianceChecklist, type ComplianceState, type ComplianceCategory } from '@casa/api';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={THEME.colors.brand}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        fill="#16A34A"
      />
      <Path
        d="M9 12l2 2 4-4"
        stroke={THEME.colors.surface}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EmptyCircleIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        stroke={THEME.colors.border}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke={THEME.colors.brand}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ComplianceChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading, error } = useTenancy(id || null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  const state: ComplianceState = (tenancy?.property?.state as ComplianceState) || 'NSW';
  const categories: ComplianceCategory[] = useMemo(() => getComplianceChecklist(state), [state]);

  const totalItems = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.items.length, 0),
    [categories]
  );
  const completedCount = completedItems.size;
  const progressPercent = totalItems > 0 ? completedCount / totalItems : 0;

  const toggleItem = (itemId: string) => {
    setCompletedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !tenancy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'Tenancy not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.title}>Compliance Checklist</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Progress Card */}
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>
            {completedCount} of {totalItems} items completed
          </Text>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.round(progressPercent * 100)}%` },
              ]}
            />
          </View>
        </View>

        {/* Category Sections */}
        {categories.map((category) => (
          <View key={category.id} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <View style={styles.itemsList}>
              {category.items.map((item) => {
                const isCompleted = completedItems.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemCard}
                    onPress={() => toggleItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemCheckbox}>
                      {isCompleted ? <CheckCircleIcon /> : <EmptyCircleIcon />}
                    </View>
                    <View style={styles.itemContent}>
                      <Text
                        style={[
                          styles.itemTitle,
                          isCompleted && styles.itemTitleCompleted,
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                      <View style={styles.badgeRow}>
                        {item.required && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredBadgeText}>Required</Text>
                          </View>
                        )}
                        {item.automatable && (
                          <View style={styles.automatableBadge}>
                            <Text style={styles.automatableBadgeText}>Automatable</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Quick Action Links */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() =>
              router.push(`/(app)/tenancies/${id}/generate-lease` as any)
            }
          >
            <Text style={styles.quickActionText}>Generate Lease Agreement</Text>
            <ChevronRightIcon />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() =>
              router.push(`/(app)/tenancies/${id}/condition-report` as any)
            }
          >
            <Text style={styles.quickActionText}>Condition Report</Text>
            <ChevronRightIcon />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing['2xl'],
  },
  progressCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  progressLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: THEME.colors.border,
    borderRadius: THEME.radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.full,
  },
  categorySection: {
    marginBottom: THEME.spacing.lg,
  },
  categoryTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  itemsList: {
    gap: THEME.spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  itemCheckbox: {
    marginRight: THEME.spacing.md,
    paddingTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  itemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textTertiary,
  },
  itemDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
    marginBottom: THEME.spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  requiredBadge: {
    backgroundColor: THEME.colors.errorBg,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  requiredBadgeText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.error,
  },
  automatableBadge: {
    backgroundColor: `${THEME.colors.brand}15`,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  automatableBadgeText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.brand,
  },
  quickActionsSection: {
    marginTop: THEME.spacing.sm,
    marginBottom: THEME.spacing.lg,
  },
  quickActionsTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.sm,
  },
  quickActionText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.brand,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    marginBottom: THEME.spacing.md,
  },
  retryButton: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  retryText: {
    color: THEME.colors.textInverse,
    fontWeight: THEME.fontWeight.semibold,
  },
});
