import type { BackgroundTaskDefinition } from '../types/workflows';

/**
 * Background task definitions for automated agent operations.
 * Each task runs on a schedule (cron) or in response to an event.
 *
 * All cron expressions use IANA timezone: Australia/Sydney (AEST/AEDT).
 */
export const BACKGROUND_TASKS: BackgroundTaskDefinition[] = [
  // ─── Daily Tasks (Early Morning) ───────────────────────────────────────

  {
    name: 'rent_due_detection',
    description: 'Detect upcoming rent due dates and prepare collection',
    triggerType: 'cron',
    cronExpression: '0 6 * * *', // Daily 6am AEST
    toolsUsed: ['get_rent_schedule'],
    defaultAutonomy: 4, // Autonomous — read-only
    availableFromMission: 7,
  },
  {
    name: 'autopay_processing',
    description: 'Process auto-pay for tenants with enabled auto-debit',
    triggerType: 'cron',
    cronExpression: '0 6 * * *', // Daily 6am AEST
    toolsUsed: ['get_rent_schedule', 'collect_rent_stripe', 'send_receipt'],
    defaultAutonomy: 3, // Execute — auto-charge enabled tenants
    availableFromMission: 7,
  },
  {
    name: 'arrears_detection',
    description: 'Detect new arrears and send initial reminders',
    triggerType: 'cron',
    cronExpression: '0 7 * * *', // Daily 7am AEST
    toolsUsed: ['get_arrears', 'send_rent_reminder'],
    defaultAutonomy: 3, // Execute for graduated reminders, Draft for new
    availableFromMission: 8,
  },
  {
    name: 'arrears_escalation',
    description: 'Check existing arrears and escalate per schedule',
    triggerType: 'cron',
    cronExpression: '0 9 * * *', // Daily 9am AEST
    toolsUsed: ['get_arrears', 'escalate_arrears', 'generate_notice'],
    defaultAutonomy: 1, // Suggest — escalation requires owner review
    availableFromMission: 8,
  },
  {
    name: 'compliance_checking',
    description: 'Check compliance deadlines and flag overdue items',
    triggerType: 'cron',
    cronExpression: '0 8 * * *', // Daily 8am AEST
    toolsUsed: ['get_compliance_status'],
    defaultAutonomy: 4, // Autonomous — read-only check
    availableFromMission: 15,
  },
  {
    name: 'compliance_reminders',
    description: 'Send reminders for upcoming compliance deadlines',
    triggerType: 'cron',
    cronExpression: '30 8 * * *', // Daily 8:30am AEST
    toolsUsed: ['get_compliance_status', 'send_message'],
    defaultAutonomy: 2, // Draft — owner reviews before sending
    availableFromMission: 15,
  },

  // ─── Weekly Tasks ─────────────────────────────────────────────────────

  {
    name: 'inspection_scheduling',
    description: 'Check properties due for routine inspection and schedule',
    triggerType: 'cron',
    cronExpression: '0 8 * * 1', // Monday 8am AEST
    toolsUsed: ['get_inspections', 'get_properties', 'schedule_inspection'],
    defaultAutonomy: 3, // Execute for graduated properties
    availableFromMission: 11,
  },
  {
    name: 'lease_expiry_alert',
    description: 'Alert owners about leases expiring within 60 days',
    triggerType: 'cron',
    cronExpression: '0 8 * * 1', // Monday 8am AEST
    toolsUsed: ['get_tenancy', 'send_message'],
    defaultAutonomy: 2, // Draft — owner reviews
    availableFromMission: 6,
  },
  {
    name: 'listing_performance',
    description: 'Review listing performance and suggest adjustments',
    triggerType: 'cron',
    cronExpression: '0 17 * * 5', // Friday 5pm AEST
    toolsUsed: ['get_listings', 'analyze_rent'],
    defaultAutonomy: 4, // Autonomous — read-only analysis
    availableFromMission: 4,
  },

  // ─── Monthly Tasks ────────────────────────────────────────────────────

  {
    name: 'monthly_reports',
    description: 'Generate monthly financial reports for all properties',
    triggerType: 'cron',
    cronExpression: '0 6 1 * *', // 1st of month 6am AEST
    toolsUsed: ['generate_financial_report'],
    defaultAutonomy: 3, // Execute — auto-generate
    availableFromMission: 13,
  },

  // ─── Event-Triggered Tasks ────────────────────────────────────────────

  {
    name: 'payment_retry',
    description: 'Retry failed payment after delay period',
    triggerType: 'event',
    eventName: 'payment_failed',
    toolsUsed: ['retry_payment', 'send_rent_reminder'],
    defaultAutonomy: 3, // Execute — auto-retry once
    availableFromMission: 7,
  },
  {
    name: 'maintenance_triage',
    description: 'Auto-triage new maintenance requests',
    triggerType: 'event',
    eventName: 'maintenance_created',
    toolsUsed: ['triage_maintenance', 'estimate_cost', 'send_message'],
    defaultAutonomy: 3, // Execute — auto-categorize
    availableFromMission: 9,
  },
];

/**
 * Lookup background task by name.
 */
export const BACKGROUND_TASK_BY_NAME: Record<string, BackgroundTaskDefinition> = Object.fromEntries(
  BACKGROUND_TASKS.map(task => [task.name, task])
);

/**
 * Get tasks available at a given mission number.
 */
export function getBackgroundTasksForMission(mission: number): BackgroundTaskDefinition[] {
  return BACKGROUND_TASKS.filter(task => task.availableFromMission <= mission);
}
