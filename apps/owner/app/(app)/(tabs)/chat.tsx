import { useState, useRef, useEffect, useMemo } from 'react';
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import {
  useAgentChat,
  AgentMessage,
  useProperties,
  useAgentContext,
  useArrears,
  useInspections,
  useAgentInsights,
} from '@casa/api';
import type { InlineAction } from '@casa/api';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function formatToolName(name: string): string {
  return name
    .replace(/^handle_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getToolSummary(tc: { name?: string; type?: string; input?: Record<string, unknown>; result?: Record<string, unknown> }): string {
  const name = tc.name || tc.type || 'Unknown';
  const input = tc.input || {};
  const result = tc.result || {};
  const friendly = formatToolName(name);

  if (name.startsWith('create_') && result.id) return `Created: ${(input.title as string) || (input.address_line_1 as string) || friendly}`;
  if (name.startsWith('update_') && input.id) return `Updated: ${friendly.replace('Update ', '')}`;
  if (name.startsWith('get_') || name.startsWith('search_')) return friendly;
  if (name === 'suggest_navigation') return `Navigate: ${(input.label as string) || 'Link'}`;
  return friendly;
}

function ToolCallSummary({ toolCalls }: { toolCalls: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  const actionCount = (toolCalls as { name?: string }[]).filter(tc => {
    const n = tc.name || '';
    return n.startsWith('create_') || n.startsWith('update_') || n.startsWith('delete_') ||
      n.startsWith('send_') || n.startsWith('invite_') || n.startsWith('publish_');
  }).length;
  const queryCount = toolCalls.length - actionCount;

  let headerText = `${toolCalls.length} tool${toolCalls.length > 1 ? 's' : ''} used`;
  if (actionCount > 0 && queryCount > 0) {
    headerText = `${actionCount} action${actionCount > 1 ? 's' : ''}, ${queryCount} lookup${queryCount > 1 ? 's' : ''}`;
  } else if (actionCount > 0) {
    headerText = `${actionCount} action${actionCount > 1 ? 's' : ''} taken`;
  }

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
          {headerText}
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
          {toolCalls.map((tc: { name?: string; type?: string; input?: Record<string, unknown>; result?: Record<string, unknown> }, idx: number) => (
            <Text key={idx} style={styles.toolCallItem}>
              {getToolSummary(tc)}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function InlineActionCards({
  actions,
  onApprove,
  onReject,
}: {
  actions: InlineAction[];
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <View style={styles.inlineActionsContainer}>
      {actions.map((action) => {
        const isResolved = action.status === 'approved' || action.status === 'rejected';

        return (
          <View key={action.id} style={styles.inlineActionCard}>
            <View style={styles.inlineActionHeader}>
              <View style={styles.inlineActionIcon}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke={isResolved
                      ? (action.status === 'approved' ? THEME.colors.success : THEME.colors.textTertiary)
                      : THEME.colors.warning}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.inlineActionInfo}>
                <Text style={styles.inlineActionLabel}>{action.label}</Text>
                {action.description && (
                  <Text style={styles.inlineActionDesc} numberOfLines={2}>{action.description}</Text>
                )}
              </View>
            </View>

            {isResolved ? (
              <View style={styles.inlineActionResolved}>
                <Text style={[
                  styles.inlineActionResolvedText,
                  action.status === 'approved' && { color: THEME.colors.success },
                  action.status === 'rejected' && { color: THEME.colors.textTertiary },
                ]}>
                  {action.status === 'approved' ? 'Approved' : 'Declined'}
                </Text>
              </View>
            ) : action.type === 'approval' && action.pendingActionId ? (
              <View style={styles.inlineActionButtons}>
                <TouchableOpacity
                  style={styles.inlineApproveBtn}
                  onPress={() => onApprove(action.pendingActionId!)}
                  activeOpacity={0.7}
                >
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.inlineApproveBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.inlineRejectBtn}
                  onPress={() => onReject(action.pendingActionId!)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.inlineRejectBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ) : action.type === 'navigation' && action.route ? (
              <TouchableOpacity
                style={styles.inlineNavBtn}
                onPress={() => router.push({ pathname: action.route as any, params: action.params } as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.inlineNavBtnText}>{action.label}</Text>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brandIndigo} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// Strip Markdown formatting from agent responses to render clean text
function formatMessageContent(content: string): string {
  let text = content;
  // Remove heading markers (## **Title** → Title)
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Remove bold/italic markers (**text** or ***text*** → text)
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  // Remove __ bold/italic
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  // Remove inline code backticks
  text = text.replace(/`([^`]+)`/g, '$1');
  // Convert markdown links [text](url) → text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  // Clean up bullet point markers (- item → • item)
  text = text.replace(/^[-*]\s+/gm, '• ');
  // Clean up numbered lists that have **bold** numbers
  text = text.replace(/^(\d+)\.\s+/gm, '$1. ');
  // Collapse multiple blank lines into one
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function FeedbackButtons({
  messageId,
  currentFeedback,
  onFeedback,
}: {
  messageId: string;
  currentFeedback: string | null;
  onFeedback: (messageId: string, feedback: 'positive' | 'negative') => void;
}) {
  return (
    <View style={styles.feedbackRow}>
      <TouchableOpacity
        style={[styles.feedbackBtn, currentFeedback === 'positive' && styles.feedbackBtnActive]}
        onPress={() => onFeedback(messageId, 'positive')}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"
            stroke={currentFeedback === 'positive' ? THEME.colors.success : THEME.colors.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.feedbackBtn, currentFeedback === 'negative' && styles.feedbackBtnNegative]}
        onPress={() => onFeedback(messageId, 'negative')}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"
            stroke={currentFeedback === 'negative' ? THEME.colors.error : THEME.colors.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

function MessageBubble({
  message,
  onApproveAction,
  onRejectAction,
  onFeedback,
}: {
  message: AgentMessage;
  onApproveAction?: (actionId: string) => void;
  onRejectAction?: (actionId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
}) {
  const isUser = message.role === 'user';
  const isProactive = message.role === 'proactive';
  const displayContent = isUser ? message.content : formatMessageContent(message.content);

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
            {displayContent}
          </Text>
          <ToolCallSummary toolCalls={message.tool_calls} />
        </View>
        {!isUser && message.inline_actions && message.inline_actions.length > 0 && (
          <InlineActionCards
            actions={message.inline_actions}
            onApprove={onApproveAction || (() => {})}
            onReject={onRejectAction || (() => {})}
          />
        )}
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isUser ? styles.userTime : styles.agentTime]}>
            {formatTime(message.created_at)}
          </Text>
          {!isUser && onFeedback && !message.id.startsWith('temp-') && (
            <FeedbackButtons
              messageId={message.id}
              currentFeedback={message.feedback}
              onFeedback={onFeedback}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// Thinking phrases that cycle while the agent works
const THINKING_PHRASES = [
  'Thinking...',
  'Checking your properties...',
  'Analysing data...',
  'Looking into it...',
  'Working on it...',
  'Reviewing records...',
  'Processing your request...',
];

function ThinkingIndicator({ startTime, retrying }: { startTime: number; retrying?: string | null }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Dot animation
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

  // Avatar pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Cycle thinking phrases every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % THINKING_PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Elapsed time counter
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const displayPhrase = retrying || THINKING_PHRASES[phraseIndex];

  return (
    <Animated.View style={[styles.messageBubbleRow, styles.agentRow, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.agentAvatar, { transform: [{ scale: pulseAnim }] }]}>
        <Image
          source={require('../../../assets/casa_logo.png')}
          style={styles.agentAvatarImage}
        />
      </Animated.View>
      <View style={styles.messageColumn}>
        <View style={[styles.messageBubble, styles.agentBubble, styles.thinkingBubble]}>
          <View style={styles.thinkingRow}>
            {[dot1, dot2, dot3].map((dot, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.thinkingDot,
                  { opacity: Animated.add(0.3, Animated.multiply(dot, 0.7)) },
                ]}
              />
            ))}
            <Text style={styles.thinkingText}>{displayPhrase}</Text>
          </View>
          {elapsed >= 5 && (
            <Text style={styles.thinkingElapsed}>
              {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function useSuggestionChips() {
  const { properties } = useProperties();
  const { arrears } = useArrears();
  const { inspections } = useInspections({});
  const { insights } = useAgentInsights();

  return useMemo(() => {
    const contextual: string[] = [];
    const defaults = [
      'How are my properties performing?',
      'Generate a financial report',
      "What's happening this week?",
    ];

    // Action-aware: if Casa recently completed actions, surface review chip
    const completedActions = insights.filter(i => i.type === 'success');
    if (completedActions.length > 0) {
      contextual.push('What have you done recently?');
    }

    // Action-aware: if tasks pending input, surface attention chip
    const pendingInput = insights.filter(i => i.type === 'action_needed');
    if (pendingInput.length > 0) {
      contextual.push('What needs my attention?');
    }

    // Context-aware chips based on real data
    const activeArrears = arrears.filter(a => !a.is_resolved);
    if (activeArrears.length > 0) {
      contextual.push("What's the arrears situation?");
    }

    const upcomingInspections = inspections.filter(i => i.status === 'scheduled');
    if (upcomingInspections.length > 0) {
      contextual.push('Tell me about the upcoming inspection');
    }

    const vacantProperties = properties.filter(p => p.status === 'vacant');
    if (vacantProperties.length > 0) {
      const addr = vacantProperties[0].address_line_1;
      contextual.push(`Find me a tenant for ${addr}`);
    }

    // Cap contextual at 3 so we still show some defaults
    return [...contextual.slice(0, 3), ...defaults.slice(0, 3 - Math.min(contextual.length, 3) + 2)];
  }, [properties, arrears, inspections, insights]);
}

function EmptyState({ onSuggestionSelect }: { onSuggestionSelect: (text: string) => void }) {
  const chips = useSuggestionChips();

  return (
    <TouchableOpacity
      style={styles.emptyState}
      activeOpacity={1}
      onPress={Keyboard.dismiss}
    >
      <View style={styles.emptyContent}>
        <View style={styles.emptyIconContainer}>
          <Image
            source={require('../../../assets/casa_logo.png')}
            style={styles.emptyLogoImage}
          />
        </View>
        <Text style={styles.emptyTitle}>Chat with Casa</Text>
        <Text style={styles.emptyText}>
          Ask anything about your properties, tenants, or finances. Casa will handle it.
        </Text>
      </View>
      <View style={styles.emptyChipsWrap}>
        {chips.map(chip => (
          <TouchableOpacity
            key={chip}
            style={styles.emptyChip}
            onPress={() => onSuggestionSelect(chip)}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyChipText}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function InlineChips({ onSelect }: { onSelect: (text: string) => void }) {
  const chips = useSuggestionChips();

  return (
    <View style={styles.inlineChipsRow}>
      {chips.slice(0, 3).map(chip => (
        <TouchableOpacity
          key={chip}
          style={styles.inlineChip}
          onPress={() => onSelect(chip)}
          activeOpacity={0.7}
        >
          <Text style={styles.inlineChipText} numberOfLines={1}>{chip}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const {
    messages,
    currentConversation,
    loading,
    sending,
    error,
    sendMessage,
    startNewConversation,
    approveAction,
    rejectAction,
    submitFeedback,
    clearError,
  } = useAgentChat();

  const { properties } = useProperties();
  const { pendingCount } = useAgentContext();

  const [inputText, setInputText] = useState('');
  const [sendStartTime, setSendStartTime] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const subtitle = useMemo(() => {
    if (sending) return 'Working on your request...';
    if (error && error.includes('retrying')) return 'Busy — retrying...';
    if (pendingCount > 0) return `Working on ${pendingCount} task${pendingCount === 1 ? '' : 's'}`;
    if (properties.length > 0) return `Managing ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}`;
    return 'All caught up';
  }, [sending, error, pendingCount, properties.length]);

  const handleSend = async (text?: string) => {
    const messageText = (text || inputText).trim();
    if (!messageText || sending) return;

    setInputText('');
    setSendStartTime(Date.now());

    if (!currentConversation) {
      // Reset state for a fresh conversation — edge function creates the
      // conversation row when it receives the first message with no ID.
      await startNewConversation();
    }

    await sendMessage(messageText);
  };

  const handleSuggestionSelect = (text: string) => {
    handleSend(text);
  };

  // Auto-scroll to bottom when new messages arrive
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
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Image
              source={require('../../../assets/casa_logo.png')}
              style={styles.headerAvatarImage}
            />
          </View>
          <View>
            <Text style={styles.title}>Casa</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(app)/chat-history' as any)}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 8v4l3 3M3 12a9 9 0 1018 0 9 9 0 00-18 0z"
                stroke={THEME.colors.textPrimary}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
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
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : !hasMessages ? (
        <EmptyState onSuggestionSelect={handleSuggestionSelect} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onApproveAction={approveAction}
              onRejectAction={rejectAction}
              onFeedback={submitFeedback}
            />
          )}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={sending ? <ThinkingIndicator startTime={sendStartTime} retrying={error && error.includes('retrying') ? error : null} /> : null}
        />
      )}

      {error && !sending && (
        <TouchableOpacity
          style={[
            styles.errorContainer,
            error.includes('retrying') && styles.retryingContainer,
          ]}
          onPress={() => {
            // Clear the error on tap so user can try again
            clearError();
          }}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.errorText,
            error.includes('retrying') && styles.retryingText,
          ]}>
            {error}
          </Text>
          {!error.includes('retrying') && (
            <Text style={styles.errorDismissHint}>Tap to dismiss</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Suggestion chips above input when conversation active */}
      {hasMessages && !sending && (
        <InlineChips onSelect={handleSuggestionSelect} />
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
            onSubmitEditing={() => handleSend()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSend()}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
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
  // Empty state — centered content with wrapped chips at bottom
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyContent: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.sm,
    overflow: 'hidden',
  },
  emptyLogoImage: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  emptyTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.xs,
  },
  emptyText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Empty state chips — wrapped flow layout
  emptyChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: THEME.spacing.sm,
  },
  emptyChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyChipText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  // Inline chips — shown above input during active conversation
  inlineChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: THEME.colors.canvas,
  },
  inlineChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
  },
  inlineChipText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Messages list
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: THEME.spacing.xs,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedbackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBtnActive: {
    backgroundColor: THEME.colors.successBg,
  },
  feedbackBtnNegative: {
    backgroundColor: THEME.colors.errorBg,
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
  // Tool calls
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
  // Thinking indicator
  thinkingBubble: {
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.base,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.brand,
  },
  thinkingText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  thinkingElapsed: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    marginTop: 4,
  },
  // Error
  errorContainer: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.errorBg,
  },
  errorText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.error,
  },
  errorDismissHint: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.error,
    opacity: 0.6,
    marginTop: 2,
  },
  retryingContainer: {
    backgroundColor: THEME.colors.warningBg,
  },
  retryingText: {
    color: THEME.colors.warning,
  },
  // Input bar
  inputBar: {
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.sm,
    paddingBottom: THEME.spacing.xs,
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
  // Inline action cards (shown below agent messages)
  inlineActionsContainer: {
    marginTop: THEME.spacing.sm,
    gap: THEME.spacing.sm,
  },
  inlineActionCard: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  inlineActionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: THEME.spacing.sm,
  },
  inlineActionIcon: {
    marginTop: 2,
  },
  inlineActionInfo: {
    flex: 1,
    gap: 2,
  },
  inlineActionLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  inlineActionDesc: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  inlineActionButtons: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  inlineApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  inlineApproveBtnText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textInverse,
  },
  inlineRejectBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    borderRadius: THEME.radius.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  inlineRejectBtnText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textSecondary,
  },
  inlineNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.subtle,
  },
  inlineNavBtnText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.brandIndigo,
  },
  inlineActionResolved: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.xs,
  },
  inlineActionResolvedText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold,
  },
});
