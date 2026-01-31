// Config package validation tests
// Ensures the design system, subscription tiers, and app config are consistent

import { describe, it, expect } from 'vitest';
import {
  APP_CONFIG,
  THEME,
  TIER_FEATURES,
  TIER_PRICES,
  type SubscriptionTier,
  type SubscriptionStatus,
} from '../index';

describe('APP_CONFIG', () => {
  it('has correct app name', () => {
    expect(APP_CONFIG.name).toBe('Casa');
  });

  it('has a valid version format', () => {
    expect(APP_CONFIG.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has company name set', () => {
    expect(APP_CONFIG.company).toBeTruthy();
    expect(APP_CONFIG.company).toContain('Casa');
  });
});

describe('THEME', () => {
  describe('colors', () => {
    it('has Casa Navy as primary brand color', () => {
      expect(THEME.colors.brand).toBe('#1B1464');
    });

    it('has no pure black (#000000) in the palette', () => {
      const colorValues = Object.values(THEME.colors).filter(
        (v) => typeof v === 'string'
      ) as string[];
      for (const color of colorValues) {
        expect(color).not.toBe('#000000');
        expect(color).not.toBe('#000');
      }
    });

    it('has no pure white (#FFFFFF) as canvas background', () => {
      expect(THEME.colors.canvas).not.toBe('#FFFFFF');
      expect(THEME.colors.canvas).not.toBe('#FFF');
    });

    it('surface is white (for cards above canvas)', () => {
      expect(THEME.colors.surface).toBe('#FFFFFF');
    });

    it('has all required semantic colors', () => {
      expect(THEME.colors.success).toBeTruthy();
      expect(THEME.colors.successBg).toBeTruthy();
      expect(THEME.colors.warning).toBeTruthy();
      expect(THEME.colors.warningBg).toBeTruthy();
      expect(THEME.colors.error).toBeTruthy();
      expect(THEME.colors.errorBg).toBeTruthy();
      expect(THEME.colors.info).toBeTruthy();
      expect(THEME.colors.infoBg).toBeTruthy();
    });

    it('has valid hex color format for all colors', () => {
      const colorValues = Object.values(THEME.colors).filter(
        (v) => typeof v === 'string'
      ) as string[];
      for (const color of colorValues) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
      }
    });

    it('border focus uses brand color', () => {
      expect(THEME.colors.borderFocus).toBe(THEME.colors.brand);
    });
  });

  describe('spacing', () => {
    it('uses 4px base unit', () => {
      expect(THEME.spacing.xs).toBe(4);
    });

    it('spacing values are in ascending order', () => {
      const values = [
        THEME.spacing.xs,
        THEME.spacing.sm,
        THEME.spacing.md,
        THEME.spacing.base,
        THEME.spacing.lg,
        THEME.spacing.xl,
      ];
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });
  });

  describe('fontSize', () => {
    it('font sizes are in ascending order', () => {
      const sizes = [
        THEME.fontSize.caption,
        THEME.fontSize.bodySmall,
        THEME.fontSize.body,
        THEME.fontSize.h3,
        THEME.fontSize.h2,
        THEME.fontSize.h1,
        THEME.fontSize.display,
      ];
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      }
    });

    it('body text is readable (>= 14px)', () => {
      expect(THEME.fontSize.body).toBeGreaterThanOrEqual(14);
    });
  });

  describe('components', () => {
    it('button height is touch-friendly (>= 44px per Apple HIG)', () => {
      expect(THEME.components.button.height).toBeGreaterThanOrEqual(44);
    });

    it('input height is touch-friendly (>= 44px)', () => {
      expect(THEME.components.input.height).toBeGreaterThanOrEqual(44);
    });

    it('card has rounded corners', () => {
      expect(THEME.components.card.borderRadius).toBeGreaterThanOrEqual(8);
    });

    it('tab bar is tall enough for safe area (>= 60px)', () => {
      expect(THEME.components.tabBar.height).toBeGreaterThanOrEqual(60);
    });
  });

  describe('shadows', () => {
    it('shadow elevation increases from sm to lg', () => {
      expect(THEME.shadow.sm.elevation).toBeLessThan(THEME.shadow.md.elevation);
      expect(THEME.shadow.md.elevation).toBeLessThan(THEME.shadow.lg.elevation);
    });

    it('shadow opacity is subtle (< 0.15 for all)', () => {
      expect(THEME.shadow.sm.shadowOpacity).toBeLessThan(0.15);
      expect(THEME.shadow.md.shadowOpacity).toBeLessThan(0.15);
      expect(THEME.shadow.lg.shadowOpacity).toBeLessThan(0.15);
    });
  });
});

describe('TIER_FEATURES', () => {
  const tiers: SubscriptionTier[] = ['starter', 'pro', 'hands_off'];

  it('all three tiers are defined', () => {
    expect(TIER_FEATURES.starter).toBeDefined();
    expect(TIER_FEATURES.pro).toBeDefined();
    expect(TIER_FEATURES.hands_off).toBeDefined();
  });

  it('all tiers have identical feature keys', () => {
    const starterKeys = Object.keys(TIER_FEATURES.starter).sort();
    const proKeys = Object.keys(TIER_FEATURES.pro).sort();
    const handsOffKeys = Object.keys(TIER_FEATURES.hands_off).sort();
    expect(starterKeys).toEqual(proKeys);
    expect(proKeys).toEqual(handsOffKeys);
  });

  it('starter tier is most restrictive', () => {
    // Starter should have the fewest "true" boolean features
    const starterTrues = Object.values(TIER_FEATURES.starter).filter(v => v === true).length;
    const proTrues = Object.values(TIER_FEATURES.pro).filter(v => v === true).length;
    expect(proTrues).toBeGreaterThanOrEqual(starterTrues);
  });

  it('hands_off tier is least restrictive', () => {
    const handsOffTrues = Object.values(TIER_FEATURES.hands_off).filter(v => v === true).length;
    const proTrues = Object.values(TIER_FEATURES.pro).filter(v => v === true).length;
    expect(handsOffTrues).toBeGreaterThanOrEqual(proTrues);
  });

  it('no feature is worse at a higher tier', () => {
    const featureKeys = Object.keys(TIER_FEATURES.starter) as (keyof typeof TIER_FEATURES.starter)[];
    for (const key of featureKeys) {
      const s = TIER_FEATURES.starter[key];
      const p = TIER_FEATURES.pro[key];
      const h = TIER_FEATURES.hands_off[key];

      if (typeof s === 'boolean') {
        // If starter has it, all must have it
        if (s === true) {
          expect(p).toBe(true);
          expect(h).toBe(true);
        }
        // If pro has it, hands_off must have it
        if (p === true) {
          expect(h).toBe(true);
        }
      }

      if (typeof s === 'number') {
        expect(p as number).toBeGreaterThanOrEqual(s);
        expect(h as number).toBeGreaterThanOrEqual(p as number);
      }
    }
  });
});

describe('TIER_PRICES', () => {
  it('prices are in AUD and match website', () => {
    expect(TIER_PRICES.starter).toBe(49);
    expect(TIER_PRICES.pro).toBe(89);
    expect(TIER_PRICES.hands_off).toBe(149);
  });

  it('prices are strictly ascending', () => {
    expect(TIER_PRICES.starter).toBeLessThan(TIER_PRICES.pro);
    expect(TIER_PRICES.pro).toBeLessThan(TIER_PRICES.hands_off);
  });

  it('all prices are positive integers', () => {
    for (const price of Object.values(TIER_PRICES)) {
      expect(price).toBeGreaterThan(0);
      expect(Number.isInteger(price)).toBe(true);
    }
  });
});

describe('TypeScript type exports', () => {
  it('SubscriptionTier type covers all tiers', () => {
    const validTiers: SubscriptionTier[] = ['starter', 'pro', 'hands_off'];
    expect(validTiers).toHaveLength(3);
  });

  it('SubscriptionStatus type covers all states', () => {
    const validStatuses: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'cancelled'];
    expect(validStatuses).toHaveLength(4);
  });
});
