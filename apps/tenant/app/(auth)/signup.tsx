import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Image, TouchableOpacity, Linking } from 'react-native';
import { Link } from 'expo-router';
import Svg, { Path, Rect, Polyline } from 'react-native-svg';
import {
  Button,
  Input,
  Card,
  ScreenContainer,
  THEME,
} from '@casa/ui';
import { useAuth } from '@casa/api';

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

export default function SignUpScreen() {
  const { signUp, signInWithOAuth, loading, error } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSignUp = async () => {
    setLocalError(null);

    if (!fullName.trim()) {
      setLocalError('Please enter your full name');
      return;
    }

    if (!email.trim()) {
      setLocalError('Please enter your email');
      return;
    }

    if (!validateEmail(email.trim())) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setLocalError('Please enter a password');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await signUp(email.trim(), password, fullName.trim(), 'tenant');
      setSuccess(true);
    } catch {
      // Error is handled by useAuth hook
    }
  };

  const handleGoogleSignUp = async () => {
    setLocalError(null);

    try {
      const url = await signInWithOAuth('google', {
        redirectTo: 'casa-tenant://auth/callback',
      });
      if (url) {
        await Linking.openURL(url);
      }
    } catch {
      // Error is handled by useAuth hook
    }
  };

  const displayError = localError || error;

  if (success) {
    return (
      <ScreenContainer>
        <View style={styles.successContainer}>
          <Image source={require('../../assets/casa_logo.png')} style={styles.logoMark} />
          <Image source={require('../../assets/casa.png')} style={styles.logoWordmark} />
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" style={styles.successIcon}>
            <Rect x="2" y="4" width="20" height="16" rx="2" stroke={THEME.colors.brand} strokeWidth={1.5} />
            <Polyline points="22,4 12,13 2,4" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successText}>
            We've sent a confirmation link to {email}. Please click the link to verify your account.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Button
              title="Back to Sign In"
              variant="secondary"
              style={styles.backButton}
            />
          </Link>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/casa_logo.png')} style={styles.logoMark} />
          <Image source={require('../../assets/casa.png')} style={styles.logoWordmark} />
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join Casa to manage your rental</Text>
        </View>

        <Card variant="elevated" style={styles.formCard}>
          {displayError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          )}

          <Input
            label="Full name"
            placeholder="John Smith"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            containerStyle={styles.inputContainer}
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            containerStyle={styles.inputContainer}
          />

          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            containerStyle={styles.inputContainer}
          />

          <Input
            label="Confirm password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            containerStyle={styles.inputContainer}
          />

          <Button
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignUp}
            disabled={loading}
            activeOpacity={0.7}
          >
            <GoogleIcon size={20} />
            <Text style={styles.googleButtonText}>Sign up with Google</Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <Text style={styles.footerLink}>Sign in</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
  },
  logoMark: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
    marginBottom: THEME.spacing.md,
  },
  logoWordmark: {
    width: 120,
    height: 34,
    resizeMode: 'contain',
  },
  title: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.lg,
  },
  subtitle: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  formCard: {
    marginBottom: THEME.spacing.lg,
  },
  errorContainer: {
    backgroundColor: THEME.colors.errorBg,
    padding: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    marginBottom: THEME.spacing.base,
  },
  errorText: {
    color: THEME.colors.error,
    fontSize: THEME.fontSize.bodySmall,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: THEME.spacing.base,
  },
  submitButton: {
    marginTop: THEME.spacing.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: THEME.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  dividerText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    fontWeight: THEME.fontWeight.medium,
    marginHorizontal: THEME.spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: THEME.components.button.height,
    borderRadius: THEME.components.button.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    gap: THEME.spacing.sm,
  },
  googleButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: THEME.spacing.xs,
  },
  footerText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  footerLink: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  // Success state
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  successIcon: {
    fontSize: 64,
    marginTop: THEME.spacing.xl,
    marginBottom: THEME.spacing.lg,
  },
  successTitle: {
    fontSize: THEME.fontSize.h1,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  successText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
  },
  backButton: {
    width: '100%',
  },
});
