// My Applications Screen (Tenant) - Mission 05
import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Badge, THEME } from '@casa/ui';
import { useMyApplications, ApplicationWithDetails, ApplicationStatus } from '@casa/api';

function getStatusVariant(status: ApplicationStatus): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'approved': return 'success';
    case 'shortlisted':
    case 'under_review': return 'info';
    case 'submitted':
    case 'draft': return 'warning';
    case 'rejected':
    case 'withdrawn': return 'error';
    default: return 'info';
  }
}

function formatStatus(status: ApplicationStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ApplicationCard({ application, onPress }: { application: ApplicationWithDetails; onPress: () => void }) {
  const listing = application.listing;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {listing?.title || 'Listing'}
        </Text>
        <Badge label={formatStatus(application.status)} variant={getStatusVariant(application.status)} />
      </View>
      {listing?.property && (
        <Text style={styles.cardAddress} numberOfLines={1}>
          {(listing.property as any).address_line_1}, {(listing.property as any).suburb}
        </Text>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>
          {application.submitted_at
            ? `Submitted ${new Date(application.submitted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
            : 'Draft'
          }
        </Text>
        {listing && (
          <Text style={styles.cardRent}>${listing.rent_amount}/wk</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MyApplicationsScreen() {
  const router = useRouter();
  const { applications, loading, refreshing, refreshApplications } = useMyApplications();

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Applications</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Applications</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={applications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ApplicationCard
            application={item}
            onPress={() => router.push(`/(app)/applications/${item.id}` as Href)}
          />
        )}
        contentContainerStyle={applications.length === 0 ? styles.emptyContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>No applications yet</Text>
            <Text style={styles.emptyText}>
              Browse listings and apply for properties you're interested in.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshApplications}
            tintColor={THEME.colors.brand}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base, paddingVertical: THEME.spacing.md,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: THEME.fontSize.h2, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary },
  headerRight: { width: 44 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: THEME.spacing.base, gap: THEME.spacing.md },
  emptyContent: { flex: 1 },
  card: {
    backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base, borderWidth: 1, borderColor: THEME.colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: THEME.fontSize.body, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary, flex: 1, marginRight: THEME.spacing.sm },
  cardAddress: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textSecondary, marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: THEME.spacing.md },
  cardDate: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textTertiary },
  cardRent: { fontSize: THEME.fontSize.body, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: THEME.spacing.xl },
  emptyIconContainer: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: THEME.colors.subtle,
    alignItems: 'center', justifyContent: 'center', marginBottom: THEME.spacing.base,
  },
  emptyTitle: { fontSize: THEME.fontSize.h2, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary, marginBottom: THEME.spacing.sm },
  emptyText: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
