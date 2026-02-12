import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useSupportTickets } from '@casa/api';
import type { TicketCategory } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Category Options ────────────────────────────────────────────────────────

interface CategoryOption {
  id: TicketCategory;
  label: string;
  description: string;
  icon: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'billing',
    label: 'Billing',
    description: 'Subscription, payments, invoices',
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'App issues, bugs, errors',
    icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  },
  {
    id: 'property',
    label: 'Property',
    description: 'Property management questions',
    icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  },
  {
    id: 'general',
    label: 'General',
    description: 'Other questions and feedback',
    icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  },
  {
    id: 'urgent',
    label: 'Urgent',
    description: 'Time-sensitive issues needing immediate help',
    icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewTicketScreen() {
  const insets = useSafeAreaInsets();
  const { createTicket } = useSupportTickets();

  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = selectedCategory && subject.trim().length >= 3 && message.trim().length >= 10;

  const handleSubmit = useCallback(async () => {
    if (!isValid || !selectedCategory) return;

    setSubmitting(true);
    try {
      const ticket = await createTicket(selectedCategory, subject.trim(), message.trim());
      if (ticket) {
        Alert.alert(
          'Ticket Created',
          'Your support ticket has been submitted. We will respond as soon as possible.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [isValid, selectedCategory, subject, message, createTicket]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>New Ticket</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category Selection */}
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.categoriesGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryCard,
                  isSelected && styles.categoryCardSelected,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <View style={[styles.categoryIcon, isSelected && styles.categoryIconSelected]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d={cat.icon}
                      stroke={isSelected ? THEME.colors.brand : THEME.colors.textSecondary}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                  {cat.label}
                </Text>
                <Text style={styles.categoryDescription}>{cat.description}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Subject */}
        <Text style={styles.sectionTitle}>Subject</Text>
        <TextInput
          style={styles.subjectInput}
          value={subject}
          onChangeText={setSubject}
          placeholder="Brief summary of your issue"
          placeholderTextColor={THEME.colors.textTertiary}
          maxLength={100}
          returnKeyType="next"
        />
        <Text style={styles.charCount}>{subject.length}/100</Text>

        {/* Message */}
        <Text style={styles.sectionTitle}>Message</Text>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Describe your issue in detail. Include any relevant property addresses, dates, or error messages."
          placeholderTextColor={THEME.colors.textTertiary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={2000}
        />
        <Text style={styles.charCount}>{message.length}/2000</Text>

        {/* Submit */}
        <Pressable
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Ticket</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Section
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },

  // Categories
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 14,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    flexGrow: 1,
    flexBasis: '46%',
  },
  categoryCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.brand + '08',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryIconSelected: {
    backgroundColor: THEME.colors.brand + '14',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  categoryLabelSelected: {
    color: THEME.colors.brand,
  },
  categoryDescription: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },

  // Subject input
  subjectInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  charCount: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    textAlign: 'right',
    marginTop: 4,
  },

  // Message input
  messageInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minHeight: 140,
    lineHeight: 22,
  },

  // Submit button
  submitButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },
});
