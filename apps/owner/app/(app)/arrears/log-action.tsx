// Log Action Screen
// Mission 08: Arrears & Late Payment Management

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, Button, Chip } from '@casa/ui';
import { useArrearsMutations } from '@casa/api';
import type { ArrearsActionType } from '@casa/api';

type ManualActionType = 'phone_call' | 'note' | 'letter_sent';

const ACTION_OPTIONS: { label: string; value: ManualActionType; description: string }[] = [
  {
    label: 'Phone Call',
    value: 'phone_call',
    description: 'Record details of a phone conversation with the tenant',
  },
  {
    label: 'Note',
    value: 'note',
    description: 'Add a general note or observation',
  },
  {
    label: 'Letter Sent',
    value: 'letter_sent',
    description: 'Record that a letter was mailed to the tenant',
  },
];

export default function LogActionScreen() {
  const { arrearsId, actionType: initialType } = useLocalSearchParams<{
    arrearsId: string;
    actionType?: string;
  }>();

  const { logAction, loading } = useArrearsMutations();

  const [actionType, setActionType] = useState<ManualActionType>(
    (initialType as ManualActionType) || 'phone_call'
  );
  const [description, setDescription] = useState('');

  const selectedOption = ACTION_OPTIONS.find(opt => opt.value === actionType);

  const handleSubmit = async () => {
    if (!arrearsId) {
      Alert.alert('Error', 'Missing arrears record information');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    const success = await logAction({
      arrears_record_id: arrearsId,
      action_type: actionType as ArrearsActionType,
      description: description.trim(),
    });

    if (success) {
      Alert.alert('Success', 'Action logged successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', 'Failed to log action. Please try again.');
    }
  };

  const getPlaceholder = (): string => {
    switch (actionType) {
      case 'phone_call':
        return 'Describe the conversation: who you spoke with, what was discussed, any commitments made...';
      case 'letter_sent':
        return 'Describe the letter contents and how it was sent (post, registered mail, etc.)...';
      case 'note':
      default:
        return 'Enter your note or observation...';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Action Type Selection */}
      <Card style={styles.inputCard}>
        <Text style={styles.inputLabel}>Action Type</Text>
        <View style={styles.typeOptions}>
          {ACTION_OPTIONS.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              selected={actionType === option.value}
              onPress={() => setActionType(option.value)}
            />
          ))}
        </View>
        {selectedOption && (
          <Text style={styles.typeDescription}>{selectedOption.description}</Text>
        )}
      </Card>

      {/* Description */}
      <Card style={styles.inputCard}>
        <Text style={styles.inputLabel}>
          {actionType === 'phone_call' ? 'Call Notes' : actionType === 'letter_sent' ? 'Letter Details' : 'Note'}
        </Text>
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder={getPlaceholder()}
          placeholderTextColor={THEME.colors.textTertiary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </Card>

      {/* Quick Templates for Phone Calls */}
      {actionType === 'phone_call' && (
        <Card style={styles.inputCard}>
          <Text style={styles.inputLabel}>Quick Templates</Text>
          <View style={styles.templates}>
            <Button
              title="Left voicemail"
              variant="secondary"
              onPress={() => setDescription('Left voicemail requesting callback regarding overdue rent.')}
              style={styles.templateButton}
            />
            <Button
              title="Spoke with tenant"
              variant="secondary"
              onPress={() => setDescription('Spoke with tenant about overdue rent. They acknowledged the arrears and promised to pay by [date].')}
              style={styles.templateButton}
            />
            <Button
              title="No answer"
              variant="secondary"
              onPress={() => setDescription('Called tenant, no answer, did not leave message.')}
              style={styles.templateButton}
            />
            <Button
              title="Agreed payment plan"
              variant="secondary"
              onPress={() => setDescription('Discussed payment plan options with tenant. They agreed to pay [amount] per [frequency] starting [date].')}
              style={styles.templateButton}
            />
          </View>
        </Card>
      )}

      {/* Submit Button */}
      <View style={styles.buttonContainer}>
        <Button
          title={`Log ${selectedOption?.label || 'Action'}`}
          onPress={handleSubmit}
          loading={loading}
          disabled={!description.trim()}
        />
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  inputCard: {
    margin: THEME.spacing.base,
    marginBottom: THEME.spacing.sm,
  },
  inputLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  typeDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.md,
    fontStyle: 'italic',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    backgroundColor: THEME.colors.canvas,
    minHeight: 150,
  },
  templates: {
    gap: THEME.spacing.sm,
  },
  templateButton: {
    alignItems: 'flex-start',
  },
  buttonContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  bottomSpacer: {
    height: THEME.spacing['2xl'],
  },
});
