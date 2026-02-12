// Stripe Webhook Handler - Supabase Edge Function
// Casa - Mission 07: Rent Collection & Payments
//
// Handles all Stripe webhook events:
// - payment_intent.succeeded / payment_intent.payment_failed
// - setup_intent.succeeded
// - account.updated (Connect)
// - invoice.* (Subscriptions)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { getStripeClient, getStripeWebhookSecret } from '../_shared/stripe.ts';

serve(async (req: Request) => {
  // Webhooks don't need CORS handling for OPTIONS - they're server-to-server
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const stripe = getStripeClient();
    const supabase = getServiceClient();

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        getStripeWebhookSecret()
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(supabase, event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(supabase, event.data.object);
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(supabase, stripe, event.data.object);
        break;

      case 'account.updated':
        await handleAccountUpdated(supabase, event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(supabase, event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabase, event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// Handler for successful payments
async function handlePaymentIntentSucceeded(supabase: any, paymentIntent: any) {
  const { id, metadata, charges } = paymentIntent;
  const tenancyId = metadata?.casa_tenancy_id;
  const rentScheduleId = metadata?.casa_rent_schedule_id;

  if (!tenancyId) {
    console.log('Payment not from Casa (no tenancy ID in metadata)');
    return;
  }

  // Get charge details
  const charge = charges?.data?.[0];
  const receiptUrl = charge?.receipt_url;
  const chargeId = charge?.id;
  const transferId = paymentIntent.transfer_data?.destination;

  // Update payment record
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      stripe_charge_id: chargeId,
      stripe_transfer_id: transferId,
      receipt_url: receiptUrl,
      paid_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', id);

  if (updateError) {
    console.error('Error updating payment record:', updateError);
  }

  // Mark rent schedule as paid if applicable
  if (rentScheduleId) {
    const { data: payment } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', id)
      .single();

    if (payment) {
      await supabase
        .from('rent_schedules')
        .update({
          is_paid: true,
          paid_at: new Date().toISOString(),
          payment_id: payment.id,
        })
        .eq('id', rentScheduleId);
    }
  }

  console.log(`Payment ${id} completed successfully`);
}

// Handler for failed payments
async function handlePaymentIntentFailed(supabase: any, paymentIntent: any) {
  const { id, metadata, last_payment_error } = paymentIntent;
  const tenancyId = metadata?.casa_tenancy_id;

  if (!tenancyId) {
    console.log('Payment not from Casa (no tenancy ID in metadata)');
    return;
  }

  // Update payment record
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'failed',
      status_reason: last_payment_error?.message || 'Payment failed',
      failed_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', id);

  if (updateError) {
    console.error('Error updating payment record:', updateError);
  }

  console.log(`Payment ${id} failed: ${last_payment_error?.message}`);
}

// Handler for successful SetupIntent (saved payment method)
async function handleSetupIntentSucceeded(supabase: any, stripe: any, setupIntent: any) {
  const { payment_method: paymentMethodId, customer, metadata } = setupIntent;
  const userId = metadata?.casa_user_id;

  if (!userId || !paymentMethodId) {
    console.log('SetupIntent not from Casa or missing payment method');
    return;
  }

  // Get payment method details from Stripe
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  // Determine payment method type and details
  const isCard = paymentMethod.type === 'card';
  const isBecs = paymentMethod.type === 'au_becs_debit';

  let methodDetails: any = {
    user_id: userId,
    stripe_payment_method_id: paymentMethodId,
    stripe_customer_id: customer,
    type: paymentMethod.type,
    is_default: false,
    is_autopay: false,
    is_active: true,
    autopay_days_before: 1,
  };

  if (isCard) {
    methodDetails.last_four = paymentMethod.card?.last4;
    methodDetails.brand = paymentMethod.card?.brand;
  } else if (isBecs) {
    methodDetails.last_four = paymentMethod.au_becs_debit?.last4;
    methodDetails.bank_name = paymentMethod.au_becs_debit?.fingerprint ? 'Bank Account' : null;
    methodDetails.becs_mandate_status = 'active';
  }

  // Check if this is the first payment method (make it default)
  const { count } = await supabase
    .from('payment_methods')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (count === 0) {
    methodDetails.is_default = true;
  }

  // Save payment method
  const { error: insertError } = await supabase
    .from('payment_methods')
    .insert(methodDetails);

  if (insertError) {
    console.error('Error saving payment method:', insertError);
  }

  console.log(`Payment method ${paymentMethodId} saved for user ${userId}`);
}

// Handler for Connect account updates
async function handleAccountUpdated(supabase: any, account: any) {
  const { id, charges_enabled, payouts_enabled, details_submitted, metadata } = account;
  const ownerId = metadata?.casa_owner_id;

  // Update by Stripe account ID (more reliable than metadata)
  const { error: updateError } = await supabase
    .from('owner_stripe_accounts')
    .update({
      charges_enabled,
      payouts_enabled,
      details_submitted,
    })
    .eq('stripe_account_id', id);

  if (updateError) {
    console.error('Error updating Connect account:', updateError);
  }

  console.log(`Connect account ${id} updated: charges=${charges_enabled}, payouts=${payouts_enabled}`);
}

// Handler for subscription updates
async function handleSubscriptionUpdated(supabase: any, subscription: any) {
  const { customer, status, metadata, items } = subscription;

  // Get owner by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customer)
    .single();

  if (!profile) {
    console.log('No Casa user found for Stripe customer:', customer);
    return;
  }

  // Map Stripe status to our status
  let subscriptionStatus: string;
  switch (status) {
    case 'trialing':
      subscriptionStatus = 'trialing';
      break;
    case 'active':
      subscriptionStatus = 'active';
      break;
    case 'past_due':
      subscriptionStatus = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      subscriptionStatus = 'cancelled';
      break;
    default:
      subscriptionStatus = 'active';
  }

  // Determine tier from price/product metadata
  const priceId = items?.data?.[0]?.price?.id;
  let tier = 'starter'; // default

  // Map price IDs to tiers
  const starterPriceId = Deno.env.get('STRIPE_PRICE_STARTER');
  const proPriceId = Deno.env.get('STRIPE_PRICE_PRO');
  const handsOffPriceId = Deno.env.get('STRIPE_PRICE_HANDS_OFF');

  if (priceId === handsOffPriceId) {
    tier = 'hands_off';
  } else if (priceId === proPriceId) {
    tier = 'pro';
  } else if (priceId === starterPriceId) {
    tier = 'starter';
  }

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_status: subscriptionStatus,
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error('Error updating subscription:', updateError);
  }

  console.log(`Subscription updated for user ${profile.id}: tier=${tier}, status=${subscriptionStatus}`);
}

// Handler for subscription deletion
async function handleSubscriptionDeleted(supabase: any, subscription: any) {
  const { customer } = subscription;

  // Get owner by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customer)
    .single();

  if (!profile) {
    console.log('No Casa user found for Stripe customer:', customer);
    return;
  }

  // Downgrade to starter
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_tier: 'starter',
      subscription_status: 'cancelled',
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error('Error updating cancelled subscription:', updateError);
  }

  console.log(`Subscription cancelled for user ${profile.id}`);
}

// Handler for successful invoice payment
async function handleInvoicePaymentSucceeded(supabase: any, invoice: any) {
  const { customer, subscription, amount_paid, receipt_number } = invoice;

  console.log(`Invoice payment succeeded for customer ${customer}, amount: ${amount_paid}`);
  // Additional logging or record-keeping can be added here
}

// Handler for failed invoice payment
async function handleInvoicePaymentFailed(supabase: any, invoice: any) {
  const { customer, subscription, amount_due, attempt_count } = invoice;

  console.log(`Invoice payment failed for customer ${customer}, amount: ${amount_due}, attempt: ${attempt_count}`);

  // After multiple failures, could trigger email notification or account action
  if (attempt_count >= 3) {
    // Get owner by stripe_customer_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customer)
      .single();

    if (profile) {
      await supabase
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('id', profile.id);
    }
  }
}
