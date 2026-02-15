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
      // BECS Direct Debit is not supported via Stripe Checkout in setup mode.
      // Instead, we accept the bank details (BSB + account number + name)
      // and create the PaymentMethod + SetupIntent server-side.
      const bsbNumber = body.bsbNumber;
      const accountNumber = body.accountNumber;
      const accountHolderName = body.accountHolderName;

      if (!bsbNumber || !accountNumber || !accountHolderName) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'BECS setup requires bsbNumber, accountNumber, and accountHolderName.',
            code: 'becs_missing_fields',
            requiresFields: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate BSB format (6 digits, optionally with a dash: 000-000)
      const bsbClean = bsbNumber.replace(/[-\s]/g, '');
      if (!/^\d{6}$/.test(bsbClean)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid BSB number. Must be 6 digits.', code: 'invalid_bsb' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate account number (5-9 digits for AU)
      const acctClean = accountNumber.replace(/[-\s]/g, '');
      if (!/^\d{5,9}$/.test(acctClean)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid account number. Must be 5-9 digits.', code: 'invalid_account' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create a PaymentMethod with BECS details
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'au_becs_debit',
        au_becs_debit: {
          bsb_number: bsbClean,
          account_number: acctClean,
        },
        billing_details: {
          name: accountHolderName,
          email: user.email,
        },
      });

      // Attach to customer
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: stripeCustomerId,
      });

      // Create and confirm a SetupIntent to establish the BECS mandate
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method: paymentMethod.id,
        payment_method_types: ['au_becs_debit'],
        confirm: true,
        mandate_data: {
          customer_acceptance: {
            type: 'online',
            online: {
              ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
              user_agent: req.headers.get('user-agent') || 'Casa App',
            },
          },
        },
        metadata: { casa_user_id: user.id },
      });

      if (setupIntent.status === 'succeeded') {
        // Save payment method to our table
        const { count } = await supabase
          .from('payment_methods')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true);

        await supabase
          .from('payment_methods')
          .insert({
            user_id: user.id,
            stripe_payment_method_id: paymentMethod.id,
            stripe_customer_id: stripeCustomerId,
            type: 'au_becs_debit',
            last_four: paymentMethod.au_becs_debit?.last4 || acctClean.slice(-4),
            bank_name: 'Bank Account',
            becs_mandate_status: 'active',
            is_default: (count || 0) === 0,
            is_autopay: false,
            is_active: true,
          });

        return new Response(
          JSON.stringify({
            success: true,
            mode: 'becs_saved',
            last4: paymentMethod.au_becs_debit?.last4 || acctClean.slice(-4),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `BECS setup status: ${setupIntent.status}. Please try again.`,
          code: 'setup_incomplete',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    if (!session.url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unable to create setup session. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
