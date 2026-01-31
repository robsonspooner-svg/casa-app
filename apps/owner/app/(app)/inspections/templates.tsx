// Inspection Templates Management - Owner View
// Mission 11: Property Inspections
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Button, Input } from '@casa/ui';
import {
  useInspectionTemplates,
  useAuth,
  getSupabaseClient,
} from '@casa/api';
import type { TemplateWithRooms } from '@casa/api';

export default function InspectionTemplatesScreen() {
  const { templates, loading, error, refreshing, refreshTemplates } = useInspectionTemplates();
  const { user } = useAuth();

  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const [addingRoomToTemplateId, setAddingRoomToTemplateId] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomItems, setNewRoomItems] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);

  const toggleExpand = useCallback((templateId: string) => {
    setExpandedTemplateId(prev => (prev === templateId ? null : templateId));
    setAddingRoomToTemplateId(null);
    setNewRoomName('');
    setNewRoomItems('');
  }, []);

  const handleCreateTemplate = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Please enter a template name.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create templates.');
      return;
    }

    setCreating(true);
    try {
      const supabase = getSupabaseClient();
      const { error: insertError } = await (supabase
        .from('inspection_templates') as ReturnType<typeof supabase.from>)
        .insert({
          owner_id: user.id,
          name: trimmedName,
          description: createDescription.trim() || null,
          is_default: false,
        });

      if (insertError) throw insertError;

      setShowCreateModal(false);
      setCreateName('');
      setCreateDescription('');
      await refreshTemplates();
    } catch (caught) {
      Alert.alert('Error', caught instanceof Error ? caught.message : 'Failed to create template.');
    } finally {
      setCreating(false);
    }
  };

  const handleAddRoom = async (templateId: string) => {
    const trimmedRoomName = newRoomName.trim();
    if (!trimmedRoomName) {
      Alert.alert('Required', 'Please enter a room name.');
      return;
    }

    const template = templates.find(t => t.id === templateId);
    const nextOrder = template ? template.rooms.length : 0;
    const items = newRoomItems
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    setSavingRoom(true);
    try {
      const supabase = getSupabaseClient();
      const { error: insertError } = await (supabase
        .from('inspection_template_rooms') as ReturnType<typeof supabase.from>)
        .insert({
          template_id: templateId,
          name: trimmedRoomName,
          display_order: nextOrder,
          items,
        });

      if (insertError) throw insertError;

      setAddingRoomToTemplateId(null);
      setNewRoomName('');
      setNewRoomItems('');
      await refreshTemplates();
    } catch (caught) {
      Alert.alert('Error', caught instanceof Error ? caught.message : 'Failed to add room.');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleDeleteRoom = (roomId: string, roomName: string, templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template?.is_default) return;

    Alert.alert(
      'Delete Room',
      `Are you sure you want to delete "${roomName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { error: deleteError } = await (supabase
                .from('inspection_template_rooms') as ReturnType<typeof supabase.from>)
                .delete()
                .eq('id', roomId);

              if (deleteError) throw deleteError;
              await refreshTemplates();
            } catch (caught) {
              Alert.alert('Error', caught instanceof Error ? caught.message : 'Failed to delete room.');
            }
          },
        },
      ]
    );
  };

  const renderTemplate = ({ item }: { item: TemplateWithRooms }) => {
    const isExpanded = expandedTemplateId === item.id;
    const isReadOnly = item.is_default;
    const isAddingRoom = addingRoomToTemplateId === item.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.cardTitleArea}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.cardDescription} numberOfLines={isExpanded ? undefined : 1}>
                {item.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.cardHeaderRight}>
            {isReadOnly && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default (read-only)</Text>
              </View>
            )}
            <View style={styles.roomCountPill}>
              <Text style={styles.roomCountText}>
                {item.rooms.length} {item.rooms.length === 1 ? 'room' : 'rooms'}
              </Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d={isExpanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}
                stroke={THEME.colors.textTertiary}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />

            {item.rooms.length === 0 ? (
              <Text style={styles.emptyRoomsText}>No rooms added yet.</Text>
            ) : (
              item.rooms.map((room) => (
                <View key={room.id} style={styles.roomCard}>
                  <View style={styles.roomHeader}>
                    <View style={styles.roomTitleRow}>
                      <View style={styles.roomOrderBadge}>
                        <Text style={styles.roomOrderText}>{room.display_order + 1}</Text>
                      </View>
                      <Text style={styles.roomName}>{room.name}</Text>
                    </View>
                    {!isReadOnly && (
                      <TouchableOpacity
                        onPress={() => handleDeleteRoom(room.id, room.name, item.id)}
                        style={styles.deleteRoomButton}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"
                            stroke={THEME.colors.error}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </TouchableOpacity>
                    )}
                  </View>
                  {room.items.length > 0 && (
                    <View style={styles.itemTags}>
                      {room.items.map((itemName, idx) => (
                        <View key={`${room.id}-item-${idx}`} style={styles.itemTag}>
                          <Text style={styles.itemTagText}>{itemName}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}

            {!isReadOnly && !isAddingRoom && (
              <TouchableOpacity
                style={styles.addRoomButton}
                onPress={() => {
                  setAddingRoomToTemplateId(item.id);
                  setNewRoomName('');
                  setNewRoomItems('');
                }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5v14M5 12h14" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
                <Text style={styles.addRoomButtonText}>Add Room</Text>
              </TouchableOpacity>
            )}

            {!isReadOnly && isAddingRoom && (
              <View style={styles.addRoomForm}>
                <Input
                  label="Room Name"
                  placeholder="e.g., Kitchen"
                  value={newRoomName}
                  onChangeText={setNewRoomName}
                />
                <View style={styles.addRoomFormSpacing} />
                <Input
                  label="Items (comma-separated)"
                  placeholder="e.g., Walls, Ceiling, Floor, Benchtops"
                  value={newRoomItems}
                  onChangeText={setNewRoomItems}
                />
                <View style={styles.addRoomFormActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setAddingRoomToTemplateId(null);
                      setNewRoomName('');
                      setNewRoomItems('');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <View style={styles.saveButtonWrapper}>
                    <Button
                      title={savingRoom ? 'Saving...' : 'Save Room'}
                      onPress={() => handleAddRoom(item.id)}
                      disabled={savingRoom || !newRoomName.trim()}
                      fullWidth={false}
                      style={styles.saveButton}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Templates</Text>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={styles.addButton}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={refreshTemplates} variant="secondary" />
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.centered}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
            <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.emptyTitle}>No templates</Text>
          <Text style={styles.emptySubtext}>
            Create a custom inspection template to get started.
          </Text>
          <Button
            title="Create Template"
            onPress={() => setShowCreateModal(true)}
          />
        </View>
      ) : (
        <FlatList
          data={templates}
          renderItem={renderTemplate}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshTemplates}
              tintColor={THEME.colors.brand}
            />
          }
        />
      )}

      {/* Create Template Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateName('');
                  setCreateDescription('');
                }}
                style={styles.backButton}
              >
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>New Template</Text>
              <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Template Name</Text>
              <Input
                placeholder="e.g., My Custom Template"
                value={createName}
                onChangeText={setCreateName}
              />

              <Text style={styles.sectionTitle}>Description</Text>
              <View style={styles.textAreaContainer}>
                <TextInput
                  style={styles.textArea}
                  placeholder="Optional description of this template"
                  placeholderTextColor={THEME.colors.textTertiary}
                  value={createDescription}
                  onChangeText={setCreateDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalHint}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 16v-4M12 8h.01" stroke={THEME.colors.info} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.modalHintText}>
                  After creating the template, expand it to add rooms and inspection items.
                </Text>
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  title={creating ? 'Creating...' : 'Create Template'}
                  onPress={handleCreateTemplate}
                  disabled={creating || !createName.trim()}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 44,
  },
  list: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing.xl * 2,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    marginBottom: THEME.spacing.md,
    overflow: 'hidden',
    ...THEME.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: THEME.spacing.base,
  },
  cardTitleArea: {
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  cardTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  cardDescription: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  defaultBadge: {
    backgroundColor: THEME.colors.infoBg,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  defaultBadgeText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.info,
  },
  roomCountPill: {
    backgroundColor: THEME.colors.subtle,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  roomCountText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
  },
  expandedContent: {
    paddingHorizontal: THEME.spacing.base,
    paddingBottom: THEME.spacing.base,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  emptyRoomsText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    paddingVertical: THEME.spacing.md,
  },
  roomCard: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    flex: 1,
  },
  roomOrderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomOrderText: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textInverse,
  },
  roomName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  deleteRoomButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.xs,
    marginTop: THEME.spacing.sm,
  },
  itemTag: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.full,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
  },
  itemTagText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
  },
  addRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.xs,
    paddingVertical: THEME.spacing.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
    borderStyle: 'dashed',
    borderRadius: THEME.radius.md,
    marginTop: THEME.spacing.sm,
  },
  addRoomButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.brand,
  },
  addRoomForm: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.sm,
  },
  addRoomFormSpacing: {
    height: THEME.spacing.md,
  },
  addRoomFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.base,
  },
  cancelButton: {
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
  },
  cancelButtonText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textSecondary,
  },
  saveButtonWrapper: {
    minWidth: 120,
  },
  saveButton: {
    paddingHorizontal: THEME.spacing.base,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  emptySubtext: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: THEME.spacing.base,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  textAreaContainer: {
    borderWidth: THEME.components.input.borderWidth,
    borderColor: THEME.colors.border,
    borderRadius: THEME.components.input.borderRadius,
    backgroundColor: THEME.colors.surface,
    minHeight: 96,
  },
  textArea: {
    flex: 1,
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  modalHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.infoBg,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    marginTop: THEME.spacing.lg,
  },
  modalHintText: {
    flex: 1,
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.info,
    lineHeight: 18,
  },
  buttonContainer: {
    paddingVertical: THEME.spacing.xl,
  },
});
