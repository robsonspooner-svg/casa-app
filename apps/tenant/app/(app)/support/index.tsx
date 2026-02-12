import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import Svg, { Path } from 'react-native-svg';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How do I pay rent?',
    answer:
      'Navigate to the Payments tab from the bottom navigation bar. You can view your upcoming rent payments, payment history, and set up automatic payments. If your landlord has enabled online payments, you can pay directly through the app.',
  },
  {
    question: 'How do I submit a maintenance request?',
    answer:
      'Go to the Home tab and tap on your active tenancy. From there, select "Maintenance" to submit a new request. Describe the issue, add photos if needed, and your landlord will be notified immediately. You can track the status of your request in the same section.',
  },
  {
    question: 'How do I connect to my property?',
    answer:
      'Your landlord will provide you with a connection code. Tap the "Connect" option from the Home tab and enter the code. Once connected, you will have access to your tenancy details, lease documents, and communication with your landlord.',
  },
  {
    question: 'What is Casa?',
    answer:
      'Casa is an AI-powered property management platform that simplifies the rental experience for both tenants and landlords. It provides tools for rent payments, maintenance requests, inspections, document management, and direct communication with your property manager or landlord.',
  },
  {
    question: 'How do I contact my landlord?',
    answer:
      'Use the Chat tab in the bottom navigation bar to send messages to your landlord or property manager. You can also use the AI assistant in the chat to get quick answers about your tenancy, lease terms, or property-related questions.',
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          style={expanded ? styles.chevronExpanded : undefined}
        >
          <Path
            d="M6 9l6 6 6-6"
            stroke={THEME.colors.textTertiary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      {expanded && <Text style={styles.faqAnswer}>{item.answer}</Text>}
    </TouchableOpacity>
  );
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke={THEME.colors.textPrimary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
        <View style={styles.card}>
          {FAQ_ITEMS.map((item, index) => (
            <FAQAccordion key={index} item={item} />
          ))}
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Need More Help?</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => router.push('/(app)/(tabs)/chat' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.contactIconBox}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                  stroke={THEME.colors.brand}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Chat with your AI property assistant</Text>
              <Text style={styles.contactSubtitle}>
                Get instant answers about your tenancy
              </Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18l6-6-6-6"
                stroke={THEME.colors.textTertiary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        </View>
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
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  faqItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  faqAnswer: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginTop: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  contactIconBox: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.brand + '15',
    marginRight: 12,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  contactSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
});
