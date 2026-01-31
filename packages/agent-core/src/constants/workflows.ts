import type { WorkflowDefinition } from '../types/workflows';

/**
 * 5 workflow compositions with dependency graphs, gates, and compensation.
 * Each workflow is checkpointed, resumable, and has defined rollback paths.
 */

// ─── 5.1 Find Tenant Workflow ───────────────────────────────────────────────

export const WORKFLOW_FIND_TENANT: WorkflowDefinition = {
  name: 'workflow_find_tenant',
  description: 'Full tenant finding: generate listing → syndicate → screen applications → recommend',
  steps: [
    {
      stepIndex: 0,
      toolName: 'get_property',
      paramResolver: 'from_context',
      description: 'Load property details for listing generation',
    },
    {
      stepIndex: 1,
      toolName: 'generate_listing',
      paramResolver: 'from_previous',
      description: 'Generate listing copy from property data',
    },
    {
      stepIndex: 2,
      toolName: 'suggest_rent_price',
      paramResolver: 'from_previous',
      description: 'Suggest optimal rent price from comparables',
    },
    {
      stepIndex: 3,
      toolName: 'create_listing',
      paramResolver: 'from_previous',
      gate: 'owner_approval',
      compensationTool: 'pause_listing',
      description: 'Create draft listing (owner reviews before publish)',
    },
    {
      stepIndex: 4,
      toolName: 'publish_listing',
      paramResolver: 'from_previous',
      compensationTool: 'pause_listing',
      description: 'Publish approved listing',
    },
    {
      stepIndex: 5,
      toolName: 'syndicate_listing_domain',
      paramResolver: 'from_previous',
      optional: true,
      description: 'Syndicate to Domain.com.au (optional, queued on failure)',
    },
    {
      stepIndex: 6,
      toolName: 'syndicate_listing_rea',
      paramResolver: 'from_previous',
      optional: true,
      description: 'Syndicate to realestate.com.au (optional, queued on failure)',
    },
    {
      stepIndex: 7,
      toolName: 'get_applications',
      paramResolver: 'from_previous',
      gate: 'webhook_wait',
      description: 'Wait for applications to arrive, then retrieve them',
    },
    {
      stepIndex: 8,
      toolName: 'score_application',
      paramResolver: 'from_previous',
      perItem: true,
      description: 'AI-score each application',
    },
    {
      stepIndex: 9,
      toolName: 'run_credit_check',
      paramResolver: 'from_previous',
      perItem: true,
      optional: true,
      description: 'Run credit check on shortlisted applicants',
    },
    {
      stepIndex: 10,
      toolName: 'run_tica_check',
      paramResolver: 'from_previous',
      perItem: true,
      optional: true,
      description: 'Run TICA check on shortlisted applicants',
    },
    {
      stepIndex: 11,
      toolName: 'rank_applications',
      paramResolver: 'from_previous',
      description: 'Rank all scored and screened applications',
    },
    {
      stepIndex: 12,
      toolName: 'accept_application',
      paramResolver: 'from_previous',
      gate: 'owner_approval',
      description: 'Accept top applicant (owner selects)',
    },
    {
      stepIndex: 13,
      toolName: 'reject_application',
      paramResolver: 'from_previous',
      perItem: true,
      optional: true,
      description: 'Reject remaining applicants with notification',
    },
  ],
  maxDurationMs: 2_592_000_000, // 30 days (long-running)
  checkpointAfterEachStep: true,
  resumable: true,
  resumeWindowMs: 2_592_000_000,
  availableFromMission: 4,
};

// ─── 5.2 Onboard Tenant Workflow ────────────────────────────────────────────

export const WORKFLOW_ONBOARD_TENANT: WorkflowDefinition = {
  name: 'workflow_onboard_tenant',
  description: 'Full tenant onboarding: lease → sign → bond → entry inspection → welcome',
  steps: [
    {
      stepIndex: 0,
      toolName: 'get_application_detail',
      paramResolver: 'from_context',
      description: 'Load accepted application details',
    },
    {
      stepIndex: 1,
      toolName: 'generate_lease',
      paramResolver: 'from_previous',
      description: 'Generate state-compliant lease document',
    },
    {
      stepIndex: 2,
      toolName: 'send_docusign_envelope',
      paramResolver: 'from_previous',
      gate: 'owner_approval',
      description: 'Send lease for e-signing (owner reviews first)',
    },
    {
      stepIndex: 3,
      toolName: 'get_tenancy',
      paramResolver: 'from_previous',
      gate: 'webhook_wait',
      description: 'Wait for signatures, then load tenancy',
    },
    {
      stepIndex: 4,
      toolName: 'collect_rent_stripe',
      paramResolver: 'from_previous',
      compensationTool: 'refund_payment_stripe',
      description: 'Collect bond payment via Stripe',
    },
    {
      stepIndex: 5,
      toolName: 'lodge_bond_state',
      paramResolver: 'from_previous',
      description: 'Lodge bond with state authority',
    },
    {
      stepIndex: 6,
      toolName: 'schedule_inspection',
      paramResolver: 'from_previous',
      compensationTool: 'cancel_inspection',
      description: 'Schedule entry condition inspection',
    },
    {
      stepIndex: 7,
      toolName: 'send_message',
      paramResolver: 'from_previous',
      description: 'Send welcome message with move-in details',
    },
    {
      stepIndex: 8,
      toolName: 'update_listing',
      paramResolver: 'from_previous',
      description: 'Mark listing as leased',
    },
    {
      stepIndex: 9,
      toolName: 'remember',
      paramResolver: 'from_previous',
      optional: true,
      description: 'Store tenant preferences for future interactions',
    },
  ],
  maxDurationMs: 1_209_600_000, // 14 days
  checkpointAfterEachStep: true,
  resumable: true,
  resumeWindowMs: 1_209_600_000,
  availableFromMission: 6,
};

// ─── 5.3 End Tenancy Workflow ───────────────────────────────────────────────

export const WORKFLOW_END_TENANCY: WorkflowDefinition = {
  name: 'workflow_end_tenancy',
  description: 'End tenancy: exit inspection → bond disposition → final report → relist',
  steps: [
    {
      stepIndex: 0,
      toolName: 'get_tenancy',
      paramResolver: 'from_context',
      description: 'Load tenancy details',
    },
    {
      stepIndex: 1,
      toolName: 'schedule_inspection',
      paramResolver: 'from_previous',
      compensationTool: 'cancel_inspection',
      staticParams: { type: 'exit' },
      description: 'Schedule exit condition inspection',
    },
    {
      stepIndex: 2,
      toolName: 'generate_inspection_report',
      paramResolver: 'from_previous',
      gate: 'webhook_wait',
      description: 'Wait for inspection, then generate report',
    },
    {
      stepIndex: 3,
      toolName: 'compare_inspections',
      paramResolver: 'from_previous',
      description: 'Compare entry vs exit condition',
    },
    {
      stepIndex: 4,
      toolName: 'lodge_bond_state',
      paramResolver: 'from_previous',
      gate: 'owner_approval',
      description: 'Release or claim bond (owner decides deductions)',
    },
    {
      stepIndex: 5,
      toolName: 'generate_financial_report',
      paramResolver: 'from_previous',
      description: 'Generate final tenancy financial report',
    },
    {
      stepIndex: 6,
      toolName: 'send_message',
      paramResolver: 'from_previous',
      description: 'Send farewell message with bond info',
    },
    {
      stepIndex: 7,
      toolName: 'workflow_find_tenant',
      paramResolver: 'from_context',
      optional: true,
      description: 'Start find-tenant workflow if owner wants to relist',
    },
  ],
  maxDurationMs: 2_592_000_000, // 30 days
  checkpointAfterEachStep: true,
  resumable: true,
  resumeWindowMs: 2_592_000_000,
  availableFromMission: 6,
};

// ─── 5.4 Maintenance Lifecycle Workflow ─────────────────────────────────────

export const WORKFLOW_MAINTENANCE_LIFECYCLE: WorkflowDefinition = {
  name: 'workflow_maintenance_lifecycle',
  description: 'Full maintenance: triage → estimate → quote → approve → complete → pay',
  steps: [
    {
      stepIndex: 0,
      toolName: 'triage_maintenance',
      paramResolver: 'from_context',
      description: 'Categorize urgency and suggest action',
    },
    {
      stepIndex: 1,
      toolName: 'estimate_cost',
      paramResolver: 'from_previous',
      description: 'Estimate cost from description + market rates',
    },
    {
      stepIndex: 2,
      toolName: 'get_trades',
      paramResolver: 'from_previous',
      description: 'Find available tradespeople for the job',
    },
    {
      stepIndex: 3,
      toolName: 'create_work_order',
      paramResolver: 'from_previous',
      gate: 'owner_approval',
      compensationTool: 'update_maintenance_status',
      compensationParams: { status: 'cancelled' },
      description: 'Create work order (auto-approve if under threshold, else owner approval)',
    },
    {
      stepIndex: 4,
      toolName: 'send_message',
      paramResolver: 'from_previous',
      description: 'Notify tenant of scheduled maintenance',
    },
    {
      stepIndex: 5,
      toolName: 'update_maintenance_status',
      paramResolver: 'from_previous',
      gate: 'webhook_wait',
      staticParams: { status: 'completed' },
      description: 'Wait for job completion, update status',
    },
    {
      stepIndex: 6,
      toolName: 'send_message',
      paramResolver: 'from_previous',
      description: 'Ask tenant to confirm fix is satisfactory',
    },
    {
      stepIndex: 7,
      toolName: 'process_payment',
      paramResolver: 'from_previous',
      optional: true,
      description: 'Pay tradesperson (if payment integration enabled)',
    },
  ],
  maxDurationMs: 1_209_600_000, // 14 days
  checkpointAfterEachStep: true,
  resumable: true,
  resumeWindowMs: 2_592_000_000,
  availableFromMission: 9,
};

// ─── 5.5 Arrears Escalation Workflow ────────────────────────────────────────

export const WORKFLOW_ARREARS_ESCALATION: WorkflowDefinition = {
  name: 'workflow_arrears_escalation',
  description: 'Arrears escalation ladder: friendly → formal → breach → owner decision',
  steps: [
    {
      stepIndex: 0,
      toolName: 'send_rent_reminder',
      paramResolver: 'from_context',
      staticParams: { tone: 'friendly' },
      description: 'Day 1-3: Send friendly rent reminder',
    },
    {
      stepIndex: 1,
      toolName: 'send_rent_reminder',
      paramResolver: 'from_context',
      gate: 'schedule_wait',
      staticParams: { tone: 'formal' },
      description: 'Day 4-7: Send formal rent reminder',
    },
    {
      stepIndex: 2,
      toolName: 'send_push_expo',
      paramResolver: 'from_context',
      description: 'Day 7: Alert owner about arrears situation',
    },
    {
      stepIndex: 3,
      toolName: 'generate_notice',
      paramResolver: 'from_context',
      gate: 'owner_approval',
      staticParams: { notice_type: 'breach' },
      description: 'Day 8-14: Generate breach notice (owner must approve)',
    },
    {
      stepIndex: 4,
      toolName: 'send_breach_notice',
      paramResolver: 'from_previous',
      description: 'Send approved breach notice to tenant',
    },
    {
      stepIndex: 5,
      toolName: 'escalate_arrears',
      paramResolver: 'from_context',
      gate: 'owner_approval',
      description: 'Day 14+: Owner decides next action (payment plan, tribunal, or continue)',
    },
  ],
  maxDurationMs: 2_592_000_000, // 30 days
  checkpointAfterEachStep: true,
  resumable: true,
  resumeWindowMs: 7_776_000_000, // 90 days
  availableFromMission: 8,
};

// ─── All Workflows ──────────────────────────────────────────────────────────

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  WORKFLOW_FIND_TENANT,
  WORKFLOW_ONBOARD_TENANT,
  WORKFLOW_END_TENANCY,
  WORKFLOW_MAINTENANCE_LIFECYCLE,
  WORKFLOW_ARREARS_ESCALATION,
];

export const WORKFLOW_BY_NAME: Record<string, WorkflowDefinition> = Object.fromEntries(
  WORKFLOW_DEFINITIONS.map(wf => [wf.name, wf])
);
