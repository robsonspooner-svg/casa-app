// Guided Camera Capture — 360° Room Scan + Close-up Detail Capture
// Phase 1: User rotates in room center, capturing photos at compass intervals
// Phase 2: Close-up photos of damage or notable features
// All photos auto-tagged with compass bearing, pitch, roll, and sequence

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Magnetometer, Accelerometer } from 'expo-sensors';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { THEME } from '@casa/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface CapturedPhoto {
  uri: string;
  fileName: string;
  mimeType: string;
  compassBearing: number | null;
  devicePitch: number | null;
  deviceRoll: number | null;
  captureSequence: number;
  isWideShot: boolean;
  isCloseup: boolean;
  saved?: boolean; // true once uploaded to Supabase
}

interface GuidedCameraCaptureProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (photos: CapturedPhoto[]) => void;
  onPhotoTaken?: (photo: CapturedPhoto) => Promise<void>; // immediate upload callback
  roomName: string;
  isEntryExit: boolean;
}

type CaptureStep = 'intro' | 'scan' | 'closeups' | 'review';

// How many degrees each captured photo "covers" on the ring
const COVERAGE_ARC = 45;
// Minimum coverage (number of distinct 45° sectors) to consider scan complete
const MIN_SECTORS = 6;
const TOTAL_SECTORS = 8;

// Ring drawing constants
const RING_SIZE = 200;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const CARDINAL_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function getSectorIndex(bearing: number): number {
  return Math.floor(((bearing + 22.5) % 360) / 45);
}

function getCardinalDirection(bearing: number): string {
  return CARDINAL_LABELS[getSectorIndex(bearing)];
}

export default function GuidedCameraCapture({
  visible,
  onClose,
  onComplete,
  onPhotoTaken,
  roomName,
  isEntryExit,
}: GuidedCameraCaptureProps) {
  const [step, setStep] = useState<CaptureStep>('intro');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [sequenceCounter, setSequenceCounter] = useState(0);
  const [sensorsAvailable, setSensorsAvailable] = useState<boolean | null>(null);
  const [currentBearing, setCurrentBearing] = useState<number | null>(null);

  // Track which 45° sectors have been photographed
  const [coveredSectors, setCoveredSectors] = useState<Set<number>>(new Set());

  // Sensor refs
  const bearingRef = useRef<number | null>(null);
  const pitchRef = useRef<number | null>(null);
  const rollRef = useRef<number | null>(null);
  const magSubRef = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);
  const accelSubRef = useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);

  // Animated pulse for capture button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const startSensors = async () => {
      try {
        const [magAvail, accelAvail] = await Promise.all([
          Magnetometer.isAvailableAsync(),
          Accelerometer.isAvailableAsync(),
        ]);

        if (cancelled) return;
        setSensorsAvailable(magAvail || accelAvail);

        if (magAvail) {
          Magnetometer.setUpdateInterval(150);
          magSubRef.current = Magnetometer.addListener((data: { x: number; y: number; z: number }) => {
            const { x, y } = data;
            let angle = Math.atan2(y, x) * (180 / Math.PI);
            if (Platform.OS === 'ios') {
              angle = angle >= 0 ? angle : angle + 360;
            } else {
              angle = (angle + 360) % 360;
            }
            const rounded = Math.round(angle);
            bearingRef.current = rounded;
            setCurrentBearing(rounded);
          });
        }

        if (accelAvail) {
          Accelerometer.setUpdateInterval(200);
          accelSubRef.current = Accelerometer.addListener((data: { x: number; y: number; z: number }) => {
            const { x, y, z } = data;
            pitchRef.current = Math.round(Math.atan2(y, Math.sqrt(x * x + z * z)) * (180 / Math.PI));
            rollRef.current = Math.round(Math.atan2(-x, z) * (180 / Math.PI));
          });
        }
      } catch {
        if (!cancelled) setSensorsAvailable(false);
      }
    };

    startSensors();

    return () => {
      cancelled = true;
      magSubRef.current?.remove();
      accelSubRef.current?.remove();
      magSubRef.current = null;
      accelSubRef.current = null;
    };
  }, [visible]);

  // Reset state when opened
  useEffect(() => {
    if (visible) {
      setStep('intro');
      setPhotos([]);
      setSequenceCounter(0);
      setCoveredSectors(new Set());
      setCurrentBearing(null);
    }
  }, [visible]);

  // Pulse animation for capture button during scan
  useEffect(() => {
    if (step === 'scan') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [step, pulseAnim]);

  const takePhoto = useCallback(async (isWide: boolean, isClose: boolean): Promise<CapturedPhoto | null> => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false,
        exif: true,
      });

      if (result.canceled || !result.assets?.[0]) return null;

      const asset = result.assets[0];
      const seq = sequenceCounter + 1;
      setSequenceCounter(seq);

      const photo: CapturedPhoto = {
        uri: asset.uri,
        fileName: asset.fileName || `capture_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        compassBearing: bearingRef.current,
        devicePitch: pitchRef.current,
        deviceRoll: rollRef.current,
        captureSequence: seq,
        isWideShot: isWide,
        isCloseup: isClose,
      };

      return photo;
    } catch {
      return null;
    }
  }, [sequenceCounter]);

  const handleStartScan = useCallback(() => {
    setStep('scan');
  }, []);

  const handleCaptureScan = useCallback(async () => {
    const photo = await takePhoto(true, false);
    if (photo) {
      setPhotos(prev => [...prev, photo]);
      // Mark sector as covered
      if (photo.compassBearing !== null) {
        const sector = getSectorIndex(photo.compassBearing);
        setCoveredSectors(prev => {
          const updated = new Set(prev);
          updated.add(sector);
          return updated;
        });
      }
      // Immediately upload to prevent data loss
      if (onPhotoTaken) {
        onPhotoTaken(photo).then(() => {
          setPhotos(prev => prev.map(p => p === photo ? { ...p, saved: true } : p));
        }).catch(() => {
          // Upload failed — photo stays in memory, will be retried on completion
        });
      }
    }
  }, [takePhoto, onPhotoTaken]);

  const handleDoneScan = useCallback(() => {
    const scanPhotos = photos.filter(p => p.isWideShot);
    if (scanPhotos.length === 0) {
      Alert.alert('No Photos', 'Take at least one photo before continuing.');
      return;
    }
    setStep('closeups');
  }, [photos]);

  const handleTakeCloseup = useCallback(async () => {
    const photo = await takePhoto(false, true);
    if (photo) {
      setPhotos(prev => [...prev, photo]);
      // Immediately upload to prevent data loss
      if (onPhotoTaken) {
        onPhotoTaken(photo).then(() => {
          setPhotos(prev => prev.map(p => p === photo ? { ...p, saved: true } : p));
        }).catch(() => {
          // Upload failed — stays in memory
        });
      }
    }
  }, [takePhoto, onPhotoTaken]);

  const handleSkipCloseups = useCallback(() => {
    setStep('review');
  }, []);

  const handleDoneCloseups = useCallback(() => {
    setStep('review');
  }, []);

  const handleFinish = useCallback(() => {
    onComplete(photos);
  }, [photos, onComplete]);

  const handleDeletePhoto = useCallback((index: number) => {
    Alert.alert('Remove Photo', 'Remove this photo from the capture?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
      }},
    ]);
  }, []);

  const handleAddMore = useCallback(async () => {
    const photo = await takePhoto(false, false);
    if (photo) {
      setPhotos(prev => [...prev, photo]);
    }
  }, [takePhoto]);

  const scanProgress = coveredSectors.size / TOTAL_SECTORS;
  const scanComplete = coveredSectors.size >= MIN_SECTORS;
  const scanPhotosCount = photos.filter(p => p.isWideShot).length;
  const closeupPhotosCount = photos.filter(p => p.isCloseup).length;

  // Sector fill data for SVG ring
  const sectorArcs = useMemo(() => {
    const arcs: { startAngle: number; endAngle: number; filled: boolean }[] = [];
    for (let i = 0; i < TOTAL_SECTORS; i++) {
      const startAngle = i * 45 - 90; // -90 to start from top (N)
      const endAngle = startAngle + 45;
      arcs.push({ startAngle, endAngle, filled: coveredSectors.has(i) });
    }
    return arcs;
  }, [coveredSectors]);

  const renderIntroStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.introSection}>
        <View style={styles.scanIllustration}>
          <View style={styles.scanCircle}>
            <Svg width={80} height={80} viewBox="0 0 24 24" fill="none">
              <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={THEME.colors.brand} strokeWidth={1.5} />
              <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.brand} strokeWidth={1.5} />
            </Svg>
          </View>
          <View style={styles.rotateArrow}>
            <Svg width={100} height={40} viewBox="0 0 100 40" fill="none">
              <Path d="M20 30 Q50 5 80 30" stroke={THEME.colors.brand} strokeWidth={2} strokeDasharray="4 4" fill="none" />
              <Path d="M75 25 L80 30 L74 33" stroke={THEME.colors.brand} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </View>

        <Text style={styles.introTitle}>360° Room Scan</Text>
        <Text style={styles.introBody}>
          Stand in the centre of {roomName}. You'll rotate slowly capturing photos in every direction — Casa tracks your compass bearing to know exactly where each photo faces.
        </Text>

        <View style={styles.introSteps}>
          <View style={styles.introStepRow}>
            <View style={styles.introStepNum}><Text style={styles.introStepNumText}>1</Text></View>
            <Text style={styles.introStepText}>Rotate and capture wide shots around the room</Text>
          </View>
          <View style={styles.introStepRow}>
            <View style={styles.introStepNum}><Text style={styles.introStepNumText}>2</Text></View>
            <Text style={styles.introStepText}>Take close-ups of any damage or features</Text>
          </View>
          <View style={styles.introStepRow}>
            <View style={styles.introStepNum}><Text style={styles.introStepNumText}>3</Text></View>
            <Text style={styles.introStepText}>Casa Agent auto-tags and describes each photo</Text>
          </View>
        </View>

        <View style={styles.compassStatus}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M16.66 16.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke={sensorsAvailable ? THEME.colors.success : THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <Text style={[styles.compassStatusText, !sensorsAvailable && { color: THEME.colors.textTertiary }]}>
            {sensorsAvailable === false
              ? 'Compass not available — photos will be captured without bearing data'
              : sensorsAvailable === null
                ? 'Checking compass...'
                : `Compass active${currentBearing !== null ? ` — ${currentBearing}° ${getCardinalDirection(currentBearing)}` : ''}`}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleStartScan} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Start Room Scan</Text>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
    </View>
  );

  const renderScanStep = () => (
    <View style={styles.stepContent}>
      {/* Compass Ring */}
      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          {/* Background ring */}
          <SvgCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={THEME.colors.border}
            strokeWidth={RING_STROKE}
          />
          {/* Filled sectors */}
          {sectorArcs.map((arc, i) => {
            if (!arc.filled) return null;
            const startRad = (arc.startAngle * Math.PI) / 180;
            const endRad = (arc.endAngle * Math.PI) / 180;
            const cx = RING_SIZE / 2;
            const cy = RING_SIZE / 2;
            const x1 = cx + RING_RADIUS * Math.cos(startRad);
            const y1 = cy + RING_RADIUS * Math.sin(startRad);
            const x2 = cx + RING_RADIUS * Math.cos(endRad);
            const y2 = cy + RING_RADIUS * Math.sin(endRad);
            return (
              <Path
                key={i}
                d={`M ${x1} ${y1} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke={THEME.colors.brand}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>

        {/* Cardinal labels around ring */}
        {CARDINAL_LABELS.map((label, i) => {
          const angle = (i * 45 - 90) * (Math.PI / 180);
          const labelR = RING_SIZE / 2 + 18;
          const lx = RING_SIZE / 2 + labelR * Math.cos(angle) - 8;
          const ly = RING_SIZE / 2 + labelR * Math.sin(angle) - 8;
          return (
            <Text
              key={label}
              style={[
                styles.cardinalLabel,
                {
                  position: 'absolute',
                  left: lx,
                  top: ly,
                  width: 16,
                  textAlign: 'center',
                },
                coveredSectors.has(i) && { color: THEME.colors.brand, fontWeight: '700' as any },
              ]}
            >
              {label}
            </Text>
          );
        })}

        {/* Center info */}
        <View style={styles.ringCenter}>
          <Text style={styles.ringBearing}>
            {currentBearing !== null ? `${currentBearing}°` : '---'}
          </Text>
          <Text style={styles.ringDirection}>
            {currentBearing !== null ? getCardinalDirection(currentBearing) : ''}
          </Text>
          <Text style={styles.ringCount}>
            {scanPhotosCount} photo{scanPhotosCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Bearing indicator needle */}
        {currentBearing !== null && (
          <View
            style={[
              styles.bearingIndicator,
              {
                transform: [
                  { translateX: -2 },
                  { translateY: -(RING_SIZE / 2 - RING_STROKE / 2) },
                  { rotate: `${currentBearing}deg` },
                ],
              },
            ]}
          />
        )}
      </View>

      {/* Coverage info */}
      <View style={styles.coverageInfo}>
        <View style={styles.coverageBar}>
          <View style={[styles.coverageBarFill, { width: `${scanProgress * 100}%` }]} />
        </View>
        <Text style={styles.coverageText}>
          {coveredSectors.size}/{TOTAL_SECTORS} directions covered
          {scanComplete ? ' — Room scan complete!' : ''}
        </Text>
      </View>

      {/* Scan photos row */}
      {scanPhotosCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scanPhotoRow}>
          {photos.filter(p => p.isWideShot).map((p, i) => (
            <View key={i} style={styles.scanPhotoItem}>
              <Image source={{ uri: p.uri }} style={styles.scanPhotoThumb} />
              {p.compassBearing !== null && (
                <Text style={styles.scanPhotoBearing}>{p.compassBearing}°</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Capture button */}
      <Animated.View style={[styles.scanButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity style={styles.scanCaptureButton} onPress={handleCaptureScan} activeOpacity={0.8}>
          <View style={styles.scanCaptureInner}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={THEME.colors.textInverse} strokeWidth={2} />
              <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={THEME.colors.textInverse} strokeWidth={2} />
            </Svg>
          </View>
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.scanHint}>Rotate slowly and tap to capture each direction</Text>

      {/* Next button */}
      <TouchableOpacity
        style={[styles.scanNextButton, !scanComplete && scanPhotosCount > 0 && styles.scanNextButtonReady]}
        onPress={handleDoneScan}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.scanNextButtonText,
          (scanComplete || scanPhotosCount > 0) && { color: THEME.colors.brand },
        ]}>
          {scanComplete ? 'Scan Complete — Continue' : scanPhotosCount > 0 ? 'Continue to Close-ups' : 'Take at least one photo'}
        </Text>
        {(scanComplete || scanPhotosCount > 0) && (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCloseupsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.instruction}>
        <View style={styles.stepBadge}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke={THEME.colors.textInverse} strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </View>
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>Close-up Details</Text>
          <Text style={styles.instructionBody}>
            Photograph any damage, wear, stains, or notable features. These photos help Casa Agent create a detailed condition report.
          </Text>
        </View>
      </View>

      {closeupPhotosCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {photos.filter(p => p.isCloseup).map((p, i) => (
            <View key={i} style={styles.scanPhotoItem}>
              <Image source={{ uri: p.uri }} style={styles.thumbnailLarge} />
              {p.compassBearing !== null && (
                <Text style={styles.scanPhotoBearing}>{p.compassBearing}°</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={handleTakeCloseup} activeOpacity={0.8}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <Text style={styles.primaryButtonText}>Take Close-up Photo</Text>
      </TouchableOpacity>

      <View style={styles.closeupSummary}>
        <Text style={styles.closeupSummaryText}>
          {scanPhotosCount} scan photo{scanPhotosCount !== 1 ? 's' : ''} + {closeupPhotosCount} close-up{closeupPhotosCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleSkipCloseups}>
          <Text style={styles.secondaryButtonText}>{closeupPhotosCount > 0 ? 'Done' : 'Skip'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButtonSmall} onPress={handleDoneCloseups}>
          <Text style={styles.primaryButtonSmallText}>Review All Photos</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.instruction}>
        <View style={[styles.stepBadge, { backgroundColor: THEME.colors.success }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>Review Photos</Text>
          <Text style={styles.instructionBody}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''} captured for {roomName}. Tap any photo to remove it.
          </Text>
        </View>
      </View>

      <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
        {/* Scan photos section */}
        {scanPhotosCount > 0 && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Room Scan ({scanPhotosCount})</Text>
            <View style={styles.photoGrid}>
              {photos.filter(p => p.isWideShot).map((p, i) => {
                const originalIndex = photos.indexOf(p);
                return (
                  <TouchableOpacity key={i} onPress={() => handleDeletePhoto(originalIndex)} activeOpacity={0.7}>
                    <Image source={{ uri: p.uri }} style={styles.reviewPhoto} />
                    <View style={styles.photoBadge}>
                      <Text style={styles.photoBadgeText}>
                        {p.compassBearing !== null ? `${p.compassBearing}°` : `#${p.captureSequence}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Close-up photos section */}
        {closeupPhotosCount > 0 && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Close-ups ({closeupPhotosCount})</Text>
            <View style={styles.photoGrid}>
              {photos.filter(p => p.isCloseup).map((p, i) => {
                const originalIndex = photos.indexOf(p);
                return (
                  <TouchableOpacity key={i} onPress={() => handleDeletePhoto(originalIndex)} activeOpacity={0.7}>
                    <Image source={{ uri: p.uri }} style={styles.reviewPhoto} />
                    <View style={[styles.photoBadge, { backgroundColor: THEME.colors.warning }]}>
                      <Text style={styles.photoBadgeText}>Detail</Text>
                    </View>
                    {p.compassBearing !== null && (
                      <View style={styles.bearingBadge}>
                        <Text style={styles.bearingBadgeText}>{p.compassBearing}°</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleAddMore} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>+ Add More</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.finishButton, photos.length === 0 && styles.finishButtonDisabled]}
          onPress={handleFinish}
          disabled={photos.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.finishButtonText}>Save {photos.length} Photos</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const stepIndex = ['intro', 'scan', 'closeups', 'review'].indexOf(step);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{roomName}</Text>
          <View style={styles.headerButton} />
        </View>

        {/* Step progress */}
        <View style={styles.stepProgress}>
          {['intro', 'scan', 'closeups', 'review'].map((s, i) => (
            <View
              key={s}
              style={[styles.stepLine, stepIndex >= i && styles.stepLineActive]}
            />
          ))}
        </View>

        {/* Current step content */}
        {step === 'intro' && renderIntroStep()}
        {step === 'scan' && renderScanStep()}
        {step === 'closeups' && renderCloseupsStep()}
        {step === 'review' && renderReviewStep()}
      </View>
    </Modal>
  );
}

const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 12) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerButton: {
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
  stepProgress: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  stepLine: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: THEME.colors.border,
  },
  stepLineActive: {
    backgroundColor: THEME.colors.brand,
  },
  stepContent: {
    flex: 1,
    padding: 16,
  },

  // Intro step
  introSection: {
    flex: 1,
    justifyContent: 'center',
  },
  scanIllustration: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scanCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: THEME.colors.brand,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.brand + '10',
  },
  rotateArrow: {
    marginTop: -8,
    opacity: 0.7,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700' as any,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  introBody: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  introSteps: {
    gap: 12,
    marginBottom: 24,
  },
  introStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introStepNumText: {
    color: THEME.colors.textInverse,
    fontSize: 13,
    fontWeight: '700' as any,
  },
  introStepText: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  compassStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.subtle,
    padding: 12,
    borderRadius: THEME.radius.md,
  },
  compassStatusText: {
    flex: 1,
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.success,
  },

  // Scan step
  ringContainer: {
    alignSelf: 'center',
    width: RING_SIZE + 40,
    height: RING_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringBearing: {
    fontSize: 28,
    fontWeight: '700' as any,
    color: THEME.colors.textPrimary,
  },
  ringDirection: {
    fontSize: 14,
    fontWeight: '600' as any,
    color: THEME.colors.textSecondary,
  },
  ringCount: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },
  cardinalLabel: {
    fontSize: 11,
    fontWeight: '600' as any,
    color: THEME.colors.textTertiary,
  },
  bearingIndicator: {
    position: 'absolute',
    width: 4,
    height: 12,
    backgroundColor: THEME.colors.error,
    borderRadius: 2,
    top: 8,
    left: RING_SIZE / 2 + 18,
  },
  coverageInfo: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  coverageBar: {
    height: 6,
    backgroundColor: THEME.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  coverageBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.brand,
    borderRadius: 3,
  },
  coverageText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  scanPhotoRow: {
    maxHeight: 80,
    marginBottom: 12,
  },
  scanPhotoItem: {
    marginRight: 8,
    position: 'relative',
  },
  scanPhotoThumb: {
    width: 64,
    height: 64,
    borderRadius: THEME.radius.sm,
  },
  scanPhotoBearing: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    color: THEME.colors.textInverse,
    fontSize: 9,
    fontWeight: '700' as any,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scanButtonContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  scanCaptureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: THEME.colors.brand,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  scanCaptureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanHint: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    marginBottom: 12,
  },
  scanNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
  },
  scanNextButtonReady: {
    borderColor: THEME.colors.brand,
  },
  scanNextButtonText: {
    fontSize: 15,
    fontWeight: '600' as any,
    color: THEME.colors.textTertiary,
  },

  // Shared
  instruction: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  instructionBody: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  thumbnailLarge: {
    width: 100,
    height: 100,
    borderRadius: THEME.radius.sm,
  },
  photoScroll: {
    marginBottom: 16,
    maxHeight: 110,
  },
  primaryButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '700' as any,
  },
  primaryButtonSmall: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.brand,
  },
  primaryButtonSmallText: {
    fontSize: 15,
    fontWeight: '700' as any,
    color: THEME.colors.textInverse,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as any,
    color: THEME.colors.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  closeupSummary: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeupSummaryText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },

  // Review step
  reviewScroll: {
    flex: 1,
  },
  reviewSection: {
    marginBottom: 16,
  },
  reviewSectionTitle: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reviewPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: THEME.radius.sm,
  },
  photoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: THEME.radius.md,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoBadgeText: {
    color: THEME.colors.textInverse,
    fontSize: 10,
    fontWeight: '700' as any,
  },
  bearingBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  bearingBadgeText: {
    color: THEME.colors.textInverse,
    fontSize: 9,
    fontWeight: '600' as any,
  },
  finishButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.brand,
  },
  finishButtonDisabled: {
    opacity: 0.5,
  },
  finishButtonText: {
    fontSize: 15,
    fontWeight: '700' as any,
    color: THEME.colors.textInverse,
  },
});
