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
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find items that are overdue or due within 7 days
    const { data: items, error } = await supabase
      .from('property_compliance')
      .select(`
        id, property_id, status, next_due_date,
        compliance_requirements(name, is_mandatory),
        properties(owner_id, address_line_1, suburb)
      `)
      .in('status', ['overdue', 'upcoming'])
      .lte('next_due_date', sevenDaysOut.toISOString())
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
      const upcomingItems = ownerItems.filter(i => i.status === 'upcoming');

      // Build notification message
      let body = '';
      if (overdueItems.length > 0) {
        body += `${overdueItems.length} overdue compliance item${overdueItems.length > 1 ? 's' : ''} need attention. `;
      }
      if (upcomingItems.length > 0) {
        body += `${upcomingItems.length} item${upcomingItems.length > 1 ? 's' : ''} due within 7 days.`;
      }

      if (!body) continue;

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
              title: 'Compliance Reminder',
              body: body.trim(),
              data: { route: '/(app)/compliance' },
              sound: 'default',
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

        await supabase.from('email_queue').insert({
          to_email: profile.email,
          to_name: profile.full_name || 'Property Owner',
          subject: `Compliance Reminder: ${overdueItems.length} overdue, ${upcomingItems.length} upcoming`,
          template_name: 'compliance_reminder',
          template_data: {
            owner_name: profile.full_name || 'there',
            overdue_count: overdueItems.length,
            upcoming_count: upcomingItems.length,
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
