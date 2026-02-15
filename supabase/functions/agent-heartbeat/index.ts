// Agent Heartbeat - Supabase Edge Function
// Casa - Mission 14: AI Agent Proactive Scanning
//
// Periodic function that scans for actionable events across all users (or a
// specific user) and creates agent_tasks, logs proactive_actions, and
// optionally auto-executes low-risk actions based on autonomy settings.
//
// Trigger: pg_cron (every 15 min recommended) or manual HTTP call.
// Auth: CRON_SECRET header or admin JWT.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeartbeatResult {
  processed: number;
  tasks_created: number;
  actions_auto_executed: number;
  errors: string[];
}

interface AutonomySettings {
  preset: string;
  category_overrides: Record<string, string>;
}

interface TimelineEntry {
  timestamp: string;
  action: string;
  status: 'completed' | 'current' | 'pending';
  reasoning?: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Autonomy Helpers (mirrored from agent-chat)
// ---------------------------------------------------------------------------

const AUTONOMY_PRESET_DEFAULTS: Record<string, Record<string, number>> = {
  cautious: {
    query: 4, messages: 1, financial: 0, legal: 0,
    maintenance: 1, listings: 1, tenant_finding: 1,
  },
  balanced: {
    query: 4, messages: 3, financial: 1, legal: 0,
    maintenance: 2, listings: 2, tenant_finding: 2,
  },
  hands_off: {
    query: 4, messages: 4, financial: 3, legal: 1,
    maintenance: 3, listings: 3, tenant_finding: 3,
  },
};

function parseAutonomyLevel(level: string): number {
  if (typeof level === 'string' && level.startsWith('L')) {
    return parseInt(level.substring(1), 10);
  }
  return parseInt(String(level), 10) || 2;
}

function getUserAutonomyForCategory(
  settings: AutonomySettings | null,
  category: string,
): number {
  const preset = settings?.preset || 'balanced';
  const overrides = settings?.category_overrides || {};

  if (overrides[category]) {
    return parseAutonomyLevel(overrides[category]);
  }

  const presetDefaults = AUTONOMY_PRESET_DEFAULTS[preset] || AUTONOMY_PRESET_DEFAULTS.balanced;
  return presetDefaults[category] ?? 2;
}

// ---------------------------------------------------------------------------
// Utility: within-cycle dedup tracking (keyed by userId)
// Each processUser call registers its Set here; scanners check it
// automatically via taskExistsForEntity / createTaskAndLog.
// ---------------------------------------------------------------------------

const _cycleHandledEntities = new Map<string, Set<string>>();

// ---------------------------------------------------------------------------
// Utility: convert a human-readable string key into a deterministic UUID
// (used when no real entity UUID exists, e.g. monthly digest dedup keys)
// ---------------------------------------------------------------------------

async function deterministicUuid(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  // Format first 16 bytes as UUID v4-shaped (set version + variant bits)
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// Utility: check if a task already exists for a given entity + trigger
// ---------------------------------------------------------------------------

async function taskExistsForEntity(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  relatedEntityId: string,
  _triggerType: string,
): Promise<boolean> {
  // Within-cycle dedup: if this entity was already handled in the current
  // heartbeat cycle, skip the DB query entirely.
  const cycleSet = _cycleHandledEntities.get(userId);
  if (cycleSet?.has(relatedEntityId)) return true;

  // Look for any open task (not completed/cancelled) for this entity.
  // We match on related_entity_id only — if there's already an open task
  // for this entity, we don't create another regardless of trigger wording.
  const { data } = await supabase
    .from('agent_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('related_entity_id', relatedEntityId)
    .in('status', ['pending_input', 'in_progress', 'scheduled', 'paused'])
    .limit(1);

  return (data && data.length > 0) || false;
}

// ---------------------------------------------------------------------------
// Utility: create a task and log the proactive action
// ---------------------------------------------------------------------------

async function createTaskAndLog(
  supabase: ReturnType<typeof getServiceClient>,
  params: {
    userId: string;
    title: string;
    description: string;
    category: string;
    status: string;
    priority: string;
    recommendation: string;
    relatedEntityType: string;
    relatedEntityId: string;
    deepLink?: string;
    triggerType: string;
    triggerSource: string;
    actionTaken: string;
    wasAutoExecuted: boolean;
    timelineEntries: TimelineEntry[];
  },
): Promise<{ taskId: string | null; error: string | null }> {
  const { data: task, error: taskErr } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: params.userId,
      title: params.title,
      description: params.description,
      category: params.category,
      status: params.status,
      priority: params.priority,
      recommendation: params.recommendation,
      related_entity_type: params.relatedEntityType,
      related_entity_id: params.relatedEntityId,
      deep_link: params.deepLink || null,
      timeline: params.timelineEntries,
    })
    .select('id')
    .single();

  if (taskErr || !task) {
    return { taskId: null, error: taskErr?.message || 'Failed to create task' };
  }

  // Track this entity in the within-cycle dedup set
  if (params.relatedEntityId) {
    const cycleSet = _cycleHandledEntities.get(params.userId);
    if (cycleSet) cycleSet.add(params.relatedEntityId);
  }

  const { error: logErr } = await supabase
    .from('agent_proactive_actions')
    .insert({
      user_id: params.userId,
      trigger_type: params.triggerType,
      trigger_source: params.triggerSource,
      action_taken: params.actionTaken,
      was_auto_executed: params.wasAutoExecuted,
      task_id: task.id,
    });

  if (logErr) {
    console.error(`Failed to log proactive action for user ${params.userId}:`, logErr.message);
  }

  // Dispatch in-app notification for the task
  try {
    const notificationType = mapCategoryToNotificationType(params.category);
    if (notificationType) {
      await supabase.rpc('send_notification', {
        p_user_id: params.userId,
        p_type: notificationType,
        p_title: params.title,
        p_body: params.description.slice(0, 200),
        p_data: { task_id: task.id, deep_link: params.deepLink || null },
        p_related_type: params.relatedEntityType,
        p_related_id: params.relatedEntityId,
      });
    }
  } catch (notifErr) {
    // Non-critical: don't fail the scanner if notification dispatch fails
    console.error('Notification dispatch error:', notifErr);
  }

  return { taskId: task.id, error: null };
}

// Map scanner categories to notification types
function mapCategoryToNotificationType(category: string): string | null {
  const map: Record<string, string> = {
    lease_management: 'lease_expiring_soon',
    rent_collection: 'payment_overdue',
    tenant_finding: 'application_received',
    maintenance: 'maintenance_submitted',
    inspections: 'inspection_scheduled',
    compliance: 'compliance_due_soon',
    financial: 'payment_due',
    communication: 'message_received',
  };
  return map[category] || 'system_announcement';
}

// ---------------------------------------------------------------------------
// Scanner 1: Lease Expiry Warnings (60 / 30 / 14 day windows)
// ---------------------------------------------------------------------------

async function scanLeaseExpiry(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  const leaseAutonomy = getUserAutonomyForCategory(autonomySettings, 'lease_management');

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const today = new Date();
  const windows = [
    { days: 14, label: '14 days', priority: 'urgent' as const },
    { days: 30, label: '30 days', priority: 'high' as const },
    { days: 60, label: '60 days', priority: 'normal' as const },
    { days: 90, label: '90 days', priority: 'normal' as const },
  ];

  for (const window of windows) {
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + window.days);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    // Find active tenancies where lease_end_date is between today and the window boundary
    const { data: expiringTenancies, error: queryErr } = await supabase
      .from('tenancies')
      .select(`
        id, property_id, lease_end_date, lease_start_date, rent_amount, rent_frequency,
        is_periodic, status,
        properties!inner(id, address_line_1, suburb, state, owner_id),
        tenancy_tenants(
          tenant_id, is_primary,
          profiles:tenant_id(full_name, email)
        )
      `)
      .eq('status', 'active')
      .eq('properties.owner_id', userId)
      .gte('lease_end_date', today.toISOString().split('T')[0])
      .lte('lease_end_date', futureDateStr);

    if (queryErr) {
      errors.push(`Lease expiry query (${window.label}): ${queryErr.message}`);
      continue;
    }

    for (const tenancy of expiringTenancies || []) {
      const alreadyExists = await taskExistsForEntity(
        supabase,
        userId,
        tenancy.id,
        'lease expiry',
      );
      if (alreadyExists) continue;

      const property = (tenancy as any).properties;
      const address = [property.address_line_1, property.suburb, property.state]
        .filter(Boolean)
        .join(', ');

      const tenantNames = ((tenancy as any).tenancy_tenants || [])
        .map((tt: any) => tt.profiles?.full_name)
        .filter(Boolean)
        .join(', ');

      const leaseEnd = new Date(tenancy.lease_end_date);
      const daysUntilExpiry = Math.ceil(
        (leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      const endDateFormatted = `${String(leaseEnd.getDate()).padStart(2, '0')}/${String(leaseEnd.getMonth() + 1).padStart(2, '0')}/${leaseEnd.getFullYear()}`;

      // Auto-execution: if autonomy >= L2 and tenant has email, auto-send lease renewal discussion email
      const primaryTenant = ((tenancy as any).tenancy_tenants || []).find((tt: any) => tt.is_primary);
      const primaryTenantEmail = primaryTenant?.profiles?.email;
      const autoExecute = leaseAutonomy >= 2 && !!primaryTenantEmail && daysUntilExpiry <= 60;

      if (autoExecute) {
        const { error: emailErr } = await supabase.from('email_queue').insert({
          to_email: primaryTenantEmail,
          to_name: tenantNames || 'Tenant',
          subject: `Lease Renewal Discussion - ${address}`,
          template_name: 'lease_renewal_discussion',
          template_data: {
            tenant_name: tenantNames || 'Tenant',
            property_address: address,
            lease_end_date: endDateFormatted,
            days_until_expiry: daysUntilExpiry,
          },
          status: 'pending',
        });

        if (!emailErr) {
          await supabase.from('agent_proactive_actions').insert({
            user_id: userId,
            trigger_type: 'lease_expiry',
            trigger_source: `tenancy:${tenancy.id}`,
            action_taken: `Auto-sent lease renewal discussion email to ${tenantNames} (${primaryTenantEmail}) for lease expiring ${endDateFormatted} at ${address}`,
            tool_name: 'send_lease_renewal_notice',
            tool_params: { tenancy_id: tenancy.id, tenant_email: primaryTenantEmail },
            result: { status: 'email_queued' },
            was_auto_executed: true,
          }).then(() => {});
        }
      }

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Lease expiry in ${daysUntilExpiry} days - ${address}`,
        description: autoExecute
          ? `The lease for ${tenantNames || 'tenant'} at ${address} expires on ${endDateFormatted}. A lease renewal discussion email has been automatically sent to the tenant.`
          : `The lease for ${tenantNames || 'tenant'} at ${address} expires on ${endDateFormatted}. You should decide whether to renew, go periodic, or end the tenancy.`,
        category: 'lease_management',
        status: autoExecute ? 'in_progress' : 'pending_input',
        priority: window.priority,
        recommendation: daysUntilExpiry <= 14
          ? `Urgent: The lease expires in ${daysUntilExpiry} days. Contact the tenant immediately to discuss renewal or provide notice as required under the Residential Tenancies Act.`
          : daysUntilExpiry <= 30
            ? `The lease expires in ${daysUntilExpiry} days. Now is a good time to begin renewal discussions with ${tenantNames || 'the tenant'}. Consider whether you want to offer a new fixed term, allow the tenancy to go periodic, or provide notice to vacate.`
            : `The lease expires in ${daysUntilExpiry} days. You have time to plan ahead. Consider reviewing current market rents and deciding on your preferred approach before reaching out to ${tenantNames || 'the tenant'}.`,
        relatedEntityType: 'tenancy',
        relatedEntityId: tenancy.id,
        deepLink: `/(app)/(tabs)/properties/${property.id}`,
        triggerType: 'lease_expiry',
        triggerSource: `tenancy:${tenancy.id}`,
        actionTaken: autoExecute
          ? `Auto-sent lease renewal discussion email (${daysUntilExpiry} days remaining, autonomy L${leaseAutonomy})`
          : `Created lease expiry warning task (${daysUntilExpiry} days remaining)`,
        wasAutoExecuted: autoExecute,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `Detected lease expiring on ${endDateFormatted} (${daysUntilExpiry} days)`,
            status: 'completed',
            reasoning: `Lease end date ${endDateFormatted} falls within the ${window.label} warning window.`,
            data: {
              lease_end_date: tenancy.lease_end_date,
              days_until_expiry: daysUntilExpiry,
              tenant_names: tenantNames,
              property_address: address,
            },
          },
          {
            timestamp: new Date().toISOString(),
            action: autoExecute ? 'Lease renewal discussion email sent to tenant' : 'Awaiting owner decision on lease renewal',
            status: autoExecute ? 'completed' : 'current',
          },
        ],
      });

      if (error) {
        errors.push(`Lease expiry task for tenancy ${tenancy.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 2: Overdue Rent (new arrears detection in the last 24h)
// ---------------------------------------------------------------------------

async function scanOverdueRent(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null,
): Promise<{ tasksCreated: number; autoExecuted: number; errors: string[] }> {
  let tasksCreated = 0;
  let autoExecuted = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, autoExecuted, errors };

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentArrears, error: queryErr } = await supabase
    .from('arrears_records')
    .select(`
      id, tenancy_id, tenant_id, total_overdue, days_overdue, first_overdue_date, severity,
      created_at,
      tenancies!inner(
        id, rent_amount, rent_frequency,
        properties!inner(id, address_line_1, suburb, state, owner_id)
      ),
      profiles:tenant_id(full_name, email, phone)
    `)
    .eq('is_resolved', false)
    .eq('tenancies.properties.owner_id', userId)
    .gte('created_at', twentyFourHoursAgo);

  if (queryErr) {
    errors.push(`Overdue rent query: ${queryErr.message}`);
    return { tasksCreated, autoExecuted, errors };
  }

  const rentCollectionAutonomy = getUserAutonomyForCategory(autonomySettings, 'rent_collection');

  for (const arrears of recentArrears || []) {
    const alreadyExists = await taskExistsForEntity(
      supabase,
      userId,
      arrears.id,
      'overdue rent',
    );
    if (alreadyExists) continue;

    const property = (arrears as any).tenancies?.properties;
    const tenant = (arrears as any).profiles;
    const address = [property?.address_line_1, property?.suburb, property?.state]
      .filter(Boolean)
      .join(', ');
    const tenantName = tenant?.full_name || 'Tenant';
    const overdueAmount = arrears.total_overdue;

    // If autonomy >= L2, auto-queue a rent reminder
    if (rentCollectionAutonomy >= 2 && tenant?.email) {
      // Queue a reminder email
      const { error: emailErr } = await supabase.from('email_queue').insert({
        to_email: tenant.email,
        to_name: tenantName,
        subject: `Rent Payment Reminder - ${address}`,
        template_name: 'rent_reminder',
        template_data: {
          tenant_name: tenantName,
          property_address: address,
          amount: `$${Number(overdueAmount).toFixed(2)}`,
          custom_message: '',
        },
        status: 'pending',
      });

      if (emailErr) {
        errors.push(`Auto-send reminder for arrears ${arrears.id}: ${emailErr.message}`);
      } else {
        autoExecuted++;

        // Log the auto-executed action
        const { error: logErr } = await supabase.from('agent_proactive_actions').insert({
          user_id: userId,
          trigger_type: 'overdue_rent',
          trigger_source: `arrears_record:${arrears.id}`,
          action_taken: `Auto-sent rent reminder to ${tenantName} (${tenant.email}) for $${Number(overdueAmount).toFixed(2)} overdue at ${address}`,
          tool_name: 'send_rent_reminder',
          tool_params: {
            tenancy_id: arrears.tenancy_id,
            tenant_email: tenant.email,
            amount: overdueAmount,
          },
          result: { status: 'email_queued' },
          was_auto_executed: true,
        });

        if (logErr) {
          console.error(`Failed to log auto-executed action: ${logErr.message}`);
        }
      }

      // Still create a task so the owner sees what happened
      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Overdue rent - ${tenantName} at ${address}`,
        description: `${tenantName} has $${Number(overdueAmount).toFixed(2)} in overdue rent at ${address}. A reminder has been automatically sent.`,
        category: 'rent_collection',
        status: 'in_progress',
        priority: arrears.days_overdue >= 14 ? 'urgent' : arrears.days_overdue >= 7 ? 'high' : 'normal',
        recommendation: `A rent reminder has been sent to ${tenantName} at ${tenant.email}. If payment is not received within 7 days, consider escalating with a formal breach notice as per the Residential Tenancies Act.`,
        relatedEntityType: 'arrears_record',
        relatedEntityId: arrears.id,
        deepLink: `/(app)/(tabs)/properties/${property?.id}`,
        triggerType: 'overdue_rent',
        triggerSource: `arrears_record:${arrears.id}`,
        actionTaken: `Auto-sent rent reminder and created monitoring task`,
        wasAutoExecuted: true,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `Detected $${Number(overdueAmount).toFixed(2)} overdue rent (${arrears.days_overdue} days)`,
            status: 'completed',
            reasoning: `Arrears record created within the last 24 hours. Owner autonomy for rent_collection is L${rentCollectionAutonomy} (>= L2), so a reminder was auto-sent.`,
            data: {
              total_overdue: overdueAmount,
              days_overdue: arrears.days_overdue,
              tenant_name: tenantName,
              tenant_email: tenant.email,
            },
          },
          {
            timestamp: new Date().toISOString(),
            action: `Sent payment reminder to ${tenantName}`,
            status: 'completed',
          },
          {
            timestamp: new Date().toISOString(),
            action: 'Monitoring for payment',
            status: 'current',
          },
        ],
      });

      if (error) {
        errors.push(`Overdue rent task for arrears ${arrears.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    } else {
      // Autonomy too low to auto-send; create task for owner input
      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Overdue rent - ${tenantName} at ${address}`,
        description: `${tenantName} has $${Number(overdueAmount).toFixed(2)} in overdue rent at ${address} (${arrears.days_overdue} days overdue). Your input is needed on next steps.`,
        category: 'rent_collection',
        status: 'pending_input',
        priority: arrears.days_overdue >= 14 ? 'urgent' : arrears.days_overdue >= 7 ? 'high' : 'normal',
        recommendation: `${tenantName} owes $${Number(overdueAmount).toFixed(2)} in overdue rent. I recommend sending a friendly payment reminder. If you approve, I can send it immediately. You can also choose to call the tenant directly or issue a formal breach notice.`,
        relatedEntityType: 'arrears_record',
        relatedEntityId: arrears.id,
        deepLink: `/(app)/(tabs)/properties/${property?.id}`,
        triggerType: 'overdue_rent',
        triggerSource: `arrears_record:${arrears.id}`,
        actionTaken: `Created overdue rent task (awaiting owner input, autonomy L${rentCollectionAutonomy})`,
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `Detected $${Number(overdueAmount).toFixed(2)} overdue rent (${arrears.days_overdue} days)`,
            status: 'completed',
            reasoning: `Arrears record created within the last 24 hours. Owner autonomy for rent_collection is L${rentCollectionAutonomy} (< L2), so owner approval is required before sending a reminder.`,
            data: {
              total_overdue: overdueAmount,
              days_overdue: arrears.days_overdue,
              tenant_name: tenantName,
            },
          },
          {
            timestamp: new Date().toISOString(),
            action: 'Awaiting owner decision on next steps',
            status: 'current',
          },
        ],
      });

      if (error) {
        errors.push(`Overdue rent task for arrears ${arrears.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  return { tasksCreated, autoExecuted, errors };
}

// ---------------------------------------------------------------------------
// Scanner 3: New Applications
// ---------------------------------------------------------------------------

async function scanNewApplications(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: newApps, error: queryErr } = await supabase
    .from('applications')
    .select(`
      id, full_name, email, phone, employment_type, employer_name,
      job_title, annual_income, move_in_date, status, submitted_at,
      created_at,
      listings!inner(
        id, title, rent_amount, rent_frequency, owner_id,
        properties!inner(id, address_line_1, suburb, state)
      )
    `)
    .eq('status', 'submitted')
    .eq('listings.owner_id', userId)
    .gte('submitted_at', twentyFourHoursAgo);

  if (queryErr) {
    errors.push(`New applications query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const app of newApps || []) {
    const alreadyExists = await taskExistsForEntity(
      supabase,
      userId,
      app.id,
      'new application',
    );
    if (alreadyExists) continue;

    const listing = (app as any).listings;
    const property = listing?.properties;
    const address = [property?.address_line_1, property?.suburb, property?.state]
      .filter(Boolean)
      .join(', ');

    const weeklyRent = Number(listing?.rent_amount || 0);
    const annualIncome = Number(app.annual_income || 0);
    const incomeToRentRatio = weeklyRent > 0 && annualIncome > 0
      ? (annualIncome / (weeklyRent * 52)).toFixed(1)
      : 'unknown';

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `New application - ${app.full_name} for ${address}`,
      description: `${app.full_name} has applied for ${address} (${listing?.title || 'listing'}). They work as ${app.job_title || 'N/A'} at ${app.employer_name || 'N/A'} with an annual income of $${annualIncome.toLocaleString()}. Income-to-rent ratio: ${incomeToRentRatio}x.`,
      category: 'tenant_finding',
      status: 'pending_input',
      priority: 'high',
      recommendation: annualIncome > 0 && weeklyRent > 0 && annualIncome / (weeklyRent * 52) >= 2.5
        ? `${app.full_name} appears to be a strong applicant with an income-to-rent ratio of ${incomeToRentRatio}x (recommended minimum is 2.5x). Consider reviewing their references and running a background check before shortlisting.`
        : annualIncome > 0 && weeklyRent > 0 && annualIncome / (weeklyRent * 52) < 2.5
          ? `${app.full_name} has an income-to-rent ratio of ${incomeToRentRatio}x, which is below the recommended 2.5x threshold. Review carefully and consider requesting a guarantor or additional documentation.`
          : `${app.full_name} has submitted an application. Review their details and decide whether to shortlist, request more information, or reject.`,
      relatedEntityType: 'application',
      relatedEntityId: app.id,
      deepLink: `/(app)/(tabs)/properties/${property?.id}/applications/${app.id}`,
      triggerType: 'new_application',
      triggerSource: `application:${app.id}`,
      actionTaken: `Created new application review task for ${app.full_name}`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: app.submitted_at || new Date().toISOString(),
          action: `Application received from ${app.full_name}`,
          status: 'completed',
          reasoning: `New application submitted for listing "${listing?.title || 'Unknown'}" at ${address}.`,
          data: {
            applicant_name: app.full_name,
            employment: `${app.job_title || 'N/A'} at ${app.employer_name || 'N/A'}`,
            annual_income: annualIncome,
            income_to_rent_ratio: incomeToRentRatio,
            move_in_date: app.move_in_date,
          },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Awaiting owner review',
          status: 'current',
        },
      ],
    });

    if (error) {
      errors.push(`New application task for ${app.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 4: Stale Listings (no views / applications in 7+ days)
// ---------------------------------------------------------------------------

async function scanStaleListings(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find published listings that were published more than 7 days ago
  // and have not had any recent activity (based on updated_at not changing)
  const { data: staleListings, error: queryErr } = await supabase
    .from('listings')
    .select(`
      id, title, rent_amount, rent_frequency, view_count, application_count,
      published_at, status, updated_at, property_id,
      properties!inner(id, address_line_1, suburb, state, owner_id)
    `)
    .eq('status', 'active')
    .eq('owner_id', userId)
    .lt('published_at', sevenDaysAgo);

  if (queryErr) {
    errors.push(`Stale listings query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const listing of staleListings || []) {
    // Check if there are any recent applications (last 7 days)
    const { count: recentAppCount } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listing.id)
      .gte('created_at', sevenDaysAgo);

    // Only flag listings with low engagement: few views AND no recent apps
    const isStale = (listing.view_count || 0) < 10 && (recentAppCount || 0) === 0;
    if (!isStale) continue;

    const alreadyExists = await taskExistsForEntity(
      supabase,
      userId,
      listing.id,
      'stale listing',
    );
    if (alreadyExists) continue;

    const property = (listing as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state]
      .filter(Boolean)
      .join(', ');

    const publishedDate = listing.published_at ? new Date(listing.published_at) : null;
    const daysSincePublished = publishedDate
      ? Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Stale listing - ${address}`,
      description: `Your listing "${listing.title}" at ${address} has been live for ${daysSincePublished} days with only ${listing.view_count || 0} views and ${listing.application_count || 0} total applications. No new applications in the last 7 days.`,
      category: 'listings',
      status: 'in_progress',
      priority: daysSincePublished >= 21 ? 'high' : 'normal',
      recommendation: `This listing is underperforming. Consider these improvements:\n1. Review the listing title and description for appeal\n2. Check if the rent ($${Number(listing.rent_amount).toFixed(0)}/wk) is competitive for ${property?.suburb || 'the area'}\n3. Add more or better quality photos\n4. Ensure the listing is syndicated to Domain and REA portals\n5. Consider adjusting the rent down by 5-10% to attract more interest`,
      relatedEntityType: 'listing',
      relatedEntityId: listing.id,
      deepLink: `/(app)/(tabs)/properties/${property?.id}/listings/${listing.id}`,
      triggerType: 'stale_listing',
      triggerSource: `listing:${listing.id}`,
      actionTaken: `Created stale listing improvement task (${daysSincePublished} days, ${listing.view_count || 0} views, 0 recent apps)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Detected underperforming listing (${daysSincePublished} days live, ${listing.view_count || 0} views)`,
          status: 'completed',
          reasoning: `Listing published ${daysSincePublished} days ago with ${listing.view_count || 0} views and no applications in the last 7 days. This is below expected engagement.`,
          data: {
            days_since_published: daysSincePublished,
            view_count: listing.view_count || 0,
            application_count: listing.application_count || 0,
            recent_applications: 0,
            rent_amount: listing.rent_amount,
          },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Analysing listing performance and preparing recommendations',
          status: 'current',
        },
      ],
    });

    if (error) {
      errors.push(`Stale listing task for ${listing.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 5: Inspection Due Dates & Overdue Inspections
// ---------------------------------------------------------------------------

async function scanInspectionsDue(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  const inspectionAutonomy = getUserAutonomyForCategory(autonomySettings, 'inspections');

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Find overdue scheduled inspections (scheduled_date has passed, still 'scheduled')
  const { data: overdueInspections, error: overdueErr } = await supabase
    .from('inspections')
    .select(`
      id, property_id, inspection_type, scheduled_date, status,
      properties!inner(id, address_line_1, suburb, state, owner_id)
    `)
    .eq('status', 'scheduled')
    .in('property_id', propertyIds)
    .lt('scheduled_date', todayStr);

  if (overdueErr) {
    errors.push(`Overdue inspections query: ${overdueErr.message}`);
  } else {
    for (const inspection of overdueInspections || []) {
      const alreadyExists = await taskExistsForEntity(
        supabase,
        userId,
        inspection.id,
        'overdue inspection',
      );
      if (alreadyExists) continue;

      const property = (inspection as any).properties;
      const address = [property?.address_line_1, property?.suburb, property?.state]
        .filter(Boolean)
        .join(', ');

      const scheduledDate = new Date(inspection.scheduled_date);
      const overdueDays = Math.floor((now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Overdue inspection - ${address}`,
        description: `A ${inspection.inspection_type} inspection at ${address} was scheduled for ${inspection.scheduled_date} but hasn't been completed. It is ${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue.`,
        category: 'inspections',
        status: 'in_progress',
        priority: overdueDays >= 7 ? 'high' : 'normal',
        recommendation: `This inspection is overdue. Options:\n1. Start the inspection now if you can visit the property\n2. Reschedule to a new date\n3. Cancel if no longer needed`,
        relatedEntityType: 'inspection',
        relatedEntityId: inspection.id,
        deepLink: `/(app)/inspections/${inspection.id}`,
        triggerType: 'overdue_inspection',
        triggerSource: `inspection:${inspection.id}`,
        actionTaken: `Created overdue inspection task (${overdueDays} days overdue)`,
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: now.toISOString(),
            action: `Detected overdue ${inspection.inspection_type} inspection (${overdueDays} days past scheduled date)`,
            status: 'completed',
            reasoning: `Inspection was scheduled for ${inspection.scheduled_date} and is still in 'scheduled' status.`,
            data: { overdue_days: overdueDays, inspection_type: inspection.inspection_type },
          },
          {
            timestamp: now.toISOString(),
            action: 'Awaiting owner action to reschedule or complete',
            status: 'current',
          },
        ],
      });

      if (error) {
        errors.push(`Overdue inspection task for ${inspection.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  // 2. Check for properties that haven't had a routine inspection in the required interval
  // Get the most recent completed inspection per property
  const { data: properties, error: propErr } = await supabase
    .from('properties')
    .select('id, address_line_1, suburb, state, owner_id')
    .in('id', propertyIds)
    .is('deleted_at', null);

  if (propErr) {
    errors.push(`Properties query for inspection due: ${propErr.message}`);
    return { tasksCreated, errors };
  }

  for (const property of properties || []) {
    const { data: lastInspection } = await supabase
      .from('inspections')
      .select('id, scheduled_date, inspection_type, status')
      .eq('property_id', property.id)
      .eq('inspection_type', 'routine')
      .in('status', ['completed', 'finalized'])
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check if there's already a scheduled routine inspection
    const { data: scheduledInspection } = await supabase
      .from('inspections')
      .select('id')
      .eq('property_id', property.id)
      .eq('inspection_type', 'routine')
      .eq('status', 'scheduled')
      .limit(1)
      .maybeSingle();

    if (scheduledInspection) continue; // Already has one scheduled

    // Check if an active tenancy exists (no point inspecting vacant properties)
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('id')
      .eq('property_id', property.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!tenancy) continue;

    // Default to 6 months if state unknown, use 3 for QLD/WA
    const state = (property as any).state || 'NSW';
    const intervalMonths = (state === 'QLD' || state === 'WA') ? 3 : (state === 'SA') ? 4 : 6;
    const intervalMs = intervalMonths * 30.44 * 24 * 60 * 60 * 1000;

    const lastDate = lastInspection?.scheduled_date
      ? new Date(lastInspection.scheduled_date)
      : null;

    // If no inspection ever done, or interval has elapsed
    const isDue = !lastDate || (now.getTime() - lastDate.getTime()) >= intervalMs;
    if (!isDue) continue;

    const alreadyExists = await taskExistsForEntity(
      supabase,
      userId,
      property.id,
      'routine inspection due',
    );
    if (alreadyExists) continue;

    const address = [(property as any).address_line_1, (property as any).suburb, (property as any).state]
      .filter(Boolean)
      .join(', ');

    const monthsSinceLastStr = lastDate
      ? `${Math.floor((now.getTime() - lastDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000))} months since last inspection`
      : 'No routine inspection on record';

    // Auto-execution: if inspection autonomy >= L2, auto-schedule an inspection 14 days from now
    const autoScheduleInspection = inspectionAutonomy >= 2;
    let autoScheduledDate = '';

    if (autoScheduleInspection) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 14);
      autoScheduledDate = scheduledDate.toISOString().split('T')[0];

      const { error: scheduleErr } = await supabase.from('inspections').insert({
        property_id: property.id,
        inspection_type: 'routine',
        scheduled_date: autoScheduledDate,
        status: 'scheduled',
        created_by: userId,
      });

      if (!scheduleErr) {
        await supabase.from('agent_proactive_actions').insert({
          user_id: userId,
          trigger_type: 'routine_inspection_due',
          trigger_source: `property:${property.id}`,
          action_taken: `Auto-scheduled routine inspection for ${address} on ${autoScheduledDate}`,
          tool_name: 'schedule_inspection',
          tool_params: { property_id: property.id, date: autoScheduledDate },
          result: { status: 'inspection_scheduled' },
          was_auto_executed: true,
        }).then(() => {});
      }
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Routine inspection due - ${address}`,
      description: autoScheduleInspection
        ? `A routine inspection has been auto-scheduled for ${address} on ${autoScheduledDate}. ${monthsSinceLastStr}. ${state} requires routine inspections every ${intervalMonths} months.`
        : `A routine inspection is due for ${address}. ${monthsSinceLastStr}. ${state} requires routine inspections at least every ${intervalMonths} months.`,
      category: 'inspections',
      status: autoScheduleInspection ? 'in_progress' : 'in_progress',
      priority: 'normal',
      recommendation: autoScheduleInspection
        ? `An inspection has been auto-scheduled for ${autoScheduledDate}. Under ${state} tenancy law, you must provide 7 days written notice to the tenant before the inspection.`
        : `Schedule a routine inspection for this property. Under ${state} tenancy law, routine inspections must be conducted at least every ${intervalMonths} months with 7 days written notice to the tenant.`,
      relatedEntityType: 'property',
      relatedEntityId: property.id,
      deepLink: `/(app)/inspections/schedule?property_id=${property.id}&type=routine`,
      triggerType: 'routine_inspection_due',
      triggerSource: `property:${property.id}`,
      actionTaken: autoScheduleInspection
        ? `Auto-scheduled routine inspection for ${autoScheduledDate} (autonomy L${inspectionAutonomy})`
        : `Created routine inspection due task (${monthsSinceLastStr})`,
      wasAutoExecuted: autoScheduleInspection,
      timelineEntries: [
        {
          timestamp: now.toISOString(),
          action: `Detected routine inspection due for ${address}`,
          status: 'completed',
          reasoning: `${monthsSinceLastStr}. ${state} requires inspections every ${intervalMonths} months.`,
          data: { state, interval_months: intervalMonths, last_inspection_date: lastDate?.toISOString() || null },
        },
        {
          timestamp: now.toISOString(),
          action: 'Awaiting scheduling',
          status: 'current',
        },
      ],
    });

    if (error) {
      errors.push(`Routine inspection due task for ${property.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 6: Maintenance Follow-Up (open requests with no activity in 3+ days)
// ---------------------------------------------------------------------------

async function scanMaintenanceFollowUp(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  const maintenanceAutonomy = getUserAutonomyForCategory(autonomySettings, 'maintenance');

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleRequests, error: queryErr } = await supabase
    .from('maintenance_requests')
    .select(`
      id, title, urgency, status, status_changed_at, created_at,
      property_id, tenant_id, category,
      properties!inner(id, address_line_1, suburb, state, owner_id),
      profiles:tenant_id(full_name)
    `)
    .in('property_id', propertyIds)
    .in('status', ['submitted', 'acknowledged', 'awaiting_quote'])
    .lt('status_changed_at', threeDaysAgo);

  if (queryErr) {
    errors.push(`Maintenance follow-up query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const req of staleRequests || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, req.id, 'maintenance follow');
    if (alreadyExists) continue;

    const property = (req as any).properties;
    const tenant = (req as any).profiles;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const daysSinceActivity = Math.floor((Date.now() - new Date(req.status_changed_at).getTime()) / (1000 * 60 * 60 * 24));

    // Auto-execution: if maintenance autonomy >= L2 and request is 'submitted', auto-acknowledge it
    const autoAcknowledge = maintenanceAutonomy >= 2 && req.status === 'submitted';

    if (autoAcknowledge) {
      await supabase.from('maintenance_requests')
        .update({ status: 'acknowledged', status_changed_at: new Date().toISOString() })
        .eq('id', req.id);

      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: 'maintenance_follow_up',
        trigger_source: `maintenance_request:${req.id}`,
        action_taken: `Auto-acknowledged stale maintenance request "${req.title}" at ${address} (${daysSinceActivity} days without response)`,
        tool_name: 'acknowledge_maintenance',
        tool_params: { request_id: req.id },
        result: { status: 'acknowledged' },
        was_auto_executed: true,
      }).then(() => {});
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Maintenance stalled - ${req.title} at ${address}`,
      description: autoAcknowledge
        ? `"${req.title}" reported by ${tenant?.full_name || 'tenant'} has been auto-acknowledged after ${daysSinceActivity} days. Please arrange a trade or next step.`
        : `"${req.title}" reported by ${tenant?.full_name || 'tenant'} has been in "${req.status.replace(/_/g, ' ')}" status for ${daysSinceActivity} days with no updates.`,
      category: 'maintenance',
      status: autoAcknowledge ? 'in_progress' : 'pending_input',
      priority: req.urgency === 'emergency' ? 'urgent' : req.urgency === 'urgent' ? 'high' : 'normal',
      recommendation: req.status === 'submitted'
        ? autoAcknowledge
          ? `The request has been auto-acknowledged. Next step: get quotes from your preferred trades, or assign directly if you already know the right contractor.`
          : `This request hasn't been acknowledged yet. Review it and either acknowledge, request more info from the tenant, or arrange a trade.`
        : req.status === 'awaiting_quote'
          ? `Quotes were requested but haven't been received in ${daysSinceActivity} days. Follow up with the trades, or find alternative contractors.`
          : `This request needs attention. Consider the next step: get quotes, assign a trade, or communicate with the tenant.`,
      relatedEntityType: 'maintenance_request',
      relatedEntityId: req.id,
      deepLink: `/(app)/maintenance/${req.id}`,
      triggerType: 'maintenance_follow_up',
      triggerSource: `maintenance_request:${req.id}`,
      actionTaken: autoAcknowledge
        ? `Auto-acknowledged stale request (${daysSinceActivity} days, autonomy L${maintenanceAutonomy})`
        : `Created maintenance follow-up task (${daysSinceActivity} days stale, status: ${req.status})`,
      wasAutoExecuted: autoAcknowledge,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Detected stale maintenance request (${daysSinceActivity} days in "${req.status.replace(/_/g, ' ')}")`,
          status: 'completed',
          reasoning: `Request "${req.title}" last changed status on ${new Date(req.status_changed_at).toLocaleDateString('en-AU')}. Urgency: ${req.urgency}.`,
          data: { days_stale: daysSinceActivity, current_status: req.status, urgency: req.urgency },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Awaiting owner decision',
          status: 'current',
        },
      ],
    });

    if (error) {
      errors.push(`Maintenance follow-up task for ${req.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 7: Communication Follow-Up (unread messages for 48+ hours)
// ---------------------------------------------------------------------------

async function scanCommunicationFollowUp(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Find conversations where the owner has unread messages older than 48h
  const { data: unreadConversations, error: queryErr } = await supabase
    .from('conversation_participants')
    .select(`
      conversation_id, unread_count, last_read_at,
      conversations!inner(
        id, title, last_message_at, last_message_preview,
        property_id,
        properties(address_line_1, suburb, state)
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('unread_count', 0)
    .lt('conversations.last_message_at', fortyEightHoursAgo);

  if (queryErr) {
    errors.push(`Communication follow-up query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const participant of unreadConversations || []) {
    const conversation = (participant as any).conversations;
    const alreadyExists = await taskExistsForEntity(supabase, userId, participant.conversation_id, 'unread message');
    if (alreadyExists) continue;

    const property = conversation?.properties;
    const address = property
      ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ')
      : '';
    const title = conversation?.title || (address ? `Messages - ${address}` : 'Unread messages');
    const hoursSinceMessage = Math.floor((Date.now() - new Date(conversation.last_message_at).getTime()) / (1000 * 60 * 60));

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Unanswered message - ${title}`,
      description: `You have ${participant.unread_count} unread message${participant.unread_count > 1 ? 's' : ''} in "${title}". The last message was sent ${hoursSinceMessage} hours ago. Preview: "${(conversation.last_message_preview || '').substring(0, 100)}"`,
      category: 'communication',
      status: 'pending_input',
      priority: hoursSinceMessage >= 72 ? 'high' : 'normal',
      recommendation: `Respond to this conversation to maintain good communication with your tenant. Timely responses help prevent issues from escalating.`,
      relatedEntityType: 'conversation',
      relatedEntityId: participant.conversation_id,
      deepLink: `/(app)/messages/${participant.conversation_id}`,
      triggerType: 'unanswered_message',
      triggerSource: `conversation:${participant.conversation_id}`,
      actionTaken: `Created unanswered message task (${participant.unread_count} unread, ${hoursSinceMessage}h ago)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Detected ${participant.unread_count} unread message${participant.unread_count > 1 ? 's' : ''} (${hoursSinceMessage}h old)`,
          status: 'completed',
          data: { unread_count: participant.unread_count, hours_since_message: hoursSinceMessage },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Awaiting your response',
          status: 'current',
        },
      ],
    });

    if (error) {
      errors.push(`Communication follow-up task for conversation ${participant.conversation_id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 8: Financial Anomaly Detection (duplicate or unusual payments)
// ---------------------------------------------------------------------------

async function scanFinancialAnomalies(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get tenancies for the owner's properties
  const { data: tenancies, error: tenancyErr } = await supabase
    .from('tenancies')
    .select('id, rent_amount, rent_frequency, property_id, properties!inner(address_line_1, suburb, state, owner_id)')
    .in('property_id', propertyIds)
    .eq('status', 'active');

  if (tenancyErr) {
    errors.push(`Financial anomaly tenancies query: ${tenancyErr.message}`);
    return { tasksCreated, errors };
  }

  for (const tenancy of tenancies || []) {
    // Check for duplicate payments in the last 7 days
    const { data: recentPayments, error: payErr } = await supabase
      .from('payments')
      .select('id, amount, paid_at, status, created_at')
      .eq('tenancy_id', tenancy.id)
      .eq('status', 'completed')
      .gte('paid_at', sevenDaysAgo)
      .order('paid_at', { ascending: false });

    if (payErr) {
      errors.push(`Financial anomaly payments query for tenancy ${tenancy.id}: ${payErr.message}`);
      continue;
    }

    if (!recentPayments || recentPayments.length < 2) continue;

    // Check for duplicate amounts on the same day
    const paymentsByDay: Record<string, typeof recentPayments> = {};
    for (const payment of recentPayments) {
      const day = payment.paid_at ? new Date(payment.paid_at).toISOString().split('T')[0] : 'unknown';
      if (!paymentsByDay[day]) paymentsByDay[day] = [];
      paymentsByDay[day].push(payment);
    }

    for (const [day, dayPayments] of Object.entries(paymentsByDay)) {
      if (dayPayments.length < 2) continue;

      // Check if any two payments on the same day have the same amount
      const amounts = dayPayments.map(p => Number(p.amount));
      const hasDuplicates = amounts.some((amt, idx) => amounts.indexOf(amt) !== idx);
      if (!hasDuplicates) continue;

      const firstPayment = dayPayments[0];
      const entityKey = `${tenancy.id}-${day}`;
      const alreadyExists = await taskExistsForEntity(supabase, userId, entityKey, 'duplicate payment');
      if (alreadyExists) continue;

      const property = (tenancy as any).properties;
      const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Possible duplicate payment - ${address}`,
        description: `${dayPayments.length} payments were recorded on ${day} for ${address}. This may indicate a duplicate payment that needs investigation.`,
        category: 'financial',
        status: 'pending_input',
        priority: 'high',
        recommendation: `Review the ${dayPayments.length} payments from ${day}. If a duplicate exists, process a refund to the tenant to maintain trust and avoid legal issues.`,
        relatedEntityType: 'tenancy',
        relatedEntityId: tenancy.id,
        deepLink: `/(app)/(tabs)/portfolio`,
        triggerType: 'duplicate_payment',
        triggerSource: `tenancy:${tenancy.id}`,
        actionTaken: `Created duplicate payment investigation task (${dayPayments.length} payments on ${day})`,
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `Detected ${dayPayments.length} payments on ${day} for ${address}`,
            status: 'completed',
            data: { payment_count: dayPayments.length, day, amounts: amounts },
          },
          {
            timestamp: new Date().toISOString(),
            action: 'Awaiting owner review',
            status: 'current',
          },
        ],
      });

      if (error) {
        errors.push(`Financial anomaly task for tenancy ${tenancy.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 9: Payment Plan Monitoring (missed installments)
// ---------------------------------------------------------------------------

async function scanPaymentPlanDefaults(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const todayStr = new Date().toISOString().split('T')[0];

  // Find active payment plans for the owner's tenancies
  const { data: activePlans, error: planErr } = await supabase
    .from('payment_plans')
    .select(`
      id, total_arrears, installment_amount, next_due_date, status,
      amount_paid, installments_paid, total_installments,
      tenancies!inner(
        id, property_id,
        properties!inner(id, address_line_1, suburb, state, owner_id),
        tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name))
      )
    `)
    .eq('status', 'active')
    .eq('tenancies.properties.owner_id', userId)
    .lt('next_due_date', todayStr);

  if (planErr) {
    errors.push(`Payment plan defaults query: ${planErr.message}`);
    return { tasksCreated, errors };
  }

  for (const plan of activePlans || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, plan.id, 'payment plan');
    if (alreadyExists) continue;

    // Check for missed installments
    const { count: missedCount } = await supabase
      .from('payment_plan_installments')
      .select('id', { count: 'exact', head: true })
      .eq('payment_plan_id', plan.id)
      .eq('is_paid', false)
      .lt('due_date', todayStr);

    if (!missedCount || missedCount === 0) continue;

    const tenancy = (plan as any).tenancies;
    const property = tenancy?.properties;
    const tenantNames = (tenancy?.tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');
    const tenant = { full_name: tenantNames || 'Tenant' };
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantName = tenant?.full_name || 'Tenant';
    const daysOverdue = plan.next_due_date
      ? Math.floor((Date.now() - new Date(plan.next_due_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Payment plan default - ${tenantName} at ${address}`,
      description: `${tenantName} has missed ${missedCount} installment${missedCount > 1 ? 's' : ''} on their payment plan for ${address}. The plan covers $${Number(plan.total_arrears).toFixed(2)} in arrears with $${Number(plan.amount_paid).toFixed(2)} paid so far.`,
      category: 'rent_collection',
      status: 'pending_input',
      priority: missedCount >= 2 ? 'urgent' : 'high',
      recommendation: missedCount >= 2
        ? `${tenantName} has missed ${missedCount} installments. Consider escalating: contact the tenant, revise the plan, or begin formal breach proceedings if the plan has been materially breached.`
        : `${tenantName} missed their last installment (due ${plan.next_due_date}). Contact them to arrange catch-up payment before the situation worsens.`,
      relatedEntityType: 'payment_plan',
      relatedEntityId: plan.id,
      deepLink: `/(app)/(tabs)/portfolio`,
      triggerType: 'payment_plan_default',
      triggerSource: `payment_plan:${plan.id}`,
      actionTaken: `Created payment plan default task (${missedCount} missed installments)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Detected ${missedCount} missed payment plan installment${missedCount > 1 ? 's' : ''}`,
          status: 'completed',
          reasoning: `Payment plan next_due_date was ${plan.next_due_date}. ${missedCount} installments remain unpaid past their due date.`,
          data: {
            missed_installments: missedCount,
            total_arrears: plan.total_arrears,
            amount_paid: plan.amount_paid,
            days_overdue: daysOverdue,
          },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Awaiting owner decision on next steps',
          status: 'current',
        },
      ],
    });

    if (error) {
      errors.push(`Payment plan default task for ${plan.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 10: Listing Performance Decline
// ---------------------------------------------------------------------------

async function scanListingPerformance(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Find active listings that have been published for 14+ days with 0 applications
  const { data: lowPerformers, error: queryErr } = await supabase
    .from('listings')
    .select(`
      id, title, rent_amount, rent_frequency, view_count,
      application_count, published_at, status, property_id,
      properties!inner(id, address_line_1, suburb, state, owner_id)
    `)
    .eq('status', 'active')
    .eq('owner_id', userId)
    .lt('published_at', fourteenDaysAgo)
    .eq('application_count', 0);

  if (queryErr) {
    errors.push(`Listing performance query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const listing of lowPerformers || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, listing.id, 'listing performance');
    if (alreadyExists) continue;

    const property = (listing as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const daysSincePublished = Math.floor((Date.now() - new Date(listing.published_at).getTime()) / (1000 * 60 * 60 * 24));

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Zero applications - ${address}`,
      description: `Your listing "${listing.title}" at ${address} has been live for ${daysSincePublished} days with ${listing.view_count || 0} views but zero applications. This strongly suggests the listing needs changes.`,
      category: 'listings',
      status: 'pending_input',
      priority: daysSincePublished >= 28 ? 'urgent' : 'high',
      recommendation: `After ${daysSincePublished} days with no applications, consider:\n1. Reduce rent by 5-10% — your listing at $${Number(listing.rent_amount).toFixed(0)}/${listing.rent_frequency === 'weekly' ? 'wk' : 'mo'} may be above market\n2. Improve photos and description\n3. Check if listing appears correctly on portals\n4. Consider offering incentives (1 week free, flexible move-in)`,
      relatedEntityType: 'listing',
      relatedEntityId: listing.id,
      deepLink: `/(app)/(tabs)/portfolio`,
      triggerType: 'listing_no_applications',
      triggerSource: `listing:${listing.id}`,
      actionTaken: `Created listing performance task (${daysSincePublished} days, 0 applications)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Detected zero applications after ${daysSincePublished} days (${listing.view_count || 0} views)`,
          status: 'completed',
          data: { days_published: daysSincePublished, view_count: listing.view_count || 0, rent_amount: listing.rent_amount },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Awaiting owner decision on listing changes',
          status: 'current',
        },
      ],
    });

    if (error) {
      errors.push(`Listing performance task for ${listing.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 11: Maintenance Urgency Escalation (emergency/urgent not acknowledged quickly)
// ---------------------------------------------------------------------------

async function scanMaintenanceUrgencyEscalation(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const now = new Date();

  // Emergency requests not acknowledged within 4 hours
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  // Urgent requests not acknowledged within 24 hours
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: emergencyRequests, error: emergErr } = await supabase
    .from('maintenance_requests')
    .select(`
      id, title, urgency, status, created_at, category,
      property_id, tenant_id,
      properties!inner(id, address_line_1, suburb, state, owner_id),
      profiles:tenant_id(full_name, phone)
    `)
    .in('property_id', propertyIds)
    .eq('status', 'submitted')
    .eq('urgency', 'emergency')
    .lt('created_at', fourHoursAgo);

  if (emergErr) {
    errors.push(`Maintenance urgency (emergency) query: ${emergErr.message}`);
  } else {
    for (const req of emergencyRequests || []) {
      const alreadyExists = await taskExistsForEntity(supabase, userId, req.id, 'emergency maintenance');
      if (alreadyExists) continue;

      const property = (req as any).properties;
      const tenant = (req as any).profiles;
      const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
      const hoursSinceSubmitted = Math.floor((now.getTime() - new Date(req.created_at).getTime()) / (1000 * 60 * 60));

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `EMERGENCY not acknowledged - ${req.title}`,
        description: `Emergency maintenance request "${req.title}" from ${tenant?.full_name || 'tenant'} at ${address} has been waiting ${hoursSinceSubmitted} hours without acknowledgement. Category: ${req.category}.`,
        category: 'maintenance',
        status: 'pending_input',
        priority: 'urgent',
        recommendation: `This is an emergency request that has been unacknowledged for ${hoursSinceSubmitted} hours. Under tenancy legislation, landlords must respond to emergencies promptly. Acknowledge immediately and arrange emergency repairs.${tenant?.phone ? ` Tenant phone: ${tenant.phone}` : ''}`,
        relatedEntityType: 'maintenance_request',
        relatedEntityId: req.id,
        deepLink: `/(app)/maintenance/${req.id}`,
        triggerType: 'emergency_maintenance_unacknowledged',
        triggerSource: `maintenance_request:${req.id}`,
        actionTaken: `Created emergency escalation task (${hoursSinceSubmitted}h unacknowledged)`,
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `EMERGENCY: "${req.title}" unacknowledged for ${hoursSinceSubmitted} hours`,
            status: 'completed',
            reasoning: `Emergency requests should be acknowledged within 4 hours. This has been waiting ${hoursSinceSubmitted} hours.`,
            data: { hours_waiting: hoursSinceSubmitted, category: req.category, urgency: 'emergency' },
          },
          {
            timestamp: new Date().toISOString(),
            action: 'Requires immediate owner action',
            status: 'current',
          },
        ],
      });

      if (error) {
        errors.push(`Emergency escalation task for ${req.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  // Urgent requests not acknowledged within 24 hours
  const { data: urgentRequests, error: urgentErr } = await supabase
    .from('maintenance_requests')
    .select(`
      id, title, urgency, status, created_at, category,
      property_id, tenant_id,
      properties!inner(id, address_line_1, suburb, state, owner_id),
      profiles:tenant_id(full_name)
    `)
    .in('property_id', propertyIds)
    .eq('status', 'submitted')
    .eq('urgency', 'urgent')
    .lt('created_at', twentyFourHoursAgo);

  if (urgentErr) {
    errors.push(`Maintenance urgency (urgent) query: ${urgentErr.message}`);
  } else {
    for (const req of urgentRequests || []) {
      const alreadyExists = await taskExistsForEntity(supabase, userId, req.id, 'urgent maintenance');
      if (alreadyExists) continue;

      const property = (req as any).properties;
      const tenant = (req as any).profiles;
      const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
      const hoursSinceSubmitted = Math.floor((now.getTime() - new Date(req.created_at).getTime()) / (1000 * 60 * 60));

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Urgent request unacknowledged - ${req.title}`,
        description: `Urgent maintenance request "${req.title}" from ${tenant?.full_name || 'tenant'} at ${address} has been waiting ${hoursSinceSubmitted} hours.`,
        category: 'maintenance',
        status: 'pending_input',
        priority: 'high',
        recommendation: `This urgent request has been waiting over 24 hours. Acknowledge it and plan next steps to avoid tenant complaints or escalation.`,
        relatedEntityType: 'maintenance_request',
        relatedEntityId: req.id,
        deepLink: `/(app)/maintenance/${req.id}`,
        triggerType: 'urgent_maintenance_unacknowledged',
        triggerSource: `maintenance_request:${req.id}`,
        actionTaken: `Created urgent maintenance escalation task (${hoursSinceSubmitted}h unacknowledged)`,
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `Urgent request "${req.title}" unacknowledged for ${hoursSinceSubmitted} hours`,
            status: 'completed',
            data: { hours_waiting: hoursSinceSubmitted, category: req.category, urgency: 'urgent' },
          },
          {
            timestamp: new Date().toISOString(),
            action: 'Awaiting owner acknowledgement',
            status: 'current',
          },
        ],
      });

      if (error) {
        errors.push(`Urgent maintenance escalation task for ${req.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 12: Compliance Gaps (overdue inspections, stale safety checks)
// ---------------------------------------------------------------------------

async function scanComplianceGaps(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  const complianceAutonomy = getUserAutonomyForCategory(autonomySettings, 'compliance');

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const today = new Date().toISOString().split('T')[0];

  // Find overdue inspections (scheduled in the past, not completed/cancelled)
  const { data: overdueInspections, error: inspErr } = await supabase
    .from('inspections')
    .select(`
      id, property_id, inspection_type, scheduled_date, status,
      properties!inner(address_line_1, suburb, state, owner_id)
    `)
    .in('property_id', propertyIds)
    .lt('scheduled_date', today)
    .not('status', 'in', '("completed","cancelled")')
    .order('scheduled_date', { ascending: true });

  if (inspErr) {
    errors.push(`Compliance gaps query: ${inspErr.message}`);
  } else {
    for (const insp of overdueInspections || []) {
      const alreadyExists = await taskExistsForEntity(supabase, userId, insp.id, 'compliance');
      if (alreadyExists) continue;

      const property = (insp as any).properties;
      const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
      const daysOverdue = Math.floor((new Date().getTime() - new Date(insp.scheduled_date).getTime()) / 86400000);
      const inspType = (insp.inspection_type || 'routine').replace('_', ' ');

      // Auto-execution: if compliance autonomy >= L2, auto-send compliance reminder via send-compliance-reminders
      const autoExecuteCompliance = complianceAutonomy >= 2;

      if (autoExecuteCompliance) {
        await supabase.from('agent_proactive_actions').insert({
          user_id: userId,
          trigger_type: 'compliance_inspection_overdue',
          trigger_source: `inspection:${insp.id}`,
          action_taken: `Auto-flagged overdue ${inspType} inspection at ${address} (${daysOverdue} days overdue). Compliance reminder will be sent via scheduled function.`,
          tool_name: 'flag_compliance_gap',
          tool_params: { inspection_id: insp.id, property_id: insp.property_id },
          result: { status: 'flagged' },
          was_auto_executed: true,
        }).then(() => {});
      }

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Overdue ${inspType} inspection - ${address}`,
        description: autoExecuteCompliance
          ? `A ${inspType} inspection at ${address} is ${daysOverdue} days overdue. This has been automatically flagged and a compliance reminder is being sent.`
          : `A ${inspType} inspection at ${address} was scheduled for ${insp.scheduled_date} and is now ${daysOverdue} days overdue. Current status: ${insp.status}.`,
        category: 'compliance',
        status: autoExecuteCompliance ? 'in_progress' : 'pending_input',
        priority: daysOverdue > 30 ? 'high' : 'normal',
        recommendation: `This inspection is ${daysOverdue} days overdue. In most Australian states, routine inspections must be completed within prescribed timeframes. Reschedule this inspection as soon as possible to maintain compliance.`,
        relatedEntityType: 'inspection',
        relatedEntityId: insp.id,
        deepLink: `/(app)/inspections/${insp.id}`,
        triggerType: 'compliance_inspection_overdue',
        triggerSource: `inspection:${insp.id}`,
        actionTaken: autoExecuteCompliance
          ? `Auto-flagged compliance gap (${daysOverdue} days overdue, autonomy L${complianceAutonomy})`
          : `Created compliance gap task (${daysOverdue} days overdue)`,
        wasAutoExecuted: autoExecuteCompliance,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `${inspType} inspection overdue by ${daysOverdue} days at ${address}`,
            status: 'completed' as const,
            reasoning: `Scheduled for ${insp.scheduled_date}, current status: ${insp.status}`,
            data: { days_overdue: daysOverdue, inspection_type: insp.inspection_type },
          },
          {
            timestamp: new Date().toISOString(),
            action: autoExecuteCompliance ? 'Compliance reminder sent automatically' : 'Requires rescheduling',
            status: autoExecuteCompliance ? 'completed' as const : 'current' as const,
          },
        ],
      });

      if (error) {
        errors.push(`Compliance gap task for inspection ${insp.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  // Check for properties with no routine inspection in the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString();

  for (const propertyId of propertyIds) {
    const { data: recentInspections } = await supabase
      .from('inspections')
      .select('id')
      .eq('property_id', propertyId)
      .eq('inspection_type', 'routine')
      .gte('scheduled_date', sixMonthsAgoStr.split('T')[0])
      .limit(1);

    if (recentInspections && recentInspections.length > 0) continue;

    // Check if tenancy is active for this property
    const { data: activeTenancy } = await supabase
      .from('tenancies')
      .select('id')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .limit(1);

    if (!activeTenancy || activeTenancy.length === 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, propertyId, 'routine inspection');
    if (alreadyExists) continue;

    const { data: propData } = await supabase
      .from('properties')
      .select('address_line_1, suburb, state')
      .eq('id', propertyId)
      .single();

    const address = propData ? [propData.address_line_1, propData.suburb, propData.state].filter(Boolean).join(', ') : propertyId;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `No routine inspection in 6+ months - ${address}`,
      description: `The property at ${address} has an active tenancy but no routine inspection scheduled or completed in the last 6 months.`,
      category: 'compliance',
      status: 'pending_input',
      priority: 'normal',
      recommendation: `Most Australian states require or recommend routine inspections every 3-6 months. Schedule a routine inspection to stay compliant and maintain the property condition record.`,
      relatedEntityType: 'property',
      relatedEntityId: propertyId,
      deepLink: `/(app)/properties/${propertyId}`,
      triggerType: 'compliance_no_routine_inspection',
      triggerSource: `property:${propertyId}`,
      actionTaken: `Created task for missing routine inspection (6+ months)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `No routine inspection in 6+ months at ${address}`,
          status: 'completed' as const,
          reasoning: 'Routine inspections should be conducted every 3-6 months for occupied properties.',
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Schedule routine inspection',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Compliance routine inspection task for ${propertyId}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 12B: Property Compliance Items (smoke alarms, pool safety, gas, electrical, insurance)
// Scans the property_compliance table for overdue and upcoming items.
// Creates tasks and triggers compliance reminder emails via send-compliance-reminders.
// ---------------------------------------------------------------------------

async function scanPropertyComplianceItems(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  const complianceAutonomy = getUserAutonomyForCategory(autonomySettings, 'compliance');

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Find overdue and upcoming compliance items for this user's properties
  const { data: complianceItems, error: compErr } = await supabase
    .from('property_compliance')
    .select(`
      id, property_id, status, next_due_date, last_completed_at, notes,
      compliance_requirements(name, category, is_mandatory, frequency_months),
      properties!inner(address_line_1, suburb, state, owner_id)
    `)
    .in('property_id', propertyIds)
    .in('status', ['overdue', 'upcoming', 'pending'])
    .not('status', 'eq', 'exempt');

  if (compErr) {
    errors.push(`Property compliance query: ${compErr.message}`);
    return { tasksCreated, errors };
  }

  // Process overdue items — create tasks
  const overdueItems = (complianceItems || []).filter((item: any) => {
    if (item.status === 'overdue') return true;
    if (item.next_due_date && new Date(item.next_due_date) < now) return true;
    return false;
  });

  for (const item of overdueItems) {
    const req = (item as any).compliance_requirements;
    const prop = (item as any).properties;
    const itemName = req?.name || 'Compliance item';
    const address = [prop?.address_line_1, prop?.suburb, prop?.state].filter(Boolean).join(', ');
    const daysOverdue = item.next_due_date
      ? Math.floor((now.getTime() - new Date(item.next_due_date).getTime()) / 86400000)
      : 0;

    const alreadyExists = await taskExistsForEntity(supabase, userId, item.id, 'compliance_item');
    if (alreadyExists) continue;

    // Update status to overdue if not already
    if (item.status !== 'overdue') {
      await supabase.from('property_compliance').update({ status: 'overdue' }).eq('id', item.id);
    }

    const autoExecute = complianceAutonomy >= 2;

    if (autoExecute) {
      // Log proactive action
      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: 'compliance_item_overdue',
        trigger_source: `property_compliance:${item.id}`,
        action_taken: `Auto-flagged overdue ${itemName} at ${address} (${daysOverdue} days overdue). Compliance reminder queued.`,
        tool_name: 'flag_compliance_gap',
        tool_params: { compliance_id: item.id, property_id: item.property_id },
        result: { status: 'flagged' },
        was_auto_executed: true,
      }).then(() => {});
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Overdue: ${itemName} — ${address}`,
      description: autoExecute
        ? `${itemName} at ${address} is ${daysOverdue} days overdue. A compliance reminder has been automatically queued.${req?.is_mandatory ? ' This is a mandatory compliance requirement.' : ''}`
        : `${itemName} at ${address} is overdue by ${daysOverdue} days.${req?.is_mandatory ? ' This is a mandatory compliance requirement in your state.' : ''} Last completed: ${item.last_completed_at ? new Date(item.last_completed_at).toLocaleDateString('en-AU') : 'Never'}.`,
      category: 'compliance',
      status: autoExecute ? 'in_progress' : 'pending_input',
      priority: daysOverdue > 30 || req?.is_mandatory ? 'high' : 'normal',
      recommendation: `Record the completion of this compliance item in the Compliance dashboard, or mark it as exempt if not applicable to this property.`,
      relatedEntityType: 'property_compliance',
      relatedEntityId: item.id,
      deepLink: `/(app)/compliance`,
      triggerType: 'compliance_item_overdue',
      triggerSource: `property_compliance:${item.id}`,
      actionTaken: autoExecute
        ? `Auto-flagged overdue compliance item (${daysOverdue} days, autonomy L${complianceAutonomy})`
        : `Created compliance task for overdue ${itemName}`,
      wasAutoExecuted: autoExecute,
      timelineEntries: [
        {
          timestamp: now.toISOString(),
          action: `${itemName} overdue by ${daysOverdue} days at ${address}`,
          status: 'completed' as const,
          reasoning: `Next due: ${item.next_due_date}, last completed: ${item.last_completed_at || 'never'}`,
          data: { days_overdue: daysOverdue, category: req?.category, is_mandatory: req?.is_mandatory },
        },
        {
          timestamp: now.toISOString(),
          action: autoExecute ? 'Compliance reminder queued automatically' : 'Record completion or reschedule',
          status: autoExecute ? 'completed' as const : 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Compliance item task for ${item.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  // Update upcoming items that are now within threshold (30 days) and set status
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000);
  const upcomingItems = (complianceItems || []).filter((item: any) => {
    if (item.status === 'overdue') return false;
    if (!item.next_due_date) return false;
    const due = new Date(item.next_due_date);
    return due >= now && due <= thirtyDaysOut;
  });

  for (const item of upcomingItems) {
    // Update status to 'upcoming' if still 'pending'
    if (item.status === 'pending') {
      await supabase.from('property_compliance').update({ status: 'upcoming' }).eq('id', item.id);
    }

    const req = (item as any).compliance_requirements;
    const prop = (item as any).properties;
    const itemName = req?.name || 'Compliance item';
    const address = [prop?.address_line_1, prop?.suburb, prop?.state].filter(Boolean).join(', ');
    const daysUntilDue = Math.floor((new Date(item.next_due_date).getTime() - now.getTime()) / 86400000);

    // Only create tasks for items due within 14 days (avoid noise)
    if (daysUntilDue > 14) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, item.id, 'compliance_upcoming');
    if (alreadyExists) continue;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Due in ${daysUntilDue} days: ${itemName} — ${address}`,
      description: `${itemName} at ${address} is due in ${daysUntilDue} days (${new Date(item.next_due_date).toLocaleDateString('en-AU')}).${req?.is_mandatory ? ' This is a mandatory compliance requirement.' : ''}`,
      category: 'compliance',
      status: 'pending_input',
      priority: daysUntilDue <= 7 ? 'high' : 'normal',
      recommendation: `Schedule or complete this compliance item before the due date to maintain compliance.`,
      relatedEntityType: 'property_compliance',
      relatedEntityId: item.id,
      deepLink: `/(app)/compliance`,
      triggerType: 'compliance_item_upcoming',
      triggerSource: `property_compliance:${item.id}`,
      actionTaken: `Created upcoming compliance reminder (${daysUntilDue} days until due)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: now.toISOString(),
          action: `${itemName} due in ${daysUntilDue} days at ${address}`,
          status: 'completed' as const,
          data: { days_until_due: daysUntilDue, category: req?.category },
        },
        {
          timestamp: now.toISOString(),
          action: 'Schedule or complete before due date',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Upcoming compliance task for ${item.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 12C: Regulatory Enforcement — Rent Increase Frequency Violations
// Proactively checks that no pending/draft rent increases violate state frequency limits
// ---------------------------------------------------------------------------

async function scanRentIncreaseCompliance(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<ScannerResult> {
  const now = new Date();
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Get all active tenancies for the user's properties
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, property_id, rent_amount, start_date, properties(state, address_line_1, suburb)')
    .in('property_id', propertyIds)
    .eq('status', 'active');

  if (!tenancies || tenancies.length === 0) return { tasksCreated, errors };

  for (const tenancy of tenancies) {
    const state = ((tenancy as any).properties?.state || '').toUpperCase();
    if (!state) continue;

    // Get the frequency rule for this state
    const { data: freqRules } = await supabase
      .from('tenancy_law_rules')
      .select('max_frequency_months, rule_text, legislation_ref')
      .eq('state', state)
      .eq('category', 'rent_increase')
      .eq('rule_key', 'max_frequency')
      .eq('is_active', true)
      .limit(1);

    if (!freqRules?.[0]?.max_frequency_months) continue;
    const maxFreq = freqRules[0].max_frequency_months;

    // Get the last effective rent increase
    const { data: lastIncrease } = await supabase
      .from('rent_increases')
      .select('effective_date')
      .eq('tenancy_id', tenancy.id)
      .neq('status', 'cancelled')
      .order('effective_date', { ascending: false })
      .limit(1);

    const lastIncreaseDate = lastIncrease?.[0]?.effective_date
      ? new Date(lastIncrease[0].effective_date)
      : new Date((tenancy as any).start_date);

    const nextEarliestDate = new Date(lastIncreaseDate.getTime() + maxFreq * 30 * 24 * 60 * 60 * 1000);
    const daysUntilEligible = Math.floor((nextEarliestDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check for draft/pending rent increases that violate the frequency
    const { data: pendingIncreases } = await supabase
      .from('rent_increases')
      .select('id, effective_date, new_amount, status')
      .eq('tenancy_id', tenancy.id)
      .in('status', ['draft', 'pending'])
      .limit(5);

    for (const ri of pendingIncreases || []) {
      const effectiveDate = new Date(ri.effective_date);
      if (effectiveDate < nextEarliestDate) {
        const address = (tenancy as any).properties?.address_line_1 || '';
        const { error } = await createTaskAndLog(supabase, {
          userId,
          title: `Rent increase violates ${state} frequency limit`,
          description: `Draft rent increase (effective ${new Date(ri.effective_date).toLocaleDateString('en-AU')}) for ${address} violates ${state} law which only allows increases every ${maxFreq} months. Earliest eligible date is ${nextEarliestDate.toLocaleDateString('en-AU')}. ${freqRules[0].legislation_ref || ''}. The effective date must be changed or the increase cancelled.`,
          category: 'compliance',
          status: 'pending_input',
          priority: 'urgent',
          recommendation: `Change the effective date to ${nextEarliestDate.toLocaleDateString('en-AU')} or later, or cancel this rent increase.`,
          relatedEntityType: 'rent_increase',
          relatedEntityId: ri.id,
          deepLink: `/(app)/(tabs)/chat`,
          triggerType: 'regulatory_violation',
          triggerSource: `rent_increase:${ri.id}`,
          actionTaken: `Flagged regulatory violation: rent increase frequency in ${state}`,
          wasAutoExecuted: false,
          timelineEntries: [
            { timestamp: now.toISOString(), action: `Detected rent increase frequency violation (${state} law: max every ${maxFreq} months)`, status: 'completed' as const },
            { timestamp: now.toISOString(), action: `Owner must change effective date to ${nextEarliestDate.toLocaleDateString('en-AU')} or later`, status: 'current' as const },
          ],
        });
        if (error) errors.push(`Rent increase compliance ${ri.id}: ${error}`);
        else tasksCreated++;
      }
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 12C-Auto: Rent Increase Auto-Application
// When a rent increase has been sent/acknowledged and the effective date
// has arrived, auto-apply it: update tenancy rent_amount, mark increase
// as 'applied', and update future rent_schedules.
// ---------------------------------------------------------------------------

async function scanRentIncreaseAutoApply(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<ScannerResult> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find rent increases that are notice_sent or acknowledged with effective_date <= today
  const { data: dueIncreases, error: queryErr } = await supabase
    .from('rent_increases')
    .select(`
      id, tenancy_id, current_amount, new_amount, effective_date, status,
      tenancies!inner(
        id, property_id, rent_amount,
        properties!inner(id, owner_id, address_line_1, suburb, state)
      )
    `)
    .in('status', ['notice_sent', 'acknowledged'])
    .lte('effective_date', todayStr)
    .eq('tenancies.properties.owner_id', userId);

  if (queryErr) {
    errors.push(`Rent increase auto-apply query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const ri of dueIncreases || []) {
    const tenancy = (ri as any).tenancies;
    const property = tenancy?.properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');

    // Skip if disputed
    if (ri.status === 'disputed') continue;

    try {
      // 1. Update tenancy rent_amount
      const { error: tenancyErr } = await supabase
        .from('tenancies')
        .update({ rent_amount: ri.new_amount })
        .eq('id', ri.tenancy_id);

      if (tenancyErr) throw tenancyErr;

      // 2. Mark rent increase as applied
      const { error: riErr } = await supabase
        .from('rent_increases')
        .update({ status: 'applied' })
        .eq('id', ri.id);

      if (riErr) throw riErr;

      // 3. Update future unpaid rent_schedules with the new amount
      const { error: schedErr } = await supabase
        .from('rent_schedules')
        .update({ amount: ri.new_amount })
        .eq('tenancy_id', ri.tenancy_id)
        .eq('is_paid', false)
        .gte('due_date', todayStr);

      if (schedErr) {
        console.error(`Failed to update rent schedules for tenancy ${ri.tenancy_id}:`, schedErr);
      }

      // 4. Log the proactive action
      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: 'rent_increase_applied',
        trigger_source: `rent_increase:${ri.id}`,
        action_taken: `Auto-applied rent increase at ${address}: $${Number(ri.current_amount).toFixed(2)} → $${Number(ri.new_amount).toFixed(2)} (effective ${ri.effective_date})`,
        tool_name: 'apply_rent_increase',
        tool_params: { rent_increase_id: ri.id, tenancy_id: ri.tenancy_id },
        result: { status: 'applied', new_amount: ri.new_amount },
        was_auto_executed: true,
      }).then(() => {});

      // 5. Create a task notifying the owner
      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Rent increase applied - ${address}`,
        description: `The scheduled rent increase from $${Number(ri.current_amount).toFixed(2)} to $${Number(ri.new_amount).toFixed(2)} has been automatically applied at ${address} as of ${new Date(ri.effective_date).toLocaleDateString('en-AU')}.`,
        category: 'rent_collection',
        status: 'completed',
        priority: 'normal',
        recommendation: 'No action needed. The rent has been updated and future schedules adjusted automatically.',
        relatedEntityType: 'rent_increase',
        relatedEntityId: ri.id,
        deepLink: `/(app)/(tabs)/rent`,
        triggerType: 'rent_increase_applied',
        triggerSource: `rent_increase:${ri.id}`,
        actionTaken: `Auto-applied rent increase: $${Number(ri.current_amount).toFixed(2)} → $${Number(ri.new_amount).toFixed(2)}`,
        wasAutoExecuted: true,
        timelineEntries: [
          { timestamp: now.toISOString(), action: `Rent increase effective date reached (${ri.effective_date})`, status: 'completed' as const },
          { timestamp: now.toISOString(), action: `Updated tenancy rent from $${Number(ri.current_amount).toFixed(2)} to $${Number(ri.new_amount).toFixed(2)}`, status: 'completed' as const },
          { timestamp: now.toISOString(), action: 'Updated future rent schedules with new amount', status: 'completed' as const },
        ],
      });

      if (error) {
        errors.push(`Rent increase auto-apply task ${ri.id}: ${error}`);
      } else {
        tasksCreated++;
      }

      console.log(`Auto-applied rent increase ${ri.id} for ${address}: $${ri.current_amount} → $${ri.new_amount}`);
    } catch (err: any) {
      errors.push(`Rent increase auto-apply ${ri.id}: ${err.message}`);
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 12D: Regulatory Enforcement — Entry Notice Compliance
// Checks upcoming inspections have sufficient notice per state law
// ---------------------------------------------------------------------------

async function scanEntryNoticeCompliance(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<ScannerResult> {
  const now = new Date();
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Get upcoming scheduled inspections
  const { data: inspections } = await supabase
    .from('inspections')
    .select('id, property_id, inspection_type, scheduled_date, properties(state, address_line_1, suburb)')
    .in('property_id', propertyIds)
    .eq('status', 'scheduled')
    .gte('scheduled_date', now.toISOString());

  if (!inspections || inspections.length === 0) return { tasksCreated, errors };

  for (const insp of inspections) {
    const state = ((insp as any).properties?.state || '').toUpperCase();
    if (!state) continue;

    const inspType = (insp.inspection_type || 'routine').toLowerCase();
    const ruleKey = inspType === 'maintenance' || inspType === 'repair'
      ? 'repairs_maintenance'
      : 'routine_inspection';

    const { data: noticeRules } = await supabase
      .from('tenancy_law_rules')
      .select('notice_days, notice_business_days, rule_text, legislation_ref')
      .eq('state', state)
      .eq('category', 'entry_notice')
      .eq('rule_key', ruleKey)
      .eq('is_active', true)
      .limit(1);

    if (!noticeRules?.[0]) continue;

    const requiredDays = noticeRules[0].notice_business_days || noticeRules[0].notice_days || 0;
    const scheduledDate = new Date(insp.scheduled_date);
    const daysUntil = Math.floor((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isBusinessDays = !!noticeRules[0].notice_business_days;

    // If insufficient notice, create a warning task
    if (daysUntil < requiredDays && daysUntil >= 0) {
      const address = (insp as any).properties?.address_line_1 || '';
      const { error } = await createTaskAndLog(supabase, {
          userId,
        title: `Inspection notice insufficient (${state} law)`,
        description: `Inspection at ${address} scheduled for ${scheduledDate.toLocaleDateString('en-AU')} has only ${daysUntil} days notice. ${state} requires ${requiredDays} ${isBusinessDays ? 'business ' : ''}days notice for ${inspType} inspections. ${noticeRules[0].legislation_ref || ''}. Consider rescheduling to ensure compliance.`,
        category: 'compliance',
        status: 'pending_input',
        priority: 'high',
        recommendation: `Reschedule to at least ${new Date(now.getTime() + requiredDays * 24 * 60 * 60 * 1000 * (isBusinessDays ? 1.4 : 1)).toLocaleDateString('en-AU')} or ensure written notice was already provided.`,
        relatedEntityType: 'inspection',
        relatedEntityId: insp.id,
        deepLink: `/(app)/inspections/${insp.id}`,
        triggerType: 'regulatory_warning',
        triggerSource: `inspection:${insp.id}`,
        actionTaken: `Flagged entry notice compliance warning in ${state}`,
        wasAutoExecuted: false,
        timelineEntries: [
          { timestamp: now.toISOString(), action: `Inspection has ${daysUntil} days notice (${state} requires ${requiredDays} ${isBusinessDays ? 'business ' : ''}days)`, status: 'completed' as const },
          { timestamp: now.toISOString(), action: 'Verify written notice was sent or reschedule', status: 'current' as const },
        ],
      });
      if (error) errors.push(`Entry notice compliance ${insp.id}: ${error}`);
      else tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 12E: Regulatory Enforcement — Bond Lodgement Deadline
// Ensures bonds are lodged within state-mandated timeframes
// ---------------------------------------------------------------------------

async function scanBondLodgementDeadlines(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<ScannerResult> {
  const now = new Date();
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Get pending bond lodgements
  const { data: bonds } = await supabase
    .from('bond_lodgements')
    .select('id, tenancy_id, state, amount, status, created_at, tenancies(property_id, properties(address_line_1, suburb))')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (!bonds || bonds.length === 0) return { tasksCreated, errors };

  // Filter to only this user's properties
  const userBonds = bonds.filter((b: any) => {
    const propId = b.tenancies?.properties?.address_line_1 ? b.tenancy_id : null;
    return propId !== null; // All pending bonds for the user's tenancies
  });

  for (const bond of userBonds) {
    const state = (bond.state || '').toUpperCase();
    if (!state) continue;

    const { data: deadlineRules } = await supabase
      .from('tenancy_law_rules')
      .select('notice_days, notice_business_days, rule_text, legislation_ref, penalty_info')
      .eq('state', state)
      .eq('category', 'bond')
      .eq('rule_key', 'lodgement_deadline')
      .eq('is_active', true)
      .limit(1);

    const rule = deadlineRules?.[0];
    if (!rule) continue;
    // Bond lodgement deadlines use notice_business_days in most states, fall back to notice_days
    const deadlineDays = rule.notice_business_days || rule.notice_days;
    if (!deadlineDays) continue;
    const isBusinessDays = !!rule.notice_business_days;
    const createdAt = new Date(bond.created_at);
    // For business days, multiply by ~1.4 to approximate calendar days
    const calendarDays = isBusinessDays ? Math.ceil(deadlineDays * 1.4) : deadlineDays;
    const deadline = new Date(createdAt.getTime() + calendarDays * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const address = (bond as any).tenancies?.properties?.address_line_1 || '';

    // Warn if deadline is approaching (7 days or less) or overdue
    if (daysRemaining <= 7) {
      const isOverdue = daysRemaining < 0;
      const { error } = await createTaskAndLog(supabase, {
          userId,
        title: isOverdue ? `Bond lodgement OVERDUE (${state} law)` : `Bond lodgement deadline approaching`,
        description: isOverdue
          ? `Bond of $${bond.amount} for ${address} was due to be lodged ${Math.abs(daysRemaining)} days ago. ${state} requires lodgement within ${deadlineDays} ${isBusinessDays ? 'business' : ''} days. ${rule.penalty_info || ''} ${rule.legislation_ref || ''}. Lodge the bond immediately.`
          : `Bond of $${bond.amount} for ${address} must be lodged within ${daysRemaining} days (${deadline.toLocaleDateString('en-AU')}). ${state} requires lodgement within ${deadlineDays} ${isBusinessDays ? 'business' : ''} days. ${rule.legislation_ref || ''}.`,
        category: 'compliance',
        status: 'pending_input',
        priority: isOverdue ? 'urgent' : 'high',
        recommendation: `Lodge the bond with the ${state} rental authority immediately.`,
        relatedEntityType: 'bond_lodgement',
        relatedEntityId: bond.id,
        deepLink: `/(app)/(tabs)/chat`,
        triggerType: isOverdue ? 'regulatory_violation' : 'regulatory_warning',
        triggerSource: `bond:${bond.id}`,
        actionTaken: `Flagged bond lodgement ${isOverdue ? 'overdue' : 'approaching deadline'} in ${state}`,
        wasAutoExecuted: false,
        timelineEntries: [
          { timestamp: now.toISOString(), action: `Bond lodgement ${isOverdue ? `overdue by ${Math.abs(daysRemaining)} days` : `due in ${daysRemaining} days`}`, status: 'completed' as const },
          { timestamp: now.toISOString(), action: `Lodge bond with ${state} authority`, status: 'current' as const },
        ],
      });
      if (error) errors.push(`Bond deadline ${bond.id}: ${error}`);
      else tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 12F: Regulatory Enforcement — Lease End Notice Requirements
// Proactively alerts when lease-end notices must be sent per state law
// ---------------------------------------------------------------------------

async function scanLeaseEndNoticeRequirements(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<ScannerResult> {
  const now = new Date();
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Get tenancies approaching lease end (within 120 days)
  const lookAhead = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, property_id, end_date, lease_type, properties(state, address_line_1, suburb)')
    .in('property_id', propertyIds)
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lte('end_date', lookAhead.toISOString())
    .gte('end_date', now.toISOString());

  if (!tenancies || tenancies.length === 0) return { tasksCreated, errors };

  for (const tenancy of tenancies) {
    const state = ((tenancy as any).properties?.state || '').toUpperCase();
    if (!state) continue;

    // Get end-of-lease notice requirement
    const { data: noticeRules } = await supabase
      .from('tenancy_law_rules')
      .select('notice_days, rule_text, legislation_ref, agent_action')
      .eq('state', state)
      .eq('category', 'termination')
      .eq('rule_key', 'end_of_fixed_term')
      .eq('is_active', true)
      .limit(1);

    if (!noticeRules?.[0]?.notice_days) continue;

    const requiredDays = noticeRules[0].notice_days;
    const endDate = new Date(tenancy.end_date!);
    const daysUntilEnd = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const noticeDeadline = new Date(endDate.getTime() - requiredDays * 24 * 60 * 60 * 1000);
    const daysUntilNoticeDeadline = Math.floor((noticeDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const address = (tenancy as any).properties?.address_line_1 || '';

    // Alert if notice deadline is within 30 days
    if (daysUntilNoticeDeadline <= 30 && daysUntilNoticeDeadline >= -7) {
      const isOverdue = daysUntilNoticeDeadline < 0;
      const { error } = await createTaskAndLog(supabase, {
          userId,
        title: isOverdue ? `Lease-end notice deadline PASSED` : `Lease-end notice deadline approaching`,
        description: isOverdue
          ? `Lease at ${address} ends ${endDate.toLocaleDateString('en-AU')} (${daysUntilEnd} days). ${state} requires ${requiredDays} days notice if you want the tenant to vacate. The notice deadline has passed — you must now negotiate or the tenancy will likely roll to periodic. ${noticeRules[0].legislation_ref || ''}`
          : `Lease at ${address} ends ${endDate.toLocaleDateString('en-AU')} (${daysUntilEnd} days). ${state} requires ${requiredDays} days notice if you want the tenant to vacate. Notice must be given by ${noticeDeadline.toLocaleDateString('en-AU')} (${daysUntilNoticeDeadline} days). ${noticeRules[0].legislation_ref || ''}`,
        category: 'compliance',
        status: 'pending_input',
        priority: isOverdue ? 'urgent' : daysUntilNoticeDeadline <= 14 ? 'high' : 'normal',
        recommendation: isOverdue
          ? 'Discuss options with the tenant — renewal, periodic tenancy, or mutual agreement to vacate.'
          : `Decide whether to renew, allow periodic tenancy, or serve notice to vacate by ${noticeDeadline.toLocaleDateString('en-AU')}.`,
        relatedEntityType: 'tenancy',
        relatedEntityId: tenancy.id,
        deepLink: `/(app)/(tabs)/chat`,
        triggerType: isOverdue ? 'regulatory_violation' : 'regulatory_warning',
        triggerSource: `tenancy_end:${tenancy.id}`,
        actionTaken: `Flagged lease-end notice requirement for ${state}`,
        wasAutoExecuted: false,
        timelineEntries: [
          { timestamp: now.toISOString(), action: `Lease ends ${endDate.toLocaleDateString('en-AU')} — ${state} requires ${requiredDays} days notice`, status: 'completed' as const },
          { timestamp: now.toISOString(), action: isOverdue ? 'Notice deadline has passed — negotiate with tenant' : `Serve notice by ${noticeDeadline.toLocaleDateString('en-AU')} or decide to renew`, status: 'current' as const },
        ],
      });
      if (error) errors.push(`Lease end notice ${tenancy.id}: ${error}`);
      else tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 13: Insurance Renewal (landlord insurance nearing expiry via manual_expenses)
// ---------------------------------------------------------------------------

async function scanInsuranceRenewal(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find insurance expenses that are recurring and may be due for renewal
  // Look for expenses with tax_category='insurance' in the last 13 months
  // If the most recent insurance expense is more than 11 months old, flag for renewal
  const thirteenMonthsAgo = new Date();
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

  for (const propertyId of propertyIds) {
    const { data: insuranceExpenses, error: insErr } = await supabase
      .from('manual_expenses')
      .select('id, description, amount, expense_date, is_recurring, recurring_frequency')
      .eq('owner_id', userId)
      .eq('property_id', propertyId)
      .eq('tax_category', 'insurance')
      .order('expense_date', { ascending: false })
      .limit(1);

    if (insErr) {
      errors.push(`Insurance renewal query for ${propertyId}: ${insErr.message}`);
      continue;
    }

    if (!insuranceExpenses || insuranceExpenses.length === 0) {
      // No insurance records at all — check if property is occupied
      const { data: activeTenancy } = await supabase
        .from('tenancies')
        .select('id')
        .eq('property_id', propertyId)
        .eq('status', 'active')
        .limit(1);

      if (!activeTenancy || activeTenancy.length === 0) continue;

      const alreadyExists = await taskExistsForEntity(supabase, userId, propertyId, 'insurance');
      if (alreadyExists) continue;

      const { data: propData } = await supabase
        .from('properties')
        .select('address_line_1, suburb, state')
        .eq('id', propertyId)
        .single();

      const address = propData ? [propData.address_line_1, propData.suburb, propData.state].filter(Boolean).join(', ') : propertyId;

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `No insurance record - ${address}`,
        description: `The occupied property at ${address} has no landlord insurance expense recorded. This is a significant risk.`,
        category: 'insurance',
        status: 'pending_input',
        priority: 'high',
        recommendation: `Landlord insurance is essential for protecting your investment. Consider adding an insurance expense record or confirming your policy is current. Without insurance, you're exposed to significant financial risk from tenant damage, liability claims, and natural events.`,
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        deepLink: `/(app)/properties/${propertyId}`,
        triggerType: 'insurance_no_record',
        triggerSource: `property:${propertyId}`,
        actionTaken: 'Created task for missing insurance record',
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `No landlord insurance recorded for ${address}`,
            status: 'completed' as const,
            reasoning: 'Occupied properties should have active landlord insurance.',
          },
          {
            timestamp: new Date().toISOString(),
            action: 'Verify insurance status and record policy',
            status: 'current' as const,
          },
        ],
      });

      if (error) {
        errors.push(`Insurance record task for ${propertyId}: ${error}`);
      } else {
        tasksCreated++;
      }
      continue;
    }

    // Check if the most recent insurance expense is approaching renewal (11+ months old)
    const lastInsurance = insuranceExpenses[0];
    const lastDate = new Date(lastInsurance.expense_date);
    const monthsSinceLast = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

    if (monthsSinceLast < 11) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, propertyId, 'insurance renewal');
    if (alreadyExists) continue;

    const { data: propData } = await supabase
      .from('properties')
      .select('address_line_1, suburb, state')
      .eq('id', propertyId)
      .single();

    const address = propData ? [propData.address_line_1, propData.suburb, propData.state].filter(Boolean).join(', ') : propertyId;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Insurance renewal due - ${address}`,
      description: `Landlord insurance for ${address} was last recorded ${monthsSinceLast} months ago ($${lastInsurance.amount}). It may be due for renewal.`,
      category: 'insurance',
      status: 'pending_input',
      priority: monthsSinceLast >= 12 ? 'high' : 'normal',
      recommendation: `Your last insurance expense of $${lastInsurance.amount} was recorded ${monthsSinceLast} months ago. ${monthsSinceLast >= 12 ? 'This is likely past its renewal date — check if your policy has lapsed.' : 'Renewal is coming up soon. Review your policy and consider shopping for better rates.'}`,
      relatedEntityType: 'property',
      relatedEntityId: propertyId,
      deepLink: `/(app)/properties/${propertyId}`,
      triggerType: 'insurance_renewal_due',
      triggerSource: `property:${propertyId}`,
      actionTaken: `Created insurance renewal task (${monthsSinceLast} months since last expense)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Insurance last recorded ${monthsSinceLast} months ago ($${lastInsurance.amount})`,
          status: 'completed' as const,
          data: { months_since_last: monthsSinceLast, last_amount: lastInsurance.amount },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Review and renew insurance policy',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Insurance renewal task for ${propertyId}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 14: Market Rent Analysis (rent significantly below comparable properties)
// ---------------------------------------------------------------------------

async function scanMarketRentAnalysis(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Get owner's properties with active tenancies
  const { data: ownerProperties, error: propErr } = await supabase
    .from('properties')
    .select('id, address_line_1, suburb, state, postcode, rent_amount, rent_frequency, bedrooms, property_type')
    .in('id', propertyIds)
    .is('deleted_at', null)
    .eq('status', 'occupied');

  if (propErr) {
    errors.push(`Market rent analysis property query: ${propErr.message}`);
    return { tasksCreated, errors };
  }

  for (const property of ownerProperties || []) {
    // Normalise rent to weekly for comparison
    let weeklyRent = property.rent_amount || 0;
    if (property.rent_frequency === 'fortnightly') weeklyRent = weeklyRent / 2;
    else if (property.rent_frequency === 'monthly') weeklyRent = (weeklyRent * 12) / 52;

    if (weeklyRent === 0) continue;

    // Find comparable properties in the same suburb with same bedrooms
    const { data: comparables } = await supabase
      .from('properties')
      .select('rent_amount, rent_frequency')
      .eq('suburb', property.suburb)
      .eq('bedrooms', property.bedrooms)
      .neq('id', property.id)
      .is('deleted_at', null)
      .limit(20);

    if (!comparables || comparables.length < 3) continue;

    // Calculate median weekly rent of comparables
    const weeklyRents = comparables.map((c: any) => {
      let r = c.rent_amount || 0;
      if (c.rent_frequency === 'fortnightly') r = r / 2;
      else if (c.rent_frequency === 'monthly') r = (r * 12) / 52;
      return r;
    }).filter((r: number) => r > 0).sort((a: number, b: number) => a - b);

    if (weeklyRents.length < 3) continue;

    const medianRent = weeklyRents[Math.floor(weeklyRents.length / 2)];
    const percentBelow = ((medianRent - weeklyRent) / medianRent) * 100;

    // Only flag if rent is 15%+ below median
    if (percentBelow < 15) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, property.id, 'market rent');
    if (alreadyExists) continue;

    const address = [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ');
    const potentialIncrease = Math.round(medianRent - weeklyRent);

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Rent below market - ${address}`,
      description: `The rent at ${address} ($${weeklyRent.toFixed(0)}/wk) is ${percentBelow.toFixed(0)}% below the median for comparable ${property.bedrooms}-bedroom properties in ${property.suburb} ($${medianRent.toFixed(0)}/wk).`,
      category: 'financial',
      status: 'pending_input',
      priority: percentBelow > 25 ? 'high' : 'normal',
      recommendation: `Based on ${weeklyRents.length} comparable properties in ${property.suburb}, your rent is $${potentialIncrease}/wk below the median. ${percentBelow > 25 ? 'This is a significant gap — consider a rent increase at the next opportunity.' : 'Consider reviewing the rent at the next lease renewal.'} Note: In most Australian states, rent increases require 60 days written notice and can only occur once every 12 months.`,
      relatedEntityType: 'property',
      relatedEntityId: property.id,
      deepLink: `/(app)/properties/${property.id}`,
      triggerType: 'market_rent_below_median',
      triggerSource: `property:${property.id}`,
      actionTaken: `Created market rent analysis task (${percentBelow.toFixed(0)}% below median)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Rent $${weeklyRent.toFixed(0)}/wk is ${percentBelow.toFixed(0)}% below median $${medianRent.toFixed(0)}/wk`,
          status: 'completed' as const,
          data: {
            current_rent: weeklyRent,
            median_rent: medianRent,
            percent_below: Math.round(percentBelow),
            comparables_count: weeklyRents.length,
          },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Review rent and consider increase at next opportunity',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Market rent task for ${property.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 15: Bond Deadlines (statutory lodgement windows)
// ---------------------------------------------------------------------------

async function scanBondDeadlines(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // State-specific bond lodgement deadlines (business days from receipt)
  const STATE_LODGEMENT_DAYS: Record<string, number> = {
    NSW: 10, VIC: 10, QLD: 10, SA: 14, WA: 14, TAS: 10, NT: 14, ACT: 10,
  };

  // Find pending bonds (not yet lodged)
  const { data: pendingBonds, error: bondErr } = await supabase
    .from('bond_lodgements')
    .select(`
      id, tenancy_id, state, amount, status, created_at,
      tenancies!inner(property_id, properties!inner(address_line_1, suburb, state, owner_id))
    `)
    .eq('status', 'pending')
    .in('tenancies.property_id', propertyIds);

  if (bondErr) {
    errors.push(`Bond deadlines query: ${bondErr.message}`);
  } else {
    for (const bond of pendingBonds || []) {
      const alreadyExists = await taskExistsForEntity(supabase, userId, bond.id, 'bond lodgement');
      if (alreadyExists) continue;

      const property = (bond as any).tenancies?.properties;
      const address = property ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ') : 'Unknown';
      const maxDays = STATE_LODGEMENT_DAYS[bond.state] || 10;
      const daysSinceCreated = Math.floor((new Date().getTime() - new Date(bond.created_at).getTime()) / 86400000);
      const daysRemaining = maxDays - daysSinceCreated;

      // Flag if within 3 days of deadline or past it
      if (daysRemaining > 3) continue;

      const isOverdue = daysRemaining < 0;
      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: isOverdue
          ? `OVERDUE bond lodgement - ${address}`
          : `Bond lodgement deadline approaching - ${address}`,
        description: `Bond of $${bond.amount} for ${address} ${isOverdue ? `is ${Math.abs(daysRemaining)} days past the ${bond.state} lodgement deadline of ${maxDays} days` : `must be lodged within ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} (${bond.state} requires lodgement within ${maxDays} days)`}.`,
        category: 'compliance',
        status: 'pending_input',
        priority: isOverdue ? 'urgent' : 'high',
        recommendation: isOverdue
          ? `This bond is overdue for lodgement. In ${bond.state}, bonds must be lodged within ${maxDays} days. Failure to lodge on time can result in penalties. Lodge immediately with the relevant bond authority.`
          : `The bond lodgement deadline is in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Lodge the bond with the ${bond.state} bond authority to avoid penalties.`,
        relatedEntityType: 'bond_lodgement',
        relatedEntityId: bond.id,
        triggerType: isOverdue ? 'bond_lodgement_overdue' : 'bond_lodgement_deadline',
        triggerSource: `bond_lodgement:${bond.id}`,
        actionTaken: `Created bond lodgement ${isOverdue ? 'overdue' : 'deadline'} task`,
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `Bond $${bond.amount} pending lodgement for ${daysSinceCreated} days (${bond.state} limit: ${maxDays} days)`,
            status: 'completed' as const,
            data: { amount: bond.amount, state: bond.state, days_since_created: daysSinceCreated, max_days: maxDays },
          },
          {
            timestamp: new Date().toISOString(),
            action: isOverdue ? 'Lodge bond immediately - overdue' : `Lodge bond within ${daysRemaining} days`,
            status: 'current' as const,
          },
        ],
      });

      if (error) {
        errors.push(`Bond deadline task for ${bond.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  // Also check for active tenancies with no bond lodgement record at all
  const { data: tenanciesWithoutBond } = await supabase
    .from('tenancies')
    .select('id, property_id, bond_amount, bond_status, lease_start_date, properties!inner(address_line_1, suburb, state, owner_id)')
    .in('property_id', propertyIds)
    .eq('status', 'active')
    .eq('bond_status', 'pending')
    .gt('bond_amount', 0);

  for (const tenancy of tenanciesWithoutBond || []) {
    const daysSinceStart = Math.floor((new Date().getTime() - new Date(tenancy.lease_start_date).getTime()) / 86400000);
    if (daysSinceStart < 5) continue; // Give a few days grace

    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'bond pending');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = property ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ') : 'Unknown';

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Bond not lodged - ${address}`,
      description: `Active tenancy at ${address} started ${daysSinceStart} days ago with $${tenancy.bond_amount} bond still showing as pending.`,
      category: 'compliance',
      status: 'pending_input',
      priority: daysSinceStart > 14 ? 'urgent' : 'high',
      recommendation: `This bond should have been lodged by now. Verify the bond was received and lodge it with the state bond authority immediately.`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      triggerType: 'bond_not_lodged',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: `Created bond not lodged task (${daysSinceStart} days since lease start)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Bond $${tenancy.bond_amount} still pending ${daysSinceStart} days after lease start`,
          status: 'completed' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Lodge bond with state authority',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Bond not lodged task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 16: Rent Review Due (annual rent review reminders)
// ---------------------------------------------------------------------------

async function scanRentReviewDue(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find active tenancies older than 10 months with no rent increase in the last 11 months
  const elevenMonthsAgo = new Date();
  elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

  const { data: tenancies, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, property_id, rent_amount, rent_frequency, lease_start_date, lease_end_date, is_periodic,
      properties!inner(address_line_1, suburb, state, owner_id)
    `)
    .in('property_id', propertyIds)
    .eq('status', 'active');

  if (tenErr) {
    errors.push(`Rent review query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  for (const tenancy of tenancies || []) {
    const monthsSinceStart = Math.floor((new Date().getTime() - new Date(tenancy.lease_start_date).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (monthsSinceStart < 10) continue; // Only flag if tenancy is 10+ months old

    // Check for recent rent increases
    const { data: recentIncreases } = await supabase
      .from('rent_increases')
      .select('id, effective_date')
      .eq('tenancy_id', tenancy.id)
      .gte('effective_date', elevenMonthsAgo.toISOString().split('T')[0])
      .not('status', 'eq', 'cancelled')
      .limit(1);

    if (recentIncreases && recentIncreases.length > 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'rent review');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = property ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ') : 'Unknown';

    // Determine notice period by state
    const stateNoticeDays: Record<string, number> = {
      NSW: 60, VIC: 60, QLD: 60, SA: 60, WA: 60, TAS: 60, NT: 30, ACT: 60,
    };
    const noticeDays = stateNoticeDays[property?.state] || 60;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Rent review due - ${address}`,
      description: `The tenancy at ${address} has been active for ${monthsSinceStart} months with no rent review in the last 11 months. Current rent: $${tenancy.rent_amount}/${tenancy.rent_frequency}.`,
      category: 'financial',
      status: 'pending_input',
      priority: 'normal',
      recommendation: `Consider a rent review for this property. In ${property?.state || 'most states'}, you must give ${noticeDays} days written notice before a rent increase takes effect, and increases can only occur once every 12 months. Use the market rent analysis to determine an appropriate new rate.`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      deepLink: `/(app)/properties/${tenancy.property_id}`,
      triggerType: 'rent_review_due',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: `Created rent review task (${monthsSinceStart} months, no recent increase)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Tenancy active for ${monthsSinceStart} months, no rent increase in 11+ months`,
          status: 'completed' as const,
          data: { months_active: monthsSinceStart, current_rent: tenancy.rent_amount, frequency: tenancy.rent_frequency },
        },
        {
          timestamp: new Date().toISOString(),
          action: `Review rent and issue ${noticeDays}-day notice if increasing`,
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Rent review task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 17: Application Screening Status (background checks pending)
// ---------------------------------------------------------------------------

async function scanApplicationScreeningStatus(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  // Find applications in 'submitted' or 'under_review' status with pending background checks
  const { data: applications, error: appErr } = await supabase
    .from('applications')
    .select(`
      id, tenant_id, status, created_at,
      listings!inner(id, property_id, properties!inner(address_line_1, suburb, state, owner_id)),
      profiles:tenant_id(full_name, email)
    `)
    .in('status', ['submitted', 'under_review'])
    .eq('listings.properties.owner_id', userId);

  if (appErr) {
    errors.push(`Application screening query: ${appErr.message}`);
    return { tasksCreated, errors };
  }

  for (const app of applications || []) {
    // Check background check status
    const { data: checks } = await supabase
      .from('background_checks')
      .select('id, check_type, status, requested_at')
      .eq('application_id', app.id);

    const pendingChecks = (checks || []).filter((c: any) => c.status === 'pending');
    const daysSinceApp = Math.floor((new Date().getTime() - new Date(app.created_at).getTime()) / 86400000);

    // Flag if application is 3+ days old with pending checks, or 5+ days with no checks at all
    const hasPendingChecks = pendingChecks.length > 0;
    const hasNoChecks = !checks || checks.length === 0;

    if (hasPendingChecks && daysSinceApp < 3) continue;
    if (hasNoChecks && daysSinceApp < 5) continue;
    if (!hasPendingChecks && !hasNoChecks) continue; // All checks completed

    const alreadyExists = await taskExistsForEntity(supabase, userId, app.id, 'screening');
    if (alreadyExists) continue;

    const property = (app as any).listings?.properties;
    const tenant = (app as any).profiles;
    const address = property ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ') : 'Unknown';
    const applicantName = tenant?.full_name || 'Applicant';

    const title = hasNoChecks
      ? `No background checks initiated - ${applicantName}`
      : `Background checks pending - ${applicantName}`;

    const description = hasNoChecks
      ? `Application from ${applicantName} for ${address} has been waiting ${daysSinceApp} days with no background checks initiated.`
      : `Application from ${applicantName} for ${address} has ${pendingChecks.length} pending background check${pendingChecks.length !== 1 ? 's' : ''} (${pendingChecks.map((c: any) => c.check_type).join(', ')}).`;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title,
      description,
      category: 'tenant_finding',
      status: 'pending_input',
      priority: daysSinceApp > 7 ? 'high' : 'normal',
      recommendation: hasNoChecks
        ? `This application has been waiting ${daysSinceApp} days without screening. Initiate background checks (credit, identity, tenancy) or make a decision on this application.`
        : `Background checks have been pending for ${daysSinceApp} days. Check with the provider for status or consider proceeding with available information.`,
      relatedEntityType: 'application',
      relatedEntityId: app.id,
      triggerType: hasNoChecks ? 'screening_not_started' : 'screening_pending',
      triggerSource: `application:${app.id}`,
      actionTaken: `Created screening status task (${daysSinceApp} days, ${hasNoChecks ? 'no checks' : pendingChecks.length + ' pending'})`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: hasNoChecks
            ? `Application from ${applicantName} waiting ${daysSinceApp} days, no checks initiated`
            : `${pendingChecks.length} background check${pendingChecks.length !== 1 ? 's' : ''} pending for ${daysSinceApp} days`,
          status: 'completed' as const,
          data: { days_waiting: daysSinceApp, pending_checks: pendingChecks.length, total_checks: (checks || []).length },
        },
        {
          timestamp: new Date().toISOString(),
          action: hasNoChecks ? 'Initiate background checks' : 'Follow up on pending checks',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Screening status task for ${app.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  // Also check for references not yet contacted
  const { data: uncontactedRefs, error: refErr } = await supabase
    .from('application_references')
    .select(`
      id, application_id, reference_type, name, phone, email, contacted_at,
      applications!inner(id, status, listings!inner(property_id, properties!inner(owner_id)))
    `)
    .is('contacted_at', null)
    .eq('applications.listings.properties.owner_id', userId)
    .in('applications.status', ['submitted', 'under_review']);

  if (refErr) {
    errors.push(`Uncontacted references query: ${refErr.message}`);
  } else {
    // Group by application
    const refsByApp: Record<string, any[]> = {};
    for (const ref of uncontactedRefs || []) {
      if (!refsByApp[ref.application_id]) refsByApp[ref.application_id] = [];
      refsByApp[ref.application_id].push(ref);
    }

    for (const [appId, refs] of Object.entries(refsByApp)) {
      if (refs.length === 0) continue;

      const alreadyExists = await taskExistsForEntity(supabase, userId, appId, 'reference');
      if (alreadyExists) continue;

      const refTypes = refs.map((r: any) => r.reference_type).join(', ');

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `${refs.length} reference${refs.length !== 1 ? 's' : ''} not yet contacted`,
        description: `Application has ${refs.length} reference${refs.length !== 1 ? 's' : ''} (${refTypes}) that have not been contacted yet.`,
        category: 'tenant_finding',
        status: 'pending_input',
        priority: 'normal',
        recommendation: `Contact the references to verify the applicant's rental history and character. This is an important step in the screening process.`,
        relatedEntityType: 'application',
        relatedEntityId: appId,
        triggerType: 'references_not_contacted',
        triggerSource: `application:${appId}`,
        actionTaken: `Created uncontacted references task (${refs.length} references)`,
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `${refs.length} reference${refs.length !== 1 ? 's' : ''} awaiting contact (${refTypes})`,
            status: 'completed' as const,
          },
          {
            timestamp: new Date().toISOString(),
            action: 'Contact references',
            status: 'current' as const,
          },
        ],
      });

      if (error) {
        errors.push(`Reference contact task for ${appId}: ${error}`);
      } else {
        tasksCreated++;
      }
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 18: Exit Inspection Due (tenancy ending, inspection not scheduled)
// ---------------------------------------------------------------------------

async function scanExitInspectionDue(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find tenancies that are ending within 30 days
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const today = new Date().toISOString().split('T')[0];

  const { data: endingTenancies, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, property_id, lease_end_date, actual_end_date, notice_given_date,
      properties!inner(address_line_1, suburb, state, owner_id)
    `)
    .in('property_id', propertyIds)
    .in('status', ['active', 'ending'])
    .lte('lease_end_date', thirtyDaysFromNow.toISOString().split('T')[0])
    .gte('lease_end_date', today);

  if (tenErr) {
    errors.push(`Exit inspection query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  for (const tenancy of endingTenancies || []) {
    // Check if an exit inspection is already scheduled
    const { data: exitInspections } = await supabase
      .from('inspections')
      .select('id, status')
      .eq('property_id', tenancy.property_id)
      .eq('inspection_type', 'exit')
      .not('status', 'eq', 'cancelled')
      .gte('scheduled_date', today);

    if (exitInspections && exitInspections.length > 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'exit inspection');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = property ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ') : 'Unknown';
    const daysUntilEnd = Math.floor((new Date(tenancy.lease_end_date).getTime() - new Date().getTime()) / 86400000);

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Exit inspection needed - ${address}`,
      description: `Tenancy at ${address} ends in ${daysUntilEnd} days (${tenancy.lease_end_date}) but no exit inspection has been scheduled.`,
      category: 'inspections',
      status: 'pending_input',
      priority: daysUntilEnd <= 14 ? 'high' : 'normal',
      recommendation: `Schedule an exit inspection before the tenant vacates. This is critical for comparing the property condition against the entry report and for any bond claims. In most states, you must give the tenant appropriate notice (usually 7 days) before conducting the inspection.`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      deepLink: `/(app)/properties/${tenancy.property_id}`,
      triggerType: 'exit_inspection_needed',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: `Created exit inspection task (${daysUntilEnd} days until lease end)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Tenancy ending ${tenancy.lease_end_date} - no exit inspection scheduled`,
          status: 'completed' as const,
          data: { days_until_end: daysUntilEnd, lease_end_date: tenancy.lease_end_date },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Schedule exit inspection with tenant',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Exit inspection task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 19: Extended Vacancy (properties vacant 30+ days)
// ---------------------------------------------------------------------------

async function scanExtendedVacancy(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find vacant properties
  const { data: vacantProperties, error: propErr } = await supabase
    .from('properties')
    .select('id, address_line_1, suburb, state, rent_amount, rent_frequency, status, updated_at')
    .in('id', propertyIds)
    .eq('status', 'vacant')
    .is('deleted_at', null);

  if (propErr) {
    errors.push(`Extended vacancy query: ${propErr.message}`);
    return { tasksCreated, errors };
  }

  for (const property of vacantProperties || []) {
    // Find when the last tenancy ended
    const { data: lastTenancy } = await supabase
      .from('tenancies')
      .select('id, actual_end_date, lease_end_date')
      .eq('property_id', property.id)
      .in('status', ['ended', 'terminated'])
      .order('actual_end_date', { ascending: false, nullsFirst: false })
      .limit(1);

    let vacantSince: Date;
    if (lastTenancy && lastTenancy.length > 0) {
      vacantSince = new Date(lastTenancy[0].actual_end_date || lastTenancy[0].lease_end_date);
    } else {
      vacantSince = new Date(property.updated_at);
    }

    const daysVacant = Math.floor((new Date().getTime() - vacantSince.getTime()) / 86400000);
    if (daysVacant < 30) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, property.id, 'extended vacancy');
    if (alreadyExists) continue;

    const address = [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ');
    const weeklyRent = property.rent_frequency === 'monthly'
      ? (property.rent_amount * 12) / 52
      : property.rent_frequency === 'fortnightly'
        ? property.rent_amount / 2
        : property.rent_amount;
    const lostRent = Math.round(weeklyRent * (daysVacant / 7));

    // Check if there's an active listing
    const { data: activeListing } = await supabase
      .from('listings')
      .select('id, status, created_at')
      .eq('property_id', property.id)
      .eq('status', 'active')
      .limit(1);

    const hasActiveListing = activeListing && activeListing.length > 0;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Property vacant ${daysVacant} days - ${address}`,
      description: `${address} has been vacant for ${daysVacant} days, representing approximately $${lostRent} in lost rent.${hasActiveListing ? ' An active listing exists but no tenant has been found yet.' : ' No active listing found.'}`,
      category: 'financial',
      status: 'pending_input',
      priority: daysVacant > 60 ? 'high' : 'normal',
      recommendation: hasActiveListing
        ? `The listing has been active but hasn't attracted a tenant. Consider: reducing the rent by 5-10%, updating photos, improving the description, or broadening your advertising reach.`
        : `Create a listing for this property to start attracting tenants. Every week vacant costs approximately $${Math.round(weeklyRent)} in lost rent.`,
      relatedEntityType: 'property',
      relatedEntityId: property.id,
      deepLink: `/(app)/properties/${property.id}`,
      triggerType: 'extended_vacancy',
      triggerSource: `property:${property.id}`,
      actionTaken: `Created extended vacancy task (${daysVacant} days, ~$${lostRent} lost)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Vacant for ${daysVacant} days (~$${lostRent} lost rent)`,
          status: 'completed' as const,
          data: { days_vacant: daysVacant, lost_rent: lostRent, has_listing: hasActiveListing },
        },
        {
          timestamp: new Date().toISOString(),
          action: hasActiveListing ? 'Review listing strategy' : 'Create a listing',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Extended vacancy task for ${property.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 20: Trade Quote Response (overdue quotes on work orders)
// ---------------------------------------------------------------------------

async function scanTradeQuoteResponse(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find work orders in 'sent' status (awaiting quote) for 3+ days
  const threeDaysAgo = new Date(new Date().getTime() - 3 * 86400000).toISOString();

  const { data: pendingQuotes, error: woErr } = await supabase
    .from('work_orders')
    .select(`
      id, title, category, urgency, status, created_at,
      property_id, trade_id,
      properties!inner(address_line_1, suburb, state, owner_id),
      trades(business_name, contact_name, phone)
    `)
    .eq('owner_id', userId)
    .eq('status', 'sent')
    .eq('quote_required', true)
    .lt('created_at', threeDaysAgo);

  if (woErr) {
    errors.push(`Trade quote response query: ${woErr.message}`);
    return { tasksCreated, errors };
  }

  for (const wo of pendingQuotes || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, wo.id, 'quote');
    if (alreadyExists) continue;

    const property = (wo as any).properties;
    const trade = (wo as any).trades;
    const address = property ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ') : 'Unknown';
    const tradeName = trade?.business_name || trade?.contact_name || 'Tradesperson';
    const daysSinceSent = Math.floor((new Date().getTime() - new Date(wo.created_at).getTime()) / 86400000);

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Quote overdue from ${tradeName} - ${wo.title}`,
      description: `Work order "${wo.title}" at ${address} was sent to ${tradeName} ${daysSinceSent} days ago and no quote has been received. Urgency: ${wo.urgency}.`,
      category: 'maintenance',
      status: 'pending_input',
      priority: wo.urgency === 'emergency' ? 'urgent' : wo.urgency === 'urgent' ? 'high' : 'normal',
      recommendation: `Follow up with ${tradeName}${trade?.phone ? ` (${trade.phone})` : ''} about the quote. If unresponsive, consider sending the work order to an alternative tradesperson.`,
      relatedEntityType: 'work_order',
      relatedEntityId: wo.id,
      triggerType: 'quote_overdue',
      triggerSource: `work_order:${wo.id}`,
      actionTaken: `Created overdue quote task (${daysSinceSent} days, ${wo.urgency})`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Work order sent to ${tradeName} ${daysSinceSent} days ago — no quote received`,
          status: 'completed' as const,
          data: { days_waiting: daysSinceSent, urgency: wo.urgency, trade_name: tradeName },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Follow up with tradesperson or reassign',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Trade quote task for ${wo.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 21A: Arrears Escalation — Days-Overdue Threshold Notices (7/14/21/28)
// Sends formal arrears reminders and breach notices at fixed day thresholds.
// Checks arrears_actions to avoid sending duplicate notices per threshold.
// ---------------------------------------------------------------------------

async function scanArrearsEscalation(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const rentAutonomy = getUserAutonomyForCategory(autonomySettings, 'rent_collection');

  // Threshold ladder: each threshold defines what action to take and what
  // action_type to log in arrears_actions for dedup purposes.
  const THRESHOLDS = [
    {
      days: 7,
      label: 'Day 7 — Formal arrears reminder',
      actionType: 'formal_reminder_day7',
      taskTitle: (name: string, addr: string) => `Formal arrears reminder sent — ${name} at ${addr}`,
      taskTitlePending: (name: string, addr: string) => `Formal arrears notice needed — ${name} at ${addr}`,
      emailSubject: (addr: string) => `Formal Payment Reminder — ${addr}`,
      emailTemplate: 'arrears_formal_reminder',
      priority: 'high' as const,
      isBreachNotice: false,
    },
    {
      days: 14,
      label: 'Day 14 — Breach notice',
      actionType: 'breach_notice_day14',
      taskTitle: (name: string, addr: string) => `Breach notice sent — ${name} at ${addr}`,
      taskTitlePending: (name: string, addr: string) => `Breach notice required — ${name} at ${addr}`,
      emailSubject: (addr: string) => `Formal Breach Notice — Overdue Rent — ${addr}`,
      emailTemplate: 'arrears_breach_notice',
      priority: 'urgent' as const,
      isBreachNotice: true,
    },
    {
      days: 21,
      label: 'Day 21 — Final warning',
      actionType: 'final_warning_day21',
      taskTitle: (name: string, addr: string) => `Final warning issued — ${name} at ${addr}`,
      taskTitlePending: (name: string, addr: string) => `Final warning needed — ${name} at ${addr}`,
      emailSubject: (addr: string) => `Final Warning — Unresolved Rent Arrears — ${addr}`,
      emailTemplate: 'arrears_final_warning',
      priority: 'urgent' as const,
      isBreachNotice: true,
    },
    {
      days: 28,
      label: 'Day 28 — Tribunal notice',
      actionType: 'tribunal_notice_day28',
      taskTitle: (name: string, addr: string) => `Tribunal notice sent — ${name} at ${addr}`,
      taskTitlePending: (name: string, addr: string) => `Tribunal application recommended — ${name} at ${addr}`,
      emailSubject: (addr: string) => `Notice of Tribunal Application — ${addr}`,
      emailTemplate: 'arrears_tribunal_notice',
      priority: 'urgent' as const,
      isBreachNotice: true,
    },
  ];

  // Fetch all unresolved arrears for this owner's properties that are >= 7 days overdue
  const { data: arrearsRecords, error: arrErr } = await supabase
    .from('arrears_records')
    .select(`
      id, tenancy_id, tenant_id, total_overdue, days_overdue, first_overdue_date,
      severity, has_payment_plan,
      tenancies!inner(
        id, property_id,
        properties!inner(id, address_line_1, suburb, state, postcode, owner_id)
      ),
      profiles:tenant_id(full_name, email)
    `)
    .eq('is_resolved', false)
    .in('tenancies.property_id', propertyIds)
    .gte('days_overdue', 7);

  if (arrErr) {
    errors.push(`Arrears escalation threshold query: ${arrErr.message}`);
    return { tasksCreated, errors };
  }

  for (const arrears of arrearsRecords || []) {
    // Skip arrears with active payment plans — they're handled separately
    if (arrears.has_payment_plan) continue;

    const property = (arrears as any).tenancies?.properties;
    const tenant = (arrears as any).profiles;
    const address = property
      ? [property.address_line_1, property.suburb, property.state, property.postcode].filter(Boolean).join(', ')
      : 'Unknown';
    const tenantName = tenant?.full_name || 'Tenant';
    const tenantEmail = tenant?.email;

    // Determine which threshold applies (highest threshold the days_overdue has crossed)
    let applicableThreshold = THRESHOLDS[0];
    for (const threshold of THRESHOLDS) {
      if (arrears.days_overdue >= threshold.days) {
        applicableThreshold = threshold;
      } else {
        break;
      }
    }

    // Dedup: check if the notice for this threshold was already sent via arrears_actions
    const { data: existingAction } = await supabase
      .from('arrears_actions')
      .select('id')
      .eq('arrears_record_id', arrears.id)
      .eq('action_type', applicableThreshold.actionType)
      .maybeSingle();

    if (existingAction) continue; // Already sent this threshold's notice

    // Also check if an open agent_task already exists for this arrears record
    const alreadyHasTask = await taskExistsForEntity(supabase, userId, arrears.id, 'arrears_escalation_threshold');
    if (alreadyHasTask) continue;

    // Determine if we should auto-execute
    // Day 7 formal reminder: auto-send at L2+ autonomy
    // Day 14+ breach/final/tribunal notices: auto-send at L3+ autonomy (legal category)
    const canAutoSend = applicableThreshold.isBreachNotice
      ? rentAutonomy >= 3 && !!tenantEmail
      : rentAutonomy >= 2 && !!tenantEmail;

    if (canAutoSend) {
      // Auto-send the escalation email via email_queue
      const { error: emailErr } = await supabase.from('email_queue').insert({
        to_email: tenantEmail,
        to_name: tenantName,
        subject: applicableThreshold.emailSubject(address),
        template_name: applicableThreshold.emailTemplate,
        template_data: {
          tenant_name: tenantName,
          property_address: address,
          total_overdue: arrears.total_overdue,
          amount: `$${Number(arrears.total_overdue).toFixed(2)}`,
          days_overdue: arrears.days_overdue,
          first_overdue_date: arrears.first_overdue_date,
        },
        status: 'pending',
      });

      if (!emailErr) {
        // Log in arrears_actions for dedup
        await supabase.from('arrears_actions').insert({
          arrears_record_id: arrears.id,
          action_type: applicableThreshold.actionType,
          description: `Auto-sent ${applicableThreshold.label} to ${tenantName} (${tenantEmail}) — $${Number(arrears.total_overdue).toFixed(2)} overdue ${arrears.days_overdue} days`,
          template_used: applicableThreshold.emailTemplate,
          sent_to: tenantEmail,
          sent_at: new Date().toISOString(),
          delivered: true,
          performed_by: userId,
          is_automated: true,
          metadata: {
            threshold_days: applicableThreshold.days,
            autonomy_level: rentAutonomy,
          },
        });

        // Log proactive action
        await supabase.from('agent_proactive_actions').insert({
          user_id: userId,
          trigger_type: 'arrears_threshold_escalation',
          trigger_source: `arrears_record:${arrears.id}`,
          action_taken: `Auto-sent ${applicableThreshold.label} to ${tenantName} (${tenantEmail}) — $${Number(arrears.total_overdue).toFixed(2)} overdue ${arrears.days_overdue} days at ${address}`,
          tool_name: applicableThreshold.isBreachNotice ? 'send_breach_notice' : 'send_arrears_reminder',
          tool_params: {
            arrears_id: arrears.id,
            threshold_days: applicableThreshold.days,
            tenant_email: tenantEmail,
          },
          result: { status: 'email_queued', template: applicableThreshold.emailTemplate },
          was_auto_executed: true,
        }).catch(() => {});
      } else {
        errors.push(`Arrears threshold email for ${arrears.id} (day ${applicableThreshold.days}): ${emailErr.message}`);
      }
    }

    // Create task so owner sees what happened (or what needs to happen)
    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: canAutoSend
        ? applicableThreshold.taskTitle(tenantName, address)
        : applicableThreshold.taskTitlePending(tenantName, address),
      description: canAutoSend
        ? `${tenantName} at ${address} owes $${Number(arrears.total_overdue).toFixed(2)} (${arrears.days_overdue} days overdue). A ${applicableThreshold.label.toLowerCase()} has been automatically sent to the tenant.`
        : `${tenantName} at ${address} owes $${Number(arrears.total_overdue).toFixed(2)} (${arrears.days_overdue} days overdue). A ${applicableThreshold.label.toLowerCase()} should be sent. Your approval is required to proceed.`,
      category: 'rent_collection',
      status: canAutoSend ? 'in_progress' : 'pending_input',
      priority: applicableThreshold.priority,
      recommendation: canAutoSend
        ? `A ${applicableThreshold.label.toLowerCase()} has been sent to ${tenantName} at ${tenantEmail}. ${
            applicableThreshold.days < 28
              ? `If no payment is received, the next escalation will occur at day ${applicableThreshold.days === 7 ? 14 : applicableThreshold.days === 14 ? 21 : 28}.`
              : 'Consider applying to the tribunal for termination and recovery if payment is not received.'
          }`
        : `The tenant is ${arrears.days_overdue} days overdue. The recommended action is: ${applicableThreshold.label}. ${
            applicableThreshold.isBreachNotice
              ? 'This is a formal legal notice. Your confirmation is required before it can be sent.'
              : 'Approve to send, or choose an alternative action.'
          }`,
      relatedEntityType: 'arrears_record',
      relatedEntityId: arrears.id,
      deepLink: `/(app)/properties/${property?.id || ''}`,
      triggerType: 'arrears_threshold_escalation',
      triggerSource: `arrears_record:${arrears.id}`,
      actionTaken: canAutoSend
        ? `Auto-sent ${applicableThreshold.label} (autonomy L${rentAutonomy})`
        : `Created ${applicableThreshold.label} task (awaiting owner approval, autonomy L${rentAutonomy})`,
      wasAutoExecuted: canAutoSend,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Arrears reached ${applicableThreshold.days}-day threshold — $${Number(arrears.total_overdue).toFixed(2)} overdue`,
          status: 'completed' as const,
          reasoning: `Arrears record ${arrears.id} has been overdue for ${arrears.days_overdue} days, crossing the ${applicableThreshold.days}-day threshold for escalation.`,
          data: {
            total_overdue: arrears.total_overdue,
            days_overdue: arrears.days_overdue,
            threshold: applicableThreshold.days,
          },
        },
        {
          timestamp: new Date().toISOString(),
          action: canAutoSend
            ? `${applicableThreshold.label} sent to ${tenantName}`
            : `${applicableThreshold.label} — awaiting owner approval`,
          status: canAutoSend ? 'completed' as const : 'current' as const,
        },
        ...(canAutoSend
          ? [{
              timestamp: new Date().toISOString(),
              action: 'Monitoring for tenant response or payment',
              status: 'current' as const,
            }]
          : []),
      ],
    });

    if (error) {
      errors.push(`Arrears threshold task for ${arrears.id} (day ${applicableThreshold.days}): ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 21B: Arrears Escalation Path (proper sequence and timing)
// ---------------------------------------------------------------------------

async function scanArrearsEscalationPath(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  const rentAutonomy = getUserAutonomyForCategory(autonomySettings, 'rent_collection');

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find active arrears that have been at the same severity for too long
  const { data: arrearsRecords, error: arrErr } = await supabase
    .from('arrears_records')
    .select(`
      id, tenancy_id, tenant_id, total_overdue, days_overdue, severity, has_payment_plan, updated_at,
      tenancies!inner(property_id, properties!inner(id, address_line_1, suburb, state, owner_id)),
      profiles:tenant_id(full_name, email)
    `)
    .eq('is_resolved', false)
    .in('tenancies.property_id', propertyIds);

  if (arrErr) {
    errors.push(`Arrears escalation query: ${arrErr.message}`);
    return { tasksCreated, errors };
  }

  // Escalation ladder with recommended timing (days at current level before escalating)
  const ESCALATION_TIMING: Record<string, { maxDaysAtLevel: number; nextAction: string; emailTemplate: string }> = {
    mild: { maxDaysAtLevel: 7, nextAction: 'Send formal written reminder', emailTemplate: 'arrears_formal_reminder' },
    moderate: { maxDaysAtLevel: 14, nextAction: 'Issue breach notice (Form 11/equivalent)', emailTemplate: 'arrears_breach_notice' },
    severe: { maxDaysAtLevel: 14, nextAction: 'Apply to tribunal for termination and recovery', emailTemplate: 'arrears_final_warning' },
    critical: { maxDaysAtLevel: 7, nextAction: 'Seek urgent tribunal hearing and consider debt recovery', emailTemplate: 'arrears_tribunal_notice' },
  };

  for (const arrears of arrearsRecords || []) {
    if (arrears.has_payment_plan) continue; // Skip if on payment plan

    const severity = arrears.severity || 'mild';
    const timing = ESCALATION_TIMING[severity];
    if (!timing) continue;

    const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(arrears.updated_at).getTime()) / 86400000);
    if (daysSinceUpdate < timing.maxDaysAtLevel) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, arrears.id, 'escalat');
    if (alreadyExists) continue;

    const property = (arrears as any).tenancies?.properties;
    const tenant = (arrears as any).profiles;
    const address = property ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ') : 'Unknown';
    const tenantName = tenant?.full_name || 'Tenant';
    const tenantEmail = tenant?.email;

    // Auto-execution: if rent_collection autonomy >= L2, auto-send escalation email
    const autoEscalate = rentAutonomy >= 2 && !!tenantEmail && (severity === 'mild' || severity === 'moderate');

    if (autoEscalate) {
      const { error: emailErr } = await supabase.from('email_queue').insert({
        to_email: tenantEmail,
        to_name: tenantName,
        subject: severity === 'mild'
          ? `Rent Payment Reminder - ${address}`
          : `Formal Breach Notice - Overdue Rent - ${address}`,
        template_name: timing.emailTemplate,
        template_data: {
          tenant_name: tenantName,
          property_address: address,
          total_overdue: arrears.total_overdue,
          days_overdue: arrears.days_overdue,
          severity,
        },
        status: 'pending',
      });

      if (!emailErr) {
        await supabase.from('agent_proactive_actions').insert({
          user_id: userId,
          trigger_type: 'arrears_escalation',
          trigger_source: `arrears_record:${arrears.id}`,
          action_taken: `Auto-sent ${severity} arrears escalation email to ${tenantName} (${tenantEmail}) — $${arrears.total_overdue} overdue ${arrears.days_overdue} days at ${address}`,
          tool_name: 'send_arrears_notice',
          tool_params: { arrears_id: arrears.id, severity, tenant_email: tenantEmail },
          result: { status: 'email_queued', template: timing.emailTemplate },
          was_auto_executed: true,
        }).then(() => {});
      }
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Arrears escalation${autoEscalate ? ' — notice sent' : ' needed'} - ${address}`,
      description: autoEscalate
        ? `${tenantName} at ${address} owes $${arrears.total_overdue} (${arrears.days_overdue} days overdue, severity: ${severity}). An escalation email has been automatically sent to the tenant.`
        : `${tenantName} at ${address} owes $${arrears.total_overdue} (${arrears.days_overdue} days overdue, severity: ${severity}). This has been at the "${severity}" level for ${daysSinceUpdate} days without escalation.`,
      category: 'rent_collection',
      status: autoEscalate ? 'in_progress' : 'pending_input',
      priority: severity === 'critical' || severity === 'severe' ? 'high' : 'normal',
      recommendation: autoEscalate
        ? `An escalation notice has been sent. Monitor for tenant response. If no payment received within ${severity === 'mild' ? '7' : '14'} days, the next step is: ${severity === 'mild' ? 'issue breach notice' : 'apply to tribunal'}.`
        : `The recommended next step is: ${timing.nextAction}. This arrears has been at "${severity}" severity for ${daysSinceUpdate} days (recommended max: ${timing.maxDaysAtLevel} days). Escalating on time protects your legal position for any future tribunal action.`,
      relatedEntityType: 'arrears_record',
      relatedEntityId: arrears.id,
      deepLink: `/(app)/properties/${property?.id || ''}`,
      triggerType: 'arrears_escalation_due',
      triggerSource: `arrears_record:${arrears.id}`,
      actionTaken: autoEscalate
        ? `Auto-sent ${severity} escalation email (${daysSinceUpdate} days at level, autonomy L${rentAutonomy})`
        : `Created arrears escalation task (${severity} for ${daysSinceUpdate} days)`,
      wasAutoExecuted: autoEscalate,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Arrears at "${severity}" severity for ${daysSinceUpdate} days (max recommended: ${timing.maxDaysAtLevel})`,
          status: 'completed' as const,
          data: {
            severity,
            days_at_level: daysSinceUpdate,
            total_overdue: arrears.total_overdue,
            days_overdue: arrears.days_overdue,
          },
        },
        {
          timestamp: new Date().toISOString(),
          action: autoEscalate ? `Escalation email sent to ${tenantName}` : timing.nextAction,
          status: autoEscalate ? 'completed' as const : 'current' as const,
        },
        ...(autoEscalate ? [{
          timestamp: new Date().toISOString(),
          action: 'Monitor for tenant response or payment',
          status: 'current' as const,
        }] : []),
      ],
    });

    if (error) {
      errors.push(`Arrears escalation task for ${arrears.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 22: Work Order Completion (approaching deadlines or stalled)
// ---------------------------------------------------------------------------

async function scanWorkOrderCompletion(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find in-progress or scheduled work orders that are past their scheduled date
  const today = new Date().toISOString().split('T')[0];

  const { data: overdueOrders, error: woErr } = await supabase
    .from('work_orders')
    .select(`
      id, title, category, urgency, status, scheduled_date, created_at,
      property_id, trade_id,
      properties!inner(address_line_1, suburb, state, owner_id),
      trades(business_name, contact_name, phone)
    `)
    .eq('owner_id', userId)
    .in('status', ['scheduled', 'in_progress', 'approved'])
    .not('scheduled_date', 'is', null)
    .lt('scheduled_date', today);

  if (woErr) {
    errors.push(`Work order completion query: ${woErr.message}`);
    return { tasksCreated, errors };
  }

  for (const wo of overdueOrders || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, wo.id, 'work order');
    if (alreadyExists) continue;

    const property = (wo as any).properties;
    const trade = (wo as any).trades;
    const address = property ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ') : 'Unknown';
    const tradeName = trade?.business_name || trade?.contact_name || 'Tradesperson';
    const daysOverdue = Math.floor((new Date().getTime() - new Date(wo.scheduled_date).getTime()) / 86400000);

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Work order overdue - ${wo.title}`,
      description: `Work order "${wo.title}" at ${address} was scheduled for ${wo.scheduled_date} and is ${daysOverdue} days overdue. Assigned to ${tradeName}. Status: ${wo.status}.`,
      category: 'maintenance',
      status: 'pending_input',
      priority: wo.urgency === 'emergency' ? 'urgent' : daysOverdue > 7 ? 'high' : 'normal',
      recommendation: `Follow up with ${tradeName}${trade?.phone ? ` (${trade.phone})` : ''} to get a status update. If the work is complete, update the work order status. If the tradesperson is unresponsive, consider reassigning.`,
      relatedEntityType: 'work_order',
      relatedEntityId: wo.id,
      triggerType: 'work_order_overdue',
      triggerSource: `work_order:${wo.id}`,
      actionTaken: `Created overdue work order task (${daysOverdue} days past scheduled date)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Scheduled for ${wo.scheduled_date}, now ${daysOverdue} days overdue`,
          status: 'completed' as const,
          data: { days_overdue: daysOverdue, urgency: wo.urgency, trade_name: tradeName, status: wo.status },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Follow up with tradesperson or reassign',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Work order completion task for ${wo.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 23: Maintenance → Proactive Trade Match & Cost Estimate
// When a new maintenance request is submitted, proactively check the owner's
// trade network for matching category trades, estimate cost, and surface
// a "Needs Attention" tile with trade options, estimated cost, and tenant
// availability so the owner can approve with one tap.
// ---------------------------------------------------------------------------

async function scanMaintenanceTradeMatch(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  const maintenanceAutonomy = getUserAutonomyForCategory(autonomySettings, 'maintenance');
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find recent maintenance requests (last 48h) that don't have a trade assigned
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newRequests, error: queryErr } = await supabase
    .from('maintenance_requests')
    .select(`
      id, title, description, urgency, status, category, tenant_id,
      preferred_times, access_instructions, estimated_cost,
      property_id, trade_id, created_at,
      properties!inner(id, address_line_1, suburb, state, postcode, owner_id),
      profiles:tenant_id(full_name, email, phone)
    `)
    .in('property_id', propertyIds)
    .in('status', ['submitted', 'acknowledged'])
    .is('trade_id', null)
    .gte('created_at', twoDaysAgo);

  if (queryErr) {
    errors.push(`Maintenance trade match query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const req of newRequests || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, req.id, 'trade match');
    if (alreadyExists) continue;

    const property = (req as any).properties;
    const tenant = (req as any).profiles;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantName = tenant?.full_name || 'Tenant';

    // Check owner's trade network for matching category trades
    const { data: matchingTrades } = await supabase
      .from('owner_trades')
      .select(`
        trade_id, is_favorite, notes,
        trades!inner(id, business_name, contact_name, phone, email, categories, average_rating, total_jobs, status)
      `)
      .eq('owner_id', userId)
      .eq('trades.status', 'active');

    // Filter trades that match the maintenance category
    const categoryTrades = (matchingTrades || []).filter((ot: any) => {
      const cats = ot.trades?.categories || [];
      return cats.includes(req.category);
    });

    // Sort by favorite first, then by rating
    categoryTrades.sort((a: any, b: any) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return (b.trades?.average_rating || 0) - (a.trades?.average_rating || 0);
    });

    // Cost estimate ranges by category (AUD, typical ranges for QLD)
    const costEstimates: Record<string, { min: number; max: number; callout: number }> = {
      plumbing: { min: 150, max: 500, callout: 80 },
      electrical: { min: 120, max: 400, callout: 80 },
      appliance: { min: 100, max: 600, callout: 70 },
      hvac: { min: 200, max: 800, callout: 100 },
      structural: { min: 300, max: 2000, callout: 100 },
      pest: { min: 100, max: 400, callout: 0 },
      locks_security: { min: 80, max: 300, callout: 60 },
      garden_outdoor: { min: 100, max: 500, callout: 0 },
      cleaning: { min: 100, max: 350, callout: 0 },
      other: { min: 100, max: 500, callout: 50 },
    };

    const estimate = costEstimates[req.category] || costEstimates.other;
    const isEmergency = req.urgency === 'emergency';
    const emergencyMultiplier = isEmergency ? 1.5 : 1;
    const estMin = Math.round(estimate.min * emergencyMultiplier);
    const estMax = Math.round(estimate.max * emergencyMultiplier);

    // Build trade options description
    let tradeInfo = '';
    if (categoryTrades.length > 0) {
      const topTrades = categoryTrades.slice(0, 3);
      tradeInfo = topTrades.map((ot: any, idx: number) => {
        const t = ot.trades;
        const fav = ot.is_favorite ? ' ⭐' : '';
        const rating = t.average_rating ? ` (${t.average_rating}/5)` : '';
        return `${idx + 1}. ${t.business_name}${fav}${rating} — ${t.phone}`;
      }).join('\n');
      tradeInfo = `\n\nMatching trades in your network:\n${tradeInfo}`;
    } else {
      tradeInfo = '\n\nNo matching trades in your network. A web search can find local options.';
    }

    const availabilityInfo = req.preferred_times
      ? `\n\nTenant availability: ${req.preferred_times}`
      : '';

    const accessInfo = req.access_instructions
      ? `\nAccess notes: ${req.access_instructions}`
      : '';

    // Auto-execution: if maintenance autonomy >= L2 and a favorite trade exists, auto-assign
    const favoriteTrade = categoryTrades.find((ot: any) => ot.is_favorite);
    const topTrade = favoriteTrade || (categoryTrades.length > 0 ? categoryTrades[0] : null);
    const autoAssign = maintenanceAutonomy >= 2 && topTrade && estMax <= 500; // Auto-assign only for jobs under $500

    if (autoAssign) {
      const trade = (topTrade as any).trades;
      // Assign trade to the maintenance request
      await supabase.from('maintenance_requests')
        .update({
          trade_id: trade.id,
          status: 'in_progress',
          status_changed_at: new Date().toISOString(),
        })
        .eq('id', req.id);

      // Create a work order for the trade
      await supabase.from('work_orders').insert({
        maintenance_request_id: req.id,
        property_id: req.property_id,
        trade_id: trade.id,
        owner_id: userId,
        title: req.title,
        description: req.description || req.title,
        urgency: req.urgency,
        status: 'assigned',
        estimated_cost_min: estMin,
        estimated_cost_max: estMax,
      });

      // Queue notification email to the trade
      if (trade.email) {
        await supabase.from('email_queue').insert({
          to_email: trade.email,
          to_name: trade.contact_name || trade.business_name,
          subject: `${isEmergency ? 'URGENT: ' : ''}New Job — ${req.title} at ${address}`,
          template_name: 'trade_job_assignment',
          template_data: {
            trade_name: trade.contact_name || trade.business_name,
            job_title: req.title,
            property_address: address,
            urgency: req.urgency,
            description: req.description || req.title,
            tenant_name: tenantName,
            preferred_times: req.preferred_times || 'Flexible',
            access_instructions: req.access_instructions || 'Contact tenant to arrange',
          },
          status: 'pending',
        });
      }

      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: 'maintenance_trade_auto_assign',
        trigger_source: `maintenance_request:${req.id}`,
        action_taken: `Auto-assigned ${trade.business_name} to "${req.title}" at ${address} (est. $${estMin}-$${estMax}, ${favoriteTrade ? 'favorite' : 'top-rated'} trade)`,
        tool_name: 'assign_trade',
        tool_params: { request_id: req.id, trade_id: trade.id, estimated_cost: `$${estMin}-$${estMax}` },
        result: { status: 'trade_assigned', trade_name: trade.business_name },
        was_auto_executed: true,
      }).then(() => {});
    }

    const assignedTrade = autoAssign ? (topTrade as any).trades : null;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: autoAssign
        ? `${isEmergency ? '🚨 ' : ''}${req.title} — ${assignedTrade.business_name} assigned`
        : `${isEmergency ? '🚨 EMERGENCY: ' : ''}${req.title} — Trade needed at ${property?.suburb || 'property'}`,
      description: autoAssign
        ? `${tenantName} reported: "${req.title}". ${assignedTrade.business_name} has been automatically assigned (est. $${estMin}–$${estMax}). They have been notified and will arrange access.`
        : `${tenantName} reported: "${req.title}". Category: ${req.category.replace(/_/g, ' ')}. Urgency: ${req.urgency}.${availabilityInfo}${accessInfo}`,
      category: 'maintenance',
      status: autoAssign ? 'in_progress' : 'pending_input',
      priority: isEmergency ? 'urgent' : req.urgency === 'urgent' ? 'high' : 'normal',
      recommendation: autoAssign
        ? `${assignedTrade.business_name} has been auto-assigned (${favoriteTrade ? 'your favorite' : 'highest-rated'} ${req.category.replace(/_/g, ' ')} trade). Estimated cost: $${estMin}–$${estMax}. I'll follow up if no response within 24 hours.`
        : `Estimated cost: $${estMin} – $${estMax}${isEmergency ? ' (emergency rates)' : ''}${estimate.callout > 0 ? ` + $${Math.round(estimate.callout * emergencyMultiplier)} call-out fee` : ''}.${tradeInfo}\n\nWould you like me to contact these trades and arrange a quote? I can book them in based on the tenant's availability.`,
      relatedEntityType: 'maintenance_request',
      relatedEntityId: req.id,
      deepLink: `/(app)/maintenance/${req.id}`,
      triggerType: 'maintenance_trade_match',
      triggerSource: `maintenance_request:${req.id}`,
      actionTaken: autoAssign
        ? `Auto-assigned ${assignedTrade.business_name} (est. $${estMin}-$${estMax}, autonomy L${maintenanceAutonomy})`
        : `Created proactive trade match tile (${categoryTrades.length} matching trades found, est. $${estMin}-$${estMax})`,
      wasAutoExecuted: autoAssign,
      timelineEntries: [
        {
          timestamp: req.created_at,
          action: `Tenant reported: "${req.title}" (${req.urgency})`,
          status: 'completed' as const,
          data: { category: req.category, urgency: req.urgency, tenant: tenantName },
        },
        {
          timestamp: new Date().toISOString(),
          action: `Found ${categoryTrades.length} matching trade${categoryTrades.length !== 1 ? 's' : ''} in network. Estimated cost: $${estMin}–$${estMax}.`,
          status: 'completed' as const,
          data: { trades_found: categoryTrades.length, cost_estimate_min: estMin, cost_estimate_max: estMax },
        },
        {
          timestamp: new Date().toISOString(),
          action: autoAssign
            ? `Auto-assigned ${assignedTrade.business_name} and sent job notification`
            : 'Awaiting your approval to contact trades and arrange a quote',
          status: autoAssign ? 'completed' as const : 'current' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoAssign ? 'Awaiting trade response and scheduling' : 'Book trade at agreed price and time',
          status: autoAssign ? 'current' as const : 'pending' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Maintenance trade match task for ${req.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 24: New Tenant Onboarding Workflow
// When an application is approved, proactively start the onboarding checklist:
// lease generation, bond collection, entry inspection scheduling, key handover
// ---------------------------------------------------------------------------

async function scanNewTenantOnboarding(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  const leaseAutonomy = getUserAutonomyForCategory(autonomySettings, 'lease_management');
  let tasksCreated = 0;
  const errors: string[] = [];

  // Find recently approved applications (last 48h) that don't have a tenancy yet
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: approvedApps, error: queryErr } = await supabase
    .from('applications')
    .select(`
      id, full_name, email, phone, move_in_date, lease_term_preference,
      additional_occupants, has_pets, pet_description, status, reviewed_at,
      listings!inner(
        id, rent_amount, bond_weeks, property_id,
        properties!inner(id, address_line_1, suburb, state, postcode, owner_id, bedrooms, bathrooms)
      )
    `)
    .eq('status', 'approved')
    .eq('listings.properties.owner_id', userId)
    .gte('reviewed_at', twoDaysAgo);

  if (queryErr) {
    errors.push(`Onboarding query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const app of approvedApps || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, app.id, 'onboarding');
    if (alreadyExists) continue;

    const listing = (app as any).listings;
    const property = listing?.properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');

    const moveInDate = app.move_in_date
      ? new Date(app.move_in_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'TBD';

    const bondWeeks = listing?.bond_weeks || 4;
    const bondAmount = listing?.rent_amount ? listing.rent_amount * bondWeeks : 0;

    // Auto-execution: if lease_management autonomy >= L2, auto-send welcome email + auto-schedule entry inspection
    const autoOnboard = leaseAutonomy >= 2 && !!app.email;

    if (autoOnboard) {
      // Auto-send welcome email to new tenant
      await supabase.from('email_queue').insert({
        to_email: app.email,
        to_name: app.full_name,
        subject: `Welcome to ${address} — Next Steps`,
        template_name: 'tenant_welcome',
        template_data: {
          tenant_name: app.full_name,
          property_address: address,
          move_in_date: moveInDate,
          rent_amount: listing?.rent_amount || 0,
          rent_frequency: 'week',
          bond_amount: bondAmount,
        },
        status: 'pending',
      });

      // Auto-schedule entry condition inspection (1-2 days before move-in)
      if (app.move_in_date) {
        const inspectionDate = new Date(app.move_in_date);
        inspectionDate.setDate(inspectionDate.getDate() - 1);
        const inspDateStr = inspectionDate.toISOString().split('T')[0];

        await supabase.from('inspections').insert({
          property_id: property?.id || listing?.property_id,
          inspection_type: 'entry',
          scheduled_date: inspDateStr,
          status: 'scheduled',
          created_by: userId,
          notes: `Entry condition inspection for ${app.full_name} moving in ${moveInDate}`,
        });
      }

      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: 'tenant_onboarding_auto',
        trigger_source: `application:${app.id}`,
        action_taken: `Auto-sent welcome email to ${app.full_name} (${app.email}) and scheduled entry inspection for ${address}`,
        tool_name: 'onboard_tenant',
        tool_params: { application_id: app.id, property_id: property?.id },
        result: { status: 'welcome_sent_inspection_scheduled' },
        was_auto_executed: true,
      }).then(() => {});
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Onboard ${app.full_name} at ${property?.suburb || 'property'}`,
      description: autoOnboard
        ? `${app.full_name} has been approved for ${address}. Move-in date: ${moveInDate}. A welcome email has been sent and entry inspection scheduled. Bond: $${bondAmount}.${app.has_pets ? ` Has pets: ${app.pet_description || 'Yes'}.` : ''}`
        : `${app.full_name} has been approved for ${address}. Move-in date: ${moveInDate}. Rent: $${listing?.rent_amount || 'TBD'}/week. Bond: $${bondAmount}.${app.has_pets ? ` Has pets: ${app.pet_description || 'Yes'}.` : ''}`,
      category: 'lease_management',
      status: 'in_progress',
      priority: 'high',
      recommendation: autoOnboard
        ? `Welcome email sent and entry inspection scheduled. Remaining steps:\n1. Generate lease agreement\n2. Collect bond ($${bondAmount}) and lodge with RTA within 10 days\n3. Complete entry condition inspection\n4. Arrange key handover for ${moveInDate}\n5. Set up rent schedule`
        : `I can help you with the onboarding process:\n1. Generate a QLD-compliant lease agreement\n2. Collect bond ($${bondAmount}) and lodge with RTA within 10 days\n3. Schedule an entry condition inspection before move-in\n4. Arrange key handover for ${moveInDate}\n5. Set up rent schedule (${listing?.rent_amount ? `$${listing.rent_amount}/week` : 'TBD'})\n\nWould you like me to start generating the lease?`,
      relatedEntityType: 'application',
      relatedEntityId: app.id,
      deepLink: `/(app)/applications/${app.id}`,
      triggerType: 'tenant_onboarding',
      triggerSource: `application:${app.id}`,
      actionTaken: autoOnboard
        ? `Auto-onboarded: welcome email sent, entry inspection scheduled (autonomy L${leaseAutonomy})`
        : `Created onboarding workflow tile for ${app.full_name}`,
      wasAutoExecuted: autoOnboard,
      timelineEntries: [
        {
          timestamp: app.reviewed_at || new Date().toISOString(),
          action: `Application approved for ${app.full_name}`,
          status: 'completed' as const,
          data: { applicant: app.full_name, move_in: app.move_in_date, rent: listing?.rent_amount },
        },
        {
          timestamp: new Date().toISOString(),
          action: autoOnboard ? 'Welcome email sent to tenant' : 'Generate lease agreement',
          status: autoOnboard ? 'completed' as const : 'current' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoOnboard ? 'Entry inspection scheduled' : `Collect and lodge bond ($${bondAmount})`,
          status: autoOnboard ? 'completed' as const : 'pending' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoOnboard ? 'Generate lease agreement' : 'Schedule entry condition inspection',
          status: 'current' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: `Key handover (${moveInDate})`,
          status: 'pending' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Onboarding task for ${app.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 25: End-of-Tenancy Workflow
// When notice is given, proactively start the exit checklist:
// exit inspection, bond claim assessment, re-listing, utility transfers
// ---------------------------------------------------------------------------

async function scanEndOfTenancyWorkflow(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  const leaseAutonomy = getUserAutonomyForCategory(autonomySettings, 'lease_management');
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find tenancies where notice has been given
  const { data: endingTenancies, error: queryErr } = await supabase
    .from('tenancies')
    .select(`
      id, lease_end_date, notice_given_date, actual_end_date, status,
      rent_amount, bond_amount, bond_status,
      property_id,
      properties!inner(id, address_line_1, suburb, state, postcode, owner_id),
      tenancy_tenants(
        tenant_id, is_primary,
        profiles:tenant_id(full_name, email)
      )
    `)
    .in('property_id', propertyIds)
    .in('status', ['ending', 'active'])
    .not('notice_given_date', 'is', null);

  if (queryErr) {
    errors.push(`End-of-tenancy query: ${queryErr.message}`);
    return { tasksCreated, errors };
  }

  for (const tenancy of endingTenancies || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'end of tenancy');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantNames = ((tenancy as any).tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');

    const endDate = tenancy.actual_end_date || tenancy.lease_end_date;
    const endDateFormatted = endDate
      ? new Date(endDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'TBD';
    const daysUntilEnd = endDate
      ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    const bondInfo = tenancy.bond_amount
      ? `Bond: $${tenancy.bond_amount} (status: ${tenancy.bond_status || 'unknown'})`
      : 'No bond on record';

    // Auto-execution: if lease autonomy >= L2, auto-schedule exit inspection and send vacating checklist
    const primaryTenant = ((tenancy as any).tenancy_tenants || []).find((tt: any) => tt.is_primary);
    const primaryEmail = primaryTenant?.profiles?.email;
    const autoExecuteExit = leaseAutonomy >= 2 && daysUntilEnd > 3;

    if (autoExecuteExit) {
      // Auto-schedule exit inspection 1-2 days before end date
      if (endDate && daysUntilEnd > 2) {
        const exitInspDate = new Date(endDate);
        exitInspDate.setDate(exitInspDate.getDate() - 1);
        const exitInspDateStr = exitInspDate.toISOString().split('T')[0];

        // Check no exit inspection already exists
        const { data: existingExitInsp } = await supabase
          .from('inspections')
          .select('id')
          .eq('property_id', tenancy.property_id)
          .eq('inspection_type', 'exit')
          .in('status', ['scheduled', 'in_progress'])
          .limit(1);

        if (!existingExitInsp || existingExitInsp.length === 0) {
          await supabase.from('inspections').insert({
            property_id: tenancy.property_id,
            inspection_type: 'exit',
            scheduled_date: exitInspDateStr,
            status: 'scheduled',
            created_by: userId,
            notes: `Exit inspection before ${tenantNames || 'tenant'} vacates on ${endDateFormatted}`,
          });
        }
      }

      // Send vacating checklist email to tenant
      if (primaryEmail) {
        await supabase.from('email_queue').insert({
          to_email: primaryEmail,
          to_name: tenantNames || 'Tenant',
          subject: `Move-Out Checklist — ${address}`,
          template_name: 'tenant_vacating_checklist',
          template_data: {
            tenant_name: tenantNames || 'Tenant',
            property_address: address,
            end_date: endDateFormatted,
            bond_amount: tenancy.bond_amount || 0,
          },
          status: 'pending',
        });
      }

      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: 'end_of_tenancy_auto',
        trigger_source: `tenancy:${tenancy.id}`,
        action_taken: `Auto-scheduled exit inspection and sent vacating checklist to ${tenantNames} for ${address} (vacating ${endDateFormatted})`,
        tool_name: 'manage_end_of_tenancy',
        tool_params: { tenancy_id: tenancy.id, end_date: endDate },
        result: { status: 'exit_inspection_scheduled_checklist_sent' },
        was_auto_executed: true,
      }).then(() => {});
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `End of tenancy in ${daysUntilEnd > 0 ? `${daysUntilEnd} days` : 'progress'} — ${property?.suburb || 'property'}`,
      description: autoExecuteExit
        ? `${tenantNames || 'Tenant'} is vacating ${address} on ${endDateFormatted}. Exit inspection has been scheduled and a vacating checklist has been sent to the tenant. ${bondInfo}.`
        : `${tenantNames || 'Tenant'} is vacating ${address}. Move-out date: ${endDateFormatted}. ${bondInfo}. Rent: $${tenancy.rent_amount}/week.`,
      category: 'lease_management',
      status: 'in_progress',
      priority: daysUntilEnd <= 7 ? 'urgent' : daysUntilEnd <= 14 ? 'high' : 'normal',
      recommendation: autoExecuteExit
        ? `Exit inspection scheduled and vacating checklist sent. Remaining steps:\n1. Complete exit condition inspection\n2. Compare entry vs exit for damage assessment\n3. Process bond — return or lodge claim within 10 days\n4. Arrange property cleaning and any repairs\n5. Consider re-listing the property`
        : `End-of-tenancy checklist:\n1. Schedule exit condition inspection (before move-out)\n2. Compare entry vs exit inspection for damage assessment\n3. Process bond — return or lodge claim within 10 days of vacancy\n4. Arrange property cleaning and any repairs\n5. Consider re-listing the property${tenancy.rent_amount ? ` (current rent: $${tenancy.rent_amount}/week)` : ''}\n6. Arrange utility meter readings and transfer\n\nWould you like me to start scheduling the exit inspection?`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      deepLink: `/(app)/(tabs)/properties/${property?.id}`,
      triggerType: 'end_of_tenancy',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: autoExecuteExit
        ? `Auto-scheduled exit inspection + sent vacating checklist (autonomy L${leaseAutonomy})`
        : `Created end-of-tenancy workflow (vacating ${endDateFormatted})`,
      wasAutoExecuted: autoExecuteExit,
      timelineEntries: [
        {
          timestamp: tenancy.notice_given_date || new Date().toISOString(),
          action: `Notice given by ${tenantNames || 'tenant'}`,
          status: 'completed' as const,
          data: { notice_date: tenancy.notice_given_date, end_date: endDate },
        },
        {
          timestamp: new Date().toISOString(),
          action: autoExecuteExit ? 'Exit inspection scheduled' : 'Schedule exit inspection',
          status: autoExecuteExit ? 'completed' as const : 'current' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoExecuteExit ? 'Vacating checklist sent to tenant' : 'Compare entry/exit condition',
          status: autoExecuteExit ? 'completed' as const : 'pending' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoExecuteExit ? 'Complete inspection and assess damage' : 'Process bond return/claim',
          status: 'current' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Process bond and re-list property',
          status: 'pending' as const,
        },
      ],
    });

    if (error) {
      errors.push(`End-of-tenancy task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 26: Rent Payment Received — Auto-Reconcile & Thank Tenant
// When rent is paid (completed payment detected), surface confirmation and
// optionally auto-send a thank-you message if autonomy permits.
// ---------------------------------------------------------------------------

async function scanRentPaymentReceived(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Find payments completed in the last 24h
  const { data: recentPayments, error: payErr } = await supabase
    .from('payments')
    .select(`
      id, amount, paid_at, status, tenancy_id,
      tenancies!inner(
        id, rent_amount, rent_frequency, property_id,
        properties!inner(address_line_1, suburb, state, owner_id),
        tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name))
      )
    `)
    .eq('status', 'completed')
    .gte('paid_at', twentyFourHoursAgo)
    .eq('tenancies.properties.owner_id', userId);

  if (payErr) {
    errors.push(`Rent payment received query: ${payErr.message}`);
    return { tasksCreated, errors };
  }

  for (const payment of recentPayments || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, payment.id, 'payment received');
    if (alreadyExists) continue;

    const tenancy = (payment as any).tenancies;
    const property = tenancy?.properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantNames = (tenancy?.tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');

    // Check for overpayment or underpayment
    const expectedAmount = tenancy?.rent_amount || 0;
    const paidAmount = Number(payment.amount);
    const difference = paidAmount - expectedAmount;
    const isOverpayment = difference > 1;
    const isUnderpayment = difference < -1;

    let paymentNote = '';
    if (isOverpayment) {
      paymentNote = ` Note: This is $${difference.toFixed(2)} MORE than the expected rent of $${expectedAmount}. This may include arrears catch-up.`;
    } else if (isUnderpayment) {
      paymentNote = ` Note: This is $${Math.abs(difference).toFixed(2)} LESS than the expected rent of $${expectedAmount}. A shortfall may need follow-up.`;
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Rent received — $${paidAmount.toFixed(0)} from ${tenantNames || 'tenant'}`,
      description: `Rent payment of $${paidAmount.toFixed(2)} received from ${tenantNames || 'tenant'} for ${address}.${paymentNote}`,
      category: 'rent_collection',
      status: isUnderpayment ? 'pending_input' : 'completed',
      priority: isUnderpayment ? 'normal' : 'low',
      recommendation: isUnderpayment
        ? `The payment was $${Math.abs(difference).toFixed(2)} short of the expected rent. Consider reaching out to the tenant to clarify and arrange the remaining amount.`
        : isOverpayment
          ? `The tenant paid $${difference.toFixed(2)} extra. This may cover previous arrears. Verify your records and acknowledge the payment.`
          : `Rent received on time. No action needed.`,
      relatedEntityType: 'payment',
      relatedEntityId: payment.id,
      triggerType: 'rent_payment_received',
      triggerSource: `payment:${payment.id}`,
      actionTaken: `Logged rent receipt ($${paidAmount.toFixed(2)} from ${tenantNames || 'tenant'})`,
      wasAutoExecuted: true,
      timelineEntries: [
        {
          timestamp: payment.paid_at || new Date().toISOString(),
          action: `$${paidAmount.toFixed(2)} received from ${tenantNames || 'tenant'}`,
          status: 'completed' as const,
          data: { amount: paidAmount, expected: expectedAmount, difference },
        },
        ...(isUnderpayment ? [{
          timestamp: new Date().toISOString(),
          action: `Follow up on $${Math.abs(difference).toFixed(2)} shortfall`,
          status: 'current' as const,
        }] : []),
      ],
    });

    if (error) {
      errors.push(`Rent payment received task for ${payment.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 27: Inspection Completed — Auto-Compare & Flag Issues
// When an inspection is marked as completed, compare with the entry
// condition report and flag any new damage or concerns.
// ---------------------------------------------------------------------------

async function scanInspectionCompleted(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Find recently completed inspections
  const { data: completedInspections, error: inspErr } = await supabase
    .from('inspections')
    .select(`
      id, property_id, inspection_type, status, completed_at, scheduled_date,
      overall_condition, action_items,
      properties!inner(address_line_1, suburb, state, owner_id)
    `)
    .in('property_id', propertyIds)
    .eq('status', 'completed')
    .gte('completed_at', fortyEightHoursAgo);

  if (inspErr) {
    errors.push(`Inspection completed query: ${inspErr.message}`);
    return { tasksCreated, errors };
  }

  for (const inspection of completedInspections || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, inspection.id, 'inspection complete');
    if (alreadyExists) continue;

    const property = (inspection as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const inspType = (inspection.inspection_type || 'routine').replace(/_/g, ' ');

    const issueCount = Array.isArray(inspection.action_items) ? inspection.action_items.length : 0;
    const hasIssues = issueCount > 0;

    // Check if entry condition report exists for comparison
    const { data: entryReport } = await supabase
      .from('inspections')
      .select('id, overall_condition, action_items')
      .eq('property_id', inspection.property_id)
      .eq('inspection_type', 'entry')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    const hasEntryComparison = entryReport && entryReport.length > 0;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `${inspType} inspection completed — ${address}`,
      description: `The ${inspType} inspection at ${address} has been completed.${hasIssues ? ` ${issueCount} action item${issueCount !== 1 ? 's' : ''} flagged.` : ' No issues found.'}${inspection.overall_condition ? ` Overall condition: ${inspection.overall_condition}.` : ''}`,
      category: 'inspections',
      status: hasIssues ? 'pending_input' : 'completed',
      priority: hasIssues ? 'normal' : 'low',
      recommendation: hasIssues
        ? `${issueCount} issue${issueCount !== 1 ? 's were' : ' was'} identified during the inspection. Review the findings and determine if any maintenance work is needed.${hasEntryComparison ? ' I can compare this against the entry condition report to identify new damage.' : ''}`
        : `No issues found. ${inspection.inspection_type === 'exit' ? 'This is a good sign for bond return.' : 'Property is in good condition.'}`,
      relatedEntityType: 'inspection',
      relatedEntityId: inspection.id,
      deepLink: `/(app)/inspections/${inspection.id}`,
      triggerType: 'inspection_completed',
      triggerSource: `inspection:${inspection.id}`,
      actionTaken: `Created inspection completion summary (${issueCount} issues)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: inspection.completed_at || new Date().toISOString(),
          action: `${inspType} inspection completed at ${address}`,
          status: 'completed' as const,
          data: { action_items: issueCount, overall_condition: inspection.overall_condition },
        },
        ...(hasIssues ? [{
          timestamp: new Date().toISOString(),
          action: `Review ${issueCount} flagged issue${issueCount !== 1 ? 's' : ''}`,
          status: 'current' as const,
        }] : []),
      ],
    });

    if (error) {
      errors.push(`Inspection completed task for ${inspection.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 28: Tenant Message Triage — Auto-Categorize & Route
// When a tenant sends a message, detect the intent (maintenance, rent query,
// complaint, general) and surface an appropriate action tile.
// ---------------------------------------------------------------------------

async function scanTenantMessageTriage(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  // Find recent tenant messages in conversations the owner is part of
  const { data: recentMessages, error: msgErr } = await supabase
    .from('messages')
    .select(`
      id, content, sender_id, created_at, conversation_id,
      conversations!inner(
        id, property_id, title,
        properties(address_line_1, suburb, state)
      ),
      profiles:sender_id(full_name, role)
    `)
    .eq('profiles.role', 'tenant')
    .gte('created_at', fourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  if (msgErr) {
    errors.push(`Tenant message triage query: ${msgErr.message}`);
    return { tasksCreated, errors };
  }

  // Only process messages for conversations the owner is in
  for (const msg of recentMessages || []) {
    const { data: isParticipant } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', msg.conversation_id)
      .eq('user_id', userId)
      .limit(1);

    if (!isParticipant || isParticipant.length === 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, msg.id, 'tenant message');
    if (alreadyExists) continue;

    const conversation = (msg as any).conversations;
    const sender = (msg as any).profiles;
    const property = conversation?.properties;
    const address = property
      ? [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ')
      : '';
    const tenantName = sender?.full_name || 'Tenant';
    const content = (msg.content || '').substring(0, 200);

    // Simple intent detection from message content
    const lowerContent = (msg.content || '').toLowerCase();
    let intent = 'general';
    let category: string = 'communication';
    let suggestedAction = 'Reply to the tenant message.';

    if (/break|broken|leak|repair|fix|damage|crack|mould|mold|pest|plumb|electric|hot water|air con|not working|blocked/.test(lowerContent)) {
      intent = 'maintenance';
      category = 'maintenance';
      suggestedAction = `This appears to be a maintenance request. Consider asking the tenant to log it formally via the maintenance form, or create a request on their behalf.`;
    } else if (/rent|payment|pay|arrear|overdue|late|transfer|bank/.test(lowerContent)) {
      intent = 'rent';
      category = 'rent_collection';
      suggestedAction = `This appears to be about rent or payments. Check the rent schedule and arrears status for this tenancy.`;
    } else if (/lease|renew|extend|terminate|end|move|vacat|notice|break lease/.test(lowerContent)) {
      intent = 'lease';
      category = 'lease_management';
      suggestedAction = `This appears to be about the lease. Review the current tenancy status and respond accordingly.`;
    } else if (/complain|unhappy|dissatisf|frustrat|unaccept|demand|threaten|legal|tribunal/.test(lowerContent)) {
      intent = 'complaint';
      category = 'communication';
      suggestedAction = `This appears to be a complaint. Respond promptly and professionally. Consider whether escalation is needed.`;
    } else if (/inspect|entry|routine|visit|access/.test(lowerContent)) {
      intent = 'inspection';
      category = 'inspections';
      suggestedAction = `This appears to be about an inspection or property access. Check the inspection schedule.`;
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Message from ${tenantName}${address ? ` — ${(property?.suburb || '')}` : ''}`,
      description: `${tenantName} sent: "${content}${(msg.content || '').length > 200 ? '...' : ''}"`,
      category,
      status: 'pending_input',
      priority: intent === 'maintenance' || intent === 'complaint' ? 'high' : 'normal',
      recommendation: suggestedAction,
      relatedEntityType: 'message',
      relatedEntityId: msg.id,
      deepLink: `/(app)/messages/${msg.conversation_id}`,
      triggerType: 'tenant_message_received',
      triggerSource: `message:${msg.id}`,
      actionTaken: `Created message triage tile (detected intent: ${intent})`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: msg.created_at,
          action: `${tenantName} sent a message (${intent} intent detected)`,
          status: 'completed' as const,
          data: { intent, tenant: tenantName, preview: content },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Review and respond to tenant',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Tenant message triage task for ${msg.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 29: Lease Signed — Proactive Compliance Checklist
// When a new lease starts, automatically create a compliance checklist
// covering state-specific obligations (smoke alarms, safety switches, etc.)
// ---------------------------------------------------------------------------

async function scanLeaseStartedCompliance(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find tenancies that just started (lease_start_date in last 7 days)
  const { data: newTenancies, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, lease_start_date, lease_end_date, rent_amount, bond_amount, bond_status,
      property_id,
      properties!inner(address_line_1, suburb, state, postcode, owner_id, property_type),
      tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name))
    `)
    .in('property_id', propertyIds)
    .eq('status', 'active')
    .gte('lease_start_date', sevenDaysAgo.split('T')[0]);

  if (tenErr) {
    errors.push(`Lease started compliance query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  // State-specific compliance requirements
  const STATE_REQUIREMENTS: Record<string, string[]> = {
    QLD: [
      'Smoke alarms compliant (photoelectric, interconnected in new builds)',
      'Pool fence inspection certificate (if applicable)',
      'Bond lodged with RTA within 10 days',
      'Entry condition report completed and signed by tenant within 3 days',
      'Information statement (Form 17a) provided to tenant',
      'Emergency repair contacts provided',
    ],
    NSW: [
      'Smoke alarms working (at least on each level)',
      'Window safety locks on floors above ground (if applicable)',
      'Bond lodged with NSW Fair Trading within 10 days',
      'Condition report provided before move-in',
      'Strata by-laws provided (if applicable)',
      'Pool fence compliance certificate (if applicable)',
    ],
    VIC: [
      'Smoke alarms installed on each storey',
      'Gas safety check completed within last 2 years',
      'Electrical safety check completed within last 2 years',
      'Bond lodged with RTBA within 10 days',
      'Condition report provided before move-in',
      'Minimum standards compliance verified',
    ],
    SA: [
      'Smoke alarms compliant',
      'Bond lodged within 14 days',
      'Condition report provided',
      'Property meets minimum housing standards',
    ],
    WA: [
      'Smoke alarms compliant (RCD + smoke)',
      'Bond lodged with Bond Administrator within 14 days',
      'Property condition report completed',
      'Pool barrier compliance (if applicable)',
    ],
    TAS: [
      'Smoke alarms installed and working',
      'Bond lodged within 10 days',
      'Condition report completed within 2 days of tenancy start',
    ],
    NT: [
      'Smoke alarms and emergency equipment',
      'Bond lodged within 14 days',
      'Condition report completed',
      'Swimming pool fence compliance (if applicable)',
    ],
    ACT: [
      'Smoke alarms compliant',
      'Energy Efficiency Rating disclosed',
      'Bond lodged within 10 days',
      'Condition report completed and signed',
    ],
  };

  for (const tenancy of newTenancies || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'compliance checklist');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const state = property?.state || 'QLD';
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantNames = ((tenancy as any).tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');

    const requirements = STATE_REQUIREMENTS[state] || STATE_REQUIREMENTS.QLD;
    const checklistText = requirements.map((r, i) => `${i + 1}. ${r}`).join('\n');

    const timelineSteps: TimelineEntry[] = [
      {
        timestamp: tenancy.lease_start_date,
        action: `Lease started for ${tenantNames || 'tenant'} at ${address}`,
        status: 'completed' as const,
        data: { state, tenant: tenantNames, rent: tenancy.rent_amount },
      },
      ...requirements.map((req) => ({
        timestamp: new Date().toISOString(),
        action: req,
        status: 'pending' as const,
      })),
    ];
    // Mark first requirement as current
    if (timelineSteps.length > 1) {
      timelineSteps[1].status = 'current' as const;
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `New lease compliance checklist — ${address}`,
      description: `New tenancy started at ${address} for ${tenantNames || 'tenant'}. The following ${state} compliance items need to be completed:\n\n${checklistText}`,
      category: 'compliance',
      status: 'in_progress',
      priority: 'high',
      recommendation: `Complete all ${state}-specific compliance requirements for this new tenancy. Bond lodgement has a strict deadline — don't miss it.`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      deepLink: `/(app)/properties/${tenancy.property_id}`,
      triggerType: 'new_lease_compliance',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: `Created ${state} compliance checklist (${requirements.length} items)`,
      wasAutoExecuted: false,
      timelineEntries: timelineSteps,
    });

    if (error) {
      errors.push(`Lease compliance task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 30: First Rent Not Received — New Tenancy Alert
// After a new tenancy starts, if the first rent payment hasn't been received
// within 7 days, alert the owner.
// ---------------------------------------------------------------------------

async function scanFirstRentMissing(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find active tenancies that started 7-30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: newTenancies, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, lease_start_date, rent_amount, rent_frequency, property_id,
      properties!inner(address_line_1, suburb, state, owner_id),
      tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name))
    `)
    .in('property_id', propertyIds)
    .eq('status', 'active')
    .lte('lease_start_date', sevenDaysAgo.toISOString().split('T')[0])
    .gte('lease_start_date', thirtyDaysAgo.toISOString().split('T')[0]);

  if (tenErr) {
    errors.push(`First rent missing query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  for (const tenancy of newTenancies || []) {
    // Check if any payment has been made
    const { data: payments } = await supabase
      .from('payments')
      .select('id')
      .eq('tenancy_id', tenancy.id)
      .eq('status', 'completed')
      .limit(1);

    if (payments && payments.length > 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'first rent');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantNames = ((tenancy as any).tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');

    const daysSinceStart = Math.floor((Date.now() - new Date(tenancy.lease_start_date).getTime()) / 86400000);

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `No rent received — ${tenantNames || 'new tenant'} at ${property?.suburb || 'property'}`,
      description: `The tenancy at ${address} started ${daysSinceStart} days ago but no rent payments have been received. Rent due: $${tenancy.rent_amount}/${tenancy.rent_frequency}.`,
      category: 'rent_collection',
      status: 'pending_input',
      priority: daysSinceStart > 14 ? 'high' : 'normal',
      recommendation: `No rent has been received since the tenancy began ${daysSinceStart} days ago. Contact ${tenantNames || 'the tenant'} to confirm payment arrangements and check their bank transfer details are correct.`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      deepLink: `/(app)/properties/${tenancy.property_id}`,
      triggerType: 'first_rent_missing',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: `Created first rent missing task (${daysSinceStart} days since start)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: tenancy.lease_start_date,
          action: `Tenancy started (rent $${tenancy.rent_amount}/${tenancy.rent_frequency})`,
          status: 'completed' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: `No payment received after ${daysSinceStart} days`,
          status: 'completed' as const,
          data: { days_since_start: daysSinceStart },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Contact tenant about payment setup',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`First rent missing task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 31: Application Deadline — High-Quality Apps Need Decisions
// When multiple applications are received for the same listing, prompt the
// owner to make a decision before good candidates look elsewhere.
// ---------------------------------------------------------------------------

async function scanApplicationDecisionNeeded(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  // Find listings with multiple submitted applications waiting 5+ days
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: listings, error: listErr } = await supabase
    .from('listings')
    .select(`
      id, title, rent_amount, property_id,
      properties!inner(address_line_1, suburb, state, owner_id)
    `)
    .eq('status', 'active')
    .eq('owner_id', userId);

  if (listErr) {
    errors.push(`Application decision query: ${listErr.message}`);
    return { tasksCreated, errors };
  }

  for (const listing of listings || []) {
    const { data: pendingApps, error: appErr } = await supabase
      .from('applications')
      .select('id, full_name, created_at, status')
      .eq('listing_id', listing.id)
      .in('status', ['submitted', 'under_review'])
      .lt('created_at', fiveDaysAgo)
      .order('created_at', { ascending: true });

    if (appErr || !pendingApps || pendingApps.length === 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, listing.id, 'application decision');
    if (alreadyExists) continue;

    const property = (listing as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const applicantNames = pendingApps.map((a: any) => a.full_name).join(', ');
    const oldestDays = Math.floor((Date.now() - new Date(pendingApps[0].created_at).getTime()) / 86400000);

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `${pendingApps.length} application${pendingApps.length !== 1 ? 's' : ''} awaiting decision — ${property?.suburb || 'property'}`,
      description: `${pendingApps.length} application${pendingApps.length !== 1 ? 's' : ''} for ${address} (${applicantNames}) ${pendingApps.length === 1 ? 'has' : 'have'} been waiting ${oldestDays} days. Good tenants don't wait forever.`,
      category: 'tenant_finding',
      status: 'pending_input',
      priority: oldestDays > 10 ? 'high' : 'normal',
      recommendation: `Review and shortlist applications promptly. Strong applicants typically apply for multiple properties and will move on if they don't hear back quickly. ${pendingApps.length >= 3 ? 'With multiple candidates, you can use our scoring tool to rank them objectively.' : ''}`,
      relatedEntityType: 'listing',
      relatedEntityId: listing.id,
      deepLink: `/(app)/listings/${listing.id}`,
      triggerType: 'application_decision_needed',
      triggerSource: `listing:${listing.id}`,
      actionTaken: `Created application decision task (${pendingApps.length} pending, oldest ${oldestDays} days)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `${pendingApps.length} application${pendingApps.length !== 1 ? 's' : ''} pending for ${oldestDays} days`,
          status: 'completed' as const,
          data: { count: pendingApps.length, oldest_days: oldestDays },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Review, shortlist, or approve applicants',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Application decision task for ${listing.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 32: Missing Key Documents (lease, condition reports)
// Check active tenancies for missing required documents like signed leases
// and entry condition reports.
// ---------------------------------------------------------------------------

async function scanMissingKeyDocuments(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find active tenancies that started more than 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: activeTenancies, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, lease_start_date, property_id,
      properties!inner(address_line_1, suburb, state, owner_id),
      tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name))
    `)
    .in('property_id', propertyIds)
    .eq('status', 'active')
    .lt('lease_start_date', sevenDaysAgo.toISOString().split('T')[0]);

  if (tenErr) {
    errors.push(`Missing documents query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  const requiredDocTypes = ['lease', 'condition_report_entry'];

  for (const tenancy of activeTenancies || []) {
    // Check which document types exist
    const { data: existingDocs } = await supabase
      .from('tenancy_documents')
      .select('document_type')
      .eq('tenancy_id', tenancy.id);

    const existingTypes = new Set((existingDocs || []).map((d: any) => d.document_type));
    const missingTypes = requiredDocTypes.filter(t => !existingTypes.has(t));

    if (missingTypes.length === 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'missing document');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantNames = ((tenancy as any).tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');

    const missingLabels = missingTypes.map(t => t.replace(/_/g, ' ')).join(', ');

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Missing documents — ${address}`,
      description: `The tenancy for ${tenantNames || 'tenant'} at ${address} is missing: ${missingLabels}. These should be uploaded for compliance and record-keeping.`,
      category: 'compliance',
      status: 'pending_input',
      priority: 'normal',
      recommendation: `Upload the missing documents (${missingLabels}) for this tenancy. A signed lease and entry condition report are essential for protecting your interests in any dispute.`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      deepLink: `/(app)/properties/${tenancy.property_id}`,
      triggerType: 'missing_documents',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: `Created missing documents task (${missingTypes.length} missing: ${missingLabels})`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Missing: ${missingLabels}`,
          status: 'completed' as const,
          data: { missing_types: missingTypes },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Upload required documents',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Missing documents task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 33: Proactive Re-Listing Prompt
// When a tenancy ends (status becomes 'ended'), if the property doesn't have
// an active listing, proactively suggest creating one.
// ---------------------------------------------------------------------------

async function scanReListingPrompt(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  const listingsAutonomy = getUserAutonomyForCategory(autonomySettings, 'listings');
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Find recently ended tenancies
  const { data: endedTenancies, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, property_id, actual_end_date, lease_end_date, rent_amount,
      properties!inner(address_line_1, suburb, state, owner_id, bedrooms, bathrooms, property_type)
    `)
    .in('property_id', propertyIds)
    .eq('status', 'ended')
    .gte('actual_end_date', fourteenDaysAgo);

  if (tenErr) {
    errors.push(`Re-listing prompt query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  for (const tenancy of endedTenancies || []) {
    // Check if property already has an active listing
    const { data: existingListing } = await supabase
      .from('listings')
      .select('id')
      .eq('property_id', tenancy.property_id)
      .eq('status', 'active')
      .limit(1);

    if (existingListing && existingListing.length > 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.property_id, 're-list');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const daysSinceEnd = Math.floor((Date.now() - new Date(tenancy.actual_end_date || tenancy.lease_end_date).getTime()) / 86400000);
    const weeklyRent = tenancy.rent_amount || 0;
    const lostRentPerWeek = weeklyRent;

    // Auto-execution: if listings autonomy >= L2, auto-create a draft listing based on previous tenancy data
    const autoCreateListing = listingsAutonomy >= 2 && weeklyRent > 0;

    if (autoCreateListing) {
      const propertyType = (property?.property_type || 'house').replace(/_/g, ' ');
      const beds = property?.bedrooms || 0;
      const baths = property?.bathrooms || 0;
      const suburb = property?.suburb || '';

      await supabase.from('listings').insert({
        property_id: tenancy.property_id,
        owner_id: userId,
        title: `${beds > 0 ? `${beds} Bedroom ` : ''}${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)} in ${suburb}`,
        description: `Available now. This well-maintained ${beds > 0 ? `${beds}-bedroom` : ''} ${propertyType} in ${suburb} is ready for a new tenant. Features include ${baths > 0 ? `${baths} bathroom${baths > 1 ? 's' : ''}, ` : ''}easy access to local amenities and transport.`,
        rent_amount: weeklyRent,
        rent_frequency: 'weekly',
        bond_weeks: 4,
        status: 'draft',
        available_date: new Date().toISOString().split('T')[0],
      });

      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: 're_listing_auto_draft',
        trigger_source: `property:${tenancy.property_id}`,
        action_taken: `Auto-created draft listing for ${address} at $${weeklyRent}/week (property vacant ${daysSinceEnd} days)`,
        tool_name: 'create_listing_draft',
        tool_params: { property_id: tenancy.property_id, rent: weeklyRent },
        result: { status: 'draft_created' },
        was_auto_executed: true,
      }).then(() => {});
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: autoCreateListing
        ? `Draft listing created — ${address}`
        : `Time to re-list — ${address}`,
      description: autoCreateListing
        ? `The tenancy at ${address} ended ${daysSinceEnd} days ago. A draft listing has been automatically created at $${weeklyRent}/week. Review, edit photos/description, and publish to start finding tenants.`
        : `The tenancy at ${address} ended ${daysSinceEnd} days ago and no new listing has been created. Every week without a listing costs approximately $${lostRentPerWeek} in lost rent.`,
      category: 'listings',
      status: autoCreateListing ? 'in_progress' : 'pending_input',
      priority: daysSinceEnd > 7 ? 'high' : 'normal',
      recommendation: autoCreateListing
        ? `A draft listing has been created. To publish:\n1. Review and enhance the listing description\n2. Upload property photos\n3. Confirm the rent amount ($${weeklyRent}/week)\n4. Publish to start receiving applications`
        : `Create a new listing for ${address}. I can generate an AI-powered listing description based on the property details${property?.bedrooms ? ` (${property.bedrooms} bed, ${property.bathrooms || '?'} bath ${(property.property_type || 'property').replace(/_/g, ' ')})` : ''}. Would you like me to draft one?`,
      relatedEntityType: 'property',
      relatedEntityId: tenancy.property_id,
      deepLink: autoCreateListing ? `/(app)/(tabs)/properties/${tenancy.property_id}` : `/(app)/listings/create?propertyId=${tenancy.property_id}`,
      triggerType: 're_listing_prompt',
      triggerSource: `property:${tenancy.property_id}`,
      actionTaken: autoCreateListing
        ? `Auto-created draft listing at $${weeklyRent}/wk (autonomy L${listingsAutonomy})`
        : `Created re-listing prompt (${daysSinceEnd} days since tenancy ended)`,
      wasAutoExecuted: autoCreateListing,
      timelineEntries: [
        {
          timestamp: tenancy.actual_end_date || tenancy.lease_end_date,
          action: `Tenancy ended at ${address}`,
          status: 'completed' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoCreateListing
            ? `Draft listing created at $${weeklyRent}/week`
            : `Property vacant ${daysSinceEnd} days (~$${lostRentPerWeek * Math.ceil(daysSinceEnd / 7)} lost rent)`,
          status: autoCreateListing ? 'completed' as const : 'completed' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoCreateListing ? 'Review, add photos, and publish listing' : 'Create listing and advertise property',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Re-listing prompt task for ${tenancy.property_id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 34: Maintenance Completed — Satisfaction & Follow-Up
// When a maintenance request is marked completed, prompt the owner to
// verify quality and close the loop with the tenant.
// ---------------------------------------------------------------------------

async function scanMaintenanceCompletedFollowUp(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: completedRequests, error: reqErr } = await supabase
    .from('maintenance_requests')
    .select(`
      id, title, category, urgency, status, status_changed_at,
      actual_cost, estimated_cost, trade_id,
      property_id, tenant_id,
      properties!inner(address_line_1, suburb, state, owner_id),
      profiles:tenant_id(full_name),
      trades(business_name)
    `)
    .in('property_id', propertyIds)
    .eq('status', 'completed')
    .gte('status_changed_at', fortyEightHoursAgo);

  if (reqErr) {
    errors.push(`Maintenance completed follow-up query: ${reqErr.message}`);
    return { tasksCreated, errors };
  }

  for (const req of completedRequests || []) {
    const alreadyExists = await taskExistsForEntity(supabase, userId, req.id, 'completed follow');
    if (alreadyExists) continue;

    const property = (req as any).properties;
    const tenant = (req as any).profiles;
    const trade = (req as any).trades;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantName = tenant?.full_name || 'Tenant';
    const tradeName = trade?.business_name || 'the tradesperson';

    const costInfo = req.actual_cost
      ? `Actual cost: $${req.actual_cost}.${req.estimated_cost ? ` (Estimated: $${req.estimated_cost})` : ''}`
      : (req.estimated_cost ? `Estimated cost: $${req.estimated_cost}.` : '');

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Maintenance completed — ${req.title}`,
      description: `"${req.title}" at ${address} has been marked as completed by ${tradeName}. ${costInfo} Verify the work quality and confirm with ${tenantName}.`,
      category: 'maintenance',
      status: 'pending_input',
      priority: 'low',
      recommendation: `The maintenance work is done. Consider:\n1. Ask ${tenantName} if they're satisfied with the repair\n2. Review the invoice from ${tradeName}\n3. ${trade ? `Rate ${tradeName} for future reference` : 'Save this trade for future jobs'}\n4. Record the expense for tax purposes`,
      relatedEntityType: 'maintenance_request',
      relatedEntityId: req.id,
      deepLink: `/(app)/maintenance/${req.id}`,
      triggerType: 'maintenance_completed',
      triggerSource: `maintenance_request:${req.id}`,
      actionTaken: `Created maintenance completion follow-up (${req.title})`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: req.status_changed_at || new Date().toISOString(),
          action: `"${req.title}" marked completed by ${tradeName}`,
          status: 'completed' as const,
          data: { actual_cost: req.actual_cost, trade: tradeName },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Verify work quality and close with tenant',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Maintenance completed task for ${req.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 35: Rent Increase Notice Preparation
// When a rent review task exists and is approaching the notice period deadline,
// proactively prepare a draft rent increase notice.
// ---------------------------------------------------------------------------

async function scanRentIncreasePrep(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  const financialAutonomy = getUserAutonomyForCategory(autonomySettings, 'financial');
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  // Find tenancies approaching their 12-month anniversary (11-12 months old)
  // where no rent increase notice has been issued
  const { data: eligibleTenancies, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, lease_start_date, lease_end_date, rent_amount, rent_frequency, is_periodic,
      property_id,
      properties!inner(address_line_1, suburb, state, postcode, owner_id, bedrooms),
      tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name))
    `)
    .in('property_id', propertyIds)
    .eq('status', 'active');

  if (tenErr) {
    errors.push(`Rent increase prep query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  for (const tenancy of eligibleTenancies || []) {
    const monthsSinceStart = Math.floor((Date.now() - new Date(tenancy.lease_start_date).getTime()) / (1000 * 60 * 60 * 24 * 30));

    // Only process if approaching 12-month mark (between 10-12 months) and is periodic or lease is expiring
    const leaseEndDate = tenancy.lease_end_date ? new Date(tenancy.lease_end_date) : null;
    const daysUntilLeaseEnd = leaseEndDate ? Math.floor((leaseEndDate.getTime() - Date.now()) / 86400000) : 999;
    const isApproachingRenewal = daysUntilLeaseEnd <= 90 && daysUntilLeaseEnd > 0;

    if (monthsSinceStart < 10 && !isApproachingRenewal) continue;

    // Check for existing rent increases
    const { data: existingIncreases } = await supabase
      .from('rent_increases')
      .select('id')
      .eq('tenancy_id', tenancy.id)
      .not('status', 'eq', 'cancelled')
      .limit(1);

    // If there's already a rent increase in progress, skip
    if (existingIncreases && existingIncreases.length > 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'rent increase prep');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantNames = ((tenancy as any).tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');

    const state = property?.state || 'QLD';
    const noticeDays: Record<string, number> = { NSW: 60, VIC: 60, QLD: 60, SA: 60, WA: 60, TAS: 60, NT: 30, ACT: 60 };
    const requiredNotice = noticeDays[state] || 60;

    // Auto-execution: if financial autonomy >= L2, auto-create a draft rent increase record with CPI-based increase
    const cpiIncrease = 0.035; // 3.5% CPI-aligned increase (conservative default)
    const currentRent = Number(tenancy.rent_amount || 0);
    const suggestedNewRent = Math.round(currentRent * (1 + cpiIncrease));
    const autoCreateDraft = financialAutonomy >= 2 && currentRent > 0;

    if (autoCreateDraft) {
      // Create a draft rent increase record
      await supabase.from('rent_increases').insert({
        tenancy_id: tenancy.id,
        property_id: tenancy.property_id,
        current_rent: currentRent,
        proposed_rent: suggestedNewRent,
        increase_percentage: cpiIncrease * 100,
        increase_reason: 'CPI-aligned annual adjustment',
        notice_period_days: requiredNotice,
        status: 'draft',
        created_by: userId,
      });

      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: 'rent_increase_auto_draft',
        trigger_source: `tenancy:${tenancy.id}`,
        action_taken: `Auto-drafted rent increase: $${currentRent} → $${suggestedNewRent}/week (+${(cpiIncrease * 100).toFixed(1)}% CPI) for ${address}. ${requiredNotice}-day notice required.`,
        tool_name: 'draft_rent_increase',
        tool_params: { tenancy_id: tenancy.id, current: currentRent, proposed: suggestedNewRent },
        result: { status: 'draft_created' },
        was_auto_executed: true,
      }).then(() => {});
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: autoCreateDraft
        ? `Rent increase drafted — ${address} ($${currentRent}→$${suggestedNewRent}/wk)`
        : `Consider rent increase — ${address}`,
      description: autoCreateDraft
        ? `A CPI-aligned rent increase draft has been prepared for ${address} (${tenantNames || 'tenant'}): $${currentRent} → $${suggestedNewRent}/${tenancy.rent_frequency} (+${(cpiIncrease * 100).toFixed(1)}%). ${state} requires ${requiredNotice} days notice. Review and approve to send.`
        : `Tenancy at ${address} (${tenantNames || 'tenant'}) has been active for ${monthsSinceStart} months at $${tenancy.rent_amount}/${tenancy.rent_frequency}. ${state} requires ${requiredNotice} days notice for rent increases.${isApproachingRenewal ? ` Lease expires in ${daysUntilLeaseEnd} days.` : ''}`,
      category: 'financial',
      status: autoCreateDraft ? 'in_progress' : 'pending_input',
      priority: 'normal',
      recommendation: autoCreateDraft
        ? `A draft rent increase of $${currentRent} → $${suggestedNewRent}/week (+${(cpiIncrease * 100).toFixed(1)}% CPI) is ready for your review. You need to:\n1. Review the proposed amount against local market rates\n2. Approve and send the ${requiredNotice}-day notice to ${tenantNames || 'the tenant'}\n3. Update the rent schedule once the notice period expires`
        : `If you'd like to increase the rent, you need to serve a ${requiredNotice}-day written notice. I can:\n1. Check market rents for comparable properties in ${property?.suburb || 'the area'}\n2. Draft a rent increase notice compliant with ${state} law\n3. Calculate the new rent based on market data\n\nWould you like me to research the current market rate for ${property?.bedrooms || '?'}-bedroom properties in ${property?.suburb || 'the area'}?`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      deepLink: `/(app)/properties/${tenancy.property_id}`,
      triggerType: 'rent_increase_preparation',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: autoCreateDraft
        ? `Auto-drafted CPI rent increase $${currentRent}→$${suggestedNewRent} (autonomy L${financialAutonomy})`
        : `Created rent increase preparation task (${monthsSinceStart} months, no increase on record)`,
      wasAutoExecuted: autoCreateDraft,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `${monthsSinceStart} months at $${tenancy.rent_amount}/${tenancy.rent_frequency} — no increase on record`,
          status: 'completed' as const,
          data: { months: monthsSinceStart, current_rent: tenancy.rent_amount },
        },
        {
          timestamp: new Date().toISOString(),
          action: autoCreateDraft
            ? `Draft increase prepared: $${currentRent} → $${suggestedNewRent}/wk (+${(cpiIncrease * 100).toFixed(1)}%)`
            : `Research market rents in ${property?.suburb || 'area'}`,
          status: autoCreateDraft ? 'completed' as const : 'current' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoCreateDraft
            ? `Review and approve ${requiredNotice}-day notice`
            : `Draft ${requiredNotice}-day rent increase notice`,
          status: autoCreateDraft ? 'current' as const : 'pending' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Rent increase prep task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 36: Weekly Performance Digest — Listing Views & Enquiries
// For active listings, surface a weekly digest showing view trends,
// application count, and suggested optimizations.
// ---------------------------------------------------------------------------

async function scanListingWeeklyDigest(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  // Only run on Mondays (approximate — check if it's been 7+ days since last digest)
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek !== 1) return { tasksCreated, errors }; // Only Monday

  const { data: activeListings, error: listErr } = await supabase
    .from('listings')
    .select(`
      id, title, rent_amount, rent_frequency, view_count, enquiry_count,
      application_count, published_at, status, property_id,
      properties!inner(address_line_1, suburb, state, owner_id)
    `)
    .eq('status', 'active')
    .eq('owner_id', userId);

  if (listErr) {
    errors.push(`Listing weekly digest query: ${listErr.message}`);
    return { tasksCreated, errors };
  }

  if (!activeListings || activeListings.length === 0) return { tasksCreated, errors };

  // Create one digest task for all active listings
  const digestEntityId = await deterministicUuid(`digest-${new Date().toISOString().split('T')[0]}`);
  const alreadyExists = await taskExistsForEntity(supabase, userId, digestEntityId, 'weekly digest');
  if (alreadyExists) return { tasksCreated, errors };

  const listingSummaries = activeListings.map((l: any) => {
    const property = l.properties;
    const address = property?.suburb || property?.address_line_1 || 'Property';
    const daysSincePublished = Math.floor((Date.now() - new Date(l.published_at).getTime()) / 86400000);
    return `• ${address}: ${l.view_count || 0} views, ${l.enquiry_count || 0} enquiries, ${l.application_count || 0} applications (${daysSincePublished} days live)`;
  }).join('\n');

  const totalViews = activeListings.reduce((sum: number, l: any) => sum + (l.view_count || 0), 0);
  const totalApps = activeListings.reduce((sum: number, l: any) => sum + (l.application_count || 0), 0);

  const { error } = await createTaskAndLog(supabase, {
    userId,
    title: `Weekly listing digest — ${activeListings.length} active listing${activeListings.length !== 1 ? 's' : ''}`,
    description: `Your active listings this week:\n\n${listingSummaries}\n\nTotal: ${totalViews} views, ${totalApps} applications across ${activeListings.length} listing${activeListings.length !== 1 ? 's' : ''}.`,
    category: 'listings',
    status: 'completed',
    priority: 'low',
    recommendation: totalApps === 0
      ? `No applications received this week. Consider updating listing descriptions, improving photos, or adjusting rent prices.`
      : `${totalApps} application${totalApps !== 1 ? 's' : ''} received. Review and process them promptly to secure the best tenants.`,
    relatedEntityType: 'listing',
    relatedEntityId: activeListings[0].id,
    triggerType: 'listing_weekly_digest',
    triggerSource: 'scheduler',
    actionTaken: `Created weekly listing digest (${activeListings.length} listings, ${totalViews} views, ${totalApps} apps)`,
    wasAutoExecuted: true,
    timelineEntries: [
      {
        timestamp: new Date().toISOString(),
        action: `Weekly summary: ${totalViews} views, ${totalApps} applications`,
        status: 'completed' as const,
        data: { listings_count: activeListings.length, total_views: totalViews, total_applications: totalApps },
      },
    ],
  });

  if (error) {
    errors.push(`Listing weekly digest: ${error}`);
  } else {
    tasksCreated++;
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 37: Utility Transfer Reminder — End/Start of Tenancy
// When a tenancy is about to start or end, remind the owner about
// utility meter readings and transfers.
// ---------------------------------------------------------------------------

async function scanUtilityTransferReminder(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
  autonomySettings: AutonomySettings | null = null,
): Promise<{ tasksCreated: number; errors: string[] }> {
  const leaseAutonomy = getUserAutonomyForCategory(autonomySettings, 'lease_management');
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const today = new Date();
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Find tenancies starting or ending in the next 7 days
  const { data: upcomingChanges, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, lease_start_date, lease_end_date, actual_end_date, status,
      property_id,
      properties!inner(address_line_1, suburb, state, owner_id),
      tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name))
    `)
    .in('property_id', propertyIds)
    .or(`lease_start_date.gte.${today.toISOString().split('T')[0]},lease_end_date.lte.${sevenDaysFromNow.toISOString().split('T')[0]}`);

  if (tenErr) {
    errors.push(`Utility transfer reminder query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  for (const tenancy of upcomingChanges || []) {
    const isStarting = new Date(tenancy.lease_start_date) >= today && new Date(tenancy.lease_start_date) <= sevenDaysFromNow;
    const isEnding = tenancy.lease_end_date && new Date(tenancy.lease_end_date) >= today && new Date(tenancy.lease_end_date) <= sevenDaysFromNow;

    if (!isStarting && !isEnding) continue;
    if (tenancy.status === 'ended' || tenancy.status === 'terminated') continue;

    const triggerType = isEnding ? 'utility_transfer_end' : 'utility_transfer_start';
    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'utility transfer');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantNames = ((tenancy as any).tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');

    const changeDate = isEnding ? tenancy.lease_end_date : tenancy.lease_start_date;
    const daysUntil = Math.floor((new Date(changeDate).getTime() - today.getTime()) / 86400000);

    // Auto-execution: if lease autonomy >= L2, auto-send utility reminder to tenant
    const primaryTenantData = ((tenancy as any).tenancy_tenants || []).find((tt: any) => tt.is_primary);
    const tenantEmail = primaryTenantData?.profiles?.email;
    const autoNotify = leaseAutonomy >= 2 && !!tenantEmail;

    if (autoNotify) {
      await supabase.from('email_queue').insert({
        to_email: tenantEmail,
        to_name: tenantNames || 'Tenant',
        subject: `Utility Transfer Reminder — ${address}`,
        template_name: isEnding ? 'utility_disconnect_reminder' : 'utility_connect_reminder',
        template_data: {
          tenant_name: tenantNames || 'Tenant',
          property_address: address,
          change_date: changeDate,
          days_until: daysUntil,
          is_ending: isEnding,
        },
        status: 'pending',
      });

      await supabase.from('agent_proactive_actions').insert({
        user_id: userId,
        trigger_type: triggerType,
        trigger_source: `tenancy:${tenancy.id}`,
        action_taken: `Auto-sent utility transfer reminder to ${tenantNames} (${tenantEmail}) — ${isEnding ? 'disconnection' : 'connection'} needed by ${changeDate}`,
        tool_name: 'send_utility_reminder',
        tool_params: { tenancy_id: tenancy.id, type: isEnding ? 'disconnect' : 'connect' },
        result: { status: 'email_queued' },
        was_auto_executed: true,
      }).then(() => {});
    }

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Utility transfer${autoNotify ? ' — tenant notified' : ' needed'} — ${address}`,
      description: autoNotify
        ? `Tenancy ${isEnding ? 'ending' : 'starting'} at ${address} in ${daysUntil} days. A utility transfer reminder has been sent to ${tenantNames}.`
        : `Tenancy ${isEnding ? 'ending' : 'starting'} at ${address} in ${daysUntil} days (${changeDate}). Arrange utility meter readings and account transfers.`,
      category: 'lease_management',
      status: autoNotify ? 'in_progress' : 'pending_input',
      priority: daysUntil <= 3 ? 'high' : 'normal',
      recommendation: autoNotify
        ? `Tenant has been notified about utility transfers. Ensure you also:\n1. Contact utility providers to arrange meter readings\n2. ${isEnding ? 'Transfer accounts back to owner name' : 'Verify connections are set up in tenant name'}`
        : isEnding
          ? `Before ${tenantNames || 'the tenant'} vacates:\n1. Arrange final meter readings (electricity, gas, water)\n2. Notify utility providers of tenant departure\n3. Transfer accounts back to owner name (or to new tenant)\n4. Arrange mail redirection if needed`
          : `Before ${tenantNames || 'the new tenant'} moves in:\n1. Arrange opening meter readings\n2. Set up utility connections in tenant's name\n3. Provide utility provider contact details\n4. Ensure all services are connected`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      triggerType,
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: autoNotify
        ? `Auto-sent utility transfer reminder (autonomy L${leaseAutonomy})`
        : `Created utility transfer reminder (${isEnding ? 'ending' : 'starting'} in ${daysUntil} days)`,
      wasAutoExecuted: autoNotify,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Tenancy ${isEnding ? 'ending' : 'starting'} ${changeDate} (${daysUntil} days)`,
          status: 'completed' as const,
        },
        {
          timestamp: new Date().toISOString(),
          action: autoNotify ? 'Utility reminder sent to tenant' : 'Arrange meter readings and utility transfers',
          status: autoNotify ? 'completed' as const : 'current' as const,
        },
        ...(autoNotify ? [{
          timestamp: new Date().toISOString(),
          action: 'Verify utility transfers completed',
          status: 'current' as const,
        }] : []),
      ],
    });

    if (error) {
      errors.push(`Utility transfer task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 38: Upcoming Inspection Reminder
// For properties with next_inspection_due approaching within 14 days,
// remind the owner to prepare and confirm with the tenant.
// ---------------------------------------------------------------------------

async function scanUpcomingInspectionReminder(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const today = new Date().toISOString().split('T')[0];
  const fourteenDaysFromNow = new Date();
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
  const futureStr = fourteenDaysFromNow.toISOString().split('T')[0];

  // Find properties with upcoming inspection due dates
  const { data: upcomingProperties, error: propErr } = await supabase
    .from('properties')
    .select(`
      id, address_line_1, suburb, state, next_inspection_due, last_inspection_at,
      inspection_interval_months
    `)
    .in('id', propertyIds)
    .eq('status', 'occupied')
    .is('deleted_at', null)
    .not('next_inspection_due', 'is', null)
    .lte('next_inspection_due', futureStr)
    .gte('next_inspection_due', today);

  if (propErr) {
    errors.push(`Upcoming inspection reminder query: ${propErr.message}`);
    return { tasksCreated, errors };
  }

  for (const property of upcomingProperties || []) {
    // Check if an inspection is already scheduled for this property
    const { data: scheduledInsp } = await supabase
      .from('inspections')
      .select('id')
      .eq('property_id', property.id)
      .in('status', ['scheduled', 'in_progress'])
      .gte('scheduled_date', today)
      .limit(1);

    if (scheduledInsp && scheduledInsp.length > 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, property.id, 'upcoming inspection');
    if (alreadyExists) continue;

    const address = [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ');
    const daysUntilDue = Math.floor((new Date(property.next_inspection_due).getTime() - Date.now()) / 86400000);
    const lastInsp = property.last_inspection_at
      ? new Date(property.last_inspection_at).toLocaleDateString('en-AU')
      : 'never';

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Inspection due in ${daysUntilDue} days — ${address}`,
      description: `The next routine inspection at ${address} is due on ${property.next_inspection_due}. Last inspection: ${lastInsp}.`,
      category: 'inspections',
      status: 'pending_input',
      priority: daysUntilDue <= 3 ? 'high' : 'normal',
      recommendation: `Schedule the routine inspection soon. In most states you must give the tenant ${property.state === 'QLD' ? '48 hours' : '7 days'} notice. Would you like me to schedule it and notify the tenant?`,
      relatedEntityType: 'property',
      relatedEntityId: property.id,
      deepLink: `/(app)/properties/${property.id}`,
      triggerType: 'upcoming_inspection_due',
      triggerSource: `property:${property.id}`,
      actionTaken: `Created upcoming inspection reminder (${daysUntilDue} days)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Inspection due ${property.next_inspection_due} (${daysUntilDue} days). Last: ${lastInsp}`,
          status: 'completed' as const,
          data: { days_until_due: daysUntilDue, next_due: property.next_inspection_due },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Schedule inspection and notify tenant',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Upcoming inspection task for ${property.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 39: Periodic Tenancy Rent Adjustment Window
// For periodic tenancies, detect when the last rent increase was 12+ months
// ago and suggest a CPI-aligned rent review.
// ---------------------------------------------------------------------------

async function scanPeriodicRentAdjustment(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const { data: periodicTenancies, error: tenErr } = await supabase
    .from('tenancies')
    .select(`
      id, lease_start_date, rent_amount, rent_frequency, is_periodic, property_id,
      properties!inner(address_line_1, suburb, state, owner_id),
      tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name))
    `)
    .in('property_id', propertyIds)
    .eq('status', 'active')
    .eq('is_periodic', true);

  if (tenErr) {
    errors.push(`Periodic rent adjustment query: ${tenErr.message}`);
    return { tasksCreated, errors };
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  for (const tenancy of periodicTenancies || []) {
    // Check for recent rent increases
    const { data: recentIncreases } = await supabase
      .from('rent_increases')
      .select('id, effective_date, new_amount')
      .eq('tenancy_id', tenancy.id)
      .gte('effective_date', twelveMonthsAgo.toISOString().split('T')[0])
      .not('status', 'eq', 'cancelled')
      .limit(1);

    if (recentIncreases && recentIncreases.length > 0) continue;

    const alreadyExists = await taskExistsForEntity(supabase, userId, tenancy.id, 'periodic rent');
    if (alreadyExists) continue;

    const property = (tenancy as any).properties;
    const address = [property?.address_line_1, property?.suburb, property?.state].filter(Boolean).join(', ');
    const tenantNames = ((tenancy as any).tenancy_tenants || [])
      .map((tt: any) => tt.profiles?.full_name)
      .filter(Boolean)
      .join(', ');
    const monthsSinceStart = Math.floor((Date.now() - new Date(tenancy.lease_start_date).getTime()) / (1000 * 60 * 60 * 24 * 30));

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Periodic tenancy rent review — ${address}`,
      description: `${tenantNames || 'Tenant'} at ${address} is on a periodic tenancy at $${tenancy.rent_amount}/${tenancy.rent_frequency}. No rent increase in 12+ months. Tenancy duration: ${monthsSinceStart} months.`,
      category: 'financial',
      status: 'pending_input',
      priority: 'normal',
      recommendation: `Periodic tenancies allow rent increases every 12 months with 60 days notice (varies by state). Consider a CPI-aligned increase to keep pace with the market. I can research comparable rents in ${property?.suburb || 'the area'} to help you decide.`,
      relatedEntityType: 'tenancy',
      relatedEntityId: tenancy.id,
      deepLink: `/(app)/properties/${tenancy.property_id}`,
      triggerType: 'periodic_rent_review',
      triggerSource: `tenancy:${tenancy.id}`,
      actionTaken: `Created periodic rent review task (${monthsSinceStart} months, no increase in 12+)`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Periodic tenancy at $${tenancy.rent_amount}/${tenancy.rent_frequency} — no increase in 12+ months`,
          status: 'completed' as const,
          data: { months_active: monthsSinceStart, current_rent: tenancy.rent_amount },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Research market rates and consider increase',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Periodic rent adjustment task for ${tenancy.id}: ${error}`);
    } else {
      tasksCreated++;
    }
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 40: Property Tax & Financial Year Prep
// Near end of financial year (April-June in Australia), prompt owners
// to review expenses and prepare for tax.
// ---------------------------------------------------------------------------

async function scanFinancialYearPrep(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0=Jan ... 5=June

  // Only run in May-June (Australian FY ends June 30)
  if (month !== 4 && month !== 5) return { tasksCreated, errors };

  const fyEndDate = `${now.getFullYear()}-06-30`;
  const daysUntilFyEnd = Math.floor((new Date(fyEndDate).getTime() - now.getTime()) / 86400000);

  const fyEntityId = await deterministicUuid(`fy-${now.getFullYear()}`);
  const alreadyExists = await taskExistsForEntity(supabase, userId, fyEntityId, 'financial year');
  if (alreadyExists) return { tasksCreated, errors };

  // Count properties and get summary data
  const propertyCount = propertyIds.length;

  // Count expenses for the current FY
  const fyStart = `${now.getFullYear() - 1}-07-01`;
  const { count: expenseCount } = await supabase
    .from('manual_expenses')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gte('expense_date', fyStart)
    .lte('expense_date', fyEndDate);

  const { error } = await createTaskAndLog(supabase, {
    userId,
    title: `End of financial year preparation — ${daysUntilFyEnd} days remaining`,
    description: `The Australian financial year ends on June 30 (${daysUntilFyEnd} days away). You have ${propertyCount} propert${propertyCount !== 1 ? 'ies' : 'y'} with ${expenseCount || 0} expenses recorded this financial year.`,
    category: 'financial',
    status: 'pending_input',
    priority: daysUntilFyEnd <= 14 ? 'high' : 'normal',
    recommendation: `Before June 30:\n1. Review all property expenses are recorded (repairs, insurance, rates, management fees)\n2. Check depreciation schedules are up to date\n3. Ensure all rental income is accounted for\n4. Record any outstanding deductible expenses\n5. Prepare documents for your accountant\n\nI can generate a financial summary for each property to assist with your tax return.`,
    relatedEntityType: 'profile',
    relatedEntityId: userId,
    triggerType: 'financial_year_prep',
    triggerSource: 'scheduler',
    actionTaken: `Created FY prep task (${daysUntilFyEnd} days to June 30, ${propertyCount} properties)`,
    wasAutoExecuted: false,
    timelineEntries: [
      {
        timestamp: new Date().toISOString(),
        action: `FY ends in ${daysUntilFyEnd} days (June 30)`,
        status: 'completed' as const,
        data: { days_remaining: daysUntilFyEnd, properties: propertyCount, expenses_recorded: expenseCount || 0 },
      },
      {
        timestamp: new Date().toISOString(),
        action: 'Review and record all property expenses',
        status: 'current' as const,
      },
      {
        timestamp: new Date().toISOString(),
        action: 'Generate financial summaries for tax return',
        status: 'pending' as const,
      },
    ],
  });

  if (error) {
    errors.push(`Financial year prep task: ${error}`);
  } else {
    tasksCreated++;
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 41: Proactive Intelligence — Learned Pattern Suggestions
// Analyses past agent trajectories and owner actions to detect repeating
// patterns and suggest automating them or raising autonomy.
// ---------------------------------------------------------------------------

async function scanLearnedPatterns(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  try {
    // Get recent successful trajectories (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: trajectories } = await supabase
      .from('agent_trajectories')
      .select('tool_sequence, efficiency_score, created_at')
      .eq('user_id', userId)
      .eq('success', true)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (!trajectories || trajectories.length < 5) return { tasksCreated, errors };

    // Detect repeating tool patterns (group by first tool in sequence)
    const patternCounts: Record<string, { count: number; avgScore: number; totalScore: number; example: string }> = {};
    for (const t of trajectories) {
      const seq = t.tool_sequence;
      if (!Array.isArray(seq) || seq.length === 0) continue;
      const patternKey = seq.map((s: any) => s.name).join(' → ');
      if (!patternCounts[patternKey]) {
        patternCounts[patternKey] = { count: 0, avgScore: 0, totalScore: 0, example: patternKey };
      }
      patternCounts[patternKey].count++;
      patternCounts[patternKey].totalScore += (t.efficiency_score || 0.5);
    }

    // Find patterns that repeat 3+ times with good efficiency
    const frequentPatterns = Object.values(patternCounts)
      .filter(p => p.count >= 3)
      .map(p => ({ ...p, avgScore: p.totalScore / p.count }))
      .sort((a, b) => b.count - a.count);

    if (frequentPatterns.length === 0) return { tasksCreated, errors };

    // Check if we already have a proactive pattern task
    const patternEntityId = await deterministicUuid(`pattern-insight-${new Date().toISOString().slice(0, 7)}`);
    const alreadyExists = await taskExistsForEntity(
      supabase,
      userId,
      patternEntityId,
      'proactive_pattern',
    );
    if (alreadyExists) return { tasksCreated, errors };

    // Build insight summary
    const topPattern = frequentPatterns[0];
    const insightDescription = frequentPatterns.length === 1
      ? `I've noticed you frequently use this workflow: ${topPattern.example} (${topPattern.count} times in the last 30 days). Would you like me to handle this automatically in future?`
      : `I've identified ${frequentPatterns.length} recurring workflows in your usage:\n${frequentPatterns.slice(0, 3).map((p, i) => `${i + 1}. ${p.example} (${p.count} times)`).join('\n')}\n\nConsider upgrading autonomy for these categories so I can handle them without asking each time.`;

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: 'Efficiency insight: Recurring workflows detected',
      description: insightDescription,
      category: 'general',
      status: 'pending_input',
      priority: 'low',
      recommendation: `Based on your usage patterns, I suggest reviewing your autonomy settings. You could save time by letting me handle these common tasks automatically. Visit Settings → Agent Autonomy to adjust.`,
      relatedEntityType: 'profile',
      relatedEntityId: patternEntityId,
      triggerType: 'proactive_pattern',
      triggerSource: 'trajectory_analysis',
      actionTaken: `Detected ${frequentPatterns.length} recurring tool patterns from ${trajectories.length} trajectories`,
      wasAutoExecuted: false,
      timelineEntries: [
        {
          timestamp: new Date().toISOString(),
          action: `Analysed ${trajectories.length} recent trajectories`,
          status: 'completed' as const,
          data: {
            total_trajectories: trajectories.length,
            recurring_patterns: frequentPatterns.length,
            top_pattern: topPattern.example,
            top_pattern_count: topPattern.count,
          },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'Awaiting owner decision on autonomy adjustment',
          status: 'current' as const,
        },
      ],
    });

    if (error) {
      errors.push(`Learned patterns task: ${error}`);
    } else {
      tasksCreated++;
    }
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'Unknown error in pattern scanner';
    errors.push(`Learned patterns scanner: ${msg}`);
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 42: Proactive Intelligence — Anomaly Detection
// Detects unusual patterns in payments, maintenance costs, or vacancy rates.
// ---------------------------------------------------------------------------

async function scanDataAnomalies(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  try {
    // Check for properties that have been vacant for unusually long
    const { data: vacantProperties } = await supabase
      .from('properties')
      .select('id, address_line_1, suburb, state, status, updated_at')
      .eq('owner_id', userId)
      .eq('status', 'vacant')
      .is('deleted_at', null);

    for (const prop of (vacantProperties || [])) {
      const vacantSince = new Date(prop.updated_at);
      const daysSinceVacant = Math.floor((Date.now() - vacantSince.getTime()) / 86400000);

      // Flag if vacant for 60+ days — unusual and worth highlighting
      if (daysSinceVacant < 60) continue;

      const alreadyExists = await taskExistsForEntity(supabase, userId, prop.id, 'vacancy_anomaly');
      if (alreadyExists) continue;

      const address = [prop.address_line_1, prop.suburb, prop.state].filter(Boolean).join(', ');

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Extended vacancy alert: ${address}`,
        description: `${address} has been vacant for ${daysSinceVacant} days. This is above average vacancy periods. Consider reviewing your listing price or marketing strategy.`,
        category: 'financial',
        status: 'pending_input',
        priority: daysSinceVacant > 90 ? 'high' : 'normal',
        recommendation: `Extended vacancies cost you rent. For a property vacant ${daysSinceVacant} days, consider:\n1. Review the listing price against current market rates\n2. Refresh listing photos and description\n3. Consider offering incentives (e.g., 1 week free rent)\n4. Broaden marketing reach\n\nI can analyse market rents for the area and suggest adjustments.`,
        relatedEntityType: 'property',
        relatedEntityId: prop.id,
        deepLink: `/(app)/(tabs)/properties/${prop.id}`,
        triggerType: 'vacancy_anomaly',
        triggerSource: `property:${prop.id}`,
        actionTaken: `Flagged extended vacancy (${daysSinceVacant} days)`,
        wasAutoExecuted: false,
        timelineEntries: [
          {
            timestamp: new Date().toISOString(),
            action: `Property vacant for ${daysSinceVacant} days`,
            status: 'completed' as const,
            data: { days_vacant: daysSinceVacant, property_address: address },
          },
          {
            timestamp: new Date().toISOString(),
            action: 'Awaiting owner review of vacancy strategy',
            status: 'current' as const,
          },
        ],
      });

      if (error) {
        errors.push(`Vacancy anomaly for ${prop.id}: ${error}`);
      } else {
        tasksCreated++;
      }
    }

    // Check for unusual maintenance cost spikes
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const threeMonthsPrior = new Date();
    threeMonthsPrior.setDate(threeMonthsPrior.getDate() - 180);

    const { data: recentMaintenance } = await supabase
      .from('maintenance_requests')
      .select('estimated_cost')
      .in('property_id', propertyIds)
      .gte('created_at', ninetyDaysAgo.toISOString());

    const { data: olderMaintenance } = await supabase
      .from('maintenance_requests')
      .select('estimated_cost')
      .in('property_id', propertyIds)
      .gte('created_at', threeMonthsPrior.toISOString())
      .lt('created_at', ninetyDaysAgo.toISOString());

    const recentCost = (recentMaintenance || []).reduce((sum: number, m: any) => sum + (m.estimated_cost || 0), 0);
    const olderCost = (olderMaintenance || []).reduce((sum: number, m: any) => sum + (m.estimated_cost || 0), 0);

    if (olderCost > 0 && recentCost > olderCost * 1.5 && recentCost > 500) {
      const maintSpikeEntityId = await deterministicUuid(`maint-spike-${new Date().toISOString().slice(0, 7)}`);
      const alreadyExists = await taskExistsForEntity(
        supabase, userId,
        maintSpikeEntityId,
        'maintenance_spike',
      );

      if (!alreadyExists) {
        const increase = Math.round(((recentCost - olderCost) / olderCost) * 100);
        const { error } = await createTaskAndLog(supabase, {
          userId,
          title: `Maintenance costs up ${increase}% this quarter`,
          description: `Maintenance spending has increased from $${olderCost.toFixed(0)} to $${recentCost.toFixed(0)} compared to the previous quarter. This may indicate ageing property issues or recurring problems.`,
          category: 'financial',
          status: 'pending_input',
          priority: 'normal',
          recommendation: `Review recent maintenance requests to identify:\n1. Properties with repeated issues (may need major repair)\n2. Trades charging above market rates\n3. Preventive maintenance opportunities to reduce future costs`,
          relatedEntityType: 'profile',
          relatedEntityId: maintSpikeEntityId,
          triggerType: 'maintenance_spike',
          triggerSource: 'cost_analysis',
          actionTaken: `Flagged ${increase}% maintenance cost increase ($${olderCost.toFixed(0)} → $${recentCost.toFixed(0)})`,
          wasAutoExecuted: false,
          timelineEntries: [
            {
              timestamp: new Date().toISOString(),
              action: `Maintenance costs increased ${increase}%`,
              status: 'completed' as const,
              data: { previous_quarter: olderCost, current_quarter: recentCost, increase_percent: increase },
            },
            {
              timestamp: new Date().toISOString(),
              action: 'Review maintenance requests for patterns',
              status: 'current' as const,
            },
          ],
        });

        if (error) {
          errors.push(`Maintenance spike task: ${error}`);
        } else {
          tasksCreated++;
        }
      }
    }
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'Unknown error in anomaly scanner';
    errors.push(`Data anomaly scanner: ${msg}`);
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 44: Property Health Score Calculator (beyond-PM)
// Calculates a composite health score (0-100) for each property based on
// maintenance history, financial performance, compliance status, tenant
// satisfaction, and market position. Runs once per week.
// ---------------------------------------------------------------------------

async function scanPropertyHealthScore(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  if (propertyIds.length === 0) return { tasksCreated, errors };

  try {
    // Only recalculate weekly — check last calculation
    const { data: lastCalc } = await supabase
      .from('property_health_scores')
      .select('calculated_at')
      .eq('owner_id', userId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCalc && (Date.now() - new Date(lastCalc.calculated_at).getTime()) < 7 * 86400000) {
      return { tasksCreated, errors }; // Calculated within last 7 days
    }

    for (const propertyId of propertyIds) {
      try {
        // Gather all signals in parallel
        const [maintenanceData, paymentData, complianceData, inspectionData, tenancyData, listingData] = await Promise.all([
          // Maintenance: count open, resolved, emergency in last 12 months
          supabase.from('maintenance_requests').select('status, urgency, actual_cost, created_at')
            .eq('property_id', propertyId).gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString()),
          // Payments: collection rate over last 6 months (join through tenancies)
          supabase.from('tenancies').select('id').eq('property_id', propertyId).then(async (tenancyResult: any) => {
            const tenancyIds = (tenancyResult.data || []).map((t: any) => t.id);
            if (tenancyIds.length === 0) return { data: [], error: null };
            return supabase.from('payments').select('amount, status, paid_at')
              .in('tenancy_id', tenancyIds).gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString());
          }),
          // Compliance: check compliance status
          supabase.from('property_compliance').select('status, next_due_date').eq('property_id', propertyId),
          // Last inspection condition
          supabase.from('inspections').select('overall_condition, actual_date, status')
            .eq('property_id', propertyId).in('status', ['completed', 'finalized']).order('actual_date', { ascending: false }).limit(1),
          // Tenancy stability
          supabase.from('tenancies').select('id, status, lease_start_date, lease_end_date, rent_amount')
            .eq('property_id', propertyId).order('lease_start_date', { ascending: false }).limit(3),
          // Listing performance (if vacant)
          supabase.from('listings').select('view_count, application_count, published_at, status')
            .eq('property_id', propertyId).order('created_at', { ascending: false }).limit(1),
        ]);

        // Calculate sub-scores
        const maintenance = maintenanceData.data || [];
        const openMaint = maintenance.filter((m: any) => !['completed', 'cancelled'].includes(m.status));
        const emergencies = maintenance.filter((m: any) => m.urgency === 'emergency');
        const totalCost = maintenance.reduce((s: number, m: any) => s + (m.actual_cost || 0), 0);
        const maintenanceScore = Math.max(0, 100 - (openMaint.length * 15) - (emergencies.length * 10) - Math.min(totalCost / 200, 30));

        // Financial: rent collection reliability
        const payments = paymentData.data || [];
        const completedPayments = payments.filter((p: any) => p.status === 'completed');
        const financialScore = payments.length > 0 ? Math.round((completedPayments.length / Math.max(payments.length, 1)) * 100) : 80;

        // Compliance
        const compliance = complianceData.data || [];
        const overdue = compliance.filter((c: any) => c.status === 'overdue' || (c.next_due_date && new Date(c.next_due_date) < new Date()));
        const complianceScore = compliance.length > 0 ? Math.max(0, 100 - (overdue.length * 25)) : 70;

        // Tenant stability
        const tenancies = tenancyData.data || [];
        const activeTenancy = tenancies.find((t: any) => t.status === 'active');
        let tenantScore = 50; // default if vacant
        if (activeTenancy) {
          const tenancyDurationMonths = Math.floor((Date.now() - new Date(activeTenancy.lease_start_date).getTime()) / (30.44 * 86400000));
          tenantScore = Math.min(100, 60 + (tenancyDurationMonths * 2)); // Longer = better
        }

        // Market position: is rent competitive?
        const currentRent = activeTenancy?.rent_amount || 0;
        const property = await supabase.from('properties').select('suburb, state, bedrooms, property_type').eq('id', propertyId).single();
        let marketScore = 70;
        if (property.data && currentRent > 0) {
          // Get comparable listings via property_id join to properties with matching suburb
          const { data: suburbProperties } = await supabase.from('properties').select('id')
            .eq('suburb', property.data.suburb).eq('state', property.data.state).neq('id', propertyId).limit(20);
          const suburbPropIds = (suburbProperties || []).map((p: any) => p.id);
          const { data: comps } = suburbPropIds.length > 0
            ? await supabase.from('listings').select('rent_amount')
              .eq('status', 'active').in('property_id', suburbPropIds).limit(10)
            : { data: [] };
          if (comps && comps.length > 0) {
            const median = comps.map((c: any) => c.rent_amount).sort((a: number, b: number) => a - b)[Math.floor(comps.length / 2)];
            const ratio = currentRent / median;
            marketScore = ratio >= 0.9 && ratio <= 1.1 ? 90 : ratio < 0.9 ? 75 : 65; // At market = good, below = ok, above = risky
          }
        }

        // Overall weighted score
        const overall = Math.round(
          maintenanceScore * 0.25 +
          financialScore * 0.25 +
          complianceScore * 0.20 +
          tenantScore * 0.15 +
          marketScore * 0.15
        );

        // Risk factors
        const riskFactors: string[] = [];
        if (maintenanceScore < 50) riskFactors.push('High maintenance burden');
        if (financialScore < 70) riskFactors.push('Rent collection issues');
        if (complianceScore < 70) riskFactors.push('Compliance gaps');
        if (tenantScore < 50) riskFactors.push('Vacancy or tenant instability');
        if (marketScore < 60) riskFactors.push('Rent above market rate');
        if (emergencies.length > 2) riskFactors.push('Recurring emergency maintenance');

        // Opportunities
        const opportunities: string[] = [];
        if (marketScore > 85 && financialScore > 80) opportunities.push('Strong performer — consider rent increase');
        if (tenantScore > 80) opportunities.push('Stable tenant — offer early lease renewal');
        if (maintenanceScore > 85 && complianceScore > 85) opportunities.push('Well-maintained — highlight for insurance discount');
        if (!activeTenancy) opportunities.push('Vacant — optimize listing for faster let');

        // Predicted maintenance cost (extrapolate from last 12 months)
        const predictedMaintCost = totalCost > 0 ? totalCost * 1.05 : 500; // 5% inflation or $500 baseline

        // Vacancy risk (based on tenancy history)
        const vacancyRisk = activeTenancy ? (tenantScore < 60 ? 0.3 : 0.1) : 0.8;

        // Upsert the health score
        await supabase.from('property_health_scores').upsert({
          property_id: propertyId,
          owner_id: userId,
          overall_score: overall,
          maintenance_score: Math.round(maintenanceScore),
          financial_score: Math.round(financialScore),
          compliance_score: Math.round(complianceScore),
          tenant_score: Math.round(tenantScore),
          market_position_score: Math.round(marketScore),
          risk_factors: riskFactors,
          opportunities,
          predicted_maintenance_cost_12m: Math.round(predictedMaintCost),
          predicted_vacancy_risk: Math.round(vacancyRisk * 10000) / 10000,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'property_id' });
      } catch (propErr: any) {
        errors.push(`Health score for ${propertyId}: ${propErr.message}`);
      }
    }

    // Check if any property scored below 50 — alert the owner
    const { data: lowScores } = await supabase
      .from('property_health_scores')
      .select('property_id, overall_score, risk_factors, properties!inner(address_line_1, suburb, state)')
      .eq('owner_id', userId)
      .lt('overall_score', 50);

    for (const score of lowScores || []) {
      const property = (score as any).properties;
      const address = [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ');
      const healthEntityId = await deterministicUuid(`health-${score.property_id}`);
      const alreadyExists = await taskExistsForEntity(supabase, userId, healthEntityId, 'low_health_score');
      if (alreadyExists) continue;

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Property health alert: ${address} (${score.overall_score}/100)`,
        description: `${address} has a health score of ${score.overall_score}/100, which is below the healthy threshold. Risk factors: ${(score.risk_factors as string[]).join(', ')}.`,
        category: 'financial',
        status: 'pending_input',
        priority: score.overall_score < 30 ? 'urgent' : 'high',
        recommendation: `This property needs attention. I've identified these risk factors:\n${(score.risk_factors as string[]).map((r: string) => `- ${r}`).join('\n')}\n\nWould you like me to create an action plan to improve this property's performance?`,
        relatedEntityType: 'property',
        relatedEntityId: healthEntityId,
        deepLink: `/(app)/(tabs)/properties/${score.property_id}`,
        triggerType: 'low_health_score',
        triggerSource: `property:${score.property_id}`,
        actionTaken: `Flagged low property health score (${score.overall_score}/100)`,
        wasAutoExecuted: false,
        timelineEntries: [
          { timestamp: new Date().toISOString(), action: `Calculated property health score: ${score.overall_score}/100`, status: 'completed' as const, data: { overall_score: score.overall_score, risk_factors: score.risk_factors } },
          { timestamp: new Date().toISOString(), action: 'Awaiting owner review', status: 'current' as const },
        ],
      });
      if (error) errors.push(`Health alert for ${score.property_id}: ${error}`);
      else tasksCreated++;
    }
  } catch (caught: any) {
    errors.push(`Property health scanner: ${caught.message}`);
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 45: Portfolio Wealth Tracker (beyond-PM)
// Takes a monthly snapshot of the owner's entire portfolio — total estimated
// value, equity, rental yield, year-on-year growth, and insights. Creates a
// task when there are notable changes.
// ---------------------------------------------------------------------------

async function scanPortfolioWealth(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  if (propertyIds.length === 0) return { tasksCreated, errors };

  try {
    // Only run monthly
    const today = new Date().toISOString().split('T')[0];
    const { data: lastSnapshot } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_date')
      .eq('owner_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSnapshot) {
      const daysSinceLast = Math.floor((Date.now() - new Date(lastSnapshot.snapshot_date).getTime()) / 86400000);
      if (daysSinceLast < 28) return { tasksCreated, errors };
    }

    // Gather portfolio metrics
    const [propertiesResult, tenanciesResult, paymentsResult, expensesResult, healthResult] = await Promise.all([
      supabase.from('properties').select('id, rent_amount, status').eq('owner_id', userId).is('deleted_at', null),
      supabase.from('tenancies').select('id, status, rent_amount, property_id').in('property_id', propertyIds).eq('status', 'active'),
      supabase.from('payments').select('amount, status').in('tenancy_id', (await supabase.from('tenancies').select('id').in('property_id', propertyIds)).data?.map((t: any) => t.id) || []).eq('status', 'completed').gte('paid_at', new Date(Date.now() - 365 * 86400000).toISOString()),
      supabase.from('manual_expenses').select('amount').eq('owner_id', userId).gte('expense_date', new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]),
      supabase.from('property_health_scores').select('overall_score').eq('owner_id', userId),
    ]);

    const properties = propertiesResult.data || [];
    const activeTenancies = tenanciesResult.data || [];
    const totalAnnualRent = activeTenancies.reduce((s: number, t: any) => s + ((t.rent_amount || 0) * 52), 0);
    const totalAnnualExpenses = (expensesResult.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const occupancyRate = properties.length > 0 ? (activeTenancies.length / properties.length) * 100 : 0;
    const avgHealthScore = healthResult.data && healthResult.data.length > 0
      ? Math.round(healthResult.data.reduce((s: number, h: any) => s + h.overall_score, 0) / healthResult.data.length)
      : null;
    const netYield = totalAnnualRent > 0 ? ((totalAnnualRent - totalAnnualExpenses) / totalAnnualRent * 100) : 0;

    // Build insights
    const insights: Record<string, any> = {};
    if (occupancyRate < 80) insights.vacancy_warning = `Occupancy at ${occupancyRate.toFixed(0)}% — below the 90% target`;
    if (netYield > 70) insights.strong_yield = `Net yield at ${netYield.toFixed(1)}% — strong performance`;
    if (avgHealthScore && avgHealthScore < 60) insights.health_concern = `Average property health ${avgHealthScore}/100 needs attention`;

    // Compare with previous snapshot
    const { data: prevSnapshot } = await supabase
      .from('portfolio_snapshots')
      .select('total_annual_rent, occupancy_rate, net_yield')
      .eq('owner_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevSnapshot) {
      const rentChange = prevSnapshot.total_annual_rent > 0 ? ((totalAnnualRent - prevSnapshot.total_annual_rent) / prevSnapshot.total_annual_rent * 100) : 0;
      if (rentChange > 5) insights.rent_growth = `Annual rent up ${rentChange.toFixed(1)}% since last snapshot`;
      if (rentChange < -5) insights.rent_decline = `Annual rent down ${Math.abs(rentChange).toFixed(1)}% since last snapshot`;
    }

    // Save snapshot
    await supabase.from('portfolio_snapshots').upsert({
      owner_id: userId,
      snapshot_date: today,
      total_properties: properties.length,
      total_annual_rent: totalAnnualRent,
      total_annual_expenses: totalAnnualExpenses,
      net_yield: Math.round(netYield * 100) / 100,
      occupancy_rate: Math.round(occupancyRate * 100) / 100,
      average_health_score: avgHealthScore,
      total_maintenance_ytd: totalAnnualExpenses,
      insights,
    }, { onConflict: 'owner_id,snapshot_date' });

    // Create monthly digest task
    const entityId = await deterministicUuid(`portfolio-${today.slice(0, 7)}`);
    const alreadyExists = await taskExistsForEntity(supabase, userId, entityId, 'portfolio_digest');
    if (!alreadyExists) {
      const insightSummary = Object.values(insights).join('. ') || 'Portfolio performing steadily.';
      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Monthly portfolio report — ${new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`,
        description: `Portfolio: ${properties.length} properties, ${occupancyRate.toFixed(0)}% occupied. Annual rent: $${totalAnnualRent.toLocaleString()}. Net yield: ${netYield.toFixed(1)}%. ${insightSummary}`,
        category: 'financial',
        status: 'pending_input',
        priority: 'low',
        recommendation: `Your monthly portfolio snapshot is ready. Key metrics:\n- Properties: ${properties.length}\n- Occupancy: ${occupancyRate.toFixed(0)}%\n- Annual rental income: $${totalAnnualRent.toLocaleString()}\n- Net yield: ${netYield.toFixed(1)}%\n${avgHealthScore ? `- Avg property health: ${avgHealthScore}/100` : ''}\n\nWould you like a detailed portfolio analysis report?`,
        relatedEntityType: 'profile',
        relatedEntityId: entityId,
        triggerType: 'portfolio_monthly_digest',
        triggerSource: 'portfolio_analysis',
        actionTaken: `Generated monthly portfolio snapshot`,
        wasAutoExecuted: false,
        timelineEntries: [
          { timestamp: new Date().toISOString(), action: `Calculated monthly portfolio metrics`, status: 'completed' as const, data: { properties: properties.length, occupancy_rate: occupancyRate, annual_rent: totalAnnualRent, net_yield: netYield } },
          { timestamp: new Date().toISOString(), action: 'Available for review', status: 'current' as const },
        ],
      });
      if (error) errors.push(`Portfolio digest: ${error}`);
      else tasksCreated++;
    }
  } catch (caught: any) {
    errors.push(`Portfolio wealth scanner: ${caught.message}`);
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 46: Tenant Retention Intelligence (beyond-PM)
// Calculates a satisfaction/retention score for each active tenancy and
// proactively flags at-risk tenants. Something no traditional PM does.
// ---------------------------------------------------------------------------

async function scanTenantRetention(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  if (propertyIds.length === 0) return { tasksCreated, errors };

  try {
    // Only recalculate fortnightly
    const { data: lastCalc } = await supabase
      .from('tenant_satisfaction')
      .select('calculated_at')
      .eq('owner_id', userId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCalc && (Date.now() - new Date(lastCalc.calculated_at).getTime()) < 14 * 86400000) {
      return { tasksCreated, errors };
    }

    // Get all active tenancies
    const { data: tenancies } = await supabase
      .from('tenancies')
      .select('id, property_id, lease_start_date, lease_end_date, rent_amount, status, properties!inner(address_line_1, suburb, state, owner_id)')
      .in('property_id', propertyIds)
      .eq('status', 'active');

    for (const tenancy of tenancies || []) {
      try {
        const [maintenanceResult, paymentResult, messageResult] = await Promise.all([
          // Maintenance: how quickly were requests resolved?
          supabase.from('maintenance_requests').select('created_at, status, status_changed_at')
            .eq('property_id', tenancy.property_id).gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString()),
          // Rent payments: on-time rate
          supabase.from('rent_schedules').select('due_date, is_paid, paid_at')
            .eq('tenancy_id', tenancy.id).gte('due_date', new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]),
          // Communication: response times
          supabase.from('conversation_participants').select('unread_count, last_read_at, conversations!inner(last_message_at)')
            .eq('conversations.property_id', tenancy.property_id).limit(5),
        ]);

        // Maintenance resolution speed
        const maintenance = maintenanceResult.data || [];
        const resolved = maintenance.filter((m: any) => m.status === 'completed');
        const avgResolutionDays = resolved.length > 0
          ? resolved.reduce((s: number, m: any) => s + Math.max(0, (new Date(m.status_changed_at).getTime() - new Date(m.created_at).getTime()) / 86400000), 0) / resolved.length
          : 5; // Default

        // Payment reliability
        const schedules = paymentResult.data || [];
        const onTimePaid = schedules.filter((s: any) => s.is_paid && s.paid_at && new Date(s.paid_at) <= new Date(new Date(s.due_date).getTime() + 3 * 86400000));
        const paymentReliability = schedules.length > 0 ? onTimePaid.length / schedules.length : 0.8;

        // Communication score
        const messages = messageResult.data || [];
        const commScore = messages.length > 0
          ? Math.min(100, 70 + (messages.filter((m: any) => (m.unread_count || 0) === 0).length / messages.length) * 30)
          : 75;

        // Maintenance response score (faster = better)
        const maintResponseScore = Math.max(0, 100 - (avgResolutionDays * 8));

        // Overall satisfaction
        const satisfactionScore = Math.round(
          maintResponseScore * 0.35 +
          (paymentReliability * 100) * 0.30 +
          commScore * 0.20 +
          Math.min(100, 50 + ((Date.now() - new Date(tenancy.lease_start_date).getTime()) / (365 * 86400000)) * 20) * 0.15
        );

        // Renewal probability
        const leaseEnd = tenancy.lease_end_date ? new Date(tenancy.lease_end_date) : null;
        const daysToExpiry = leaseEnd ? Math.floor((leaseEnd.getTime() - Date.now()) / 86400000) : 365;
        const renewalProbability = Math.min(1, Math.max(0, (satisfactionScore / 100) * 0.7 + (paymentReliability * 0.3)));

        // Risk flags
        const riskFlags: string[] = [];
        if (paymentReliability < 0.7) riskFlags.push('Frequent late payments');
        if (avgResolutionDays > 14) riskFlags.push('Slow maintenance resolution');
        if (satisfactionScore < 50) riskFlags.push('Low overall satisfaction');
        if (daysToExpiry > 0 && daysToExpiry < 60 && renewalProbability < 0.5) riskFlags.push('Lease ending soon with low renewal likelihood');

        await supabase.from('tenant_satisfaction').upsert({
          tenancy_id: tenancy.id,
          property_id: tenancy.property_id,
          owner_id: userId,
          satisfaction_score: satisfactionScore,
          response_time_avg_hours: Math.round(avgResolutionDays * 24 * 10) / 10,
          maintenance_resolution_avg_days: Math.round(avgResolutionDays * 10) / 10,
          communication_score: Math.round(commScore),
          rent_payment_reliability: Math.round(paymentReliability * 10000) / 10000,
          renewal_probability: Math.round(renewalProbability * 10000) / 10000,
          risk_flags: riskFlags,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'tenancy_id' });

        // Alert if tenant is at risk of leaving
        if (riskFlags.length >= 2 || (daysToExpiry > 0 && daysToExpiry < 90 && renewalProbability < 0.4)) {
          const property = (tenancy as any).properties;
          const address = [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ');
          const retentionEntityId = await deterministicUuid(`retention-${tenancy.id}`);
          const alreadyExists = await taskExistsForEntity(supabase, userId, retentionEntityId, 'tenant_retention_risk');
          if (alreadyExists) continue;

          const { error } = await createTaskAndLog(supabase, {
            userId,
            title: `Tenant retention risk: ${address}`,
            description: `The tenant at ${address} shows signs of dissatisfaction (score: ${satisfactionScore}/100, renewal probability: ${(renewalProbability * 100).toFixed(0)}%). Risk factors: ${riskFlags.join(', ')}.${daysToExpiry > 0 && daysToExpiry < 90 ? ` Lease ends in ${daysToExpiry} days.` : ''}`,
            category: 'tenant_finding',
            status: 'pending_input',
            priority: daysToExpiry < 60 ? 'high' : 'normal',
            recommendation: `This tenant may not renew. Consider:\n${riskFlags.includes('Slow maintenance resolution') ? '- Speed up outstanding maintenance requests\n' : ''}${riskFlags.includes('Frequent late payments') ? '- Discuss flexible payment arrangements\n' : ''}- Reach out proactively to check if they have concerns\n- Consider offering a small incentive for early renewal\n- If they do leave, I can start the find-tenant workflow immediately`,
            relatedEntityType: 'tenancy',
            relatedEntityId: retentionEntityId,
            deepLink: `/(app)/(tabs)/properties/${tenancy.property_id}`,
            triggerType: 'tenant_retention_risk',
            triggerSource: `tenancy:${tenancy.id}`,
            actionTaken: `Flagged at-risk tenant (satisfaction: ${satisfactionScore}/100, renewal: ${(renewalProbability * 100).toFixed(0)}%)`,
            wasAutoExecuted: false,
            timelineEntries: [
              { timestamp: new Date().toISOString(), action: `Calculated tenant satisfaction: ${satisfactionScore}/100`, status: 'completed' as const, data: { satisfaction_score: satisfactionScore, renewal_probability: renewalProbability, risk_flags: riskFlags } },
              { timestamp: new Date().toISOString(), action: 'Review tenant relationship', status: 'current' as const },
            ],
          });
          if (error) errors.push(`Retention alert for ${tenancy.id}: ${error}`);
          else tasksCreated++;
        }
      } catch (tenErr: any) {
        errors.push(`Tenant retention for ${tenancy.id}: ${tenErr.message}`);
      }
    }
  } catch (caught: any) {
    errors.push(`Tenant retention scanner: ${caught.message}`);
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 47: Predictive Maintenance Intelligence (beyond-PM)
// Analyses maintenance patterns to predict upcoming failures and costs.
// Flags properties with ageing infrastructure.
// ---------------------------------------------------------------------------

async function scanPredictiveMaintenance(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  if (propertyIds.length === 0) return { tasksCreated, errors };

  try {
    // Run monthly
    const monthKey = new Date().toISOString().slice(0, 7);

    for (const propertyId of propertyIds) {
      const predictMaintEntityId = await deterministicUuid(`predict-maint-${propertyId}-${monthKey}`);
      const alreadyExists = await taskExistsForEntity(supabase, userId, predictMaintEntityId, 'predictive_maintenance');
      if (alreadyExists) continue;

      // Get property details including age
      const { data: property } = await supabase
        .from('properties')
        .select('id, address_line_1, suburb, state, year_built, property_type')
        .eq('id', propertyId)
        .single();

      if (!property) continue;
      const propertyAge = property.year_built ? new Date().getFullYear() - property.year_built : null;

      // Get all maintenance history
      const { data: maintenanceHistory } = await supabase
        .from('maintenance_requests')
        .select('category, urgency, actual_cost, estimated_cost, created_at, status')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!maintenanceHistory || maintenanceHistory.length < 3) continue; // Not enough data

      // Analyse patterns by category
      const categoryFrequency: Record<string, { count: number; totalCost: number; dates: string[] }> = {};
      for (const req of maintenanceHistory) {
        const cat = req.category || 'general';
        if (!categoryFrequency[cat]) categoryFrequency[cat] = { count: 0, totalCost: 0, dates: [] };
        categoryFrequency[cat].count++;
        categoryFrequency[cat].totalCost += (req.actual_cost || req.estimated_cost || 0);
        categoryFrequency[cat].dates.push(req.created_at);
      }

      // Find recurring categories (3+ occurrences)
      const recurringIssues = Object.entries(categoryFrequency)
        .filter(([_, data]) => data.count >= 3)
        .sort((a, b) => b[1].count - a[1].count);

      // Age-based predictions
      const agePredictions: string[] = [];
      if (propertyAge) {
        if (propertyAge >= 20) agePredictions.push('Hot water system may need replacement (typical lifespan: 10-15 years)');
        if (propertyAge >= 25) agePredictions.push('Roof may need inspection and maintenance (shingles/tiles lifespan: 20-30 years)');
        if (propertyAge >= 15) agePredictions.push('Air conditioning system approaching end of life');
        if (propertyAge >= 30) agePredictions.push('Plumbing pipes may need attention (galvanised pipes: 30-40 year lifespan)');
        if (propertyAge >= 40) agePredictions.push('Electrical wiring should be inspected (pre-1980s standards)');
      }

      // Only create task if there are actionable predictions
      if (recurringIssues.length === 0 && agePredictions.length === 0) continue;

      const address = [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ');
      const topIssue = recurringIssues[0];
      const totalPredictedCost = recurringIssues.reduce((s, [_, d]) => s + (d.totalCost / d.count), 0);

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Predictive maintenance: ${address}`,
        description: `Based on ${maintenanceHistory.length} historical requests${propertyAge ? ` and a property age of ${propertyAge} years` : ''}, I've identified upcoming maintenance needs.${topIssue ? ` Most recurring: ${topIssue[0]} (${topIssue[1].count} times, avg cost $${Math.round(topIssue[1].totalCost / topIssue[1].count)}).` : ''} Estimated annual maintenance: $${Math.round(totalPredictedCost)}.`,
        category: 'maintenance',
        status: 'pending_input',
        priority: 'normal',
        recommendation: `Predictive analysis for ${address}:\n\n${recurringIssues.length > 0 ? 'Recurring issues:\n' + recurringIssues.map(([cat, data]) => `- ${cat}: ${data.count} occurrences, ~$${Math.round(data.totalCost / data.count)} average`).join('\n') + '\n\n' : ''}${agePredictions.length > 0 ? 'Age-based predictions:\n' + agePredictions.map(p => `- ${p}`).join('\n') + '\n\n' : ''}Recommendations:\n- Schedule preventive maintenance for recurring issues\n- Budget $${Math.round(totalPredictedCost)} for the next 12 months\n- Consider a comprehensive property inspection to catch issues early`,
        relatedEntityType: 'property',
        relatedEntityId: predictMaintEntityId,
        deepLink: `/(app)/(tabs)/properties/${propertyId}`,
        triggerType: 'predictive_maintenance',
        triggerSource: `property:${propertyId}`,
        actionTaken: `Generated predictive maintenance analysis (${maintenanceHistory.length} historical records)`,
        wasAutoExecuted: false,
        timelineEntries: [
          { timestamp: new Date().toISOString(), action: `Analysed ${maintenanceHistory.length} maintenance records${propertyAge ? ` for ${propertyAge}-year-old property` : ''}`, status: 'completed' as const, data: { recurring_categories: recurringIssues.length, age_predictions: agePredictions.length, predicted_annual_cost: Math.round(totalPredictedCost) } },
          { timestamp: new Date().toISOString(), action: 'Review maintenance predictions', status: 'current' as const },
        ],
      });
      if (error) errors.push(`Predictive maintenance for ${propertyId}: ${error}`);
      else tasksCreated++;
    }
  } catch (caught: any) {
    errors.push(`Predictive maintenance scanner: ${caught.message}`);
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Scanner 48: Market Pulse — suburb-level intelligence (beyond-PM)
// Analyses the owner's property suburbs and caches market intelligence —
// median rents, vacancy rates, demand scores. Alerts when market conditions
// change in ways that require action.
// ---------------------------------------------------------------------------

async function scanMarketPulse(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];
  if (propertyIds.length === 0) return { tasksCreated, errors };

  try {
    // Run weekly
    const weekKey = `${new Date().getFullYear()}-W${Math.ceil((new Date().getDate()) / 7)}`;

    // Get unique suburbs from owner's properties
    const { data: properties } = await supabase
      .from('properties')
      .select('id, suburb, state, bedrooms, property_type, rent_amount, status')
      .in('id', propertyIds);

    const suburbs = [...new Set((properties || []).map((p: any) => `${p.suburb}|${p.state}`))];

    for (const suburbKey of suburbs) {
      const [suburb, state] = suburbKey.split('|');

      // Check if we have recent market data
      const { data: existing } = await supabase
        .from('market_intelligence')
        .select('calculated_at, median_rent_weekly, vacancy_rate')
        .eq('suburb', suburb)
        .eq('state', state)
        .eq('property_type', 'all')
        .maybeSingle();

      if (existing && (Date.now() - new Date(existing.calculated_at).getTime()) < 7 * 86400000) {
        continue; // Recent data exists
      }

      const previousMedian = existing?.median_rent_weekly || null;
      const previousVacancy = existing?.vacancy_rate || null;

      // Calculate from internal data
      // Get property IDs in this suburb, then fetch their listings
      const { data: suburbProps } = await supabase.from('properties').select('id')
        .eq('suburb', suburb).eq('state', state).limit(100);
      const suburbPropIds = (suburbProps || []).map((p: any) => p.id);
      const { data: areaListings } = suburbPropIds.length > 0
        ? await supabase.from('listings')
          .select('rent_amount, published_at, status, view_count, application_count')
          .in('property_id', suburbPropIds)
          .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
          .limit(50)
        : { data: [] };

      const rents = (areaListings || []).filter((l: any) => l.rent_amount > 0).map((l: any) => l.rent_amount);
      const medianRent = rents.length > 0 ? rents.sort((a: number, b: number) => a - b)[Math.floor(rents.length / 2)] : null;

      // Estimate vacancy: ratio of active listings to total
      const activeListings = (areaListings || []).filter((l: any) => l.status === 'active').length;
      const totalListings = (areaListings || []).length || 1;
      const vacancyEstimate = Math.min(0.15, activeListings / Math.max(totalListings * 3, 1));

      // Demand: application-to-listing ratio
      const totalApps = (areaListings || []).reduce((s: number, l: any) => s + (l.application_count || 0), 0);
      const demandScore = Math.min(100, Math.round((totalApps / Math.max(totalListings, 1)) * 25));

      // Supply score (inverse of demand)
      const supplyScore = Math.max(0, 100 - demandScore);

      // Days on market average
      const activeDays = (areaListings || [])
        .filter((l: any) => l.published_at)
        .map((l: any) => Math.floor((Date.now() - new Date(l.published_at).getTime()) / 86400000));
      const avgDaysOnMarket = activeDays.length > 0 ? activeDays.reduce((s: number, d: number) => s + d, 0) / activeDays.length : null;

      // Save market intelligence
      await supabase.from('market_intelligence').upsert({
        suburb,
        state,
        property_type: 'all',
        bedrooms: null,
        median_rent_weekly: medianRent,
        vacancy_rate: Math.round(vacancyEstimate * 10000) / 10000,
        days_on_market_avg: avgDaysOnMarket ? Math.round(avgDaysOnMarket * 10) / 10 : null,
        demand_score: demandScore,
        supply_score: supplyScore,
        data_sources: [{ type: 'internal', listings_analysed: totalListings }],
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'suburb,state,property_type,bedrooms' });

      // Alert if market conditions changed significantly
      if (previousMedian && medianRent) {
        const rentChange = ((medianRent - previousMedian) / previousMedian) * 100;
        if (Math.abs(rentChange) > 5) {
          // Check which properties are affected
          const affectedProperties = (properties || []).filter((p: any) => p.suburb === suburb && p.state === state);
          for (const prop of affectedProperties) {
            const marketEntityId = await deterministicUuid(`market-${prop.id}-${weekKey}`);
            const alreadyExists = await taskExistsForEntity(supabase, userId, marketEntityId, 'market_shift');
            if (alreadyExists) continue;

            const address = [prop.address_line_1 || '', suburb, state].filter(Boolean).join(', ');
            const direction = rentChange > 0 ? 'up' : 'down';
            const rentComparison = prop.rent_amount ? (prop.rent_amount > medianRent ? 'above' : prop.rent_amount < medianRent * 0.9 ? 'below' : 'at') : 'unknown relative to';

            const { error } = await createTaskAndLog(supabase, {
              userId,
              title: `Market shift in ${suburb}: rents ${direction} ${Math.abs(rentChange).toFixed(1)}%`,
              description: `Median rents in ${suburb} ${state} have moved ${direction} ${Math.abs(rentChange).toFixed(1)}% (was $${previousMedian}/wk, now $${medianRent}/wk). Your property at ${address} is currently ${rentComparison} market rate${prop.rent_amount ? ` at $${prop.rent_amount}/wk` : ''}.`,
              category: 'financial',
              status: 'pending_input',
              priority: 'normal',
              recommendation: rentChange > 0
                ? `Rents in ${suburb} are rising. ${rentComparison === 'below' ? 'Your rent is below market — consider a rent increase at the next review period.' : 'Your property is well-positioned in this market.'}`
                : `Rents in ${suburb} are declining. ${rentComparison === 'above' ? 'Your rent is above the new market rate — consider this when negotiating lease renewals to avoid extended vacancy.' : 'Your property remains competitively priced.'}`,
              relatedEntityType: 'property',
              relatedEntityId: marketEntityId,
              deepLink: `/(app)/(tabs)/properties/${prop.id}`,
              triggerType: 'market_shift',
              triggerSource: `market:${suburb}:${state}`,
              actionTaken: `Detected ${Math.abs(rentChange).toFixed(1)}% rent ${direction === 'up' ? 'increase' : 'decrease'} in ${suburb}`,
              wasAutoExecuted: false,
              timelineEntries: [
                { timestamp: new Date().toISOString(), action: `Market analysis: ${suburb} rents ${direction} ${Math.abs(rentChange).toFixed(1)}%`, status: 'completed' as const, data: { previous_median: previousMedian, new_median: medianRent, change_percent: rentChange, demand_score: demandScore } },
                { timestamp: new Date().toISOString(), action: 'Review pricing strategy', status: 'current' as const },
              ],
            });
            if (error) errors.push(`Market pulse for ${prop.id}: ${error}`);
            else tasksCreated++;
          }
        }
      }
    }
  } catch (caught: any) {
    errors.push(`Market pulse scanner: ${caught.message}`);
  }

  return { tasksCreated, errors };
}

// ---------------------------------------------------------------------------
// Process a single user
// ---------------------------------------------------------------------------

// Notification budget: max tasks per user per heartbeat cycle
const TASK_BUDGET_PER_CYCLE = 15;

async function processUser(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<{
  tasksCreated: number;
  actionsAutoExecuted: number;
  errors: string[];
}> {
  let totalTasksCreated = 0;
  let totalAutoExecuted = 0;
  const allErrors: string[] = [];

  // Cross-scanner deduplication: register this user's cycle set
  // (automatically checked by taskExistsForEntity / createTaskAndLog)
  _cycleHandledEntities.set(userId, new Set<string>());

  // Load user's properties (to scope all queries)
  const { data: properties, error: propErr } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', userId)
    .is('deleted_at', null);

  if (propErr) {
    allErrors.push(`Failed to load properties for user ${userId}: ${propErr.message}`);
    _cycleHandledEntities.delete(userId);
    return { tasksCreated: 0, actionsAutoExecuted: 0, errors: allErrors };
  }

  const propertyIds = (properties || []).map((p: any) => p.id);

  // Load autonomy settings
  const { data: autonomySettings } = await supabase
    .from('agent_autonomy_settings')
    .select('preset, category_overrides')
    .eq('user_id', userId)
    .single();

  // Helper: aggregate scanner result with budget enforcement
  function aggregateResult(result: { tasksCreated: number; autoExecuted?: number; errors: string[] }) {
    totalTasksCreated += result.tasksCreated;
    totalAutoExecuted += (result.autoExecuted || 0);
    allErrors.push(...result.errors);
  }

  // Helper: check if budget is exhausted
  function budgetExhausted(): boolean {
    return totalTasksCreated >= TASK_BUDGET_PER_CYCLE;
  }

  // Run all scanners (with budget checks between them)
  // Scanners are grouped by priority — critical scanners run first

  if (!budgetExhausted()) {
    const leaseResult = await scanLeaseExpiry(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null);
    aggregateResult(leaseResult);
  }

  if (!budgetExhausted()) {
    const arrearsResult = await scanOverdueRent(
      supabase, userId, propertyIds, autonomySettings as AutonomySettings | null,
    );
    aggregateResult(arrearsResult);
  }

  if (!budgetExhausted()) {
    const appsResult = await scanNewApplications(supabase, userId);
    aggregateResult(appsResult);
  }

  if (!budgetExhausted()) {
    const staleResult = await scanStaleListings(supabase, userId);
    aggregateResult(staleResult);
  }

  if (!budgetExhausted()) {
    const inspectionResult = await scanInspectionsDue(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null);
    aggregateResult(inspectionResult);
  }

  // Scanner 6: Maintenance follow-up
  if (!budgetExhausted()) {
    const maintenanceResult = await scanMaintenanceFollowUp(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null);
    aggregateResult(maintenanceResult);
  }

  // Scanner 7: Communication follow-up
  if (!budgetExhausted()) {
    const commResult = await scanCommunicationFollowUp(supabase, userId);
    aggregateResult(commResult);
  }

  // Scanner 8: Financial anomalies
  if (!budgetExhausted()) {
    const financialResult = await scanFinancialAnomalies(supabase, userId, propertyIds);
    aggregateResult(financialResult);
  }

  // Scanner 9: Payment plan defaults
  if (!budgetExhausted()) {
    const paymentPlanResult = await scanPaymentPlanDefaults(supabase, userId, propertyIds);
    aggregateResult(paymentPlanResult);
  }

  // Scanner 10: Listing performance
  if (!budgetExhausted()) {
    const listingPerfResult = await scanListingPerformance(supabase, userId);
    aggregateResult(listingPerfResult);
  }

  // Scanner 11: Maintenance urgency escalation
  if (!budgetExhausted()) aggregateResult(await scanMaintenanceUrgencyEscalation(supabase, userId, propertyIds));

  // Scanner 12: Compliance gaps (inspections)
  if (!budgetExhausted()) aggregateResult(await scanComplianceGaps(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 12B: Property compliance items (smoke alarms, pool safety, gas, electrical, etc.)
  if (!budgetExhausted()) aggregateResult(await scanPropertyComplianceItems(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 12C: Rent increase frequency compliance (state law enforcement)
  if (!budgetExhausted()) aggregateResult(await scanRentIncreaseCompliance(supabase, userId, propertyIds));

  // Scanner 12C-Auto: Rent increase auto-application on effective date
  if (!budgetExhausted()) aggregateResult(await scanRentIncreaseAutoApply(supabase, userId, propertyIds));

  // Scanner 12D: Entry notice compliance (insufficient notice for scheduled inspections)
  if (!budgetExhausted()) aggregateResult(await scanEntryNoticeCompliance(supabase, userId, propertyIds));

  // Scanner 12E: Bond lodgement deadline compliance
  if (!budgetExhausted()) aggregateResult(await scanBondLodgementDeadlines(supabase, userId, propertyIds));

  // Scanner 12F: Lease end notice requirements (state-mandated notice periods)
  if (!budgetExhausted()) aggregateResult(await scanLeaseEndNoticeRequirements(supabase, userId, propertyIds));

  // Scanner 13: Insurance renewal
  if (!budgetExhausted()) aggregateResult(await scanInsuranceRenewal(supabase, userId, propertyIds));

  // Scanner 14: Market rent analysis
  if (!budgetExhausted()) aggregateResult(await scanMarketRentAnalysis(supabase, userId, propertyIds));

  // Scanner 15: Bond deadlines — superseded by Scanner 12E which uses tenancy_law_rules DB table
  // instead of hardcoded values. Disabled to prevent duplicate bond deadline tasks.
  // if (!budgetExhausted()) aggregateResult(await scanBondDeadlines(supabase, userId, propertyIds));

  // Scanner 16: Rent review due
  if (!budgetExhausted()) aggregateResult(await scanRentReviewDue(supabase, userId, propertyIds));

  // Scanner 17: Application screening status
  if (!budgetExhausted()) aggregateResult(await scanApplicationScreeningStatus(supabase, userId));

  // Scanner 18: Exit inspection due
  if (!budgetExhausted()) aggregateResult(await scanExitInspectionDue(supabase, userId, propertyIds));

  // Scanner 19: Extended vacancy
  if (!budgetExhausted()) aggregateResult(await scanExtendedVacancy(supabase, userId, propertyIds));

  // Scanner 20: Trade quote response
  if (!budgetExhausted()) aggregateResult(await scanTradeQuoteResponse(supabase, userId, propertyIds));

  // Scanner 21A: Arrears escalation — days-overdue threshold notices (7/14/21/28)
  if (!budgetExhausted()) aggregateResult(await scanArrearsEscalation(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 21B: Arrears escalation path — severity-based timing (autonomous)
  if (!budgetExhausted()) aggregateResult(await scanArrearsEscalationPath(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 22: Work order completion
  if (!budgetExhausted()) aggregateResult(await scanWorkOrderCompletion(supabase, userId, propertyIds));

  // Scanner 23: Maintenance → Proactive Trade Match & Auto-Assign (autonomous)
  if (!budgetExhausted()) aggregateResult(await scanMaintenanceTradeMatch(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 24: New Tenant Onboarding Workflow (autonomous)
  if (!budgetExhausted()) aggregateResult(await scanNewTenantOnboarding(supabase, userId, autonomySettings as AutonomySettings | null));

  // Scanner 25: End-of-Tenancy Workflow (autonomous)
  if (!budgetExhausted()) aggregateResult(await scanEndOfTenancyWorkflow(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 26: Rent Payment Received — Auto-Reconcile
  if (!budgetExhausted()) aggregateResult(await scanRentPaymentReceived(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 27: Inspection Completed — Auto-Compare & Flag
  if (!budgetExhausted()) aggregateResult(await scanInspectionCompleted(supabase, userId, propertyIds));

  // Scanner 28: Tenant Message Triage — Auto-Categorize & Route
  if (!budgetExhausted()) aggregateResult(await scanTenantMessageTriage(supabase, userId));

  // Scanner 29: Lease Started — Compliance Checklist
  if (!budgetExhausted()) aggregateResult(await scanLeaseStartedCompliance(supabase, userId, propertyIds));

  // Scanner 30: First Rent Not Received
  if (!budgetExhausted()) aggregateResult(await scanFirstRentMissing(supabase, userId, propertyIds));

  // Scanner 31: Application Decision Needed
  if (!budgetExhausted()) aggregateResult(await scanApplicationDecisionNeeded(supabase, userId));

  // Scanner 32: Missing Key Documents
  if (!budgetExhausted()) aggregateResult(await scanMissingKeyDocuments(supabase, userId, propertyIds));

  // Scanner 33: Proactive Re-Listing Prompt (autonomous)
  if (!budgetExhausted()) aggregateResult(await scanReListingPrompt(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 34: Maintenance Completed — Follow-Up
  if (!budgetExhausted()) aggregateResult(await scanMaintenanceCompletedFollowUp(supabase, userId, propertyIds));

  // Scanner 35: Rent Increase Notice Preparation (autonomous)
  if (!budgetExhausted()) aggregateResult(await scanRentIncreasePrep(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 36: Weekly Listing Performance Digest
  if (!budgetExhausted()) aggregateResult(await scanListingWeeklyDigest(supabase, userId));

  // Scanner 37: Utility Transfer Reminder (autonomous)
  if (!budgetExhausted()) aggregateResult(await scanUtilityTransferReminder(supabase, userId, propertyIds, autonomySettings as AutonomySettings | null));

  // Scanner 38: Upcoming Inspection Reminder
  if (!budgetExhausted()) aggregateResult(await scanUpcomingInspectionReminder(supabase, userId, propertyIds));

  // Scanner 39: Periodic Tenancy Rent Adjustment Window
  if (!budgetExhausted()) aggregateResult(await scanPeriodicRentAdjustment(supabase, userId, propertyIds));

  // Scanner 40: Financial Year Prep (May-June)
  if (!budgetExhausted()) aggregateResult(await scanFinancialYearPrep(supabase, userId, propertyIds));

  // Scanner 41: Proactive Intelligence — Learned Pattern Suggestions
  if (!budgetExhausted()) aggregateResult(await scanLearnedPatterns(supabase, userId));

  // Scanner 42: Proactive Intelligence — Anomaly Detection
  if (!budgetExhausted()) aggregateResult(await scanDataAnomalies(supabase, userId, propertyIds));

  // Scanner 44: Property Health Score Calculator (beyond-PM)
  if (!budgetExhausted()) aggregateResult(await scanPropertyHealthScore(supabase, userId, propertyIds));

  // Scanner 45: Portfolio Wealth Tracker (beyond-PM)
  if (!budgetExhausted()) aggregateResult(await scanPortfolioWealth(supabase, userId, propertyIds));

  // Scanner 46: Tenant Retention Intelligence (beyond-PM)
  if (!budgetExhausted()) aggregateResult(await scanTenantRetention(supabase, userId, propertyIds));

  // Scanner 47: Predictive Maintenance Intelligence (beyond-PM)
  if (!budgetExhausted()) aggregateResult(await scanPredictiveMaintenance(supabase, userId, propertyIds));

  // Scanner 48: Market Pulse (beyond-PM)
  if (!budgetExhausted()) aggregateResult(await scanMarketPulse(supabase, userId, propertyIds));

  // Tool Genome Refresh — aggregate recent decision data into tool_genome table
  try {
    await supabase.rpc('refresh_tool_genome', { p_user_id: userId, p_window_days: 30 });
  } catch (genomeErr: any) {
    allErrors.push(`Tool genome refresh failed: ${genomeErr.message}`);
  }

  // Temporal Decay — reduce confidence on stale rules not applied recently
  try {
    await supabase.rpc('decay_stale_rules', {
      p_user_id: userId,
      p_days_threshold: 30,
      p_decay_amount: 0.02,
    });
  } catch (decayErr: any) {
    allErrors.push(`Rule decay failed: ${decayErr.message}`);
  }

  // Scanner 43: Outcome Measurement — check tasks from previous cycles
  // and record outcomes for linked decisions
  if (!budgetExhausted()) {
    try {
      // Find tasks completed/dismissed since last heartbeat (within last 20 min to cover cycle)
      const { data: resolvedTasks } = await supabase
        .from('agent_tasks')
        .select('id, status, related_entity_id, related_entity_type, user_id')
        .eq('user_id', userId)
        .in('status', ['completed', 'dismissed', 'cancelled'])
        .gte('updated_at', new Date(Date.now() - 20 * 60 * 1000).toISOString())
        .limit(20);

      for (const task of resolvedTasks || []) {
        // Check if we already recorded an outcome for this task
        const { data: existingOutcome } = await supabase
          .from('agent_outcomes')
          .select('id')
          .eq('task_id', task.id)
          .limit(1);

        if (existingOutcome && existingOutcome.length > 0) continue;

        const outcomeType = task.status === 'completed' ? 'success'
          : task.status === 'dismissed' ? 'user_override'
          : 'failure';

        await supabase.from('agent_outcomes').insert({
          user_id: userId,
          task_id: task.id,
          outcome_type: outcomeType,
          outcome_details: {
            task_status: task.status,
            related_entity_type: task.related_entity_type,
            source: 'heartbeat_measurement',
          },
          measured_at: new Date().toISOString(),
        });
      }

      // Also check for stale tasks (older than 7 days with no resolution) → timeout
      const { data: staleTasks } = await supabase
        .from('agent_tasks')
        .select('id, related_entity_id')
        .eq('user_id', userId)
        .in('status', ['pending_input', 'in_progress'])
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(10);

      for (const task of staleTasks || []) {
        const { data: existingOutcome } = await supabase
          .from('agent_outcomes')
          .select('id')
          .eq('task_id', task.id)
          .limit(1);

        if (existingOutcome && existingOutcome.length > 0) continue;

        await supabase.from('agent_outcomes').insert({
          user_id: userId,
          task_id: task.id,
          outcome_type: 'timeout',
          outcome_details: { source: 'heartbeat_stale_task' },
          measured_at: new Date().toISOString(),
        });
      }
    } catch (outcomeErr: any) {
      allErrors.push(`Outcome measurement failed: ${outcomeErr.message}`);
    }
  }

  // Clean up within-cycle dedup set for this user
  _cycleHandledEntities.delete(userId);

  return {
    tasksCreated: totalTasksCreated,
    actionsAutoExecuted: totalAutoExecuted,
    errors: allErrors,
  };
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Verify authorization (cron secret, service role JWT, or admin JWT)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('X-Cron-Secret');

    let isAuthorized = false;

    if (cronSecret && providedSecret === cronSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      // Check if token is a service_role JWT by decoding the payload
      try {
        const payloadB64 = token.split('.')[1];
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64));
          if (payload.role === 'service_role') {
            isAuthorized = true;
          }
        }
      } catch {
        // Not a valid JWT, fall through to user auth
      }
      if (!isAuthorized) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role === 'admin') {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check for optional user_id query param (for testing a single user)
    const url = new URL(req.url);
    const singleUserId = url.searchParams.get('user_id');

    let userIds: string[] = [];

    if (singleUserId) {
      // Process a single user
      userIds = [singleUserId];
    } else {
      // Process all users who have autonomy settings (meaning they have engaged with the agent)
      const { data: allUsers, error: usersErr } = await supabase
        .from('agent_autonomy_settings')
        .select('user_id');

      if (usersErr) {
        return new Response(
          JSON.stringify({ error: `Failed to load users: ${usersErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      userIds = (allUsers || []).map((u: any) => u.user_id);
    }

    console.log(`Agent heartbeat starting: processing ${userIds.length} user(s)`);

    const result: HeartbeatResult = {
      processed: 0,
      tasks_created: 0,
      actions_auto_executed: 0,
      errors: [],
    };

    // Process users in parallel batches of 5 (instead of sequentially)
    const BATCH_SIZE = 5;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(uid => processUser(supabase, uid))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const batchResult = batchResults[j];
        const uid = batch[j];
        result.processed++;

        if (batchResult.status === 'fulfilled') {
          result.tasks_created += batchResult.value.tasksCreated;
          result.actions_auto_executed += batchResult.value.actionsAutoExecuted;
          if (batchResult.value.errors.length > 0) {
            result.errors.push(
              ...batchResult.value.errors.map((e: string) => `[user:${uid}] ${e}`),
            );
          }
        } else {
          console.error(`Error processing user ${uid}:`, batchResult.reason);
          result.errors.push(`[user:${uid}] Unhandled error: ${batchResult.reason?.message || 'unknown'}`);
        }
      }
    }

    // Data lifecycle cleanup — run once per day (not per-user)
    try {
      const { data: lastCleanup } = await supabase
        .from('agent_background_tasks')
        .select('last_run_at')
        .eq('task_type', 'learning_data_cleanup')
        .single();

      const lastRun = lastCleanup?.last_run_at ? new Date(lastCleanup.last_run_at) : new Date(0);
      const hoursSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastRun >= 24) {
        console.log('Running daily learning data cleanup...');
        const { data: cleanupResult } = await supabase.rpc('cleanup_old_learning_data', { p_retention_days: 90 });
        console.log('Cleanup result:', cleanupResult);

        // Record the cleanup run
        await supabase.from('agent_background_tasks').upsert({
          task_type: 'learning_data_cleanup',
          trigger_type: 'cron',
          last_run_at: new Date().toISOString(),
          status: 'active',
          result_data: cleanupResult,
        }, { onConflict: 'task_type' });
      }
    } catch (cleanupErr: any) {
      console.error('Daily cleanup error:', cleanupErr.message);
      result.errors.push(`[system] Cleanup error: ${cleanupErr.message}`);
    }

    console.log(
      `Agent heartbeat complete: ${result.processed} users, ` +
      `${result.tasks_created} tasks created, ` +
      `${result.actions_auto_executed} auto-executed, ` +
      `${result.errors.length} errors`,
    );

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Agent heartbeat error:', error);
    return new Response(
      JSON.stringify({
        processed: 0,
        tasks_created: 0,
        actions_auto_executed: 0,
        errors: [error.message || 'Internal server error'],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
