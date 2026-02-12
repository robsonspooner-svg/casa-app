// manage-subscription — Handles subscription creation, upgrades, downgrades, and cancellation
// Mission 20: Launch Preparation
// Integrates with Stripe Billing API

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';

interface SubscriptionRequest {
  action: 'create' | 'upgrade' | 'downgrade' | 'cancel' | 'resume' | 'get_portal_url';
  tier?: 'starter' | 'pro' | 'hands_off';
  user_id?: string;
}

// Stripe price IDs for each tier (configured in Stripe Dashboard)
const PRICE_MAP: Record<string, string> = {
  starter: Deno.env.get('STRIPE_PRICE_STARTER') || 'price_starter',
  pro: Deno.env.get('STRIPE_PRICE_PRO') || 'price_pro',
  hands_off: Deno.env.get('STRIPE_PRICE_HANDS_OFF') || 'price_hands_off',
};

async function stripeRequest(endpoint: string, method: string, body?: Record<string, string>) {
  const url = `https://api.stripe.com/v1${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const options: RequestInit = { method, headers };
  if (body) {
    options.body = new URLSearchParams(body).toString();
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Stripe API error: ${response.status}`);
  }

  return data;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SubscriptionRequest = await req.json();
    const { action, tier } = body;

    // Get user profile
    const { data: profile } = await supabase.from('profiles')
      .select('id, email, full_name, stripe_customer_id, subscription_tier, subscription_status')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: Record<string, unknown> = {};

    switch (action) {
      case 'create': {
        if (!tier) throw new Error('Tier is required');
        if (!STRIPE_SECRET_KEY) {
          throw new Error('Stripe is not configured. Please contact support.');
        }

        // Create or retrieve Stripe customer
        let customerId = profile.stripe_customer_id;
        if (!customerId) {
          const customer = await stripeRequest('/customers', 'POST', {
            email: profile.email || user.email || '',
            name: profile.full_name || '',
            'metadata[casa_user_id]': user.id,
          });
          customerId = customer.id;
          await supabase.from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', user.id);
        }

        // Create subscription
        const subscription = await stripeRequest('/subscriptions', 'POST', {
          customer: customerId,
          'items[0][price]': PRICE_MAP[tier],
          'trial_period_days': '14',
          'payment_behavior': 'default_incomplete',
          'expand[]': 'latest_invoice.payment_intent',
        });

        // Update profile
        await supabase.from('profiles').update({
          subscription_tier: tier,
          subscription_status: 'trialing',
          trial_ends_at: new Date(subscription.trial_end * 1000).toISOString(),
        }).eq('id', user.id);

        result = {
          success: true,
          subscription_id: subscription.id,
          client_secret: subscription.latest_invoice?.payment_intent?.client_secret,
          status: subscription.status,
        };
        break;
      }

      case 'upgrade':
      case 'downgrade': {
        if (!tier) throw new Error('Tier is required');
        if (!STRIPE_SECRET_KEY) {
          throw new Error('Stripe is not configured. Please contact support.');
        }

        if (!profile.stripe_customer_id) throw new Error('No active subscription');

        // Get current subscription
        const subs = await stripeRequest(
          `/subscriptions?customer=${profile.stripe_customer_id}&status=active&limit=1`,
          'GET'
        );

        if (!subs.data?.length) throw new Error('No active subscription found');

        const currentSub = subs.data[0];
        const currentItemId = currentSub.items.data[0].id;

        // Update subscription item to new price
        const proration = action === 'upgrade' ? 'create_prorations' : 'none';
        await stripeRequest(`/subscriptions/${currentSub.id}`, 'POST', {
          'items[0][id]': currentItemId,
          'items[0][price]': PRICE_MAP[tier],
          'proration_behavior': proration,
        });

        await supabase.from('profiles').update({
          subscription_tier: tier,
        }).eq('id', user.id);

        result = { success: true, tier };
        break;
      }

      case 'cancel': {
        if (!STRIPE_SECRET_KEY) {
          throw new Error('Stripe is not configured. Please contact support.');
        }

        if (!profile.stripe_customer_id) throw new Error('No active subscription');

        const activeSubs = await stripeRequest(
          `/subscriptions?customer=${profile.stripe_customer_id}&status=active&limit=1`,
          'GET'
        );

        if (!activeSubs.data?.length) throw new Error('No active subscription found');

        // Cancel at end of billing period
        await stripeRequest(`/subscriptions/${activeSubs.data[0].id}`, 'POST', {
          cancel_at_period_end: 'true',
        });

        await supabase.from('profiles').update({
          subscription_status: 'cancelled',
        }).eq('id', user.id);

        result = { success: true, cancel_at: activeSubs.data[0].current_period_end };
        break;
      }

      case 'resume': {
        if (!STRIPE_SECRET_KEY) {
          throw new Error('Stripe is not configured. Please contact support.');
        }

        if (!profile.stripe_customer_id) throw new Error('No subscription to resume');

        const cancelledSubs = await stripeRequest(
          `/subscriptions?customer=${profile.stripe_customer_id}&limit=1`,
          'GET'
        );

        if (!cancelledSubs.data?.length) throw new Error('No subscription found');

        await stripeRequest(`/subscriptions/${cancelledSubs.data[0].id}`, 'POST', {
          cancel_at_period_end: 'false',
        });

        await supabase.from('profiles').update({
          subscription_status: 'active',
        }).eq('id', user.id);

        result = { success: true };
        break;
      }

      case 'get_portal_url': {
        if (!STRIPE_SECRET_KEY) {
          throw new Error('Stripe is not configured. Please contact support.');
        }

        if (!profile.stripe_customer_id) throw new Error('No Stripe customer');

        const session = await stripeRequest('/billing_portal/sessions', 'POST', {
          customer: profile.stripe_customer_id,
          return_url: 'casa-owner://subscription',
        });

        result = { url: session.url };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
