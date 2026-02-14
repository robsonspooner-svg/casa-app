import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useAgentChat, AgentMessage, useMyTenancy, useMyMaintenance, getSupabaseClient, useAuth } from '@casa/api';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function getToolSummary(toolCalls: unknown): string {
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) return '';
  const actions: string[] = [];
  const lookups: string[] = [];
  for (const tc of toolCalls) {
    const name = (tc as any).name || (tc as any).type || '';
    const lower = name.toLowerCase();
    if (lower.includes('create') || lower.includes('update') || lower.includes('send') || lower.includes('submit') || lower.includes('generate') || lower.includes('approve') || lower.includes('reject') || lower.includes('record') || lower.includes('upload')) {
      actions.push(name);
    } else {
      lookups.push(name);
    }
  }
  const parts: string[] = [];
  if (actions.length > 0) parts.push(`${actions.length} action${actions.length > 1 ? 's' : ''}`);
  if (lookups.length > 0) parts.push(`${lookups.length} lookup${lookups.length > 1 ? 's' : ''}`);
  return parts.join(', ');
}

function ToolCallSummary({ toolCalls }: { toolCalls: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  const summary = getToolSummary(toolCalls);

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
          {summary || `${toolCalls.length} tool${toolCalls.length > 1 ? 's' : ''} used`}
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

function InlineActionCards({
  actions,
  onApprove,
  onReject,
}: {
  actions: Array<{
    id: string;
    type: string;
    label: string;
    description?: string;
    status?: string;
    navigation_target?: string;
  }>;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
}) {
  return (
    <View style={styles.inlineActionsContainer}>
      {actions.map((action) => (
        <View key={action.id} style={styles.inlineActionCard}>
          <View style={styles.inlineActionHeader}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.inlineActionIcon}>
              <Path
                d={action.type === 'navigation'
                  ? 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3'
                  : 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'}
                stroke={action.type === 'navigation' ? THEME.colors.brandIndigo : THEME.colors.brand}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <View style={styles.inlineActionInfo}>
              <Text style={styles.inlineActionLabel}>{action.label}</Text>
              {action.description && (
                <Text style={styles.inlineActionDesc}>{action.description}</Text>
              )}
            </View>
          </View>
          {action.status === 'approved' || action.status === 'rejected' ? (
            <View style={styles.inlineActionResolved}>
              <Text style={[
                styles.inlineActionResolvedText,
                { color: action.status === 'approved' ? THEME.colors.success : THEME.colors.textTertiary },
              ]}>
                {action.status === 'approved' ? 'Approved' : 'Declined'}
              </Text>
            </View>
          ) : action.type === 'navigation' ? (
            <TouchableOpacity
              style={styles.inlineNavBtn}
              onPress={() => {
                if (action.navigation_target) {
                  router.push(action.navigation_target as any);
                }
                onApprove(action.id);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.inlineNavBtnText}>View</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12h14M12 5l7 7-7 7" stroke={THEME.colors.brandIndigo} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ) : (
            <View style={styles.inlineActionButtons}>
              <TouchableOpacity
                style={styles.inlineApproveBtn}
                onPress={() => onApprove(action.id)}
                activeOpacity={0.7}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.inlineApproveBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inlineRejectBtn}
                onPress={() => onReject(action.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.inlineRejectBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function formatMessageContent(content: string): string {
  let text = content;
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  text = text.replace(/^[-*]\s+/gm, '• ');
  text = text.replace(/^(\d+)\.\s+/gm, '$1. ');
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

const THINKING_PHRASES = [
  'Thinking...',
  'Checking your tenancy...',
  'Looking into it...',
  'Working on it...',
  'Reviewing details...',
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

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % THINKING_PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

interface SuggestionChip {
  label: string;
  message: string;
  priority: number;
}

function useTenantSuggestionChips() {
  const { tenancy } = useMyTenancy();
  const { requests } = useMyMaintenance();
  const { user } = useAuth();
  const [extraData, setExtraData] = useState<{
    inArrears: boolean;
    upcomingInspection: boolean;
    pendingDocuments: number;
  }>({ inArrears: false, upcomingInspection: false, pendingDocuments: 0 });

  useEffect(() => {
    if (!user || !tenancy) return;

    let cancelled = false;
    const fetchExtraContext = async () => {
      try {
        const supabase = getSupabaseClient();

        // Check for active arrears records for this tenant
        const { data: arrearsData } = await (supabase
          .from('arrears_records') as ReturnType<typeof supabase.from>)
          .select('id')
          .eq('tenant_id', user.id)
          .eq('is_resolved', false)
          .limit(1);

        // Check for upcoming inspections on the tenancy's property
        const now = new Date().toISOString().split('T')[0];
        const { data: inspectionData } = await (supabase
          .from('inspections') as ReturnType<typeof supabase.from>)
          .select('id')
          .eq('property_id', tenancy.property_id)
          .in('status', ['scheduled'])
          .gte('scheduled_date', now)
          .limit(1);

        // Check for documents pending tenant signature (lease sent but not fully signed)
        const hasUnsignedLease = tenancy.lease_sent_at && !tenancy.all_signed_at;

        if (!cancelled) {
          setExtraData({
            inArrears: (arrearsData && arrearsData.length > 0) || false,
            upcomingInspection: (inspectionData && inspectionData.length > 0) || false,
            pendingDocuments: hasUnsignedLease ? 1 : 0,
          });
        }
      } catch {
        // Silently fail -- suggestion chips are non-critical
      }
    };

    fetchExtraContext();
    return () => { cancelled = true; };
  }, [user, tenancy]);

  return useMemo(() => {
    const chips: SuggestionChip[] = [];

    // No tenancy: offer connection flow
    if (!tenancy) {
      chips.push({
        label: 'Connect with my landlord',
        message: 'I have a connection code from my landlord',
        priority: 0,
      });
      chips.push({
        label: 'When is my rent due?',
        message: 'When is my rent due?',
        priority: 90,
      });
      chips.push({
        label: 'What are my lease terms?',
        message: 'What are my lease terms?',
        priority: 91,
      });
      return chips.map(c => ({ label: c.label, message: c.message }));
    }

    // 1. Rent due within 3 days
    if (tenancy.rent_due_day) {
      const today = new Date();
      const currentDay = today.getDate();
      const dueDay = tenancy.rent_due_day;
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      // Calculate days until next rent due
      let daysUntilDue = dueDay - currentDay;
      if (daysUntilDue < 0) daysUntilDue += daysInMonth;
      if (daysUntilDue <= 3) {
        chips.push({
          label: 'Pay my rent',
          message: "I'd like to pay my rent",
          priority: 1,
        });
      }
    }

    // 2. Active maintenance request(s)
    const openRequests = requests.filter(
      r => r.status !== 'completed' && r.status !== 'cancelled'
    );
    if (openRequests.length > 0) {
      chips.push({
        label: 'Check repair status',
        message: 'Can you give me an update on my maintenance request?',
        priority: 2,
      });
    }

    // 3. Upcoming inspection
    if (extraData.upcomingInspection) {
      chips.push({
        label: 'View inspection details',
        message: 'Can you show me details about my upcoming inspection?',
        priority: 3,
      });
    }

    // 4. In arrears
    if (extraData.inArrears) {
      chips.push({
        label: 'Discuss payment options',
        message: "I'd like to discuss payment options for my overdue rent",
        priority: 4,
      });
    }

    // 5. Lease expiring within 90 days
    if (tenancy.lease_end_date) {
      const leaseEnd = new Date(tenancy.lease_end_date);
      const daysUntilEnd = Math.floor(
        (leaseEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilEnd <= 90 && daysUntilEnd > 0) {
        chips.push({
          label: 'Ask about renewal',
          message: 'My lease is expiring soon. What are my renewal options?',
          priority: 5,
        });
      }
    }

    // 6. Documents pending signature
    if (extraData.pendingDocuments > 0) {
      chips.push({
        label: 'View documents to sign',
        message: 'Are there any documents I need to sign?',
        priority: 6,
      });
    }

    // Fallback suggestions if few contextual chips
    if (openRequests.length === 0) {
      chips.push({
        label: 'Report a maintenance issue',
        message: 'I need to report a maintenance issue',
        priority: 80,
      });
    }
    chips.push({
      label: 'When is my rent due?',
      message: 'When is my rent due?',
      priority: 90,
    });
    chips.push({
      label: 'What are my lease terms?',
      message: 'What are my lease terms?',
      priority: 91,
    });

    // Sort by priority, take the top 5
    chips.sort((a, b) => a.priority - b.priority);
    const unique = chips.filter(
      (chip, idx, arr) => arr.findIndex(c => c.label === chip.label) === idx
    );
    return unique.slice(0, 5).map(c => ({ label: c.label, message: c.message }));
  }, [tenancy, requests, extraData]);
}

function EmptyState({ onSuggestionSelect }: { onSuggestionSelect: (text: string) => void }) {
  const chips = useTenantSuggestionChips();

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
          Ask anything about your rent, maintenance, lease, or tenancy. Casa will handle it.
        </Text>
      </View>
      <View style={styles.emptyChipsWrap}>
        {chips.map(chip => (
          <TouchableOpacity
            key={chip.label}
            style={styles.emptyChip}
            onPress={() => onSuggestionSelect(chip.message)}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyChipText}>{chip.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function InlineChips({ onSelect }: { onSelect: (text: string) => void }) {
  const chips = useTenantSuggestionChips();

  return (
    <View style={styles.inlineChipsRow}>
      {chips.slice(0, 3).map(chip => (
        <TouchableOpacity
          key={chip.label}
          style={styles.inlineChip}
          onPress={() => onSelect(chip.message)}
          activeOpacity={0.7}
        >
          <Text style={styles.inlineChipText} numberOfLines={1}>{chip.label}</Text>
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

  const [inputText, setInputText] = useState('');
  const [sendStartTime, setSendStartTime] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const subtitle = useMemo(() => {
    if (sending) return 'Working on your request...';
    if (error && error.includes('retrying')) return 'Busy — retrying...';
    return 'Help with your tenancy';
  }, [sending, error]);

  const handleSend = async (text?: string) => {
    const messageText = (text || inputText).trim();
    if (!messageText || sending) return;

    setInputText('');
    setSendStartTime(Date.now());

    if (!currentConversation) {
      await startNewConversation();
    }

    await sendMessage(messageText);
  };

  const handleSuggestionSelect = (text: string) => {
    handleSend(text);
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
          onPress={() => clearError()}
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
