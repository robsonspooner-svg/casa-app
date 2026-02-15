// Application Detail (Owner) - Mission 05: Applications
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Badge, Button, ContactButton, StatusTimeline, THEME, useToast } from '@casa/ui';
import {
  useApplication,
  useApplicationMutations,
  ApplicationStatus,
  ApplicationWithDetails,
} from '@casa/api';
import type { TimelineEvent } from '@casa/ui';

function getStatusVariant(status: ApplicationStatus): 'success' | 'info' | 'warning' | 'neutral' {
  switch (status) {
    case 'submitted': return 'info';
    case 'under_review': return 'warning';
    case 'shortlisted': return 'info';
    case 'approved': return 'success';
    case 'rejected': return 'neutral';
    case 'withdrawn': return 'neutral';
    default: return 'neutral';
  }
}

function formatStatus(status: ApplicationStatus): string {
  switch (status) {
    case 'submitted': return 'Submitted';
    case 'under_review': return 'Under Review';
    case 'shortlisted': return 'Shortlisted';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'withdrawn': return 'Withdrawn';
    case 'draft': return 'Draft';
    default: return status;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatEmploymentType(type: string): string {
  switch (type) {
    case 'full_time': return 'Full-time';
    case 'part_time': return 'Part-time';
    case 'casual': return 'Casual';
    case 'self_employed': return 'Self-employed';
    case 'unemployed': return 'Unemployed';
    case 'retired': return 'Retired';
    case 'student': return 'Student';
    default: return type;
  }
}

function formatReferenceType(type: string): string {
  switch (type) {
    case 'personal': return 'Personal';
    case 'professional': return 'Professional';
    case 'landlord': return 'Landlord';
    default: return type;
  }
}

const STATUS_ORDER: ApplicationStatus[] = ['submitted', 'under_review', 'shortlisted', 'approved'];

function buildTimeline(application: ApplicationWithDetails): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const currentIndex = STATUS_ORDER.indexOf(application.status);

  events.push({
    label: 'Submitted',
    date: application.submitted_at ? formatDate(application.submitted_at) : undefined,
    status: application.submitted_at ? 'completed' : 'pending',
  });

  events.push({
    label: 'Under Review',
    date: application.status === 'under_review' || currentIndex > 1 ? (application.reviewed_at ? formatDate(application.reviewed_at) : 'In progress') : undefined,
    status: currentIndex >= 1 ? (currentIndex === 1 ? 'current' : 'completed') : 'pending',
  });

  events.push({
    label: 'Shortlisted',
    status: currentIndex >= 2 ? (currentIndex === 2 ? 'current' : 'completed') : 'pending',
  });

  if (application.status === 'approved') {
    events.push({ label: 'Approved', status: 'current' });
  } else if (application.status === 'rejected') {
    events.push({ label: 'Rejected', status: 'current' });
  } else {
    events.push({ label: 'Decision', status: 'pending' });
  }

  return events;
}

export default function ApplicationDetailScreen() {
  const router = useRouter();
  const { appId } = useLocalSearchParams<{ appId: string }>();
  const { application, loading, error } = useApplication(appId || null);
  const { reviewApplication, shortlistApplication, approveApplication, rejectApplication } = useApplicationMutations();
  const toast = useToast();
  const [actionLoading, setActionLoading] = useState(false);

  const handleReview = async () => {
    if (!appId) return;
    setActionLoading(true);
    try {
      await reviewApplication(appId);
      toast.success('Application marked as under review.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShortlist = async () => {
    if (!appId) return;
    setActionLoading(true);
    try {
      await shortlistApplication(appId);
      toast.success('Application shortlisted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to shortlist application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!appId) return;
    Alert.alert('Approve Application', `Are you sure you want to approve ${application?.full_name}'s application?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setActionLoading(true);
          try {
            await approveApplication(appId);
            toast.success('Application approved.');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to approve application');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleReject = async () => {
    if (!appId) return;
    Alert.alert('Reject Application', `Are you sure you want to reject ${application?.full_name}'s application?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await rejectApplication(appId, 'Application not successful');
            toast.success('Application rejected.');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to reject application');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
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
  const canAction = application.status !== 'approved' && application.status !== 'rejected' && application.status !== 'withdrawn';

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
        {/* Applicant Header */}
        <View style={styles.card}>
          <View style={styles.applicantHeader}>
            <View style={styles.applicantInfo}>
              <Text style={styles.applicantName}>{application.full_name}</Text>
              <Badge label={formatStatus(application.status)} variant={getStatusVariant(application.status)} />
            </View>
            <Text style={styles.applicantEmail}>{application.email}</Text>
          </View>
          <View style={styles.contactRow}>
            <ContactButton type="phone" value={application.phone} label="Call" />
            <ContactButton type="email" value={application.email} label="Email" />
          </View>
        </View>

        {/* Status Timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          <StatusTimeline events={timeline} />
        </View>

        {/* Personal Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          {application.date_of_birth && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date of Birth</Text>
              <Text style={styles.detailValue}>{formatDate(application.date_of_birth)}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current Address</Text>
            <Text style={[styles.detailValue, styles.detailValueWrap]}>{application.current_address}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Move-in Date</Text>
            <Text style={styles.detailValue}>{formatDate(application.move_in_date)}</Text>
          </View>
          {application.lease_term_preference && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lease Preference</Text>
              <Text style={styles.detailValue}>{application.lease_term_preference.replace('_', ' ')}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Additional Occupants</Text>
            <Text style={styles.detailValue}>{application.additional_occupants}</Text>
          </View>
          {application.occupant_details && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Occupant Details</Text>
              <Text style={[styles.detailValue, styles.detailValueWrap]}>{application.occupant_details}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pets</Text>
            <Text style={styles.detailValue}>{application.has_pets ? 'Yes' : 'No'}</Text>
          </View>
          {application.has_pets && application.pet_description && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pet Details</Text>
              <Text style={[styles.detailValue, styles.detailValueWrap]}>{application.pet_description}</Text>
            </View>
          )}
        </View>

        {/* Employment */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Employment</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{formatEmploymentType(application.employment_type)}</Text>
          </View>
          {application.employer_name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Employer</Text>
              <Text style={styles.detailValue}>{application.employer_name}</Text>
            </View>
          )}
          {application.job_title && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Job Title</Text>
              <Text style={styles.detailValue}>{application.job_title}</Text>
            </View>
          )}
          {application.annual_income && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Annual Income</Text>
              <Text style={styles.detailValue}>${application.annual_income.toLocaleString()}</Text>
            </View>
          )}
          {application.employment_start_date && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Start Date</Text>
              <Text style={styles.detailValue}>{formatDate(application.employment_start_date)}</Text>
            </View>
          )}
        </View>

        {/* Current Tenancy */}
        {(application.current_landlord_name || application.current_rent) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Current Tenancy</Text>
            {application.current_landlord_name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Landlord</Text>
                <Text style={styles.detailValue}>{application.current_landlord_name}</Text>
              </View>
            )}
            {application.current_landlord_phone && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${application.current_landlord_phone}`)}>
                  <Text style={[styles.detailValue, styles.linkText]}>{application.current_landlord_phone}</Text>
                </TouchableOpacity>
              </View>
            )}
            {application.current_landlord_email && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${application.current_landlord_email}`)}>
                  <Text style={[styles.detailValue, styles.linkText]}>{application.current_landlord_email}</Text>
                </TouchableOpacity>
              </View>
            )}
            {application.current_rent && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current Rent</Text>
                <Text style={styles.detailValue}>${application.current_rent}/wk</Text>
              </View>
            )}
            {application.tenancy_start_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Since</Text>
                <Text style={styles.detailValue}>{formatDate(application.tenancy_start_date)}</Text>
              </View>
            )}
            {application.reason_for_moving && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reason for Moving</Text>
                <Text style={[styles.detailValue, styles.detailValueWrap]}>{application.reason_for_moving}</Text>
              </View>
            )}
          </View>
        )}

        {/* References */}
        {application.references.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>References ({application.references.length})</Text>
            {application.references.map((ref, index) => (
              <View key={ref.id} style={[styles.referenceItem, index > 0 && styles.referenceItemBorder]}>
                <View style={styles.referenceHeader}>
                  <Text style={styles.referenceName}>{ref.name}</Text>
                  <Badge label={formatReferenceType(ref.reference_type)} variant="neutral" />
                </View>
                <Text style={styles.referenceRelationship}>{ref.relationship}</Text>
                <View style={styles.referenceContact}>
                  <ContactButton type="phone" value={ref.phone} label="Call" />
                  {ref.email && <ContactButton type="email" value={ref.email} label="Email" />}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Documents */}
        {application.documents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Documents ({application.documents.length})</Text>
            {application.documents.map(doc => (
              <TouchableOpacity
                key={doc.id}
                style={styles.documentItem}
                onPress={() => Linking.openURL(doc.url)}
                activeOpacity={0.7}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName} numberOfLines={1}>{doc.file_name}</Text>
                  <Text style={styles.documentType}>{doc.document_type.replace(/_/g, ' ')}</Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Additional Notes */}
        {application.additional_notes && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <Text style={styles.notesText}>{application.additional_notes}</Text>
          </View>
        )}

        {/* Create Tenancy - shown for approved applications */}
        {application.status === 'approved' && (
          <View style={styles.actionsContainer}>
            <Button
              title="Create Tenancy"
              onPress={() => router.push(`/(app)/tenancies/create?applicationId=${appId}&listingId=${application.listing_id}` as any)}
            />
          </View>
        )}

        {/* Actions */}
        {canAction && (
          <View style={styles.actionsContainer}>
            {application.status === 'submitted' && (
              <Button
                title={actionLoading ? 'Updating...' : 'Start Review'}
                onPress={handleReview}
                disabled={actionLoading}
              />
            )}
            {(application.status === 'under_review' || application.status === 'submitted') && (
              <>
                <View style={styles.actionGap} />
                <Button
                  title={actionLoading ? 'Updating...' : 'Shortlist'}
                  onPress={handleShortlist}
                  variant="secondary"
                  disabled={actionLoading}
                />
              </>
            )}
            {(application.status === 'shortlisted' || application.status === 'under_review') && (
              <>
                <View style={styles.actionGap} />
                <Button
                  title={actionLoading ? 'Approving...' : 'Approve Application'}
                  onPress={handleApprove}
                  disabled={actionLoading}
                />
              </>
            )}
            <View style={styles.actionGap} />
            <Button
              title={actionLoading ? 'Rejecting...' : 'Reject Application'}
              onPress={handleReject}
              variant="secondary"
              disabled={actionLoading}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  flex: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
    gap: THEME.spacing.lg,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  content: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  applicantHeader: {
    marginBottom: THEME.spacing.md,
  },
  applicantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.xs,
  },
  applicantName: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  applicantEmail: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  contactRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  detailLabel: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },
  detailValueWrap: {
    textAlign: 'right',
  },
  linkText: {
    color: THEME.colors.brand,
  },
  referenceItem: {
    paddingVertical: THEME.spacing.sm,
  },
  referenceItemBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.md,
  },
  referenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.xs,
  },
  referenceName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  referenceRelationship: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  referenceContact: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.sm,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.subtle,
    marginBottom: THEME.spacing.sm,
    gap: THEME.spacing.sm,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  documentType: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    textTransform: 'capitalize',
  },
  notesText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
  },
  actionsContainer: {
    marginTop: THEME.spacing.lg,
  },
  actionGap: {
    height: THEME.spacing.md,
  },
});
