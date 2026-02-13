// Process Email Queue - Supabase Edge Function
// Processes pending emails from TWO sources:
//   1. email_notifications — created by DB triggers (application events, payment events, lease events)
//   2. email_queue — created by agent heartbeat + tool handlers (proactive agent emails)
// Triggered every 5 minutes via pg_cron.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { sendEmail, EMAIL_TEMPLATES } from '../_shared/email.ts';

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

// Generate branded HTML for agent emails that don't use pre-built templates
function generateAgentEmailHtml(subject: string, templateName: string, templateData: Record<string, any>): string {
  const bodyContent = templateData.body || templateData.message || templateData.description || '';
  const recipientName = templateData.recipient_name || templateData.tenant_name || templateData.owner_name || '';
  const propertyAddress = templateData.property_address || templateData.address || '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;}
.container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;}
.header{background:#1a1a2e;padding:24px 32px;}.header h1{color:#ffffff;margin:0;font-size:20px;font-weight:600;}
.body{padding:32px;color:#333333;line-height:1.6;font-size:15px;}
.body p{margin:0 0 16px 0;}.greeting{font-size:16px;font-weight:500;margin-bottom:8px;}
.property-tag{display:inline-block;background:#f0f0f5;padding:4px 12px;border-radius:4px;font-size:13px;color:#666;margin-bottom:16px;}
.footer{padding:24px 32px;background:#f9f9fb;text-align:center;font-size:12px;color:#999;}
.footer a{color:#666;text-decoration:none;}</style></head>
<body><div class="container">
<div class="header"><h1>Casa</h1></div>
<div class="body">
${recipientName ? `<p class="greeting">Hi ${recipientName},</p>` : ''}
${propertyAddress ? `<span class="property-tag">${propertyAddress}</span>` : ''}
${bodyContent ? `<p>${bodyContent.replace(/\n/g, '</p><p>')}</p>` : `<p>${subject}</p>`}
</div>
<div class="footer">
<p>Sent by Casa &mdash; your AI property manager</p>
<p><a href="https://www.casaapp.com.au">casaapp.com.au</a></p>
</div></div></body></html>`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Verify this is an authorized call
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('X-Cron-Secret');
    const authHeader = req.headers.get('Authorization');

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

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // ───────────────────────────────────────────────────────────────────
    // Pipeline 1: email_notifications (DB trigger emails — 5 templates)
    // ───────────────────────────────────────────────────────────────────

    const { data: notifications, error: notifError } = await supabase
      .from('email_notifications')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (notifError) {
      console.error('Error fetching email_notifications:', notifError);
      results.errors.push(`email_notifications fetch: ${notifError.message}`);
    }

    for (const notification of notifications || []) {
      results.processed++;

      try {
        let emailContent: { subject: string; htmlContent: string };
        const data = notification.template_data as Record<string, any>;

        switch (notification.notification_type) {
          case 'application_received':
            emailContent = EMAIL_TEMPLATES.applicationReceived(data);
            break;
          case 'application_status_update':
            emailContent = EMAIL_TEMPLATES.applicationStatusUpdate(data);
            break;
          case 'payment_received':
            emailContent = EMAIL_TEMPLATES.paymentReceived(data);
            break;
          case 'payment_reminder':
            emailContent = EMAIL_TEMPLATES.paymentReminder(data);
            break;
          case 'lease_expiring_soon':
            emailContent = EMAIL_TEMPLATES.leaseExpiringSoon(data);
            break;
          default:
            throw new Error(`Unknown notification type: ${notification.notification_type}`);
        }

        const result = await sendEmail({
          to: notification.recipient_email,
          toName: notification.recipient_name,
          subject: emailContent.subject,
          htmlContent: emailContent.htmlContent,
        });

        if (result.success) {
          await supabase
            .from('email_notifications')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', notification.id);
          results.sent++;
          console.log(`[notifications] Sent: ${notification.id} (${notification.notification_type})`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error: any) {
        const newRetryCount = (notification.retry_count || 0) + 1;
        const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
        await supabase
          .from('email_notifications')
          .update({ status: newStatus, retry_count: newRetryCount, error_message: error.message })
          .eq('id', notification.id);
        results.failed++;
        results.errors.push(`notif:${notification.id}: ${error.message}`);
        console.error(`[notifications] Failed: ${notification.id} - ${error.message}`);
      }
    }

    // ───────────────────────────────────────────────────────────────────
    // Pipeline 2: email_queue (agent heartbeat + tool handler emails)
    // ───────────────────────────────────────────────────────────────────

    const { data: queuedEmails, error: queueError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (queueError) {
      console.error('Error fetching email_queue:', queueError);
      results.errors.push(`email_queue fetch: ${queueError.message}`);
    }

    for (const queued of queuedEmails || []) {
      results.processed++;

      try {
        // Agent emails may include pre-rendered html_content or need template rendering
        const htmlContent = queued.html_content || generateAgentEmailHtml(
          queued.subject,
          queued.template_name,
          (queued.template_data as Record<string, any>) || {},
        );

        const result = await sendEmail({
          to: queued.to_email,
          toName: queued.to_name || undefined,
          subject: queued.subject,
          htmlContent,
        });

        if (result.success) {
          await supabase
            .from('email_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', queued.id);
          results.sent++;
          console.log(`[queue] Sent: ${queued.id} (${queued.template_name})`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error: any) {
        const newRetryCount = (queued.retry_count || 0) + 1;
        const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
        await supabase
          .from('email_queue')
          .update({ status: newStatus, retry_count: newRetryCount, error_message: error.message })
          .eq('id', queued.id);
        results.failed++;
        results.errors.push(`queue:${queued.id}: ${error.message}`);
        console.error(`[queue] Failed: ${queued.id} - ${error.message}`);
      }
    }

    console.log(`Email processing complete: ${results.sent} sent, ${results.failed} failed (${(notifications?.length || 0)} notifications + ${(queuedEmails?.length || 0)} queued)`);

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing email queue:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
