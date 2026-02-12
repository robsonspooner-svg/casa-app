// Compass Overlay — Displays current compass bearing during photo capture
// Uses expo-sensors Magnetometer for real-time heading data

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Magnetometer } from 'expo-sensors';
import { THEME } from '@casa/config';

interface CompassOverlayProps {
  visible: boolean;
  onBearingUpdate?: (bearing: number) => void;
}

const CARDINAL_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function getCardinalDirection(bearing: number): string {
  const index = Math.round(bearing / 45) % 8;
  return CARDINAL_DIRECTIONS[index];
}

export function useCompassBearing() {
  const [bearing, setBearing] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  const subscriptionRef = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);

  useEffect(() => {
    let mounted = true;

    Magnetometer.isAvailableAsync().then((isAvailable: boolean) => {
      if (mounted) setAvailable(isAvailable);
    });

    return () => { mounted = false; };
  }, []);

  const startListening = useCallback(() => {
    if (!available) return;

    Magnetometer.setUpdateInterval(100);
    subscriptionRef.current = Magnetometer.addListener((data: { x: number; y: number; z: number }) => {
      const { x, y } = data;
      let angle = Math.atan2(y, x) * (180 / Math.PI);
      // Normalize: Magnetometer gives angle from magnetic north
      // On iOS, atan2(y,x) gives angle; we need to adjust
      if (Platform.OS === 'ios') {
        angle = angle >= 0 ? angle : angle + 360;
      } else {
        angle = (angle + 360) % 360;
      }
      // Round to nearest degree
      const rounded = Math.round(angle);
      setBearing(rounded);
    });
  }, [available]);

  const stopListening = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const getCurrentBearing = useCallback(() => bearing, [bearing]);

  return { bearing, available, startListening, stopListening, getCurrentBearing };
}

export default function CompassOverlay({ visible, onBearingUpdate }: CompassOverlayProps) {
  const { bearing, available, startListening, stopListening } = useCompassBearing();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && available) {
      startListening();
    } else {
      stopListening();
    }
    return () => stopListening();
  }, [visible, available, startListening, stopListening]);

  useEffect(() => {
    if (bearing !== null) {
      Animated.timing(rotateAnim, {
        toValue: -bearing,
        duration: 150,
        useNativeDriver: true,
      }).start();

      onBearingUpdate?.(bearing);
    }
  }, [bearing, onBearingUpdate, rotateAnim]);

  if (!visible || !available) return null;

  const rotation = rotateAnim.interpolate({
    inputRange: [-360, 0, 360],
    outputRange: ['-360deg', '0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.compassBg}>
        <Animated.View style={[styles.needle, { transform: [{ rotate: rotation }] }]}>
          <View style={styles.needleNorth} />
          <View style={styles.needleSouth} />
        </Animated.View>
        <Text style={styles.bearingText}>
          {bearing !== null ? `${bearing}° ${getCardinalDirection(bearing)}` : '---'}
        </Text>
      </View>
    </View>
  );
}

const COMPASS_SIZE = 64;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 100,
  },
  compassBg: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  needle: {
    position: 'absolute',
    width: 4,
    height: COMPASS_SIZE - 20,
    alignItems: 'center',
  },
  needleNorth: {
    width: 4,
    height: (COMPASS_SIZE - 20) / 2,
    backgroundColor: THEME.colors.error,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  needleSouth: {
    width: 4,
    height: (COMPASS_SIZE - 20) / 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  bearingText: {
    position: 'absolute',
    bottom: -22,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textInverse,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
    width: 80,
  },
});
