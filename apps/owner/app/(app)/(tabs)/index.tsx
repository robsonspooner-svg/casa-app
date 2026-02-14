import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import {
  useAuth,
  useProfile,
  useProperties,
  useAgentContext,
  useDashboard,
  useActivityFeed,
  useAgentTasks,
  useAgentInsights,
  useOwnerPayouts,
  getSupabaseClient,
} from '@casa/api';
import type { ActivityFeedItem, PendingApprovalItem, AgentInsight } from '@casa/api';
import { formatDateCompact, successFeedback, warningFeedback, lightTap } from '@casa/ui';
import Svg, { Path, Circle } from 'react-native-svg';
import { NotificationBell } from '../../../components/NotificationBell';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// formatTimeAgo replaced by formatDateCompact from @casa/ui

// Casa Logo — uses actual brand logo PNG
function CasaLogoMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={require('../../../assets/casa_logo.png')}
      style={{ width: size, height: size, resizeMode: 'contain' }}
    />
  );
}

function CasaWordmark({ height = 20, color }: { height?: number; color?: string }) {
  return (
    <Image
      source={require('../../../assets/casa.png')}
      style={{ height, width: height * 3.5, resizeMode: 'contain', tintColor: color }}
    />
  );
}

// Activity feed icon config based on item type
function getItemConfig(type: ActivityFeedItem['type']): { bg: string; color: string; icon: 'dollar' | 'wrench' | 'clipboard' | 'alert' | 'calendar' | 'check' | 'bot' | 'clock' | 'user' | 'mail' } {
  switch (type) {
    case 'rent_collected':
      return { bg: THEME.colors.successBg, color: THEME.colors.success, icon: 'dollar' };
    case 'rent_overdue':
      return { bg: THEME.colors.errorBg, color: THEME.colors.error, icon: 'alert' };
    case 'inspection_scheduled':
      return { bg: THEME.colors.infoBg, color: THEME.colors.info, icon: 'calendar' };
    case 'inspection_completed':
      return { bg: THEME.colors.successBg, color: THEME.colors.success, icon: 'clipboard' };
    case 'maintenance_reported':
      return { bg: THEME.colors.warningBg, color: THEME.colors.warning, icon: 'wrench' };
    case 'maintenance_completed':
      return { bg: THEME.colors.successBg, color: THEME.colors.success, icon: 'check' };
    case 'lease_expiring':
      return { bg: THEME.colors.warningBg, color: THEME.colors.warning, icon: 'calendar' };
    case 'arrears_detected':
      return { bg: THEME.colors.errorBg, color: THEME.colors.error, icon: 'alert' };
    case 'tenant_application':
      return { bg: THEME.colors.infoBg, color: THEME.colors.info, icon: 'user' };
    case 'agent_task_completed':
      return { bg: THEME.colors.successBg, color: THEME.colors.success, icon: 'bot' };
    case 'agent_task_in_progress':
      return { bg: THEME.colors.infoBg, color: THEME.colors.brandIndigo, icon: 'clock' };
    case 'agent_pending_input':
      return { bg: THEME.colors.warningBg, color: THEME.colors.warning, icon: 'alert' };
    case 'reminder_sent':
      return { bg: THEME.colors.infoBg, color: THEME.colors.info, icon: 'mail' };
    case 'message_received':
      return { bg: THEME.colors.infoBg, color: THEME.colors.info, icon: 'mail' };
    case 'casa_proactive':
      return { bg: THEME.colors.successBg, color: THEME.colors.success, icon: 'bot' };
    default:
      return { bg: THEME.colors.subtle, color: THEME.colors.textSecondary, icon: 'bot' };
  }
}

function FeedIcon({ type, color }: { type: string; color: string }) {
  const size = 16;
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };

  switch (type) {
    case 'dollar':
      return <Svg {...props}><Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'wrench':
      return <Svg {...props}><Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'clipboard':
      return <Svg {...props}><Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'alert':
      return <Svg {...props}><Path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'calendar':
      return <Svg {...props}><Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'check':
      return <Svg {...props}><Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'bot':
      return <Svg {...props}><Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'clock':
      return <Svg {...props}><Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} /><Path d="M12 6v6l4 2" stroke={color} strokeWidth={1.5} strokeLinecap="round" /></Svg>;
    case 'user':
      return <Svg {...props}><Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /><Circle cx={12} cy={7} r={4} stroke={color} strokeWidth={1.5} /></Svg>;
    case 'mail':
      return <Svg {...props}><Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /><Path d="M22 6l-10 7L2 6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    default:
      return null;
  }
}

// ── Premium Hero Header ──────────────────────────────────────────────
function HeroHeader({
  displayName,
  pendingCount,
  propertyCount,
}: {
  displayName: string;
  pendingCount: number;
  propertyCount: number;
}) {
  const greeting = getGreeting();
  const statusText = useMemo(() => {
    if (pendingCount > 0) return `${pendingCount} item${pendingCount === 1 ? '' : 's'} need${pendingCount === 1 ? 's' : ''} your attention`;
    if (propertyCount > 0) return 'Everything is on track';
    return 'Get started by adding your first property';
  }, [pendingCount, propertyCount]);

  return (
    <View style={styles.heroContainer}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroBrand}>
          <CasaLogoMark size={32} />
          <CasaWordmark height={22} color={THEME.colors.textInverse} />
        </View>
        <View style={styles.heroActions}>
          <TouchableOpacity
            style={styles.heroIconBtn}
            onPress={() => router.push('/(app)/settings' as any)}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                stroke={THEME.colors.textInverse}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                stroke={THEME.colors.textInverse}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <NotificationBell size={20} color={THEME.colors.textInverse} />
          <TouchableOpacity
            style={styles.heroIconBtn}
            onPress={() => router.push('/(app)/profile' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.heroAvatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.heroBody}>
        <Text style={styles.heroGreeting}>{greeting}, {displayName}</Text>
        <Text style={styles.heroStatus}>{statusText}</Text>
      </View>
    </View>
  );
}

// ── Trial Banner ────────────────────────────────────────────────────
function TrialBanner({ trialEndsAt }: { trialEndsAt: string }) {
  const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <TouchableOpacity
      style={styles.trialBanner}
      onPress={() => router.push('/(app)/subscription/add-payment-method' as any)}
      activeOpacity={0.7}
    >
      <View style={styles.trialBannerContent}>
        <View style={styles.trialBannerLeft}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={10} stroke={THEME.colors.warning} strokeWidth={1.5} />
            <Path d="M12 6v6l4 2" stroke={THEME.colors.warning} strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
          <Text style={styles.trialBannerText}>
            {daysLeft > 0
              ? `Free trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
              : 'Free trial ending today'}
          </Text>
        </View>
        <View style={styles.trialBannerCTA}>
          <Text style={styles.trialBannerCTAText}>Add Card</Text>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Payout Setup Banner ──────────────────────────────────────────────
function PayoutSetupBanner() {
  return (
    <TouchableOpacity
      style={payoutBannerStyles.container}
      onPress={() => router.push('/(app)/payments/onboard' as any)}
      activeOpacity={0.7}
    >
      <View style={payoutBannerStyles.iconContainer}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" stroke={THEME.colors.error} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={payoutBannerStyles.textContainer}>
        <Text style={payoutBannerStyles.title}>Connect your bank account</Text>
        <Text style={payoutBannerStyles.subtitle}>
          Set up payouts so your tenants' rent goes directly to your bank. Takes 2 minutes.
        </Text>
      </View>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );
}

const payoutBannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.errorBg,
    borderWidth: 1,
    borderColor: THEME.colors.error + '40',
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.base,
    gap: THEME.spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.error,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
});

// ── Portfolio Snapshot ────────────────────────────────────────────────
function PortfolioSnapshot({
  revenue,
  propertyCount,
  occupancyRate,
}: {
  revenue: string;
  propertyCount: number;
  occupancyRate: number;
}) {
  return (
    <TouchableOpacity
      style={styles.snapshotCard}
      onPress={() => router.push('/(app)/(tabs)/portfolio' as any)}
      activeOpacity={0.7}
    >
      <View style={styles.snapshotColumn}>
        <Text style={styles.snapshotValue}>{revenue}</Text>
        <Text style={styles.snapshotLabel}>Revenue</Text>
      </View>
      <View style={styles.snapshotDivider} />
      <View style={styles.snapshotColumn}>
        <Text style={styles.snapshotValue}>{propertyCount}</Text>
        <Text style={styles.snapshotLabel}>Properties</Text>
      </View>
      <View style={styles.snapshotDivider} />
      <View style={styles.snapshotColumn}>
        <Text style={styles.snapshotValue}>{occupancyRate}%</Text>
        <Text style={styles.snapshotLabel}>Occupancy</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Needs Attention Card (Rich Decision Card) ──────────────────────
function NeedsAttentionCard({
  item,
  onApprove,
  onReject,
  onAcknowledge,
  onDismiss,
}: {
  item: PendingApprovalItem;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onAcknowledge: (taskId: string) => void;
  onDismiss: (taskId: string) => void;
}) {
  const isAdvisory = item.actionType === 'advisory';
  const [expanded, setExpanded] = useState(false);
  const priorityColor =
    item.priority === 'urgent' ? THEME.colors.error :
    item.priority === 'high' ? THEME.colors.warning :
    THEME.colors.brandIndigo;

  const confidenceLabel = item.confidence != null
    ? item.confidence >= 0.8 ? 'High confidence' : item.confidence >= 0.5 ? 'Medium confidence' : 'Low confidence'
    : null;

  return (
    <TouchableOpacity
      style={styles.attentionCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={[styles.attentionAccent, { backgroundColor: priorityColor }]} />
      <View style={styles.attentionBody}>
        <View style={styles.attentionTop}>
          <View style={styles.attentionMeta}>
            <View style={[styles.attentionPriorityPill, { backgroundColor: priorityColor + '18' }]}>
              <Text style={[styles.attentionPriorityText, { color: priorityColor }]}>
                {item.priority === 'urgent' ? 'Urgent' : item.priority === 'high' ? 'High' : 'Normal'}
              </Text>
            </View>
            <Text style={styles.attentionCategory}>{item.category}</Text>
          </View>
          <Text style={styles.attentionTime}>{formatDateCompact(item.timestamp)}</Text>
        </View>
        {item.propertyAddress && (
          <View style={styles.attentionPropertyRow}>
            <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={12} cy={10} r={3} stroke={THEME.colors.textTertiary} strokeWidth={2} />
            </Svg>
            <Text style={styles.attentionPropertyText} numberOfLines={1}>{item.propertyAddress}</Text>
          </View>
        )}
        <Text style={styles.attentionTitle} numberOfLines={expanded ? 5 : 2}>{item.title}</Text>

        {/* Rich context: tenant name, amount, confidence */}
        {(item.tenantName || item.amount != null || confidenceLabel) && (
          <View style={styles.contextRow}>
            {item.tenantName && (
              <View style={styles.contextChip}>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                  <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={THEME.colors.textTertiary} strokeWidth={2} />
                  <Circle cx={12} cy={7} r={4} stroke={THEME.colors.textTertiary} strokeWidth={2} />
                </Svg>
                <Text style={styles.contextChipText}>{item.tenantName}</Text>
              </View>
            )}
            {item.amount != null && (
              <View style={styles.contextChip}>
                <Text style={styles.contextChipText}>${Math.round(item.amount).toLocaleString()}</Text>
              </View>
            )}
            {confidenceLabel && (
              <View style={[styles.contextChip, { backgroundColor: item.confidence! >= 0.8 ? THEME.colors.successBg : THEME.colors.warningBg }]}>
                <Text style={[styles.contextChipText, { color: item.confidence! >= 0.8 ? THEME.colors.success : THEME.colors.warning }]}>
                  {confidenceLabel}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Expanded context from previewData */}
        {expanded && item.description && item.description !== 'Needs your input' && item.description !== 'Needs your approval' && (
          <Text style={styles.attentionDescription}>{item.description}</Text>
        )}

        {item.recommendation && (
          <View style={styles.attentionRec}>
            <CasaLogoMark size={14} />
            <Text style={styles.attentionRecText} numberOfLines={expanded ? 6 : 2}>{item.recommendation}</Text>
          </View>
        )}
        {isAdvisory ? (
          <View style={styles.advisoryActionsContainer}>
            <View style={styles.advisoryActionRow}>
              <TouchableOpacity
                style={[styles.quickApproveBtn, { flex: 1 }]}
                onPress={() => onAcknowledge(item.taskId)}
                activeOpacity={0.7}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.quickApproveBtnText}>Acknowledge</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickRejectBtn, { flex: 1 }]}
                onPress={() => onDismiss(item.taskId)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickRejectBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.quickDetailBtn}
              onPress={() => router.push({ pathname: '/(app)/task-detail', params: { id: item.taskId } } as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickDetailBtnText}>View Details</Text>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brandIndigo} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.attentionActions}>
            <TouchableOpacity
              style={styles.quickApproveBtn}
              onPress={() => onApprove(item.taskId)}
              activeOpacity={0.7}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.textInverse} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.quickApproveBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickRejectBtn}
              onPress={() => onReject(item.taskId)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickRejectBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickDetailBtn}
              onPress={() => router.push({ pathname: '/(app)/task-detail', params: { id: item.taskId } } as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickDetailBtnText}>Details</Text>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brandIndigo} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Casa Handled Item ────────────────────────────────────────────────
function CasaHandledItem({ insight }: { insight: AgentInsight }) {
  return (
    <TouchableOpacity
      style={styles.handledItem}
      onPress={() => insight.deepLink && router.push(insight.deepLink as any)}
      activeOpacity={insight.deepLink ? 0.7 : 1}
      disabled={!insight.deepLink}
    >
      <View style={styles.handledCheck}>
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
          <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={styles.handledContent}>
        <Text style={styles.handledTitle} numberOfLines={2}>{insight.title}</Text>
        <Text style={styles.handledDesc} numberOfLines={1}>{insight.description}</Text>
      </View>
      {insight.deepLink && (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

// ── Casa Working On Item ─────────────────────────────────────────────
function CasaWorkingItem({ insight }: { insight: AgentInsight }) {
  return (
    <TouchableOpacity
      style={styles.workingItem}
      onPress={() => insight.deepLink && router.push(insight.deepLink as any)}
      activeOpacity={insight.deepLink ? 0.7 : 1}
      disabled={!insight.deepLink}
    >
      <View style={styles.workingDot}>
        <View style={styles.pulsingDotInner} />
      </View>
      <View style={styles.handledContent}>
        <Text style={styles.handledTitle} numberOfLines={1}>{insight.title}</Text>
        <Text style={styles.handledDesc} numberOfLines={1}>{insight.description}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Feed Item ────────────────────────────────────────────────────────
function FeedItem({ item }: { item: ActivityFeedItem }) {
  const config = getItemConfig(item.type);
  const isAgentHandled = !!(item.metadata?.agentHandled);

  return (
    <TouchableOpacity
      style={styles.feedItem}
      onPress={() => item.deepLink && router.push(item.deepLink as any)}
      activeOpacity={item.deepLink ? 0.7 : 1}
      disabled={!item.deepLink}
    >
      <View style={[styles.feedIconCircle, { backgroundColor: config.bg }]}>
        <FeedIcon type={config.icon} color={config.color} />
      </View>
      <View style={styles.feedItemContent}>
        <Text style={styles.feedItemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.feedItemDescRow}>
          <Text style={styles.feedItemDesc} numberOfLines={1}>
            {item.description}
          </Text>
          {isAgentHandled && (
            <View style={styles.viaCasaPill}>
              <Text style={styles.viaCasaText}>via Casa</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.feedItemRight}>
        {item.amount != null && (
          <Text
            style={[
              styles.feedItemAmount,
              { color: item.severity === 'success' ? THEME.colors.success : item.severity === 'error' ? THEME.colors.error : THEME.colors.textPrimary },
            ]}
          >
            ${Math.round(item.amount).toLocaleString()}
          </Text>
        )}
        <Text style={styles.feedItemTime}>{formatDateCompact(item.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Section Header ───────────────────────────────────────────────────
function SectionHeader({ title, count, color }: { title: string; count?: number; color?: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null && count > 0 && (
        <View style={[styles.countBadge, color ? { backgroundColor: color } : undefined]}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ── Welcome Empty ────────────────────────────────────────────────────
function WelcomeEmpty() {
  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeIconBox}>
        <CasaLogoMark size={48} />
      </View>
      <Text style={styles.welcomeTitle}>Welcome to Casa</Text>
      <Text style={styles.welcomeText}>
        Add your first property and Casa will start managing it for you automatically.
      </Text>
      <TouchableOpacity
        style={styles.welcomeButton}
        onPress={() => router.push('/(app)/properties/add' as any)}
        activeOpacity={0.7}
      >
        <Text style={styles.welcomeButtonText}>Add Property</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── All Clear Celebration State ──────────────────────────────────────
function AllClearState({
  propertyCount,
  monthlyRevenue,
  nextInspection,
}: {
  propertyCount: number;
  monthlyRevenue: string;
  nextInspection?: string;
}) {
  return (
    <View style={styles.allClearContainer}>
      <View style={styles.allClearIconWrap}>
        <CasaLogoMark size={40} />
      </View>
      <Text style={styles.allClearTitle}>All clear</Text>
      <Text style={styles.allClearSubtitle}>
        Everything is running smoothly
      </Text>
      <View style={styles.allClearStats}>
        <View style={styles.allClearStat}>
          <Text style={styles.allClearStatValue}>{propertyCount}</Text>
          <Text style={styles.allClearStatLabel}>
            {propertyCount === 1 ? 'property managed' : 'properties managed'}
          </Text>
        </View>
        {monthlyRevenue !== '$0' && (
          <View style={styles.allClearStat}>
            <Text style={styles.allClearStatValue}>{monthlyRevenue}</Text>
            <Text style={styles.allClearStatLabel}>collected this month</Text>
          </View>
        )}
        {nextInspection && (
          <View style={styles.allClearStat}>
            <Text style={styles.allClearStatValue}>{nextInspection}</Text>
            <Text style={styles.allClearStatLabel}>next inspection</Text>
          </View>
        )}
      </View>
      <View style={styles.allClearFooter}>
        <CasaLogoMark size={14} />
        <Text style={styles.allClearFooterText}>
          Casa is watching for anything that needs attention
        </Text>
      </View>
    </View>
  );
}

// ── Error State ───────────────────────────────────────────────────────
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorStateContainer}>
      <View style={styles.errorStateIcon}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            stroke={THEME.colors.warning}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={styles.errorStateTitle}>Something went wrong</Text>
      <Text style={styles.errorStateText}>{message}</Text>
      <TouchableOpacity style={styles.errorStateButton} onPress={onRetry} activeOpacity={0.7}>
        <Text style={styles.errorStateButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────
export default function ActivityScreen() {
  const { user } = useAuth();
  const { profile, firstName } = useProfile();
  const { properties } = useProperties();
  const { pendingCount } = useAgentContext();
  const { summary, error: dashboardError, refreshDashboard } = useDashboard();
  const { insights, refreshInsights } = useAgentInsights();
  const { feedItems, pendingApprovals, loading, error: feedError, refreshFeed } = useActivityFeed();
  const { approveTask, rejectTask } = useAgentTasks();
  const { isOnboarded: isPayoutOnboarded } = useOwnerPayouts();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const metadataName = user?.user_metadata?.full_name?.split(/\s+/)?.[0];
  const displayName = firstName || metadataName || 'there';

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshFeed(), refreshDashboard(), refreshInsights()]);
    setRefreshing(false);
  }, [refreshFeed, refreshDashboard, refreshInsights]);

  // Separate handled and working-on insights
  const casaHandled = insights.filter(i => i.type === 'success');
  const casaWorkingOn = insights.filter(i => i.type === 'info' && i.title.startsWith('Working on:'));

  // "Needs Attention" items = pending approvals + urgent feed items
  const needsAttentionItems = useMemo(() => {
    const urgent = feedItems.filter(
      f => f.severity === 'error' || f.type === 'arrears_detected' || f.type === 'rent_overdue',
    );
    return { approvals: pendingApprovals, urgentItems: urgent };
  }, [pendingApprovals, feedItems]);

  const totalAttention = needsAttentionItems.approvals.length + needsAttentionItems.urgentItems.length;

  const handleApprove = useCallback(
    async (taskId: string) => {
      await approveTask(taskId, taskId);
      await refreshFeed();
    },
    [approveTask, refreshFeed],
  );

  const handleReject = useCallback(
    async (taskId: string) => {
      await rejectTask(taskId, taskId);
      await refreshFeed();
    },
    [rejectTask, refreshFeed],
  );

  // Advisory task handlers — these update the task status directly
  const handleAcknowledge = useCallback(
    async (taskId: string) => {
      try {
        const supabase = getSupabaseClient();
        await (supabase.from('agent_tasks') as ReturnType<typeof supabase.from>)
          .update({ status: 'in_progress' })
          .eq('id', taskId);
        await refreshFeed();
      } catch (err) {
        console.error('Failed to acknowledge task:', err);
      }
    },
    [refreshFeed],
  );

  const handleDismiss = useCallback(
    async (taskId: string) => {
      try {
        const supabase = getSupabaseClient();
        await (supabase.from('agent_tasks') as ReturnType<typeof supabase.from>)
          .update({ status: 'cancelled' })
          .eq('id', taskId);
        await refreshFeed();
      } catch (err) {
        console.error('Failed to dismiss task:', err);
      }
    },
    [refreshFeed],
  );

  // Portfolio snapshot data
  const propertyCount = properties.length;
  const occupiedCount = properties.filter(p => p.status === 'occupied').length;
  const occupancyRate = propertyCount > 0 ? Math.round((occupiedCount / propertyCount) * 100) : 0;
  const monthlyRevenue = summary
    ? `$${Math.round(Number(summary.rent_collected_this_month)).toLocaleString('en-AU')}`
    : '$0';

  const isNewUser = propertyCount === 0 && feedItems.length === 0 && pendingApprovals.length === 0;

  // Non-urgent feed items (urgent ones shown in Needs Attention)
  const normalFeedItems = feedItems.filter(
    f => f.severity !== 'error' && f.type !== 'arrears_detected' && f.type !== 'rent_overdue',
  );

  // "All clear" state: has properties, no attention needed, no working items
  const isAllClear = propertyCount > 0
    && totalAttention === 0
    && casaWorkingOn.length === 0
    && !loading;

  // Find next scheduled inspection for celebration state
  const nextInspection = useMemo(() => {
    const inspItem = feedItems.find(f => f.type === 'inspection_scheduled');
    if (!inspItem) return undefined;
    const match = inspItem.description.match(/^(\d+ \w+)/);
    return match ? match[1] : undefined;
  }, [feedItems]);

  return (
    <View style={styles.container}>
      {/* Premium Hero Header */}
      <View style={{ paddingTop: insets.top }}>
        <HeroHeader
          displayName={displayName}
          pendingCount={totalAttention}
          propertyCount={propertyCount}
        />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={THEME.colors.brand}
          />
        }
      >
        {(dashboardError || feedError) && !loading ? (
          <ErrorState
            message={dashboardError || feedError || 'Unable to load your dashboard. Please check your connection and try again.'}
            onRetry={handleRefresh}
          />
        ) : isNewUser && !loading ? (
          <WelcomeEmpty />
        ) : (
          <>
            {/* Trial Banner */}
            {profile?.subscription_status === 'trialing' && profile.trial_ends_at && (
              <TrialBanner trialEndsAt={profile.trial_ends_at} />
            )}

            {/* Payout Setup Banner — persistent until owner connects bank */}
            {!isPayoutOnboarded && propertyCount > 0 && (
              <PayoutSetupBanner />
            )}

            {/* Portfolio Snapshot */}
            {propertyCount > 0 && (
              <PortfolioSnapshot
                revenue={monthlyRevenue}
                propertyCount={propertyCount}
                occupancyRate={occupancyRate}
              />
            )}

            {/* Needs Attention */}
            {totalAttention > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Needs Attention" count={totalAttention} color={THEME.colors.error} />
                {/* Urgent feed items (arrears, overdue rent) */}
                {needsAttentionItems.urgentItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.urgentItem}
                    onPress={() => item.deepLink && router.push(item.deepLink as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.urgentDot} />
                    <View style={styles.urgentContent}>
                      <Text style={styles.urgentTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.urgentDesc} numberOfLines={1}>{item.description}</Text>
                    </View>
                    {item.amount != null && (
                      <Text style={styles.urgentAmount}>
                        ${Math.round(item.amount).toLocaleString()}
                      </Text>
                    )}
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M9 18l6-6-6-6" stroke={THEME.colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                ))}
                {/* Approval cards */}
                {needsAttentionItems.approvals.map(item => (
                  <NeedsAttentionCard
                    key={item.id}
                    item={item}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onAcknowledge={handleAcknowledge}
                    onDismiss={handleDismiss}
                  />
                ))}
              </View>
            )}

            {/* Casa Working On */}
            {casaWorkingOn.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Casa is Working On" />
                <View style={styles.listCard}>
                  {casaWorkingOn.map(insight => (
                    <CasaWorkingItem key={insight.id} insight={insight} />
                  ))}
                </View>
              </View>
            )}

            {/* Casa Handled */}
            {casaHandled.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Casa Handled" />
                <View style={styles.listCard}>
                  {casaHandled.map(insight => (
                    <CasaHandledItem key={insight.id} insight={insight} />
                  ))}
                </View>
              </View>
            )}

            {/* All Clear Celebration State */}
            {isAllClear && casaHandled.length === 0 && normalFeedItems.length === 0 && (
              <AllClearState
                propertyCount={propertyCount}
                monthlyRevenue={monthlyRevenue}
                nextInspection={nextInspection}
              />
            )}

            {/* Activity Feed */}
            {(!isAllClear || casaHandled.length > 0 || normalFeedItems.length > 0) && (
              <View style={styles.section}>
                <SectionHeader title="Recent Activity" />
                {loading && feedItems.length === 0 ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={THEME.colors.brand} />
                  </View>
                ) : normalFeedItems.length === 0 ? (
                  isAllClear ? null : (
                    <View style={styles.emptyFeed}>
                      <View style={styles.emptyFeedIcon}>
                        <CasaLogoMark size={24} />
                      </View>
                      <Text style={styles.emptyFeedText}>
                        No recent activity. Casa will show updates here as it manages your properties.
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={styles.listCard}>
                    {normalFeedItems.map(item => (
                      <FeedItem key={item.id} item={item} />
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },

  // ── Hero Header ──
  heroContainer: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroWordmark: {
    tintColor: THEME.colors.textInverse,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconBtn: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },
  heroBody: {
    gap: 4,
  },
  heroGreeting: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.textInverse,
    letterSpacing: -0.5,
  },
  heroStatus: {
    fontSize: 14,
    color: THEME.colors.textInverse + 'B3',
    fontWeight: '500',
  },

  // ── Trial Banner ──
  trialBanner: {
    backgroundColor: THEME.colors.warningBg,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.warning + '30',
  },
  trialBannerContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  trialBannerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  trialBannerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: THEME.colors.textPrimary,
  },
  trialBannerCTA: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
  },
  trialBannerCTAText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: THEME.colors.brand,
  },

  // ── Scroll ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // ── Portfolio Snapshot ──
  snapshotCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 18,
    marginBottom: 20,
    ...THEME.shadow.md,
  },
  snapshotColumn: {
    flex: 1,
    alignItems: 'center',
  },
  snapshotValue: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  snapshotLabel: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 2,
    fontWeight: '500',
  },
  snapshotDivider: {
    width: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 4,
  },

  // ── Sections ──
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.2,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },

  // ── Needs Attention — Urgent Items ──
  urgentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.errorBg,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.error + '30',
  },
  urgentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.error,
    marginRight: 12,
  },
  urgentContent: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.error,
  },
  urgentDesc: {
    fontSize: 12,
    color: THEME.colors.error,
    marginTop: 1,
  },
  urgentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.error,
    marginRight: 8,
  },

  // ── Needs Attention — Approval Cards ──
  attentionCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    marginBottom: 10,
    overflow: 'hidden',
    ...THEME.shadow.sm,
  },
  attentionAccent: {
    width: 4,
  },
  attentionBody: {
    flex: 1,
    padding: 14,
  },
  attentionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  attentionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attentionPriorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  attentionPriorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  attentionCategory: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    fontWeight: '500',
  },
  attentionTime: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
  },
  attentionPropertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  attentionPropertyText: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    fontWeight: '500',
    flex: 1,
  },
  attentionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  attentionRec: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: THEME.colors.infoBg,
    borderRadius: THEME.radius.sm,
    padding: 10,
    marginBottom: 10,
  },
  attentionRecText: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.brandIndigo,
    lineHeight: 18,
    fontWeight: '500',
  },
  attentionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  advisoryActionsContainer: {
    gap: 8,
  },
  advisoryActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 16,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
  },
  quickApproveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
  quickRejectBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  quickRejectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  quickDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 36,
    paddingHorizontal: 12,
    marginLeft: 'auto',
  },
  quickDetailBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brandIndigo,
  },

  // ── Rich Context Row ──
  contextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  contextChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  attentionDescription: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },

  // ── List Card (shared) ──
  listCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    ...THEME.shadow.sm,
  },

  // ── Casa Handled ──
  handledItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  handledCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  handledContent: {
    flex: 1,
  },
  handledTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
  handledDesc: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 1,
  },

  // ── Casa Working On ──
  workingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  workingDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pulsingDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.brandIndigo,
  },

  // ── Feed List ──
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  feedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  feedItemContent: {
    flex: 1,
  },
  feedItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  feedItemDescRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  feedItemDesc: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    flexShrink: 1,
  },
  viaCasaPill: {
    backgroundColor: THEME.colors.successBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  viaCasaText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.success,
  },
  feedItemRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  feedItemAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  feedItemTime: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },

  // ── Loading & Empty ──
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyFeed: {
    padding: 28,
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    ...THEME.shadow.sm,
  },
  emptyFeedIcon: {
    marginBottom: 12,
  },
  emptyFeedText: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Welcome State ──
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  welcomeIconBox: {
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeText: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  welcomeButton: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
  },
  welcomeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },

  // ── All Clear Celebration ──
  allClearContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    marginBottom: 20,
    ...THEME.shadow.md,
  },
  allClearIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  allClearTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  allClearSubtitle: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    marginBottom: 20,
  },
  allClearStats: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  allClearStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allClearStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    minWidth: 40,
  },
  allClearStatLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  allClearFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    width: '100%',
    justifyContent: 'center',
  },
  allClearFooterText: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
    fontWeight: '500',
  },

  // ── Error State ──
  errorStateContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  errorStateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  errorStateText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorStateButton: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  errorStateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textInverse,
  },
});
