// Shared Stripe client for Edge Functions
// Casa - Mission 07: Rent Collection & Payments

import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }
  return secret;
}

// Platform fee: set to match Stripe processing fee so the owner bears the cost
// (deducted from owner's payout), and Casa doesn't absorb it.
// Casa's revenue model is subscription-only — this fee passthrough keeps Casa neutral.
export function calculatePlatformFee(amount: number): number {
  return calculateStripeFee(amount);
}

// Stripe fee calculation (1.75% + 30c for Australian domestic cards)
// BECS Direct Debit is cheaper (1% + 30c, capped at $3.50) but Stripe
// determines the actual fee based on payment method at charge time.
// We use the card rate as a conservative estimate for application_fee_amount.
// Any difference between estimated and actual Stripe fee is minor and in Casa's favour.
export function calculateStripeFee(amount: number): number {
  return Math.round(amount * 0.0175 + 30);
}
