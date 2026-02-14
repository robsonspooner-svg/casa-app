import { useState, useRef, useCallback, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, Input } from '@casa/ui';
import { getSupabaseClient, useAuth, useConnection } from '@casa/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function CasaLogo() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Path
        d="M40 10L14 28v24c0 4.42 3.58 8 8 8h36c4.42 0 8-3.58 8-8V28L40 10z"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={THEME.colors.brand}
        fillOpacity={0.08}
      />
      <Path
        d="M32 56V40h16v16"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChatIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Path
        d="M60 38c0 11.046-8.954 20-20 20-3.09 0-6.013-.7-8.624-1.952L18 60l3.952-13.376A19.872 19.872 0 0120 38c0-11.046 8.954-20 20-20s20 8.954 20 20z"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={THEME.colors.brand}
        fillOpacity={0.08}
      />
      <Circle cx="32" cy="38" r="2" fill={THEME.colors.brand} />
      <Circle cx="40" cy="38" r="2" fill={THEME.colors.brand} />
      <Circle cx="48" cy="38" r="2" fill={THEME.colors.brand} />
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
        fill={THEME.colors.brand}
        fillOpacity={0.08}
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

function LinkIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Path
        d="M33 43a16.67 16.67 0 0025.13 1.8l10-10a16.67 16.67 0 00-23.57-23.57l-5.73 5.7"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M47 37a16.67 16.67 0 00-25.13-1.8l-10 10a16.67 16.67 0 0023.57 23.57l5.7-5.73"
        stroke={THEME.colors.brand}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface WalkthroughPage {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const PAGES: WalkthroughPage[] = [
  {
    title: 'Welcome to Casa',
    description:
      'Your smart rental companion. Casa helps you manage your tenancy, pay rent, submit maintenance requests, and communicate with your landlord — all in one place.',
    icon: <CasaLogo />,
  },
  {
    title: 'Chat With Casa AI',
    description:
      'Have questions about your lease, rent, or rights? Just ask Casa. Your AI assistant knows your tenancy details and Australian tenancy law.',
    icon: <ChatIcon />,
  },
  {
    title: 'Stay Protected',
    description:
      'Casa keeps you informed about your rights, tracks your maintenance requests, and helps you stay on top of rent and important dates.',
    icon: <ShieldIcon />,
  },
];

export default function TenantOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { useCode, connectToTenancy, connectToProperty } = useConnection();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showConnect, setShowConnect] = useState(false);
  const [connectionCode, setConnectionCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Pre-fill connection code from deep link
  useEffect(() => {
    AsyncStorage.getItem('casa_invite_code').then((code) => {
      if (code) {
        setConnectionCode(code);
        AsyncStorage.removeItem('casa_invite_code').catch(() => {});
      }
    }).catch(() => {});
  }, []);

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
    const { error } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
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
                message: 'I just signed up as a tenant on Casa. Give me a brief welcome and tell me what you can help me with.',
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
    setShowConnect(true);
  }, []);

  const handleNoCode = useCallback(() => {
    Alert.alert(
      'Connection Code',
      'Ask your landlord or property manager for your Casa connection code. You can also connect later from the Home screen or by chatting with Casa AI.',
    );
  }, []);

  const handleConnect = useCallback(async () => {
    const trimmedCode = connectionCode.trim().toUpperCase();
    if (trimmedCode.length !== 6) {
      setCodeError('Connection code must be 6 characters.');
      return;
    }

    setConnecting(true);
    setCodeError(null);

    try {
      const result = await useCode(trimmedCode);

      if (!result.success) {
        setCodeError(result.message || 'Invalid connection code. Please check and try again.');
        setConnecting(false);
        return;
      }

      let connected = false;
      if (result.tenancyId) {
        connected = await connectToTenancy(result.tenancyId, trimmedCode);
      } else if (result.propertyId && result.ownerId) {
        connected = await connectToProperty(result.propertyId, result.ownerId, trimmedCode);
      }

      if (!connected) {
        setCodeError('Unable to connect to property. Please try again.');
        setConnecting(false);
        return;
      }

      // Success — complete onboarding
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
                message: 'I just connected to my rental property on Casa. Give me a brief welcome, tell me about my tenancy details, and what you can help me with.',
              }),
            }
          ).catch(() => {});
        }
      } catch { /* non-blocking */ }
      router.replace('/(app)/(tabs)' as never);
    } catch {
      setCodeError('Something went wrong. Please try again.');
    } finally {
      setConnecting(false);
    }
  }, [connectionCode, useCode, connectToTenancy, connectToProperty, markOnboardingComplete]);

  const handleSkipConnect = useCallback(async () => {
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
                message: 'I just signed up as a tenant on Casa. Give me a brief welcome and tell me what you can help me with.',
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

  // Connection code screen (shown after walkthrough)
  if (showConnect) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.skipContainer}>
          <TouchableOpacity
            onPress={() => setShowConnect(false)}
            style={styles.skipButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>Back</Text>
          </TouchableOpacity>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.connectContent}>
          <View style={styles.iconWrapper}>
            <LinkIcon />
          </View>
          <Text style={styles.pageTitle}>Connect to Your Property</Text>
          <Text style={styles.pageDescription}>
            Enter the 6-character connection code from your landlord to link your account to your rental property.
          </Text>
          <View style={styles.inputArea}>
            <Input
              label="Connection Code"
              placeholder="e.g. ABC123"
              value={connectionCode}
              onChangeText={(text: string) => {
                setConnectionCode(text.toUpperCase().slice(0, 6));
                if (codeError) setCodeError(null);
              }}
              error={codeError ?? undefined}
              autoCapitalize="characters"
              maxLength={6}
              autoCorrect={false}
              inputStyle={styles.codeInput}
            />
            <Button
              title="I don't have a code"
              variant="text"
              onPress={handleNoCode}
              textStyle={styles.noCodeText}
            />
          </View>
        </View>

        <View style={styles.connectBottomArea}>
          <Button
            title="Connect"
            onPress={handleConnect}
            loading={connecting}
            disabled={connectionCode.trim().length === 0}
          />
          <Button
            title="Skip for Now"
            variant="text"
            onPress={handleSkipConnect}
            loading={completing}
          />
        </View>
      </View>
    );
  }

  // Swipeable walkthrough
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.skipContainer}>
        <View style={{ width: 60 }} />
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
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomArea}>
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

        {activeIndex === PAGES.length - 1 ? (
          <Button title="Get Started" onPress={handleGetStarted} />
        ) : (
          <Button
            title="Next"
            onPress={() => {
              scrollRef.current?.scrollTo({
                x: (activeIndex + 1) * SCREEN_WIDTH,
                animated: true,
              });
            }}
          />
        )}
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
  bottomArea: {
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    paddingBottom: THEME.spacing.xl,
    gap: THEME.spacing.base,
  },
  paginationContainer: {
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
    backgroundColor: THEME.colors.brand,
    width: 24,
  },
  dotInactive: {
    backgroundColor: THEME.colors.border,
  },

  // Connect screen
  connectContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  inputArea: {
    width: '100%',
    maxWidth: 320,
    marginTop: THEME.spacing.xl,
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  codeInput: {
    fontSize: 20,
    fontWeight: THEME.fontWeight.semibold,
    letterSpacing: 4,
    textAlign: 'center',
  },
  noCodeText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  connectBottomArea: {
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    paddingBottom: THEME.spacing.xl,
    gap: THEME.spacing.sm,
  },
});
