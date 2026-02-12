// Conversation View (Chat) - Owner
// Mission 12: In-App Communications
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useConversation, useMessageMutations, useMessageTemplates, renderMessageTemplate, useAuth, getSupabaseClient } from '@casa/api';
import type { MessageListItem } from '@casa/api/src/hooks/useConversation';
import type { MessageStatus } from '@casa/api/src/types/database';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function shouldShowDateHeader(messages: MessageListItem[], index: number): boolean {
  if (index === 0) return true;
  const curr = new Date(messages[index].created_at).toDateString();
  const prev = new Date(messages[index - 1].created_at).toDateString();
  return curr !== prev;
}

function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const label = names.length === 1
    ? `${names[0]} is typing...`
    : `${names.join(' and ')} are typing...`;

  return (
    <View style={styles.typingRow}>
      <Text style={styles.typingText}>{label}</Text>
    </View>
  );
}

function MessageStatusIcon({ status, isOwn }: { status: MessageStatus; isOwn: boolean }) {
  if (!isOwn) return null;
  const color = isOwn ? 'rgba(255,255,255,0.7)' : THEME.colors.textTertiary;

  switch (status) {
    case 'sending':
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'sent':
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'delivered':
      return (
        <Svg width={16} height={14} viewBox="0 0 28 24" fill="none">
          <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M26 6L15 17" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'read':
      return (
        <Svg width={16} height={14} viewBox="0 0 28 24" fill="none">
          <Path d="M20 6L9 17l-5-5" stroke="#4FC3F7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M26 6L15 17" stroke="#4FC3F7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'failed':
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M12 9v4M12 17h.01" stroke={THEME.colors.error} strokeWidth={2} strokeLinecap="round" />
          <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={THEME.colors.error} strokeWidth={2} />
        </Svg>
      );
    default:
      return null;
  }
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function AttachmentPreview({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  return (
    <View style={styles.attachmentPreview}>
      <Image source={{ uri }} style={styles.attachmentThumb} />
      <TouchableOpacity style={styles.attachmentRemove} onPress={onRemove}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6L6 18M6 6l12 12" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

function MessageBubble({
  message,
  isOwn,
  showSender,
  onLongPress,
  onReplyPress,
}: {
  message: MessageListItem;
  isOwn: boolean;
  showSender: boolean;
  onLongPress?: (message: MessageListItem) => void;
  onReplyPress?: (message: MessageListItem) => void;
}) {
  return (
    <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
      {!isOwn && showSender && (
        <View style={styles.bubbleAvatar}>
          <Text style={styles.bubbleAvatarText}>
            {getInitials(message.sender?.full_name)}
          </Text>
        </View>
      )}
      {!isOwn && !showSender && <View style={styles.bubbleAvatarSpacer} />}
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={300}
        style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}
      >
        {!isOwn && showSender && message.sender?.full_name && (
          <Text style={styles.bubbleSenderName}>{message.sender.full_name}</Text>
        )}
        {message.reply_to && (
          <View style={styles.replyPreview}>
            <Text style={styles.replyText} numberOfLines={1}>
              {message.reply_to.content}
            </Text>
          </View>
        )}
        {message.attachments.length > 0 && (
          <View style={styles.attachmentsContainer}>
            {message.attachments.map(att => (
              <Image
                key={att.id}
                source={{ uri: att.storage_path }}
                style={styles.messageAttachmentImage}
                resizeMode="cover"
              />
            ))}
          </View>
        )}
        {message.content_type !== 'image' && (
          <Text style={[styles.bubbleContent, isOwn && styles.bubbleContentOwn]}>
            {message.content}
          </Text>
        )}
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
            {formatMessageTime(message.created_at)}
          </Text>
          {message.edited_at && (
            <Text style={[styles.bubbleEdited, isOwn && styles.bubbleTimeOwn]}>edited</Text>
          )}
          <MessageStatusIcon status={message.status} isOwn={isOwn} />
        </View>
        {message.reactions.length > 0 && (
          <View style={styles.reactionsRow}>
            {message.reactions.map(r => (
              <Text key={r.id} style={styles.reactionEmoji}>{r.reaction}</Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function OwnerConversationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { conversation, messages, participants, loading, error, typingUsers, sendTyping } = useConversation(id || null);
  const { sendMessage, editMessage, deleteMessage, addReaction } = useMessageMutations();
  const { templates } = useMessageTemplates();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageListItem | null>(null);
  const [actionMessage, setActionMessage] = useState<MessageListItem | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingMessage, setEditingMessage] = useState<MessageListItem | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const otherParticipant = participants.find(p => p.user_id !== user?.id);
  const headerTitle = otherParticipant?.profile?.full_name || conversation?.title || 'Conversation';

  const typingNames = typingUsers.map(t => t.name.split(' ')[0]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    if (value.trim()) {
      sendTyping();
    }
  }, [sendTyping]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to attach images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingAttachment(true);
      try {
        const asset = result.assets[0];
        const ext = asset.uri.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}.${ext}`;
        const filePath = `${user?.id}/${id}/${fileName}`;

        const supabase = getSupabaseClient();

        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, arrayBuffer, {
            contentType: asset.mimeType || 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(filePath);

        setPendingAttachments(prev => [...prev, urlData.publicUrl]);
      } catch (err: any) {
        Alert.alert('Upload failed', err.message || 'Could not upload image');
      } finally {
        setUploadingAttachment(false);
      }
    }
  };

  const handleMessageAction = useCallback((message: MessageListItem) => {
    setActionMessage(message);
  }, []);

  const handleReply = useCallback((message: MessageListItem) => {
    setReplyTo(message);
    setActionMessage(null);
  }, []);

  const handleEdit = useCallback((message: MessageListItem) => {
    setEditingMessage(message);
    setText(message.content);
    setActionMessage(null);
  }, []);

  const handleDelete = useCallback(async (message: MessageListItem) => {
    setActionMessage(null);
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(message.id);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete message');
          }
        },
      },
    ]);
  }, [deleteMessage]);

  const handleReaction = useCallback(async (messageId: string, reaction: string) => {
    setActionMessage(null);
    try {
      await addReaction(messageId, reaction);
    } catch (err: any) {
      // Ignore duplicate reaction errors
    }
  }, [addReaction]);

  const handleTemplateSelect = useCallback((content: string) => {
    const rendered = renderMessageTemplate(content, {
      tenant_name: otherParticipant?.profile?.full_name?.split(' ')[0] || 'there',
      owner_name: (user as any)?.user_metadata?.full_name?.split(' ')[0] || '',
      property_address: conversation?.property_id ? 'the property' : '',
    });
    setText(rendered);
    setShowTemplates(false);
  }, [otherParticipant, user, conversation]);

  const handleSend = async () => {
    if (!id || (!text.trim() && pendingAttachments.length === 0) || sending) return;

    const messageText = text.trim();
    const attachments = [...pendingAttachments];
    setText('');
    setPendingAttachments([]);
    setSending(true);

    // If editing, update existing message
    if (editingMessage) {
      try {
        await editMessage(editingMessage.id, messageText);
        setEditingMessage(null);
      } catch (err: any) {
        setText(messageText);
        Alert.alert('Error', err.message || 'Failed to edit message');
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      const msg = await sendMessage({
        conversation_id: id,
        content: messageText || (attachments.length > 0 ? 'Sent an image' : ''),
        content_type: attachments.length > 0 && !messageText ? 'image' : 'text',
        reply_to_id: replyTo?.id,
      });
      setReplyTo(null);

      // Insert attachment records
      if (attachments.length > 0 && msg) {
        const supabase = getSupabaseClient();
        for (const url of attachments) {
          await (supabase.from('message_attachments') as ReturnType<typeof supabase.from>)
            .insert({
              message_id: msg.id,
              file_name: url.split('/').pop() || 'attachment',
              file_type: 'image/jpeg',
              file_size: 0,
              storage_path: url,
            });
        }
      }
    } catch (err) {
      setText(messageText);
      setPendingAttachments(attachments);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !conversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conversation</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Conversation not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          {conversation.property_id && (
            <Text style={styles.headerSubtitle}>
              {conversation.conversation_type.replace(/_/g, ' ')}
            </Text>
          )}
        </View>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => {
            const isOwn = item.sender_id === user?.id;
            const showSender = !isOwn && (
              index === 0 || messages[index - 1].sender_id !== item.sender_id
            );

            return (
              <>
                {shouldShowDateHeader(messages, index) && (
                  <View style={styles.dateHeader}>
                    <Text style={styles.dateHeaderText}>
                      {formatDateHeader(item.created_at)}
                    </Text>
                  </View>
                )}
                <MessageBubble
                  message={item}
                  isOwn={isOwn}
                  showSender={showSender}
                  onLongPress={handleMessageAction}
                  onReplyPress={handleReply}
                />
              </>
            );
          }}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListFooterComponent={<TypingIndicator names={typingNames} />}
        />

        {pendingAttachments.length > 0 && (
          <View style={styles.attachmentBar}>
            {pendingAttachments.map((uri, i) => (
              <AttachmentPreview
                key={uri}
                uri={uri}
                onRemove={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </View>
        )}

        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarContent}>
              <Text style={styles.replyBarLabel}>Replying to {replyTo.sender?.full_name || 'message'}</Text>
              <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.content}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyBarClose}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        {editingMessage && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarContent}>
              <Text style={[styles.replyBarLabel, { color: THEME.colors.warning }]}>Editing message</Text>
              <Text style={styles.replyBarText} numberOfLines={1}>{editingMessage.content}</Text>
            </View>
            <TouchableOpacity onPress={() => { setEditingMessage(null); setText(''); }} style={styles.replyBarClose}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickImage}
            disabled={uploadingAttachment}
          >
            {uploadingAttachment ? (
              <ActivityIndicator size="small" color={THEME.colors.textTertiary} />
            ) : (
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowTemplates(true)}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
            placeholderTextColor={THEME.colors.textTertiary}
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={5000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() && pendingAttachments.length === 0 || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={(!text.trim() && pendingAttachments.length === 0) || sending}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Message Action Modal */}
      <Modal visible={!!actionMessage} transparent animationType="fade" onRequestClose={() => setActionMessage(null)}>
        <TouchableWithoutFeedback onPress={() => setActionMessage(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.actionSheet}>
                {actionMessage && (
                  <>
                    <View style={styles.quickReactions}>
                      {QUICK_REACTIONS.map(emoji => (
                        <TouchableOpacity key={emoji} style={styles.quickReactionButton} onPress={() => handleReaction(actionMessage.id, emoji)}>
                          <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.actionItem} onPress={() => handleReply(actionMessage)}>
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M9 17H5l4-4M5 17v-1a7 7 0 017-7h5" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.actionText}>Reply</Text>
                    </TouchableOpacity>
                    {actionMessage.sender_id === user?.id && (
                      <>
                        <TouchableOpacity style={styles.actionItem} onPress={() => handleEdit(actionMessage)}>
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                          <Text style={styles.actionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionItem} onPress={() => handleDelete(actionMessage)}>
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke={THEME.colors.error} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                          <Text style={[styles.actionText, { color: THEME.colors.error }]}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Template Selector Modal */}
      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <TouchableWithoutFeedback onPress={() => setShowTemplates(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.templateSheet}>
                <Text style={styles.templateTitle}>Message Templates</Text>
                <FlatList
                  data={templates}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.templateItem} onPress={() => handleTemplateSelect(item.content)}>
                      <Text style={styles.templateName}>{item.name}</Text>
                      <Text style={styles.templatePreview} numberOfLines={2}>{item.content}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.templateEmpty}>No templates available</Text>
                  }
                  style={styles.templateList}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'capitalize',
  },
  headerRight: {
    width: 44,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: THEME.spacing.md,
  },
  dateHeaderText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    backgroundColor: THEME.colors.canvas,
    paddingHorizontal: THEME.spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.xs,
    alignItems: 'flex-end',
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.xs,
  },
  bubbleAvatarText: {
    fontSize: 11,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textSecondary,
  },
  bubbleAvatarSpacer: {
    width: 28 + 4,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: THEME.radius.lg,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs + 2,
  },
  bubbleOwn: {
    backgroundColor: THEME.colors.brand,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: THEME.colors.surface,
    borderBottomLeftRadius: 4,
    ...THEME.shadow.sm,
  },
  bubbleSenderName: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.brand,
    marginBottom: 2,
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: THEME.colors.brand,
    paddingLeft: THEME.spacing.xs,
    marginBottom: 4,
    opacity: 0.7,
  },
  replyText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
  },
  attachmentsContainer: {
    marginBottom: 4,
  },
  messageAttachmentImage: {
    width: 200,
    height: 150,
    borderRadius: THEME.radius.md,
    marginBottom: 4,
  },
  bubbleContent: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    lineHeight: 20,
  },
  bubbleContentOwn: {
    color: THEME.colors.textInverse,
  },
  bubbleMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  bubbleTime: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
  },
  bubbleTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  bubbleEdited: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
  },
  reactionsRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  typingRow: {
    paddingHorizontal: THEME.spacing.xs,
    paddingVertical: 4,
    marginLeft: 32,
  },
  typingText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic',
  },
  attachmentBar: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.xs,
    gap: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  attachmentPreview: {
    position: 'relative',
  },
  attachmentThumb: {
    width: 60,
    height: 60,
    borderRadius: THEME.radius.md,
  },
  attachmentRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    gap: THEME.spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    maxHeight: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  errorText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
    textAlign: 'center',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.brand,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarLabel: {
    fontSize: THEME.fontSize.caption,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.brand,
    marginBottom: 2,
  },
  replyBarText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  replyBarClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius.lg + 4,
    borderTopRightRadius: THEME.radius.lg + 4,
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.xl + 20,
  },
  quickReactions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    marginBottom: THEME.spacing.xs,
  },
  quickReactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickReactionEmoji: {
    fontSize: 22,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  actionText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
  },
  templateSheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius.lg + 4,
    borderTopRightRadius: THEME.radius.lg + 4,
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.xl + 20,
    maxHeight: '60%',
  },
  templateTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  templateList: {
    flex: 1,
  },
  templateItem: {
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  templateName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  templatePreview: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
  },
  templateEmpty: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    paddingVertical: THEME.spacing.xl,
  },
});
