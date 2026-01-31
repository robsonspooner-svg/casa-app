// Application Detail Screen (Tenant) - Mission 05
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Badge, Button, StatusTimeline, THEME } from '@casa/ui';
import { useApplication, useApplicationMutations, ApplicationStatus } from '@casa/api';
import type { TimelineEvent } from '@casa/ui';

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

function buildTimeline(application: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const statuses: ApplicationStatus[] = ['draft', 'submitted', 'under_review', 'shortlisted', 'approved'];

  const statusIndex = statuses.indexOf(application.status);

  events.push({
    label: 'Application Created',
    date: new Date(application.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
    status: 'completed',
  });

  if (application.submitted_at) {
    events.push({
      label: 'Submitted',
      date: new Date(application.submitted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: statusIndex > 1 ? 'completed' : statusIndex === 1 ? 'current' : 'pending',
    });
  }

  if (application.status === 'under_review' || statusIndex > 2) {
    events.push({
      label: 'Under Review',
      date: application.reviewed_at ? new Date(application.reviewed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      status: statusIndex > 2 ? 'completed' : 'current',
    });
  }

  if (application.status === 'shortlisted' || statusIndex > 3) {
    events.push({
      label: 'Shortlisted',
      date: '',
      status: statusIndex > 3 ? 'completed' : 'current',
    });
  }

  if (application.status === 'approved') {
    events.push({
      label: 'Approved',
      date: application.reviewed_at ? new Date(application.reviewed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      status: 'current',
    });
  }

  if (application.status === 'rejected') {
    events.push({
      label: 'Rejected',
      date: application.reviewed_at ? new Date(application.reviewed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      status: 'current',
    });
  }

  if (application.status === 'withdrawn') {
    events.push({
      label: 'Withdrawn',
      date: '',
      status: 'current',
    });
  }

  return events;
}

export default function ApplicationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { application, loading, error, refetch } = useApplication(id || null);
  const { withdrawApplication, saving } = useApplicationMutations();

  const handleWithdraw = () => {
    Alert.alert(
      'Withdraw Application',
      'Are you sure you want to withdraw this application? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            if (!application) return;
            await withdrawApplication(application.id);
            refetch();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Application</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  if (error || !application) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Application</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Application not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </View>
    );
  }

  const timeline = buildTimeline(application);
  const canWithdraw = ['draft', 'submitted', 'under_review'].includes(application.status);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Application</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Listing Info */}
        {application.listing && (
          <View style={styles.card}>
            <Text style={styles.listingTitle}>{application.listing.title}</Text>
            {application.listing.property && (
              <Text style={styles.listingAddress}>
                {(application.listing.property as any).address_line_1}, {(application.listing.property as any).suburb}
              </Text>
            )}
            <Text style={styles.listingRent}>${application.listing.rent_amount}/wk</Text>
          </View>
        )}

        {/* Status */}
        <View style={styles.card}>
          <View style={styles.statusHeader}>
            <Text style={styles.sectionTitle}>Status</Text>
            <Badge label={formatStatus(application.status)} variant={getStatusVariant(application.status)} />
          </View>
          <StatusTimeline events={timeline} />
          {application.rejection_reason && (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionLabel}>Reason:</Text>
              <Text style={styles.rejectionText}>{application.rejection_reason}</Text>
            </View>
          )}
        </View>

        {/* Personal Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue}>{application.full_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{application.email}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{application.phone}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Move-in Date</Text>
            <Text style={styles.detailValue}>
              {new Date(application.move_in_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Employment */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Employment</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{application.employment_type.replace(/_/g, ' ')}</Text>
          </View>
          {application.employer_name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Employer</Text>
              <Text style={styles.detailValue}>{application.employer_name}</Text>
            </View>
          )}
          {application.annual_income && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Annual Income</Text>
              <Text style={styles.detailValue}>${application.annual_income.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* References */}
        {application.references.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>References ({application.references.length})</Text>
            {application.references.map((ref) => (
              <View key={ref.id} style={styles.referenceItem}>
                <Text style={styles.referenceName}>{ref.name}</Text>
                <Text style={styles.referenceDetail}>{ref.relationship} - {ref.reference_type}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Documents */}
        {application.documents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Documents ({application.documents.length})</Text>
            {application.documents.map((doc) => (
              <View key={doc.id} style={styles.documentItem}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName} numberOfLines={1}>{doc.file_name}</Text>
                  <Text style={styles.documentType}>{doc.document_type.replace(/_/g, ' ')}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {canWithdraw && (
          <View style={styles.actionsContainer}>
            <Button
              title="Withdraw Application"
              variant="secondary"
              onPress={handleWithdraw}
              disabled={saving}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base, paddingVertical: THEME.spacing.md,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: THEME.fontSize.h2, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary },
  headerRight: { width: 44 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: THEME.spacing.xl, gap: THEME.spacing.lg },
  errorText: { fontSize: THEME.fontSize.body, color: THEME.colors.error, textAlign: 'center' },
  content: { paddingBottom: THEME.spacing.xl * 2 },
  card: {
    backgroundColor: THEME.colors.surface, marginHorizontal: THEME.spacing.base,
    borderRadius: THEME.radius.lg, padding: THEME.spacing.base, marginBottom: THEME.spacing.md,
    borderWidth: 1, borderColor: THEME.colors.border,
  },
  listingTitle: { fontSize: THEME.fontSize.h3, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary },
  listingAddress: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textSecondary, marginTop: 2 },
  listingRent: { fontSize: THEME.fontSize.body, fontWeight: THEME.fontWeight.bold, color: THEME.colors.brand, marginTop: THEME.spacing.sm },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.spacing.md },
  sectionTitle: { fontSize: THEME.fontSize.h3, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary, marginBottom: THEME.spacing.md },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.border,
  },
  detailLabel: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary },
  detailValue: { fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary, fontWeight: THEME.fontWeight.medium },
  rejectionBox: { backgroundColor: THEME.colors.subtle, borderRadius: THEME.radius.md, padding: THEME.spacing.base, marginTop: THEME.spacing.md },
  rejectionLabel: { fontSize: THEME.fontSize.bodySmall, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.error },
  rejectionText: { fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary, marginTop: 4 },
  referenceItem: { paddingVertical: THEME.spacing.sm, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  referenceName: { fontSize: THEME.fontSize.body, fontWeight: THEME.fontWeight.medium, color: THEME.colors.textPrimary },
  referenceDetail: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textSecondary, marginTop: 2 },
  documentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: THEME.spacing.sm, gap: THEME.spacing.sm },
  documentInfo: { flex: 1 },
  documentName: { fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary },
  documentType: { fontSize: THEME.fontSize.bodySmall, color: THEME.colors.textTertiary },
  actionsContainer: { padding: THEME.spacing.base, marginTop: THEME.spacing.lg },
});
