// Send Email - Supabase Edge Function
// Casa - Mission 05: Tenant Applications (Email Notifications)
//
// Generic email sending function that can be called from other functions
// or triggered by database webhooks/triggers.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { sendEmail, EMAIL_TEMPLATES } from '../_shared/sendgrid.ts';

type EmailType =
  | 'application_received'
  | 'application_status_update'
  | 'payment_received'
  | 'payment_reminder'
  | 'lease_expiring_soon'
  | 'custom';

interface SendEmailRequest {
  type: EmailType;
  to: string;
  toName?: string;
  data?: Record<string, unknown>;
  // For custom emails
  subject?: string;
  htmlContent?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Verify authentication (internal call or authenticated user)
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const providedKey = req.headers.get('X-Service-Role-Key');

    let isAuthorized = false;

    // Allow service role key for internal calls
    if (serviceRoleKey && providedKey === serviceRoleKey) {
      isAuthorized = true;
    } else if (authHeader) {
      // Validate JWT for user-initiated emails
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: SendEmailRequest = await req.json();
    const { type, to, toName, data } = body;

    if (!type || !to) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let emailContent: { subject: string; htmlContent: string };

    switch (type) {
      case 'application_received':
        emailContent = EMAIL_TEMPLATES.applicationReceived(data as any);
        break;

      case 'application_status_update':
        emailContent = EMAIL_TEMPLATES.applicationStatusUpdate(data as any);
        break;

      case 'payment_received':
        emailContent = EMAIL_TEMPLATES.paymentReceived(data as any);
        break;

      case 'payment_reminder':
        emailContent = EMAIL_TEMPLATES.paymentReminder(data as any);
        break;

      case 'lease_expiring_soon':
        emailContent = EMAIL_TEMPLATES.leaseExpiringSoon(data as any);
        break;

      case 'custom':
        if (!body.subject || !body.htmlContent) {
          return new Response(
            JSON.stringify({ error: 'Custom emails require subject and htmlContent' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        emailContent = { subject: body.subject, htmlContent: body.htmlContent };
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown email type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Send the email
    const result = await sendEmail({
      to,
      toName,
      subject: emailContent.subject,
      htmlContent: emailContent.htmlContent,
    });

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, messageId: result.messageId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
