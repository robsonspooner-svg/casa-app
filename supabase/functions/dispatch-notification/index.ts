// Mission 17: Notification Dispatch Edge Function
// Accepts a notification payload and dispatches to appropriate channels:
// 1. Creates a record in the notifications table
// 2. Sends push notification via Expo Push API
// 3. Sends email via Resend (if enabled)
// 4. Logs delivery in notification_logs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getEmailHtml } from '../_shared/notification-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatchRequest {
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  related_type?: string;
  related_id?: string;
  channels?: ('push' | 'email' | 'sms')[];
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
  channelId?: string;
}

async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const messages: ExpoMessage[] = tokens.map(token => ({
    to: token,
    title,
    body,
    data,
    sound: 'default' as const,
    priority: 'high' as const,
    channelId: 'default',
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error('Expo push failed:', response.status);
      return { sent: 0, failed: tokens.length };
    }

    const result = await response.json();
    const data_array = Array.isArray(result.data) ? result.data : [result.data];
    const sent = data_array.filter((r: Record<string, string>) => r.status === 'ok').length;
    return { sent, failed: tokens.length - sent };
  } catch (err) {
    console.error('Expo push error:', err);
    return { sent: 0, failed: tokens.length };
  }
}

async function sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.warn('Resend API key not configured — skipping email');
    return false;
  }

  const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@casaapp.com.au';
  const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Casa';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: htmlContent,
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('Resend error:', err);
    return false;
  }
}

async function sendSMS(to: string, body: string): Promise<boolean> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio not configured — skipping SMS');
    return false;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Twilio SMS failed:', response.status, errorBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Twilio SMS error:', err);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload: DispatchRequest = await req.json();
    const { user_id, type, title, body: notifBody, data, related_type, related_id, channels } = payload;

    if (!type || !title || !notifBody) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle direct email dispatch (no user account required — e.g. tenant invitations)
    if (user_id === '__direct_email__' && data?.direct_email) {
      const directEmail = data.direct_email as string;
      const templateData = { ...data, recipient_name: (data.tenant_name as string) || 'there' };
      const { subject, htmlContent } = getEmailHtml(type, templateData as Record<string, unknown>);
      const emailSent = await sendEmail(directEmail, subject, htmlContent);

      return new Response(
        JSON.stringify({
          success: emailSent,
          channels: { email: emailSent },
          direct: true,
        }),
        {
          status: emailSent ? 200 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Create notification record
    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type,
        title,
        body: notifBody,
        data: data || null,
        related_type: related_type || null,
        related_id: related_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert notification:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create notification' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Determine which channels to use
    const requestedChannels = channels || ['push', 'email'];
    const results: Record<string, boolean> = {};

    // 3. Check user preferences for each channel
    for (const channel of requestedChannels) {
      let shouldSend = true;
      try {
        const { data, error: rpcError } = await supabase.rpc('should_notify', {
          p_user_id: user_id,
          p_notification_type: type,
          p_channel: channel,
        });
        if (rpcError) {
          console.warn(`should_notify RPC error for ${channel}:`, rpcError.message);
          // Default to sending if preference check fails
        } else {
          shouldSend = data !== false;
        }
      } catch (rpcErr) {
        console.warn(`should_notify RPC exception for ${channel}:`, rpcErr);
        // Default to sending if RPC is unavailable
      }

      if (!shouldSend) {
        results[channel] = false;
        continue;
      }

      if (channel === 'push') {
        // Get user's push tokens
        const { data: tokens } = await supabase
          .from('push_tokens')
          .select('token')
          .eq('user_id', user_id)
          .eq('is_active', true);

        if (tokens && tokens.length > 0) {
          const pushResult = await sendExpoPush(
            tokens.map((t: { token: string }) => t.token),
            title,
            notifBody,
            { type, related_type, related_id, notification_id: notification.id, ...data }
          );
          results.push = pushResult.sent > 0;

          if (pushResult.sent > 0) {
            await supabase
              .from('notifications')
              .update({ push_sent: true })
              .eq('id', notification.id);
          }

          // Log failures for debugging
          if (pushResult.failed > 0) {
            console.warn(`Push: ${pushResult.sent} sent, ${pushResult.failed} failed for user ${user_id}`);
          }
        } else {
          // No push tokens registered
          results.push = false;
        }
      }

      if (channel === 'email') {
        // Get user email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('id', user_id)
          .single();

        if (profile?.email) {
          const templateData = { ...data, recipient_name: profile.first_name || 'there', user_id };
          const { subject, htmlContent } = getEmailHtml(type, templateData as Record<string, unknown>);
          const emailSent = await sendEmail(profile.email, subject, htmlContent);
          results.email = emailSent;

          if (emailSent) {
            await supabase
              .from('notifications')
              .update({ email_sent: true })
              .eq('id', notification.id);
          }
        }
      }

      if (channel === 'sms') {
        // Get user phone number
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user_id)
          .single();

        if (profile?.phone) {
          const smsSent = await sendSMS(profile.phone, `${title}: ${notifBody}`);
          results.sms = smsSent;

          if (smsSent) {
            await supabase
              .from('notifications')
              .update({ sms_sent: true })
              .eq('id', notification.id);
          }
        } else {
          results.sms = false;
        }
      }
    }

    // 4. Log delivery — use accurate status based on channel results
    const anySuccess = Object.values(results).some(v => v === true);
    const allFailed = Object.keys(results).length > 0 && !anySuccess;
    await supabase.from('notification_logs').insert({
      user_id,
      notification_type: type,
      channel: requestedChannels.join(','),
      status: allFailed ? 'failed' : anySuccess ? 'sent' : 'skipped',
      metadata: { notification_id: notification.id, results },
    }).catch(() => { /* notification_logs may not exist yet */ });

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification.id,
        channels: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Dispatch error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
