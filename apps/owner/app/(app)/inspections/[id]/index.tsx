// Inspection Detail/Report - Owner View
// Mission 11: Property Inspections
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  FlatList,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { THEME } from '@casa/config';
import { Button, ConditionBadge } from '@casa/ui';
import { useInspection, useInspectionMutations, useAIComparison, getSupabaseClient } from '@casa/api';
import type { InspectionStatus, ConditionRating, InspectionImageRow, InspectionItemRow } from '@casa/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROOM_PAGE_WIDTH = SCREEN_WIDTH - THEME.spacing.base * 2;

const STATUS_CONFIG: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: THEME.colors.info, bg: THEME.colors.infoBg },
  in_progress: { label: 'In Progress', color: THEME.colors.warning, bg: THEME.colors.warningBg },
  completed: { label: 'Completed', color: THEME.colors.success, bg: THEME.colors.successBg },
  cancelled: { label: 'Cancelled', color: THEME.colors.textTertiary, bg: THEME.colors.subtle },
  tenant_review: { label: 'Tenant Review', color: THEME.colors.brand, bg: THEME.colors.brand + '20' },
  disputed: { label: 'Disputed', color: THEME.colors.error, bg: THEME.colors.errorBg },
  finalized: { label: 'Finalized', color: THEME.colors.success, bg: THEME.colors.successBg },
};

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  missing: 'Missing',
  not_applicable: 'N/A',
};

export default function InspectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading, error, refreshing, refreshInspection } = useInspection(id || null);
  const { startInspection, completeInspection, cancelInspection, sendForTenantReview, finalizeInspection } = useInspectionMutations();
  const { comparison } = useAIComparison(id || null);
  const isExitInspection = inspection?.inspection_type === 'exit';
  const hasComparison = comparison !== null;
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const roomPagerRef = useRef<FlatList>(null);

  const isReportView = inspection && (
    inspection.status === 'completed' ||
    inspection.status === 'finalized' ||
    inspection.status === 'tenant_review'
  );

  // Refresh data when screen gains focus (e.g. returning from room detail)
  useFocusEffect(
    useCallback(() => {
      if (id) {
        refreshInspection();
      }
    }, [id, refreshInspection])
  );

  const handleSharePDF = useCallback(async () => {
    if (!inspection || !id) return;
    setExporting(true);
    try {
      let html: string | null = null;

      // If report already generated, fetch the HTML from storage
      if (inspection.report_url) {
        const response = await fetch(inspection.report_url);
        if (response.ok) {
          html = await response.text();
        }
      }

      // If no stored report, generate one on the fly
      if (!html) {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const resp = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/generate-inspection-report`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inspection_id: id }),
          }
        );

        if (!resp.ok) throw new Error('Failed to generate report');
        const result = await resp.json();

        if (result.report_url) {
          const htmlResp = await fetch(result.report_url);
          if (htmlResp.ok) html = await htmlResp.text();
        }

        refreshInspection();
      }

      if (!html) throw new Error('Could not load report HTML');

      const { uri } = await Print.printToFileAsync({ html });
      const address = inspection.property
        ? `${inspection.property.address_line_1 || 'Property'} ${inspection.property.suburb || ''}`
        : 'Inspection';
      const typeLabel = inspection.inspection_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${typeLabel} Report — ${address}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancel')) return;
      Alert.alert('Export Error', err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }, [inspection, id, refreshInspection]);

  const handleAction = async (action: string) => {
    if (!id) return;

    try {
      switch (action) {
        case 'start':
          await startInspection(id);
          break;
        case 'conduct':
          router.push({ pathname: '/(app)/inspections/[id]/conduct' as any, params: { id } });
          return;
        case 'complete':
          await completeInspection(id, inspection?.overall_condition || undefined, inspection?.summary_notes || undefined);
          break;
        case 'send_review':
          await sendForTenantReview(id);
          break;
        case 'finalize':
          await finalizeInspection(id);
          break;
        case 'cancel':
          Alert.alert('Cancel Inspection', 'Are you sure you want to cancel this inspection?', [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
              await cancelInspection(id);
              refreshInspection();
            }},
          ]);
          return;
      }
      refreshInspection();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !inspection) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inspection</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Inspection not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[inspection.status];
  const completedRooms = inspection.rooms.filter(r => r.completed_at).length;
  const totalRooms = inspection.rooms.length;

  const handleRoomDotPress = (index: number) => {
    setActiveRoomIndex(index);
    roomPagerRef.current?.scrollToIndex({ index, animated: true });
  };

  // Render a single room report page (used in swipeable FlatList)
  const renderRoomReportPage = ({ item: room, index }: { item: typeof inspection.rooms[0]; index: number }) => {
    const roomImages = inspection.images.filter(img => img.room_id === room.id);
    const wideShots = roomImages.filter(img => img.is_wide_shot);
    const closeups = roomImages.filter(img => img.is_closeup);
    const otherPhotos = roomImages.filter(img => !img.is_wide_shot && !img.is_closeup);
    const checkedItems = room.items.filter(item => item.checked_at);
    const actionItems = room.items.filter(item => item.action_required);

    return (
      <ScrollView
        style={[styles.roomPage, { width: SCREEN_WIDTH - THEME.spacing.base * 2 }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Room Header */}
        <View style={styles.roomReportHeader}>
          <Text style={styles.roomReportTitle}>{room.name}</Text>
          {room.overall_condition && (
            <ConditionBadge condition={room.overall_condition} size="medium" />
          )}
        </View>

        {/* Room Layout Sketch */}
        {room.layout_sketch_url && (
          <View style={styles.layoutSketchContainer}>
            <Image
              source={{ uri: room.layout_sketch_url }}
              style={styles.layoutSketchImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Photo Gallery — Wide Shots */}
        {wideShots.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionLabel}>Room Overview</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {wideShots.map(img => (
                <View key={img.id} style={styles.photoCard}>
                  <Image source={{ uri: img.url }} style={styles.photoImage} resizeMode="cover" />
                  {img.caption && <Text style={styles.photoCaption} numberOfLines={2}>{img.caption}</Text>}
                  {img.compass_bearing != null && (
                    <Text style={styles.photoBearing}>{Math.round(img.compass_bearing)}{'\u00B0'}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Photo Gallery — Close-ups */}
        {closeups.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionLabel}>Close-ups</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {closeups.map(img => (
                <View key={img.id} style={styles.photoCard}>
                  <Image source={{ uri: img.url }} style={styles.photoImage} resizeMode="cover" />
                  {img.caption && <Text style={styles.photoCaption} numberOfLines={2}>{img.caption}</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Other photos (not classified) */}
        {otherPhotos.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionLabel}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {otherPhotos.map(img => (
                <View key={img.id} style={styles.photoCard}>
                  <Image source={{ uri: img.url }} style={styles.photoImage} resizeMode="cover" />
                  {img.caption && <Text style={styles.photoCaption} numberOfLines={2}>{img.caption}</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* No photos */}
        {roomImages.length === 0 && (
          <View style={styles.noPhotosCard}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} />
            </Svg>
            <Text style={styles.noPhotosText}>No photos captured</Text>
          </View>
        )}

        {/* Items Checklist */}
        {room.items.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsSectionTitle}>
              Items ({checkedItems.length}/{room.items.length} checked)
            </Text>
            {room.items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <View style={[
                    styles.itemDot,
                    item.condition === 'damaged' || item.condition === 'poor'
                      ? styles.itemDotWarning
                      : item.checked_at
                        ? styles.itemDotChecked
                        : styles.itemDotDefault,
                  ]} />
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
                {item.condition && (
                  <ConditionBadge condition={item.condition} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Action Required Items */}
        {actionItems.length > 0 && (
          <View style={styles.actionItemsSection}>
            <Text style={styles.actionItemsTitle}>Action Required</Text>
            {actionItems.map(item => (
              <View key={item.id} style={styles.actionItemCard}>
                <Text style={styles.actionItemName}>{item.name}</Text>
                {item.action_description && (
                  <Text style={styles.actionItemDesc}>{item.action_description}</Text>
                )}
                {item.estimated_cost != null && item.estimated_cost > 0 && (
                  <Text style={styles.actionItemCost}>
                    Est. {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(item.estimated_cost)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Room Notes */}
        {room.notes && (
          <View style={styles.roomNotesSection}>
            <Text style={styles.roomNotesLabel}>Notes</Text>
            <Text style={styles.roomNotesText}>{room.notes}</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isReportView ? 'Condition Report' : 'Inspection'}
        </Text>
        {isReportView ? (
          <TouchableOpacity onPress={handleSharePDF} style={styles.backButton} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color={THEME.colors.brand} />
            ) : (
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshInspection} tintColor={THEME.colors.brand} />
        }
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>
              {inspection.inspection_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>
              {new Date(inspection.scheduled_date).toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          </View>
          {inspection.scheduled_time && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>{inspection.scheduled_time.slice(0, 5)}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Property</Text>
            <Text style={styles.infoValue}>
              {inspection.property
                ? `${inspection.property.address_line_1 || 'Unknown'}, ${inspection.property.suburb || ''}`
                : 'Property not linked'}
            </Text>
          </View>
          {inspection.overall_condition && (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Overall</Text>
              <ConditionBadge condition={inspection.overall_condition} size="medium" />
            </View>
          )}
        </View>

        {/* REPORT VIEW — swipeable room-by-room breakdown */}
        {isReportView && totalRooms > 0 && (
          <>
            {/* Room tabs / dots */}
            <View style={styles.roomTabsContainer}>
              <Text style={styles.sectionTitle}>Room Breakdown</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomTabs}>
                {inspection.rooms.map((room, idx) => (
                  <TouchableOpacity
                    key={room.id}
                    style={[styles.roomTab, activeRoomIndex === idx && styles.roomTabActive]}
                    onPress={() => handleRoomDotPress(idx)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.roomTabText,
                      activeRoomIndex === idx && styles.roomTabTextActive,
                    ]}>
                      {room.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Swipeable Room Pages */}
            <FlatList
              ref={roomPagerRef}
              data={inspection.rooms}
              keyExtractor={room => room.id}
              renderItem={renderRoomReportPage}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={SCREEN_WIDTH - THEME.spacing.base * 2}
              decelerationRate="fast"
              snapToAlignment="start"
              onMomentumScrollEnd={(e) => {
                const pageWidth = SCREEN_WIDTH - THEME.spacing.base * 2;
                const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
                setActiveRoomIndex(Math.max(0, Math.min(idx, totalRooms - 1)));
              }}
              style={styles.roomPager}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH - THEME.spacing.base * 2,
                offset: (SCREEN_WIDTH - THEME.spacing.base * 2) * index,
                index,
              })}
            />

            {/* Page indicator dots */}
            {totalRooms > 1 && (
              <View style={styles.dotsRow}>
                {inspection.rooms.map((_, idx) => (
                  <View
                    key={idx}
                    style={[styles.dot, activeRoomIndex === idx && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* IN-PROGRESS VIEW — room list for conducting */}
        {!isReportView && totalRooms > 0 && (
          <>
            <View style={styles.progressSection}>
              <Text style={styles.sectionTitle}>
                Rooms ({completedRooms}/{totalRooms} complete)
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${totalRooms > 0 ? (completedRooms / totalRooms) * 100 : 0}%` },
                  ]}
                />
              </View>
            </View>

            {inspection.rooms.map(room => {
              const roomImages = inspection.images.filter(img => img.room_id === room.id);
              const checkedItems = room.items.filter(item => item.checked_at).length;

              return (
                <TouchableOpacity
                  key={room.id}
                  style={styles.roomCard}
                  onPress={() => {
                    if (inspection.status === 'in_progress') {
                      router.push({ pathname: '/(app)/inspections/[id]/rooms/[roomId]' as any, params: { id: inspection.id, roomId: room.id } });
                    }
                  }}
                  activeOpacity={inspection.status === 'in_progress' ? 0.7 : 1}
                >
                  <View style={styles.roomHeader}>
                    <View style={styles.roomTitleRow}>
                      {room.completed_at ? (
                        <View style={styles.checkIcon}>
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </View>
                      ) : (
                        <View style={styles.pendingIcon} />
                      )}
                      <Text style={styles.roomName}>{room.name}</Text>
                    </View>
                    {room.overall_condition && (
                      <ConditionBadge condition={room.overall_condition} />
                    )}
                  </View>
                  <View style={styles.roomMeta}>
                    <Text style={styles.roomMetaText}>
                      {checkedItems}/{room.items.length} items checked
                    </Text>
                    {roomImages.length > 0 && (
                      <Text style={styles.roomMetaText}>{roomImages.length} photos</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Summary Notes */}
        {inspection.summary_notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Summary Notes</Text>
            <Text style={styles.notesText}>{inspection.summary_notes}</Text>
          </View>
        )}

        {/* Tenant Acknowledgment */}
        {inspection.tenant_acknowledged && (
          <View style={styles.acknowledgmentCard}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.acknowledgmentText}>
              Tenant acknowledged on {new Date(inspection.tenant_acknowledged_at || '').toLocaleDateString('en-AU')}
            </Text>
          </View>
        )}

        {inspection.tenant_disputes && (
          <View style={[styles.acknowledgmentCard, { backgroundColor: THEME.colors.errorBg }]}>
            <Text style={[styles.acknowledgmentText, { color: THEME.colors.error }]}>
              Tenant dispute: {inspection.tenant_disputes}
            </Text>
          </View>
        )}

        {/* Casa Agent Analysis - for exit inspections */}
        {isExitInspection && (inspection.status === 'completed' || inspection.status === 'tenant_review' || inspection.status === 'finalized' || inspection.status === 'disputed') && (
          <TouchableOpacity
            style={styles.agentCard}
            onPress={() => router.push({ pathname: '/(app)/inspections/[id]/comparison' as any, params: { id: inspection.id } })}
            activeOpacity={0.7}
          >
            <View style={styles.agentCardHeader}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <View style={styles.agentCardInfo}>
                <Text style={styles.agentCardTitle}>Casa Agent Analysis</Text>
                <Text style={styles.agentCardSubtitle}>
                  {hasComparison
                    ? `${comparison.total_issues} issues found · Bond recommendation available`
                    : 'Compare entry vs exit conditions with AI'
                  }
                </Text>
              </View>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            {hasComparison && comparison.bond_deduction_amount > 0 && (
              <View style={styles.agentBondPreview}>
                <Text style={styles.agentBondLabel}>Recommended bond deduction</Text>
                <Text style={styles.agentBondAmount}>
                  {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(comparison.bond_deduction_amount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Report Export */}
        {(inspection.status === 'completed' || inspection.status === 'tenant_review' || inspection.status === 'finalized') && (
          <View style={styles.reportSection}>
            <TouchableOpacity
              style={styles.reportCard}
              onPress={handleSharePDF}
              activeOpacity={0.7}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={THEME.colors.brand} />
              ) : (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
              <Text style={styles.reportCardText}>Share as PDF</Text>
            </TouchableOpacity>
            {isExitInspection && (
              <TouchableOpacity
                style={[styles.reportCard, { marginTop: THEME.spacing.sm }]}
                onPress={() => router.push({ pathname: '/(app)/inspections/[id]/evidence-report' as any, params: { id } })}
                activeOpacity={0.7}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.warning} strokeWidth={1.5} />
                  <Path d="M14 2v6h6M12 11v6M9 14h6" stroke={THEME.colors.warning} strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
                <Text style={[styles.reportCardText, { color: THEME.colors.warning }]}>Tribunal Evidence Report</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          {inspection.status === 'scheduled' && (
            <>
              <Button title="Start Inspection" onPress={() => handleAction('start')} />
              <Button title="Cancel" onPress={() => handleAction('cancel')} variant="text" />
            </>
          )}
          {inspection.status === 'in_progress' && (
            <>
              <Button title="Continue Inspection" onPress={() => handleAction('conduct')} />
              <Button
                title="Complete Inspection"
                onPress={() => handleAction('complete')}
                variant="secondary"
              />
            </>
          )}
          {inspection.status === 'completed' && (
            inspection.tenancy_id ? (
              <Button title="Send for Tenant Review" onPress={() => handleAction('send_review')} />
            ) : (
              <>
                <Button title="Send for Tenant Review" onPress={() => {
                  Alert.alert(
                    'No Tenant Linked',
                    'This inspection doesn\'t have a tenant linked yet. You can:\n\n1. Finalize now and send for review later when the tenant is connected\n2. Go back and link a tenancy first',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Finalize Without Review', onPress: () => handleAction('finalize') },
                      { text: 'Send Anyway', onPress: () => handleAction('send_review') },
                    ],
                  );
                }} variant="secondary" />
                <Button title="Finalize Without Tenant" onPress={() => handleAction('finalize')} />
              </>
            )
          )}
          {inspection.status === 'tenant_review' && (
            <>
              <Button
                title="Review Tenant Submissions"
                onPress={() => router.push({ pathname: '/(app)/inspections/[id]/review-submissions' as any, params: { id } })}
              />
              <Button title="Finalize Inspection" onPress={() => handleAction('finalize')} variant="secondary" />
            </>
          )}
        </View>
      </ScrollView>
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
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: THEME.spacing.base,
  },
  infoCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  infoLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  infoValue: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    marginLeft: THEME.spacing.md,
  },
  statusBadge: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.full,
  },
  statusText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
  },

  // Report view — room tabs
  roomTabsContainer: {
    marginBottom: THEME.spacing.md,
  },
  roomTabs: {
    marginTop: THEME.spacing.sm,
  },
  roomTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginRight: 6,
  },
  roomTabActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  roomTabText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  roomTabTextActive: {
    color: THEME.colors.textInverse,
  },

  // Report view — room pager
  roomPager: {
    marginBottom: THEME.spacing.sm,
  },
  roomPage: {
    paddingRight: THEME.spacing.sm,
  },
  roomReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  roomReportTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.textPrimary,
  },

  // Layout sketch
  layoutSketchContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
    alignItems: 'center',
    ...THEME.shadow.sm,
  },
  layoutSketchImage: {
    width: '100%',
    height: 160,
    borderRadius: THEME.radius.sm,
  },

  // Photo sections
  photoSection: {
    marginBottom: THEME.spacing.md,
  },
  photoSectionLabel: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  photoRow: {
    flexDirection: 'row',
  },
  photoCard: {
    width: 140,
    marginRight: 8,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
    overflow: 'hidden',
    ...THEME.shadow.sm,
  },
  photoImage: {
    width: 140,
    height: 105,
    backgroundColor: THEME.colors.subtle,
  },
  photoCaption: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    paddingHorizontal: 6,
    paddingVertical: 4,
    lineHeight: 14,
  },
  photoBearing: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textInverse,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  noPhotosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
  },
  noPhotosText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },

  // Items section
  itemsSection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  itemsSectionTitle: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemDotChecked: {
    backgroundColor: THEME.colors.success,
  },
  itemDotWarning: {
    backgroundColor: THEME.colors.warning,
  },
  itemDotDefault: {
    backgroundColor: THEME.colors.border,
  },
  itemName: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    flex: 1,
  },

  // Action items
  actionItemsSection: {
    marginBottom: THEME.spacing.md,
  },
  actionItemsTitle: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: '600',
    color: THEME.colors.error,
    marginBottom: THEME.spacing.sm,
  },
  actionItemCard: {
    backgroundColor: THEME.colors.errorBg,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.sm,
    marginBottom: 6,
  },
  actionItemName: {
    fontSize: THEME.fontSize.body,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  actionItemDesc: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  actionItemCost: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '600',
    color: THEME.colors.error,
    marginTop: 4,
  },

  // Room notes
  roomNotesSection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
  },
  roomNotesLabel: {
    fontSize: THEME.fontSize.caption,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  roomNotesText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },

  // Dots indicator
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: THEME.spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: THEME.colors.border,
  },
  dotActive: {
    backgroundColor: THEME.colors.brand,
    width: 20,
  },

  // In-progress room list
  progressSection: {
    marginBottom: THEME.spacing.md,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: THEME.colors.subtle,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.colors.success,
    borderRadius: 4,
  },
  roomCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.sm,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.xs,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  checkIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  roomName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  roomMeta: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginLeft: 28,
  },
  roomMetaText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  notesSection: {
    marginTop: THEME.spacing.md,
  },
  notesText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
  },
  acknowledgmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.successBg,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.md,
  },
  acknowledgmentText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.success,
    flex: 1,
  },
  agentCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.brand,
    ...THEME.shadow.md,
  },
  agentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  agentCardInfo: {
    flex: 1,
  },
  agentCardTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  agentCardSubtitle: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  agentBondPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  agentBondLabel: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  agentBondAmount: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.bold as any,
    color: THEME.colors.brand,
  },
  reportSection: {
    marginTop: THEME.spacing.md,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    ...THEME.shadow.sm,
  },
  reportCardText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.brand,
  },
  actionsSection: {
    paddingVertical: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
});
