import { AutonomyLevel } from '../types/autonomy';
import type { ToolCategory } from '../types/tools';

/**
 * Default autonomy level per tool category.
 * These are starting points — actual levels are determined by:
 * 1. Tool definition's autonomyLevel
 * 2. Owner's agent_preferences overrides
 * 3. agent_rules that modify behavior
 * 4. Graduation from successful usage
 */
export const CATEGORY_DEFAULT_AUTONOMY: Record<ToolCategory, AutonomyLevel> = {
  query: AutonomyLevel.Autonomous,
  action: AutonomyLevel.Draft,
  generate: AutonomyLevel.Draft,
  workflow: AutonomyLevel.Suggest,
  memory: AutonomyLevel.Autonomous,
  planning: AutonomyLevel.Execute,
  integration: AutonomyLevel.Suggest,
};

/**
 * Actions that NEVER auto-execute regardless of autonomy settings.
 * These always require explicit owner approval.
 */
export const NEVER_AUTO_EXECUTE = [
  // Critical — legal or irreversible
  'terminate_lease',
  'claim_bond',
  'eviction_notice',

  // High risk — significant financial or tenant decisions
  'change_rent_amount',
  'accept_application',
  'reject_application',

  // Legal document generation
  'generate_notice',

  // Financial — refunds
  'refund_payment_stripe',
] as const;

/**
 * Actions that can auto-execute once the owner has approved them N times.
 * requiredApprovals: 0 means always auto-execute (graduated from start).
 */
export const GRADUATED_AUTO_EXECUTE: Record<string, { requiredApprovals: number }> = {
  // Always auto-execute (0 approvals needed)
  triage_maintenance: { requiredApprovals: 0 },
  send_receipt: { requiredApprovals: 0 },
  send_push_expo: { requiredApprovals: 0 },

  // Auto-execute after 1 approval
  schedule_inspection: { requiredApprovals: 1 },
  retry_payment: { requiredApprovals: 1 },

  // Auto-execute after 2 approvals
  send_rent_reminder: { requiredApprovals: 2 },
  send_message: { requiredApprovals: 2 },
  create_maintenance: { requiredApprovals: 2 },

  // Auto-execute after 3 approvals
  update_maintenance_status: { requiredApprovals: 3 },
  send_sms_twilio: { requiredApprovals: 3 },
  send_email_sendgrid: { requiredApprovals: 3 },
  shortlist_application: { requiredApprovals: 3 },

  // Auto-execute after 5 approvals (higher trust needed)
  create_work_order: { requiredApprovals: 5 },
  publish_listing: { requiredApprovals: 5 },
  syndicate_listing_domain: { requiredApprovals: 5 },
  syndicate_listing_rea: { requiredApprovals: 5 },
  approve_quote: { requiredApprovals: 5 },
};
