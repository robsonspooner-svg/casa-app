import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { TouchableOpacity } from 'react-native';
import { THEME } from '@casa/config';
import { Card, Button } from '@casa/ui';
import { useProfile, useAuth, getSupabaseClient } from '@casa/api';

function getTrialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatTrialEndDate(trialEndsAt: string | null): string {
  if (!trialEndsAt) return 'N/A';
  return new Date(trialEndsAt).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AddPaymentMethodScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const trialEndsAt = profile?.trial_ends_at ?? null;
  const daysRemaining = getTrialDaysRemaining(trialEndsAt);

  const handleAddCard = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be signed in to add a payment method.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No active session found. Please sign in again.');
      }

      const response = await fetch(
        'https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/stripe-setup-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            successUrl: 'casa-owner://subscription?setup=success',
            cancelUrl: 'casa-owner://subscription?setup=cancel',
            paymentMethodTypes: ['card'],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.sessionUrl) {
        throw new Error('No session URL returned from server.');
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.sessionUrl,
        'casa-owner://subscription'
      );

      if (result.type === 'success') {
        setSuccess(true);
        setTimeout(() => {
          router.back();
        }, 2000);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to set up payment method. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M12 19l-7-7 7-7"
                stroke={THEME.colors.textPrimary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Payment Method</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20 6L9 17l-5-5"
                stroke={THEME.colors.success}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.successTitle}>Card Added Successfully</Text>
          <Text style={styles.successText}>
            Your payment method has been saved. Redirecting...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke={THEME.colors.textPrimary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Payment Method</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Card variant="elevated" style={styles.trialCard}>
          <Text style={styles.trialLabel}>Trial Status</Text>
          <View style={styles.trialRow}>
            <Text style={styles.trialDays}>{daysRemaining}</Text>
            <Text style={styles.trialDaysLabel}>days remaining</Text>
          </View>
          <View style={styles.trialEndRow}>
            <Text style={styles.trialEndLabel}>Trial ends</Text>
            <Text style={styles.trialEndDate}>{formatTrialEndDate(trialEndsAt)}</Text>
          </View>
        </Card>

        <Button
          title={loading ? 'Setting up...' : 'Add Card'}
          onPress={handleAddCard}
          disabled={loading}
          loading={loading}
          style={styles.addCardButton}
        />

        {loading && (
          <ActivityIndicator
            size="small"
            color={THEME.colors.brand}
            style={styles.loader}
          />
        )}

        <Card style={styles.noteCard}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.noteIcon}>
            <Path
              d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01"
              stroke={THEME.colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.noteText}>
            Your card will not be charged during the trial period. After your trial ends, your subscription will be billed automatically using this payment method.
          </Text>
        </Card>
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
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing['2xl'],
  },
  trialCard: {
    marginBottom: THEME.spacing.lg,
  },
  trialLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.md,
  },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  trialDays: {
    fontSize: THEME.fontSize.display,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.brand,
  },
  trialDaysLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  trialEndRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  trialEndLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  trialEndDate: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  addCardButton: {
    marginBottom: THEME.spacing.base,
  },
  loader: {
    marginTop: -THEME.spacing.md,
    marginBottom: THEME.spacing.base,
  },
  noteCard: {
    backgroundColor: THEME.colors.subtle,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: THEME.spacing.md,
  },
  noteIcon: {
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.lg,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  successTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  successText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
});
