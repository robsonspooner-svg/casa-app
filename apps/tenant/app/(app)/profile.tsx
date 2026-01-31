import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  Input,
  Card,
  Avatar,
  ScreenContainer,
  THEME,
} from '@casa/ui';
import { useAuth, useProfile } from '@casa/api';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { profile, updateProfile } = useProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          onPress={() => (isEditing ? handleSave() : setIsEditing(true))}
          style={styles.editButton}
          disabled={saving}
        >
          <Text style={styles.editButtonText}>
            {isEditing ? (saving ? 'Saving...' : 'Save') : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.avatarSection}>
        <Avatar
          source={profile?.avatar_url ? { uri: profile.avatar_url } : null}
          name={profile?.full_name || undefined}
          size="xl"
        />
      </View>

      <Card variant="elevated" style={styles.detailsCard}>
        {isEditing ? (
          <>
            <Input
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              containerStyle={styles.inputContainer}
            />
            <Input
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              containerStyle={styles.inputContainer}
            />
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <Text style={styles.fieldValue}>{profile?.full_name || 'Not set'}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.fieldValue}>{profile?.email}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <Text style={styles.fieldValue}>{profile?.phone || 'Not set'}</Text>
            </View>
          </>
        )}
      </Card>

      <View style={styles.signOutSection}>
        <Button title="Sign Out" variant="text" onPress={handleSignOut} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -THEME.spacing.md,
  },
  backIcon: {
    fontSize: THEME.fontSize.h1,
    color: THEME.colors.textPrimary,
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  editButton: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
  },
  editButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
  },
  detailsCard: {
    marginBottom: THEME.spacing.xl,
  },
  inputContainer: {
    marginBottom: THEME.spacing.base,
  },
  field: {
    marginBottom: THEME.spacing.lg,
  },
  fieldLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  fieldValue: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  signOutSection: {
    marginTop: 'auto',
    paddingBottom: THEME.spacing.xl,
  },
});
