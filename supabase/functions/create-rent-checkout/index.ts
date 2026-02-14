// Create Rent Checkout - Supabase Edge Function
// Creates a Stripe Checkout Session in payment mode for rent payments.
// Returns a URL that the mobile app opens in a WebBrowser.
// On success, Stripe redirects to the app's deep link.
// Webhook (payment_intent.succeeded) marks the payment as complete.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { getStripeClient, calculatePlatformFee, calculateStripeFee } from '../_shared/stripe.ts';

interface RentCheckoutRequest {
  tenancyId: string;
  amount: number; // Amount in cents
  paymentType?: 'rent' | 'bond' | 'utility' | 'maintenance' | 'fee' | 'other';
  description?: string;
  rentScheduleId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();
    const stripe = getStripeClient();

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RentCheckoutRequest = await req.json();
    const {
      tenancyId,
      amount,
      paymentType = 'rent',
      description,
      rentScheduleId,
      successUrl = 'casa-tenant://payments?success=true',
      cancelUrl = 'casa-tenant://payments?cancelled=true',
    } = body;

    // Validate required fields
    if (!tenancyId || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tenancyId, amount (in cents)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify tenant belongs to tenancy
    const { data: tenancyTenant, error: tenancyError } = await supabase
      .from('tenancy_tenants')
      .select('tenancy_id, tenancies!inner(id, property_id, properties!inner(owner_id))')
      .eq('tenant_id', user.id)
      .eq('tenancy_id', tenancyId)
      .single();

    if (tenancyError || !tenancyTenant) {
      return new Response(
        JSON.stringify({ error: 'Tenancy not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer for tenant
    let { data: tenantStripeCustomer } = await supabase
      .from('tenant_stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', user.id)
      .single();

    let stripeCustomerId: string;

    if (!tenantStripeCustomer) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || undefined,
        metadata: { casa_user_id: user.id },
      });

      stripeCustomerId = customer.id;

      await supabase.from('tenant_stripe_customers').insert({
        tenant_id: user.id,
        stripe_customer_id: stripeCustomerId,
      });
    } else {
      stripeCustomerId = tenantStripeCustomer.stripe_customer_id;
    }

    // Get owner's Stripe Connect account
    const ownerId = (tenancyTenant as any).tenancies.properties.owner_id;
    const { data: ownerStripeAccount } = await supabase
      .from('owner_stripe_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('owner_id', ownerId)
      .single();

    if (!ownerStripeAccount?.charges_enabled) {
      return new Response(
        JSON.stringify({ error: 'Your landlord has not yet set up their payment account. Please contact them to enable rent payments.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate fees — platform fee matches Stripe processing fee (owner bears cost)
    const platformFee = calculatePlatformFee(amount);
    const stripeFee = calculateStripeFee(amount);
    const lineItemDescription = description || `Rent payment`;

    // Create Stripe Checkout Session in payment mode
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      payment_method_types: ['card', 'au_becs_debit'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: lineItemDescription,
              description: `Payment via Casa`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee, // Matches Stripe fee — owner bears processing cost
        transfer_data: {
          destination: ownerStripeAccount.stripe_account_id,
        },
        metadata: {
          casa_tenancy_id: tenancyId,
          casa_tenant_id: user.id,
          casa_payment_type: paymentType,
          casa_rent_schedule_id: rentScheduleId || '',
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        casa_user_id: user.id,
        casa_tenancy_id: tenancyId,
        casa_payment_type: paymentType,
      },
    });

    // Create payment record in pending state (webhook will update to completed)
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        tenancy_id: tenancyId,
        tenant_id: user.id,
        payment_type: paymentType,
        amount,
        currency: 'aud',
        description: lineItemDescription,
        stripe_payment_intent_id: session.payment_intent as string || null,
        stripe_fee: stripeFee,
        platform_fee: platformFee,
        net_amount: amount - stripeFee,
        status: 'pending',
        due_date: rentScheduleId ? new Date().toISOString().split('T')[0] : null,
        metadata: {
          rent_schedule_id: rentScheduleId || null,
          checkout_session_id: session.id,
        },
      })
      .select('id')
      .single();

    return new Response(
      JSON.stringify({
        sessionUrl: session.url,
        sessionId: session.id,
        paymentId: payment?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating rent checkout:', error);
    // Surface Stripe-specific error messages for debugging
    const errorMessage = error?.raw?.message || error?.message || 'Internal server error';
    const errorCode = error?.code || error?.type || 'unknown';
    console.error(`Rent checkout error details — type: ${error?.type}, code: ${error?.code}, decline_code: ${error?.decline_code}, message: ${errorMessage}`);

    // Provide user-friendly error messages based on Stripe error types
    let userMessage = errorMessage;
    if (error?.type === 'StripeCardError') {
      userMessage = error.message || 'Your card was declined. Please try a different payment method.';
    } else if (error?.type === 'StripeInvalidRequestError') {
      userMessage = 'Payment configuration error. Please contact support.';
    } else if (error?.type === 'StripeConnectionError' || error?.type === 'StripeAPIError') {
      userMessage = 'Unable to connect to payment service. Please try again in a moment.';
    } else if (error?.type === 'StripeRateLimitError') {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    }

    // Return 200 with error field so client always receives the body
    return new Response(
      JSON.stringify({ success: false, error: userMessage, code: errorCode }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
