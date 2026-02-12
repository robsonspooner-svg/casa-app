// Conduct Inspection - Room-by-Room Workflow
// Mission 11: Property Inspections
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, ConditionBadge } from '@casa/ui';
import { useInspection, useInspectionMutations } from '@casa/api';

export default function ConductInspection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inspection, loading, refreshInspection } = useInspection(id || null);
  const { completeInspection } = useInspectionMutations();

  if (loading || !inspection) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const completedRooms = inspection.rooms.filter(r => r.completed_at).length;
  const totalRooms = inspection.rooms.length;
  const allComplete = totalRooms > 0 && completedRooms === totalRooms;

  const handleComplete = async () => {
    if (!allComplete) {
      Alert.alert('Incomplete', 'Please complete all rooms before finishing the inspection.');
      return;
    }

    try {
      await completeInspection(id!);
      Alert.alert('Complete', 'Inspection has been completed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to complete inspection');
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
        <Text style={styles.headerTitle}>Conduct Inspection</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Property Info */}
      {inspection.property && (
        <View style={styles.propertyBanner}>
          <Text style={styles.propertyAddress}>{inspection.property.address_line_1}</Text>
          <Text style={styles.propertySuburb}>
            {inspection.property.suburb}, {inspection.property.state}
          </Text>
        </View>
      )}

      {/* Progress */}
      <View style={styles.progressSection}>
        <Text style={styles.progressText}>{completedRooms}/{totalRooms} rooms complete</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${totalRooms > 0 ? (completedRooms / totalRooms) * 100 : 0}%` },
            ]}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {inspection.rooms.map((room, index) => {
          const isComplete = !!room.completed_at;
          const roomImages = inspection.images.filter(img => img.room_id === room.id);
          const checkedItems = room.items.filter(item => item.checked_at).length;

          return (
            <TouchableOpacity
              key={room.id}
              style={[styles.roomCard, isComplete && styles.roomCardComplete]}
              onPress={() => {
                router.push({
                  pathname: '/(app)/inspections/[id]/rooms/[roomId]' as any,
                  params: { id: inspection.id, roomId: room.id },
                });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.roomRow}>
                <View style={styles.roomLeft}>
                  {isComplete ? (
                    <View style={styles.completeCircle}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                  ) : (
                    <View style={styles.pendingCircle}>
                      <Text style={styles.pendingNumber}>{index + 1}</Text>
                    </View>
                  )}
                  <View style={styles.roomInfo}>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.roomStatus}>
                      {isComplete
                        ? `${roomImages.length} photos taken`
                        : checkedItems > 0
                        ? `${checkedItems}/${room.items.length} items checked`
                        : 'Not started'}
                    </Text>
                  </View>
                </View>
                <View style={styles.roomRight}>
                  {room.overall_condition && (
                    <ConditionBadge condition={room.overall_condition} />
                  )}
                  {!isComplete && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Complete Button */}
        <View style={styles.completeSection}>
          <Button
            title="Complete Inspection"
            onPress={handleComplete}
            disabled={!allComplete}
          />
          {!allComplete && (
            <Text style={styles.completeHint}>
              Complete all rooms to finish the inspection
            </Text>
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
  propertyBanner: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  propertyAddress: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textInverse,
  },
  propertySuburb: {
    fontSize: THEME.fontSize.bodySmall,
    color: 'rgba(250,250,250,0.8)',
    marginTop: 2,
  },
  progressSection: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  progressText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
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
  content: {
    flex: 1,
    paddingHorizontal: THEME.spacing.base,
  },
  roomCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.sm,
  },
  roomCardComplete: {
    opacity: 0.8,
  },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    flex: 1,
  },
  completeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.subtle,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingNumber: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textSecondary,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  roomStatus: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
  roomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  completeSection: {
    paddingVertical: THEME.spacing.xl,
    gap: THEME.spacing.sm,
  },
  completeHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
