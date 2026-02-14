// Process Auto-Pay - Supabase Edge Function
// Casa - Mission 07: Rent Collection & Payments
//
// Scheduled function to process automatic rent payments.
// Should be triggered daily via pg_cron or external scheduler.
// Processes payments for rent schedules due within the tenant's autopay window.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { getStripeClient, calculatePlatformFee, calculateStripeFee } from '../_shared/stripe.ts';

interface AutoPayResult {
  tenancyId: string;
  rentScheduleId: string;
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();
    const stripe = getStripeClient();

    // This can be called via:
    // 1. pg_cron scheduled job
    // 2. External scheduler (Cloudflare, etc.)
    // 3. Manual trigger with admin auth

    // Verify this is an authorized call (either internal or admin)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('X-Cron-Secret');

    // Allow if: valid cron secret OR valid admin JWT
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

    const results: AutoPayResult[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find all active autopay settings
    const { data: autopaySettings, error: settingsError } = await supabase
      .from('autopay_settings')
      .select(`
        id,
        tenancy_id,
        tenant_id,
        payment_method_id,
        days_before_due,
        max_amount,
        payment_methods!inner(
          stripe_payment_method_id,
          stripe_customer_id,
          is_active
        )
      `)
      .eq('is_enabled', true);

    if (settingsError) {
      console.error('Error fetching autopay settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch autopay settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${autopaySettings?.length || 0} active autopay configurations`);

    for (const settings of autopaySettings || []) {
      // Calculate the date range for this tenant's autopay
      const processDate = new Date(today);
      processDate.setDate(processDate.getDate() + settings.days_before_due);
      const processDateStr = processDate.toISOString().split('T')[0];

      // Find unpaid rent schedules due on the process date
      const { data: rentSchedules, error: scheduleError } = await supabase
        .from('rent_schedules')
        .select(`
          id,
          tenancy_id,
          due_date,
          amount,
          description,
          tenancies!inner(
            id,
            property_id,
            properties!inner(owner_id)
          )
        `)
        .eq('tenancy_id', settings.tenancy_id)
        .eq('is_paid', false)
        .eq('due_date', processDateStr);

      if (scheduleError) {
        console.error(`Error fetching rent schedules for tenancy ${settings.tenancy_id}:`, scheduleError);
        continue;
      }

      for (const schedule of rentSchedules || []) {
        // Check max_amount limit
        if (settings.max_amount && schedule.amount > settings.max_amount * 100) {
          results.push({
            tenancyId: settings.tenancy_id,
            rentScheduleId: schedule.id,
            success: false,
            error: `Amount ${schedule.amount} exceeds max autopay limit ${settings.max_amount * 100}`,
          });
          continue;
        }

        // Check if payment method is still active
        if (!(settings as any).payment_methods?.is_active) {
          results.push({
            tenancyId: settings.tenancy_id,
            rentScheduleId: schedule.id,
            success: false,
            error: 'Payment method is no longer active',
          });
          continue;
        }

        // Get owner's Connect account
        const ownerId = (schedule as any).tenancies.properties.owner_id;
        const { data: ownerAccount } = await supabase
          .from('owner_stripe_accounts')
          .select('stripe_account_id, charges_enabled')
          .eq('owner_id', ownerId)
          .single();

        if (!ownerAccount?.charges_enabled) {
          results.push({
            tenancyId: settings.tenancy_id,
            rentScheduleId: schedule.id,
            success: false,
            error: 'Owner Connect account not enabled for charges',
          });
          continue;
        }

        try {
          // Calculate fees
          const platformFee = calculatePlatformFee(schedule.amount);
          const stripeFee = calculateStripeFee(schedule.amount);

          // Create and confirm PaymentIntent
          const paymentIntent = await stripe.paymentIntents.create({
            amount: schedule.amount,
            currency: 'aud',
            customer: (settings as any).payment_methods.stripe_customer_id,
            payment_method: (settings as any).payment_methods.stripe_payment_method_id,
            description: schedule.description || 'Auto-pay rent payment',
            confirm: true, // Immediately attempt to charge
            off_session: true, // Payment made without customer present
            metadata: {
              casa_tenancy_id: settings.tenancy_id,
              casa_tenant_id: settings.tenant_id,
              casa_payment_type: 'rent',
              casa_rent_schedule_id: schedule.id,
              casa_autopay: 'true',
            },
            application_fee_amount: platformFee,
            transfer_data: {
              destination: ownerAccount.stripe_account_id,
            },
          });

          // Create payment record
          await supabase.from('payments').insert({
            tenancy_id: settings.tenancy_id,
            tenant_id: settings.tenant_id,
            payment_method_id: settings.payment_method_id,
            payment_type: 'rent',
            amount: schedule.amount,
            currency: 'aud',
            description: `Auto-pay: ${schedule.description || 'Rent payment'}`,
            stripe_payment_intent_id: paymentIntent.id,
            stripe_charge_id: paymentIntent.latest_charge as string,
            stripe_fee: stripeFee,
            platform_fee: platformFee,
            net_amount: schedule.amount - platformFee - stripeFee,
            status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
            due_date: schedule.due_date,
            paid_at: paymentIntent.status === 'succeeded' ? new Date().toISOString() : null,
            metadata: { rent_schedule_id: schedule.id, autopay: true },
          });

          // If payment succeeded immediately, update rent schedule
          if (paymentIntent.status === 'succeeded') {
            const { data: payment } = await supabase
              .from('payments')
              .select('id')
              .eq('stripe_payment_intent_id', paymentIntent.id)
              .single();

            await supabase
              .from('rent_schedules')
              .update({
                is_paid: true,
                paid_at: new Date().toISOString(),
                payment_id: payment?.id,
              })
              .eq('id', schedule.id);
          }

          results.push({
            tenancyId: settings.tenancy_id,
            rentScheduleId: schedule.id,
            success: true,
            paymentIntentId: paymentIntent.id,
          });

          console.log(`Auto-pay successful for rent schedule ${schedule.id}: ${paymentIntent.id}`);
        } catch (stripeError: any) {
          console.error(`Stripe error for rent schedule ${schedule.id}:`, stripeError.message);

          // Create failed payment record
          await supabase.from('payments').insert({
            tenancy_id: settings.tenancy_id,
            tenant_id: settings.tenant_id,
            payment_method_id: settings.payment_method_id,
            payment_type: 'rent',
            amount: schedule.amount,
            currency: 'aud',
            description: `Auto-pay failed: ${schedule.description || 'Rent payment'}`,
            status: 'failed',
            status_reason: stripeError.message,
            due_date: schedule.due_date,
            failed_at: new Date().toISOString(),
            metadata: { rent_schedule_id: schedule.id, autopay: true },
          });

          results.push({
            tenancyId: settings.tenancy_id,
            rentScheduleId: schedule.id,
            success: false,
            error: stripeError.message,
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Auto-pay processing complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Auto-pay processing error:', error);
    const errorMessage = error?.raw?.message || error?.message || 'Internal server error';
    console.error(`Auto-pay error — type: ${error?.type}, code: ${error?.code}, message: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage, code: error?.code || 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
