// Process Email Queue - Supabase Edge Function
// Casa - Mission 05: Tenant Applications (Email Notifications)
//
// Processes pending email notifications from the queue.
// Should be triggered regularly via pg_cron or external scheduler.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { sendEmail, EMAIL_TEMPLATES } from '../_shared/sendgrid.ts';

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

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

    // Fetch pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('email_notifications')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notifications' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${notifications?.length || 0} pending notifications`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const notification of notifications || []) {
      results.processed++;

      try {
        // Generate email content based on type
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

        // Send the email
        const result = await sendEmail({
          to: notification.recipient_email,
          toName: notification.recipient_name,
          subject: emailContent.subject,
          htmlContent: emailContent.htmlContent,
        });

        if (result.success) {
          // Mark as sent
          await supabase
            .from('email_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          results.sent++;
          console.log(`Email sent: ${notification.id} (${notification.notification_type})`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error: any) {
        // Mark as failed with retry
        const newRetryCount = (notification.retry_count || 0) + 1;
        const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';

        await supabase
          .from('email_notifications')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: error.message,
          })
          .eq('id', notification.id);

        results.failed++;
        results.errors.push(`${notification.id}: ${error.message}`);
        console.error(`Email failed: ${notification.id} - ${error.message}`);
      }
    }

    console.log(`Email queue processing complete: ${results.sent} sent, ${results.failed} failed`);

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
