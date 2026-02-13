import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { THEME } from '@casa/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOUR_SEEN_KEY = 'casa_tour_seen';

interface TourPage {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
}

// ─── Icons ────────────────────────────────────────────────────────────

function DashboardIcon() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Rect x="10" y="14" width="22" height="18" rx="4" stroke={THEME.colors.brand} strokeWidth={2} fill={THEME.colors.brand} fillOpacity={0.08} />
      <Rect x="10" y="38" width="22" height="20" rx="4" stroke={THEME.colors.brandIndigo} strokeWidth={2} fill={THEME.colors.brandIndigo} fillOpacity={0.08} />
      <Rect x="40" y="14" width="22" height="26" rx="4" stroke={THEME.colors.brandIndigo} strokeWidth={2} fill={THEME.colors.brandIndigo} fillOpacity={0.08} />
      <Rect x="40" y="46" width="22" height="12" rx="4" stroke={THEME.colors.brand} strokeWidth={2} fill={THEME.colors.brand} fillOpacity={0.08} />
      <Path d="M17 20h8M17 24h5" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M47 22h8M47 26h5M47 30h8" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function ChatBotIcon() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Path
        d="M56 32c0 11.046-8.954 20-20 20a19.87 19.87 0 01-9.95-2.65L16 52l2.65-10.05A19.87 19.87 0 0116 32c0-11.046 8.954-20 20-20s20 8.954 20 20z"
        stroke={THEME.colors.brand}
        strokeWidth={2}
        fill={THEME.colors.brand}
        fillOpacity={0.06}
      />
      <Circle cx="28" cy="32" r="2.5" fill={THEME.colors.brandIndigo} />
      <Circle cx="36" cy="32" r="2.5" fill={THEME.colors.brandIndigo} />
      <Circle cx="44" cy="32" r="2.5" fill={THEME.colors.brandIndigo} />
      <Path
        d="M28 40c0 0 3 4 8 4s8-4 8-4"
        stroke={THEME.colors.brand}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TaskCheckIcon() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Rect x="14" y="14" width="44" height="44" rx="10" stroke={THEME.colors.brand} strokeWidth={2} fill={THEME.colors.brand} fillOpacity={0.06} />
      <Path d="M26 34l6 6 14-14" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="26" y1="48" x2="46" y2="48" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" opacity={0.4} />
      <Line x1="26" y1="53" x2="38" y2="53" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" opacity={0.25} />
    </Svg>
  );
}

function PortfolioPropertyIcon() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Path
        d="M14 30l22-16 22 16"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x="20" y="30" width="32" height="26" rx="2" stroke={THEME.colors.brand} strokeWidth={2} fill={THEME.colors.brand} fillOpacity={0.06} />
      <Rect x="30" y="42" width="12" height="14" rx="1" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} fill={THEME.colors.brandIndigo} fillOpacity={0.1} />
      <Rect x="24" y="34" width="8" height="6" rx="1" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} fill={THEME.colors.brandIndigo} fillOpacity={0.08} />
      <Rect x="40" y="34" width="8" height="6" rx="1" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} fill={THEME.colors.brandIndigo} fillOpacity={0.08} />
    </Svg>
  );
}

function AutoPilotIcon() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Circle cx="36" cy="36" r="24" stroke={THEME.colors.brand} strokeWidth={2} fill={THEME.colors.brand} fillOpacity={0.06} />
      <Path d="M36 18v8M36 46v8M18 36h8M46 36h8" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
      <Circle cx="36" cy="36" r="10" stroke={THEME.colors.brandIndigo} strokeWidth={2} fill={THEME.colors.brandIndigo} fillOpacity={0.08} />
      <Path d="M32 36l3 3 5-6" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22.9 22.9l4 4M49.1 22.9l-4 4M22.9 49.1l4-4M49.1 49.1l-4-4" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" opacity={0.3} />
    </Svg>
  );
}

// ─── Tour Pages ───────────────────────────────────────────────────────

const PAGES: TourPage[] = [
  {
    title: 'Your Activity Feed',
    description:
      'See everything happening across your properties at a glance \u2014 rent payments, maintenance updates, compliance deadlines, and more.',
    icon: <DashboardIcon />,
    accentColor: THEME.colors.brand,
  },
  {
    title: 'Chat with Casa',
    description:
      'Ask Casa anything. \u201CHow are my properties doing?\u201D \u201CSend a reminder to my tenant.\u201D \u201CSchedule an inspection.\u201D Casa handles it all.',
    icon: <ChatBotIcon />,
    accentColor: THEME.colors.brandIndigo,
  },
  {
    title: 'Tasks & Approvals',
    description:
      'When Casa needs your input \u2014 like approving a repair quote or reviewing a notice \u2014 it appears here. One tap to approve.',
    icon: <TaskCheckIcon />,
    accentColor: THEME.colors.success,
  },
  {
    title: 'Your Portfolio',
    description:
      'All your properties, tenants, leases, and financials in one place. Tap any property to dive into its details.',
    icon: <PortfolioPropertyIcon />,
    accentColor: THEME.colors.brand,
  },
  {
    title: 'Always On Autopilot',
    description:
      'Casa works 24/7 \u2014 managing rent, chasing arrears, scheduling inspections, and staying compliant. You set the rules, Casa follows them.',
    icon: <AutoPilotIcon />,
    accentColor: THEME.colors.brandIndigo,
  },
];

// ─── Screen ───────────────────────────────────────────────────────────

export default function TourScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isLastPage = activeIndex === PAGES.length - 1;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== activeIndex) {
        // Animate content change
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0.6, duration: 80, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
      }
      setActiveIndex(index);
    },
    [activeIndex, fadeAnim],
  );

  const handleNext = useCallback(() => {
    if (isLastPage) {
      handleFinish();
    } else {
      scrollRef.current?.scrollTo({ x: (activeIndex + 1) * SCREEN_WIDTH, animated: true });
    }
  }, [activeIndex, isLastPage]);

  const handleFinish = useCallback(async () => {
    await AsyncStorage.setItem(TOUR_SEEN_KEY, 'true').catch(() => {});
    router.replace('/(app)/(tabs)' as never);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Skip button */}
      <View style={styles.topBar}>
        <View style={styles.spacer} />
        {!isLastPage && (
          <TouchableOpacity
            onPress={handleFinish}
            style={styles.skipButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {PAGES.map((page, index) => (
          <Animated.View key={index} style={[styles.page, { opacity: fadeAnim }]}>
            <View style={[styles.iconCircle, { borderColor: page.accentColor + '30' }]}>
              {page.icon}
            </View>

            {/* Tab indicator label */}
            {index < 4 && (
              <View style={[styles.tabLabel, { backgroundColor: page.accentColor + '15' }]}>
                <Text style={[styles.tabLabelText, { color: page.accentColor }]}>
                  {['Activity Tab', 'Chat Tab', 'Tasks Tab', 'Portfolio Tab'][index]}
                </Text>
              </View>
            )}

            <Text style={styles.pageTitle}>{page.title}</Text>
            <Text style={styles.pageDescription}>{page.description}</Text>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Pagination dots */}
        <View style={styles.pagination}>
          {PAGES.map((page, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex
                  ? [styles.dotActive, { backgroundColor: page.accentColor }]
                  : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity
          style={[
            styles.ctaButton,
            { backgroundColor: PAGES[activeIndex].accentColor },
          ]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {isLastPage ? "Let\u2019s Go" : 'Next'}
          </Text>
          {!isLastPage && (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18l6-6-6-6"
                stroke={THEME.colors.textInverse}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing.md,
    height: 44,
  },
  spacer: { flex: 1 },
  skipButton: {
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
  },
  skipText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },

  // Page
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  iconCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.lg,
    borderWidth: 2,
    ...THEME.shadow.lg,
  },
  tabLabel: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: THEME.spacing.md,
  },
  tabLabelText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    letterSpacing: 0.3,
  },
  pageTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
  },
  pageDescription: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.regular,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },

  // Bottom
  bottomSection: {
    paddingHorizontal: THEME.spacing.xl,
    paddingBottom: THEME.spacing.xl,
    gap: THEME.spacing.lg,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: THEME.colors.border,
  },
  ctaButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    ...THEME.shadow.md,
  },
  ctaText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textInverse,
  },
});
