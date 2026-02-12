import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useLearningContent } from '@casa/api';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function BookmarksScreen() {
  const { bookmarks, loading, fetchBookmarks } = useLearningContent();

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bookmarks</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.emptyState}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.emptyTitle}>No bookmarks yet</Text>
          <Text style={styles.emptyText}>Bookmark articles to save them for later.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {bookmarks.map(article => (
            <TouchableOpacity
              key={article.id}
              style={styles.card}
              onPress={() => router.push(`/(app)/learn/${article.slug}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>{article.title}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardCategory}>{article.category.replace(/_/g, ' ')}</Text>
                  {article.state && <Text style={styles.cardState}>{article.state}</Text>}
                  <Text style={styles.cardTime}>{article.reading_time_minutes} min read</Text>
                </View>
              </View>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill={THEME.colors.warning}>
                <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={THEME.colors.warning} strokeWidth={1.5} />
              </Svg>
            </TouchableOpacity>
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontSize: THEME.fontSize.h3, fontWeight: '600', color: THEME.colors.textPrimary },
  emptyText: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    ...THEME.shadow.sm,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: THEME.fontSize.body, fontWeight: '600', color: THEME.colors.textPrimary, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardCategory: { fontSize: 11, color: THEME.colors.brand, fontWeight: '500', textTransform: 'capitalize' },
  cardState: { fontSize: 11, color: THEME.colors.textTertiary, fontWeight: '500' },
  cardTime: { fontSize: 11, color: THEME.colors.textTertiary },
});
