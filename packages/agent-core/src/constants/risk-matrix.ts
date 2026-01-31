import { RiskLevel } from '../types/autonomy';

/**
 * Risk classification for all 87 agent tools.
 * Determines escalation behavior and default autonomy ceiling.
 *
 * Risk Levels:
 * - None: Read-only, no side effects
 * - Low: Reversible or minor impact
 * - Medium: Involves cost or external communication
 * - High: Financial or significant decisions
 * - Critical: Legal or irreversible
 */
export const ACTION_RISK_MATRIX: Record<string, RiskLevel> = {
  // ─── Query Tools (22) — All None risk ──────────────────────────────────
  get_property: RiskLevel.None,
  get_properties: RiskLevel.None,
  search_tenants: RiskLevel.None,
  get_tenancy: RiskLevel.None,
  get_payments: RiskLevel.None,
  get_rent_schedule: RiskLevel.None,
  get_arrears: RiskLevel.None,
  get_maintenance: RiskLevel.None,
  get_maintenance_detail: RiskLevel.None,
  get_quotes: RiskLevel.None,
  get_inspections: RiskLevel.None,
  get_listings: RiskLevel.None,
  get_applications: RiskLevel.None,
  get_application_detail: RiskLevel.None,
  get_conversations: RiskLevel.None,
  get_compliance_status: RiskLevel.None,
  get_financial_summary: RiskLevel.None,
  get_transactions: RiskLevel.None,
  get_trades: RiskLevel.None,
  get_background_tasks: RiskLevel.None,
  get_pending_actions: RiskLevel.None,
  get_documents: RiskLevel.None,

  // ─── Action Tools (28) ─────────────────────────────────────────────────

  // Low risk — reversible or minor impact
  send_rent_reminder: RiskLevel.Low,
  send_receipt: RiskLevel.None,
  create_maintenance: RiskLevel.Low,
  update_maintenance_status: RiskLevel.Low,
  schedule_inspection: RiskLevel.Low,
  cancel_inspection: RiskLevel.Low,
  reject_quote: RiskLevel.Low,
  update_listing: RiskLevel.Low,
  pause_listing: RiskLevel.Low,
  record_compliance: RiskLevel.Low,

  // Medium risk — involves cost or communication
  send_message: RiskLevel.Medium,
  create_work_order: RiskLevel.Medium,
  shortlist_application: RiskLevel.Medium,
  retry_payment: RiskLevel.Medium,
  create_listing: RiskLevel.Medium,
  publish_listing: RiskLevel.Medium,
  create_payment_plan: RiskLevel.Medium,
  update_autopay: RiskLevel.Medium,

  // High risk — financial or significant decisions
  send_breach_notice: RiskLevel.High,
  approve_quote: RiskLevel.High,
  accept_application: RiskLevel.High,
  reject_application: RiskLevel.High,
  process_payment: RiskLevel.High,
  change_rent_amount: RiskLevel.High,
  lodge_bond: RiskLevel.High,
  escalate_arrears: RiskLevel.High,

  // Critical — legal or irreversible
  terminate_lease: RiskLevel.Critical,
  claim_bond: RiskLevel.Critical,

  // ─── Generate Tools (13) ───────────────────────────────────────────────
  generate_listing: RiskLevel.None,
  draft_message: RiskLevel.None,
  score_application: RiskLevel.None,
  rank_applications: RiskLevel.None,
  triage_maintenance: RiskLevel.None,
  estimate_cost: RiskLevel.None,
  analyze_rent: RiskLevel.None,
  generate_notice: RiskLevel.High, // Legal document
  generate_inspection_report: RiskLevel.None,
  compare_inspections: RiskLevel.None,
  generate_financial_report: RiskLevel.None,
  suggest_rent_price: RiskLevel.None,
  generate_lease: RiskLevel.Medium, // Legal document (draft)

  // ─── Integration Tools (12) ────────────────────────────────────────────
  syndicate_listing_domain: RiskLevel.Medium,
  syndicate_listing_rea: RiskLevel.Medium,
  run_credit_check: RiskLevel.Medium,
  run_tica_check: RiskLevel.Medium,
  collect_rent_stripe: RiskLevel.High,
  refund_payment_stripe: RiskLevel.High,
  send_docusign_envelope: RiskLevel.High,
  lodge_bond_state: RiskLevel.High,
  send_sms_twilio: RiskLevel.Low,
  send_email_sendgrid: RiskLevel.Low,
  send_push_expo: RiskLevel.None,
  search_trades_hipages: RiskLevel.None,

  // ─── Workflow Tools (5) ────────────────────────────────────────────────
  workflow_find_tenant: RiskLevel.Medium,
  workflow_onboard_tenant: RiskLevel.High,
  workflow_end_tenancy: RiskLevel.High,
  workflow_maintenance_lifecycle: RiskLevel.Medium,
  workflow_arrears_escalation: RiskLevel.High,

  // ─── Memory Tools (4) ──────────────────────────────────────────────────
  remember: RiskLevel.None,
  recall: RiskLevel.None,
  search_precedent: RiskLevel.None,
  get_owner_rules: RiskLevel.None,

  // ─── Planning Tools (3) ────────────────────────────────────────────────
  plan_task: RiskLevel.None,
  check_plan: RiskLevel.None,
  replan: RiskLevel.None,
};

/**
 * Financial threshold for auto-approval.
 * Actions with cost above this require owner approval regardless of autonomy.
 */
export const DEFAULT_FINANCIAL_THRESHOLD = 200; // AUD

/**
 * Confidence threshold below which the agent always escalates.
 */
export const CONFIDENCE_ESCALATION_THRESHOLD = 0.4;
