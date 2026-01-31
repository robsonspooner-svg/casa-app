// Arrears Rules and Constants
// Mission 08: Arrears & Late Payment Management

import type { ArrearsSeverity } from '../types/database';

/**
 * Arrears severity thresholds
 */
export const ARREARS_SEVERITY_THRESHOLDS: Record<ArrearsSeverity, { min: number; max: number }> = {
  minor: { min: 1, max: 7 },
  moderate: { min: 8, max: 14 },
  serious: { min: 15, max: 28 },
  critical: { min: 29, max: Infinity },
};

/**
 * Arrears severity configuration for UI display
 */
export const ARREARS_SEVERITY_CONFIG: Record<ArrearsSeverity, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  minor: {
    label: 'Minor',
    description: '1-7 days overdue',
    color: '#F59E0B', // warning/amber
    bgColor: '#FEF3C7',
  },
  moderate: {
    label: 'Moderate',
    description: '8-14 days overdue',
    color: '#F97316', // orange
    bgColor: '#FFEDD5',
  },
  serious: {
    label: 'Serious',
    description: '15-28 days overdue',
    color: '#EF4444', // red
    bgColor: '#FEE2E2',
  },
  critical: {
    label: 'Critical',
    description: '29+ days overdue',
    color: '#7F1D1D', // dark red
    bgColor: '#FEE2E2',
  },
};

/**
 * State-specific breach notice requirements
 */
export const BREACH_NOTICE_REQUIREMENTS: Record<string, {
  remedyDays: number;
  legislation: string;
  tribunal: string;
}> = {
  NSW: {
    remedyDays: 14,
    legislation: 'Residential Tenancies Act 2010 (NSW)',
    tribunal: 'NSW Civil and Administrative Tribunal (NCAT)',
  },
  VIC: {
    remedyDays: 14,
    legislation: 'Residential Tenancies Act 1997 (VIC)',
    tribunal: 'Victorian Civil and Administrative Tribunal (VCAT)',
  },
  QLD: {
    remedyDays: 7,
    legislation: 'Residential Tenancies and Rooming Accommodation Act 2008 (QLD)',
    tribunal: 'Queensland Civil and Administrative Tribunal (QCAT)',
  },
  SA: {
    remedyDays: 14,
    legislation: 'Residential Tenancies Act 1995 (SA)',
    tribunal: 'South Australian Civil and Administrative Tribunal (SACAT)',
  },
  WA: {
    remedyDays: 14,
    legislation: 'Residential Tenancies Act 1987 (WA)',
    tribunal: 'State Administrative Tribunal (SAT)',
  },
  TAS: {
    remedyDays: 14,
    legislation: 'Residential Tenancy Act 1997 (TAS)',
    tribunal: 'Residential Tenancy Commissioner',
  },
  NT: {
    remedyDays: 14,
    legislation: 'Residential Tenancies Act 1999 (NT)',
    tribunal: 'Northern Territory Civil and Administrative Tribunal (NTCAT)',
  },
  ACT: {
    remedyDays: 14,
    legislation: 'Residential Tenancies Act 1997 (ACT)',
    tribunal: 'ACT Civil and Administrative Tribunal (ACAT)',
  },
};

/**
 * Reminder thresholds (when to send automated reminders)
 */
export const REMINDER_THRESHOLDS = [
  { days: 1, type: 'friendly' as const, name: 'Friendly Reminder' },
  { days: 7, type: 'formal' as const, name: 'Formal Reminder' },
  { days: 14, type: 'warning' as const, name: 'Final Warning' },
  { days: 21, type: 'breach' as const, name: 'Breach Notice' },
];

/**
 * Calculate severity level based on days overdue
 */
export function calculateSeverity(daysOverdue: number): ArrearsSeverity {
  if (daysOverdue <= 0) {
    // Not actually overdue, but return minor as minimum
    return 'minor';
  }
  if (daysOverdue <= 7) return 'minor';
  if (daysOverdue <= 14) return 'moderate';
  if (daysOverdue <= 28) return 'serious';
  return 'critical';
}

/**
 * Calculate days overdue from a due date
 */
export function calculateDaysOverdue(dueDate: Date | string): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const today = new Date();

  // Reset time components to compare dates only
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffTime = todayDay.getTime() - dueDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Get the appropriate reminder type for days overdue
 */
export function getReminderTypeForDays(daysOverdue: number): typeof REMINDER_THRESHOLDS[number] | null {
  // Find the highest threshold that has been crossed
  const crossed = REMINDER_THRESHOLDS.filter(t => daysOverdue >= t.days);
  return crossed.length > 0 ? crossed[crossed.length - 1] : null;
}

/**
 * Check if a reminder should be sent based on days overdue and previous reminders
 */
export function shouldSendReminder(
  daysOverdue: number,
  sentReminderDays: number[]
): { shouldSend: boolean; reminderType: typeof REMINDER_THRESHOLDS[number] | null } {
  const reminderType = getReminderTypeForDays(daysOverdue);

  if (!reminderType) {
    return { shouldSend: false, reminderType: null };
  }

  // Check if this specific threshold has already been sent
  const alreadySent = sentReminderDays.includes(reminderType.days);

  return {
    shouldSend: !alreadySent,
    reminderType: alreadySent ? null : reminderType,
  };
}

/**
 * Calculate breach notice remedy date based on state
 */
export function calculateRemedyDate(state: string, noticeDate?: Date): Date {
  const config = BREACH_NOTICE_REQUIREMENTS[state] || BREACH_NOTICE_REQUIREMENTS.NSW;
  const date = noticeDate ? new Date(noticeDate) : new Date();
  date.setDate(date.getDate() + config.remedyDays);
  return date;
}

/**
 * Check if enough days have passed to issue a breach notice
 * Most states require 14 days overdue, but we recommend waiting until 21 days
 * to allow for proper escalation through reminder stages
 */
export function canIssueBreachNotice(daysOverdue: number): boolean {
  return daysOverdue >= 21;
}

/**
 * Calculate payment plan installments
 */
export function calculateInstallments(
  totalAmount: number,
  installmentAmount: number,
  frequency: 'weekly' | 'fortnightly' | 'monthly',
  startDate: Date | string
): { dueDate: Date; amount: number }[] {
  const start = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
  const installments: { dueDate: Date; amount: number }[] = [];

  let remaining = totalAmount;
  let currentDate = new Date(start);

  while (remaining > 0) {
    const amount = Math.min(installmentAmount, remaining);
    installments.push({
      dueDate: new Date(currentDate),
      amount,
    });

    remaining -= amount;

    // Move to next due date based on frequency
    switch (frequency) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'fortnightly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }

  return installments;
}

/**
 * Format currency for Australian dollars
 */
export function formatAUDollars(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}
