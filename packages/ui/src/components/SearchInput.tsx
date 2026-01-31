import React from 'react';
import { View, TextInput, StyleSheet, ViewStyle, TextInputProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

export interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  containerStyle?: ViewStyle;
}

export function SearchInput({ containerStyle, ...textInputProps }: SearchInputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.iconContainer}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
            stroke={THEME.colors.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <TextInput
        style={styles.input}
        placeholderTextColor={THEME.colors.textTertiary}
        placeholder="Search..."
        {...textInputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: THEME.components.input.height,
    borderRadius: THEME.components.input.borderRadius,
    borderWidth: THEME.components.input.borderWidth,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  iconContainer: {
    paddingLeft: THEME.spacing.base,
    paddingRight: THEME.spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    paddingRight: THEME.spacing.base,
  },
});
