// Process Scheduled Messages Edge Function
// Mission 12: In-App Communications
// Runs on a cron schedule to send pending scheduled messages (PM transition sequence)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all scheduled messages that are due
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .lte('scheduled_for', now)
      .is('sent_at', null)
      .is('cancelled_at', null)
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending scheduled messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const scheduled of pendingMessages) {
      try {
        // Insert the message into the messages table
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            conversation_id: scheduled.conversation_id,
            sender_id: scheduled.sender_id,
            content: scheduled.content,
            content_type: scheduled.content_type || 'text',
            status: 'sent',
            metadata: {
              ...(scheduled.metadata || {}),
              scheduled_message_id: scheduled.id,
              was_scheduled: true,
            },
          });

        if (insertError) {
          console.error(`Failed to send scheduled message ${scheduled.id}:`, insertError);
          failed++;
          continue;
        }

        // Mark as sent
        await supabase
          .from('scheduled_messages')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', scheduled.id);

        // Increment template usage if linked to a template
        if (scheduled.template_id) {
          const { data: tmpl } = await supabase
            .from('message_templates')
            .select('usage_count')
            .eq('id', scheduled.template_id)
            .single();

          if (tmpl) {
            await supabase
              .from('message_templates')
              .update({ usage_count: (tmpl.usage_count || 0) + 1 })
              .eq('id', scheduled.template_id);
          }
        }

        processed++;
      } catch (err) {
        console.error(`Error processing scheduled message ${scheduled.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        failed,
        total: pendingMessages.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Process scheduled messages error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
