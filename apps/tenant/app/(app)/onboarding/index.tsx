import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, Input } from '@casa/ui';
import { getSupabaseClient, useAuth, useConnection } from '@casa/api';

type Step = 'welcome' | 'connect' | 'complete';

export default function TenantOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { useCode, connectToTenancy, connectToProperty } = useConnection();
  const [step, setStep] = useState<Step>('welcome');
  const [connectionCode, setConnectionCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Pre-fill connection code from deep link (stored in AsyncStorage by _layout.tsx)
  useEffect(() => {
    AsyncStorage.getItem('casa_invite_code').then((code) => {
      if (code) {
        setConnectionCode(code);
        AsyncStorage.removeItem('casa_invite_code').catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleGetStarted = useCallback(() => {
    setStep('connect');
  }, []);

  const handleNoCode = useCallback(() => {
    Alert.alert(
      'Connection Code',
      'Ask your landlord or property manager for your Casa connection code.',
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
      // Step 1: Validate the connection code via RPC
      const result = await useCode(trimmedCode);

      if (!result.success) {
        setCodeError(result.message || 'Invalid connection code. Please check and try again.');
        setConnecting(false);
        return;
      }

      // Step 2: Create the actual tenant-property link
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

      setStep('complete');
    } catch {
      setCodeError('Something went wrong. Please try again.');
    } finally {
      setConnecting(false);
    }
  }, [connectionCode, useCode, connectToTenancy, connectToProperty]);

  const handleSkipConnect = useCallback(() => {
    setStep('complete');
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabaseClient();
    await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
      .update({ onboarding_completed: true })
      .eq('id', user.id);
  }, [user]);

  const handleFinish = useCallback(async () => {
    setCompleting(true);
    try {
      await markOnboardingComplete();
      router.replace('/(app)/(tabs)' as never);
    } catch {
      Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
    } finally {
      setCompleting(false);
    }
  }, [markOnboardingComplete]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {step === 'welcome' && (
        <View style={styles.stepContainer}>
          <View style={styles.contentArea}>
            <View style={styles.logoArea}>
              <Text style={styles.logoText}>Casa</Text>
            </View>
            <Text style={styles.title}>Welcome to Casa</Text>
            <Text style={styles.subtitle}>
              Your smart rental companion. Casa helps you manage your tenancy, pay rent, submit
              maintenance requests, and communicate with your landlord — all in one place.
            </Text>
          </View>
          <View style={styles.bottomArea}>
            <StepIndicator current={0} total={3} />
            <Button title="Get Started" onPress={handleGetStarted} />
          </View>
        </View>
      )}

      {step === 'connect' && (
        <View style={styles.stepContainer}>
          <View style={styles.contentArea}>
            <View style={styles.iconWrapper}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                  stroke={THEME.colors.brand}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                  stroke={THEME.colors.brand}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.title}>Connect to Your Property</Text>
            <Text style={styles.subtitle}>
              Enter the connection code from your landlord to link your account to your rental
              property.
            </Text>
            <View style={styles.inputArea}>
              <Input
                label="Connection Code"
                placeholder="e.g. ABC123"
                value={connectionCode}
                onChangeText={(text) => {
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
          <View style={styles.bottomArea}>
            <StepIndicator current={1} total={3} />
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
              style={styles.skipButton}
            />
          </View>
        </View>
      )}

      {step === 'complete' && (
        <View style={styles.stepContainer}>
          <View style={styles.contentArea}>
            <View style={styles.checkIconWrapper}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Circle
                  cx={12}
                  cy={12}
                  r={10}
                  stroke={THEME.colors.success}
                  strokeWidth={1.5}
                />
                <Polyline
                  points="9 12 11.5 14.5 16 9.5"
                  stroke={THEME.colors.success}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>
            <Text style={styles.title}>You're All Set!</Text>
            <Text style={styles.subtitle}>
              Your account is ready. You can connect to a property at any time from the Home screen.
            </Text>
          </View>
          <View style={styles.bottomArea}>
            <StepIndicator current={2} total={3} />
            <Button
              title="Start Exploring"
              onPress={handleFinish}
              loading={completing}
            />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.lg,
  },
  contentArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomArea: {
    alignItems: 'center',
    gap: THEME.spacing.base,
    paddingBottom: THEME.spacing.base,
  },

  // Welcome step
  logoArea: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.xl,
    ...THEME.shadow.lg,
  },
  logoText: {
    fontSize: 28,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textInverse,
    letterSpacing: 1,
  },
  title: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
  },
  subtitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.regular,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },

  // Connect step
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.xl,
    ...THEME.shadow.lg,
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
  skipButton: {
    marginTop: THEME.spacing.xs,
  },

  // Complete step
  checkIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.xl,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
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
