// Create Payment Intent - Supabase Edge Function
// Casa - Mission 07: Rent Collection & Payments
//
// Creates a Stripe PaymentIntent for rent or other payments.
// Supports both card and BECS direct debit payment methods.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { getStripeClient, calculatePlatformFee, calculateStripeFee } from '../_shared/stripe.ts';

interface CreatePaymentIntentRequest {
  tenancyId: string;
  amount: number; // Amount in cents
  paymentType: 'rent' | 'bond' | 'utility' | 'maintenance' | 'fee' | 'other';
  description?: string;
  paymentMethodId?: string; // Optional - for saved payment methods
  rentScheduleId?: string; // Optional - link to rent schedule
}

serve(async (req: Request) => {
  // Handle CORS preflight
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

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreatePaymentIntentRequest = await req.json();
    const { tenancyId, amount, paymentType, description, paymentMethodId, rentScheduleId } = body;

    // Validate required fields
    if (!tenancyId || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tenancyId, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenancy and verify user is a tenant
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
      // Get tenant profile for customer creation
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || undefined,
        metadata: {
          casa_user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      // Save customer ID
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
        JSON.stringify({ error: 'Owner has not completed Stripe Connect onboarding' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Stripe account is fully ready to accept payments
    const stripeAccount = await stripe.accounts.retrieve(ownerStripeAccount.stripe_account_id);
    if (!stripeAccount.details_submitted) {
      return new Response(
        JSON.stringify({ error: 'Owner has not finished submitting Stripe Connect details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (stripeAccount.requirements?.currently_due && stripeAccount.requirements.currently_due.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Owner needs to complete outstanding Stripe requirements before accepting payments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate fees
    const platformFee = calculatePlatformFee(amount);
    const stripeFee = calculateStripeFee(amount);

    // Create PaymentIntent with Connect
    const paymentIntentParams: any = {
      amount,
      currency: 'aud',
      customer: stripeCustomerId,
      description: description || `${paymentType} payment for tenancy`,
      metadata: {
        casa_tenancy_id: tenancyId,
        casa_tenant_id: user.id,
        casa_payment_type: paymentType,
        casa_rent_schedule_id: rentScheduleId || '',
      },
      application_fee_amount: platformFee,
      transfer_data: {
        destination: ownerStripeAccount.stripe_account_id,
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    };

    // If a saved payment method is provided, attach it
    if (paymentMethodId) {
      // Get the Stripe payment method ID from our records
      const { data: savedMethod } = await supabase
        .from('payment_methods')
        .select('stripe_payment_method_id')
        .eq('id', paymentMethodId)
        .eq('user_id', user.id)
        .single();

      if (savedMethod) {
        paymentIntentParams.payment_method = savedMethod.stripe_payment_method_id;
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Create payment record in pending state
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        tenancy_id: tenancyId,
        tenant_id: user.id,
        payment_method_id: paymentMethodId || null,
        payment_type: paymentType,
        amount,
        currency: 'aud',
        description: description || `${paymentType} payment`,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_fee: stripeFee,
        platform_fee: platformFee,
        net_amount: amount - platformFee - stripeFee,
        status: 'pending',
        due_date: rentScheduleId ? new Date().toISOString().split('T')[0] : null,
        metadata: rentScheduleId ? { rent_schedule_id: rentScheduleId } : null,
      })
      .select('id')
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentId: payment?.id,
        amount,
        platformFee,
        stripeFee,
        netAmount: amount - platformFee - stripeFee,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    const errorMessage = error?.raw?.message || error?.message || 'Internal server error';
    console.error(`Payment intent error — type: ${error?.type}, code: ${error?.code}, decline_code: ${error?.decline_code}, message: ${errorMessage}`);

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

    return new Response(
      JSON.stringify({ error: userMessage, code: error?.code || 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
