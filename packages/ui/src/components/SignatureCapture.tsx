// Signature Capture Component
// Mission 11: Property Inspections - Digital Signature for Condition Reports
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
  ViewStyle,
} from 'react-native';
import Svg, { Path as SvgPath, G } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button } from './Button';

export interface SignatureCaptureProps {
  onSave: (signatureData: string) => void;
  onClear?: () => void;
  label?: string;
  style?: ViewStyle;
  height?: number;
}

interface Point {
  x: number;
  y: number;
}

export function SignatureCapture({
  onSave,
  onClear,
  label = 'Sign below',
  style,
  height = 200,
}: SignatureCaptureProps) {
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [isSigned, setIsSigned] = useState(false);
  const containerRef = useRef<View>(null);
  const containerLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY }]);
        setIsSigned(true);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        setPaths(prev => [...prev, currentPath]);
        setCurrentPath([]);
      },
    })
  ).current;

  const handleClear = useCallback(() => {
    setPaths([]);
    setCurrentPath([]);
    setIsSigned(false);
    onClear?.();
  }, [onClear]);

  const handleSave = useCallback(() => {
    if (!isSigned || paths.length === 0) return;

    // Convert paths to SVG path data string
    const svgData = pathsToSvgData(paths);
    onSave(svgData);
  }, [isSigned, paths, onSave]);

  const allPaths = [...paths, currentPath].filter(p => p.length > 0);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View
        ref={containerRef}
        style={[styles.canvas, { height }]}
        onLayout={(e) => {
          containerLayout.current = e.nativeEvent.layout;
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${Dimensions.get('window').width - THEME.spacing.base * 4} ${height}`}>
          <G>
            {allPaths.map((path, pathIdx) => {
              if (path.length < 2) return null;
              const d = path.reduce((acc, point, idx) => {
                if (idx === 0) return `M ${point.x} ${point.y}`;
                return `${acc} L ${point.x} ${point.y}`;
              }, '');
              return (
                <SvgPath
                  key={pathIdx}
                  d={d}
                  stroke={THEME.colors.textPrimary}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </G>
        </Svg>

        {!isSigned && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Draw your signature here</Text>
          </View>
        )}

        {/* Sign line */}
        <View style={styles.signLine} />
      </View>
      <View style={styles.actions}>
        <Button title="Clear" onPress={handleClear} variant="text" />
        <Button title="Save Signature" onPress={handleSave} disabled={!isSigned} />
      </View>
    </View>
  );
}

function pathsToSvgData(paths: Point[][]): string {
  return paths
    .filter(p => p.length > 1)
    .map(path =>
      path.reduce((acc, point, idx) => {
        if (idx === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        return `${acc} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }, '')
    )
    .join(' ');
}

const styles = StyleSheet.create({
  container: {
    gap: THEME.spacing.sm,
  },
  label: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
  },
  canvas: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  placeholderText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
  },
  signLine: {
    position: 'absolute',
    bottom: 40,
    left: THEME.spacing.base,
    right: THEME.spacing.base,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
