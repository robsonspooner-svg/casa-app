import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useLearningContent } from '@casa/api';
import type { LearningArticle } from '@casa/api';

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={filled ? THEME.colors.warning : 'none'}>
      <Path
        d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
        stroke={filled ? THEME.colors.warning : THEME.colors.textPrimary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function renderMarkdown(markdown: string): React.ReactNode[] {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <Text key={i} style={styles.h3}>{line.slice(4).replace(/\*{1,3}/g, '')}</Text>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <Text key={i} style={styles.h2}>{line.slice(3).replace(/\*{1,3}/g, '')}</Text>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <Text key={i} style={styles.h1}>{line.slice(2).replace(/\*{1,3}/g, '')}</Text>
      );
    }
    // Bullet points
    else if (line.match(/^[-*]\s+/)) {
      const text = line.replace(/^[-*]\s+/, '').replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
      elements.push(
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>{'  \u2022  '}</Text>
          <Text style={styles.bulletText}>{text}</Text>
        </View>
      );
    }
    // Numbered list
    else if (line.match(/^\d+\.\s+/)) {
      const text = line.replace(/^\d+\.\s+/, '').replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
      const num = line.match(/^(\d+)\./)?.[1] || '';
      elements.push(
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>{`  ${num}.  `}</Text>
          <Text style={styles.bulletText}>{text}</Text>
        </View>
      );
    }
    // Horizontal rule
    else if (line.match(/^[-*_]{3,}\s*$/)) {
      elements.push(<View key={i} style={styles.hr} />);
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<View key={i} style={styles.spacer} />);
    }
    // Regular paragraph
    else {
      const text = line
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      elements.push(
        <Text key={i} style={styles.paragraph}>{text}</Text>
      );
    }
  }

  return elements;
}

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { getArticle, progress, toggleBookmark, markRead, markCompleted } = useLearningContent();
  const [article, setArticle] = useState<LearningArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getArticle(slug).then(data => {
      setArticle(data);
      setLoading(false);
      if (data) markRead(data.id);
    });
  }, [slug, getArticle, markRead]);

  const isBookmarked = article ? (progress[article.id]?.bookmarked ?? false) : false;
  const isCompleted = article ? (progress[article.id]?.completed ?? false) : false;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Article not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => toggleBookmark(article.id)} style={styles.headerBtn}>
            <BookmarkIcon filled={isBookmarked} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.meta}>
          <Text style={styles.category}>{article.category.replace(/_/g, ' ')}</Text>
          {article.state && <Text style={styles.state}>{article.state}</Text>}
          <Text style={styles.readTime}>{article.reading_time_minutes} min read</Text>
        </View>

        <Text style={styles.title}>{article.title}</Text>

        <View style={styles.articleBody}>
          {renderMarkdown(article.content_markdown)}
        </View>

        {!isCompleted && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => markCompleted(article.id)}
            activeOpacity={0.7}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.completeBtnText}>Mark as read</Text>
          </TouchableOpacity>
        )}

        {isCompleted && (
          <View style={styles.completedBadge}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.completedText}>Completed</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.colors.canvas },
  errorText: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, marginBottom: 12 },
  backLink: { padding: 8 },
  backLinkText: { fontSize: THEME.fontSize.body, color: THEME.colors.brand, fontWeight: '600' },
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
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  category: { fontSize: 12, color: THEME.colors.brand, fontWeight: '600', textTransform: 'capitalize' },
  state: { fontSize: 12, color: THEME.colors.textTertiary, fontWeight: '500' },
  readTime: { fontSize: 12, color: THEME.colors.textTertiary },
  title: { fontSize: 24, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 20, lineHeight: 32 },
  articleBody: { gap: 4 },
  h1: { fontSize: 22, fontWeight: '700', color: THEME.colors.textPrimary, marginTop: 20, marginBottom: 8, lineHeight: 28 },
  h2: { fontSize: 18, fontWeight: '700', color: THEME.colors.textPrimary, marginTop: 16, marginBottom: 6, lineHeight: 24 },
  h3: { fontSize: 16, fontWeight: '600', color: THEME.colors.textPrimary, marginTop: 12, marginBottom: 4, lineHeight: 22 },
  paragraph: { fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary, lineHeight: 24 },
  bulletRow: { flexDirection: 'row', paddingRight: 16 },
  bullet: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, lineHeight: 24 },
  bulletText: { flex: 1, fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary, lineHeight: 24 },
  hr: { height: 1, backgroundColor: THEME.colors.border, marginVertical: 16 },
  spacer: { height: 8 },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.lg,
  },
  completeBtnText: { fontSize: THEME.fontSize.body, fontWeight: '600', color: THEME.colors.textInverse },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
    backgroundColor: THEME.colors.successBg,
    borderRadius: THEME.radius.lg,
  },
  completedText: { fontSize: THEME.fontSize.body, fontWeight: '600', color: THEME.colors.success },
});
