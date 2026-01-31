import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Keyboard,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useAgentChat, AgentMessage } from '@casa/api';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function ToolCallSummary({ toolCalls }: { toolCalls: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  return (
    <TouchableOpacity
      style={styles.toolCallContainer}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.toolCallHeader}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
            stroke={THEME.colors.brandIndigo}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.toolCallTitle}>
          {toolCalls.length} tool{toolCalls.length > 1 ? 's' : ''} used
        </Text>
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
          <Path
            d={expanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}
            stroke={THEME.colors.textTertiary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      {expanded && (
        <View style={styles.toolCallDetails}>
          {toolCalls.map((tc: { name?: string; type?: string }, idx: number) => (
            <Text key={idx} style={styles.toolCallItem}>
              {tc.name || tc.type || `Tool ${idx + 1}`}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  const isProactive = message.role === 'proactive';

  return (
    <View style={[styles.messageBubbleRow, isUser ? styles.userRow : styles.agentRow]}>
      {!isUser && (
        <View style={styles.agentAvatar}>
          <Image
            source={require('../../../assets/casa_logo.png')}
            style={styles.agentAvatarImage}
          />
        </View>
      )}
      <View style={styles.messageColumn}>
        {isProactive && (
          <View style={styles.proactiveBadge}>
            <Text style={styles.proactiveBadgeText}>PROACTIVE</Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.agentBubble,
          ]}
        >
          <Text style={[styles.messageText, isUser ? styles.userText : styles.agentText]}>
            {message.content}
          </Text>
          <ToolCallSummary toolCalls={message.tool_calls} />
        </View>
        <Text style={[styles.messageTime, isUser ? styles.userTime : styles.agentTime]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, [dot1, dot2, dot3]);

  return (
    <View style={[styles.messageBubbleRow, styles.agentRow]}>
      <View style={styles.agentAvatar}>
        <Image
          source={require('../../../assets/casa_logo.png')}
          style={styles.agentAvatarImage}
        />
      </View>
      <View style={[styles.messageBubble, styles.agentBubble, styles.typingBubble]}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { opacity: Animated.add(0.3, Animated.multiply(dot, 0.7)) }]}
          />
        ))}
      </View>
    </View>
  );
}

function EmptyState({ onStartChat }: { onStartChat: () => void }) {
  return (
    <TouchableOpacity
      style={styles.emptyState}
      activeOpacity={1}
      onPress={Keyboard.dismiss}
    >
      <View style={styles.emptyIconContainer}>
        <Image
          source={require('../../../assets/casa_logo.png')}
          style={styles.emptyLogoImage}
        />
      </View>
      <Text style={styles.emptyTitle}>Chat with Casa</Text>
      <Text style={styles.emptyText}>
        Ask about your rent, maintenance, lease, or anything else about your tenancy.
      </Text>
      <View style={styles.suggestionsContainer}>
        {[
          'When is my rent due?',
          'I need to report a maintenance issue',
          'What are my lease terms?',
        ].map((suggestion) => (
          <TouchableOpacity
            key={suggestion}
            style={styles.suggestionChip}
            onPress={() => onStartChat()}
            activeOpacity={0.7}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const {
    messages,
    currentConversation,
    loading,
    sending,
    error,
    sendMessage,
    startNewConversation,
  } = useAgentChat();

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');

    if (!currentConversation) {
      const conversationId = await startNewConversation();
      if (conversationId) {
        await sendMessage(text, conversationId);
      }
    } else {
      await sendMessage(text);
    }
  };

  const handleStartChat = async () => {
    if (!currentConversation) {
      await startNewConversation();
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const hasMessages = messages.length > 0 || currentConversation;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={THEME.components.tabBar.height}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Image
              source={require('../../../assets/casa_logo.png')}
              style={styles.headerAvatarImage}
            />
          </View>
          <View>
            <Text style={styles.title}>Casa</Text>
            <Text style={styles.subtitle}>
              {sending ? 'Thinking...' : 'Help with your tenancy'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => startNewConversation()}
          activeOpacity={0.7}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 5v14M5 12h14"
              stroke={THEME.colors.textPrimary}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : !hasMessages ? (
        <EmptyState onStartChat={handleStartChat} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={sending ? <TypingIndicator /> : null}
        />
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message Casa..."
            placeholderTextColor={THEME.colors.textTertiary}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color={THEME.colors.textInverse} />
            ) : (
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                  stroke={THEME.colors.textInverse}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    paddingTop: THEME.spacing['2xl'],
    paddingBottom: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  title: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.base,
    overflow: 'hidden',
  },
  emptyLogoImage: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: THEME.spacing.lg,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
    marginTop: THEME.spacing.md,
    justifyContent: 'center',
  },
  suggestionChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  suggestionText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  messagesList: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    paddingBottom: THEME.spacing.lg,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.base,
    maxWidth: '85%',
  },
  userRow: {
    alignSelf: 'flex-end',
  },
  agentRow: {
    alignSelf: 'flex-start',
  },
  agentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.sm,
    marginTop: 2,
    overflow: 'hidden',
  },
  agentAvatarImage: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  messageColumn: {
    flex: 1,
  },
  messageBubble: {
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.base,
    borderRadius: THEME.radius.lg,
  },
  userBubble: {
    backgroundColor: THEME.colors.brand,
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: THEME.colors.surface,
    borderBottomLeftRadius: 4,
    ...THEME.shadow.sm,
  },
  messageText: {
    fontSize: THEME.fontSize.body,
    lineHeight: 22,
  },
  userText: {
    color: THEME.colors.textInverse,
  },
  agentText: {
    color: THEME.colors.textPrimary,
  },
  messageTime: {
    fontSize: 10,
    marginTop: THEME.spacing.xs,
  },
  userTime: {
    color: THEME.colors.textTertiary,
    textAlign: 'right',
  },
  agentTime: {
    color: THEME.colors.textTertiary,
  },
  proactiveBadge: {
    backgroundColor: THEME.colors.infoBg,
    paddingVertical: 2,
    paddingHorizontal: THEME.spacing.sm,
    borderRadius: THEME.radius.sm,
    alignSelf: 'flex-start',
    marginBottom: THEME.spacing.xs,
  },
  proactiveBadgeText: {
    fontSize: 9,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.info,
    letterSpacing: 0.5,
  },
  toolCallContainer: {
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  toolCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  toolCallTitle: {
    flex: 1,
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.brandIndigo,
  },
  toolCallDetails: {
    marginTop: THEME.spacing.sm,
    gap: 4,
  },
  toolCallItem: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    paddingLeft: THEME.spacing.base,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: THEME.spacing.base,
    paddingHorizontal: THEME.spacing.lg,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.textTertiary,
  },
  errorContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.errorBg,
  },
  errorText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.error,
  },
  inputBar: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingLeft: THEME.spacing.base,
    paddingRight: THEME.spacing.xs,
    paddingVertical: THEME.spacing.xs,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    maxHeight: 100,
    paddingVertical: THEME.spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: THEME.spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
