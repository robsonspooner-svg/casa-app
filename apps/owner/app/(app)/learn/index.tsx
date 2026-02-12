import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useLearningContent } from '@casa/api';
import type { LearningArticle } from '@casa/api';

const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'getting_started', label: 'Getting Started' },
  { key: 'legal', label: 'Legal' },
  { key: 'financial', label: 'Financial' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'tenant_relations', label: 'Tenants' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'insurance', label: 'Insurance' },
];

const CATEGORY_ICONS: Record<string, string> = {
  getting_started: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  legal: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  financial: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  maintenance: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  tenant_relations: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
  compliance: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  insurance: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ContentCard({ article, isBookmarked }: { article: LearningArticle; isBookmarked: boolean }) {
  const icon = CATEGORY_ICONS[article.category] || CATEGORY_ICONS.getting_started;

  return (
    <TouchableOpacity
      style={styles.contentCard}
      onPress={() => router.push(`/(app)/learn/${article.slug}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardIcon}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d={icon} stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{article.title}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardCategory}>{article.category.replace(/_/g, ' ')}</Text>
          {article.state && <Text style={styles.cardState}>{article.state}</Text>}
          <Text style={styles.cardTime}>{article.reading_time_minutes} min read</Text>
        </View>
      </View>
      {isBookmarked && (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill={THEME.colors.warning}>
          <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={THEME.colors.warning} strokeWidth={1.5} />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

export default function LearnHubScreen() {
  const { articles, progress, loading, fetchArticles } = useLearningContent();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchText, setSearchText] = useState('');

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    fetchArticles({ category: category || undefined, search: searchText || undefined });
  };

  const handleSearch = () => {
    fetchArticles({ category: selectedCategory || undefined, search: searchText || undefined });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Learn</Text>
        <TouchableOpacity
          onPress={() => router.push('/(app)/learn/bookmarks' as any)}
          style={styles.bookmarkBtn}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Search articles..."
          placeholderTextColor={THEME.colors.textTertiary}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.chip, selectedCategory === cat.key && styles.chipActive]}
            onPress={() => handleCategoryChange(cat.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selectedCategory === cat.key && styles.chipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No articles yet</Text>
          <Text style={styles.emptyText}>
            Learning content will be added as Casa grows. Check back soon for guides on managing your property.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {articles.map(article => (
            <ContentCard
              key={article.id}
              article={article}
              isBookmarked={progress[article.id]?.bookmarked ?? false}
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
  bookmarkBtn: { padding: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
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
  emptyText: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8, paddingBottom: 40 },
  contentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    ...THEME.shadow.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: THEME.fontSize.body, fontWeight: '600', color: THEME.colors.textPrimary, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardCategory: { fontSize: 11, color: THEME.colors.brand, fontWeight: '500', textTransform: 'capitalize' },
  cardState: { fontSize: 11, color: THEME.colors.textTertiary, fontWeight: '500' },
  cardTime: { fontSize: 11, color: THEME.colors.textTertiary },
});
