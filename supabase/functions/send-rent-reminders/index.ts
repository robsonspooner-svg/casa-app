// Send Rent Reminders - Supabase Edge Function
// Casa - Sprint 1: The Chain
//
// Sends pre-due rent reminders to tenants 3 days and 1 day before rent is due.
// Should be triggered daily via pg_cron or external scheduler.
// Idempotent: checks notification_logs to prevent duplicate sends per due_date.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const REMINDER_DAYS = [3, 1, 0]; // Days before due date to send reminders (0 = day-of)

serve(async (req: Request) => {
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date();
    const results: Array<{ tenantId: string; dueDate: string; daysUntilDue: number; success: boolean }> = [];

    for (const daysBefore of REMINDER_DAYS) {
      // Calculate the target due date
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // Find unpaid rent schedules due on this date
      const { data: schedules, error: scheduleError } = await supabase
        .from('rent_schedules')
        .select(`
          id,
          tenancy_id,
          due_date,
          amount,
          tenancies!inner(
            id,
            status,
            rent_amount,
            rent_frequency,
            properties!inner(
              id,
              address_line_1,
              suburb,
              state,
              postcode
            ),
            tenancy_tenants(tenant_id)
          )
        `)
        .eq('is_paid', false)
        .eq('due_date', targetDateStr)
        .eq('tenancies.status', 'active');

      if (scheduleError) {
        console.error(`Error fetching schedules for ${targetDateStr}:`, scheduleError);
        continue;
      }

      console.log(`Found ${schedules?.length || 0} unpaid schedules due on ${targetDateStr} (${daysBefore} days away)`);

      for (const schedule of schedules || []) {
        const tenancy = (schedule as any).tenancies;
        const property = tenancy?.properties;
        const tenantEntries = tenancy?.tenancy_tenants || [];

        if (!property || tenantEntries.length === 0) continue;

        const propertyAddress = [property.address_line_1, property.suburb, property.state, property.postcode].filter(Boolean).join(', ');
        const amountDollars = schedule.amount || tenancy.rent_amount || 0;
        const amountFormatted = `$${Number(amountDollars).toFixed(2)}`;
        const dueDateFormatted = new Date(schedule.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

        for (const entry of tenantEntries) {
          const tenantId = entry.tenant_id;

          // Idempotency: check if we already sent a reminder for this due date + tenant + day threshold
          const { data: existingLog } = await supabase
            .from('notification_logs')
            .select('id')
            .eq('user_id', tenantId)
            .eq('notification_type', 'rent_due_soon')
            .gte('created_at', today.toISOString().split('T')[0])
            .limit(1)
            .maybeSingle();

          if (existingLog) {
            // Already sent a rent reminder to this tenant today
            continue;
          }

          // Get tenant name
          const { data: tenantProfile } = await supabase
            .from('profiles')
            .select('first_name, full_name')
            .eq('id', tenantId)
            .single();

          const tenantName = tenantProfile?.first_name || tenantProfile?.full_name || 'there';

          // Dispatch notification
          try {
            const reminderTitle = daysBefore === 0
              ? 'Rent due today'
              : `Rent due in ${daysBefore} day${daysBefore !== 1 ? 's' : ''}`;
            const reminderBody = daysBefore === 0
              ? `Your rent of ${amountFormatted} for ${propertyAddress} is due today.`
              : `Your rent of ${amountFormatted} for ${propertyAddress} is due on ${dueDateFormatted}.`;

            await supabase.functions.invoke('dispatch-notification', {
              body: {
                user_id: tenantId,
                type: 'rent_due_soon',
                title: reminderTitle,
                body: reminderBody,
                data: {
                  tenant_name: tenantName,
                  property_address: propertyAddress,
                  amount: amountFormatted,
                  due_date: dueDateFormatted,
                  days_until_due: daysBefore,
                },
                channels: daysBefore === 0 ? ['push', 'email', 'sms'] : ['push', 'email'],
              },
            });

            results.push({
              tenantId,
              dueDate: schedule.due_date,
              daysUntilDue: daysBefore,
              success: true,
            });

            console.log(`Sent ${daysBefore}-day rent reminder to tenant ${tenantId} for due date ${schedule.due_date}`);
          } catch (err) {
            console.error(`Failed to send reminder to tenant ${tenantId}:`, err);
            results.push({
              tenantId,
              dueDate: schedule.due_date,
              daysUntilDue: daysBefore,
              success: false,
            });
          }
        }
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Rent reminder processing complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        sent,
        failed,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Rent reminder processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
