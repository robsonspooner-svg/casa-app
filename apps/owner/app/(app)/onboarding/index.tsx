import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { THEME } from '@casa/config';
import { getSupabaseClient, useAuth } from '@casa/api';

async function signOutAndRedirect() {
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  } catch { /* ignore sign-out errors */ }
  router.replace('/(auth)/login');
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingPage {
  title: string;
  description: string;
  icon: React.ReactNode;
  showCTA: boolean;
}

function RobotIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Rect x="20" y="24" width="40" height="36" rx="8" stroke={THEME.colors.brand} strokeWidth={2.5} />
      <Circle cx="33" cy="40" r="4" fill={THEME.colors.brandIndigo} />
      <Circle cx="47" cy="40" r="4" fill={THEME.colors.brandIndigo} />
      <Path d="M32 50c0 0 4 4 8 4s8-4 8-4" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" />
      <Line x1="40" y1="14" x2="40" y2="24" stroke={THEME.colors.brand} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx="40" cy="12" r="3" fill={THEME.colors.brandIndigo} />
      <Path d="M16 36l-6 4v8l6 4" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M64 36l6 4v8l-6 4" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="28" y1="60" x2="28" y2="70" stroke={THEME.colors.brand} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1="52" y1="60" x2="52" y2="70" stroke={THEME.colors.brand} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function LightningIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Path
        d="M44 10L18 46h18L32 70l26-36H40L44 10z"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={THEME.colors.brandIndigo}
        fillOpacity={0.12}
      />
    </Svg>
  );
}

function ShieldIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Path
        d="M40 8L14 22v18c0 16.57 11.08 32.08 26 36 14.92-3.92 26-19.43 26-36V22L40 8z"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={THEME.colors.brandIndigo}
        fillOpacity={0.12}
      />
      <Path
        d="M30 40l7 7 13-14"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RocketIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Path
        d="M40 12c-8 8-14 22-14 30a14 14 0 0028 0c0-8-6-22-14-30z"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={THEME.colors.brandIndigo}
        fillOpacity={0.12}
      />
      <Circle cx="40" cy="42" r="5" stroke={THEME.colors.brand} strokeWidth={2} />
      <Path d="M26 42c-8 2-14 6-14 6s2 8 8 12" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M54 42c8 2 14 6 14 6s-2 8-8 12" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 62l-2 8M46 62l2 8M40 64v6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const PAGES: OnboardingPage[] = [
  {
    title: 'Meet Your AI Property Manager',
    description:
      'Casa handles rent collection, maintenance coordination, compliance tracking, and more \u2014 all automatically.',
    icon: <RobotIcon />,
    showCTA: false,
  },
  {
    title: 'Automate Everything',
    description:
      'From routine inspections to rent increases, Casa handles the tedious work so you don\u2019t have to.',
    icon: <LightningIcon />,
    showCTA: false,
  },
  {
    title: 'Full Compliance',
    description:
      'Stay compliant with Australian tenancy law across all states. Casa knows the rules so you don\u2019t have to.',
    icon: <ShieldIcon />,
    showCTA: false,
  },
  {
    title: 'Get Started',
    description:
      'Add your first property and let Casa take care of the rest.',
    icon: <RocketIcon />,
    showCTA: true,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completing, setCompleting] = useState(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      setActiveIndex(index);
    },
    [],
  );

  const markOnboardingComplete = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabaseClient();
    const { error } = await (supabase
      .from('profiles') as any)
      .update({ onboarding_completed: true })
      .eq('id', user.id);
    if (error) throw error;
  }, [user]);

  const handleSkip = useCallback(async () => {
    setCompleting(true);
    try {
      await markOnboardingComplete();
      // Send AI welcome message (fire-and-forget)
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/agent-chat`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: 'I just signed up for Casa. Give me a brief welcome and tell me what you can help me with as my AI property manager.',
              }),
            }
          ).catch(() => {});
        }
      } catch { /* non-blocking */ }
      router.replace('/(app)/(tabs)' as never);
    } catch {
      Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
    } finally {
      setCompleting(false);
    }
  }, [markOnboardingComplete]);

  const handleGetStarted = useCallback(() => {
    router.push('/(app)/onboarding/setup' as never);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.skipContainer}>
        <TouchableOpacity
          onPress={signOutAndRedirect}
          style={styles.skipButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.skipText, { color: THEME.colors.error }]}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSkip}
          disabled={completing}
          style={styles.skipButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

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
          <View key={index} style={styles.page}>
            <View style={styles.iconWrapper}>{page.icon}</View>
            <Text style={styles.pageTitle}>{page.title}</Text>
            <Text style={styles.pageDescription}>{page.description}</Text>
            {page.showCTA && (
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleGetStarted}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>Add My First Property</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.paginationContainer}>
        {PAGES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  skipContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing.md,
  },
  skipButton: {
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
  },
  skipText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.xl,
    ...THEME.shadow.lg,
  },
  pageTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: THEME.spacing.base,
  },
  pageDescription: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.regular,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  ctaButton: {
    marginTop: THEME.spacing.xl,
    backgroundColor: THEME.colors.brand,
    height: THEME.components.button.height,
    borderRadius: THEME.components.button.borderRadius,
    paddingHorizontal: THEME.components.button.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
  },
  ctaText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textInverse,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: THEME.spacing.xl,
    gap: THEME.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: THEME.colors.brand,
    width: 24,
  },
  dotInactive: {
    backgroundColor: THEME.colors.border,
  },
});
