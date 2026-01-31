// Unit tests for arrears rules and calculations
// Mission 08: Arrears & Late Payment Management

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ARREARS_SEVERITY_THRESHOLDS,
  ARREARS_SEVERITY_CONFIG,
  BREACH_NOTICE_REQUIREMENTS,
  REMINDER_THRESHOLDS,
  calculateSeverity,
  calculateDaysOverdue,
  getReminderTypeForDays,
  shouldSendReminder,
  calculateRemedyDate,
  canIssueBreachNotice,
  calculateInstallments,
  formatAUDollars,
} from '../constants/arrearsRules';

describe('ARREARS_SEVERITY_THRESHOLDS', () => {
  it('should have thresholds for all severity levels', () => {
    const levels = ['minor', 'moderate', 'serious', 'critical'] as const;
    levels.forEach(level => {
      expect(ARREARS_SEVERITY_THRESHOLDS[level]).toBeDefined();
      expect(ARREARS_SEVERITY_THRESHOLDS[level].min).toBeDefined();
      expect(ARREARS_SEVERITY_THRESHOLDS[level].max).toBeDefined();
    });
  });

  it('should have correct threshold ranges', () => {
    expect(ARREARS_SEVERITY_THRESHOLDS.minor).toEqual({ min: 1, max: 7 });
    expect(ARREARS_SEVERITY_THRESHOLDS.moderate).toEqual({ min: 8, max: 14 });
    expect(ARREARS_SEVERITY_THRESHOLDS.serious).toEqual({ min: 15, max: 28 });
    expect(ARREARS_SEVERITY_THRESHOLDS.critical.min).toBe(29);
    expect(ARREARS_SEVERITY_THRESHOLDS.critical.max).toBe(Infinity);
  });

  it('should have contiguous ranges with no gaps', () => {
    expect(ARREARS_SEVERITY_THRESHOLDS.minor.max + 1).toBe(ARREARS_SEVERITY_THRESHOLDS.moderate.min);
    expect(ARREARS_SEVERITY_THRESHOLDS.moderate.max + 1).toBe(ARREARS_SEVERITY_THRESHOLDS.serious.min);
    expect(ARREARS_SEVERITY_THRESHOLDS.serious.max + 1).toBe(ARREARS_SEVERITY_THRESHOLDS.critical.min);
  });
});

describe('ARREARS_SEVERITY_CONFIG', () => {
  it('should have config for all severity levels', () => {
    const levels = ['minor', 'moderate', 'serious', 'critical'] as const;
    levels.forEach(level => {
      expect(ARREARS_SEVERITY_CONFIG[level]).toBeDefined();
      expect(ARREARS_SEVERITY_CONFIG[level].label).toBeTruthy();
      expect(ARREARS_SEVERITY_CONFIG[level].description).toBeTruthy();
      expect(ARREARS_SEVERITY_CONFIG[level].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ARREARS_SEVERITY_CONFIG[level].bgColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

describe('BREACH_NOTICE_REQUIREMENTS', () => {
  it('should have requirements for all Australian states and territories', () => {
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
    states.forEach(state => {
      expect(BREACH_NOTICE_REQUIREMENTS[state]).toBeDefined();
      expect(BREACH_NOTICE_REQUIREMENTS[state].remedyDays).toBeGreaterThan(0);
      expect(BREACH_NOTICE_REQUIREMENTS[state].legislation).toBeTruthy();
      expect(BREACH_NOTICE_REQUIREMENTS[state].tribunal).toBeTruthy();
    });
  });

  it('should have correct remedy days for key states', () => {
    expect(BREACH_NOTICE_REQUIREMENTS.NSW.remedyDays).toBe(14);
    expect(BREACH_NOTICE_REQUIREMENTS.VIC.remedyDays).toBe(14);
    expect(BREACH_NOTICE_REQUIREMENTS.QLD.remedyDays).toBe(7); // QLD has shorter period
  });
});

describe('REMINDER_THRESHOLDS', () => {
  it('should have reminders in ascending order by days', () => {
    for (let i = 1; i < REMINDER_THRESHOLDS.length; i++) {
      expect(REMINDER_THRESHOLDS[i].days).toBeGreaterThan(REMINDER_THRESHOLDS[i - 1].days);
    }
  });

  it('should have expected threshold days', () => {
    expect(REMINDER_THRESHOLDS.map(t => t.days)).toEqual([1, 7, 14, 21]);
  });

  it('should have names for all thresholds', () => {
    REMINDER_THRESHOLDS.forEach(threshold => {
      expect(threshold.name).toBeTruthy();
      expect(threshold.type).toBeTruthy();
    });
  });
});

describe('calculateSeverity', () => {
  it('should return minor for 0 days overdue', () => {
    expect(calculateSeverity(0)).toBe('minor');
  });

  it('should return minor for 1-7 days overdue', () => {
    expect(calculateSeverity(1)).toBe('minor');
    expect(calculateSeverity(4)).toBe('minor');
    expect(calculateSeverity(7)).toBe('minor');
  });

  it('should return moderate for 8-14 days overdue', () => {
    expect(calculateSeverity(8)).toBe('moderate');
    expect(calculateSeverity(10)).toBe('moderate');
    expect(calculateSeverity(14)).toBe('moderate');
  });

  it('should return serious for 15-28 days overdue', () => {
    expect(calculateSeverity(15)).toBe('serious');
    expect(calculateSeverity(21)).toBe('serious');
    expect(calculateSeverity(28)).toBe('serious');
  });

  it('should return critical for 29+ days overdue', () => {
    expect(calculateSeverity(29)).toBe('critical');
    expect(calculateSeverity(60)).toBe('critical');
    expect(calculateSeverity(100)).toBe('critical');
  });

  it('should handle negative days gracefully', () => {
    expect(calculateSeverity(-5)).toBe('minor');
  });
});

describe('calculateDaysOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 0 for today\'s date', () => {
    expect(calculateDaysOverdue('2024-06-15')).toBe(0);
  });

  it('should return 0 for future dates', () => {
    expect(calculateDaysOverdue('2024-06-20')).toBe(0);
    expect(calculateDaysOverdue('2024-07-01')).toBe(0);
  });

  it('should calculate days correctly for past dates', () => {
    expect(calculateDaysOverdue('2024-06-14')).toBe(1);
    expect(calculateDaysOverdue('2024-06-08')).toBe(7);
    expect(calculateDaysOverdue('2024-06-01')).toBe(14);
  });

  it('should handle Date objects', () => {
    expect(calculateDaysOverdue(new Date('2024-06-14'))).toBe(1);
    expect(calculateDaysOverdue(new Date('2024-06-10'))).toBe(5);
  });

  it('should handle month boundaries', () => {
    expect(calculateDaysOverdue('2024-05-31')).toBe(15);
    expect(calculateDaysOverdue('2024-05-15')).toBe(31);
  });
});

describe('getReminderTypeForDays', () => {
  it('should return null for 0 days overdue', () => {
    expect(getReminderTypeForDays(0)).toBeNull();
  });

  it('should return friendly reminder for 1-6 days', () => {
    const result = getReminderTypeForDays(1);
    expect(result?.type).toBe('friendly');
    expect(result?.days).toBe(1);

    expect(getReminderTypeForDays(6)?.type).toBe('friendly');
  });

  it('should return formal reminder for 7-13 days', () => {
    const result = getReminderTypeForDays(7);
    expect(result?.type).toBe('formal');
    expect(result?.days).toBe(7);

    expect(getReminderTypeForDays(13)?.type).toBe('formal');
  });

  it('should return warning for 14-20 days', () => {
    const result = getReminderTypeForDays(14);
    expect(result?.type).toBe('warning');
    expect(result?.days).toBe(14);

    expect(getReminderTypeForDays(20)?.type).toBe('warning');
  });

  it('should return breach for 21+ days', () => {
    const result = getReminderTypeForDays(21);
    expect(result?.type).toBe('breach');
    expect(result?.days).toBe(21);

    expect(getReminderTypeForDays(60)?.type).toBe('breach');
  });
});

describe('shouldSendReminder', () => {
  it('should recommend sending when no previous reminders', () => {
    const result = shouldSendReminder(7, []);
    expect(result.shouldSend).toBe(true);
    expect(result.reminderType?.days).toBe(7);
  });

  it('should not recommend sending when threshold already sent', () => {
    const result = shouldSendReminder(7, [1, 7]);
    expect(result.shouldSend).toBe(false);
    expect(result.reminderType).toBeNull();
  });

  it('should recommend sending next threshold', () => {
    const result = shouldSendReminder(14, [1, 7]);
    expect(result.shouldSend).toBe(true);
    expect(result.reminderType?.days).toBe(14);
  });

  it('should not recommend sending for 0 days overdue', () => {
    const result = shouldSendReminder(0, []);
    expect(result.shouldSend).toBe(false);
    expect(result.reminderType).toBeNull();
  });

  it('should handle skipped thresholds', () => {
    // If tenant goes straight to 14 days without prior reminders
    const result = shouldSendReminder(14, []);
    expect(result.shouldSend).toBe(true);
    expect(result.reminderType?.days).toBe(14);
  });
});

describe('calculateRemedyDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add 14 days for NSW', () => {
    const result = calculateRemedyDate('NSW');
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(5); // June (0-indexed)
    expect(result.getDate()).toBe(29);
  });

  it('should add 7 days for QLD', () => {
    const result = calculateRemedyDate('QLD');
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(22);
  });

  it('should add 14 days for VIC', () => {
    const result = calculateRemedyDate('VIC');
    expect(result.getDate()).toBe(29);
  });

  it('should use provided notice date', () => {
    const result = calculateRemedyDate('NSW', new Date('2024-01-01'));
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(15);
  });

  it('should default to NSW for unknown state', () => {
    const result = calculateRemedyDate('XX');
    expect(result.getDate()).toBe(29); // 14 days from June 15
  });

  it('should handle month boundaries', () => {
    vi.setSystemTime(new Date('2024-01-25'));
    const result = calculateRemedyDate('NSW');
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(8);
  });
});

describe('canIssueBreachNotice', () => {
  it('should return false for less than 21 days', () => {
    expect(canIssueBreachNotice(0)).toBe(false);
    expect(canIssueBreachNotice(14)).toBe(false);
    expect(canIssueBreachNotice(20)).toBe(false);
  });

  it('should return true for 21+ days', () => {
    expect(canIssueBreachNotice(21)).toBe(true);
    expect(canIssueBreachNotice(28)).toBe(true);
    expect(canIssueBreachNotice(60)).toBe(true);
  });
});

describe('calculateInstallments', () => {
  it('should calculate weekly installments correctly', () => {
    const result = calculateInstallments(1000, 250, 'weekly', '2024-06-01');
    expect(result.length).toBe(4);
    expect(result[0].amount).toBe(250);
    expect(result[0].dueDate.toISOString().split('T')[0]).toBe('2024-06-01');
    expect(result[1].dueDate.toISOString().split('T')[0]).toBe('2024-06-08');
    expect(result[2].dueDate.toISOString().split('T')[0]).toBe('2024-06-15');
    expect(result[3].dueDate.toISOString().split('T')[0]).toBe('2024-06-22');
  });

  it('should calculate fortnightly installments correctly', () => {
    const result = calculateInstallments(1000, 500, 'fortnightly', '2024-06-01');
    expect(result.length).toBe(2);
    expect(result[0].dueDate.toISOString().split('T')[0]).toBe('2024-06-01');
    expect(result[1].dueDate.toISOString().split('T')[0]).toBe('2024-06-15');
  });

  it('should calculate monthly installments correctly', () => {
    const result = calculateInstallments(3000, 1000, 'monthly', '2024-06-01');
    expect(result.length).toBe(3);
    expect(result[0].dueDate.toISOString().split('T')[0]).toBe('2024-06-01');
    expect(result[1].dueDate.toISOString().split('T')[0]).toBe('2024-07-01');
    expect(result[2].dueDate.toISOString().split('T')[0]).toBe('2024-08-01');
  });

  it('should handle partial final installment', () => {
    const result = calculateInstallments(1100, 500, 'weekly', '2024-06-01');
    expect(result.length).toBe(3);
    expect(result[0].amount).toBe(500);
    expect(result[1].amount).toBe(500);
    expect(result[2].amount).toBe(100); // Remaining amount
  });

  it('should handle exact amount matching', () => {
    const result = calculateInstallments(500, 100, 'weekly', '2024-06-01');
    expect(result.length).toBe(5);
    result.forEach(installment => {
      expect(installment.amount).toBe(100);
    });
  });

  it('should handle Date object input', () => {
    const result = calculateInstallments(200, 100, 'weekly', new Date('2024-06-01'));
    expect(result.length).toBe(2);
  });
});

describe('formatAUDollars', () => {
  it('should format positive amounts', () => {
    expect(formatAUDollars(1234.56)).toBe('$1,234.56');
    expect(formatAUDollars(100)).toBe('$100.00');
    expect(formatAUDollars(0.99)).toBe('$0.99');
  });

  it('should format zero', () => {
    expect(formatAUDollars(0)).toBe('$0.00');
  });

  it('should format negative amounts', () => {
    expect(formatAUDollars(-500)).toBe('-$500.00');
  });

  it('should format large amounts with thousands separator', () => {
    expect(formatAUDollars(1000000)).toBe('$1,000,000.00');
  });

  it('should round to 2 decimal places', () => {
    expect(formatAUDollars(99.999)).toBe('$100.00');
    expect(formatAUDollars(99.994)).toBe('$99.99');
  });
});
