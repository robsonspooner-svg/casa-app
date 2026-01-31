import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface FileUploadProps {
  files: UploadedFile[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  label?: string;
  hint?: string;
  maxFiles?: number;
  containerStyle?: ViewStyle;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ files, onAdd, onRemove, label, hint, maxFiles = 5, containerStyle }: FileUploadProps) {
  const canAdd = files.length < maxFiles;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      {hint && <Text style={styles.hint}>{hint}</Text>}

      {files.map(file => (
        <View key={file.id} style={styles.fileItem}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M14 2v6h6" stroke={THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(file.id)} style={styles.removeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke={THEME.colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      ))}

      {canAdd && (
        <TouchableOpacity style={styles.addButton} onPress={onAdd} activeOpacity={0.7}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.addButtonText}>Add Document</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: THEME.spacing.sm,
  },
  label: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  hint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginBottom: THEME.spacing.sm,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.sm,
    gap: THEME.spacing.sm,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  fileSize: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
  },
  removeButton: {
    padding: THEME.spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    borderStyle: 'dashed',
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    gap: THEME.spacing.sm,
  },
  addButtonText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
});
