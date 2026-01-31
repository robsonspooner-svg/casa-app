import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

export interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  color?: string;
  emptyColor?: string;
  style?: ViewStyle;
}

const STAR_PATH =
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

export function StarRating({
  rating,
  maxStars = 5,
  size = 16,
  interactive = false,
  onRatingChange,
  color = '#F59E0B',
  emptyColor = THEME.colors.border,
  style,
}: StarRatingProps) {
  const stars = Array.from({ length: maxStars }, (_, i) => i + 1);

  const renderStar = (starNumber: number) => {
    const filled = rating >= starNumber;
    const halfFilled = !filled && rating >= starNumber - 0.5;
    const fillColor = filled || halfFilled ? color : emptyColor;

    const star = (
      <Svg
        key={starNumber}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? fillColor : 'none'}
        stroke={fillColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={STAR_PATH} fill={filled ? fillColor : halfFilled ? fillColor : 'none'} />
      </Svg>
    );

    if (interactive && onRatingChange) {
      return (
        <Pressable
          key={starNumber}
          onPress={() => onRatingChange(starNumber)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          style={styles.starTouch}
        >
          {star}
        </Pressable>
      );
    }

    return star;
  };

  return (
    <View style={[styles.container, { gap: interactive ? 8 : 2 }, style]}>
      {stars.map(renderStar)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starTouch: {
    padding: 2,
  },
});
