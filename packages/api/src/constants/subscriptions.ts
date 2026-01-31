// Subscription & Payment Constants
// Mission 07: Rent Collection & Payments

import type { SubscriptionTier } from '../types/database';

// Stripe Product IDs (configured in Stripe Dashboard)
export const STRIPE_PRODUCTS = {
  starter: 'prod_casa_starter',
  pro: 'prod_casa_pro',
  hands_off: 'prod_casa_hands_off',
} as const;

// Stripe Price IDs (configured in Stripe Dashboard)
export const STRIPE_PRICES = {
  starter: 'price_casa_starter_monthly',
  pro: 'price_casa_pro_monthly',
  hands_off: 'price_casa_hands_off_monthly',
} as const;

// Subscription tier display info
export interface TierInfo {
  id: SubscriptionTier;
  name: string;
  price: number;
  priceFormatted: string;
  maxProperties: number;
  features: string[];
  stripePriceId: string;
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierInfo> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49,
    priceFormatted: '$49/mo',
    maxProperties: 3,
    features: [
      'AI property assistant',
      'Rent collection',
      'Maintenance requests',
      'Basic reporting',
      'Up to 3 properties',
    ],
    stripePriceId: STRIPE_PRICES.starter,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 89,
    priceFormatted: '$89/mo',
    maxProperties: 10,
    features: [
      'Everything in Starter',
      'Tenant finding',
      'Full lease management',
      'Full communications',
      'Full arrears management',
      'Up to 10 properties',
    ],
    stripePriceId: STRIPE_PRICES.pro,
  },
  hands_off: {
    id: 'hands_off',
    name: 'Hands-Off',
    price: 149,
    priceFormatted: '$149/mo',
    maxProperties: Infinity,
    features: [
      'Everything in Pro',
      'Professional inspections',
      'Unlimited properties',
      'Priority support',
    ],
    stripePriceId: STRIPE_PRICES.hands_off,
  },
};

// Add-on service types and pricing
export interface AddOnInfo {
  type: string;
  name: string;
  description: string;
  price: number;
  priceFormatted: string;
}

export const ADD_ON_SERVICES: AddOnInfo[] = [
  {
    type: 'tenant_finding',
    name: 'Tenant Finding',
    description: 'Professional tenant screening and placement',
    price: 79,
    priceFormatted: '$79',
  },
  {
    type: 'professional_inspection',
    name: 'Professional Inspection',
    description: 'Detailed property condition report with photos',
    price: 99,
    priceFormatted: '$99',
  },
  {
    type: 'open_home_hosting',
    name: 'Open Home Hosting',
    description: 'Professional open home management',
    price: 59,
    priceFormatted: '$59',
  },
  {
    type: 'photography',
    name: 'Property Photography',
    description: 'Professional real estate photography',
    price: 149,
    priceFormatted: '$149',
  },
  {
    type: 'emergency_callout',
    name: 'Emergency Callout',
    description: '24/7 emergency property callout service',
    price: 99,
    priceFormatted: '$99',
  },
  {
    type: 'routine_inspection',
    name: 'Routine Inspection',
    description: 'Scheduled routine inspection visit',
    price: 49,
    priceFormatted: '$49',
  },
];

// Platform fee percentage (charged on rent payments)
export const PLATFORM_FEE_PERCENT = 1.5;

// Stripe processing fee (passed to tenant)
export const STRIPE_FEE_PERCENT = 1.75;
export const STRIPE_FEE_FIXED_CENTS = 30; // $0.30

// BECS Direct Debit processing fee
export const BECS_FEE_PERCENT = 1.0;
export const BECS_FEE_CAP_CENTS = 350; // $3.50 cap

// Calculate Stripe fee for a given amount
export function calculateStripeFee(amountCents: number, isBecs: boolean): number {
  if (isBecs) {
    const fee = Math.round(amountCents * (BECS_FEE_PERCENT / 100));
    return Math.min(fee, BECS_FEE_CAP_CENTS);
  }
  return Math.round(amountCents * (STRIPE_FEE_PERCENT / 100)) + STRIPE_FEE_FIXED_CENTS;
}

// Calculate platform fee for a given amount
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

// Calculate net amount received by owner
export function calculateNetAmount(amountCents: number, isBecs: boolean): number {
  const stripeFee = calculateStripeFee(amountCents, isBecs);
  const platformFee = calculatePlatformFee(amountCents);
  return amountCents - stripeFee - platformFee;
}

// Format currency for display (AUD)
export function formatCurrency(amountCents: number): string {
  const dollars = amountCents / 100;
  return `$${dollars.toFixed(2)}`;
}

// Format currency from dollar amount
export function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Payment status display configuration
export const PAYMENT_STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: '#6366F1', bgColor: '#EEF2FF' },
  pending: { label: 'Pending', color: '#CA8A04', bgColor: '#FEFCE8' },
  completed: { label: 'Paid', color: '#16A34A', bgColor: '#F0FDF4' },
  failed: { label: 'Failed', color: '#DC2626', bgColor: '#FEF2F2' },
  cancelled: { label: 'Cancelled', color: '#525252', bgColor: '#F5F5F5' },
  refunded: { label: 'Refunded', color: '#2563EB', bgColor: '#EFF6FF' },
} as const;

// Trial period in days
export const TRIAL_PERIOD_DAYS = 14;

// Calculate pro-rata rent amount
export function calculateProRata(
  weeklyRent: number,
  startDate: Date,
  endDate: Date,
  frequency: 'weekly' | 'fortnightly' | 'monthly'
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
  const dailyRate = weeklyRent / 7;
  return Math.round(dailyRate * days * 100) / 100;
}
