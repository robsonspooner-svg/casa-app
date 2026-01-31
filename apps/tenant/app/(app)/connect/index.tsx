// Connect to Property Screen - Tenant App
// Allows tenants to enter connection codes to link to properties/tenancies

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Stack, router } from 'expo-router';
import { THEME } from '@casa/config';
import { useConnection } from '@casa/api';

export default function ConnectScreen() {
  const { useCode, connectToTenancy, connectToProperty, connecting, error, lastResult } = useConnection();
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm' | 'success'>('enter');

  const handleValidateCode = async () => {
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-character connection code');
      return;
    }

    const result = await useCode(code);

    if (result.success) {
      setStep('confirm');
    } else {
      Alert.alert('Invalid Code', result.message);
    }
  };

  const handleConfirmConnection = async () => {
    let success = false;

    if (lastResult?.tenancyId) {
      // Connect to existing tenancy
      success = await connectToTenancy(lastResult.tenancyId, code);
    } else if (lastResult?.propertyId && lastResult?.ownerId) {
      // Create new tenancy and connect to property
      success = await connectToProperty(lastResult.propertyId, lastResult.ownerId, code);
    } else {
      Alert.alert('Error', 'Invalid connection code - no property or tenancy found');
      return;
    }

    if (success) {
      setStep('success');
    } else {
      Alert.alert('Connection Failed', error || 'Unable to connect to this property');
    }
  };

  const handleDone = () => {
    router.replace('/(app)/(tabs)');
  };

  const formatCode = (inputText: string) => {
    // Only allow alphanumeric, uppercase, max 6 chars
    return inputText.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Connect to Property',
          headerStyle: { backgroundColor: THEME.colors.surface },
          headerTintColor: THEME.colors.textPrimary,
        }}
      />

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {step === 'enter' && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Enter Connection Code</Text>
              <Text style={styles.subtitle}>
                Your landlord or property manager will provide you with a 6-character code to connect to your rental property.
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(inputText) => setCode(formatCode(inputText))}
                placeholder="ABC123"
                placeholderTextColor={THEME.colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                keyboardType="default"
              />
              <Text style={styles.codeHint}>
                {code.length}/6 characters
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.validateButton,
                code.length !== 6 && styles.buttonDisabled,
              ]}
              onPress={handleValidateCode}
              disabled={code.length !== 6 || connecting}
            >
              {connecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Validate Code</Text>
              )}
            </TouchableOpacity>

            <View style={styles.helpSection}>
              <Text style={styles.helpTitle}>Don't have a code?</Text>
              <Text style={styles.helpText}>
                Ask your landlord to generate a connection code from their Casa app. Alternatively, you can apply to properties through our listings.
              </Text>
              <View style={styles.helpActions}>
                <TouchableOpacity
                  style={styles.requestCodeButton}
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `Hi! I'd like to connect to your property using the Casa app. Could you please generate a connection code for me? You can do this by:\n\n1. Open the Casa (Owner) app\n2. Go to "Invite" or "Connection Codes"\n3. Create a new code\n4. Share the 6-character code with me\n\nThanks!`,
                        title: 'Request Connection Code',
                      });
                    } catch (err) {
                      // User cancelled
                    }
                  }}
                >
                  <Text style={styles.requestCodeButtonText}>Request Code from Landlord</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => router.push('/(app)/search' as any)}
                >
                  <Text style={styles.linkButtonText}>Browse Listings</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {step === 'confirm' && lastResult && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Confirm Connection</Text>
              <Text style={styles.subtitle}>
                You're about to connect to the following:
              </Text>
            </View>

            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Connection Type</Text>
              <Text style={styles.confirmValue}>
                {lastResult.connectionType === 'tenancy' ? 'Tenancy (Rent Payments)' :
                 lastResult.connectionType === 'property' ? 'Property' :
                 'Application'}
              </Text>

              <View style={styles.codeDisplay}>
                <Text style={styles.codeDisplayLabel}>Code</Text>
                <Text style={styles.codeDisplayValue}>{code}</Text>
              </View>
            </View>

            <Text style={styles.confirmNote}>
              By connecting, you'll be linked to this property and can view rent schedules, make payments, and communicate with your landlord.
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setStep('enter');
                  setCode('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={handleConfirmConnection}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 'success' && (
          <>
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                  <Path d="M20 6L9 17l-5-5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.successTitle}>Connected!</Text>
              <Text style={styles.successText}>
                You're now connected to your rental property. You can view your rent schedule and make payments from the Rent tab.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.validateButton}
              onPress={handleDone}
            >
              <Text style={styles.buttonText}>Go to Home</Text>
            </TouchableOpacity>
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  codeInput: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    padding: 20,
    fontSize: 32,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 8,
  },
  codeHint: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  button: {
    backgroundColor: THEME.colors.brand,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  validateButton: {
    backgroundColor: THEME.colors.brand,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    backgroundColor: THEME.colors.textTertiary,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    marginTop: 48,
    padding: 20,
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  helpActions: {
    gap: 12,
  },
  requestCodeButton: {
    backgroundColor: THEME.colors.brand,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  requestCodeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  confirmCard: {
    backgroundColor: THEME.colors.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  confirmLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  confirmValue: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 16,
  },
  codeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  codeDisplayLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  codeDisplayValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.brand,
    letterSpacing: 2,
  },
  confirmNote: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  secondaryButtonText: {
    color: THEME.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 40,
    color: '#fff',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 24,
  },
});
