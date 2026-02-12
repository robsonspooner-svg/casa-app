import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { THEME } from '@casa/config';

// Design tokens from CASA-VISUAL-STANDARD.md
const SKELETON_BASE = '#F5F5F4';
const SKELETON_HIGHLIGHT = '#EDEDED';
const SHIMMER_DURATION = 1500;

// --- Base Skeleton ---

export interface SkeletonProps {
  /** Width of the skeleton shape. Defaults to '100%'. */
  width?: DimensionValue;
  /** Height of the skeleton shape. Defaults to 12. */
  height?: DimensionValue;
  /** Border radius. Defaults to THEME.radius.sm (8). */
  borderRadius?: number;
  /** Additional style overrides. */
  style?: ViewStyle;
}

/**
 * Skeleton - Base shimmer component.
 *
 * Renders a pulsing placeholder shape that animates between the skeleton
 * base colour and the highlight colour in a smooth, looping opacity wave.
 * Uses the standard React Native Animated API (no Reanimated dependency).
 */
export function Skeleton({
  width = '100%',
  height = 12,
  borderRadius = THEME.radius.sm,
  style,
}: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: SHIMMER_DURATION / 2,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: SHIMMER_DURATION / 2,
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const backgroundColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SKELETON_BASE, SKELETON_HIGHLIGHT],
  });

  // Separate dimension styles (non-animated) from animated backgroundColor.
  // This avoids type conflicts between DimensionValue and Animated types.
  const dimensionStyle: ViewStyle = { width, height, borderRadius };

  return (
    <Animated.View
      style={[dimensionStyle, { backgroundColor }, style]}
    />
  );
}

// --- SkeletonText ---

export interface SkeletonTextProps {
  /** Number of text lines to render. Defaults to 3. */
  lines?: number;
  /** Height of each text line. Defaults to 12. */
  lineHeight?: number;
  /** Spacing between lines. Defaults to THEME.spacing.sm (8). */
  lineSpacing?: number;
  /** Custom width pattern. If not provided uses a natural-looking default. */
  widths?: DimensionValue[];
  /** Additional style for the container. */
  style?: ViewStyle;
}

/**
 * SkeletonText - Multi-line text placeholder.
 *
 * Renders a configurable number of rounded-rectangle shimmer lines with
 * varying widths to mimic the shape of a paragraph. The last line is
 * always shorter to create a natural trailing effect.
 */
export function SkeletonText({
  lines = 3,
  lineHeight = 12,
  lineSpacing = THEME.spacing.sm,
  widths,
  style,
}: SkeletonTextProps) {
  const defaultWidths = generateTextWidths(lines);
  const resolvedWidths = widths ?? defaultWidths;

  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={resolvedWidths[index] ?? '100%'}
          height={lineHeight}
          borderRadius={6}
          style={index < lines - 1 ? { marginBottom: lineSpacing } : undefined}
        />
      ))}
    </View>
  );
}

/** Generate natural-looking widths for text lines. */
function generateTextWidths(count: number): DimensionValue[] {
  if (count <= 0) return [];
  if (count === 1) return ['60%' as DimensionValue];
  return Array.from({ length: count }).map((_, i): DimensionValue => {
    if (i === count - 1) return '45%';
    if (i === 0) return '100%';
    // Alternate between near-full widths for a realistic paragraph feel
    return i % 2 === 0 ? '95%' : '88%';
  });
}

// --- SkeletonAvatar ---

export interface SkeletonAvatarProps {
  /** Diameter of the avatar circle. Defaults to 48. */
  size?: number;
  /** Additional style overrides. */
  style?: ViewStyle;
}

/**
 * SkeletonAvatar - Circular avatar placeholder.
 *
 * A perfect circle that shimmers, sized to match common avatar dimensions.
 */
export function SkeletonAvatar({ size = 48, style }: SkeletonAvatarProps) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={THEME.radius.full}
      style={style}
    />
  );
}

// --- SkeletonCard ---

export interface SkeletonCardProps {
  /** Whether to show an image placeholder at the top. Defaults to true. */
  showImage?: boolean;
  /** Height of the image placeholder. Defaults to 160. */
  imageHeight?: number;
  /** Number of text lines below the image. Defaults to 3. */
  textLines?: number;
  /** Whether to show an avatar row (avatar + title). Defaults to false. */
  showAvatar?: boolean;
  /** Additional style for the outer card. */
  style?: ViewStyle;
}

/**
 * SkeletonCard - Full card placeholder with optional image, avatar, and text.
 *
 * Mirrors the Card component's visual structure: white surface background,
 * rounded corners, soft shadow, and internal padding. Use this as a
 * drop-in replacement for Card while data is loading.
 */
export function SkeletonCard({
  showImage = true,
  imageHeight = 160,
  textLines = 3,
  showAvatar = false,
  style,
}: SkeletonCardProps) {
  return (
    <View style={[styles.card, style]}>
      {/* Image placeholder */}
      {showImage && (
        <Skeleton
          width="100%"
          height={imageHeight}
          borderRadius={THEME.radius.md}
          style={styles.cardImage}
        />
      )}

      {/* Avatar + title row */}
      {showAvatar && (
        <View style={styles.avatarRow}>
          <SkeletonAvatar size={40} />
          <View style={styles.avatarText}>
            <Skeleton width="60%" height={14} borderRadius={6} />
            <Skeleton
              width="40%"
              height={10}
              borderRadius={6}
              style={{ marginTop: THEME.spacing.xs }}
            />
          </View>
        </View>
      )}

      {/* Title line (wider, taller) */}
      <Skeleton
        width="70%"
        height={16}
        borderRadius={6}
        style={styles.cardTitle}
      />

      {/* Body text lines */}
      <SkeletonText lines={textLines} style={styles.cardText} />
    </View>
  );
}

// --- SkeletonList ---

export interface SkeletonListProps {
  /** Number of skeleton cards to render. Defaults to 3. */
  count?: number;
  /** Props forwarded to each SkeletonCard. */
  cardProps?: Omit<SkeletonCardProps, 'style'>;
  /** Spacing between cards. Defaults to THEME.spacing.base (16). */
  spacing?: number;
  /** Additional style for the list container. */
  style?: ViewStyle;
}

/**
 * SkeletonList - Renders N skeleton cards for list loading states.
 *
 * Drop this in wherever a FlatList/ScrollView would normally render cards.
 * Each card shimmers independently to create an organic, living feel.
 */
export function SkeletonList({
  count = 3,
  cardProps,
  spacing = THEME.spacing.base,
  style,
}: SkeletonListProps) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard
          key={index}
          {...cardProps}
          style={index < count - 1 ? { marginBottom: spacing } : undefined}
        />
      ))}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.components.card.borderRadius,
    padding: THEME.components.card.padding,
    ...THEME.shadow.sm,
  },
  cardImage: {
    marginBottom: THEME.spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  avatarText: {
    flex: 1,
    marginLeft: THEME.spacing.md,
  },
  cardTitle: {
    marginBottom: THEME.spacing.sm,
  },
  cardText: {
    // Container for SkeletonText within the card
  },
});
