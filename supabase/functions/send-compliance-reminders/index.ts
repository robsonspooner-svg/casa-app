// Send Compliance Reminders Edge Function
// Finds overdue/upcoming compliance items and sends push notifications
// and emails to property owners. Called by pg_cron via agent-heartbeat.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find items that are overdue or due within 30 days (covers 30/14/7 day tiers)
    const { data: items, error } = await supabase
      .from('property_compliance')
      .select(`
        id, property_id, status, next_due_date,
        compliance_requirements(name, is_mandatory),
        properties(owner_id, address_line_1, suburb)
      `)
      .in('status', ['overdue', 'upcoming'])
      .lte('next_due_date', thirtyDaysOut.toISOString())
      .not('properties', 'is', null);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Group by owner
    const byOwner: Record<string, Array<typeof items[number]>> = {};
    for (const item of items || []) {
      const ownerId = (item as any).properties?.owner_id;
      if (!ownerId) continue;
      if (!byOwner[ownerId]) byOwner[ownerId] = [];
      byOwner[ownerId].push(item);
    }

    let notificationsSent = 0;

    for (const [ownerId, ownerItems] of Object.entries(byOwner)) {
      const overdueItems = ownerItems.filter(i => i.status === 'overdue');

      // Categorise upcoming items by urgency tier
      const urgentItems: typeof ownerItems = []; // due within 7 days
      const soonItems: typeof ownerItems = [];   // due within 14 days
      const earlyItems: typeof ownerItems = [];  // due within 30 days

      for (const item of ownerItems) {
        if (item.status === 'overdue') continue;
        const dueDate = item.next_due_date ? new Date(item.next_due_date).getTime() : 0;
        const daysUntil = Math.ceil((dueDate - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7) urgentItems.push(item);
        else if (daysUntil <= 14) soonItems.push(item);
        else earlyItems.push(item);
      }

      // Build notification with escalating urgency
      let title = 'Compliance Reminder';
      let body = '';

      if (overdueItems.length > 0) {
        title = 'Compliance: Action Required';
        body += `${overdueItems.length} OVERDUE item${overdueItems.length > 1 ? 's' : ''} need immediate attention. `;
      }
      if (urgentItems.length > 0) {
        if (!overdueItems.length) title = 'Compliance: Due This Week';
        body += `${urgentItems.length} item${urgentItems.length > 1 ? 's' : ''} due within 7 days. `;
      }
      if (soonItems.length > 0) {
        body += `${soonItems.length} item${soonItems.length > 1 ? 's' : ''} due within 14 days. `;
      }
      if (earlyItems.length > 0) {
        body += `${earlyItems.length} item${earlyItems.length > 1 ? 's' : ''} due within 30 days.`;
      }

      if (!body) continue;

      // Set priority for push notification
      const pushPriority = overdueItems.length > 0 || urgentItems.length > 0 ? 'high' : 'default';

      // Fetch owner profile for email and name
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', ownerId)
        .single();

      // Fetch push token from push_tokens table (not profiles)
      const { data: tokenRow } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', ownerId)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (tokenRow?.token) {
        try {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: tokenRow.token,
              title,
              body: body.trim(),
              data: { route: '/(app)/compliance' },
              sound: 'default',
              priority: pushPriority,
            }),
          });
          notificationsSent++;
        } catch { /* push is best-effort */ }
      }

      // Queue email reminder
      if (profile?.email) {
        const itemsList = ownerItems.map((item: any) => {
          const name = item.compliance_requirements?.name || 'Unknown';
          const addr = item.properties?.address_line_1 || '';
          const dueDate = item.next_due_date
            ? new Date(item.next_due_date).toLocaleDateString('en-AU')
            : 'Unknown';
          return `${name} at ${addr} — due ${dueDate} (${item.status})`;
        }).join('\n');

        const upcomingTotal = urgentItems.length + soonItems.length + earlyItems.length;
        const subjectParts: string[] = [];
        if (overdueItems.length > 0) subjectParts.push(`${overdueItems.length} overdue`);
        if (urgentItems.length > 0) subjectParts.push(`${urgentItems.length} due this week`);
        if (soonItems.length + earlyItems.length > 0) subjectParts.push(`${soonItems.length + earlyItems.length} upcoming`);

        await supabase.from('email_queue').insert({
          to_email: profile.email,
          to_name: profile.full_name || 'Property Owner',
          subject: `Compliance Reminder: ${subjectParts.join(', ')}`,
          template_name: 'compliance_reminder',
          template_data: {
            owner_name: profile.full_name || 'there',
            overdue_count: overdueItems.length,
            upcoming_count: upcomingTotal,
            urgent_count: urgentItems.length,
            items_list: itemsList,
          },
          status: 'pending',
        });
      }
    }

    return new Response(
      JSON.stringify({
        owners_notified: Object.keys(byOwner).length,
        notifications_sent: notificationsSent,
        total_items: (items || []).length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
