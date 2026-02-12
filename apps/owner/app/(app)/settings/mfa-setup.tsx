import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { StepIndicator } from '@casa/ui';
import { useMFA } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

const MFA_STEPS = ['Setup', 'Verify', 'Recovery'];

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CopyIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 4L12 14.01l-3-3" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShieldIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function MFASetupScreen() {
  const insets = useSafeAreaInsets();
  const { setupMFA, verifyAndEnable, getRecoveryCodes, isEnabled } = useMFA();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Step 1: Setup - Generate TOTP secret
  const handleSetup = useCallback(async () => {
    setLoading(true);
    try {
      const result = await setupMFA();
      if (result) {
        setSecret(result.secret);
        setQrUri(result.qrUri);
      } else {
        Alert.alert('Error', 'Failed to generate MFA secret. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to set up MFA.');
    } finally {
      setLoading(false);
    }
  }, [setupMFA]);

  const handleCopySecret = useCallback(async () => {
    if (!secret) return;
    try {
      await Share.share({ message: secret });
    } catch {
      Alert.alert('Secret Key', secret);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [secret]);

  // Step 2: Verify the 6-digit code
  const handleVerify = useCallback(async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const success = await verifyAndEnable(verificationCode);
      if (success) {
        // Fetch recovery codes after successful verification
        const codes = await getRecoveryCodes();
        setRecoveryCodes(codes);
        setCurrentStep(2);
      } else {
        Alert.alert('Invalid Code', 'The verification code was incorrect. Please check your authenticator app and try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to verify code.');
    } finally {
      setLoading(false);
    }
  }, [verificationCode, verifyAndEnable, getRecoveryCodes]);

  // Step 3: Copy recovery codes
  const handleCopyRecoveryCodes = useCallback(async () => {
    const codesText = recoveryCodes.join('\n');
    try {
      await Share.share({
        message: `Casa MFA Recovery Codes:\n\n${codesText}\n\nStore these codes in a safe place.`,
        title: 'Casa Recovery Codes',
      });
    } catch {
      Alert.alert('Recovery Codes', codesText);
    }
  }, [recoveryCodes]);

  const handleFinish = useCallback(() => {
    router.back();
  }, []);

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <ShieldIcon />
      </View>
      <Text style={styles.stepTitle}>Set Up Authenticator</Text>
      <Text style={styles.stepDescription}>
        Add an extra layer of security to your account by enabling two-factor authentication with an authenticator app.
      </Text>

      {!secret ? (
        <Pressable
          style={styles.primaryButton}
          onPress={handleSetup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Generate Secret Key</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.secretSection}>
          <Text style={styles.instructionText}>
            Open your authenticator app (Google Authenticator, Authy, etc.) and add a new account using the secret key below:
          </Text>

          <View style={styles.secretBox}>
            <Text style={styles.secretLabel}>Secret Key</Text>
            <View style={styles.secretRow}>
              <Text style={styles.secretValue} selectable>
                {secret}
              </Text>
              <Pressable onPress={handleCopySecret} style={styles.copyButton} hitSlop={8}>
                <CopyIcon />
                <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
          </View>

          {qrUri && (
            <View style={styles.qrUriBox}>
              <Text style={styles.secretLabel}>Provisioning URI</Text>
              <Text style={styles.qrUriText} selectable numberOfLines={3}>
                {qrUri}
              </Text>
              <Text style={styles.qrUriHint}>
                Some apps allow pasting the full URI instead of the secret key.
              </Text>
            </View>
          )}

          <Pressable
            style={styles.primaryButton}
            onPress={() => setCurrentStep(1)}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Verify Code</Text>
      <Text style={styles.stepDescription}>
        Enter the 6-digit code from your authenticator app to verify the setup.
      </Text>

      <View style={styles.codeInputContainer}>
        <TextInput
          style={styles.codeInput}
          value={verificationCode}
          onChangeText={(text) => setVerificationCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="000000"
          placeholderTextColor={THEME.colors.textTertiary}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textAlign="center"
        />
        <Text style={styles.codeHint}>
          Enter the code shown in your authenticator app
        </Text>
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          verificationCode.length !== 6 && styles.primaryButtonDisabled,
        ]}
        onPress={handleVerify}
        disabled={loading || verificationCode.length !== 6}
      >
        {loading ? (
          <ActivityIndicator size="small" color={THEME.colors.textInverse} />
        ) : (
          <Text style={styles.primaryButtonText}>Verify & Enable</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          setVerificationCode('');
          setCurrentStep(0);
        }}
      >
        <Text style={styles.secondaryButtonText}>Back to Setup</Text>
      </Pressable>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <CheckCircleIcon />
      </View>
      <Text style={styles.stepTitle}>MFA Enabled</Text>
      <Text style={styles.stepDescription}>
        Two-factor authentication is now active on your account. Save your recovery codes below -- you will need them if you lose access to your authenticator app.
      </Text>

      <View style={styles.recoverySection}>
        <Text style={styles.recoveryTitle}>Recovery Codes</Text>
        <Text style={styles.recoveryWarning}>
          Store these codes in a safe place. Each code can only be used once.
        </Text>

        <View style={styles.codesGrid}>
          {recoveryCodes.length > 0 ? (
            recoveryCodes.map((code, index) => (
              <View key={index} style={styles.codeItem}>
                <Text style={styles.codeItemText}>{code}</Text>
              </View>
            ))
          ) : (
            <View style={styles.noCodesRow}>
              <Text style={styles.noCodesText}>
                No recovery codes available. Contact support if you need assistance.
              </Text>
            </View>
          )}
        </View>

        {recoveryCodes.length > 0 && (
          <Pressable
            style={styles.copyAllButton}
            onPress={handleCopyRecoveryCodes}
          >
            <CopyIcon />
            <Text style={styles.copyAllButtonText}>Copy All Codes</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={handleFinish}
      >
        <Text style={styles.primaryButtonText}>Done</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>MFA Setup</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step Indicator */}
      <StepIndicator
        steps={MFA_STEPS}
        currentStep={currentStep}
        style={styles.stepIndicator}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  stepIndicator: {
    backgroundColor: THEME.colors.surface,
    paddingBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stepContent: {
    gap: THEME.spacing.base,
  },
  iconContainer: {
    alignItems: 'center',
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.sm,
  },
  stepTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: THEME.spacing.base,
  },
  instructionText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.sm,
  },
  // Secret key section
  secretSection: {
    gap: THEME.spacing.base,
  },
  secretBox: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  secretLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secretValue: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.subtle,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  qrUriBox: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  qrUriText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  qrUriHint: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.sm,
    fontStyle: 'italic',
  },
  // Code input
  codeInputContainer: {
    alignItems: 'center',
    gap: THEME.spacing.sm,
    paddingVertical: THEME.spacing.lg,
  },
  codeInput: {
    width: 200,
    height: 56,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: 8,
    textAlign: 'center',
  },
  codeHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  // Recovery codes
  recoverySection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: THEME.spacing.md,
  },
  recoveryTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  recoveryWarning: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.warning,
    lineHeight: 18,
  },
  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  codeItem: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: '45%',
    alignItems: 'center',
  },
  codeItemText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  noCodesRow: {
    paddingVertical: THEME.spacing.md,
  },
  noCodesText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
  },
  copyAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingVertical: 10,
    borderRadius: THEME.radius.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
  },
  copyAllButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  // Buttons
  primaryButton: {
    height: 48,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: THEME.spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  secondaryButton: {
    height: 44,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
});
