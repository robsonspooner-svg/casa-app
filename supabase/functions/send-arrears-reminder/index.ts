// Send Arrears Reminder - Supabase Edge Function
// Casa - Mission 08: Arrears & Late Payment Management
//
// Sends templated payment reminders to tenants in arrears.
// Can be triggered:
// 1. Scheduled daily to send reminders based on days_overdue thresholds
// 2. Manually by owner via the arrears detail screen

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { sendEmail } from '../_shared/email.ts';

interface ReminderRequest {
  arrearsRecordId?: string; // For manual send
  scheduled?: boolean; // For scheduled runs
}

interface ReminderResult {
  arrearsRecordId: string;
  tenantEmail: string;
  templateUsed: string;
  success: boolean;
  error?: string;
}

// Variable substitution in template content
function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();
    const body: ReminderRequest = await req.json().catch(() => ({}));

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('X-Cron-Secret');

    let isAuthorized = false;
    let userId: string | null = null;

    if (cronSecret && providedSecret === cronSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        // For manual sends, verify user owns the property
        if (body.arrearsRecordId) {
          const { data: arrears } = await supabase
            .from('arrears_records')
            .select(`
              id,
              tenancies!inner(
                properties!inner(owner_id)
              )
            `)
            .eq('id', body.arrearsRecordId)
            .single();

          if ((arrears as any)?.tenancies?.properties?.owner_id === user.id) {
            isAuthorized = true;
          }
        }
        // Check for admin role for scheduled runs
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

    const results: ReminderResult[] = [];

    // Get reminder templates (ordered by days_overdue for threshold matching)
    const { data: templates } = await supabase
      .from('reminder_templates')
      .select('*')
      .eq('is_active', true)
      .eq('is_breach_notice', false)
      .order('days_overdue', { ascending: true });

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active reminder templates found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for arrears records to process
    let arrearsQuery = supabase
      .from('arrears_records')
      .select(`
        id,
        tenancy_id,
        tenant_id,
        days_overdue,
        total_overdue,
        first_overdue_date,
        tenancies!inner(
          id,
          properties!inner(
            id,
            address_line_1,
            suburb,
            state,
            postcode,
            owner_id,
            profiles!properties_owner_id_fkey(
              full_name,
              email
            )
          )
        ),
        profiles!arrears_records_tenant_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('is_resolved', false);

    if (body.arrearsRecordId) {
      // Manual send for specific arrears record
      arrearsQuery = arrearsQuery.eq('id', body.arrearsRecordId);
    }

    const { data: arrearsRecords, error: arrearsError } = await arrearsQuery;

    if (arrearsError) {
      console.error('Error fetching arrears records:', arrearsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch arrears records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${arrearsRecords?.length || 0} arrears records for reminders`);

    for (const arrears of arrearsRecords || []) {
      const tenant = (arrears as any).profiles;
      const tenancy = (arrears as any).tenancies;
      const property = tenancy?.properties;
      const owner = property?.profiles;

      if (!tenant?.email) {
        console.warn(`No email found for tenant ${arrears.tenant_id}`);
        continue;
      }

      // Find the appropriate template based on days_overdue
      let selectedTemplate = templates[0]; // Default to first template
      for (const template of templates) {
        if (arrears.days_overdue >= template.days_overdue) {
          selectedTemplate = template;
        } else {
          break;
        }
      }

      // For scheduled runs, check if this reminder threshold was already sent
      if (body.scheduled) {
        const { data: existingAction } = await supabase
          .from('arrears_actions')
          .select('id')
          .eq('arrears_record_id', arrears.id)
          .eq('template_used', selectedTemplate.name)
          .single();

        if (existingAction) {
          // Already sent this template for this arrears record
          continue;
        }
      }

      // Build template variables
      const propertyAddress = [
        property?.address_line_1,
        property?.suburb,
        property?.state,
        property?.postcode,
      ].filter(Boolean).join(', ');

      const variables: Record<string, string> = {
        tenant_name: tenant.full_name || 'Tenant',
        owner_name: owner?.full_name || 'Property Owner',
        property_address: propertyAddress,
        amount: `$${(arrears.total_overdue || 0).toFixed(2)}`,
        total_arrears: `$${(arrears.total_overdue || 0).toFixed(2)}`,
        days_overdue: String(arrears.days_overdue),
        due_date: new Date(arrears.first_overdue_date).toLocaleDateString('en-AU'),
        today: new Date().toLocaleDateString('en-AU'),
      };

      const subject = renderTemplate(selectedTemplate.subject, variables);
      const bodyText = renderTemplate(selectedTemplate.body, variables);

      // Convert plain text to HTML with proper formatting
      const htmlContent = `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); padding: 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Payment Reminder</h1>
          </div>
          <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 12px 12px;">
            ${bodyText.split('\n').map(line =>
              line.trim() ? `<p style="color: #1B2B4B; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${line}</p>` : '<br/>'
            ).join('')}
            <div style="margin-top: 24px;">
              <a href="https://www.casaapp.com.au/pay" style="display: inline-block; background: #1B2B4B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Pay Now
              </a>
            </div>
          </div>
        </div>
      `;

      // Send the email
      const emailResult = await sendEmail({
        to: tenant.email,
        toName: tenant.full_name,
        subject,
        htmlContent,
        textContent: bodyText,
      });

      if (emailResult.success) {
        // Log the action
        await supabase.from('arrears_actions').insert({
          arrears_record_id: arrears.id,
          action_type: 'reminder_email',
          description: `Sent ${selectedTemplate.name} reminder`,
          template_used: selectedTemplate.name,
          sent_to: tenant.email,
          sent_at: new Date().toISOString(),
          delivered: true,
          performed_by: userId,
          is_automated: !body.arrearsRecordId,
          metadata: { message_id: emailResult.messageId },
        });

        results.push({
          arrearsRecordId: arrears.id,
          tenantEmail: tenant.email,
          templateUsed: selectedTemplate.name,
          success: true,
        });

        console.log(`Sent reminder to ${tenant.email} for arrears ${arrears.id}`);
      } else {
        // Log failed attempt
        await supabase.from('arrears_actions').insert({
          arrears_record_id: arrears.id,
          action_type: 'reminder_email',
          description: `Failed to send ${selectedTemplate.name} reminder: ${emailResult.error}`,
          template_used: selectedTemplate.name,
          sent_to: tenant.email,
          sent_at: new Date().toISOString(),
          delivered: false,
          performed_by: userId,
          is_automated: !body.arrearsRecordId,
          metadata: { error: emailResult.error },
        });

        results.push({
          arrearsRecordId: arrears.id,
          tenantEmail: tenant.email,
          templateUsed: selectedTemplate.name,
          success: false,
          error: emailResult.error,
        });

        console.error(`Failed to send reminder to ${tenant.email}:`, emailResult.error);
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Reminder processing complete: ${sent} sent, ${failed} failed`);

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
    console.error('Reminder processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
