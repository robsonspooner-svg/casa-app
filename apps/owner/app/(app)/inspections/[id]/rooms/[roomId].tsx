// Room Inspection - Items Checklist with Condition Ratings, Photo Capture, Voice Notes
// Mission 11: Property Inspections
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { THEME } from '@casa/config';
import { Button, ConditionBadge } from '@casa/ui';
import { useInspection, useInspectionMutations } from '@casa/api';
import type { ConditionRating, InspectionItemRow, InspectionImageRow } from '@casa/api';

const CONDITION_OPTIONS: { value: ConditionRating; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: THEME.colors.success },
  { value: 'good', label: 'Good', color: '#16A34A' },
  { value: 'fair', label: 'Fair', color: THEME.colors.warning },
  { value: 'poor', label: 'Poor', color: '#EA580C' },
  { value: 'damaged', label: 'Damaged', color: THEME.colors.error },
  { value: 'missing', label: 'Missing', color: THEME.colors.error },
  { value: 'not_applicable', label: 'N/A', color: THEME.colors.textTertiary },
];

export default function RoomInspection() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId: string }>();
  const { inspection, loading, refreshInspection } = useInspection(id || null);
  const { rateItem, completeRoom, updateRoom, uploadImage } = useInspectionMutations();

  const [roomNotes, setRoomNotes] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Voice notes state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const room = inspection?.rooms.find(r => r.id === roomId);
  const roomImages = inspection?.images.filter(img => img.room_id === roomId) || [];

  useEffect(() => {
    if (room?.notes) {
      setRoomNotes(room.notes);
    }
  }, [room?.notes]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const handleRateItem = useCallback(async (item: InspectionItemRow, condition: ConditionRating) => {
    setSaving(true);
    try {
      await rateItem({
        item_id: item.id,
        condition,
        notes: selectedItemId === item.id ? itemNotes : item.notes || undefined,
      });
      setSelectedItemId(null);
      setItemNotes('');
      refreshInspection();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to rate item');
    } finally {
      setSaving(false);
    }
  }, [rateItem, refreshInspection, selectedItemId, itemNotes]);

  // Photo capture
  const handleTakePhoto = useCallback(async (itemId?: string) => {
    if (!id || !roomId) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take inspection photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploading(true);
      try {
        const fileName = `photo_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        await uploadImage(id, asset.uri, fileName, mimeType, roomId, itemId || null);
        refreshInspection();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload photo');
      } finally {
        setUploading(false);
      }
    }
  }, [id, roomId, uploadImage, refreshInspection]);

  const handlePickPhoto = useCallback(async (itemId?: string) => {
    if (!id || !roomId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });

    if (!result.canceled && result.assets.length > 0) {
      setUploading(true);
      try {
        for (const asset of result.assets) {
          const fileName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
          const mimeType = asset.mimeType || 'image/jpeg';
          await uploadImage(id, asset.uri, fileName, mimeType, roomId, itemId || null);
        }
        refreshInspection();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload photos');
      } finally {
        setUploading(false);
      }
    }
  }, [id, roomId, uploadImage, refreshInspection]);

  const showPhotoOptions = useCallback((itemId?: string) => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: () => handleTakePhoto(itemId) },
      { text: 'Photo Library', onPress: () => handlePickPhoto(itemId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handleTakePhoto, handlePickPhoto]);

  // Voice note recording
  const handleStartRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Microphone permission is needed for voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording.');
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    if (!recordingRef.current || !id) return;

    try {
      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setRecording(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (uri) {
        setUploading(true);
        const fileName = `voice_${Date.now()}.m4a`;
        await uploadImage(id, uri, fileName, 'audio/m4a', roomId || null);
        refreshInspection();
        setUploading(false);
      }
    } catch (err) {
      setUploading(false);
      Alert.alert('Error', 'Failed to save voice note.');
    }
  }, [id, roomId, uploadImage, refreshInspection]);

  const handleCompleteRoom = async () => {
    if (!roomId) return;

    // Check all items are rated
    const unchecked = room?.items.filter(i => !i.checked_at) || [];
    if (unchecked.length > 0) {
      Alert.alert('Incomplete', `${unchecked.length} item(s) still need to be rated.`);
      return;
    }

    setSaving(true);
    try {
      // Save room notes
      if (roomNotes !== (room?.notes || '')) {
        await updateRoom(roomId, { notes: roomNotes || null });
      }

      // Determine overall condition from items
      const conditions = room?.items
        .map(i => i.condition)
        .filter((c): c is ConditionRating => c !== null) || [];

      let overallCondition: ConditionRating | undefined;
      if (conditions.length > 0) {
        const conditionOrder: ConditionRating[] = ['excellent', 'good', 'fair', 'poor', 'damaged', 'missing'];
        const worstIndex = Math.max(...conditions.map(c => {
          const idx = conditionOrder.indexOf(c);
          return idx >= 0 ? idx : 0;
        }));
        overallCondition = conditionOrder[worstIndex];
      }

      await completeRoom(roomId, overallCondition);
      refreshInspection();
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to complete room');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !inspection || !room) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const checkedCount = room.items.filter(i => i.checked_at).length;

  // Group images by item
  const getItemImages = (itemId: string): InspectionImageRow[] =>
    roomImages.filter(img => img.item_id === itemId);
  const roomOnlyImages = roomImages.filter(img => !img.item_id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{room.name}</Text>
          <Text style={styles.headerSubtitle}>
            {checkedCount}/{room.items.length} items · {roomImages.length} photos
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => showPhotoOptions()}
          style={styles.cameraButton}
          disabled={uploading}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.brand} strokeWidth={1.5} />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Upload indicator */}
      {uploading && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.uploadText}>Uploading...</Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Room Photos */}
        {roomOnlyImages.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionTitle}>Room Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {roomOnlyImages.map(img => (
                <Image key={img.id} source={{ uri: img.url }} style={styles.photoThumb} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Items Checklist */}
        {room.items.map(item => {
          const isExpanded = selectedItemId === item.id;
          const itemImages = getItemImages(item.id);

          return (
            <View key={item.id} style={styles.itemCard}>
              <TouchableOpacity
                style={styles.itemHeader}
                onPress={() => {
                  setSelectedItemId(isExpanded ? null : item.id);
                  setItemNotes(item.notes || '');
                }}
              >
                <View style={styles.itemLeft}>
                  {item.checked_at ? (
                    <View style={styles.checkedIcon}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path d="M20 6L9 17l-5-5" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                  ) : (
                    <View style={styles.uncheckedIcon} />
                  )}
                  <View style={styles.itemNameArea}>
                    <Text style={[styles.itemName, item.checked_at && styles.itemNameChecked]}>
                      {item.name}
                    </Text>
                    {itemImages.length > 0 && (
                      <Text style={styles.photoCount}>{itemImages.length} photo{itemImages.length !== 1 ? 's' : ''}</Text>
                    )}
                  </View>
                </View>
                {item.condition && (
                  <ConditionBadge condition={item.condition} />
                )}
              </TouchableOpacity>

              {/* Item photos thumbnail row */}
              {itemImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemPhotoRow}>
                  {itemImages.map(img => (
                    <Image key={img.id} source={{ uri: img.url }} style={styles.itemPhotoThumb} />
                  ))}
                </ScrollView>
              )}

              {/* Entry condition comparison for exit inspections */}
              {item.entry_condition && (
                <View style={styles.entryConditionRow}>
                  <Text style={styles.entryLabel}>Entry:</Text>
                  <ConditionBadge condition={item.entry_condition} />
                  {item.condition_changed && (
                    <Text style={styles.changedText}>Changed</Text>
                  )}
                </View>
              )}

              {/* Expanded: condition rating picker + photo button */}
              {isExpanded && (
                <View style={styles.ratingSection}>
                  <Text style={styles.ratingLabel}>Condition</Text>
                  <View style={styles.ratingGrid}>
                    {CONDITION_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.ratingChip,
                          item.condition === opt.value && { backgroundColor: opt.color, borderColor: opt.color },
                        ]}
                        onPress={() => handleRateItem(item, opt.value)}
                        disabled={saving}
                      >
                        <Text style={[
                          styles.ratingChipText,
                          item.condition === opt.value && { color: '#FFFFFF' },
                        ]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Photo button for this item */}
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={() => showPhotoOptions(item.id)}
                    disabled={uploading}
                  >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.brand} strokeWidth={1.5} />
                    </Svg>
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </TouchableOpacity>

                  {/* Item notes */}
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Notes for this item..."
                    value={itemNotes}
                    onChangeText={setItemNotes}
                    multiline
                    placeholderTextColor={THEME.colors.textTertiary}
                  />
                </View>
              )}
            </View>
          );
        })}

        {/* Voice Note */}
        <View style={styles.voiceSection}>
          <Text style={styles.sectionTitle}>Voice Note</Text>
          <TouchableOpacity
            style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={uploading}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              {isRecording ? (
                <Path d="M6 6h12v12H6z" fill={THEME.colors.error} />
              ) : (
                <>
                  <Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke={THEME.colors.brand} strokeWidth={1.5} />
                  <Path d="M19 10v2a7 7 0 01-14 0v-2" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" />
                  <Path d="M12 19v4M8 23h8" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" />
                </>
              )}
            </Svg>
            <Text style={[styles.voiceButtonText, isRecording && styles.voiceButtonTextRecording]}>
              {isRecording ? 'Stop Recording' : 'Record Voice Note'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Room Notes */}
        <View style={styles.roomNotesSection}>
          <Text style={styles.sectionTitle}>Room Notes</Text>
          <TextInput
            style={styles.roomNotesInput}
            placeholder="General notes about this room..."
            value={roomNotes}
            onChangeText={setRoomNotes}
            multiline
            placeholderTextColor={THEME.colors.textTertiary}
          />
        </View>

        {/* Complete Room */}
        <View style={styles.completeSection}>
          <Button
            title={saving ? 'Saving...' : 'Complete Room'}
            onPress={handleCompleteRoom}
            disabled={saving || uploading}
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
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
  },
  cameraButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.brand,
    paddingVertical: THEME.spacing.xs,
  },
  uploadText: {
    fontSize: THEME.fontSize.caption,
    color: '#FFFFFF',
    fontWeight: THEME.fontWeight.medium as any,
  },
  content: {
    flex: 1,
    paddingHorizontal: THEME.spacing.base,
  },
  photoSection: {
    marginBottom: THEME.spacing.md,
  },
  photoSectionTitle: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: THEME.radius.md,
    marginRight: THEME.spacing.sm,
    backgroundColor: THEME.colors.subtle,
  },
  itemCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    flex: 1,
  },
  itemNameArea: {
    flex: 1,
  },
  checkedIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckedIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  itemName: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  itemNameChecked: {
    color: THEME.colors.textSecondary,
  },
  photoCount: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: 1,
  },
  itemPhotoRow: {
    flexDirection: 'row',
    marginTop: THEME.spacing.sm,
    marginLeft: 34,
  },
  itemPhotoThumb: {
    width: 52,
    height: 52,
    borderRadius: THEME.radius.sm,
    marginRight: THEME.spacing.xs,
    backgroundColor: THEME.colors.subtle,
  },
  entryConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
    marginLeft: 34,
  },
  entryLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  changedText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.warning,
  },
  ratingSection: {
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  ratingLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  ratingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  ratingChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.full,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  ratingChipText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
  },
  addPhotoText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.brand,
  },
  notesInput: {
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginTop: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  voiceSection: {
    marginTop: THEME.spacing.lg,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  voiceButtonRecording: {
    borderColor: THEME.colors.error,
    backgroundColor: THEME.colors.errorBg,
  },
  voiceButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.brand,
  },
  voiceButtonTextRecording: {
    color: THEME.colors.error,
  },
  roomNotesSection: {
    marginTop: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  roomNotesInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  completeSection: {
    paddingVertical: THEME.spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
