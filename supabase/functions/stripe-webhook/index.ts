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

    console.log(`Processing webhook event: ${event.type} (${event.id})`);

    // Idempotency: skip already-processed events
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existing) {
      console.log(`Skipping duplicate event: ${event.id}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Record event to prevent reprocessing
    await supabase
      .from('webhook_events')
      .insert({ event_id: event.id, event_type: event.type, processed_at: new Date().toISOString() })
      .catch(() => { /* table may not exist yet */ });

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

  // Dispatch notifications: owner payment received + tenant receipt
  if (tenancyId) {
    try {
      // Fetch context: tenancy → property → owner + tenant profiles
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select(`
          id,
          rent_amount,
          rent_frequency,
          properties!inner(
            id,
            owner_id,
            address_line_1,
            suburb,
            state,
            postcode
          ),
          tenancy_tenants(tenant_id)
        `)
        .eq('id', tenancyId)
        .single();

      if (tenancy) {
        const property = (tenancy as any).properties;
        const ownerId = property?.owner_id;
        const tenantIds = ((tenancy as any).tenancy_tenants || []).map((tt: any) => tt.tenant_id);
        const propertyAddress = [property?.address_line_1, property?.suburb, property?.state, property?.postcode].filter(Boolean).join(', ');

        // Get the amount from the payment intent (in cents → formatted)
        const amountCents = paymentIntent.amount || 0;
        const amountFormatted = `$${(amountCents / 100).toFixed(2)}`;
        const paymentDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

        // Get owner and tenant names
        const { data: ownerProfile } = ownerId ? await supabase
          .from('profiles')
          .select('full_name, first_name')
          .eq('id', ownerId)
          .single() : { data: null };

        // Notify owner: payment received
        if (ownerId) {
          const tenantName = tenantIds.length > 0
            ? await supabase.from('profiles').select('full_name').eq('id', tenantIds[0]).single().then((r: any) => r.data?.full_name || 'Your tenant')
            : 'Your tenant';

          await supabase.functions.invoke('dispatch-notification', {
            body: {
              user_id: ownerId,
              type: 'payment_received',
              title: 'Rent Payment Received',
              body: `${tenantName} paid ${amountFormatted} for ${propertyAddress}`,
              data: {
                owner_name: ownerProfile?.first_name || ownerProfile?.full_name || 'there',
                property_address: propertyAddress,
                tenant_name: tenantName,
                amount: amountFormatted,
              },
              related_type: 'payment',
              related_id: tenancyId,
              channels: ['push', 'email'],
            },
          });
        }

        // Notify tenant(s): rent receipt
        // Calculate next due date from rent_schedules
        let nextDueDate = '';
        if (rentScheduleId) {
          const { data: nextSchedule } = await supabase
            .from('rent_schedules')
            .select('due_date')
            .eq('tenancy_id', tenancyId)
            .eq('is_paid', false)
            .order('due_date', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (nextSchedule) {
            nextDueDate = new Date(nextSchedule.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
          }
        }

        for (const tid of tenantIds) {
          const { data: tenantProfile } = await supabase
            .from('profiles')
            .select('first_name, full_name')
            .eq('id', tid)
            .single();

          await supabase.functions.invoke('dispatch-notification', {
            body: {
              user_id: tid,
              type: 'rent_receipt',
              title: 'Rent Receipt',
              body: `Your payment of ${amountFormatted} for ${propertyAddress} has been received.`,
              data: {
                tenant_name: tenantProfile?.first_name || tenantProfile?.full_name || 'there',
                property_address: propertyAddress,
                amount: amountFormatted,
                payment_date: paymentDate,
                period: (tenancy as any).rent_frequency || 'weekly',
                next_due_date: nextDueDate || 'See your rent schedule',
              },
              related_type: 'payment',
              related_id: tenancyId,
              channels: ['push', 'email'],
            },
          });
        }

        // Check if arrears should be resolved for this tenancy
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: overdueCheck } = await supabase
          .from('rent_schedules')
          .select('id')
          .eq('tenancy_id', tenancyId)
          .eq('is_paid', false)
          .lt('due_date', todayStr)
          .limit(1);

        if (!overdueCheck || overdueCheck.length === 0) {
          // No more overdue payments — resolve any active arrears
          const { data: activeArrears } = await supabase
            .from('arrears_records')
            .select('id, tenant_id')
            .eq('tenancy_id', tenancyId)
            .eq('is_resolved', false);

          for (const arrears of activeArrears || []) {
            await supabase
              .from('arrears_records')
              .update({
                is_resolved: true,
                resolved_at: new Date().toISOString(),
                resolved_reason: 'All overdue payments received',
              })
              .eq('id', arrears.id);

            await supabase.from('arrears_actions').insert({
              arrears_record_id: arrears.id,
              action_type: 'payment_received',
              description: 'Arrears resolved - payment received via Stripe',
              is_automated: true,
            });

            // Notify tenant: arrears resolved
            if (arrears.tenant_id) {
              await supabase.functions.invoke('dispatch-notification', {
                body: {
                  user_id: arrears.tenant_id,
                  type: 'arrears_resolved',
                  title: 'Arrears Resolved',
                  body: `Your arrears for ${propertyAddress} have been cleared. Thank you for your payment.`,
                  data: {
                    tenant_name: '', // dispatch-notification looks up recipient name
                    property_address: propertyAddress,
                    amount: amountFormatted,
                  },
                  channels: ['push', 'email'],
                },
              });
            }

            // Notify owner: arrears resolved
            if (ownerId) {
              const tenantName = arrears.tenant_id
                ? await supabase.from('profiles').select('full_name').eq('id', arrears.tenant_id).single().then((r: any) => r.data?.full_name || 'Your tenant')
                : 'Your tenant';
              await supabase.functions.invoke('dispatch-notification', {
                body: {
                  user_id: ownerId,
                  type: 'arrears_resolved',
                  title: 'Arrears Resolved',
                  body: `${tenantName}'s arrears for ${propertyAddress} have been resolved.`,
                  data: {
                    recipient_name: ownerProfile?.first_name || 'there',
                    tenant_name: tenantName,
                    property_address: propertyAddress,
                    amount: amountFormatted,
                  },
                  channels: ['push', 'email'],
                },
              });
            }
          }
        }
      }
    } catch (notifErr) {
      // Notification dispatch is best-effort — don't fail the webhook
      console.error('Error dispatching payment notifications:', notifErr);
    }
  }

  console.log(`Payment ${id} completed successfully`);
}

// Handler for failed payments
async function handlePaymentIntentFailed(supabase: any, paymentIntent: any) {
  const { id, metadata, last_payment_error } = paymentIntent;
  const tenancyId = metadata?.casa_tenancy_id;
  const tenantId = metadata?.casa_tenant_id;
  const isAutopay = metadata?.casa_autopay === 'true';

  if (!tenancyId) {
    console.log('Payment not from Casa (no tenancy ID in metadata)');
    return;
  }

  // Map Stripe decline codes to human-readable messages
  const declineCode = last_payment_error?.decline_code;
  let failReason = last_payment_error?.message || 'Payment failed';
  if (declineCode === 'insufficient_funds') {
    failReason = 'Insufficient funds. Please try a different payment method or ensure sufficient balance.';
  } else if (declineCode === 'lost_card' || declineCode === 'stolen_card') {
    failReason = 'This card has been reported lost or stolen. Please use a different payment method.';
  } else if (declineCode === 'expired_card') {
    failReason = 'Your card has expired. Please update your payment method.';
  } else if (declineCode === 'card_declined' || declineCode === 'generic_decline') {
    failReason = 'Your card was declined. Please contact your bank or try a different payment method.';
  }

  // Update payment record
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'failed',
      status_reason: failReason,
      failed_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', id);

  if (updateError) {
    console.error('Error updating payment record:', updateError);
  }

  // Notify tenant about the failed payment
  if (tenantId) {
    try {
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('properties!inner(address_line_1, suburb)')
        .eq('id', tenancyId)
        .single();

      const address = tenancy
        ? [(tenancy as any).properties.address_line_1, (tenancy as any).properties.suburb].filter(Boolean).join(', ')
        : 'your property';

      const amountFormatted = `$${((paymentIntent.amount || 0) / 100).toFixed(2)}`;

      await supabase.functions.invoke('dispatch-notification', {
        body: {
          user_id: tenantId,
          type: isAutopay ? 'autopay_failed' : 'payment_failed',
          title: isAutopay ? 'Auto-Pay Failed' : 'Payment Failed',
          body: isAutopay
            ? `Your automatic payment of ${amountFormatted} for ${address} could not be processed. ${failReason}`
            : `Your payment of ${amountFormatted} for ${address} was not successful. ${failReason}`,
          data: {
            amount: amountFormatted,
            property_address: address,
            reason: failReason,
          },
          related_type: 'payment',
          related_id: tenancyId,
          channels: ['push', 'email'],
        },
      });
    } catch (notifErr) {
      console.error('Error dispatching payment failure notification:', notifErr);
    }
  }

  console.log(`Payment ${id} failed: ${failReason} (decline_code: ${declineCode})`);
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
