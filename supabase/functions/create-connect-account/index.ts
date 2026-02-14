// Create Connect Account - Supabase Edge Function
// Casa - Mission 07: Rent Collection & Payments
//
// Creates a Stripe Connect Express account for property owners
// and returns an onboarding link.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';

interface CreateConnectAccountRequest {
  refreshUrl: string; // URL to redirect if onboarding link expires
  returnUrl: string; // URL to redirect after onboarding
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
    const body: CreateConnectAccountRequest = await req.json();
    const { refreshUrl, returnUrl } = body;

    if (!refreshUrl || !returnUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: refreshUrl, returnUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get owner profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name, role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only property owners can create Connect accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing Connect account
    let { data: existingAccount, error: lookupError } = await supabase
      .from('owner_stripe_accounts')
      .select('stripe_account_id, details_submitted, charges_enabled')
      .eq('owner_id', user.id)
      .maybeSingle();

    // Log any lookup error but continue (may be first time)
    if (lookupError) {
      console.error('Error looking up existing account:', lookupError);
    }

    let stripeAccountId = '';

    if (existingAccount) {
      stripeAccountId = existingAccount.stripe_account_id;

      // Verify the Stripe account still exists
      try {
        const stripeAcct = await stripe.accounts.retrieve(stripeAccountId);
        // If already fully onboarded, return success
        if (existingAccount.details_submitted && existingAccount.charges_enabled) {
          return new Response(
            JSON.stringify({
              success: true,
              alreadyOnboarded: true,
              accountId: stripeAccountId,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (retrieveError: any) {
        // Stripe account doesn't exist or was deleted — clean up and create new
        console.error('Existing Stripe account invalid, creating new:', retrieveError?.message);
        await supabase
          .from('owner_stripe_accounts')
          .delete()
          .eq('owner_id', user.id);
        existingAccount = null;
      }
    }

    if (!existingAccount) {
      // Create new Express account
      // Note: We only request card_payments and transfers capabilities.
      // BECS Direct Debit is handled at the platform level — the connected
      // account receives payouts via transfers, it doesn't need to accept
      // BECS payments directly.
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        email: profile?.email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        business_profile: {
          mcc: '6513', // Real estate agents and managers
          product_description: 'Residential property rental payments',
        },
        metadata: {
          casa_owner_id: user.id,
        },
      });

      stripeAccountId = account.id;

      // Save account record
      await supabase.from('owner_stripe_accounts').insert({
        owner_id: user.id,
        stripe_account_id: stripeAccountId,
        account_type: 'express',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        payout_schedule: 'daily',
      });
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
      collect: 'eventually_due',
    });

    return new Response(
      JSON.stringify({
        success: true,
        onboardingUrl: accountLink.url,
        accountId: stripeAccountId,
        expiresAt: accountLink.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating connect account:', error);
    const errorMessage = error?.raw?.message || error?.message || 'Internal server error';
    const errorCode = error?.code || error?.type || 'unknown';
    console.error(`Error details — type: ${error?.type}, code: ${error?.code}, message: ${errorMessage}`);

    // Return 200 with error field so the client always receives the response body.
    // (supabase.functions.invoke swallows the body on non-2xx responses and only
    //  surfaces a generic "non-2xx status code" message — losing the actual error.)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, code: errorCode }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
