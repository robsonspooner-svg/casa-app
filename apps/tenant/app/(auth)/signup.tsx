import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Link } from 'expo-router';
import Svg, { Rect, Polyline } from 'react-native-svg';
import {
  Button,
  Input,
  Card,
  ScreenContainer,
  THEME,
} from '@casa/ui';
import { useAuth } from '@casa/api';

export default function SignUpScreen() {
  const { signUp, loading, error } = useAuth();
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
