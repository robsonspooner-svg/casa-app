// Tool Registry for Casa Agent Edge Functions
// Generated from @casa/agent-core tool catalog
//
// This file provides the complete tool catalog in Claude API format,
// plus autonomy metadata for gating decisions. When the agent-core
// catalog is updated, this file should be regenerated.
//
// Autonomy Levels:
//   0 = Inform (always needs owner approval)
//   1 = Suggest (proposes action, needs confirmation)
//   2 = Draft (prepares action for review)
//   3 = Execute (does it, reports after)
//   4 = Autonomous (silent execution)

export interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolMeta {
  category: string;
  autonomyLevel: number;
  riskLevel: string;
  reversible: boolean;
  compensationTool?: string;
}

// ---------------------------------------------------------------------------
// Claude API Tool Definitions (sent to Claude in `tools` array)
// ---------------------------------------------------------------------------

export const CLAUDE_TOOLS: AgentToolDefinition[] = [
  // ── QUERY TOOLS ───────────────────────────────────────────────────────────
  { name: 'get_property', description: 'Get property details including address, features, tenancy, and compliance', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, include: { type: 'array', items: { type: 'string', enum: ['tenancy', 'compliance', 'financials', 'maintenance'] }, description: 'Optional related data to include' } }, required: ['property_id'] } },
  { name: 'get_properties', description: "List all owner's properties with summary stats", input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'vacant', 'all'], description: 'Filter by property status' }, limit: { type: 'number', description: 'Max results to return' } } } },
  { name: 'search_tenants', description: 'Search tenants by name, email, phone, or property', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Search query (name, email, phone)' }, property_id: { type: 'string', description: 'Filter by property' }, status: { type: 'string', enum: ['active', 'past', 'all'], description: 'Tenancy status filter' } } } },
  { name: 'get_tenancy', description: 'Get active tenancy: tenants, lease dates, rent, bond status', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, property_id: { type: 'string', description: 'Or lookup by property' } } } },
  { name: 'get_tenancy_detail', description: 'Full tenancy: tenants, lease dates, rent, bond, documents, rent increases, payment history', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' } }, required: ['tenancy_id'] } },
  { name: 'get_payments', description: 'Get payment history with amounts and statuses', input_schema: { type: 'object', properties: { tenant_id: { type: 'string', description: 'Filter by tenant' }, property_id: { type: 'string', description: 'Filter by property' }, period: { type: 'string', enum: ['week', 'month', 'quarter', 'year', 'all'], description: 'Time period' }, status: { type: 'string', enum: ['paid', 'pending', 'failed', 'all'], description: 'Payment status' } } } },
  { name: 'get_rent_schedule', description: 'Get upcoming rent due dates and amounts', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, include_paid: { type: 'boolean', description: 'Include already-paid periods' } }, required: ['tenancy_id'] } },
  { name: 'get_arrears', description: 'Get all tenants in arrears with days overdue and escalation level', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, min_days: { type: 'number', description: 'Minimum days overdue' }, severity: { type: 'string', enum: ['friendly', 'formal', 'breach', 'critical'], description: 'Escalation level filter' } } } },
  { name: 'get_arrears_detail', description: 'Full arrears record: amount, days overdue, actions taken, payment plan, escalation level', input_schema: { type: 'object', properties: { arrears_id: { type: 'string', description: 'Arrears record UUID' }, tenancy_id: { type: 'string', description: 'Or lookup by tenancy' } } } },
  { name: 'get_maintenance', description: 'Get maintenance requests filtered by property/status/urgency', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, status: { type: 'string', enum: ['submitted', 'acknowledged', 'awaiting_quote', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold', 'all'], description: 'Request status' }, urgency: { type: 'string', enum: ['emergency', 'urgent', 'routine'], description: 'Urgency level' } } } },
  { name: 'get_maintenance_detail', description: 'Full maintenance request: quotes, photos, comments, timeline', input_schema: { type: 'object', properties: { request_id: { type: 'string', description: 'Maintenance request UUID' } }, required: ['request_id'] } },
  { name: 'get_quotes', description: 'Get all quotes for a maintenance request with trade rankings', input_schema: { type: 'object', properties: { request_id: { type: 'string', description: 'Maintenance request UUID' } }, required: ['request_id'] } },
  { name: 'get_inspections', description: 'Get inspection history and upcoming scheduled inspections', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, type: { type: 'string', enum: ['entry', 'routine', 'exit', 'all'], description: 'Inspection type' }, status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled', 'all'], description: 'Status filter' } } } },
  { name: 'get_inspection_detail', description: 'Get full inspection: rooms, items, condition ratings, photos, tenant response', input_schema: { type: 'object', properties: { inspection_id: { type: 'string', description: 'Inspection UUID' } }, required: ['inspection_id'] } },
  { name: 'get_listings', description: 'Get listings with view/enquiry/application counts', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, status: { type: 'string', enum: ['draft', 'active', 'paused', 'leased', 'all'], description: 'Listing status' } } } },
  { name: 'get_listing_detail', description: 'Full listing: features, policies, photos, view count, application count, portal status', input_schema: { type: 'object', properties: { listing_id: { type: 'string', description: 'Listing UUID' } }, required: ['listing_id'] } },
  { name: 'get_applications', description: 'Get applications for a listing with scores and screening', input_schema: { type: 'object', properties: { listing_id: { type: 'string', description: 'Listing UUID' }, status: { type: 'string', enum: ['pending', 'shortlisted', 'accepted', 'rejected', 'all'], description: 'Application status' }, top_n: { type: 'number', description: 'Return top N ranked applications' } }, required: ['listing_id'] } },
  { name: 'get_application_detail', description: 'Full application: documents, references, checks, score', input_schema: { type: 'object', properties: { application_id: { type: 'string', description: 'Application UUID' } }, required: ['application_id'] } },
  { name: 'get_conversations', description: 'Get message threads across properties', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, unread_only: { type: 'boolean', description: 'Only unread threads' } } } },
  { name: 'get_conversation_messages', description: 'Get messages for a conversation thread with sender details and attachments', input_schema: { type: 'object', properties: { conversation_id: { type: 'string', description: 'Conversation UUID' }, limit: { type: 'number', description: 'Max messages to return' } }, required: ['conversation_id'] } },
  { name: 'get_compliance_status', description: 'Get compliance status for properties (smoke alarms, gas, pool, etc.)', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, overdue_only: { type: 'boolean', description: 'Only overdue items' } } } },
  { name: 'get_financial_summary', description: 'Get income, expenses, net position for period', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, period: { type: 'string', enum: ['month', 'quarter', 'year', 'custom'], description: 'Reporting period' }, start_date: { type: 'string', description: 'Start date (ISO 8601) for custom period' }, end_date: { type: 'string', description: 'End date (ISO 8601) for custom period' } }, required: ['period'] } },
  { name: 'get_transactions', description: 'Get itemized transactions (rent, bond, maintenance, fees)', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, type: { type: 'string', enum: ['rent', 'bond', 'maintenance', 'fee', 'all'], description: 'Transaction type' }, period: { type: 'string', enum: ['month', 'quarter', 'year', 'all'], description: 'Time period' } } } },
  { name: 'get_trades', description: 'Search tradesperson network by category/area/rating', input_schema: { type: 'object', properties: { category: { type: 'string', description: 'Trade category (plumber, electrician, etc.)' }, postcode: { type: 'string', description: 'Service area postcode' }, min_rating: { type: 'number', description: 'Minimum rating (1-5)' } } } },
  { name: 'get_work_orders', description: 'Get work orders for a property or trade with status and cost details', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, trade_id: { type: 'string', description: 'Filter by tradesperson' }, status: { type: 'string', enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'all'], description: 'Work order status' } } } },
  { name: 'get_expenses', description: 'Get expense records for tax reporting and financial analysis', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, period: { type: 'string', enum: ['month', 'quarter', 'year', 'financial_year', 'all'], description: 'Time period' }, category: { type: 'string', description: 'Expense category filter' } } } },
  { name: 'get_payment_plan', description: 'Get payment plan details including installments and status', input_schema: { type: 'object', properties: { payment_plan_id: { type: 'string', description: 'Payment plan UUID' }, tenancy_id: { type: 'string', description: 'Or lookup by tenancy' } } } },
  { name: 'get_documents', description: 'Get documents for a property or tenancy', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Filter by property' }, tenancy_id: { type: 'string', description: 'Filter by tenancy' }, type: { type: 'string', enum: ['lease', 'inspection', 'notice', 'receipt', 'compliance', 'all'], description: 'Document type' } } } },
  { name: 'get_background_tasks', description: 'Get status of running background tasks', input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['running', 'completed', 'failed', 'all'], description: 'Task status filter' } } } },
  { name: 'get_pending_actions', description: 'Get all actions awaiting owner approval', input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['pending', 'expired', 'all'], description: 'Approval status' } } } },

  // ── ACTION TOOLS ──────────────────────────────────────────────────────────
  { name: 'create_property', description: 'Create a new property with address, details, and financials', input_schema: { type: 'object', properties: { address_line_1: { type: 'string', description: 'Street address' }, address_line_2: { type: 'string', description: 'Unit/apartment' }, suburb: { type: 'string', description: 'Suburb name' }, state: { type: 'string', enum: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'], description: 'Australian state' }, postcode: { type: 'string', description: '4-digit postcode' }, property_type: { type: 'string', enum: ['house', 'apartment', 'townhouse', 'unit', 'studio', 'other'], description: 'Property type' }, bedrooms: { type: 'number', description: 'Number of bedrooms' }, bathrooms: { type: 'number', description: 'Number of bathrooms' }, parking_spaces: { type: 'number', description: 'Number of parking spaces' }, floor_size_sqm: { type: 'number', description: 'Floor area in sqm' }, land_size_sqm: { type: 'number', description: 'Land area in sqm' }, year_built: { type: 'number', description: 'Year built' }, rent_amount: { type: 'number', description: 'Rent amount (AUD)' }, rent_frequency: { type: 'string', enum: ['weekly', 'fortnightly', 'monthly'], description: 'Rent frequency' }, bond_amount: { type: 'number', description: 'Bond amount (AUD)' }, notes: { type: 'string', description: 'Additional notes' } }, required: ['address_line_1', 'suburb', 'state', 'postcode'] } },
  { name: 'update_property', description: 'Update property details — address, features, financials, notes', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, updates: { type: 'object', description: 'Fields to update' } }, required: ['property_id', 'updates'] } },
  { name: 'delete_property', description: 'Soft-delete a property', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, reason: { type: 'string', description: 'Reason for deletion' } }, required: ['property_id'] } },
  { name: 'create_tenancy', description: 'Create a new tenancy — lease, tenants, bond, rent schedule', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, tenant_ids: { type: 'array', items: { type: 'string' }, description: 'Tenant user UUIDs' }, lease_type: { type: 'string', enum: ['fixed', 'periodic'] }, lease_start_date: { type: 'string', description: 'Lease start (ISO 8601)' }, lease_end_date: { type: 'string', description: 'Lease end (ISO 8601)' }, rent_amount: { type: 'number', description: 'Rent (AUD)' }, rent_frequency: { type: 'string', enum: ['weekly', 'fortnightly', 'monthly'] }, rent_due_day: { type: 'number', description: 'Day rent is due (1-31)' }, bond_amount: { type: 'number', description: 'Bond (AUD)' }, notes: { type: 'string' } }, required: ['property_id', 'lease_start_date', 'rent_amount', 'rent_frequency'] } },
  { name: 'update_tenancy', description: 'Update tenancy fields — rent, dates, status, notes', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, updates: { type: 'object', description: 'Fields to update' } }, required: ['tenancy_id', 'updates'] } },
  { name: 'terminate_lease', description: 'Initiate lease termination', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, termination_type: { type: 'string', enum: ['mutual', 'owner_notice', 'tenant_notice', 'breach'] }, effective_date: { type: 'string', description: 'Termination date (ISO 8601)' }, reason: { type: 'string' } }, required: ['tenancy_id', 'termination_type', 'effective_date'] } },
  { name: 'renew_lease', description: 'Renew lease with new dates and optional rent adjustment', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, new_end_date: { type: 'string', description: 'New end date (ISO 8601)' }, new_rent_amount: { type: 'number', description: 'New rent if changing' }, lease_type: { type: 'string', enum: ['fixed', 'periodic'] } }, required: ['tenancy_id', 'new_end_date'] } },
  { name: 'create_listing', description: 'Create new property listing (draft)', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, title: { type: 'string', description: 'Listing title' }, description: { type: 'string', description: 'Listing description' }, rent_weekly: { type: 'number', description: 'Weekly rent (AUD)' }, available_date: { type: 'string', description: 'Available date (ISO 8601)' } }, required: ['property_id', 'title', 'rent_weekly'] } },
  { name: 'update_listing', description: 'Update listing details', input_schema: { type: 'object', properties: { listing_id: { type: 'string', description: 'Listing UUID' }, updates: { type: 'object', description: 'Fields to update' } }, required: ['listing_id', 'updates'] } },
  { name: 'publish_listing', description: 'Publish draft listing to portals', input_schema: { type: 'object', properties: { listing_id: { type: 'string', description: 'Listing UUID' }, portals: { type: 'array', items: { type: 'string', enum: ['domain', 'rea', 'both'] } } }, required: ['listing_id'] } },
  { name: 'pause_listing', description: 'Pause an active listing', input_schema: { type: 'object', properties: { listing_id: { type: 'string', description: 'Listing UUID' }, reason: { type: 'string' } }, required: ['listing_id'] } },
  { name: 'send_message', description: 'Send message to tenant via preferred channel', input_schema: { type: 'object', properties: { tenant_id: { type: 'string', description: 'Recipient tenant UUID' }, content: { type: 'string', description: 'Message content' }, channel: { type: 'string', enum: ['in_app', 'email', 'sms', 'preferred'], description: 'Delivery channel' }, priority: { type: 'string', enum: ['normal', 'urgent'] } }, required: ['tenant_id', 'content'] } },
  { name: 'create_conversation', description: 'Create a new in-app conversation thread with participants', input_schema: { type: 'object', properties: { participant_ids: { type: 'array', items: { type: 'string' }, description: 'User UUIDs' }, property_id: { type: 'string', description: 'Related property' }, subject: { type: 'string', description: 'Conversation subject' }, initial_message: { type: 'string', description: 'First message' } }, required: ['participant_ids'] } },
  { name: 'send_in_app_message', description: 'Send a message in an existing conversation thread', input_schema: { type: 'object', properties: { conversation_id: { type: 'string', description: 'Conversation UUID' }, content: { type: 'string', description: 'Message content' } }, required: ['conversation_id', 'content'] } },
  { name: 'send_rent_reminder', description: 'Send templated rent reminder to tenant', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, tone: { type: 'string', enum: ['friendly', 'formal'] }, include_amount: { type: 'boolean', description: 'Include amount in reminder' } }, required: ['tenancy_id'] } },
  { name: 'send_breach_notice', description: 'Generate and send state-compliant breach notice', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, breach_type: { type: 'string', enum: ['rent_arrears', 'property_damage', 'noise', 'pets', 'other'] }, details: { type: 'string' }, state: { type: 'string', enum: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] } }, required: ['tenancy_id', 'breach_type', 'details', 'state'] } },
  { name: 'create_maintenance', description: 'Create new maintenance request', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, title: { type: 'string', description: 'Short description' }, description: { type: 'string', description: 'Detailed description' }, urgency: { type: 'string', enum: ['emergency', 'urgent', 'routine', 'cosmetic'] }, category: { type: 'string', description: 'Category (plumbing, electrical, etc.)' }, reported_by: { type: 'string', enum: ['tenant', 'owner', 'agent', 'inspector'] } }, required: ['property_id', 'title', 'urgency', 'category'] } },
  { name: 'update_maintenance_status', description: 'Update maintenance request status', input_schema: { type: 'object', properties: { request_id: { type: 'string', description: 'Request UUID' }, status: { type: 'string', enum: ['submitted', 'acknowledged', 'awaiting_quote', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold'] }, notes: { type: 'string', description: 'Status change notes' } }, required: ['request_id', 'status'] } },
  { name: 'add_maintenance_comment', description: 'Add a comment to a maintenance request thread', input_schema: { type: 'object', properties: { request_id: { type: 'string', description: 'Request UUID' }, content: { type: 'string', description: 'Comment content' }, is_internal: { type: 'boolean', description: 'Internal note (not visible to tenant)' } }, required: ['request_id', 'content'] } },
  { name: 'record_maintenance_cost', description: 'Record estimated or actual cost for a maintenance request', input_schema: { type: 'object', properties: { request_id: { type: 'string', description: 'Request UUID' }, estimated_cost: { type: 'number', description: 'Estimated cost (AUD)' }, actual_cost: { type: 'number', description: 'Actual cost (AUD)' }, cost_responsibility: { type: 'string', enum: ['owner', 'tenant', 'insurance', 'warranty'] } }, required: ['request_id'] } },
  { name: 'schedule_inspection', description: 'Schedule inspection with tenant notification', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, type: { type: 'string', enum: ['entry', 'routine', 'exit'] }, preferred_date: { type: 'string', description: 'Date (ISO 8601)' }, notify_tenant: { type: 'boolean' } }, required: ['property_id', 'type', 'preferred_date'] } },
  { name: 'cancel_inspection', description: 'Cancel a scheduled inspection', input_schema: { type: 'object', properties: { inspection_id: { type: 'string', description: 'Inspection UUID' }, reason: { type: 'string' }, notify_tenant: { type: 'boolean' } }, required: ['inspection_id'] } },
  { name: 'record_inspection_finding', description: 'Record condition rating and notes for an inspection item', input_schema: { type: 'object', properties: { inspection_id: { type: 'string', description: 'Inspection UUID' }, item_id: { type: 'string', description: 'Inspection item UUID' }, condition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor', 'damaged', 'missing', 'not_applicable'], description: 'Condition rating' }, notes: { type: 'string', description: 'Notes about condition' }, action_required: { type: 'boolean', description: 'Whether action is required' }, estimated_cost: { type: 'number', description: 'Estimated repair cost (AUD)' } }, required: ['inspection_id', 'item_id', 'condition'] } },
  { name: 'submit_inspection_to_tenant', description: 'Submit completed inspection to tenant for review and acknowledgement', input_schema: { type: 'object', properties: { inspection_id: { type: 'string', description: 'Inspection UUID' }, message: { type: 'string', description: 'Optional message to tenant' } }, required: ['inspection_id'] } },
  { name: 'finalize_inspection', description: 'Finalize and lock an inspection after tenant review', input_schema: { type: 'object', properties: { inspection_id: { type: 'string', description: 'Inspection UUID' } }, required: ['inspection_id'] } },
  { name: 'create_work_order', description: 'Create work order for tradesperson', input_schema: { type: 'object', properties: { request_id: { type: 'string', description: 'Maintenance request UUID' }, trade_id: { type: 'string', description: 'Tradesperson UUID' }, scope: { type: 'string', description: 'Work scope' }, budget: { type: 'number', description: 'Budget (AUD)' }, scheduled_date: { type: 'string', description: 'Date (ISO 8601)' } }, required: ['request_id', 'trade_id', 'scope', 'budget'] } },
  { name: 'update_work_order_status', description: 'Update work order status (accept, start, complete, cancel)', input_schema: { type: 'object', properties: { work_order_id: { type: 'string', description: 'Work order UUID' }, status: { type: 'string', enum: ['accepted', 'in_progress', 'completed', 'cancelled'] }, notes: { type: 'string' }, actual_cost: { type: 'number', description: 'Actual cost (AUD)' } }, required: ['work_order_id', 'status'] } },
  { name: 'approve_quote', description: 'Approve maintenance quote, schedule trade', input_schema: { type: 'object', properties: { quote_id: { type: 'string', description: 'Quote UUID' }, request_id: { type: 'string', description: 'Request UUID' }, preferred_schedule: { type: 'string' } }, required: ['quote_id', 'request_id'] } },
  { name: 'reject_quote', description: 'Reject a maintenance quote with reason', input_schema: { type: 'object', properties: { quote_id: { type: 'string', description: 'Quote UUID' }, reason: { type: 'string' }, request_alternative: { type: 'boolean' } }, required: ['quote_id', 'reason'] } },
  { name: 'accept_application', description: 'Approve tenant application (triggers onboarding workflow)', input_schema: { type: 'object', properties: { application_id: { type: 'string', description: 'Application UUID' }, move_in_date: { type: 'string', description: 'Move-in date (ISO 8601)' }, custom_conditions: { type: 'string' } }, required: ['application_id'] } },
  { name: 'reject_application', description: 'Reject tenant application with reason', input_schema: { type: 'object', properties: { application_id: { type: 'string', description: 'Application UUID' }, reason: { type: 'string' }, send_notification: { type: 'boolean' } }, required: ['application_id', 'reason'] } },
  { name: 'shortlist_application', description: 'Move application to shortlist', input_schema: { type: 'object', properties: { application_id: { type: 'string', description: 'Application UUID' }, notes: { type: 'string' } }, required: ['application_id'] } },
  { name: 'create_payment_plan', description: 'Create payment plan for tenant in arrears', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, total_arrears: { type: 'number', description: 'Total arrears (AUD)' }, installment_amount: { type: 'number', description: 'Weekly installment (AUD)' }, start_date: { type: 'string', description: 'Plan start (ISO 8601)' } }, required: ['tenancy_id', 'total_arrears', 'installment_amount'] } },
  { name: 'escalate_arrears', description: 'Move arrears to next escalation level', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, current_level: { type: 'string', enum: ['friendly', 'formal', 'breach', 'tribunal'] }, next_level: { type: 'string', enum: ['formal', 'breach', 'tribunal', 'eviction'] } }, required: ['tenancy_id', 'current_level', 'next_level'] } },
  { name: 'resolve_arrears', description: 'Mark an arrears record as resolved', input_schema: { type: 'object', properties: { arrears_id: { type: 'string', description: 'Arrears UUID' }, resolution_reason: { type: 'string' } }, required: ['arrears_id', 'resolution_reason'] } },
  { name: 'log_arrears_action', description: 'Log an action taken on an arrears case', input_schema: { type: 'object', properties: { arrears_id: { type: 'string', description: 'Arrears UUID' }, action_type: { type: 'string', enum: ['phone_call', 'email', 'sms', 'note', 'letter', 'visit'] }, description: { type: 'string' }, outcome: { type: 'string' } }, required: ['arrears_id', 'action_type', 'description'] } },
  { name: 'create_rent_increase', description: 'Create rent increase notice with state-compliant notice period', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, new_amount: { type: 'number', description: 'New rent (AUD)' }, effective_date: { type: 'string', description: 'Effective date (ISO 8601)' }, reason: { type: 'string' } }, required: ['tenancy_id', 'new_amount', 'effective_date'] } },
  { name: 'change_rent_amount', description: 'Change rent on tenancy (requires notice period)', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, new_amount: { type: 'number', description: 'New weekly rent (AUD)' }, effective_date: { type: 'string', description: 'Effective date (ISO 8601)' }, reason: { type: 'string' } }, required: ['tenancy_id', 'new_amount', 'effective_date'] } },
  { name: 'record_compliance', description: 'Record compliance completion with evidence', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, compliance_type: { type: 'string', enum: ['smoke_alarm', 'gas_safety', 'pool_fence', 'electrical', 'other'] }, completed_date: { type: 'string', description: 'Completion date (ISO 8601)' }, next_due_date: { type: 'string', description: 'Next due date (ISO 8601)' }, evidence_url: { type: 'string', description: 'Evidence URL' } }, required: ['property_id', 'compliance_type', 'completed_date'] } },
  { name: 'add_trade_to_network', description: "Add a tradesperson to the owner's preferred network", input_schema: { type: 'object', properties: { trade_id: { type: 'string', description: 'Trade UUID' }, notes: { type: 'string' }, is_favorite: { type: 'boolean' } }, required: ['trade_id'] } },
  { name: 'submit_trade_review', description: 'Submit a review and rating for a tradesperson', input_schema: { type: 'object', properties: { trade_id: { type: 'string', description: 'Trade UUID' }, work_order_id: { type: 'string', description: 'Work order UUID' }, rating: { type: 'number', description: 'Rating 1-5' }, review_text: { type: 'string' }, would_recommend: { type: 'boolean' } }, required: ['trade_id', 'rating'] } },
  { name: 'invite_tenant', description: 'Send a direct invitation to a tenant to connect them to a property', input_schema: { type: 'object', properties: { email: { type: 'string', description: 'Tenant email' }, property_id: { type: 'string', description: 'Property UUID' }, name: { type: 'string', description: 'Tenant name' } }, required: ['email', 'property_id'] } },
  { name: 'process_payment', description: 'Process a rent payment charge', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, amount: { type: 'number', description: 'Amount (AUD)' }, description: { type: 'string' } }, required: ['tenancy_id', 'amount'] } },
  { name: 'lodge_bond', description: 'Lodge bond with state authority', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, amount: { type: 'number', description: 'Bond (AUD)' }, state: { type: 'string', enum: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] } }, required: ['tenancy_id', 'amount', 'state'] } },

  // ── GENERATE TOOLS ────────────────────────────────────────────────────────
  { name: 'generate_listing', description: 'Generate listing copy from property data and photos', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, tone: { type: 'string', enum: ['professional', 'friendly', 'luxury'] }, highlights: { type: 'array', items: { type: 'string' }, description: 'Features to emphasise' } }, required: ['property_id'] } },
  { name: 'draft_message', description: 'Draft message with specified purpose and tone', input_schema: { type: 'object', properties: { purpose: { type: 'string', description: 'Message purpose' }, context: { type: 'object', description: 'Context data' }, tone: { type: 'string', enum: ['friendly', 'formal', 'urgent'] }, recipient_type: { type: 'string', enum: ['tenant', 'owner', 'trade'] } }, required: ['purpose', 'tone', 'recipient_type'] } },
  { name: 'score_application', description: 'AI-score application (0-100) with reasoning', input_schema: { type: 'object', properties: { application_id: { type: 'string', description: 'Application UUID' }, criteria_weights: { type: 'object', description: 'Scoring weights' } }, required: ['application_id'] } },
  { name: 'rank_applications', description: 'Rank and compare multiple applications', input_schema: { type: 'object', properties: { listing_id: { type: 'string', description: 'Listing UUID' }, application_ids: { type: 'array', items: { type: 'string' }, description: 'Applications to rank' }, prioritize: { type: 'string', enum: ['income', 'history', 'references', 'balanced'] } }, required: ['listing_id', 'application_ids'] } },
  { name: 'triage_maintenance', description: 'Categorise urgency, estimate cost, suggest action', input_schema: { type: 'object', properties: { request_id: { type: 'string', description: 'Request UUID' }, description: { type: 'string' }, photos: { type: 'array', items: { type: 'string' } } }, required: ['request_id'] } },
  { name: 'estimate_cost', description: 'Estimate maintenance cost from description + market rates', input_schema: { type: 'object', properties: { category: { type: 'string', description: 'Trade category' }, description: { type: 'string', description: 'Work description' }, postcode: { type: 'string', description: 'Property postcode' } }, required: ['category', 'description'] } },
  { name: 'analyze_rent', description: 'Analyse rent vs market with recommendation', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, current_rent: { type: 'number', description: 'Current weekly rent (AUD)' }, include_comparables: { type: 'boolean' } }, required: ['property_id'] } },
  { name: 'suggest_rent_price', description: 'Suggest optimal rent from comparables', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, strategy: { type: 'string', enum: ['market_rate', 'quick_let', 'premium'] } }, required: ['property_id'] } },
  { name: 'generate_notice', description: 'Generate state-compliant legal notice', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, notice_type: { type: 'string', enum: ['breach', 'termination', 'rent_increase', 'entry', 'renovation'] }, state: { type: 'string', enum: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] }, details: { type: 'object', description: 'Notice-specific details' } }, required: ['tenancy_id', 'notice_type', 'state'] } },
  { name: 'generate_inspection_report', description: 'Generate report from photos and condition data', input_schema: { type: 'object', properties: { inspection_id: { type: 'string', description: 'Inspection UUID' }, photos: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['inspection_id'] } },
  { name: 'compare_inspections', description: 'Compare entry vs exit inspection with change detection', input_schema: { type: 'object', properties: { entry_inspection_id: { type: 'string' }, exit_inspection_id: { type: 'string' } }, required: ['entry_inspection_id', 'exit_inspection_id'] } },
  { name: 'generate_financial_report', description: 'Generate monthly/quarterly financial summary', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID (or all)' }, period: { type: 'string', enum: ['month', 'quarter', 'year'] }, include_projections: { type: 'boolean' } }, required: ['period'] } },
  { name: 'generate_tax_report', description: 'Generate tax-ready income and expense summary for financial year', input_schema: { type: 'object', properties: { property_id: { type: 'string' }, financial_year: { type: 'string', description: 'e.g. "2024-2025"' }, include_depreciation: { type: 'boolean' } }, required: ['financial_year'] } },
  { name: 'generate_property_summary', description: 'Generate comprehensive property summary with performance metrics', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, include_history: { type: 'boolean' } }, required: ['property_id'] } },
  { name: 'generate_portfolio_report', description: 'Generate multi-property portfolio analysis with yield, vacancy, and forecasting', input_schema: { type: 'object', properties: { include_forecasting: { type: 'boolean', description: 'Include forward projections' }, period: { type: 'string', enum: ['quarter', 'year'], description: 'Analysis period' } }, required: ['period'] } },
  { name: 'generate_cash_flow_forecast', description: 'Generate 3/6/12 month cash flow projection based on historical data', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID (or all)' }, months: { type: 'number', enum: [3, 6, 12], description: 'Projection period in months' } }, required: ['months'] } },
  { name: 'generate_lease', description: 'Generate state-compliant lease document', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, state: { type: 'string', enum: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] }, lease_type: { type: 'string', enum: ['fixed', 'periodic'] }, term_months: { type: 'number' }, special_conditions: { type: 'array', items: { type: 'string' } } }, required: ['tenancy_id', 'state', 'lease_type'] } },
  { name: 'assess_tenant_damage', description: 'Analyse if damage is tenant-caused vs wear and tear', input_schema: { type: 'object', properties: { maintenance_request_id: { type: 'string' }, description: { type: 'string' }, photo_urls: { type: 'array', items: { type: 'string' } }, property_age_years: { type: 'number' }, tenancy_duration_months: { type: 'number' }, last_inspection_notes: { type: 'string' } }, required: ['description'] } },
  { name: 'compare_quotes', description: 'Compare multiple quotes with ranked recommendations', input_schema: { type: 'object', properties: { maintenance_request_id: { type: 'string' }, quote_ids: { type: 'array', items: { type: 'string' } }, priority_factors: { type: 'object', properties: { price_weight: { type: 'number' }, quality_weight: { type: 'number' }, speed_weight: { type: 'number' } } } }, required: ['maintenance_request_id', 'quote_ids'] } },

  // ── EXTERNAL / INTEGRATION TOOLS ──────────────────────────────────────────
  { name: 'web_search', description: 'Search the web for property management info — regulations, market rates, service providers, compliance', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, region: { type: 'string', description: 'Region to focus results' }, max_results: { type: 'number' } }, required: ['query'] } },
  { name: 'find_local_trades', description: 'Search for local tradespeople near a property — returns business name, contact, ratings, distance', input_schema: { type: 'object', properties: { trade_type: { type: 'string', description: 'Type (plumber, electrician, etc.)' }, property_id: { type: 'string', description: 'Property UUID to find trades near' }, suburb: { type: 'string', description: 'Suburb to search' }, urgency: { type: 'string', enum: ['emergency', 'urgent', 'routine'] }, max_results: { type: 'number' } }, required: ['trade_type'] } },
  { name: 'parse_business_details', description: 'Extract structured business info from a webpage — ABN, license, insurance, ratings, contact', input_schema: { type: 'object', properties: { url: { type: 'string', description: 'Business webpage URL' }, business_name: { type: 'string' } }, required: ['url'] } },
  { name: 'create_service_provider', description: 'Create/update a service provider card with structured business details', input_schema: { type: 'object', properties: { business_name: { type: 'string' }, trade_type: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, abn: { type: 'string', description: 'Australian Business Number' }, license_number: { type: 'string' }, insurance_status: { type: 'string', enum: ['verified', 'unverified', 'expired'] }, rating: { type: 'number', description: '1-5' }, suburb: { type: 'string' }, state: { type: 'string' }, notes: { type: 'string' } }, required: ['business_name', 'trade_type', 'phone'] } },
  { name: 'request_quote', description: 'Send quote request to tradesperson with maintenance details', input_schema: { type: 'object', properties: { provider_id: { type: 'string' }, maintenance_request_id: { type: 'string' }, property_id: { type: 'string' }, description: { type: 'string', description: 'Work description for quote' }, urgency: { type: 'string', enum: ['emergency', 'urgent', 'routine'] }, preferred_dates: { type: 'array', items: { type: 'string' } }, access_instructions: { type: 'string' }, photos: { type: 'array', items: { type: 'string' } } }, required: ['description', 'property_id'] } },
  { name: 'check_maintenance_threshold', description: 'Check if repair cost within auto-approval threshold', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, estimated_cost: { type: 'number', description: 'Estimated cost (AUD)' }, category: { type: 'string' }, is_tenant_caused: { type: 'boolean' } }, required: ['property_id', 'estimated_cost', 'category'] } },
  { name: 'get_market_data', description: 'Fetch rental market data for suburb — median rents, vacancy rates, yield, trends', input_schema: { type: 'object', properties: { suburb: { type: 'string' }, state: { type: 'string' }, property_type: { type: 'string', enum: ['house', 'apartment', 'townhouse', 'unit'] }, bedrooms: { type: 'number' } }, required: ['suburb', 'state'] } },
  { name: 'check_regulatory_requirements', description: 'Check state-specific regulatory requirements for a property action', input_schema: { type: 'object', properties: { state: { type: 'string', description: 'Australian state' }, action_type: { type: 'string', description: 'Action type to check' }, property_id: { type: 'string' } }, required: ['state', 'action_type'] } },

  // ── WORKFLOW TOOLS ────────────────────────────────────────────────────────
  { name: 'workflow_find_tenant', description: 'Full workflow: list → syndicate → screen → recommend', input_schema: { type: 'object', properties: { property_id: { type: 'string', description: 'Property UUID' }, preferences: { type: 'object', description: 'Listing and screening preferences' } }, required: ['property_id'] } },
  { name: 'workflow_onboard_tenant', description: 'Onboard workflow: lease → sign → bond → inspection', input_schema: { type: 'object', properties: { application_id: { type: 'string', description: 'Accepted application UUID' }, move_in_date: { type: 'string', description: 'Move-in date (ISO 8601)' } }, required: ['application_id'] } },
  { name: 'workflow_end_tenancy', description: 'End tenancy: exit inspection → bond → relist', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, relist: { type: 'boolean', description: 'Whether to relist after vacancy' } }, required: ['tenancy_id'] } },
  { name: 'workflow_maintenance_lifecycle', description: 'Full maintenance: report → triage → quote → approve → complete', input_schema: { type: 'object', properties: { request_id: { type: 'string', description: 'Request UUID' }, auto_approve_threshold: { type: 'number', description: 'Auto-approve if under this amount (AUD)' } }, required: ['request_id'] } },
  { name: 'workflow_arrears_escalation', description: 'Arrears ladder: reminder → formal → notice → tribunal', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, current_days_overdue: { type: 'number', description: 'Days in arrears' } }, required: ['tenancy_id', 'current_days_overdue'] } },

  // ── MEMORY TOOLS ──────────────────────────────────────────────────────────
  { name: 'remember', description: 'Store owner preference or fact for future use', input_schema: { type: 'object', properties: { key: { type: 'string', description: 'What to remember (category.key format)' }, value: { type: 'string', description: 'The value to store' }, property_id: { type: 'string', description: 'Property scope' }, confidence: { type: 'number', description: 'Confidence 0-1' } }, required: ['key', 'value'] } },
  { name: 'recall', description: 'Retrieve preferences relevant to current context', input_schema: { type: 'object', properties: { context: { type: 'string', description: 'Current context for relevance matching' }, category: { type: 'string', description: 'Category filter' }, property_id: { type: 'string', description: 'Property scope filter' } }, required: ['context'] } },
  { name: 'search_precedent', description: 'Search past decisions for similar context', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Natural language description' }, tool_name: { type: 'string', description: 'Filter by tool used' }, limit: { type: 'number' } }, required: ['query'] } },

  // ── PLANNING TOOLS ────────────────────────────────────────────────────────
  { name: 'plan_task', description: 'Break complex request into ordered steps with tool assignments', input_schema: { type: 'object', properties: { request: { type: 'string', description: 'User request to decompose' }, context: { type: 'object', description: 'Current context' } }, required: ['request'] } },
  { name: 'get_owner_rules', description: 'Retrieve owner-defined automation rules and preferences', input_schema: { type: 'object', properties: { category: { type: 'string', description: 'Rule category filter' } } } },
  { name: 'check_plan', description: 'Check progress of a multi-step plan', input_schema: { type: 'object', properties: { steps: { type: 'array', items: { type: 'object' }, description: 'Plan steps with status' } }, required: ['steps'] } },
  { name: 'replan', description: 'Revise a plan after a step fails or context changes', input_schema: { type: 'object', properties: { original_plan: { type: 'object', description: 'The original plan' }, reason: { type: 'string', description: 'Why replanning is needed' }, context: { type: 'object' } }, required: ['original_plan', 'reason'] } },

  // ── ACTION TOOLS (additional) ──────────────────────────────────────────
  { name: 'send_receipt', description: 'Send payment receipt notification to tenant', input_schema: { type: 'object', properties: { payment_id: { type: 'string', description: 'Payment UUID' }, tenant_id: { type: 'string', description: 'Recipient tenant UUID' } }, required: ['payment_id', 'tenant_id'] } },
  { name: 'retry_payment', description: 'Retry a failed or declined payment', input_schema: { type: 'object', properties: { payment_id: { type: 'string', description: 'Payment UUID to retry' } }, required: ['payment_id'] } },
  { name: 'claim_bond', description: 'Submit a bond claim for tenant damage or unpaid rent', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, claim_amount: { type: 'number', description: 'Amount to claim' }, reason: { type: 'string', description: 'Claim reason' } }, required: ['tenancy_id', 'claim_amount', 'reason'] } },
  { name: 'update_autopay', description: 'Enable or disable automatic rent payments for a tenancy', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string', description: 'Tenancy UUID' }, enabled: { type: 'boolean', description: 'Enable or disable autopay' } }, required: ['tenancy_id', 'enabled'] } },
  { name: 'cancel_rent_increase', description: 'Cancel a pending rent increase', input_schema: { type: 'object', properties: { rent_increase_id: { type: 'string', description: 'Rent increase UUID' }, reason: { type: 'string', description: 'Cancellation reason' } }, required: ['rent_increase_id'] } },

  // ── INTEGRATION TOOLS (require external API configuration) ─────────────
  { name: 'syndicate_listing_domain', description: 'Post/update listing on Domain.com.au', input_schema: { type: 'object', properties: { listing_id: { type: 'string' }, action: { type: 'string', enum: ['create', 'update', 'remove'] } }, required: ['listing_id', 'action'] } },
  { name: 'syndicate_listing_rea', description: 'Post/update listing on realestate.com.au', input_schema: { type: 'object', properties: { listing_id: { type: 'string' }, action: { type: 'string', enum: ['create', 'update', 'remove'] } }, required: ['listing_id', 'action'] } },
  { name: 'run_credit_check', description: 'Run credit check on applicant via Equifax', input_schema: { type: 'object', properties: { application_id: { type: 'string' } }, required: ['application_id'] } },
  { name: 'run_tica_check', description: 'Check TICA tenancy database for applicant', input_schema: { type: 'object', properties: { application_id: { type: 'string' } }, required: ['application_id'] } },
  { name: 'collect_rent_stripe', description: 'Collect rent payment via Stripe Connect', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string' }, amount: { type: 'number' } }, required: ['tenancy_id', 'amount'] } },
  { name: 'refund_payment_stripe', description: 'Refund a Stripe payment', input_schema: { type: 'object', properties: { payment_id: { type: 'string' }, amount: { type: 'number' }, reason: { type: 'string' } }, required: ['payment_id'] } },
  { name: 'send_docusign_envelope', description: 'Send document for digital signature via DocuSign', input_schema: { type: 'object', properties: { document_type: { type: 'string' }, tenancy_id: { type: 'string' }, signers: { type: 'array', items: { type: 'object' } } }, required: ['document_type', 'tenancy_id'] } },
  { name: 'lodge_bond_state', description: 'Lodge bond with state bond authority', input_schema: { type: 'object', properties: { tenancy_id: { type: 'string' }, state: { type: 'string' }, amount: { type: 'number' } }, required: ['tenancy_id', 'state', 'amount'] } },
  { name: 'send_sms_twilio', description: 'Send SMS notification via Twilio', input_schema: { type: 'object', properties: { to: { type: 'string' }, message: { type: 'string' } }, required: ['to', 'message'] } },
  { name: 'send_email_sendgrid', description: 'Send email via SendGrid', input_schema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, html_content: { type: 'string' } }, required: ['to', 'subject', 'html_content'] } },
  { name: 'send_push_expo', description: 'Send push notification via Expo', input_schema: { type: 'object', properties: { user_id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, data: { type: 'object' } }, required: ['user_id', 'title', 'body'] } },
  { name: 'search_trades_hipages', description: 'Search hipages for tradespeople', input_schema: { type: 'object', properties: { trade_type: { type: 'string' }, suburb: { type: 'string' }, state: { type: 'string' } }, required: ['trade_type', 'suburb'] } },
];

// ---------------------------------------------------------------------------
// Tool Metadata (for autonomy gating and risk assessment)
// ---------------------------------------------------------------------------

export const TOOL_META: Record<string, ToolMeta> = {
  // Query tools — all L4 (autonomous)
  get_property: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_properties: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  search_tenants: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_tenancy: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_tenancy_detail: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_payments: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_rent_schedule: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_arrears: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_arrears_detail: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_maintenance: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_maintenance_detail: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_quotes: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_inspections: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_inspection_detail: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_listings: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_listing_detail: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_applications: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_application_detail: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_conversations: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_conversation_messages: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_compliance_status: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_financial_summary: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_transactions: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_trades: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_work_orders: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_expenses: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_payment_plan: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_documents: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_background_tasks: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  get_pending_actions: { category: 'query', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  check_maintenance_threshold: { category: 'query', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  check_regulatory_requirements: { category: 'query', autonomyLevel: 3, riskLevel: 'none', reversible: false },

  // Action tools — varying autonomy levels
  create_property: { category: 'action', autonomyLevel: 1, riskLevel: 'medium', reversible: true, compensationTool: 'delete_property' },
  update_property: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  delete_property: { category: 'action', autonomyLevel: 0, riskLevel: 'high', reversible: true },
  create_tenancy: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  update_tenancy: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: true },
  terminate_lease: { category: 'action', autonomyLevel: 0, riskLevel: 'critical', reversible: false },
  renew_lease: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  create_listing: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: true },
  update_listing: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  publish_listing: { category: 'action', autonomyLevel: 1, riskLevel: 'medium', reversible: true, compensationTool: 'pause_listing' },
  pause_listing: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  send_message: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: false },
  create_conversation: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: false },
  send_in_app_message: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: false },
  send_rent_reminder: { category: 'action', autonomyLevel: 3, riskLevel: 'low', reversible: false },
  send_breach_notice: { category: 'action', autonomyLevel: 0, riskLevel: 'high', reversible: false },
  create_maintenance: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  update_maintenance_status: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  add_maintenance_comment: { category: 'action', autonomyLevel: 3, riskLevel: 'low', reversible: false },
  record_maintenance_cost: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  schedule_inspection: { category: 'action', autonomyLevel: 3, riskLevel: 'low', reversible: true, compensationTool: 'cancel_inspection' },
  cancel_inspection: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: false },
  record_inspection_finding: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  submit_inspection_to_tenant: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: false },
  finalize_inspection: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: false },
  create_work_order: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: true },
  update_work_order_status: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: false },
  approve_quote: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  reject_quote: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: false },
  accept_application: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  reject_application: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  shortlist_application: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: true },
  create_payment_plan: { category: 'action', autonomyLevel: 1, riskLevel: 'medium', reversible: true },
  escalate_arrears: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  resolve_arrears: { category: 'action', autonomyLevel: 1, riskLevel: 'medium', reversible: false },
  log_arrears_action: { category: 'action', autonomyLevel: 3, riskLevel: 'low', reversible: false },
  create_rent_increase: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: true },
  change_rent_amount: { category: 'action', autonomyLevel: 0, riskLevel: 'high', reversible: false },
  record_compliance: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  add_trade_to_network: { category: 'action', autonomyLevel: 2, riskLevel: 'none', reversible: true },
  submit_trade_review: { category: 'action', autonomyLevel: 2, riskLevel: 'low', reversible: true },
  invite_tenant: { category: 'action', autonomyLevel: 2, riskLevel: 'medium', reversible: false },
  process_payment: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  lodge_bond: { category: 'action', autonomyLevel: 1, riskLevel: 'high', reversible: false },

  // Generate tools — mostly L3 (execute)
  generate_listing: { category: 'generate', autonomyLevel: 2, riskLevel: 'none', reversible: false },
  draft_message: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  score_application: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  rank_applications: { category: 'generate', autonomyLevel: 2, riskLevel: 'none', reversible: false },
  triage_maintenance: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  estimate_cost: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  analyze_rent: { category: 'generate', autonomyLevel: 2, riskLevel: 'none', reversible: false },
  suggest_rent_price: { category: 'generate', autonomyLevel: 2, riskLevel: 'none', reversible: false },
  generate_notice: { category: 'generate', autonomyLevel: 0, riskLevel: 'high', reversible: false },
  generate_inspection_report: { category: 'generate', autonomyLevel: 2, riskLevel: 'none', reversible: false },
  compare_inspections: { category: 'generate', autonomyLevel: 2, riskLevel: 'none', reversible: false },
  generate_financial_report: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  generate_tax_report: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  generate_property_summary: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  generate_lease: { category: 'generate', autonomyLevel: 1, riskLevel: 'medium', reversible: false },
  assess_tenant_damage: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  compare_quotes: { category: 'generate', autonomyLevel: 3, riskLevel: 'none', reversible: false },

  // External tools
  web_search: { category: 'external', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  find_local_trades: { category: 'external', autonomyLevel: 3, riskLevel: 'low', reversible: false },
  parse_business_details: { category: 'external', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  create_service_provider: { category: 'external', autonomyLevel: 1, riskLevel: 'low', reversible: true },
  request_quote: { category: 'external', autonomyLevel: 1, riskLevel: 'medium', reversible: false },
  get_market_data: { category: 'external', autonomyLevel: 3, riskLevel: 'none', reversible: false },

  // Workflow tools
  workflow_find_tenant: { category: 'workflow', autonomyLevel: 1, riskLevel: 'medium', reversible: false },
  workflow_onboard_tenant: { category: 'workflow', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  workflow_end_tenancy: { category: 'workflow', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  workflow_maintenance_lifecycle: { category: 'workflow', autonomyLevel: 2, riskLevel: 'medium', reversible: false },
  workflow_arrears_escalation: { category: 'workflow', autonomyLevel: 1, riskLevel: 'high', reversible: false },

  // Memory tools
  remember: { category: 'memory', autonomyLevel: 4, riskLevel: 'none', reversible: true },
  recall: { category: 'memory', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  search_precedent: { category: 'memory', autonomyLevel: 4, riskLevel: 'none', reversible: false },

  // Planning tools
  plan_task: { category: 'planning', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  get_owner_rules: { category: 'planning', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  check_plan: { category: 'planning', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  replan: { category: 'planning', autonomyLevel: 3, riskLevel: 'none', reversible: false },

  // Additional action tools
  send_receipt: { category: 'action', autonomyLevel: 4, riskLevel: 'none', reversible: false },
  retry_payment: { category: 'action', autonomyLevel: 1, riskLevel: 'medium', reversible: false },
  claim_bond: { category: 'action', autonomyLevel: 0, riskLevel: 'high', reversible: false },
  update_autopay: { category: 'action', autonomyLevel: 1, riskLevel: 'medium', reversible: true },
  cancel_rent_increase: { category: 'action', autonomyLevel: 1, riskLevel: 'medium', reversible: false },

  // Integration tools (require external API configuration)
  syndicate_listing_domain: { category: 'integration', autonomyLevel: 1, riskLevel: 'medium', reversible: true },
  syndicate_listing_rea: { category: 'integration', autonomyLevel: 1, riskLevel: 'medium', reversible: true },
  run_credit_check: { category: 'integration', autonomyLevel: 1, riskLevel: 'low', reversible: false },
  run_tica_check: { category: 'integration', autonomyLevel: 1, riskLevel: 'low', reversible: false },
  collect_rent_stripe: { category: 'integration', autonomyLevel: 1, riskLevel: 'high', reversible: false },
  refund_payment_stripe: { category: 'integration', autonomyLevel: 0, riskLevel: 'high', reversible: false },
  send_docusign_envelope: { category: 'integration', autonomyLevel: 1, riskLevel: 'medium', reversible: false },
  lodge_bond_state: { category: 'integration', autonomyLevel: 0, riskLevel: 'high', reversible: false },
  send_sms_twilio: { category: 'integration', autonomyLevel: 1, riskLevel: 'low', reversible: false },
  send_email_sendgrid: { category: 'integration', autonomyLevel: 2, riskLevel: 'low', reversible: false },
  send_push_expo: { category: 'integration', autonomyLevel: 3, riskLevel: 'none', reversible: false },
  search_trades_hipages: { category: 'integration', autonomyLevel: 4, riskLevel: 'none', reversible: false },
};

// ---------------------------------------------------------------------------
// Helper: Get tools for Claude API format
// ---------------------------------------------------------------------------

export function getClaudeTools(): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return CLAUDE_TOOLS.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }));
}

// ---------------------------------------------------------------------------
// Helper: Check if tool is allowed at given autonomy level
// ---------------------------------------------------------------------------

export function isToolAllowed(
  toolName: string,
  userAutonomyLevel: number,
): boolean {
  const meta = TOOL_META[toolName];
  if (!meta) return false;
  return userAutonomyLevel >= meta.autonomyLevel;
}

// ---------------------------------------------------------------------------
// Helper: Get tool names by category
// ---------------------------------------------------------------------------

export function getToolNamesByCategory(category: string): string[] {
  return Object.entries(TOOL_META)
    .filter(([_, meta]) => meta.category === category)
    .map(([name]) => name);
}
