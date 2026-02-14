// Unit tests for subscription constants and payment calculations
// Mission 07: Rent Collection & Payments

import { describe, it, expect } from 'vitest';
import {
  SUBSCRIPTION_TIERS,
  ADD_ON_SERVICES,
  STRIPE_PRODUCTS,
  STRIPE_PRICES,
  PLATFORM_FEE_PERCENT,
  STRIPE_FEE_PERCENT,
  STRIPE_FEE_FIXED_CENTS,
  BECS_FEE_PERCENT,
  BECS_FEE_CAP_CENTS,
  PAYMENT_STATUS_CONFIG,
  TRIAL_PERIOD_DAYS,
  calculateStripeFee,
  calculatePlatformFee,
  calculateNetAmount,
  formatCurrency,
  formatDollars,
  calculateProRata,
} from '../constants/subscriptions';

describe('SUBSCRIPTION_TIERS', () => {
  it('should define all three tiers', () => {
    expect(SUBSCRIPTION_TIERS.starter).toBeDefined();
    expect(SUBSCRIPTION_TIERS.pro).toBeDefined();
    expect(SUBSCRIPTION_TIERS.hands_off).toBeDefined();
  });

  it('should have correct pricing', () => {
    expect(SUBSCRIPTION_TIERS.starter.price).toBe(49);
    expect(SUBSCRIPTION_TIERS.pro.price).toBe(89);
    expect(SUBSCRIPTION_TIERS.hands_off.price).toBe(149);
  });

  it('should have correct max properties', () => {
    expect(SUBSCRIPTION_TIERS.starter.maxProperties).toBe(3);
    expect(SUBSCRIPTION_TIERS.pro.maxProperties).toBe(10);
    expect(SUBSCRIPTION_TIERS.hands_off.maxProperties).toBe(Infinity);
  });

  it('should have formatted prices', () => {
    expect(SUBSCRIPTION_TIERS.starter.priceFormatted).toBe('$49/mo');
    expect(SUBSCRIPTION_TIERS.pro.priceFormatted).toBe('$89/mo');
    expect(SUBSCRIPTION_TIERS.hands_off.priceFormatted).toBe('$149/mo');
  });

  it('should have features list for each tier', () => {
    expect(SUBSCRIPTION_TIERS.starter.features.length).toBeGreaterThan(0);
    expect(SUBSCRIPTION_TIERS.pro.features.length).toBeGreaterThan(0);
    expect(SUBSCRIPTION_TIERS.hands_off.features.length).toBeGreaterThan(0);
  });

  it('should have stripe price IDs', () => {
    expect(SUBSCRIPTION_TIERS.starter.stripePriceId).toBe(STRIPE_PRICES.starter);
    expect(SUBSCRIPTION_TIERS.pro.stripePriceId).toBe(STRIPE_PRICES.pro);
    expect(SUBSCRIPTION_TIERS.hands_off.stripePriceId).toBe(STRIPE_PRICES.hands_off);
  });
});

describe('ADD_ON_SERVICES', () => {
  it('should define all six services', () => {
    expect(ADD_ON_SERVICES).toHaveLength(6);
  });

  it('should have correct types', () => {
    const types = ADD_ON_SERVICES.map(s => s.type);
    expect(types).toContain('tenant_finding');
    expect(types).toContain('professional_inspection');
    expect(types).toContain('open_home_hosting');
    expect(types).toContain('photography');
    expect(types).toContain('emergency_callout');
    expect(types).toContain('routine_inspection');
  });

  it('should have prices greater than zero', () => {
    ADD_ON_SERVICES.forEach(service => {
      expect(service.price).toBeGreaterThan(0);
      expect(service.priceFormatted).toMatch(/^\$\d+$/);
    });
  });

  it('should have name and description for each', () => {
    ADD_ON_SERVICES.forEach(service => {
      expect(service.name).toBeTruthy();
      expect(service.description).toBeTruthy();
    });
  });
});

describe('STRIPE_PRODUCTS', () => {
  it('should have product IDs for all tiers', () => {
    expect(STRIPE_PRODUCTS.starter).toBeTruthy();
    expect(STRIPE_PRODUCTS.pro).toBeTruthy();
    expect(STRIPE_PRODUCTS.hands_off).toBeTruthy();
  });
});

describe('PAYMENT_STATUS_CONFIG', () => {
  it('should have config for all statuses', () => {
    const statuses = ['scheduled', 'pending', 'completed', 'failed', 'cancelled', 'refunded'] as const;
    statuses.forEach(status => {
      expect(PAYMENT_STATUS_CONFIG[status]).toBeDefined();
      expect(PAYMENT_STATUS_CONFIG[status].label).toBeTruthy();
      expect(PAYMENT_STATUS_CONFIG[status].color).toMatch(/^#/);
      expect(PAYMENT_STATUS_CONFIG[status].bgColor).toMatch(/^#/);
    });
  });

  it('should show "Paid" for completed status', () => {
    expect(PAYMENT_STATUS_CONFIG.completed.label).toBe('Paid');
  });
});

describe('calculateStripeFee', () => {
  it('should calculate card fee correctly', () => {
    // $500 payment = 500 * 100 = 50000 cents
    // Fee = 50000 * 1.75% + 30 = 875 + 30 = 905 cents = $9.05
    const fee = calculateStripeFee(50000, false);
    expect(fee).toBe(905);
  });

  it('should calculate BECS fee correctly', () => {
    // $500 payment = 50000 cents
    // Fee = 50000 * 1.0% = 500 cents = $5.00
    // But capped at $3.50 = 350 cents
    const fee = calculateStripeFee(50000, true);
    expect(fee).toBe(350);
  });

  it('should not cap BECS fee below the cap', () => {
    // $200 payment = 20000 cents
    // Fee = 20000 * 1.0% = 200 cents = $2.00 (below $3.50 cap)
    const fee = calculateStripeFee(20000, true);
    expect(fee).toBe(200);
  });

  it('should handle small card amounts', () => {
    // $10 payment = 1000 cents
    // Fee = 1000 * 1.75% + 30 = 18 + 30 = 48 cents
    const fee = calculateStripeFee(1000, false);
    expect(fee).toBe(48);
  });
});

describe('calculatePlatformFee', () => {
  it('should return 0 (subscription-only revenue model)', () => {
    const fee = calculatePlatformFee(50000);
    expect(fee).toBe(0);
  });

  it('should return 0 for any amount', () => {
    const fee = calculatePlatformFee(3333);
    expect(fee).toBe(0);
  });
});

describe('calculateNetAmount', () => {
  it('should subtract Stripe fee only from card payment (0% platform fee)', () => {
    // $500 = 50000 cents
    // Stripe fee (card) = 905 cents
    // Platform fee = 0 cents
    // Net = 50000 - 905 - 0 = 49095 cents = $490.95
    const net = calculateNetAmount(50000, false);
    expect(net).toBe(49095);
  });

  it('should subtract Stripe fee only from BECS payment (0% platform fee)', () => {
    // $500 = 50000 cents
    // BECS fee = 350 cents (capped)
    // Platform fee = 0 cents
    // Net = 50000 - 350 - 0 = 49650 cents = $496.50
    const net = calculateNetAmount(50000, true);
    expect(net).toBe(49650);
  });

  it('should be less than gross amount', () => {
    const gross = 50000;
    expect(calculateNetAmount(gross, false)).toBeLessThan(gross);
    expect(calculateNetAmount(gross, true)).toBeLessThan(gross);
  });

  it('BECS should have lower fees than card for larger amounts', () => {
    const amount = 50000; // $500
    const netBecs = calculateNetAmount(amount, true);
    const netCard = calculateNetAmount(amount, false);
    expect(netBecs).toBeGreaterThan(netCard);
  });
});

describe('formatCurrency', () => {
  it('should format cents to dollars', () => {
    expect(formatCurrency(50000)).toBe('$500.00');
    expect(formatCurrency(12345)).toBe('$123.45');
    expect(formatCurrency(100)).toBe('$1.00');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle fractional cents with rounding', () => {
    expect(formatCurrency(99)).toBe('$0.99');
    expect(formatCurrency(1)).toBe('$0.01');
  });
});

describe('formatDollars', () => {
  it('should format dollar amounts', () => {
    expect(formatDollars(500)).toBe('$500.00');
    expect(formatDollars(49.99)).toBe('$49.99');
    expect(formatDollars(0)).toBe('$0.00');
  });

  it('should handle decimal precision', () => {
    expect(formatDollars(123.4)).toBe('$123.40');
    expect(formatDollars(99.9)).toBe('$99.90');
  });
});

describe('calculateProRata', () => {
  it('should calculate pro-rata for partial week', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-04'); // 3 days
    const weeklyRent = 700; // $700/week = $100/day
    const proRata = calculateProRata(weeklyRent, start, end, 'weekly');
    expect(proRata).toBe(300); // 3 * $100
  });

  it('should calculate full week correctly', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-08'); // 7 days
    const weeklyRent = 350;
    const proRata = calculateProRata(weeklyRent, start, end, 'weekly');
    expect(proRata).toBe(350);
  });

  it('should handle zero-day period', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-01'); // 0 days
    const weeklyRent = 500;
    const proRata = calculateProRata(weeklyRent, start, end, 'weekly');
    expect(proRata).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-02'); // 1 day
    const weeklyRent = 500; // $500/7 = $71.4285.../day
    const proRata = calculateProRata(weeklyRent, start, end, 'weekly');
    // $71.43 (rounded)
    expect(proRata).toBe(71.43);
  });
});

describe('Constants values', () => {
  it('should have valid fee percentages', () => {
    expect(PLATFORM_FEE_PERCENT).toBe(0);
    expect(STRIPE_FEE_PERCENT).toBe(1.75);
    expect(BECS_FEE_PERCENT).toBe(1.0);
  });

  it('should have valid fixed fees', () => {
    expect(STRIPE_FEE_FIXED_CENTS).toBe(30);
    expect(BECS_FEE_CAP_CENTS).toBe(350);
  });

  it('should have 14-day trial', () => {
    expect(TRIAL_PERIOD_DAYS).toBe(14);
  });
});
