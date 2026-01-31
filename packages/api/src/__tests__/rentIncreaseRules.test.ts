// Unit tests for rent increase rules
// Mission 06: Tenancies & Leases

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RENT_INCREASE_RULES,
  TERMINATION_NOTICE_PERIODS,
  calculateMinimumEffectiveDate,
  canIncreaseRent,
} from '../constants/rentIncreaseRules';

describe('RENT_INCREASE_RULES', () => {
  it('should have rules for all Australian states and territories', () => {
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
    states.forEach(state => {
      expect(RENT_INCREASE_RULES[state]).toBeDefined();
      expect(RENT_INCREASE_RULES[state].minimumNoticeDays).toBeGreaterThan(0);
      expect(['6_months', '12_months']).toContain(RENT_INCREASE_RULES[state].maxFrequency);
      expect(RENT_INCREASE_RULES[state].tribunal).toBeTruthy();
    });
  });

  it('should have correct notice periods for key states', () => {
    expect(RENT_INCREASE_RULES.NSW.minimumNoticeDays).toBe(60);
    expect(RENT_INCREASE_RULES.VIC.minimumNoticeDays).toBe(60);
    expect(RENT_INCREASE_RULES.NT.minimumNoticeDays).toBe(30);
    expect(RENT_INCREASE_RULES.ACT.minimumNoticeDays).toBe(56);
  });

  it('should have correct frequency rules', () => {
    expect(RENT_INCREASE_RULES.NSW.maxFrequency).toBe('12_months');
    expect(RENT_INCREASE_RULES.QLD.maxFrequency).toBe('6_months');
    expect(RENT_INCREASE_RULES.WA.maxFrequency).toBe('6_months');
    expect(RENT_INCREASE_RULES.VIC.maxFrequency).toBe('12_months');
  });
});

describe('TERMINATION_NOTICE_PERIODS', () => {
  it('should have periods for all states', () => {
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
    states.forEach(state => {
      expect(TERMINATION_NOTICE_PERIODS[state]).toBeDefined();
      expect(TERMINATION_NOTICE_PERIODS[state].noGrounds).toBeGreaterThan(0);
      expect(TERMINATION_NOTICE_PERIODS[state].endOfLease).toBeGreaterThan(0);
      expect(TERMINATION_NOTICE_PERIODS[state].breach).toBeGreaterThan(0);
    });
  });

  it('should have breach periods shorter than no-grounds', () => {
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
    states.forEach(state => {
      expect(TERMINATION_NOTICE_PERIODS[state].breach).toBeLessThan(
        TERMINATION_NOTICE_PERIODS[state].noGrounds
      );
    });
  });
});

describe('calculateMinimumEffectiveDate', () => {
  it('should add NSW notice days (60) to notice date', () => {
    const noticeDate = new Date('2024-03-01');
    const result = calculateMinimumEffectiveDate('NSW', noticeDate);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(3); // April (0-indexed)
    expect(result.getDate()).toBe(30);
  });

  it('should add NT notice days (30) to notice date', () => {
    const noticeDate = new Date('2024-03-01');
    const result = calculateMinimumEffectiveDate('NT', noticeDate);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(31);
  });

  it('should add ACT notice days (56) to notice date', () => {
    const noticeDate = new Date('2024-01-01');
    const result = calculateMinimumEffectiveDate('ACT', noticeDate);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(26);
  });

  it('should throw for unknown state', () => {
    expect(() => calculateMinimumEffectiveDate('XX', new Date())).toThrow('Unknown state: XX');
  });

  it('should not mutate the original date', () => {
    const noticeDate = new Date('2024-03-01');
    const originalTime = noticeDate.getTime();
    calculateMinimumEffectiveDate('NSW', noticeDate);
    expect(noticeDate.getTime()).toBe(originalTime);
  });

  it('should handle month boundaries correctly', () => {
    const noticeDate = new Date('2024-12-15');
    const result = calculateMinimumEffectiveDate('NSW', noticeDate);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(13);
  });
});

describe('canIncreaseRent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow increase when no previous increase exists', () => {
    const result = canIncreaseRent('NSW', null, true, false);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should not allow increase during fixed term in NSW', () => {
    const result = canIncreaseRent('NSW', null, false, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('fixed-term lease');
    expect(result.reason).toContain('NSW');
  });

  it('should not allow increase during fixed term in VIC', () => {
    const result = canIncreaseRent('VIC', null, false, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('fixed-term lease');
  });

  it('should not allow increase if within 12-month window (NSW)', () => {
    const lastIncrease = new Date('2024-01-01'); // Only 5.5 months ago
    const result = canIncreaseRent('NSW', lastIncrease, true, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('12 months');
    expect(result.nextAllowedDate).toBeDefined();
    expect(result.nextAllowedDate!.getFullYear()).toBe(2025);
    expect(result.nextAllowedDate!.getMonth()).toBe(0); // January
  });

  it('should not allow increase if within 6-month window (QLD)', () => {
    const lastIncrease = new Date('2024-02-01'); // Only 4.5 months ago
    const result = canIncreaseRent('QLD', lastIncrease, true, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('6 months');
    expect(result.nextAllowedDate).toBeDefined();
    expect(result.nextAllowedDate!.getMonth()).toBe(7); // August
  });

  it('should allow increase if past 12-month window (NSW)', () => {
    const lastIncrease = new Date('2023-01-01'); // 18 months ago
    const result = canIncreaseRent('NSW', lastIncrease, true, false);
    expect(result.allowed).toBe(true);
  });

  it('should allow increase if past 6-month window (QLD)', () => {
    const lastIncrease = new Date('2023-11-01'); // 7.5 months ago
    const result = canIncreaseRent('QLD', lastIncrease, true, false);
    expect(result.allowed).toBe(true);
  });

  it('should return allowed: false for unknown state', () => {
    const result = canIncreaseRent('XX', null, true, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Unknown state');
  });

  it('should handle periodic tenancy with no fixed term restriction', () => {
    const result = canIncreaseRent('NSW', null, true, false);
    expect(result.allowed).toBe(true);
  });

  it('should return the correct next allowed date for WA (6 months)', () => {
    const lastIncrease = new Date('2024-04-01'); // 2.5 months ago
    const result = canIncreaseRent('WA', lastIncrease, true, false);
    expect(result.allowed).toBe(false);
    expect(result.nextAllowedDate!.getMonth()).toBe(9); // October
  });
});
