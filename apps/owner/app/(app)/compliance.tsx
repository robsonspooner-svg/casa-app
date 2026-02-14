import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '@casa/config';
import { useCompliance } from '@casa/api';

const STATUS_COLORS: Record<string, string> = {
  compliant: THEME.colors.success,
  overdue: THEME.colors.error,
  upcoming: THEME.colors.warning,
  pending: THEME.colors.textTertiary,
  exempt: THEME.colors.textTertiary,
  not_applicable: THEME.colors.textTertiary,
};

const STATUS_LABELS: Record<string, string> = {
  compliant: 'Compliant',
  overdue: 'Overdue',
  upcoming: 'Due Soon',
  pending: 'Pending',
  exempt: 'Exempt',
  not_applicable: 'N/A',
};

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShieldIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function AlertIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={THEME.colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CameraIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={4} stroke={THEME.colors.brand} strokeWidth={1.5} />
    </Svg>
  );
}

function RecordCompletionModal({
  visible,
  itemName,
  onClose,
  onSubmit,
  uploadPhotos,
}: {
  visible: boolean;
  itemName: string;
  onClose: () => void;
  onSubmit: (data: { completed_by?: string; notes?: string; certificate_url?: string; evidence_urls?: string[] }) => void;
  uploadPhotos: (localUris: string[]) => Promise<string[]>;
}) {
  const [completedBy, setCompletedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [certificateRef, setCertificateRef] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  if (!visible) return null;

  const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB

  const filterOversizedAssets = (assets: ImagePicker.ImagePickerAsset[]): ImagePicker.ImagePickerAsset[] => {
    const valid = assets.filter(a => !a.fileSize || a.fileSize <= MAX_PHOTO_SIZE);
    if (valid.length < assets.length) {
      Alert.alert('Photo too large', 'Some photos exceeded the 10MB limit and were skipped.');
    }
    return valid;
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to attach evidence photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets) {
      const valid = filterOversizedAssets(result.assets);
      setPhotos((prev) => [...prev, ...valid.map((a) => a.uri)].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take evidence photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      const valid = filterOversizedAssets(result.assets);
      if (valid.length > 0) {
        setPhotos((prev) => [...prev, valid[0].uri].slice(0, 5));
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setUploading(true);

      // Upload local photos to Supabase Storage and get public URLs
      let evidenceUrls: string[] | undefined;
      if (photos.length > 0) {
        evidenceUrls = await uploadPhotos(photos);
      }

      onSubmit({
        completed_by: completedBy || 'owner',
        notes: notes || undefined,
        certificate_url: certificateRef || undefined,
        evidence_urls: evidenceUrls,
      });
      setCompletedBy('');
      setNotes('');
      setCertificateRef('');
      setPhotos([]);
    } catch (err) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Failed to upload evidence photos.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={rcStyles.overlay}>
      <ScrollView contentContainerStyle={rcStyles.scrollContainer}>
        <View style={rcStyles.container}>
          <Text style={rcStyles.title}>Record Completion</Text>
          <Text style={rcStyles.subtitle}>{itemName}</Text>

          <Text style={rcStyles.label}>Completed by</Text>
          <TextInput
            style={rcStyles.input}
            value={completedBy}
            onChangeText={setCompletedBy}
            placeholder="e.g. Smith's Fire Services"
            placeholderTextColor={THEME.colors.textTertiary}
          />

          <Text style={rcStyles.label}>Certificate/Reference number</Text>
          <TextInput
            style={rcStyles.input}
            value={certificateRef}
            onChangeText={setCertificateRef}
            placeholder="e.g. CERT-2024-12345"
            placeholderTextColor={THEME.colors.textTertiary}
          />

          <Text style={rcStyles.label}>Evidence photos</Text>
          <View style={rcStyles.photoRow}>
            {photos.map((uri, i) => (
              <TouchableOpacity key={i} onPress={() => removePhoto(i)} style={rcStyles.photoThumb}>
                <Image source={{ uri }} style={rcStyles.photoImage} />
                <View style={rcStyles.photoRemove}>
                  <Text style={rcStyles.photoRemoveText}>✕</Text>
                </View>
              </TouchableOpacity>
            ))}
            {photos.length < 5 && (
              <View style={rcStyles.photoActions}>
                <TouchableOpacity style={rcStyles.photoAddBtn} onPress={pickPhoto}>
                  <CameraIcon />
                  <Text style={rcStyles.photoAddText}>Library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={rcStyles.photoAddBtn} onPress={takePhoto}>
                  <CameraIcon />
                  <Text style={rcStyles.photoAddText}>Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {photos.length > 0 && (
            <Text style={rcStyles.photoCount}>{photos.length}/5 photos</Text>
          )}

          <Text style={rcStyles.label}>Notes (optional)</Text>
          <TextInput
            style={[rcStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any details about the service..."
            placeholderTextColor={THEME.colors.textTertiary}
            multiline
          />

          <View style={rcStyles.actions}>
            <TouchableOpacity style={rcStyles.cancelBtn} onPress={onClose}>
              <Text style={rcStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[rcStyles.submitBtn, uploading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color={THEME.colors.textInverse} /> : <CheckIcon />}
              <Text style={rcStyles.submitBtnText}>{uploading ? 'Uploading...' : 'Record'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const rcStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  container: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  input: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 12,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  submitBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.success,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: THEME.radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: 64,
    height: 64,
    borderRadius: THEME.radius.sm,
  },
  photoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: THEME.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: THEME.colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 6,
  },
  photoAddBtn: {
    width: 64,
    height: 64,
    borderRadius: THEME.radius.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.brand + '40',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: THEME.colors.brand + '08',
  },
  photoAddText: {
    fontSize: 10,
    color: THEME.colors.brand,
    fontWeight: '500',
  },
  photoCount: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
});

function CalendarView({ items }: { items: any[] }) {
  const now = new Date();
  const months: Array<{ label: string; items: any[] }> = [];

  // Build next 12 months
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthLabel = monthDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);

    const monthItems = items.filter(item => {
      if (!item.next_due_date) return false;
      const due = new Date(item.next_due_date);
      return due >= monthDate && due <= monthEnd;
    });

    if (monthItems.length > 0) {
      months.push({ label: monthLabel, items: monthItems });
    }
  }

  if (months.length === 0) {
    return (
      <View style={calStyles.empty}>
        <Text style={calStyles.emptyText}>No upcoming compliance items in the next 12 months</Text>
      </View>
    );
  }

  return (
    <View style={calStyles.container}>
      {months.map((month) => (
        <View key={month.label} style={calStyles.monthSection}>
          <Text style={calStyles.monthLabel}>{month.label}</Text>
          {month.items.map((item: any) => {
            const dueDate = new Date(item.next_due_date);
            return (
              <View key={item.id} style={calStyles.calItem}>
                <Text style={calStyles.calDate}>{dueDate.getDate()}</Text>
                <View style={calStyles.calInfo}>
                  <Text style={calStyles.calName}>{item.requirement?.name || 'Unknown'}</Text>
                  <Text style={calStyles.calProperty}>{item.property?.address_line_1 || ''}</Text>
                </View>
                <View style={[
                  calStyles.calBadge,
                  { backgroundColor: (STATUS_COLORS[item.status] || THEME.colors.textTertiary) + '20' },
                ]}>
                  <Text style={[
                    calStyles.calBadgeText,
                    { color: STATUS_COLORS[item.status] || THEME.colors.textTertiary },
                  ]}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: { gap: 16 },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: THEME.colors.textTertiary },
  monthSection: { gap: 8 },
  monthLabel: { fontSize: 16, fontWeight: '600', color: THEME.colors.textPrimary },
  calItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 12,
  },
  calDate: { fontSize: 20, fontWeight: '700', color: THEME.colors.brand, width: 32, textAlign: 'center' },
  calInfo: { flex: 1 },
  calName: { fontSize: 14, fontWeight: '600', color: THEME.colors.textPrimary },
  calProperty: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2 },
  calBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: THEME.radius.md },
  calBadgeText: { fontSize: 11, fontWeight: '600' },
});

export default function ComplianceScreen() {
  const { items, loading, error, summary, overdueItems, upcomingItems, refetch, recordCompletion, markExempt, uploadEvidencePhotos } = useCompliance();
  const [activeTab, setActiveTab] = useState<'status' | 'calendar'>('status');
  const [completionModal, setCompletionModal] = useState<{ id: string; name: string } | null>(null);

  const groupedByProperty = items.reduce<Record<string, typeof items>>((acc, item) => {
    const addr = item.property?.address_line_1 || item.property_id;
    if (!acc[addr]) acc[addr] = [];
    acc[addr].push(item);
    return acc;
  }, {});

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Compliance</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compliance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: THEME.colors.success }]}>
            <Text style={styles.summaryValue}>{summary.compliant}</Text>
            <Text style={styles.summaryLabel}>Compliant</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: THEME.colors.error }]}>
            <Text style={[styles.summaryValue, summary.overdue > 0 && { color: THEME.colors.error }]}>{summary.overdue}</Text>
            <Text style={styles.summaryLabel}>Overdue</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: THEME.colors.warning }]}>
            <Text style={styles.summaryValue}>{summary.upcoming}</Text>
            <Text style={styles.summaryLabel}>Upcoming</Text>
          </View>
        </View>

        {/* Overdue Alert */}
        {overdueItems.length > 0 && (
          <View style={styles.alertBanner}>
            <AlertIcon />
            <Text style={styles.alertText}>
              {overdueItems.length} compliance item{overdueItems.length !== 1 ? 's' : ''} overdue. Action required.
            </Text>
          </View>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'status' && styles.tabActive]}
            onPress={() => setActiveTab('status')}
          >
            <Text style={[styles.tabText, activeTab === 'status' && styles.tabTextActive]}>Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
            onPress={() => setActiveTab('calendar')}
          >
            <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar View */}
        {activeTab === 'calendar' ? (
          <CalendarView items={items} />
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <ShieldIcon color={THEME.colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Compliance Items</Text>
            <Text style={styles.emptyText}>
              Add a property to start tracking compliance requirements for your state.
            </Text>
          </View>
        ) : (
          Object.entries(groupedByProperty).map(([address, propItems]) => (
            <View key={address} style={styles.propertySection}>
              <Text style={styles.propertyTitle}>{address}</Text>
              {propItems.map((item: any) => {
                const daysUntilDue = item.next_due_date
                  ? Math.ceil((new Date(item.next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <View key={item.id} style={styles.complianceCard}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] || THEME.colors.textTertiary }]} />
                      <Text style={styles.cardTitle}>{item.requirement?.name || 'Unknown'}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || THEME.colors.textTertiary) + '20' }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || THEME.colors.textTertiary }]}>
                          {STATUS_LABELS[item.status] || item.status}
                        </Text>
                      </View>
                    </View>

                    {item.requirement?.description && (
                      <Text style={styles.cardDescription}>{item.requirement.description}</Text>
                    )}

                    {daysUntilDue !== null && item.status !== 'exempt' && item.status !== 'not_applicable' && (
                      <Text style={[
                        styles.dueText,
                        daysUntilDue < 0 && { color: THEME.colors.error },
                        daysUntilDue >= 0 && daysUntilDue <= 14 && { color: THEME.colors.warning },
                      ]}>
                        {daysUntilDue < 0
                          ? `${Math.abs(daysUntilDue)} days overdue`
                          : daysUntilDue === 0
                            ? 'Due today'
                            : `Due in ${daysUntilDue} days`}
                      </Text>
                    )}

                    {item.last_completed_at && (
                      <Text style={styles.completedText}>
                        Last completed: {new Date(item.last_completed_at).toLocaleDateString('en-AU')}
                      </Text>
                    )}

                    {(item.status === 'overdue' || item.status === 'upcoming' || item.status === 'pending') && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.recordButton}
                          onPress={() => setCompletionModal({ id: item.id, name: item.requirement?.name || 'Compliance Item' })}
                        >
                          <CheckIcon />
                          <Text style={styles.recordButtonText}>Record Completion</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.exemptButton}
                          onPress={() => {
                            Alert.alert(
                              'Mark as Exempt',
                              `Mark "${item.requirement?.name || 'this item'}" as not applicable to this property?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Mark Exempt', onPress: () => markExempt(item.id, 'Owner marked as not applicable') },
                              ],
                            );
                          }}
                        >
                          <Text style={styles.exemptButtonText}>Exempt</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {item.requirement?.conditions && (
                      <Text style={styles.conditionText}>{item.requirement.conditions}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <RecordCompletionModal
        visible={!!completionModal}
        itemName={completionModal?.name || ''}
        onClose={() => setCompletionModal(null)}
        uploadPhotos={uploadEvidencePhotos}
        onSubmit={(data) => {
          if (completionModal) {
            recordCompletion(completionModal.id, data);
            setCompletionModal(null);
          }
        }}
      />
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
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderLeftWidth: 3,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.error + '15',
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.error + '30',
  },
  alertText: {
    color: THEME.colors.error,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  propertySection: {
    marginBottom: 24,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  complianceCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.md,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    marginLeft: 16,
  },
  dueText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 6,
    marginLeft: 16,
    fontWeight: '500',
  },
  completedText: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 4,
    marginLeft: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.subtle,
  },
  tabActive: {
    backgroundColor: THEME.colors.brand,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: THEME.colors.textInverse,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginLeft: 16,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: THEME.colors.success + '15',
    borderRadius: THEME.radius.sm,
  },
  recordButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.success,
  },
  exemptButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  exemptButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textTertiary,
  },
  conditionText: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 6,
    marginLeft: 16,
  },
});
