// Connection Codes Screen - Owner App
// Allows owners to generate and manage connection codes for tenants

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { THEME } from '@casa/config';
import {
  useConnectionCodes,
  useProperties,
  useTenancies,
  type CreateConnectionCodeInput,
} from '@casa/api';

export default function ConnectionCodesScreen() {
  const { codes, loading, error, createCode, revokeCode, refreshCodes } = useConnectionCodes();
  const { properties } = useProperties();
  const { tenancies } = useTenancies();

  const [creating, setCreating] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTenancyId, setSelectedTenancyId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateCode = async () => {
    setCreating(true);
    try {
      const input: CreateConnectionCodeInput = {
        propertyId: selectedPropertyId || undefined,
        tenancyId: selectedTenancyId || undefined,
        connectionType: selectedTenancyId ? 'tenancy' : 'property',
        maxUses: 1,
        expiresInDays: 7,
        label: label || undefined,
      };

      const code = await createCode(input);
      if (code) {
        setShowCreateForm(false);
        setLabel('');
        setSelectedPropertyId(null);
        setSelectedTenancyId(null);

        // Offer to share the code
        Alert.alert(
          'Code Created',
          `Your connection code is: ${code.code}`,
          [
            { text: 'Share', onPress: () => shareCode(code.code, label) },
            { text: 'OK' },
          ]
        );
      } else {
        // createCode returned null - check the error state
        Alert.alert('Error', error || 'Failed to create connection code. The connection_codes table may not exist in the database yet.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create connection code';
      Alert.alert('Error', message);
      console.error('Create code error:', err);
    } finally {
      setCreating(false);
    }
  };

  const shareCode = async (code: string, label?: string | null) => {
    try {
      const propertyInfo = label ? ` for ${label}` : '';
      await Share.share({
        message: `Hi! Here's your Casa connection code${propertyInfo}:\n\n${code}\n\nTo connect:\n1. Open the Casa (Tenant) app\n2. Tap "Connect" on the home screen\n3. Enter this 6-character code\n4. Confirm the connection\n\nThis code expires in 7 days.`,
        title: 'Casa Connection Code',
      });
    } catch (err) {
      // User cancelled
    }
  };

  const handleRevokeCode = async (codeId: string, codeText: string) => {
    Alert.alert(
      'Revoke Code',
      `Are you sure you want to revoke code ${codeText}? It will no longer work.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeCode(codeId);
            } catch (err) {
              Alert.alert('Error', 'Failed to revoke code');
            }
          },
        },
      ]
    );
  };

  const activeTenancies = tenancies.filter(t => t.status === 'active' || t.status === 'pending');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Connection Codes',
          headerStyle: { backgroundColor: THEME.colors.surface },
          headerTintColor: THEME.colors.textPrimary,
        }}
      />

      <ScrollView style={styles.content}>
        {/* Direct Invite */}
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={() => router.push('/(app)/connections/invite' as any)}
        >
          <Text style={styles.inviteButtonText}>Invite Tenant by Email</Text>
          <Text style={styles.inviteButtonSubtext}>Send lease terms directly to a tenant</Text>
        </TouchableOpacity>

        {/* Create Code Section */}
        {!showCreateForm ? (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateForm(true)}
          >
            <Text style={styles.createButtonText}>+ Create Connection Code</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.createForm}>
            <Text style={styles.formTitle}>New Connection Code</Text>

            <Text style={styles.fieldLabel}>Property (optional)</Text>
            <View style={styles.picker}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  !selectedPropertyId && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setSelectedPropertyId(null);
                  setSelectedTenancyId(null);
                }}
              >
                <Text style={!selectedPropertyId ? styles.pickerTextSelected : styles.pickerText}>
                  Any Property
                </Text>
              </TouchableOpacity>
              {properties.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.pickerOption,
                    selectedPropertyId === p.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedPropertyId(p.id);
                    setSelectedTenancyId(null);
                  }}
                >
                  <Text style={selectedPropertyId === p.id ? styles.pickerTextSelected : styles.pickerText}>
                    {p.address_line_1}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedPropertyId && activeTenancies.filter(t => t.property_id === selectedPropertyId).length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Tenancy (optional)</Text>
                <View style={styles.picker}>
                  <TouchableOpacity
                    style={[
                      styles.pickerOption,
                      !selectedTenancyId && styles.pickerOptionSelected,
                    ]}
                    onPress={() => setSelectedTenancyId(null)}
                  >
                    <Text style={!selectedTenancyId ? styles.pickerTextSelected : styles.pickerText}>
                      Property Only
                    </Text>
                  </TouchableOpacity>
                  {activeTenancies
                    .filter(t => t.property_id === selectedPropertyId)
                    .map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.pickerOption,
                          selectedTenancyId === t.id && styles.pickerOptionSelected,
                        ]}
                        onPress={() => setSelectedTenancyId(t.id)}
                      >
                        <Text style={selectedTenancyId === t.id ? styles.pickerTextSelected : styles.pickerText}>
                          Tenancy (ends {t.lease_end_date})
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Label (for your reference)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g., For John Smith"
              placeholderTextColor={THEME.colors.textTertiary}
            />

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateForm(false);
                  setLabel('');
                  setSelectedPropertyId(null);
                  setSelectedTenancyId(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateCode}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={THEME.colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Existing Codes */}
        <Text style={styles.sectionTitle}>Your Codes</Text>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={THEME.colors.brand} />
        ) : codes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No connection codes yet</Text>
            <Text style={styles.emptySubtext}>
              Create a code to invite tenants to connect with your properties
            </Text>
          </View>
        ) : (
          codes.map(code => (
            <View key={code.id} style={styles.codeCard}>
              <View style={styles.codeHeader}>
                <Text style={styles.codeText}>{code.code}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    code.is_active ? styles.statusActive : styles.statusInactive,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {code.is_active ? 'Active' : 'Revoked'}
                  </Text>
                </View>
              </View>

              {code.label && (
                <Text style={styles.codeLabel}>{code.label}</Text>
              )}

              <View style={styles.codeDetails}>
                <Text style={styles.codeDetail}>
                  Type: {code.connection_type}
                </Text>
                <Text style={styles.codeDetail}>
                  Uses: {code.use_count}/{code.max_uses ?? 'unlimited'}
                </Text>
                {code.expires_at && (
                  <Text style={styles.codeDetail}>
                    Expires: {new Date(code.expires_at).toLocaleDateString()}
                  </Text>
                )}
              </View>

              {code.is_active && (
                <View style={styles.codeActions}>
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => shareCode(code.code, code.label)}
                  >
                    <Text style={styles.shareButtonText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.revokeButton}
                    onPress={() => handleRevokeCode(code.id, code.code)}
                  >
                    <Text style={styles.revokeButtonText}>Revoke</Text>
                  </TouchableOpacity>
                </View>
              )}

              {code.attempts && code.attempts.length > 0 && (
                <View style={styles.attempts}>
                  <Text style={styles.attemptsTitle}>
                    Connection Attempts ({code.attempts.length})
                  </Text>
                  {code.attempts.slice(0, 3).map(attempt => (
                    <View key={attempt.id} style={styles.attempt}>
                      <Text style={styles.attemptStatus}>
                        {attempt.status === 'success' ? 'Connected' :
                         attempt.status === 'pending' ? 'Pending' :
                         'Failed'}
                      </Text>
                      <Text style={styles.attemptDate}>
                        {new Date(attempt.created_at).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inviteButton: {
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  inviteButtonSubtext: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  createButton: {
    backgroundColor: THEME.colors.brand,
    padding: 16,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    marginBottom: 24,
  },
  createButtonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  createForm: {
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.md,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  pickerText: {
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  pickerTextSelected: {
    fontSize: 14,
    color: THEME.colors.textInverse,
    fontWeight: '500',
  },
  input: {
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    padding: 12,
    fontSize: 16,
    color: THEME.colors.textPrimary,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.canvas,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 16,
  },
  loader: {
    marginTop: 32,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
  },
  codeCard: {
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.md,
    marginBottom: 12,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.brand,
    letterSpacing: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: THEME.colors.success + '20',
  },
  statusInactive: {
    backgroundColor: THEME.colors.textTertiary + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  codeLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  codeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  codeDetail: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  shareButton: {
    flex: 1,
    padding: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  revokeButton: {
    flex: 1,
    padding: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.canvas,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.error,
  },
  revokeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.error,
  },
  attempts: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  attemptsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  attempt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  attemptStatus: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  attemptDate: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
  },
});
