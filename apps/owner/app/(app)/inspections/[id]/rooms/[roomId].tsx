// Room Inspection - Items Checklist with Condition Ratings, Photo Capture, Voice Notes
// Mission 11: Property Inspections + Guided Spatial Camera Capture
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
import GuidedCameraCapture from '../../../../../components/GuidedCameraCapture';
import type { CapturedPhoto } from '../../../../../components/GuidedCameraCapture';
import RoomLayoutSketch from '../../../../../components/RoomLayoutSketch';

const CONDITION_OPTIONS: { value: ConditionRating; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: THEME.colors.success },
  { value: 'good', label: 'Good', color: THEME.colors.success },
  { value: 'fair', label: 'Fair', color: THEME.colors.warning },
  { value: 'poor', label: 'Poor', color: THEME.colors.warning },
  { value: 'damaged', label: 'Damaged', color: THEME.colors.error },
  { value: 'missing', label: 'Missing', color: THEME.colors.error },
  { value: 'not_applicable', label: 'N/A', color: THEME.colors.textTertiary },
];

export default function RoomInspection() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId: string }>();
  const { inspection, loading, refreshInspection } = useInspection(id || null);
  const { rateItem, completeRoom, updateRoom, uploadImage, analyzePhotos } = useInspectionMutations();

  const [roomNotes, setRoomNotes] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Voice notes state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Guided capture + layout sketch state
  const [showGuidedCapture, setShowGuidedCapture] = useState(false);
  const [showLayoutSketch, setShowLayoutSketch] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [roomCompleted, setRoomCompleted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Ref for scrolling to checklist after capture
  const scrollRef = useRef<ScrollView>(null);
  const checklistRef = useRef<View>(null);

  const room = inspection?.rooms.find(r => r.id === roomId);
  const roomImages = inspection?.images.filter(img => img.room_id === roomId) || [];
  const isEntryExit = inspection?.inspection_type === 'entry' || inspection?.inspection_type === 'exit';

  useEffect(() => {
    if (room?.notes) {
      setRoomNotes(room.notes);
    }
  }, [room?.notes]);

  // Auto-save room notes after 2 seconds of inactivity (prevents data loss)
  useEffect(() => {
    if (!roomId || !room) return;
    const currentNotes = room.notes || '';
    if (roomNotes === currentNotes) return; // No change
    if (roomNotes === '') return; // Don't save empty on initial load

    const timer = setTimeout(async () => {
      try {
        await updateRoom(roomId, { notes: roomNotes || null });
      } catch {
        // Silent fail — notes will be saved on room completion
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [roomNotes, roomId, room, updateRoom]);

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
      refreshInspection();

      // Auto-advance to next unchecked item
      const items = room?.items || [];
      const currentIndex = items.findIndex(i => i.id === item.id);
      const nextUnchecked = items.find((i, idx) => idx > currentIndex && !i.checked_at && i.id !== item.id);
      if (nextUnchecked) {
        setSelectedItemId(nextUnchecked.id);
        setItemNotes(nextUnchecked.notes || '');
      } else {
        setSelectedItemId(null);
        setItemNotes('');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to rate item');
    } finally {
      setSaving(false);
    }
  }, [rateItem, refreshInspection, selectedItemId, itemNotes, room?.items]);

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
      let uploaded = 0;
      try {
        for (const asset of result.assets) {
          const fileName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
          const mimeType = asset.mimeType || 'image/jpeg';
          await uploadImage(id, asset.uri, fileName, mimeType, roomId, itemId || null);
          uploaded++;
        }
        refreshInspection();
      } catch (err) {
        refreshInspection();
        const total = result.assets.length;
        if (uploaded > 0) {
          Alert.alert('Partial Upload', `${uploaded} of ${total} photos uploaded. ${err instanceof Error ? err.message : 'Some uploads failed.'}`);
        } else {
          Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload photos');
        }
      } finally {
        setUploading(false);
      }
    }
  }, [id, roomId, uploadImage, refreshInspection]);

  const showPhotoOptions = useCallback((itemId?: string) => {
    if (isEntryExit && !itemId) {
      // For entry/exit inspections, default to guided capture for room-level photos
      Alert.alert('Add Photos', 'Choose how to capture', [
        { text: 'Guided Capture', onPress: () => setShowGuidedCapture(true) },
        { text: 'Quick Camera', onPress: () => handleTakePhoto(itemId) },
        { text: 'Photo Library', onPress: () => handlePickPhoto(itemId) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Add Photo', 'Choose a source', [
        { text: 'Camera', onPress: () => handleTakePhoto(itemId) },
        { text: 'Photo Library', onPress: () => handlePickPhoto(itemId) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [handleTakePhoto, handlePickPhoto, isEntryExit]);

  // Immediate upload for each photo during guided capture (prevents data loss)
  const handlePhotoTaken = useCallback(async (photo: CapturedPhoto) => {
    if (!id || !roomId) return;
    await uploadImage(
      id,
      photo.uri,
      photo.fileName,
      photo.mimeType,
      roomId,
      null,
      null, // caption
      photo.compassBearing,
      photo.devicePitch,
      photo.deviceRoll,
      photo.captureSequence,
      photo.isWideShot,
      photo.isCloseup,
    );
  }, [id, roomId, uploadImage]);

  // Guided capture complete handler — only upload photos not already saved
  const handleGuidedCaptureComplete = useCallback(async (photos: CapturedPhoto[]) => {
    if (!id || !roomId) return;
    setShowGuidedCapture(false);
    const unsaved = photos.filter(p => !p.saved);
    if (unsaved.length > 0) {
      setUploading(true);
      try {
        for (const photo of unsaved) {
          await uploadImage(
            id,
            photo.uri,
            photo.fileName,
            photo.mimeType,
            roomId,
            null,
            null,
            photo.compassBearing,
            photo.devicePitch,
            photo.deviceRoll,
            photo.captureSequence,
            photo.isWideShot,
            photo.isCloseup,
          );
        }
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload some photos');
      } finally {
        setUploading(false);
      }
    }
    refreshInspection();
    // Auto-expand first unchecked item to guide user through checklist
    const firstUnchecked = room?.items.find(i => !i.checked_at);
    if (firstUnchecked) {
      setSelectedItemId(firstUnchecked.id);
      setItemNotes(firstUnchecked.notes || '');
    }
    // Scroll to checklist area after a brief delay
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 300, animated: true });
    }, 300);
    // Trigger AI auto-tagging in background (non-blocking)
    if (id) {
      setAnalyzing(true);
      analyzePhotos(id).then(() => {
        refreshInspection();
      }).catch(() => {
        // AI tagging is non-critical, silent fail
      }).finally(() => {
        setAnalyzing(false);
      });
    }
  }, [id, roomId, uploadImage, refreshInspection, room?.items, analyzePhotos]);

  // Layout sketch save handler
  const handleSaveLayout = useCallback(async (imageData: string, pathData: string) => {
    if (!roomId) return;
    setSavingLayout(true);
    try {
      // Upload sketch image to storage
      const response = await fetch(imageData);
      const blob = await response.blob();
      const { getSupabaseClient } = await import('@casa/api');
      const supabase = getSupabaseClient();
      const storagePath = `layouts/${id}/${roomId}_${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('inspection-images')
        .upload(storagePath, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('inspection-images')
        .getPublicUrl(storagePath);

      // Update room with sketch URL and path data
      await updateRoom(roomId, {
        layout_sketch_url: urlData.publicUrl,
        layout_sketch_data: JSON.parse(pathData),
      } as any);

      setShowLayoutSketch(false);
      refreshInspection();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save layout');
    } finally {
      setSavingLayout(false);
    }
  }, [id, roomId, updateRoom, refreshInspection]);

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

      if (uri && (uri.startsWith('file://') || uri.startsWith('content://'))) {
        setUploading(true);
        try {
          const fileName = `voice_${Date.now()}.m4a`;
          await uploadImage(id, uri, fileName, 'audio/m4a', roomId || null);
          refreshInspection();
        } finally {
          setUploading(false);
        }
      } else if (uri) {
        Alert.alert('Error', 'Voice recording produced an invalid file.');
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
      setRoomCompleted(true);
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
          <ActivityIndicator size="small" color={THEME.colors.textInverse} />
          <Text style={styles.uploadText}>Uploading...</Text>
        </View>
      )}

      {/* AI analysis indicator */}
      {analyzing && !uploading && (
        <View style={styles.analyzingBanner}>
          <ActivityIndicator size="small" color={THEME.colors.brand} />
          <Text style={styles.analyzingText}>Casa Agent is tagging your photos...</Text>
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Room Layout Sketch */}
        {isEntryExit && (
          <View style={styles.layoutSection}>
            {room.layout_sketch_url ? (
              <TouchableOpacity
                style={styles.layoutPreview}
                onPress={() => setShowLayoutSketch(true)}
              >
                <Image source={{ uri: room.layout_sketch_url }} style={styles.layoutImage} resizeMode="contain" />
                <Text style={styles.layoutEditText}>Edit Layout</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.layoutButton}
                onPress={() => setShowLayoutSketch(true)}
              >
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 3h18v18H3V3z" stroke={THEME.colors.brand} strokeWidth={1.5} />
                  <Path d="M3 9h18M9 3v18" stroke={THEME.colors.brand} strokeWidth={1} strokeDasharray="3 3" />
                </Svg>
                <Text style={styles.layoutButtonText}>Draw Room Layout</Text>
                <Text style={styles.layoutHint}>Sketch walls, doors and windows</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Guided Capture Banner (entry/exit only) */}
        {isEntryExit && roomOnlyImages.length === 0 && (
          <TouchableOpacity
            style={styles.guidedBanner}
            onPress={() => setShowGuidedCapture(true)}
            activeOpacity={0.8}
          >
            <View style={styles.guidedBannerIcon}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={THEME.colors.textInverse} strokeWidth={1.5} />
                <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.textInverse} strokeWidth={1.5} />
              </Svg>
            </View>
            <View style={styles.guidedBannerText}>
              <Text style={styles.guidedBannerTitle}>Start 360° Room Scan</Text>
              <Text style={styles.guidedBannerSub}>Rotate and capture every direction with compass tagging</Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}

        {/* Room Photos */}
        {roomOnlyImages.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionTitle}>Room Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {roomOnlyImages.map(img => (
                <View key={img.id} style={styles.photoThumbContainer}>
                  <Image source={{ uri: img.url }} style={styles.photoThumb} />
                  {img.caption && (
                    <Text style={styles.photoCaption} numberOfLines={2}>{img.caption}</Text>
                  )}
                </View>
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
                        <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
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
                          item.condition === opt.value && { color: THEME.colors.textInverse },
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

        {/* Complete Room / Next Room */}
        <View style={styles.completeSection}>
          {roomCompleted ? (
            <>
              <View style={styles.completedBanner}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.completedText}>Room Complete</Text>
              </View>
              {(() => {
                // Find next incomplete room
                const rooms = inspection?.rooms || [];
                const currentIdx = rooms.findIndex(r => r.id === roomId);
                const nextRoom = rooms.find((r, i) => i > currentIdx && !r.completed_at);
                if (nextRoom) {
                  return (
                    <Button
                      title={`Next: ${nextRoom.name}`}
                      onPress={() => {
                        router.replace({
                          pathname: '/(app)/inspections/[id]/rooms/[roomId]' as any,
                          params: { id: inspection!.id, roomId: nextRoom.id },
                        });
                      }}
                    />
                  );
                }
                return (
                  <Button
                    title="All Rooms Done — Back to Inspection"
                    onPress={() => router.back()}
                  />
                );
              })()}
              <Button title="Back to Rooms" onPress={() => router.back()} variant="text" />
            </>
          ) : (
            <Button
              title={saving ? 'Saving...' : 'Complete Room'}
              onPress={handleCompleteRoom}
              disabled={saving || uploading}
            />
          )}
        </View>
      </ScrollView>

      {/* Guided Camera Capture Modal */}
      <GuidedCameraCapture
        visible={showGuidedCapture}
        onClose={() => setShowGuidedCapture(false)}
        onComplete={handleGuidedCaptureComplete}
        onPhotoTaken={handlePhotoTaken}
        roomName={room.name}
        isEntryExit={isEntryExit}
      />

      {/* Room Layout Sketch Modal */}
      <RoomLayoutSketch
        visible={showLayoutSketch}
        onClose={() => setShowLayoutSketch(false)}
        onSave={handleSaveLayout}
        saving={savingLayout}
        existingPathData={room.layout_sketch_data ? (() => { try { return JSON.stringify(room.layout_sketch_data); } catch { return null; } })() : null}
      />
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
    color: THEME.colors.textInverse,
    fontWeight: THEME.fontWeight.medium as any,
  },
  analyzingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.brand + '20',
    paddingVertical: THEME.spacing.xs,
  },
  analyzingText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.brand,
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
  photoThumbContainer: {
    marginRight: THEME.spacing.sm,
    width: 88,
  },
  photoThumb: {
    width: 88,
    height: 72,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.subtle,
  },
  photoCaption: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    lineHeight: 13,
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
    gap: THEME.spacing.md,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.successBg,
    borderRadius: THEME.radius.md,
    paddingVertical: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  completedText: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.success,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  layoutSection: {
    marginBottom: THEME.spacing.md,
  },
  layoutButton: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    alignItems: 'center',
    gap: THEME.spacing.xs,
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
    borderStyle: 'dashed',
  },
  layoutButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.brand,
  },
  layoutHint: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  layoutPreview: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  layoutImage: {
    width: '100%',
    height: 150,
    backgroundColor: THEME.colors.subtle,
  },
  layoutEditText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.brand,
    textAlign: 'center',
    paddingVertical: THEME.spacing.sm,
  },
  guidedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    gap: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    ...THEME.shadow.sm,
  },
  guidedBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidedBannerText: {
    flex: 1,
  },
  guidedBannerTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  guidedBannerSub: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
});
