import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import { useSupportTickets } from '@casa/api';
import Svg, { Path } from 'react-native-svg';

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function HeadphonesIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path d="M3 18v-6a9 9 0 0118 0v6" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRight() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: '#EFF6FF', text: '#2563EB', label: 'Open' },
  in_progress: { bg: '#FEFCE8', text: '#CA8A04', label: 'In Progress' },
  waiting_on_user: { bg: '#FFF7ED', text: '#EA580C', label: 'Awaiting Reply' },
  resolved: { bg: '#F0FDF4', text: '#16A34A', label: 'Resolved' },
  closed: { bg: '#F5F5F5', text: '#525252', label: 'Closed' },
};

const SUPPORT_TIER_CONFIG: Record<string, { label: string; description: string; color: string; bg: string }> = {
  standard: {
    label: 'Standard Support',
    description: 'Response within 24 hours',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  priority: {
    label: 'Priority Support',
    description: 'Response within 4 hours',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  dedicated: {
    label: 'Dedicated Support',
    description: 'Response within 1 hour',
    color: '#059669',
    bg: '#ECFDF5',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  billing: 'Billing',
  technical: 'Technical',
  property: 'Property',
  general: 'General',
  urgent: 'Urgent',
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatResponseTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
  return `${Math.round(minutes / 1440)} day${minutes >= 2880 ? 's' : ''}`;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const {
    tickets,
    loading,
    supportTier,
    responseTimeMinutes,
  } = useSupportTickets();

  const tierConfig = SUPPORT_TIER_CONFIG[supportTier];

  const openTickets = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed');
  const closedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={THEME.colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Support</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Support Tier Banner */}
        <View style={[styles.tierBanner, { backgroundColor: tierConfig.bg }]}>
          <HeadphonesIcon />
          <Text style={[styles.tierLabel, { color: tierConfig.color }]}>{tierConfig.label}</Text>
          <View style={styles.responseTimeRow}>
            <ClockIcon />
            <Text style={styles.responseTimeText}>
              Target response: {formatResponseTime(responseTimeMinutes)}
            </Text>
          </View>
          <Text style={styles.tierDescription}>{tierConfig.description}</Text>
        </View>

        {/* New Ticket Button */}
        <Pressable
          style={styles.newTicketButton}
          onPress={() => router.push('/(app)/support/new-ticket' as any)}
        >
          <PlusIcon />
          <Text style={styles.newTicketButtonText}>New Ticket</Text>
        </Pressable>

        {/* Open Tickets */}
        <Text style={styles.sectionTitle}>
          Open Tickets ({openTickets.length})
        </Text>
        <View style={styles.card}>
          {openTickets.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No open tickets</Text>
            </View>
          ) : (
            openTickets.map((ticket, index) => (
              <Pressable
                key={ticket.id}
                style={[
                  styles.ticketRow,
                  index < openTickets.length - 1 && styles.borderBottom,
                ]}
                onPress={() => {
                  // Navigate to ticket detail in future
                }}
              >
                <View style={styles.ticketContent}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <StatusBadge status={ticket.status} />
                  </View>
                  <View style={styles.ticketMeta}>
                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>
                        {CATEGORY_LABELS[ticket.category] || ticket.category}
                      </Text>
                    </View>
                    <Text style={styles.ticketTime}>
                      {formatRelativeTime(ticket.created_at)}
                    </Text>
                  </View>
                </View>
                <ChevronRight />
              </Pressable>
            ))
          )}
        </View>

        {/* Resolved Tickets */}
        {closedTickets.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Resolved ({closedTickets.length})
            </Text>
            <View style={styles.card}>
              {closedTickets.map((ticket, index) => (
                <View
                  key={ticket.id}
                  style={[
                    styles.ticketRow,
                    index < closedTickets.length - 1 && styles.borderBottom,
                  ]}
                >
                  <View style={styles.ticketContent}>
                    <View style={styles.ticketHeader}>
                      <Text style={[styles.ticketSubject, { color: THEME.colors.textSecondary }]} numberOfLines={1}>
                        {ticket.subject}
                      </Text>
                      <StatusBadge status={ticket.status} />
                    </View>
                    <View style={styles.ticketMeta}>
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryTagText}>
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </Text>
                      </View>
                      <Text style={styles.ticketTime}>
                        {formatRelativeTime(ticket.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Tier banner
  tierBanner: {
    borderRadius: THEME.radius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  tierLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  responseTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  responseTimeText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  tierDescription: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },

  // New ticket button
  newTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    marginBottom: 24,
  },
  newTicketButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },

  // Section
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Card
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    marginBottom: 24,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
  },

  // Ticket row
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ticketContent: {
    flex: 1,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.colors.subtle,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  ticketTime: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },

  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
