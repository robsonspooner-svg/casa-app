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

// Platform fee calculation (2.5% of transaction)
export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * 0.025);
}

// Stripe fee calculation (1.75% + 30c for Australian cards)
export function calculateStripeFee(amount: number): number {
  return Math.round(amount * 0.0175 + 30);
}
