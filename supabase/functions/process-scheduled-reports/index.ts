// Process Scheduled Reports - Supabase Edge Function
// Casa - Mission 13: Reports & Analytics
//
// Cron-triggered function that checks for scheduled reports due to run,
// creates generated_report records, triggers report generation, and sends emails.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { sendEmail } from '../_shared/email.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const sb = getServiceClient();
    const now = new Date();

    // Find all active scheduled reports that are due to run
    const { data: dueReports, error: fetchError } = await sb
      .from('scheduled_reports')
      .select('*')
      .eq('is_active', true)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`);

    if (fetchError) {
      console.error('Error fetching scheduled reports:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!dueReports || dueReports.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const schedule of dueReports) {
      try {
        // Calculate date range based on frequency
        const dateTo = now.toISOString().split('T')[0];
        let dateFrom: string;

        switch (schedule.frequency) {
          case 'weekly':
            dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case 'monthly':
            dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];
            break;
          case 'quarterly':
            dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0];
            break;
          case 'yearly':
            dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
            break;
          default:
            dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];
        }

        // Create a generated_report record
        const { data: reportRow, error: insertError } = await sb
          .from('generated_reports')
          .insert({
            owner_id: schedule.owner_id,
            report_type: schedule.report_type,
            title: `${schedule.title} - ${new Date(dateTo).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`,
            property_ids: schedule.property_ids,
            date_from: dateFrom,
            date_to: dateTo,
            format: schedule.format,
            status: 'generating',
          })
          .select()
          .single();

        if (insertError || !reportRow) {
          results.push({ id: schedule.id, status: 'error', error: insertError?.message || 'Failed to create report' });
          continue;
        }

        // Invoke the generate-report Edge Function
        const { error: fnError } = await sb.functions.invoke('generate-report', {
          body: { report_id: (reportRow as any).id },
        });

        if (fnError) {
          results.push({ id: schedule.id, status: 'generation_failed', error: fnError.message });
          continue;
        }

        // Send email notification to all recipients
        for (const emailTo of schedule.email_to) {
          const { data: owner } = await sb.from('profiles')
            .select('full_name').eq('id', schedule.owner_id).single();

          await sendEmail({
            to: emailTo,
            toName: (owner as any)?.full_name || undefined,
            subject: `Scheduled Report Ready: ${schedule.title}`,
            htmlContent: `
              <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); padding: 24px 32px; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 22px;">Scheduled Report Ready</h1>
                </div>
                <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px;">
                  <p style="color: #1B2B4B; font-size: 16px;">Your scheduled report is ready:</p>
                  <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 0; font-weight: 600; color: #1B2B4B;">${schedule.title}</p>
                    <p style="margin: 4px 0 0; color: #6B7280; font-size: 14px;">
                      Period: ${dateFrom} to ${dateTo} | Format: ${schedule.format.toUpperCase()}
                    </p>
                  </div>
                  <p style="color: #6B7280; font-size: 14px;">Log in to Casa to view and download your report.</p>
                </div>
              </div>
            `,
          });
        }

        // Calculate next run time
        let nextRunAt: Date;
        switch (schedule.frequency) {
          case 'weekly':
            nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            nextRunAt = new Date(now.getFullYear(), now.getMonth() + 1, schedule.day_of_month || 1);
            break;
          case 'quarterly':
            nextRunAt = new Date(now.getFullYear(), now.getMonth() + 3, schedule.day_of_month || 1);
            break;
          case 'yearly':
            nextRunAt = new Date(now.getFullYear() + 1, now.getMonth(), schedule.day_of_month || 1);
            break;
          default:
            nextRunAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        // Update the schedule with last_run_at and next_run_at
        await sb.from('scheduled_reports').update({
          last_run_at: now.toISOString(),
          next_run_at: nextRunAt.toISOString(),
        }).eq('id', schedule.id);

        results.push({ id: schedule.id, status: 'success' });
      } catch (err: any) {
        results.push({ id: schedule.id, status: 'error', error: err.message });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      results,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Process scheduled reports error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
