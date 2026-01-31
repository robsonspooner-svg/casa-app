// Schedule Inspection - Owner View
// Mission 11: Property Inspections (Phase K: Outsourcing UX)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, Input, DatePicker } from '@casa/ui';
import {
  useInspectionMutations,
  useInspectionTemplates,
  useProperties,
  useTenancies,
  useProfile,
  useFeatureGate,
  PROFESSIONAL_INSPECTION_PRICING,
} from '@casa/api';
import type { InspectionType, OutsourceMode } from '@casa/api';

const INSPECTION_TYPES: { value: InspectionType; label: string; description: string }[] = [
  { value: 'routine', label: 'Routine', description: 'Regular property condition check' },
  { value: 'entry', label: 'Entry', description: 'Move-in condition report' },
  { value: 'exit', label: 'Exit', description: 'Move-out condition report' },
  { value: 'pre_listing', label: 'Pre-Listing', description: 'Before listing for rent' },
  { value: 'maintenance', label: 'Maintenance', description: 'After major maintenance work' },
  { value: 'complaint', label: 'Complaint', description: 'Following tenant complaint' },
];

export default function ScheduleInspection() {
  const [selectedType, setSelectedType] = useState<InspectionType>('routine');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTenancyId, setSelectedTenancyId] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [outsourceMode, setOutsourceMode] = useState<OutsourceMode>('self');
  const [submitting, setSubmitting] = useState(false);

  const { scheduleInspection, addRoomsFromTemplate } = useInspectionMutations();
  const { defaultTemplate } = useInspectionTemplates();
  const { properties } = useProperties();
  const { tenancies } = useTenancies(selectedPropertyId ? { propertyId: selectedPropertyId } : undefined);
  const { profile } = useProfile();
  const { hasAccess: hasProAccess } = useFeatureGate(profile, 'tenantFinding');

  const activeTenancy = tenancies.find(t => t.status === 'active');

  const handleSchedule = async () => {
    if (!selectedPropertyId) {
      Alert.alert('Required', 'Please select a property.');
      return;
    }

    setSubmitting(true);
    try {
      const inspectionId = await scheduleInspection({
        property_id: selectedPropertyId,
        inspection_type: selectedType,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        tenancy_id: selectedTenancyId || activeTenancy?.id || null,
        scheduled_time: scheduledTime || null,
        is_outsourced: outsourceMode !== 'self',
        outsource_mode: outsourceMode,
      });

      if (!inspectionId) {
        Alert.alert('Error', 'Failed to schedule inspection.');
        return;
      }

      // Add rooms from default template
      if (defaultTemplate) {
        await addRoomsFromTemplate(
          inspectionId,
          defaultTemplate.rooms.map(r => ({
            name: r.name,
            display_order: r.display_order,
            items: r.items,
          }))
        );
      }

      if (outsourceMode === 'self') {
        Alert.alert('Scheduled', 'Inspection has been scheduled. You can begin conducting it on the scheduled date.', [
          { text: 'View', onPress: () => router.replace({ pathname: '/(app)/inspections/[id]' as any, params: { id: inspectionId } }) },
          { text: 'Done', onPress: () => router.back() },
        ]);
      } else if (outsourceMode === 'professional') {
        Alert.alert(
          'Professional Inspection Requested',
          'Casa will find and book a local inspector for your property. You\'ll be notified once it\'s confirmed.',
          [
            { text: 'View', onPress: () => router.replace({ pathname: '/(app)/inspections/[id]' as any, params: { id: inspectionId } }) },
            { text: 'Done', onPress: () => router.back() },
          ]
        );
      } else {
        Alert.alert(
          'Auto-Managed',
          'Casa will handle everything — scheduling, booking the inspector, and coordinating with your tenant. You\'ll receive the report when it\'s complete.',
          [{ text: 'Done', onPress: () => router.back() }]
        );
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to schedule inspection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Inspection</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Property Selection */}
        <Text style={styles.sectionTitle}>Property</Text>
        <View style={styles.optionsGrid}>
          {properties.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.optionCard, selectedPropertyId === p.id && styles.optionCardSelected]}
              onPress={() => setSelectedPropertyId(p.id)}
            >
              <Text style={[styles.optionLabel, selectedPropertyId === p.id && styles.optionLabelSelected]} numberOfLines={2}>
                {p.address_line_1}
              </Text>
              <Text style={styles.optionSubtext} numberOfLines={1}>
                {p.suburb}, {p.state}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inspection Type */}
        <Text style={styles.sectionTitle}>Type</Text>
        <View style={styles.typeGrid}>
          {INSPECTION_TYPES.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeCard, selectedType === t.value && styles.typeCardSelected]}
              onPress={() => setSelectedType(t.value)}
            >
              <Text style={[styles.typeLabel, selectedType === t.value && styles.typeLabelSelected]}>
                {t.label}
              </Text>
              <Text style={[styles.typeDescription, selectedType === t.value && styles.typeDescriptionSelected]} numberOfLines={2}>
                {t.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Outsourcing Mode (Phase K) */}
        <Text style={styles.sectionTitle}>How would you like to handle this?</Text>
        <View style={styles.outsourceOptions}>
          {/* Self-service */}
          <TouchableOpacity
            style={[styles.outsourceCard, outsourceMode === 'self' && styles.outsourceCardSelected]}
            onPress={() => setOutsourceMode('self')}
          >
            <View style={styles.outsourceHeader}>
              <View style={styles.outsourceIconWrap}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={outsourceMode === 'self' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M9 22V12h6v10" stroke={outsourceMode === 'self' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={styles.outsourceRadio}>
                {outsourceMode === 'self' && <View style={styles.outsourceRadioInner} />}
              </View>
            </View>
            <Text style={[styles.outsourceTitle, outsourceMode === 'self' && styles.outsourceTitleSelected]}>
              I'll do it myself
            </Text>
            <Text style={styles.outsourceDesc}>
              Use the room-by-room guide to document everything with your phone.
            </Text>
            <Text style={styles.outsourcePricing}>Free</Text>
          </TouchableOpacity>

          {/* Professional */}
          <TouchableOpacity
            style={[styles.outsourceCard, outsourceMode === 'professional' && styles.outsourceCardSelected]}
            onPress={() => setOutsourceMode('professional')}
          >
            <View style={styles.outsourceHeader}>
              <View style={styles.outsourceIconWrap}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={outsourceMode === 'professional' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={7} r={4} stroke={outsourceMode === 'professional' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} />
                </Svg>
              </View>
              <View style={styles.outsourceRadio}>
                {outsourceMode === 'professional' && <View style={styles.outsourceRadioInner} />}
              </View>
            </View>
            <Text style={[styles.outsourceTitle, outsourceMode === 'professional' && styles.outsourceTitleSelected]}>
              Get a professional
            </Text>
            <Text style={styles.outsourceDesc}>
              Casa finds and books a local inspector. They handle everything and submit the report directly to your app.
            </Text>
            <Text style={styles.outsourcePricing}>
              {hasProAccess ? 'Included in your plan' : `$${PROFESSIONAL_INSPECTION_PRICING.starterAddOnPrice} one-off`}
            </Text>
          </TouchableOpacity>

          {/* Auto-managed (Pro+ only) */}
          <TouchableOpacity
            style={[
              styles.outsourceCard,
              outsourceMode === 'auto_managed' && styles.outsourceCardSelected,
              !hasProAccess && styles.outsourceCardDisabled,
            ]}
            onPress={() => {
              if (hasProAccess) {
                setOutsourceMode('auto_managed');
              } else {
                Alert.alert('Pro Plan Required', 'Auto-managed inspections are available on the Pro and Hands-Off plans.');
              }
            }}
          >
            <View style={styles.outsourceHeader}>
              <View style={styles.outsourceIconWrap}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={outsourceMode === 'auto_managed' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={styles.outsourceRadio}>
                {outsourceMode === 'auto_managed' && <View style={styles.outsourceRadioInner} />}
              </View>
            </View>
            <Text style={[styles.outsourceTitle, outsourceMode === 'auto_managed' && styles.outsourceTitleSelected]}>
              Let Casa handle it
            </Text>
            <Text style={styles.outsourceDesc}>
              Casa will automatically schedule and coordinate the inspection. You'll get the report when it's done.
            </Text>
            <Text style={styles.outsourcePricing}>
              {hasProAccess ? 'Included in your plan' : 'Pro plan required'}
            </Text>
            {!hasProAccess && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Date (only for self and professional modes) */}
        {outsourceMode !== 'auto_managed' && (
          <>
            <Text style={styles.sectionTitle}>Date</Text>
            <DatePicker
              value={scheduledDate}
              onChange={setScheduledDate}
              minimumDate={new Date()}
            />

            <Text style={styles.sectionTitle}>Time</Text>
            <Input
              value={scheduledTime}
              onChangeText={setScheduledTime}
              placeholder="e.g., 10:00"
            />
          </>
        )}

        {/* Template info */}
        {defaultTemplate && outsourceMode === 'self' && (
          <View style={styles.templateInfo}>
            <Text style={styles.templateTitle}>Template: {defaultTemplate.name}</Text>
            <Text style={styles.templateRooms}>
              {defaultTemplate.rooms.length} rooms will be added automatically
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title={
              submitting
                ? 'Scheduling...'
                : outsourceMode === 'self'
                ? 'Schedule Inspection'
                : outsourceMode === 'professional'
                ? 'Request Professional Inspection'
                : 'Auto-Manage Inspection'
            }
            onPress={handleSchedule}
            disabled={submitting || !selectedPropertyId}
          />
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
  content: {
    flex: 1,
    paddingHorizontal: THEME.spacing.base,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  optionsGrid: {
    gap: THEME.spacing.sm,
  },
  optionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  optionCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: '#F0EDFF',
  },
  optionLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
  },
  optionLabelSelected: {
    color: THEME.colors.brand,
  },
  optionSubtext: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  typeCard: {
    width: '48%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  typeCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: '#F0EDFF',
  },
  typeLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  typeLabelSelected: {
    color: THEME.colors.brand,
  },
  typeDescription: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
  },
  typeDescriptionSelected: {
    color: THEME.colors.brand,
  },
  outsourceOptions: {
    gap: THEME.spacing.md,
  },
  outsourceCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  outsourceCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: '#F0EDFF',
  },
  outsourceCardDisabled: {
    opacity: 0.6,
  },
  outsourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  outsourceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outsourceRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outsourceRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.colors.brand,
  },
  outsourceTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  outsourceTitleSelected: {
    color: THEME.colors.brand,
  },
  outsourceDesc: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.sm,
  },
  outsourcePricing: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.success,
  },
  proBadge: {
    position: 'absolute',
    top: THEME.spacing.sm,
    right: THEME.spacing.sm,
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: THEME.fontWeight.bold as any,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  templateInfo: {
    backgroundColor: THEME.colors.infoBg,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.lg,
  },
  templateTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.info,
  },
  templateRooms: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.info,
    marginTop: 2,
  },
  buttonContainer: {
    paddingVertical: THEME.spacing.xl,
  },
});
