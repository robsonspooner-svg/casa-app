import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Link, router } from 'expo-router';
import {
  Button,
  Input,
  Card,
  ScreenContainer,
  THEME,
} from '@casa/ui';
import { useAuth } from '@casa/api';

export default function LoginScreen() {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Please enter your email');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password');
      return;
    }

    try {
      await signIn(email.trim(), password);
      router.replace('/(app)/(tabs)' as any);
    } catch {
      // Error is handled by useAuth hook
    }
  };

  const displayError = localError || error;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/casa_logo.png')} style={styles.logoMark} />
          <Image source={require('../../assets/casa.png')} style={styles.logoWordmark} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage your properties</Text>
        </View>

        <Card variant="elevated" style={styles.formCard}>
          {displayError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          )}

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
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            containerStyle={styles.inputContainer}
          />

          <Link href="/(auth)/forgot-password" asChild>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </Link>

          <Button
            title="Sign In"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Link href="/(auth)/signup" asChild>
            <Text style={styles.footerLink}>Create account</Text>
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
  forgotPassword: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    textAlign: 'right',
    marginBottom: THEME.spacing.lg,
  },
  submitButton: {
    marginTop: THEME.spacing.sm,
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
});
