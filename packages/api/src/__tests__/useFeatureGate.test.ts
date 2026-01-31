// Unit tests for useFeatureGate hook
// Mission 02 Phase F: Subscription Tier & Feature Gating

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeatureGate, checkFeatureAccess } from '../hooks/useFeatureGate';
import type { Profile } from '../types/database';

// Helper to create a profile with a specific tier
function makeProfile(tier: 'starter' | 'pro' | 'hands_off'): Profile {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    full_name: 'Test User',
    phone: null,
    avatar_url: null,
    role: 'owner',
    subscription_tier: tier,
    subscription_status: 'active',
    stripe_customer_id: null,
    trial_ends_at: null,
    onboarding_completed: true,
    preferences: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('useFeatureGate', () => {
  describe('boolean features', () => {
    it('starter has NO access to tenantFinding', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('starter'), 'tenantFinding')
      );
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredTier).toBe('pro');
      expect(result.current.currentTier).toBe('starter');
    });

    it('pro HAS access to tenantFinding', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('pro'), 'tenantFinding')
      );
      expect(result.current.hasAccess).toBe(true);
      expect(result.current.requiredTier).toBeNull();
    });

    it('hands_off HAS access to tenantFinding', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('hands_off'), 'tenantFinding')
      );
      expect(result.current.hasAccess).toBe(true);
    });

    it('starter has NO access to professionalInspections', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('starter'), 'professionalInspections')
      );
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredTier).toBe('hands_off');
    });

    it('pro has NO access to professionalInspections', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('pro'), 'professionalInspections')
      );
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.requiredTier).toBe('hands_off');
    });

    it('hands_off HAS access to professionalInspections', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('hands_off'), 'professionalInspections')
      );
      expect(result.current.hasAccess).toBe(true);
    });

    it('all tiers have access to aiChat', () => {
      for (const tier of ['starter', 'pro', 'hands_off'] as const) {
        const { result } = renderHook(() =>
          useFeatureGate(makeProfile(tier), 'aiChat')
        );
        expect(result.current.hasAccess).toBe(true);
      }
    });

    it('all tiers have access to rentCollection', () => {
      for (const tier of ['starter', 'pro', 'hands_off'] as const) {
        const { result } = renderHook(() =>
          useFeatureGate(makeProfile(tier), 'rentCollection')
        );
        expect(result.current.hasAccess).toBe(true);
      }
    });
  });

  describe('string features (basic vs full)', () => {
    it('starter has limited leaseManagement (basic = no access)', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('starter'), 'leaseManagement')
      );
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.featureValue).toBe('basic');
      expect(result.current.requiredTier).toBe('pro');
    });

    it('pro has full leaseManagement', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('pro'), 'leaseManagement')
      );
      expect(result.current.hasAccess).toBe(true);
      expect(result.current.featureValue).toBe('full');
    });

    it('starter has limited arrears (reminders = no access)', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('starter'), 'arrears')
      );
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.featureValue).toBe('reminders');
    });

    it('pro has full arrears management', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('pro'), 'arrears')
      );
      expect(result.current.hasAccess).toBe(true);
      expect(result.current.featureValue).toBe('full');
    });

    it('starter has limited communications (basic = no access)', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('starter'), 'communications')
      );
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.featureValue).toBe('basic');
    });
  });

  describe('numeric features (maxProperties)', () => {
    it('starter has limited properties (3)', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('starter'), 'maxProperties')
      );
      expect(result.current.hasAccess).toBe(true); // has SOME access
      expect(result.current.featureValue).toBe(3);
    });

    it('pro has 10 properties', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('pro'), 'maxProperties')
      );
      expect(result.current.hasAccess).toBe(true);
      expect(result.current.featureValue).toBe(10);
    });

    it('hands_off has unlimited properties', () => {
      const { result } = renderHook(() =>
        useFeatureGate(makeProfile('hands_off'), 'maxProperties')
      );
      expect(result.current.hasAccess).toBe(true);
      expect(result.current.featureValue).toBe(Infinity);
    });
  });

  describe('null profile (unauthenticated/loading)', () => {
    it('defaults to starter tier when profile is null', () => {
      const { result } = renderHook(() =>
        useFeatureGate(null, 'tenantFinding')
      );
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.currentTier).toBe('starter');
    });

    it('still grants access to starter features when null', () => {
      const { result } = renderHook(() =>
        useFeatureGate(null, 'aiChat')
      );
      expect(result.current.hasAccess).toBe(true);
    });
  });
});

describe('checkFeatureAccess (non-hook utility)', () => {
  it('correctly checks boolean features', () => {
    expect(checkFeatureAccess('starter', 'tenantFinding')).toBe(false);
    expect(checkFeatureAccess('pro', 'tenantFinding')).toBe(true);
    expect(checkFeatureAccess('hands_off', 'tenantFinding')).toBe(true);
  });

  it('correctly checks string features', () => {
    expect(checkFeatureAccess('starter', 'leaseManagement')).toBe(false);
    expect(checkFeatureAccess('pro', 'leaseManagement')).toBe(true);
  });

  it('correctly checks numeric features', () => {
    expect(checkFeatureAccess('starter', 'maxProperties')).toBe(true);
    expect(checkFeatureAccess('pro', 'maxProperties')).toBe(true);
  });
});

describe('tier feature matrix completeness', () => {
  const allFeatures = [
    'maxProperties',
    'aiChat',
    'rentCollection',
    'maintenanceRequests',
    'basicReporting',
    'tenantFinding',
    'professionalInspections',
    'leaseManagement',
    'communications',
    'arrears',
  ] as const;

  it('every feature is defined for every tier', () => {
    const { TIER_FEATURES } = require('@casa/config');
    for (const tier of ['starter', 'pro', 'hands_off'] as const) {
      for (const feature of allFeatures) {
        expect(TIER_FEATURES[tier][feature]).toBeDefined();
      }
    }
  });

  it('higher tiers have equal or better access than lower tiers', () => {
    // Pro should have everything Starter has, plus more
    const { TIER_FEATURES } = require('@casa/config');
    for (const feature of allFeatures) {
      const starterVal = TIER_FEATURES.starter[feature];
      const proVal = TIER_FEATURES.pro[feature];
      const handsOffVal = TIER_FEATURES.hands_off[feature];

      // If starter has access, pro and hands_off must too
      if (starterVal === true) {
        expect(proVal).toBe(true);
        expect(handsOffVal).toBe(true);
      }
      if (starterVal === 'full') {
        expect(proVal).toBe('full');
        expect(handsOffVal).toBe('full');
      }

      // If pro has access, hands_off must too
      if (proVal === true) {
        expect(handsOffVal).toBe(true);
      }
      if (proVal === 'full') {
        expect(handsOffVal).toBe('full');
      }

      // Numeric: higher tiers >= lower tiers
      if (typeof starterVal === 'number') {
        expect(proVal).toBeGreaterThanOrEqual(starterVal);
        expect(handsOffVal).toBeGreaterThanOrEqual(proVal);
      }
    }
  });

  it('tier pricing is in ascending order', () => {
    const { TIER_PRICES } = require('@casa/config');
    expect(TIER_PRICES.starter).toBeLessThan(TIER_PRICES.pro);
    expect(TIER_PRICES.pro).toBeLessThan(TIER_PRICES.hands_off);
  });

  it('tier pricing matches website values', () => {
    const { TIER_PRICES } = require('@casa/config');
    expect(TIER_PRICES.starter).toBe(49);
    expect(TIER_PRICES.pro).toBe(89);
    expect(TIER_PRICES.hands_off).toBe(149);
  });
});
