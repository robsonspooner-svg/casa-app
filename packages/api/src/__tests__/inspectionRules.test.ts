// Unit tests for inspection rules and helper functions
// Mission 11: Property Inspections

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  INSPECTION_RULES,
  CONDITION_RATING_CONFIG,
  WEAR_AND_TEAR_GUIDELINES,
  PROFESSIONAL_INSPECTION_PRICING,
  getNoticeRequirement,
  isInspectionDue,
  getEarliestScheduleDate,
  getConditionSeverity,
  getWorstCondition,
} from '../constants/inspectionRules';
import type { ConditionRating, InspectionType } from '../types/database';

describe('INSPECTION_RULES', () => {
  const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'] as const;

  it('should have rules for all Australian states', () => {
    STATES.forEach(state => {
      expect(INSPECTION_RULES[state]).toBeDefined();
    });
  });

  it('should have valid routine interval months', () => {
    STATES.forEach(state => {
      const rules = INSPECTION_RULES[state];
      expect(rules.routineIntervalMonths).toBeGreaterThan(0);
      expect(rules.routineIntervalMonths).toBeLessThanOrEqual(12);
    });
  });

  it('should require 7 days notice for all states', () => {
    STATES.forEach(state => {
      expect(INSPECTION_RULES[state].routineNoticeDays).toBeGreaterThanOrEqual(7);
    });
  });

  it('should allow max 4 inspections per year', () => {
    STATES.forEach(state => {
      expect(INSPECTION_RULES[state].maxInspectionsPerYear).toBeLessThanOrEqual(4);
    });
  });

  it('QLD allows 3-monthly inspections', () => {
    expect(INSPECTION_RULES.QLD.routineIntervalMonths).toBe(3);
  });

  it('NSW requires 6-monthly inspections', () => {
    expect(INSPECTION_RULES.NSW.routineIntervalMonths).toBe(6);
  });

  it('should have legislation references', () => {
    STATES.forEach(state => {
      expect(INSPECTION_RULES[state].legislation).toBeTruthy();
      expect(INSPECTION_RULES[state].tribunal).toBeTruthy();
    });
  });

  it('should have valid working hours', () => {
    STATES.forEach(state => {
      const rules = INSPECTION_RULES[state];
      expect(rules.allowedHoursStart).toBeGreaterThanOrEqual(7);
      expect(rules.allowedHoursEnd).toBeLessThanOrEqual(21);
      expect(rules.allowedHoursEnd).toBeGreaterThan(rules.allowedHoursStart);
    });
  });
});

describe('CONDITION_RATING_CONFIG', () => {
  const CONDITIONS: ConditionRating[] = [
    'excellent', 'good', 'fair', 'poor', 'damaged', 'missing', 'not_applicable',
  ];

  it('should have config for all condition ratings', () => {
    CONDITIONS.forEach(condition => {
      expect(CONDITION_RATING_CONFIG[condition]).toBeDefined();
      expect(CONDITION_RATING_CONFIG[condition].label).toBeTruthy();
      expect(CONDITION_RATING_CONFIG[condition].color).toMatch(/^#/);
      expect(CONDITION_RATING_CONFIG[condition].bgColor).toMatch(/^#/);
    });
  });

  it('should have ascending sort order from excellent to missing', () => {
    expect(CONDITION_RATING_CONFIG.excellent.sortOrder).toBeLessThan(
      CONDITION_RATING_CONFIG.good.sortOrder
    );
    expect(CONDITION_RATING_CONFIG.good.sortOrder).toBeLessThan(
      CONDITION_RATING_CONFIG.fair.sortOrder
    );
    expect(CONDITION_RATING_CONFIG.fair.sortOrder).toBeLessThan(
      CONDITION_RATING_CONFIG.poor.sortOrder
    );
    expect(CONDITION_RATING_CONFIG.poor.sortOrder).toBeLessThan(
      CONDITION_RATING_CONFIG.damaged.sortOrder
    );
  });
});

describe('getNoticeRequirement', () => {
  it('should return 7 days for routine NSW inspections', () => {
    const result = getNoticeRequirement('NSW', 'routine');
    expect(result.noticeDays).toBe(7);
    expect(result.noticeMethod).toBeTruthy();
    expect(result.description).toContain('NSW');
  });

  it('should return 0 days for exit inspections', () => {
    const result = getNoticeRequirement('NSW', 'exit');
    expect(result.noticeDays).toBe(0);
  });

  it('should fall back to NSW rules for unknown states', () => {
    const result = getNoticeRequirement('XX', 'routine');
    expect(result.noticeDays).toBe(INSPECTION_RULES.NSW.routineNoticeDays);
  });

  it('should return entry notice for entry inspections', () => {
    const result = getNoticeRequirement('VIC', 'entry');
    expect(result.noticeDays).toBe(INSPECTION_RULES.VIC.entryNoticeDays);
  });
});

describe('isInspectionDue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return isDue=true when no previous inspection', () => {
    const result = isInspectionDue(null, 'NSW');
    expect(result.isDue).toBe(true);
    expect(result.daysUntilDue).toBe(0);
  });

  it('should return isDue=false for recent inspection', () => {
    const result = isInspectionDue('2025-05-01', 'NSW'); // 6 month interval
    expect(result.isDue).toBe(false);
    expect(result.daysUntilDue).toBeGreaterThan(0);
  });

  it('should return isDue=true for overdue inspection', () => {
    const result = isInspectionDue('2024-06-01', 'NSW'); // Over 12 months ago
    expect(result.isDue).toBe(true);
    expect(result.overdueDays).toBeGreaterThan(0);
  });

  it('QLD should be due sooner than NSW (3 months vs 6)', () => {
    const nswResult = isInspectionDue('2025-03-01', 'NSW');
    const qldResult = isInspectionDue('2025-03-01', 'QLD');

    // QLD 3 months = ~91 days -> due around June 1
    // NSW 6 months = ~183 days -> due around September 1
    expect(qldResult.daysUntilDue).toBeLessThan(nswResult.daysUntilDue);
  });
});

describe('getEarliestScheduleDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add 7 days for routine inspections', () => {
    const result = getEarliestScheduleDate('NSW', 'routine');
    expect(result.getDate()).toBe(22); // June 15 + 7
  });

  it('should return today for exit inspections', () => {
    const result = getEarliestScheduleDate('NSW', 'exit');
    const today = new Date('2025-06-15');
    expect(result.getDate()).toBe(today.getDate());
  });
});

describe('getConditionSeverity', () => {
  it('should return lower value for better conditions', () => {
    expect(getConditionSeverity('excellent')).toBeLessThan(getConditionSeverity('good'));
    expect(getConditionSeverity('good')).toBeLessThan(getConditionSeverity('fair'));
    expect(getConditionSeverity('fair')).toBeLessThan(getConditionSeverity('poor'));
    expect(getConditionSeverity('poor')).toBeLessThan(getConditionSeverity('damaged'));
  });
});

describe('getWorstCondition', () => {
  it('should return the worst condition from array', () => {
    expect(getWorstCondition(['excellent', 'good', 'fair'])).toBe('fair');
    expect(getWorstCondition(['good', 'damaged', 'fair'])).toBe('damaged');
  });

  it('should return not_applicable for empty array', () => {
    expect(getWorstCondition([])).toBe('not_applicable');
  });

  it('should ignore not_applicable values', () => {
    expect(getWorstCondition(['not_applicable', 'good', 'not_applicable'])).toBe('good');
  });

  it('should return the single item for single-item array', () => {
    expect(getWorstCondition(['excellent'])).toBe('excellent');
  });
});

describe('WEAR_AND_TEAR_GUIDELINES', () => {
  it('should have acceptable wear items', () => {
    expect(WEAR_AND_TEAR_GUIDELINES.acceptable.length).toBeGreaterThan(0);
  });

  it('should have tenant damage items', () => {
    expect(WEAR_AND_TEAR_GUIDELINES.tenantDamage.length).toBeGreaterThan(0);
  });

  it('should not have overlapping items', () => {
    const acceptable = new Set(WEAR_AND_TEAR_GUIDELINES.acceptable);
    WEAR_AND_TEAR_GUIDELINES.tenantDamage.forEach(item => {
      expect(acceptable.has(item as any)).toBe(false);
    });
  });
});

describe('PROFESSIONAL_INSPECTION_PRICING', () => {
  it('should have a starter add-on price', () => {
    expect(PROFESSIONAL_INSPECTION_PRICING.starterAddOnPrice).toBeGreaterThan(0);
  });

  it('should be included in Pro tier', () => {
    expect(PROFESSIONAL_INSPECTION_PRICING.proIncluded).toBe(true);
  });

  it('should be included in Hands-Off tier', () => {
    expect(PROFESSIONAL_INSPECTION_PRICING.handsOffIncluded).toBe(true);
  });
});
