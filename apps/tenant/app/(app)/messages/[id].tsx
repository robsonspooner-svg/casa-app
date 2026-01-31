// Conversation View (Chat) - Tenant
// Mission 12: In-App Communications
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useConversation, useMessageMutations, useAuth, getSupabaseClient } from '@casa/api';
import type { MessageListItem } from '@casa/api/src/hooks/useConversation';

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

function AttachmentPreview({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  return (
    <View style={styles.attachmentPreview}>
      <Image source={{ uri }} style={styles.attachmentThumb} />
      <TouchableOpacity style={styles.attachmentRemove} onPress={onRemove}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6L6 18M6 6l12 12" stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

function MessageBubble({
  message,
  isOwn,
  showSender,
}: {
  message: MessageListItem;
  isOwn: boolean;
  showSender: boolean;
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
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
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
        </View>
        {message.reactions.length > 0 && (
          <View style={styles.reactionsRow}>
            {message.reactions.map(r => (
              <Text key={r.id} style={styles.reactionEmoji}>{r.reaction}</Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function TenantConversationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { conversation, messages, participants, loading, error, typingUsers, sendTyping } = useConversation(id || null);
  const { sendMessage } = useMessageMutations();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const otherParticipant = participants.find(p => p.user_id !== user?.id);
  const headerTitle = otherParticipant?.profile?.full_name || conversation?.title || 'Landlord';

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

  const handleSend = async () => {
    if (!id || (!text.trim() && pendingAttachments.length === 0) || sending) return;

    const messageText = text.trim();
    const attachments = [...pendingAttachments];
    setText('');
    setPendingAttachments([]);
    setSending(true);

    try {
      const msg = await sendMessage({
        conversation_id: id,
        content: messageText || (attachments.length > 0 ? 'Sent an image' : ''),
        content_type: attachments.length > 0 && !messageText ? 'image' : 'text',
      });

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
                <MessageBubble message={item} isOwn={isOwn} showSender={showSender} />
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
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
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
              <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    color: '#FFFFFF',
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
});
