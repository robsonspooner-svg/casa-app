// Tool Dispatcher — maps tool names to their handler functions
// Imports all handlers from the category-split files and provides a single
// executeToolHandler(toolName, input, userId, supabase) entry point.

import {
  handle_get_property, handle_get_properties, handle_search_tenants,
  handle_get_tenancy, handle_get_tenancy_detail, handle_get_payments,
  handle_get_rent_schedule, handle_get_arrears, handle_get_arrears_detail,
  handle_get_maintenance, handle_get_maintenance_detail, handle_get_quotes,
  handle_get_inspections, handle_get_inspection_detail,
  handle_get_listings, handle_get_listing_detail,
  handle_get_applications, handle_get_application_detail,
  handle_get_conversations, handle_get_conversation_messages,
  handle_get_compliance_status, handle_get_financial_summary,
  handle_get_transactions, handle_get_trades, handle_get_work_orders,
  handle_get_expenses, handle_get_property_metrics, handle_get_payment_plan, handle_get_documents,
  handle_get_document, handle_upload_document, handle_share_document,
  handle_search_documents, handle_get_document_folders, handle_move_document_to_folder,
  handle_get_background_tasks, handle_get_pending_actions,
  handle_suggest_navigation,
  handle_check_maintenance_threshold as handle_check_maintenance_threshold_q,
  handle_check_regulatory_requirements as handle_check_regulatory_requirements_q,
  handle_get_tenancy_law,
  handle_get_property_health, handle_get_tenant_satisfaction,
  handle_get_market_intelligence, handle_get_portfolio_snapshot,
} from './tool-handlers.ts';

import {
  handle_create_property, handle_update_property, handle_delete_property,
  handle_create_tenancy, handle_update_tenancy, handle_terminate_lease, handle_renew_lease,
  handle_create_listing, handle_update_listing, handle_publish_listing, handle_pause_listing,
  handle_send_message, handle_create_conversation, handle_send_in_app_message,
  handle_send_rent_reminder, handle_send_breach_notice,
  handle_create_maintenance, handle_update_maintenance_status,
  handle_add_maintenance_comment, handle_record_maintenance_cost,
  handle_schedule_inspection, handle_cancel_inspection,
  handle_record_inspection_finding, handle_submit_inspection_to_tenant, handle_finalize_inspection,
  handle_create_work_order, handle_update_work_order_status,
  handle_approve_quote, handle_reject_quote,
  handle_accept_application, handle_reject_application, handle_shortlist_application,
  handle_create_payment_plan, handle_escalate_arrears,
  handle_resolve_arrears, handle_log_arrears_action,
  handle_create_rent_increase, handle_change_rent_amount,
  handle_record_compliance,
  handle_add_trade_to_network, handle_submit_trade_review, handle_invite_tenant,
  handle_process_payment, handle_lodge_bond,
  handle_send_receipt, handle_retry_payment, handle_claim_bond,
  handle_update_autopay, handle_cancel_rent_increase,
  handle_record_quote_response,
} from './tool-handlers-actions.ts';

import {
  handle_generate_listing, handle_draft_message,
  handle_score_application, handle_rank_applications,
  handle_triage_maintenance, handle_estimate_cost,
  handle_analyze_rent, handle_suggest_rent_price,
  handle_generate_notice, handle_generate_inspection_report,
  handle_compare_inspections, handle_generate_financial_report,
  handle_generate_tax_report, handle_generate_property_summary,
  handle_generate_portfolio_report, handle_generate_cash_flow_forecast,
  handle_generate_lease, handle_assess_tenant_damage, handle_compare_quotes,
  handle_create_document, handle_submit_document_email,
  handle_request_document_signature, handle_update_document_status,
  handle_web_search, handle_find_local_trades, handle_parse_business_details,
  handle_create_service_provider, handle_request_quote, handle_get_market_data,
  handle_check_maintenance_threshold,
  handle_workflow_find_tenant, handle_workflow_onboard_tenant,
  handle_workflow_end_tenancy, handle_workflow_maintenance_lifecycle,
  handle_workflow_arrears_escalation,
  handle_remember, handle_recall, handle_search_precedent,
  handle_plan_task, handle_get_owner_rules, handle_check_plan, handle_replan,
  handle_syndicate_listing_domain, handle_syndicate_listing_rea,
  handle_run_credit_check, handle_run_tica_check,
  handle_collect_rent_stripe, handle_refund_payment_stripe,
  handle_send_docusign_envelope, handle_lodge_bond_state,
  handle_send_sms_twilio, handle_send_email_sendgrid,
  handle_send_push_expo, handle_search_trades_hipages,
  handle_check_compliance_requirements, handle_track_authority_submission,
  handle_generate_proof_of_service,
  handle_generate_wealth_report, handle_generate_property_action_plan,
  handle_predict_vacancy_risk, handle_calculate_roi_metrics,
  handle_generate_work_order,
} from './tool-handlers-generate.ts';

import { TOOL_META } from './tool-registry.ts';

type SupabaseClient = any;
type ToolResult = { success: boolean; data?: unknown; error?: string };

// Map every tool name to its handler function
const HANDLER_MAP: Record<string, (input: Record<string, unknown>, userId: string, sb: SupabaseClient) => Promise<ToolResult>> = {
  // Query tools
  get_property: handle_get_property,
  get_properties: handle_get_properties,
  search_tenants: handle_search_tenants,
  get_tenancy: handle_get_tenancy,
  get_tenancy_detail: handle_get_tenancy_detail,
  get_payments: handle_get_payments,
  get_rent_schedule: handle_get_rent_schedule,
  get_arrears: handle_get_arrears,
  get_arrears_detail: handle_get_arrears_detail,
  get_maintenance: handle_get_maintenance,
  get_maintenance_detail: handle_get_maintenance_detail,
  get_quotes: handle_get_quotes,
  get_inspections: handle_get_inspections,
  get_inspection_detail: handle_get_inspection_detail,
  get_listings: handle_get_listings,
  get_listing_detail: handle_get_listing_detail,
  get_applications: handle_get_applications,
  get_application_detail: handle_get_application_detail,
  get_conversations: handle_get_conversations,
  get_conversation_messages: handle_get_conversation_messages,
  get_compliance_status: handle_get_compliance_status,
  get_financial_summary: handle_get_financial_summary,
  get_transactions: handle_get_transactions,
  get_trades: handle_get_trades,
  get_work_orders: handle_get_work_orders,
  get_expenses: handle_get_expenses,
  get_property_metrics: handle_get_property_metrics,
  get_payment_plan: handle_get_payment_plan,
  get_documents: handle_get_documents,
  get_document: handle_get_document,
  upload_document: handle_upload_document,
  share_document: handle_share_document,
  search_documents: handle_search_documents,
  get_document_folders: handle_get_document_folders,
  move_document_to_folder: handle_move_document_to_folder,
  get_background_tasks: handle_get_background_tasks,
  get_pending_actions: handle_get_pending_actions,
  suggest_navigation: handle_suggest_navigation,

  // Action tools
  create_property: handle_create_property,
  update_property: handle_update_property,
  delete_property: handle_delete_property,
  create_tenancy: handle_create_tenancy,
  update_tenancy: handle_update_tenancy,
  terminate_lease: handle_terminate_lease,
  renew_lease: handle_renew_lease,
  create_listing: handle_create_listing,
  update_listing: handle_update_listing,
  publish_listing: handle_publish_listing,
  pause_listing: handle_pause_listing,
  send_message: handle_send_message,
  create_conversation: handle_create_conversation,
  send_in_app_message: handle_send_in_app_message,
  send_rent_reminder: handle_send_rent_reminder,
  send_breach_notice: handle_send_breach_notice,
  create_maintenance: handle_create_maintenance,
  update_maintenance_status: handle_update_maintenance_status,
  add_maintenance_comment: handle_add_maintenance_comment,
  record_maintenance_cost: handle_record_maintenance_cost,
  schedule_inspection: handle_schedule_inspection,
  cancel_inspection: handle_cancel_inspection,
  record_inspection_finding: handle_record_inspection_finding,
  submit_inspection_to_tenant: handle_submit_inspection_to_tenant,
  finalize_inspection: handle_finalize_inspection,
  create_work_order: handle_create_work_order,
  update_work_order_status: handle_update_work_order_status,
  approve_quote: handle_approve_quote,
  reject_quote: handle_reject_quote,
  accept_application: handle_accept_application,
  reject_application: handle_reject_application,
  shortlist_application: handle_shortlist_application,
  create_payment_plan: handle_create_payment_plan,
  escalate_arrears: handle_escalate_arrears,
  resolve_arrears: handle_resolve_arrears,
  log_arrears_action: handle_log_arrears_action,
  create_rent_increase: handle_create_rent_increase,
  change_rent_amount: handle_change_rent_amount,
  record_compliance: handle_record_compliance,
  add_trade_to_network: handle_add_trade_to_network,
  submit_trade_review: handle_submit_trade_review,
  invite_tenant: handle_invite_tenant,
  process_payment: handle_process_payment,
  lodge_bond: handle_lodge_bond,
  send_receipt: handle_send_receipt,
  retry_payment: handle_retry_payment,
  claim_bond: handle_claim_bond,
  update_autopay: handle_update_autopay,
  cancel_rent_increase: handle_cancel_rent_increase,
  record_quote_response: handle_record_quote_response,

  // Generate tools
  generate_listing: handle_generate_listing,
  generate_listing_copy: handle_generate_listing, // alias
  draft_message: handle_draft_message,
  score_application: handle_score_application,
  rank_applications: handle_rank_applications,
  triage_maintenance: handle_triage_maintenance,
  estimate_cost: handle_estimate_cost,
  analyze_rent: handle_analyze_rent,
  suggest_rent_price: handle_suggest_rent_price,
  generate_notice: handle_generate_notice,
  generate_inspection_report: handle_generate_inspection_report,
  compare_inspections: handle_compare_inspections,
  generate_financial_report: handle_generate_financial_report,
  generate_tax_report: handle_generate_tax_report,
  generate_property_summary: handle_generate_property_summary,
  generate_portfolio_report: handle_generate_portfolio_report,
  generate_cash_flow_forecast: handle_generate_cash_flow_forecast,
  generate_lease: handle_generate_lease,
  assess_tenant_damage: handle_assess_tenant_damage,
  compare_quotes: handle_compare_quotes,

  // Work order document generation
  generate_work_order: handle_generate_work_order,

  // Document lifecycle tools
  create_document: handle_create_document,
  submit_document_email: handle_submit_document_email,
  request_document_signature: handle_request_document_signature,
  update_document_status: handle_update_document_status,

  // External tools
  web_search: handle_web_search,
  find_local_trades: handle_find_local_trades,
  parse_business_details: handle_parse_business_details,
  create_service_provider: handle_create_service_provider,
  request_quote: handle_request_quote,
  get_market_data: handle_get_market_data,
  check_maintenance_threshold: handle_check_maintenance_threshold,
  check_regulatory_requirements: handle_check_regulatory_requirements_q,
  get_tenancy_law: handle_get_tenancy_law,

  // Workflow tools
  workflow_find_tenant: handle_workflow_find_tenant,
  workflow_onboard_tenant: handle_workflow_onboard_tenant,
  workflow_end_tenancy: handle_workflow_end_tenancy,
  workflow_maintenance_lifecycle: handle_workflow_maintenance_lifecycle,
  workflow_arrears_escalation: handle_workflow_arrears_escalation,

  // Memory tools
  remember: handle_remember,
  recall: handle_recall,
  search_precedent: handle_search_precedent,

  // Planning tools
  plan_task: handle_plan_task,
  get_owner_rules: handle_get_owner_rules,
  check_plan: handle_check_plan,
  replan: handle_replan,

  // Integration tools (external API stubs)
  syndicate_listing_domain: handle_syndicate_listing_domain,
  syndicate_listing_rea: handle_syndicate_listing_rea,
  run_credit_check: handle_run_credit_check,
  run_tica_check: handle_run_tica_check,
  collect_rent_stripe: handle_collect_rent_stripe,
  refund_payment_stripe: handle_refund_payment_stripe,
  send_docusign_envelope: handle_send_docusign_envelope,
  lodge_bond_state: handle_lodge_bond_state,
  send_sms_twilio: handle_send_sms_twilio,
  send_email_sendgrid: handle_send_email_sendgrid,
  send_push_expo: handle_send_push_expo,
  search_trades_hipages: handle_search_trades_hipages,

  // Compliance / Authority tools
  check_compliance_requirements: handle_check_compliance_requirements,
  track_authority_submission: handle_track_authority_submission,
  generate_proof_of_service: handle_generate_proof_of_service,

  // Beyond-PM Intelligence
  get_property_health: handle_get_property_health,
  get_tenant_satisfaction: handle_get_tenant_satisfaction,
  get_market_intelligence: handle_get_market_intelligence,
  get_portfolio_snapshot: handle_get_portfolio_snapshot,
  generate_wealth_report: handle_generate_wealth_report,
  generate_property_action_plan: handle_generate_property_action_plan,
  predict_vacancy_risk: handle_predict_vacancy_risk,
  calculate_roi_metrics: handle_calculate_roi_metrics,
};

/**
 * Execute a tool by name. Returns a structured result.
 * If the tool exists in the registry but has no handler, returns a graceful error.
 * If the tool is completely unknown, returns an error.
 */
export async function executeToolHandler(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const handler = HANDLER_MAP[toolName];

  if (handler) {
    try {
      return await handler(toolInput, userId, supabase);
    } catch (err: any) {
      return { success: false, error: `Tool "${toolName}" execution error: ${err.message || String(err)}` };
    }
  }

  // Check if it's in the registry but not yet handled
  const meta = TOOL_META[toolName];
  if (meta) {
    return {
      success: false,
      error: `Tool "${toolName}" is registered (category: ${meta.category}) but its handler is not yet implemented.`,
    };
  }

  return { success: false, error: `Unknown tool: ${toolName}` };
}

/** Get count of implemented tool handlers */
export function getImplementedToolCount(): number {
  return Object.keys(HANDLER_MAP).length;
}

// ---------------------------------------------------------------------------
// Error Classification
// ---------------------------------------------------------------------------

export type ErrorType = 'FACTUAL_ERROR' | 'REASONING_ERROR' | 'TOOL_MISUSE' | 'CONTEXT_MISSING';

export interface ClassifiedError {
  type: ErrorType;
  error: string;
  details: {
    tool_name: string;
    input_summary: Record<string, unknown>;
    suggested_action: string;
  };
}

/**
 * Classify a tool execution error into one of four learning-relevant types.
 * Used to route errors to appropriate learning artifacts:
 * - TOOL_MISUSE → parameter guidance updates
 * - CONTEXT_MISSING → context pattern recording
 * - FACTUAL_ERROR → corrective rule generation
 * - REASONING_ERROR → prompt guidance
 */
export function classifyToolError(
  toolName: string,
  toolInput: Record<string, unknown>,
  errorMessage: string,
): ClassifiedError {
  const errorLower = errorMessage.toLowerCase();
  const meta = TOOL_META[toolName];

  // TOOL_MISUSE: wrong tool, missing required params, handler not implemented
  if (
    errorLower.includes('unknown tool') ||
    errorLower.includes('not yet implemented') ||
    errorLower.includes('missing required') ||
    (errorLower.includes('invalid') && (errorLower.includes('parameter') || errorLower.includes('input'))) ||
    (errorLower.includes('expected') && errorLower.includes('got'))
  ) {
    return {
      type: 'TOOL_MISUSE',
      error: errorMessage,
      details: {
        tool_name: toolName,
        input_summary: summariseInput(toolInput),
        suggested_action: `Review tool "${toolName}" parameters. Category: ${meta?.category || 'unknown'}`,
      },
    };
  }

  // CONTEXT_MISSING: not found, no data, permission denied
  if (
    errorLower.includes('not found') ||
    errorLower.includes('no data') ||
    errorLower.includes('does not exist') ||
    errorLower.includes('no rows') ||
    errorLower.includes('permission denied') ||
    errorLower.includes('access denied') ||
    errorLower.includes('no matching')
  ) {
    return {
      type: 'CONTEXT_MISSING',
      error: errorMessage,
      details: {
        tool_name: toolName,
        input_summary: summariseInput(toolInput),
        suggested_action: 'Verify entity exists and user has access before calling this tool',
      },
    };
  }

  // FACTUAL_ERROR: constraint violations, data mismatches
  if (
    errorLower.includes('constraint') ||
    errorLower.includes('duplicate') ||
    errorLower.includes('already exists') ||
    errorLower.includes('violates') ||
    errorLower.includes('out of range') ||
    errorLower.includes('invalid date') ||
    errorLower.includes('type mismatch')
  ) {
    return {
      type: 'FACTUAL_ERROR',
      error: errorMessage,
      details: {
        tool_name: toolName,
        input_summary: summariseInput(toolInput),
        suggested_action: 'Check data assumptions before executing this tool',
      },
    };
  }

  // REASONING_ERROR: everything else (timeout, logic errors, unexpected failures)
  return {
    type: 'REASONING_ERROR',
    error: errorMessage,
    details: {
      tool_name: toolName,
      input_summary: summariseInput(toolInput),
      suggested_action: 'Review the reasoning chain that led to this tool call',
    },
  };
}

function summariseInput(input: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 100) {
      summary[key] = value.substring(0, 100) + '...';
    } else {
      summary[key] = value;
    }
  }
  return summary;
}
