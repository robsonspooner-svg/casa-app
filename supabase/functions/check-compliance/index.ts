// Check Compliance Edge Function
// Scans all property_compliance records, updates statuses based on dates,
// and returns overdue/upcoming items. Called by agent-heartbeat or on-demand.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const upcomingThresholdDays = 30;
    const upcomingDate = new Date(now.getTime() + upcomingThresholdDays * 24 * 60 * 60 * 1000);

    // Fetch all active compliance items with their requirements
    const { data: items, error } = await supabase
      .from('property_compliance')
      .select('id, property_id, requirement_id, status, next_due_date, last_completed_at, compliance_requirements(name, frequency_months, is_mandatory)')
      .in('status', ['compliant', 'upcoming', 'pending', 'overdue']);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let overdueCount = 0;
    let upcomingCount = 0;
    let updatedCount = 0;

    for (const item of items || []) {
      if (!item.next_due_date) continue;

      const dueDate = new Date(item.next_due_date);
      let newStatus = item.status;

      if (dueDate < now) {
        newStatus = 'overdue';
        overdueCount++;
      } else if (dueDate <= upcomingDate) {
        newStatus = 'upcoming';
        upcomingCount++;
      } else if (item.last_completed_at) {
        newStatus = 'compliant';
      }

      if (newStatus !== item.status) {
        await supabase
          .from('property_compliance')
          .update({ status: newStatus })
          .eq('id', item.id);
        updatedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        checked: (items || []).length,
        updated: updatedCount,
        overdue: overdueCount,
        upcoming: upcomingCount,
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
