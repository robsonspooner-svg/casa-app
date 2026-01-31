/**
 * Preference categories for the agent system.
 */
export type PreferenceCategory =
  | 'communication'
  | 'maintenance'
  | 'financial'
  | 'tenant'
  | 'inspection'
  | 'listing'
  | 'general';

/**
 * Default preferences created when a property is added.
 * These provide initial agent behavior before learning kicks in.
 */
export interface PropertyDefaults {
  /** Maximum amount agent can auto-approve for maintenance ($) */
  autoApproveThreshold: number;

  /** How often to schedule routine inspections (months) */
  inspectionFrequencyMonths: number;

  /** Preferred communication channel for tenants */
  preferredChannel: 'in_app' | 'email' | 'sms';

  /** Days before rent due to send reminder */
  rentReminderDaysBefore: number;

  /** Whether to auto-send receipts on payment */
  autoSendReceipts: boolean;

  /** Arrears escalation timing (days) */
  arrearsEscalation: {
    friendlyReminder: number;
    formalReminder: number;
    breachNotice: number;
    ownerEscalation: number;
  };
}

/**
 * System-wide default preferences.
 * Applied when no owner-specific preference exists.
 */
export const DEFAULT_PROPERTY_PREFERENCES: PropertyDefaults = {
  autoApproveThreshold: 200,
  inspectionFrequencyMonths: 3,
  preferredChannel: 'in_app',
  rentReminderDaysBefore: 3,
  autoSendReceipts: true,
  arrearsEscalation: {
    friendlyReminder: 1,
    formalReminder: 4,
    breachNotice: 8,
    ownerEscalation: 14,
  },
};
