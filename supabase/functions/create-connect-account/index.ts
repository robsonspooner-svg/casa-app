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
    let { data: existingAccount } = await supabase
      .from('owner_stripe_accounts')
      .select('stripe_account_id, details_submitted, charges_enabled')
      .eq('owner_id', user.id)
      .single();

    let stripeAccountId: string;

    if (existingAccount) {
      stripeAccountId = existingAccount.stripe_account_id;

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
    } else {
      // Create new Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        email: profile?.email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          au_becs_debit_payments: { requested: true },
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
    console.error(`Error details — type: ${error?.type}, code: ${error?.code}, message: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
