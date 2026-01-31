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
// Utility: check if a task already exists for a given entity + trigger
// ---------------------------------------------------------------------------

async function taskExistsForEntity(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  relatedEntityId: string,
  triggerType: string,
): Promise<boolean> {
  // Look for an open task (not completed/cancelled) matching this entity
  const { data } = await supabase
    .from('agent_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('related_entity_id', relatedEntityId)
    .in('status', ['pending_input', 'in_progress', 'scheduled', 'paused'])
    .ilike('title', `%${triggerType.replace('_', ' ')}%`)
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

  return { taskId: task.id, error: null };
}

// ---------------------------------------------------------------------------
// Scanner 1: Lease Expiry Warnings (60 / 30 / 14 day windows)
// ---------------------------------------------------------------------------

async function scanLeaseExpiry(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  propertyIds: string[],
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

  if (propertyIds.length === 0) return { tasksCreated, errors };

  const today = new Date();
  const windows = [
    { days: 14, label: '14 days', priority: 'urgent' as const },
    { days: 30, label: '30 days', priority: 'high' as const },
    { days: 60, label: '60 days', priority: 'normal' as const },
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

      const { error } = await createTaskAndLog(supabase, {
        userId,
        title: `Lease expiry in ${daysUntilExpiry} days - ${address}`,
        description: `The lease for ${tenantNames || 'tenant'} at ${address} expires on ${endDateFormatted}. You should decide whether to renew, go periodic, or end the tenancy.`,
        category: 'lease_management',
        status: 'pending_input',
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
        actionTaken: `Created lease expiry warning task (${daysUntilExpiry} days remaining)`,
        wasAutoExecuted: false,
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
            action: 'Awaiting owner decision on lease renewal',
            status: 'current',
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
): Promise<{ tasksCreated: number; errors: string[] }> {
  let tasksCreated = 0;
  const errors: string[] = [];

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

    const { error } = await createTaskAndLog(supabase, {
      userId,
      title: `Routine inspection due - ${address}`,
      description: `A routine inspection is due for ${address}. ${monthsSinceLastStr}. ${state} requires routine inspections at least every ${intervalMonths} months.`,
      category: 'inspections',
      status: 'in_progress',
      priority: 'normal',
      recommendation: `Schedule a routine inspection for this property. Under ${state} tenancy law, routine inspections must be conducted at least every ${intervalMonths} months with 7 days written notice to the tenant.`,
      relatedEntityType: 'property',
      relatedEntityId: property.id,
      deepLink: `/(app)/inspections/schedule?property_id=${property.id}&type=routine`,
      triggerType: 'routine_inspection_due',
      triggerSource: `property:${property.id}`,
      actionTaken: `Created routine inspection due task (${monthsSinceLastStr})`,
      wasAutoExecuted: false,
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
// Process a single user
// ---------------------------------------------------------------------------

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

  // Load user's properties (to scope all queries)
  const { data: properties, error: propErr } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', userId)
    .is('deleted_at', null);

  if (propErr) {
    allErrors.push(`Failed to load properties for user ${userId}: ${propErr.message}`);
    return { tasksCreated: 0, actionsAutoExecuted: 0, errors: allErrors };
  }

  const propertyIds = (properties || []).map((p: any) => p.id);

  // Load autonomy settings
  const { data: autonomySettings } = await supabase
    .from('agent_autonomy_settings')
    .select('preset, category_overrides')
    .eq('user_id', userId)
    .single();

  // Run all scanners
  const leaseResult = await scanLeaseExpiry(supabase, userId, propertyIds);
  totalTasksCreated += leaseResult.tasksCreated;
  allErrors.push(...leaseResult.errors);

  const arrearsResult = await scanOverdueRent(
    supabase,
    userId,
    propertyIds,
    autonomySettings as AutonomySettings | null,
  );
  totalTasksCreated += arrearsResult.tasksCreated;
  totalAutoExecuted += arrearsResult.autoExecuted;
  allErrors.push(...arrearsResult.errors);

  const appsResult = await scanNewApplications(supabase, userId);
  totalTasksCreated += appsResult.tasksCreated;
  allErrors.push(...appsResult.errors);

  const staleResult = await scanStaleListings(supabase, userId);
  totalTasksCreated += staleResult.tasksCreated;
  allErrors.push(...staleResult.errors);

  const inspectionResult = await scanInspectionsDue(supabase, userId, propertyIds);
  totalTasksCreated += inspectionResult.tasksCreated;
  allErrors.push(...inspectionResult.errors);

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

    // Verify authorization (cron secret or admin JWT)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('X-Cron-Secret');

    let isAuthorized = false;

    if (cronSecret && providedSecret === cronSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
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

    for (const userId of userIds) {
      try {
        const userResult = await processUser(supabase, userId);

        result.processed++;
        result.tasks_created += userResult.tasksCreated;
        result.actions_auto_executed += userResult.actionsAutoExecuted;

        if (userResult.errors.length > 0) {
          result.errors.push(
            ...userResult.errors.map((e) => `[user:${userId}] ${e}`),
          );
        }
      } catch (err: any) {
        console.error(`Error processing user ${userId}:`, err);
        result.processed++;
        result.errors.push(`[user:${userId}] Unhandled error: ${err.message}`);
      }
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
