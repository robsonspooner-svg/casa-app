// Write Review Screen
// Mission 10: Tradesperson Network
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, StarRating } from '@casa/ui';
import { useWorkOrder, useTradeMutations } from '@casa/api';

export default function WriteReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workOrder } = useWorkOrder(id || null);
  const { submitReview } = useTradeMutations();

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = rating > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !workOrder) {
      Alert.alert('Missing Rating', 'Please select a star rating.');
      return;
    }

    setSubmitting(true);
    try {
      await submitReview({
        trade_id: workOrder.trade_id,
        work_order_id: workOrder.id,
        rating,
        title: title.trim() || null,
        content: content.trim() || null,
        would_recommend: wouldRecommend,
      });

      Alert.alert('Review Submitted', 'Thank you for your feedback.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const tradeName = workOrder?.trade?.business_name || 'Tradesperson';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Write Review</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Trade Name */}
          <View style={styles.tradeNameCard}>
            <Text style={styles.tradeLabel}>Reviewing</Text>
            <Text style={styles.tradeName}>{tradeName}</Text>
            {workOrder?.title && (
              <Text style={styles.workOrderTitle}>Work: {workOrder.title}</Text>
            )}
          </View>

          {/* Star Rating */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rating *</Text>
            <View style={styles.ratingContainer}>
              <StarRating
                rating={rating}
                interactive
                onRatingChange={setRating}
                size={36}
              />
              {rating > 0 && (
                <Text style={styles.ratingLabel}>
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Very Good'}
                  {rating === 5 && 'Excellent'}
                </Text>
              )}
            </View>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Review Title</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Summarise your experience..."
              placeholderTextColor={THEME.colors.textTertiary}
            />
          </View>

          {/* Content */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Details</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={content}
              onChangeText={setContent}
              placeholder="Share details about the quality of work, communication, timeliness..."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Would Recommend */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Would you recommend this trade?</Text>
            <View style={styles.recommendRow}>
              <TouchableOpacity
                style={[
                  styles.recommendButton,
                  wouldRecommend === true && styles.recommendButtonActive,
                ]}
                onPress={() => setWouldRecommend(wouldRecommend === true ? null : true)}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
                    stroke={wouldRecommend === true ? '#FFFFFF' : THEME.colors.success}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[
                  styles.recommendText,
                  wouldRecommend === true && styles.recommendTextActive,
                ]}>
                  Yes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.recommendButton,
                  wouldRecommend === false && styles.recommendButtonNo,
                ]}
                onPress={() => setWouldRecommend(wouldRecommend === false ? null : false)}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M10 15V19a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"
                    stroke={wouldRecommend === false ? '#FFFFFF' : THEME.colors.error}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[
                  styles.recommendText,
                  wouldRecommend === false && styles.recommendTextActive,
                ]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <View style={styles.submitContainer}>
            <Button
              title="Submit Review"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  tradeNameCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  tradeLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.xs,
  },
  tradeName: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  workOrderTitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  section: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  ratingContainer: {
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  ratingLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
  },
  fieldLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  textInput: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  multilineInput: {
    minHeight: 120,
  },
  recommendRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  recommendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.canvas,
  },
  recommendButtonActive: {
    backgroundColor: THEME.colors.success,
    borderColor: THEME.colors.success,
  },
  recommendButtonNo: {
    backgroundColor: THEME.colors.error,
    borderColor: THEME.colors.error,
  },
  recommendText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  recommendTextActive: {
    color: '#FFFFFF',
  },
  submitContainer: {
    marginTop: THEME.spacing.md,
  },
});
