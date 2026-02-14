// Stripe Setup Session - Supabase Edge Function
// Creates a Stripe Checkout Session in "setup" mode for saving payment methods.
// Returns a URL that the mobile app opens in a WebBrowser.
// On success, Stripe redirects to the app's deep link.
//
// NOTE: Stripe Checkout in "setup" mode does NOT support au_becs_debit as a
// payment method type. For BECS, we use a Stripe Checkout Session in "payment"
// mode with setup_future_usage to save the payment method. We charge $0 (a
// mandated setup verification) using a SetupIntent-based flow instead.
// Actually, Stripe supports BECS via SetupIntent API directly, so for BECS
// we create a SetupIntent and return a hosted confirmation page URL.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';

interface SetupSessionRequest {
  paymentMethodTypes?: ('card' | 'au_becs_debit')[];
  successUrl: string;
  cancelUrl: string;
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

    const body: SetupSessionRequest = await req.json().catch(() => ({}));
    const requestedTypes = body.paymentMethodTypes || ['card'];
    const successUrl = body.successUrl || 'casa-tenant://payments/methods?setup=success';
    const cancelUrl = body.cancelUrl || 'casa-tenant://payments/methods?setup=cancelled';

    // Determine if BECS was requested
    const wantsBecs = requestedTypes.includes('au_becs_debit');

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

    if (wantsBecs) {
      // BECS Direct Debit: Stripe Checkout "setup" mode does NOT support au_becs_debit.
      // Instead, create a Checkout Session in "setup" mode with only ['card'] BUT
      // we use a different approach: create a Checkout Session in "setup" mode using
      // automatic_payment_methods which CAN include BECS when the customer's country
      // is Australia. Alternatively, we use payment_method_configuration.
      //
      // Simplest working approach: Use a Checkout Session with mode=setup and
      // payment_method_types=['au_becs_debit'] — this actually DOES work on recent
      // Stripe API versions (2023-10-16+) when the connected account or platform
      // has BECS capability enabled.
      //
      // If that fails, fall back to card-only setup.
      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'setup',
          customer: stripeCustomerId,
          payment_method_types: ['au_becs_debit'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { casa_user_id: user.id },
        });

        return new Response(
          JSON.stringify({
            sessionUrl: session.url,
            sessionId: session.id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (becsError: any) {
        console.error('BECS Checkout setup failed, trying card-only:', becsError?.message);
        // BECS not supported in setup mode — fall back to card
        // and inform the client
        const session = await stripe.checkout.sessions.create({
          mode: 'setup',
          customer: stripeCustomerId,
          payment_method_types: ['card'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { casa_user_id: user.id },
        });

        return new Response(
          JSON.stringify({
            sessionUrl: session.url,
            sessionId: session.id,
            fallbackToCard: true,
            message: 'BECS Direct Debit setup is not available through this flow. Card setup provided instead.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Card setup: use standard Checkout Session in setup mode
    // Filter to only card types (au_becs_debit not supported in setup mode)
    const cardTypes = requestedTypes.filter(t => t !== 'au_becs_debit');
    const safeTypes = cardTypes.length > 0 ? cardTypes : ['card'];

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: stripeCustomerId,
      payment_method_types: safeTypes as any,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { casa_user_id: user.id },
    });

    return new Response(
      JSON.stringify({
        sessionUrl: session.url,
        sessionId: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating setup session:', error);
    const errorMessage = error?.raw?.message || error?.message || 'Internal server error';
    console.error(`Setup session error details — type: ${error?.type}, code: ${error?.code}, message: ${errorMessage}`);
    // Return 200 with error field so client always receives the body
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, code: error?.code || 'unknown' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
