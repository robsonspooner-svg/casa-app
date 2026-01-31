// Condition Report Screen - Owner App
// Mission 06: Tenancies & Leases

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { THEME } from '@casa/config';
import {
  useTenancy,
  useProfile,
  generateConditionReportHTML,
  getDefaultRooms,
  type ConditionReportData,
  type RoomReport,
  type ReportConditionRating,
} from '@casa/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONDITION_OPTIONS: { value: ReportConditionRating; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: '#16A34A' },
  { value: 'good', label: 'Good', color: '#2563EB' },
  { value: 'fair', label: 'Fair', color: '#F59E0B' },
  { value: 'poor', label: 'Poor', color: '#F97316' },
  { value: 'damaged', label: 'Damaged', color: '#EF4444' },
];

type ReportType = 'entry' | 'exit';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={THEME.colors.brand}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronDownIcon({ expanded }: { expanded: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d={expanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}
        stroke={THEME.colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DocumentIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConditionReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenancy, loading } = useTenancy(id || null);
  const { profile } = useProfile();

  const [reportType, setReportType] = useState<ReportType>('entry');
  const [rooms, setRooms] = useState<RoomReport[]>(() => getDefaultRooms());
  const [expandedRooms, setExpandedRooms] = useState<Record<number, boolean>>({});

  // Meter readings
  const [electricity, setElectricity] = useState('');
  const [gas, setGas] = useState('');
  const [water, setWater] = useState('');

  // Keys
  const [frontDoor, setFrontDoor] = useState('');
  const [backDoor, setBackDoor] = useState('');
  const [garage, setGarage] = useState('');
  const [mailbox, setMailbox] = useState('');

  // General
  const [generalNotes, setGeneralNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  // Derive property address for the report header
  const propertyAddress = useMemo(() => {
    const p = tenancy?.property;
    if (!p) return 'Property Address';
    const parts = [p.address_line_1];
    if (p.address_line_2) parts.push(p.address_line_2);
    parts.push(`${p.suburb} ${p.state} ${p.postcode}`);
    return parts.join(', ');
  }, [tenancy]);

  // Derive tenant name(s) from tenancy
  const tenantName = useMemo(() => {
    if (!tenancy?.tenants?.length) return 'Tenant';
    return tenancy.tenants
      .map(t => t.profile?.full_name || 'Unnamed Tenant')
      .join(', ');
  }, [tenancy]);

  const ownerName = profile?.full_name || 'Owner';

  // -----------------------------------------------------------------------
  // Room state helpers
  // -----------------------------------------------------------------------

  const toggleRoom = (roomIndex: number) => {
    setExpandedRooms(prev => ({
      ...prev,
      [roomIndex]: !prev[roomIndex],
    }));
  };

  const updateItemCondition = (
    roomIndex: number,
    itemIndex: number,
    condition: ReportConditionRating,
  ) => {
    setRooms(prev => {
      const updated = [...prev];
      const room = { ...updated[roomIndex] };
      const items = [...room.items];
      items[itemIndex] = { ...items[itemIndex], condition };
      room.items = items;
      updated[roomIndex] = room;
      return updated;
    });
  };

  const updateItemNotes = (roomIndex: number, itemIndex: number, notes: string) => {
    setRooms(prev => {
      const updated = [...prev];
      const room = { ...updated[roomIndex] };
      const items = [...room.items];
      items[itemIndex] = { ...items[itemIndex], notes };
      room.items = items;
      updated[roomIndex] = room;
      return updated;
    });
  };

  // -----------------------------------------------------------------------
  // PDF generation
  // -----------------------------------------------------------------------

  const handleGenerate = async () => {
    if (!tenancy) {
      Alert.alert('Error', 'Tenancy data not available.');
      return;
    }

    setGenerating(true);

    try {
      const meterReadings: ConditionReportData['meterReadings'] =
        electricity || gas || water
          ? {
              ...(electricity ? { electricity } : {}),
              ...(gas ? { gas } : {}),
              ...(water ? { water } : {}),
            }
          : undefined;

      const keysProvided: ConditionReportData['keysProvided'] =
        frontDoor || backDoor || garage || mailbox
          ? {
              ...(frontDoor ? { frontDoor: parseInt(frontDoor, 10) || 0 } : {}),
              ...(backDoor ? { backDoor: parseInt(backDoor, 10) || 0 } : {}),
              ...(garage ? { garage: parseInt(garage, 10) || 0 } : {}),
              ...(mailbox ? { mailbox: parseInt(mailbox, 10) || 0 } : {}),
            }
          : undefined;

      const data: ConditionReportData = {
        propertyAddress,
        ownerName,
        tenantName,
        reportDate: new Date().toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        reportType,
        rooms,
        generalNotes: generalNotes || undefined,
        meterReadings,
        keysProvided,
      };

      const html = generateConditionReportHTML(data);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to generate condition report.',
      );
    } finally {
      setGenerating(false);
    }
  };

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.title}>Condition Report</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Report Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Type</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeOption,
                reportType === 'entry' && styles.typeOptionActive,
              ]}
              onPress={() => setReportType('entry')}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  reportType === 'entry' && styles.typeOptionTextActive,
                ]}
              >
                Entry
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeOption,
                reportType === 'exit' && styles.typeOptionActive,
              ]}
              onPress={() => setReportType('exit')}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  reportType === 'exit' && styles.typeOptionTextActive,
                ]}
              >
                Exit
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Room Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Room Conditions</Text>
          {rooms.map((room, roomIndex) => {
            const isExpanded = !!expandedRooms[roomIndex];
            return (
              <View key={roomIndex} style={styles.roomCard}>
                <TouchableOpacity
                  style={styles.roomHeader}
                  onPress={() => toggleRoom(roomIndex)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.roomName}>{room.name}</Text>
                  <View style={styles.roomHeaderRight}>
                    <Text style={styles.roomItemCount}>
                      {room.items.length} items
                    </Text>
                    <ChevronDownIcon expanded={isExpanded} />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.roomItems}>
                    {room.items.map((item, itemIndex) => (
                      <View key={itemIndex} style={styles.itemContainer}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <View style={styles.conditionRow}>
                          {CONDITION_OPTIONS.map(opt => {
                            const isSelected = item.condition === opt.value;
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                style={[
                                  styles.conditionChip,
                                  isSelected && {
                                    backgroundColor: opt.color,
                                    borderColor: opt.color,
                                  },
                                ]}
                                onPress={() =>
                                  updateItemCondition(roomIndex, itemIndex, opt.value)
                                }
                              >
                                <Text
                                  style={[
                                    styles.conditionChipText,
                                    isSelected && styles.conditionChipTextActive,
                                  ]}
                                >
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TextInput
                          style={styles.itemNotes}
                          value={item.notes}
                          onChangeText={text =>
                            updateItemNotes(roomIndex, itemIndex, text)
                          }
                          placeholder="Notes (optional)"
                          placeholderTextColor={THEME.colors.textTertiary}
                          multiline
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Meter Readings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meter Readings</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Electricity</Text>
            <TextInput
              style={styles.input}
              value={electricity}
              onChangeText={setElectricity}
              placeholder="e.g. 12345 kWh"
              placeholderTextColor={THEME.colors.textTertiary}
              keyboardType="default"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Gas</Text>
            <TextInput
              style={styles.input}
              value={gas}
              onChangeText={setGas}
              placeholder="e.g. 6789 MJ"
              placeholderTextColor={THEME.colors.textTertiary}
              keyboardType="default"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Water</Text>
            <TextInput
              style={styles.input}
              value={water}
              onChangeText={setWater}
              placeholder="e.g. 456 kL"
              placeholderTextColor={THEME.colors.textTertiary}
              keyboardType="default"
            />
          </View>
        </View>

        {/* Keys */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Keys Provided</Text>
          <View style={styles.keysGrid}>
            <View style={styles.keyItem}>
              <Text style={styles.inputLabel}>Front Door</Text>
              <TextInput
                style={styles.keyInput}
                value={frontDoor}
                onChangeText={setFrontDoor}
                placeholder="0"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.keyItem}>
              <Text style={styles.inputLabel}>Back Door</Text>
              <TextInput
                style={styles.keyInput}
                value={backDoor}
                onChangeText={setBackDoor}
                placeholder="0"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.keyItem}>
              <Text style={styles.inputLabel}>Garage</Text>
              <TextInput
                style={styles.keyInput}
                value={garage}
                onChangeText={setGarage}
                placeholder="0"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.keyItem}>
              <Text style={styles.inputLabel}>Mailbox</Text>
              <TextInput
                style={styles.keyInput}
                value={mailbox}
                onChangeText={setMailbox}
                placeholder="0"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* General Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Notes</Text>
          <TextInput
            style={styles.generalNotes}
            value={generalNotes}
            onChangeText={setGeneralNotes}
            placeholder="Any additional comments about the property condition..."
            placeholderTextColor={THEME.colors.textTertiary}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.generateButtonContent}>
              <DocumentIcon />
              <Text style={styles.generateButtonText}>Generate PDF</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  title: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 40,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },

  // Report type selector
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  typeOption: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: THEME.colors.brand,
  },
  typeOptionText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
  },
  typeOptionTextActive: {
    color: '#FFFFFF',
  },

  // Room cards
  roomCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  roomName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  roomHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roomItemCount: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },

  // Room items
  roomItems: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  itemName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  conditionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  conditionChipText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
  },
  conditionChipTextActive: {
    color: '#FFFFFF',
  },
  itemNotes: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minHeight: 36,
  },

  // Inputs
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },

  // Keys grid
  keysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  keyItem: {
    width: '47%' as any,
  },
  keyInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    textAlign: 'center',
  },

  // General notes
  generalNotes: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minHeight: 100,
  },

  // Footer
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  generateButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.components.button.borderRadius,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  generateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: THEME.fontSize.body + 1,
    fontWeight: THEME.fontWeight.bold,
  },
});
