// Task Detail Page - Rich context for agent tasks and pending actions
// Shows category-specific information panels, timeline, and action buttons

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { THEME } from '@casa/config';
import { getSupabaseClient, useAuth } from '@casa/api';

// ── Types ────────────────────────────────────────────────────────────

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  timeline: Array<{
    timestamp: string;
    action: string;
    status: string;
    reasoning?: string;
    data?: Record<string, unknown>;
  }>;
  recommendation: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  deep_link: string | null;
  created_at: string;
  updated_at: string;
}

interface MaintenanceContext {
  id: string;
  title: string;
  description: string;
  status: string;
  urgency: string;
  category: string;
  location_in_property: string | null;
  preferred_times: string | null;
  access_instructions: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  images: Array<{ id: string; image_url: string; caption: string | null }>;
  property?: { address_line_1: string; suburb: string; state: string };
  tenant?: { full_name: string; email: string; phone: string | null };
}

interface PropertyContext {
  id: string;
  address_line_1: string;
  suburb: string;
  state: string;
  postcode: string;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
}

interface TenancyContext {
  id: string;
  lease_start_date: string;
  lease_end_date: string;
  rent_amount: number;
  rent_frequency: string;
  status: string;
  property?: { address_line_1: string; suburb: string; state: string };
  tenants?: Array<{ full_name: string; email: string }>;
}

// ── Icon Components ──────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Priority Helpers ─────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: THEME.colors.error },
  high: { label: 'High', color: THEME.colors.warning },
  normal: { label: 'Normal', color: THEME.colors.brandIndigo },
  low: { label: 'Low', color: THEME.colors.textTertiary },
};

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: 'Maintenance',
  compliance: 'Compliance',
  insurance: 'Insurance',
  inspections: 'Inspections',
  lease_management: 'Lease Management',
  rent_collection: 'Rent Collection',
  tenant_finding: 'Tenant Finding',
  listings: 'Listings',
  financial: 'Financial',
  communication: 'Communication',
  general: 'General',
};

const STATUS_LABELS: Record<string, string> = {
  pending_input: 'Needs Your Input',
  in_progress: 'In Progress',
  scheduled: 'Scheduled',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// ── Main Component ───────────────────────────────────────────────────

export default function TaskDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const { user } = useAuth();

  const [task, setTask] = useState<TaskData | null>(null);
  const [maintenanceCtx, setMaintenanceCtx] = useState<MaintenanceContext | null>(null);
  const [propertyCtx, setPropertyCtx] = useState<PropertyContext | null>(null);
  const [tenancyCtx, setTenancyCtx] = useState<TenancyContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      const supabase = getSupabaseClient();

      // Try agent_tasks first
      const { data: taskData, error: taskErr } = await (supabase
        .from('agent_tasks') as any)
        .select('*')
        .eq('id', id)
        .single();

      if (taskData && !taskErr) {
        setTask(taskData as TaskData);

        if (taskData.related_entity_type && taskData.related_entity_id) {
          await fetchEntityContext(
            supabase,
            taskData.related_entity_type,
            taskData.related_entity_id,
            taskData.category,
          );
        }
      } else {
        // Fallback: look in agent_pending_actions (pending actions may not have a linked task)
        const { data: actionData, error: actionErr } = await (supabase
          .from('agent_pending_actions') as any)
          .select('*')
          .eq('id', id)
          .single();

        if (actionData && !actionErr) {
          const preview = actionData.preview_data as Record<string, unknown> | null;
          setTask({
            id: actionData.id,
            title: actionData.title || actionData.tool_name || 'Pending Action',
            description: actionData.description || null,
            category: actionData.action_type || 'general',
            status: actionData.status || 'pending_input',
            priority: actionData.autonomy_level <= 1 ? 'urgent' : 'normal',
            timeline: [],
            recommendation: actionData.recommendation || null,
            related_entity_type: preview?.entity_type as string || null,
            related_entity_id: preview?.entity_id as string || actionData.property_id || null,
            deep_link: null,
            created_at: actionData.created_at,
            updated_at: actionData.updated_at || actionData.created_at,
          });

          // Try to load entity context from preview data or property_id
          const entityType = preview?.entity_type as string || (actionData.property_id ? 'property' : null);
          const entityId = preview?.entity_id as string || actionData.property_id;
          if (entityType && entityId) {
            await fetchEntityContext(supabase, entityType, entityId, actionData.action_type || 'general');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load task:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchEntityContext = async (
    supabase: any,
    entityType: string,
    entityId: string,
    category: string,
  ) => {
    try {
      if (entityType === 'maintenance_request') {
        const { data } = await supabase
          .from('maintenance_requests')
          .select(`
            id, title, description, status, urgency, category,
            location_in_property, preferred_times, access_instructions,
            estimated_cost, actual_cost, created_at,
            properties!inner(address_line_1, suburb, state),
            profiles:reported_by(full_name, email, phone)
          `)
          .eq('id', entityId)
          .single();

        if (data) {
          // Fetch images
          const { data: images } = await supabase
            .from('maintenance_images')
            .select('id, image_url, caption')
            .eq('request_id', entityId);

          setMaintenanceCtx({
            ...data,
            images: images || [],
            property: data.properties,
            tenant: data.profiles,
          });
        }
      } else if (entityType === 'property') {
        const { data } = await supabase
          .from('properties')
          .select('id, address_line_1, suburb, state, postcode, property_type, bedrooms, bathrooms, parking_spaces')
          .eq('id', entityId)
          .single();

        if (data) setPropertyCtx(data);

        // For insurance tasks, also check expenses for existing insurance records
      } else if (entityType === 'tenancy') {
        const { data } = await supabase
          .from('tenancies')
          .select(`
            id, lease_start_date, lease_end_date, rent_amount, rent_frequency, status,
            properties!inner(address_line_1, suburb, state),
            tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name, email))
          `)
          .eq('id', entityId)
          .single();

        if (data) {
          setTenancyCtx({
            ...data,
            property: data.properties,
            tenants: (data.tenancy_tenants || []).map((tt: any) => tt.profiles).filter(Boolean),
          });
        }
      }
    } catch (err) {
      console.error('Failed to load entity context:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleNavigateToEntity = useCallback(() => {
    if (!task?.deep_link || task.deep_link.includes('undefined')) return;
    router.push(task.deep_link as any);
  }, [task]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Task not found</Text>
        </View>
      </View>
    );
  }

  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
  const statusLabel = STATUS_LABELS[task.status] || task.status;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {CATEGORY_LABELS[task.category] || task.category}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.colors.brand} />
        }
      >
        {/* Hero Section */}
        <View style={styles.heroCard}>
          <View style={styles.heroMeta}>
            <View style={[styles.priorityPill, { backgroundColor: priority.color + '18' }]}>
              <Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: task.status === 'completed' ? THEME.colors.successBg : THEME.colors.subtle }]}>
              <Text style={[styles.statusText, { color: task.status === 'completed' ? THEME.colors.success : THEME.colors.textSecondary }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{task.title}</Text>
          {task.description && (
            <Text style={styles.heroDescription}>{task.description}</Text>
          )}
        </View>

        {/* Casa Recommendation */}
        {task.recommendation && (
          <View style={styles.recCard}>
            <View style={styles.recHeader}>
              <View style={styles.recIcon}>
                <Image
                  source={require('../../assets/casa_logo.png')}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.recHeaderText}>Casa Recommendation</Text>
            </View>
            <Text style={styles.recBody}>{task.recommendation}</Text>
          </View>
        )}

        {/* Maintenance Context */}
        {maintenanceCtx && (
          <View style={styles.contextCard}>
            <Text style={styles.contextTitle}>Maintenance Request</Text>

            {/* Images */}
            {maintenanceCtx.images.length > 0 && (
              <View style={styles.imageGallery}>
                {maintenanceCtx.images.map(img => (
                  <View key={img.id} style={styles.imageWrapper}>
                    <Image
                      source={{ uri: img.image_url }}
                      style={styles.contextImage}
                      resizeMode="cover"
                    />
                    {img.caption && (
                      <Text style={styles.imageCaption}>{img.caption}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.infoGrid}>
              <InfoRow label="Issue" value={maintenanceCtx.title} />
              <InfoRow label="Description" value={maintenanceCtx.description} />
              <InfoRow label="Urgency" value={maintenanceCtx.urgency} highlight />
              <InfoRow label="Status" value={maintenanceCtx.status} />
              {maintenanceCtx.location_in_property && (
                <InfoRow label="Location" value={maintenanceCtx.location_in_property} />
              )}
              {maintenanceCtx.tenant && (
                <InfoRow label="Reported by" value={maintenanceCtx.tenant.full_name} />
              )}
              {maintenanceCtx.property && (
                <InfoRow
                  label="Property"
                  value={`${maintenanceCtx.property.address_line_1}, ${maintenanceCtx.property.suburb}`}
                />
              )}
              {maintenanceCtx.estimated_cost != null && (
                <InfoRow label="Est. cost" value={`$${maintenanceCtx.estimated_cost.toLocaleString()}`} />
              )}
              {maintenanceCtx.preferred_times && (
                <InfoRow label="Preferred times" value={maintenanceCtx.preferred_times} />
              )}
              {maintenanceCtx.access_instructions && (
                <InfoRow label="Access" value={maintenanceCtx.access_instructions} />
              )}
            </View>

            <TouchableOpacity
              style={styles.viewFullBtn}
              onPress={() => router.push(`/(app)/maintenance/${maintenanceCtx.id}` as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewFullBtnText}>View Full Request</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        {/* Property Context (for insurance, compliance, etc.) */}
        {propertyCtx && !maintenanceCtx && (
          <View style={styles.contextCard}>
            <Text style={styles.contextTitle}>Property</Text>
            <View style={styles.infoGrid}>
              <InfoRow label="Address" value={`${propertyCtx.address_line_1}, ${propertyCtx.suburb} ${propertyCtx.state} ${propertyCtx.postcode}`} />
              {propertyCtx.property_type && (
                <InfoRow label="Type" value={propertyCtx.property_type} />
              )}
              {propertyCtx.bedrooms != null && (
                <InfoRow label="Bedrooms" value={String(propertyCtx.bedrooms)} />
              )}
              {propertyCtx.bathrooms != null && (
                <InfoRow label="Bathrooms" value={String(propertyCtx.bathrooms)} />
              )}
            </View>

            {task.category === 'insurance' && (
              <View style={styles.tipCard}>
                <Text style={styles.tipTitle}>Why insurance matters</Text>
                <Text style={styles.tipBody}>
                  Landlord insurance covers property damage, loss of rent, and liability. Without it, a single event like a tenant damaging the property or a natural disaster could cost tens of thousands.
                </Text>
                <Text style={[styles.tipBody, { marginTop: 8 }]}>
                  Common policies cover:{'\n'}
                  {'\u2022'} Malicious and accidental tenant damage{'\n'}
                  {'\u2022'} Loss of rental income{'\n'}
                  {'\u2022'} Public liability{'\n'}
                  {'\u2022'} Legal expenses
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.viewFullBtn}
              onPress={() => router.push(`/(app)/properties/${propertyCtx.id}` as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewFullBtnText}>View Property</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        {/* Tenancy Context (for lease/compliance tasks) */}
        {tenancyCtx && (
          <View style={styles.contextCard}>
            <Text style={styles.contextTitle}>Tenancy</Text>
            <View style={styles.infoGrid}>
              {tenancyCtx.property && (
                <InfoRow
                  label="Property"
                  value={`${tenancyCtx.property.address_line_1}, ${tenancyCtx.property.suburb}`}
                />
              )}
              {tenancyCtx.tenants && tenancyCtx.tenants.length > 0 && (
                <InfoRow
                  label="Tenant"
                  value={tenancyCtx.tenants.map(t => t.full_name).join(', ')}
                />
              )}
              <InfoRow label="Rent" value={`$${tenancyCtx.rent_amount} / ${tenancyCtx.rent_frequency}`} />
              <InfoRow label="Lease start" value={formatDate(tenancyCtx.lease_start_date)} />
              <InfoRow label="Lease end" value={formatDate(tenancyCtx.lease_end_date)} />
              <InfoRow label="Status" value={tenancyCtx.status} />
            </View>

            {task.category === 'compliance' && (
              <View style={styles.tipCard}>
                <Text style={styles.tipTitle}>Compliance checklist</Text>
                <Text style={styles.tipBody}>
                  For QLD tenancies, ensure these are complete:{'\n'}
                  {'\u2022'} Bond lodged with RTA (within 10 days){'\n'}
                  {'\u2022'} Entry condition report signed by both parties{'\n'}
                  {'\u2022'} Smoke alarm compliance certificate{'\n'}
                  {'\u2022'} Pool safety certificate (if applicable){'\n'}
                  {'\u2022'} Water efficiency (if charging for water)
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.viewFullBtn}
              onPress={() => router.push(`/(app)/tenancies/${tenancyCtx.id}` as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewFullBtnText}>View Tenancy</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        {/* Timeline */}
        {task.timeline && task.timeline.length > 0 && (
          <View style={styles.contextCard}>
            <Text style={styles.contextTitle}>Timeline</Text>
            {task.timeline.map((entry, idx) => (
              <View key={idx} style={styles.timelineEntry}>
                <View style={styles.timelineDot}>
                  <View style={[
                    styles.dot,
                    entry.status === 'completed'
                      ? { backgroundColor: THEME.colors.success }
                      : entry.status === 'current'
                        ? { backgroundColor: THEME.colors.brand }
                        : { backgroundColor: THEME.colors.border },
                  ]} />
                  {idx < task.timeline.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineAction}>{entry.action}</Text>
                  {entry.reasoning && (
                    <Text style={styles.timelineReasoning}>{entry.reasoning}</Text>
                  )}
                  <Text style={styles.timelineTime}>{formatTimeAgo(entry.timestamp)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Category-specific action buttons */}
        {task.status !== 'completed' && task.status !== 'cancelled' && (
          <View style={styles.actionSection}>
            <Text style={styles.contextTitle}>What you can do</Text>

            {task.category === 'maintenance' && maintenanceCtx && (
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => router.push(`/(app)/maintenance/${maintenanceCtx.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryActionBtnText}>Manage Request</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => router.push({ pathname: '/(app)/trades', params: { category: maintenanceCtx.category } } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryActionBtnText}>Find a Tradesperson</Text>
                </TouchableOpacity>
                {maintenanceCtx.status === 'submitted' || maintenanceCtx.status === 'acknowledged' ? (
                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={() => router.push({
                      pathname: '/(app)/work-orders/create',
                      params: {
                        maintenanceRequestId: maintenanceCtx.id,
                        propertyId: maintenanceCtx.property?.address_line_1 ? undefined : undefined,
                        title: maintenanceCtx.title,
                        description: maintenanceCtx.description,
                        category: maintenanceCtx.category,
                      },
                    } as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryActionBtnText}>Create Work Order</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {task.category === 'inspections' && (
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => router.push({
                    pathname: '/(app)/inspections/schedule',
                    params: { property_id: task.related_entity_id, type: 'routine' },
                  } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryActionBtnText}>Schedule Inspection</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => router.push('/(app)/inspections' as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryActionBtnText}>View All Inspections</Text>
                </TouchableOpacity>
              </View>
            )}

            {task.category === 'insurance' && propertyCtx && (
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => router.push(`/(app)/properties/${propertyCtx.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryActionBtnText}>View Property Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => router.push({ pathname: '/(app)/(tabs)/chat', params: { prefill: 'Help me understand what landlord insurance I need for my property' } } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryActionBtnText}>Ask Casa About Insurance</Text>
                </TouchableOpacity>
              </View>
            )}

            {task.category === 'compliance' && tenancyCtx && (
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => router.push(`/(app)/tenancies/${tenancyCtx.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryActionBtnText}>View Tenancy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => router.push({ pathname: '/(app)/(tabs)/chat', params: { prefill: 'What do I need to do for compliance on my new lease?' } } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryActionBtnText}>Ask Casa About Compliance</Text>
                </TouchableOpacity>
              </View>
            )}

            {task.category === 'lease_management' && (
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => {
                    if (tenancyCtx) router.push(`/(app)/tenancies/${tenancyCtx.id}` as any);
                    else if (task.deep_link && !task.deep_link.includes('undefined')) router.push(task.deep_link as any);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryActionBtnText}>View Tenancy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => router.push({ pathname: '/(app)/(tabs)/chat', params: { prefill: 'Help me decide what to do about my expiring lease' } } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryActionBtnText}>Ask Casa for Advice</Text>
                </TouchableOpacity>
              </View>
            )}

            {task.category === 'rent_collection' && (
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => router.push('/(app)/arrears' as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryActionBtnText}>View Arrears</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => router.push('/(app)/payments' as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryActionBtnText}>Payment History</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Fallback for categories without specific actions */}
            {!['maintenance', 'inspections', 'insurance', 'compliance', 'lease_management', 'rent_collection'].includes(task.category) && task.deep_link && !task.deep_link.includes('undefined') && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleNavigateToEntity}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryActionBtnText}>View Details</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Helper Components ────────────────────────────────────────────────

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: THEME.colors.warning, fontWeight: '600' as const }]}>
        {value}
      </Text>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: THEME.colors.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: THEME.colors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Hero
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  heroMeta: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priorityPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: THEME.radius.full },
  priorityText: { fontSize: 12, fontWeight: '600' as const },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: THEME.radius.full },
  statusText: { fontSize: 12, fontWeight: '600' as const },
  heroTitle: { fontSize: 20, fontWeight: '700' as const, color: THEME.colors.textPrimary, marginBottom: 8 },
  heroDescription: { fontSize: 14, color: THEME.colors.textSecondary, lineHeight: 20 },

  // Recommendation
  recCard: {
    backgroundColor: THEME.colors.brand + '10',
    borderRadius: THEME.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.brand + '30',
  },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  recIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recHeaderText: { fontSize: 14, fontWeight: '600' as const, color: THEME.colors.brand },
  recBody: { fontSize: 14, color: THEME.colors.textPrimary, lineHeight: 21 },

  // Context cards
  contextCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  contextTitle: { fontSize: 16, fontWeight: '700' as const, color: THEME.colors.textPrimary, marginBottom: 12 },

  // Image gallery
  imageGallery: { marginBottom: 12 },
  imageWrapper: { marginBottom: 8, borderRadius: THEME.radius.md, overflow: 'hidden' },
  contextImage: { width: '100%', height: 200, borderRadius: THEME.radius.md },
  imageCaption: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 4, paddingHorizontal: 4 },

  // Info grid
  infoGrid: { gap: 0 },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  infoLabel: { width: 110, fontSize: 13, color: THEME.colors.textTertiary, fontWeight: '500' as const },
  infoValue: { flex: 1, fontSize: 13, color: THEME.colors.textPrimary, lineHeight: 18 },

  // Tips
  tipCard: {
    backgroundColor: THEME.colors.subtle,
    borderRadius: THEME.radius.md,
    padding: 14,
    marginTop: 12,
  },
  tipTitle: { fontSize: 14, fontWeight: '600' as const, color: THEME.colors.textPrimary, marginBottom: 6 },
  tipBody: { fontSize: 13, color: THEME.colors.textSecondary, lineHeight: 19 },

  // View full button
  viewFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  viewFullBtnText: { fontSize: 14, fontWeight: '600' as const, color: THEME.colors.brand },

  // Timeline
  timelineEntry: { flexDirection: 'row', minHeight: 50 },
  timelineDot: { width: 24, alignItems: 'center', paddingTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, flex: 1, backgroundColor: THEME.colors.border, marginTop: 4 },
  timelineContent: { flex: 1, paddingLeft: 8, paddingBottom: 16 },
  timelineAction: { fontSize: 14, color: THEME.colors.textPrimary, lineHeight: 20 },
  timelineReasoning: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2, lineHeight: 17 },
  timelineTime: { fontSize: 11, color: THEME.colors.textTertiary, marginTop: 4 },

  // Action button
  actionSection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    marginBottom: 16,
  },
  actionButtonGroup: {
    gap: 10,
    marginTop: 4,
  },
  primaryActionBtn: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryActionBtnText: { fontSize: 16, fontWeight: '700' as const, color: THEME.colors.textInverse },
  secondaryActionBtn: {
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  secondaryActionBtnText: { fontSize: 15, fontWeight: '600' as const, color: THEME.colors.textPrimary },
});
