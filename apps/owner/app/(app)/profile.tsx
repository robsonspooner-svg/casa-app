import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
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
  const { profile, updateProfile, uploadAvatar } = useProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Update local state when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    let ImagePicker;
    try {
      ImagePicker = require('expo-image-picker');
    } catch {
      Alert.alert(
        'Not Available',
        'Image picker requires a development build. Use "npx expo run:ios" instead of Expo Go.'
      );
      return;
    }

    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos to upload an avatar.'
      );
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];

      // Convert URI to blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      // Generate filename
      const extension = asset.uri.split('.').pop() || 'jpg';
      const fileName = `avatar-${Date.now()}.${extension}`;

      await uploadAvatar(blob, fileName);
    } catch {
      Alert.alert('Error', 'Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true; // Empty is valid
    // Australian phone format: 04xx xxx xxx or +61 4xx xxx xxx
    const phoneRegex = /^(\+61|0)[4]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  return (
    <ScreenContainer>
      {/* Header */}
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

      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickImage} disabled={uploadingAvatar}>
          <Avatar
            source={profile?.avatar_url ? { uri: profile.avatar_url } : null}
            name={profile?.full_name || undefined}
            size="xl"
          />
          <View style={styles.avatarOverlay}>
            {uploadingAvatar ? (
              <Text style={styles.avatarOverlayText}>...</Text>
            ) : (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={THEME.colors.textInverse} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx="12" cy="13" r="4" stroke={THEME.colors.textInverse} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change photo</Text>
      </View>

      {/* Profile Details */}
      <Card variant="elevated" style={styles.detailsCard}>
        {isEditing ? (
          <>
            <Input
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your name"
              containerStyle={styles.inputContainer}
            />
            <Input
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="04xx xxx xxx"
              keyboardType="phone-pad"
              containerStyle={styles.inputContainer}
              error={phone && !validatePhone(phone) ? 'Enter valid AU mobile' : undefined}
            />
            <View style={styles.emailField}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.fieldValue}>{profile?.email}</Text>
              <Text style={styles.fieldHint}>Email cannot be changed</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <Text style={styles.fieldValue}>
                {profile?.full_name || 'Not set'}
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.fieldValue}>{profile?.email}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <Text style={styles.fieldValue}>
                {profile?.phone || 'Not set'}
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Account Type</Text>
              <Text style={styles.fieldValue}>
                {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Owner'}
              </Text>
            </View>
          </>
        )}
      </Card>

      {/* Agent Autonomy Settings */}
      <TouchableOpacity
        style={styles.settingsRow}
        onPress={() => router.push('/(app)/autonomy' as any)}
      >
        <View style={styles.settingsRowLeft}>
          <View style={styles.settingsRowIcon}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M12 2a2 2 0 012 2v1h-4V4a2 2 0 012-2zM5 9h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx="9" cy="14" r="1.5" fill={THEME.colors.brand} />
              <Circle cx="15" cy="14" r="1.5" fill={THEME.colors.brand} />
            </Svg>
          </View>
          <View>
            <Text style={styles.settingsRowTitle}>Agent Autonomy</Text>
            <Text style={styles.settingsRowSubtitle}>Control what Casa AI can do automatically</Text>
          </View>
        </View>
        <Text style={styles.settingsRowChevron}>›</Text>
      </TouchableOpacity>

      {/* Sign Out Button */}
      <View style={styles.signOutSection}>
        <Button
          title="Sign Out"
          variant="text"
          onPress={handleSignOut}
        />
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
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.canvas,
  },
  avatarOverlayText: {
    fontSize: 16,
  },
  avatarHint: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.md,
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
  emailField: {
    marginTop: THEME.spacing.base,
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
  fieldHint: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.xs,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.base,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    flex: 1,
  },
  settingsRowIcon: {
    marginRight: 4,
  },
  settingsRowTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  settingsRowSubtitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  settingsRowChevron: {
    fontSize: 20,
    color: THEME.colors.textTertiary,
    fontWeight: THEME.fontWeight.semibold,
  },
  signOutSection: {
    marginTop: 'auto',
    paddingBottom: THEME.spacing.xl,
  },
});
