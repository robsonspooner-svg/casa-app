// Agent Orchestrator - Supabase Edge Function
// Casa - L5.7 Agentic Vision: Intelligent Claude-Powered Orchestrator
//
// Replaces the procedural heartbeat with an intelligent orchestrator that:
// 1. Processes instant events from agent_event_queue (DB triggers on payments,
//    maintenance, tenancies, inspections)
// 2. Runs daily/weekly/monthly batch reviews per property per user
// 3. Advances multi-step workflows (agent_workflows table)
// 4. Logs every decision to agent_events for audit trail
// 5. Uses the shared agent-core pipeline for system prompt, tool execution,
//    autonomy gating, confidence scoring
//
// Trigger: pg_cron or manual HTTP call with CRON_SECRET header.
// Auth: X-Cron-Secret header or service role JWT.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { CLAUDE_TOOLS, TOOL_META, getContextualTools } from '../_shared/tool-registry.ts';
import {
  TIER_TOOL_ACCESS,
  getUserAutonomyForCategory,
  executeTool,
  updateToolGenome,
  updateCoOccurrence,
  calculateConfidence,
  buildSystemPrompt,
  estimateTokens,
  compactMessages,
  type AutonomySettings,
  type ConfidenceFactors,
} from '../_shared/agent-core.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrchestratorRequest {
  mode: 'instant' | 'daily' | 'weekly' | 'monthly';
  user_id?: string;
  property_id?: string;
  max_properties?: number;
}

interface QueueEvent {
  id: string;
  event_type: string;
  priority: string;
  payload: Record<string, unknown>;
  user_id: string;
  property_id: string | null;
  processed: boolean;
  created_at: string;
}

interface OrchestratorResponse {
  mode: string;
  processed: number;
  events_processed: number;
  workflows_advanced: number;
  actions_taken: number;
  notifications_sent: number;
  errors: string[];
  duration_ms: number;
  total_tokens: number;
}

interface WorkflowRow {
  id: string;
  user_id: string;
  property_id: string | null;
  tenancy_id: string | null;
  workflow_type: string;
  current_step: number;
  total_steps: number;
  steps: Array<{
    name: string;
    status: string;
    tool_name?: string;
    tool_params?: Record<string, unknown>;
    result?: unknown;
    completed_at?: string;
  }>;
  status: string;
  next_action_at: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TOOL_ITERATIONS = 12;
const HAIKU_MODEL = 'claude-3-5-haiku-20241022';
const SONNET_MODEL = 'claude-sonnet-4-20250514';
const CONCURRENCY_LIMIT = 3;
const MAX_RUNTIME_MS = 110_000; // 110s safety margin under 120s limit
const API_MAX_RETRIES = 2;

// Event types that warrant the Sonnet model for deeper reasoning
const COMPLEX_EVENT_TYPES = new Set([
  'maintenance_submitted_emergency',
  'lease_expiring_soon',
  'arrears_escalation',
  'inspection_failed',
  'compliance_overdue',
  'tenancy_terminated',
  'payment_failed_multiple',
  'payment_failed',
  'bond_dispute',
  'maintenance_stalled',
]);

// Emergency override tools — these execute at L3+ regardless of autonomy settings
// because delay in these actions could cause legal, safety, or financial harm
const EMERGENCY_OVERRIDE_TOOLS = new Set([
  'send_rent_reminder',         // Arrears require prompt communication
  'send_push_expo',             // Emergency notifications must go through
  'send_email_sendgrid',        // Emergency communications
  'send_message',               // Emergency acknowledgements
  'send_receipt',               // Payment confirmations
  'check_regulatory_requirements', // Compliance checks are always safe
  'get_tenancy_law',            // Legal lookups are always safe
]);

// Financial thresholds per preset — actions above these amounts require approval
function getFinancialThreshold(preset: string): number {
  const thresholds: Record<string, number> = {
    cautious: 0,        // All financial actions need approval
    balanced: 500,      // <$500 can be auto-approved
    hands_off: 2000,    // <$2000 can be auto-approved
  };
  return thresholds[preset] ?? 500;
}

// Extract cost/amount from tool input parameters
function extractCostFromInput(input: Record<string, unknown>): number {
  // Check common cost-related fields
  const costFields = ['amount', 'cost', 'estimated_cost', 'actual_cost', 'price', 'total', 'quote_amount'];
  for (const field of costFields) {
    if (input[field] && typeof input[field] === 'number' && (input[field] as number) > 0) {
      return input[field] as number;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Event Prompt Builder
// ---------------------------------------------------------------------------

async function buildEventPrompt(
  event: QueueEvent,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<string> {
  const p = event.payload || {};

  switch (event.event_type) {
    case 'payment_completed':
      return `A rent payment has been received:
- Amount: $${p.amount ?? 0}
- Property: ${p.property_address || '[will be resolved from property_id]'}
- Tenant: ${p.tenant_name || '[unknown]'}
- Payment type: ${p.payment_type || 'rent'}

Please:
1. Verify this payment matches expected rent
2. Check if this resolves any arrears
3. Send appropriate confirmation/receipt to the tenant
4. Update any relevant financial records`;

    case 'payment_failed':
      return `A rent payment has failed:
- Amount: $${p.amount ?? 0}
- Tenant: ${p.tenant_name || '[unknown]'}
- Failure reason: ${p.failure_reason || 'unknown'}
- Attempt number: ${p.attempt_number || 1}

Please:
1. Check the tenant's payment history
2. If first failure, retry the payment
3. If repeated failure, notify the owner and suggest next steps
4. Log this event on the arrears record if applicable`;

    case 'maintenance_submitted':
      return `A new maintenance request has been submitted:
- Title: ${p.title || 'Untitled'}
- Urgency: ${p.urgency || 'routine'}
- Category: ${p.category || 'general'}
- Description: ${p.description || 'No description provided'}
- Reported by: ${p.reported_by || 'tenant'}

Please:
1. Acknowledge receipt to the tenant
2. Assess urgency and triage appropriately
3. If emergency, immediately search for available trades
4. Notify the owner with your assessment and recommended action`;

    case 'maintenance_submitted_emergency':
      return `EMERGENCY maintenance request submitted:
- Title: ${p.title || 'Untitled'}
- Category: ${p.category || 'general'}
- Description: ${p.description || 'No description provided'}

This is URGENT. Please:
1. Immediately acknowledge receipt to the tenant
2. Search for available emergency trades in the area
3. If an existing preferred trade is available, create a work order
4. Notify the owner immediately about the emergency
5. If after hours, note that emergency service rates may apply`;

    case 'tenancy_created':
      return `A new tenancy has been created:
- Lease start: ${p.lease_start_date || '[unknown]'}
- Lease end: ${p.lease_end_date || '[unknown]'}
- Rent: $${p.rent_amount ?? 0} ${p.rent_frequency || 'weekly'}
- Tenant: ${p.tenant_name || '[unknown]'}

Please:
1. Create an onboarding workflow for this tenancy
2. Check all compliance items are in order for the property
3. Send a welcome notification to the tenant
4. Schedule an entry condition inspection if not already done`;

    case 'tenancy_terminated':
      return `A tenancy has been terminated:
- Termination type: ${p.termination_type || 'mutual'}
- Effective date: ${p.effective_date || '[unknown]'}
- Tenant: ${p.tenant_name || '[unknown]'}

Please:
1. Schedule an exit inspection
2. Check for any outstanding rent or arrears
3. Begin the bond return process
4. Prepare to relist the property if appropriate
5. Notify the owner with a summary of final actions needed`;

    case 'inspection_finalized': {
      const inspectionId = p.inspection_id as string | undefined;
      let actionItemsPrompt = '';

      if (inspectionId) {
        // Query inspection items that need attention: poor/damaged condition or action_required
        const { data: actionItems } = await supabase
          .from('inspection_items')
          .select('id, name, condition, notes, action_required, action_description, estimated_cost, room_id')
          .in('room_id', (
            await supabase
              .from('inspection_rooms')
              .select('id, name')
              .eq('inspection_id', inspectionId)
          ).data?.map((r: any) => r.id) || [])
          .or('condition.in.(poor,damaged,missing),action_required.eq.true');

        // Also get room names for context
        const { data: rooms } = await supabase
          .from('inspection_rooms')
          .select('id, name')
          .eq('inspection_id', inspectionId);

        const roomNameMap: Record<string, string> = {};
        (rooms || []).forEach((r: any) => { roomNameMap[r.id] = r.name; });

        if (actionItems && actionItems.length > 0) {
          actionItemsPrompt = `\n\nINSPECTION ITEMS REQUIRING ACTION (${actionItems.length}):\n`;
          for (const item of actionItems) {
            const roomName = roomNameMap[item.room_id] || 'Unknown room';
            actionItemsPrompt += `  - [${roomName}] ${item.name}: condition=${item.condition || 'N/A'}`;
            if (item.action_description) actionItemsPrompt += `, action: ${item.action_description}`;
            if (item.estimated_cost) actionItemsPrompt += `, est. cost: $${item.estimated_cost}`;
            if (item.notes) actionItemsPrompt += ` (${item.notes})`;
            actionItemsPrompt += '\n';
          }
          actionItemsPrompt += `\nFor EACH item above, create a maintenance request using the create_maintenance_request tool. Set urgency based on condition severity (damaged/missing = urgent, poor = routine). Include the room name and item description in the maintenance request title and description.`;
        }
      }

      // Get property address for context
      const propertyAddress = p.property_id
        ? (await supabase.from('properties').select('address_line_1, suburb').eq('id', p.property_id).maybeSingle()).data
        : null;
      const addressStr = propertyAddress ? `${propertyAddress.address_line_1}, ${propertyAddress.suburb}` : '[unknown property]';

      return `An inspection has been finalized:
- Type: ${p.inspection_type || 'routine'}
- Property: ${addressStr}
- Overall condition: ${p.overall_condition || 'not assessed'}
- Inspection ID: ${inspectionId || 'unknown'}${actionItemsPrompt}

Please:
1. Review the inspection findings
2. Create maintenance requests for any items listed above that need attention
3. Notify the owner with a summary of the inspection and any maintenance requests created
4. If exit inspection, compare with entry inspection for damage assessment`;
    }

    case 'lease_expiring_soon':
      return `A lease is expiring soon:
- Days remaining: ${p.days_remaining ?? 0}
- Lease end date: ${p.lease_end_date || '[unknown]'}
- Tenant: ${p.tenant_name || '[unknown]'}
- Current rent: $${p.rent_amount ?? 0} ${p.rent_frequency || 'weekly'}

Please:
1. Analyse the current rent vs market rate
2. Check tenant satisfaction and payment history
3. Recommend whether to renew, adjust rent, or not renew
4. If renewal is recommended, draft the renewal terms
5. Notify the owner with your recommendation`;

    case 'arrears_escalation':
      return `Arrears escalation is needed:
- Days overdue: ${p.days_overdue ?? 0}
- Amount overdue: $${p.total_overdue ?? 0}
- Current level: ${p.current_level || 'friendly'}
- Tenant: ${p.tenant_name || '[unknown]'}

Please:
1. Review the arrears history and any payment plans
2. Determine the appropriate next escalation step
3. Generate any required notices (e.g. breach notice)
4. Notify the owner of the escalation
5. Log all actions taken`;

    case 'compliance_overdue':
      return `A compliance item is overdue:
- Item: ${p.compliance_type || '[unknown]'}
- Due date: ${p.due_date || '[unknown]'}
- Days overdue: ${p.days_overdue ?? 0}

Please:
1. Notify the owner immediately about the overdue compliance
2. Check state-specific requirements for this compliance item
3. Find available service providers if applicable
4. Create a task for the owner with deadline and consequences`;

    case 'application_received':
      return `A new rental application has been received:
- Applicant: ${p.applicant_name || '[unknown]'}
- Listing: ${p.listing_title || '[unknown]'}

Please:
1. Score and assess the application
2. Compare with other pending applications if any
3. Notify the owner with your assessment and recommendation`;

    case 'maintenance_status_changed':
      return `A maintenance request status has changed:
- Request: "${p.title || '[unknown]'}"
- Previous status: ${p.old_status || '[unknown]'}
- New status: ${p.new_status || '[unknown]'}
- Urgency: ${p.urgency || 'routine'}
- Request ID: ${p.request_id || '[unknown]'}

Please:
1. If moved to "in_progress", verify a trade has been assigned and work is scheduled
2. If moved to "completed", send completion notification to the tenant and ask for feedback
3. If moved back to "reported" or stalled, investigate why and take corrective action
4. Update the owner on the maintenance progress
5. If the request has been open >7 days without resolution, escalate`;

    case 'document_signed':
      return `A document has been signed:
- Document ID: ${p.document_id || '[unknown]'}
- Signer role: ${p.signer_role || '[unknown]'}
- Signer ID: ${p.signer_id || '[unknown]'}

Please:
1. Check if all required signatures are now complete
2. If fully signed, update the document status and notify both parties
3. If the document is a lease, update the tenancy record with the signed lease reference
4. Send a copy of the signed document to all parties`;

    case 'maintenance_stalled':
      return `A maintenance request appears stalled — no status update in over 48 hours:
- Request: "${p.title || '[unknown]'}"
- Current status: ${p.status || '[unknown]'}
- Urgency: ${p.urgency || 'routine'}
- Days since last update: ${p.days_stalled || 'unknown'}

Please:
1. If a trade was assigned, follow up with them on progress
2. If no trade assigned, search for available trades and create a work order
3. Send a status update to the tenant
4. If urgent/emergency, escalate immediately`;

    case 'property_vacant':
      return `A property has no active tenancy:
- Property ID: ${p.property_id || '[unknown]'}
- Days vacant: ${p.days_vacant || 'unknown'}

Please:
1. Check if a listing already exists for this property
2. If no listing, recommend creating one with competitive market pricing
3. If a listing exists, check its performance (views, enquiries, applications)
4. Suggest rent adjustments if the listing has been active >14 days with no applications
5. Notify the owner with a vacancy update`;

    case 'rent_review_due':
      return `A tenancy is due for a rent review:
- Tenancy ID: ${p.tenancy_id || '[unknown]'}
- Current rent: $${p.rent_amount ?? 0} ${p.rent_frequency || 'weekly'}
- Last review date: ${p.last_review_date || 'never reviewed'}

Please:
1. Get current market data for comparable properties in the area
2. Compare current rent to market median
3. If rent is significantly below market (>10%), recommend a rent increase
4. Check state-specific rules for rent increase notice periods and frequency limits
5. Draft a recommendation for the owner`;

    default:
      return `Event: ${event.event_type}
Payload: ${JSON.stringify(event.payload, null, 2)}

Please review this event and take any appropriate actions.`;
  }
}

// ---------------------------------------------------------------------------
// Model Selection
// ---------------------------------------------------------------------------

function selectModel(eventType: string, mode: string): string {
  if (mode === 'weekly' || mode === 'monthly') return SONNET_MODEL;
  if (COMPLEX_EVENT_TYPES.has(eventType)) return SONNET_MODEL;
  return HAIKU_MODEL;
}

// ---------------------------------------------------------------------------
// Claude API Call with Retry
// ---------------------------------------------------------------------------

async function callClaude(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: any }>,
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  apiKey: string,
): Promise<{ data: any; error?: string }> {
  for (let attempt = 0; attempt < API_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = 3_000 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
          tools,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return { data };
      }

      const errText = await response.text();
      console.error(`Claude API error (attempt ${attempt + 1}):`, response.status, errText);

      if ((response.status === 429 || response.status === 529) && attempt < API_MAX_RETRIES - 1) {
        continue;
      }

      return { data: null, error: `Claude API error ${response.status}: ${errText.substring(0, 200)}` };
    } catch (fetchErr: any) {
      console.error(`Claude API fetch error (attempt ${attempt + 1}):`, fetchErr.message);
      if (attempt < API_MAX_RETRIES - 1) continue;
      return { data: null, error: `Claude API fetch failed: ${fetchErr.message}` };
    }
  }

  return { data: null, error: 'Claude API exhausted all retries' };
}

// ---------------------------------------------------------------------------
// Tool Execution Loop (for orchestrator context)
// ---------------------------------------------------------------------------

async function executeToolLoop(
  userId: string,
  systemPrompt: string,
  initialMessage: string,
  model: string,
  apiKey: string,
  supabase: ReturnType<typeof getServiceClient>,
  autonomySettings: AutonomySettings | null,
  userTier: string,
  eventSource: string,
  propertyId: string | null,
): Promise<{
  response: string;
  toolsCalled: Array<{ name: string; input: Record<string, unknown> }>;
  tokensUsed: number;
  actionsCount: number;
  notificationsCount: number;
}> {
  const allowedCategories = TIER_TOOL_ACCESS[userTier] || TIER_TOOL_ACCESS.starter;
  const claudeTools = getContextualTools(initialMessage);

  let messages: Array<{ role: string; content: any }> = [
    { role: 'user', content: initialMessage },
  ];

  let iteration = 0;
  let finalResponse = '';
  let totalTokensUsed = 0;
  const allToolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];
  let actionsCount = 0;
  let notificationsCount = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const { data: claudeData, error: apiError } = await callClaude(
      model,
      systemPrompt,
      messages,
      claudeTools,
      apiKey,
    );

    if (apiError || !claudeData) {
      console.error(`[orchestrator] Claude API failed for user ${userId}:`, apiError);
      finalResponse = apiError || 'Claude API unavailable';
      break;
    }

    totalTokensUsed += (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);

    const textBlocks = (claudeData.content || []).filter((b: any) => b.type === 'text');
    const toolUseBlocks = (claudeData.content || []).filter((b: any) => b.type === 'tool_use');

    // If no tool use, we are done
    if (claudeData.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      finalResponse = textBlocks.map((b: any) => b.text).join('\n');
      break;
    }

    // Process tool calls concurrently
    const toolResultBlocks = await Promise.all(
      toolUseBlocks.map(async (toolBlock: any) => {
        const toolMeta = TOOL_META[toolBlock.name];
        if (!toolMeta) {
          return {
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({ success: false, error: `Unknown tool: ${toolBlock.name}` }),
          };
        }

        // Tier enforcement
        if (!allowedCategories.has(toolMeta.category)) {
          return {
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({
              success: false,
              tier_blocked: true,
              message: `This feature requires a higher subscription tier. The owner's current tier does not include ${toolMeta.category} tools.`,
            }),
          };
        }

        // Emergency override: certain urgent tools always execute regardless of autonomy
        // These are time-sensitive actions where delay could cause harm
        const isEmergencyOverride = EMERGENCY_OVERRIDE_TOOLS.has(toolBlock.name) &&
          (eventSource.includes('emergency') || eventSource.includes('compliance_overdue') ||
           eventSource.includes('payment_failed') || eventSource.includes('arrears'));

        // Financial threshold check: tools with cost implications require approval
        // if the cost exceeds the user's threshold
        const financialThreshold = getFinancialThreshold(autonomySettings?.preset || 'balanced');
        const toolCostAmount = extractCostFromInput(toolBlock.input);
        const exceedsFinancialThreshold = toolCostAmount > 0 && toolCostAmount > financialThreshold;

        // Autonomy gating: in orchestrator mode, only execute tools where the
        // user's autonomy level meets or exceeds the tool's required level.
        // For lower autonomy tools, create a pending action and skip (non-blocking).
        const userAutonomyLevel = getUserAutonomyForCategory(autonomySettings, toolMeta.category);
        const toolRequiredLevel = toolMeta.autonomyLevel;

        // Financial threshold override: even at L4, costs above threshold need approval
        if (exceedsFinancialThreshold && !isEmergencyOverride) {
          const toolDef = CLAUDE_TOOLS.find((t) => t.name === toolBlock.name);
          await supabase.from('agent_pending_actions').insert({
            user_id: userId,
            action_type: toolMeta.category,
            title: toolBlock.name,
            description: `${toolDef?.description || toolBlock.name} — Estimated cost: $${toolCostAmount}`,
            tool_name: toolBlock.name,
            tool_params: toolBlock.input,
            autonomy_level: toolRequiredLevel,
            status: 'pending',
            recommendation: `This action involves an estimated cost of $${toolCostAmount}, which exceeds your financial threshold of $${financialThreshold}. Approval required.`,
          });

          return {
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({
              success: false,
              needs_approval: true,
              message: `Action queued — estimated cost $${toolCostAmount} exceeds financial threshold of $${financialThreshold}.`,
            }),
          };
        }

        if (userAutonomyLevel < toolRequiredLevel && !isEmergencyOverride) {
          // Create pending action for the owner to approve
          const toolDef = CLAUDE_TOOLS.find((t) => t.name === toolBlock.name);
          await supabase.from('agent_pending_actions').insert({
            user_id: userId,
            action_type: toolMeta.category,
            title: toolBlock.name,
            description: toolDef?.description || toolBlock.name,
            tool_name: toolBlock.name,
            tool_params: toolBlock.input,
            autonomy_level: toolRequiredLevel,
            status: 'pending',
            recommendation: `Casa recommends this action based on ${eventSource}. Your autonomy settings require manual confirmation for ${toolMeta.category} actions.`,
          });

          // Log gated decision
          supabase.from('agent_decisions').insert({
            user_id: userId,
            decision_type: 'autonomy_gate',
            tool_name: toolBlock.name,
            input_data: toolBlock.input,
            reasoning: `Orchestrator (${eventSource}): autonomy for ${toolMeta.category} is L${userAutonomyLevel}, tool requires L${toolRequiredLevel}. Action queued.`,
            autonomy_level: toolRequiredLevel,
            was_auto_executed: false,
          }).then(() => {});

          return {
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({
              success: false,
              needs_approval: true,
              message: `Action queued for owner approval. Autonomy for "${toolMeta.category}" is L${userAutonomyLevel}, requires L${toolRequiredLevel}.`,
            }),
          };
        }

        // Confidence check for non-query tools
        if (toolMeta.category !== 'query' && toolMeta.category !== 'memory') {
          try {
            const confidenceFactors = await calculateConfidence(userId, toolBlock.name, supabase);
            if (confidenceFactors.composite < 0.4) {
              // Very low confidence in orchestrator mode: skip and create pending action
              await supabase.from('agent_pending_actions').insert({
                user_id: userId,
                action_type: toolMeta.category,
                title: toolBlock.name,
                description: `Low confidence action (${Math.round(confidenceFactors.composite * 100)}%)`,
                tool_name: toolBlock.name,
                tool_params: toolBlock.input,
                autonomy_level: toolRequiredLevel,
                status: 'pending',
                recommendation: `Orchestrator has low confidence (${Math.round(confidenceFactors.composite * 100)}%) in this action. Requesting manual approval.`,
              });

              return {
                type: 'tool_result',
                tool_use_id: toolBlock.id,
                content: JSON.stringify({
                  success: false,
                  needs_approval: true,
                  message: `Low confidence (${Math.round(confidenceFactors.composite * 100)}%). Action queued for owner approval.`,
                }),
              };
            }
          } catch {
            // Don't block on confidence calculation failure
          }
        }

        // Execute the tool
        const startTime = Date.now();
        const result = await executeTool(toolBlock.name, toolBlock.input, userId, supabase);
        const durationMs = Date.now() - startTime;

        allToolCalls.push({ name: toolBlock.name, input: toolBlock.input });
        actionsCount++;

        // Track notification dispatches
        if (toolBlock.name === 'send_message' || toolBlock.name === 'send_rent_reminder' ||
            toolBlock.name === 'send_push_expo' || toolBlock.name === 'send_email_sendgrid' ||
            toolBlock.name === 'send_receipt') {
          notificationsCount++;
        }

        // Update tool genome (fire and forget)
        updateToolGenome(userId, toolBlock.name, result.success, durationMs, toolBlock.input || {}, supabase, result.error);

        // Log decision (fire and forget)
        supabase.from('agent_decisions').insert({
          user_id: userId,
          decision_type: 'tool_execution',
          tool_name: toolBlock.name,
          input_data: toolBlock.input,
          output_data: result.data || null,
          autonomy_level: toolRequiredLevel,
          was_auto_executed: true,
          duration_ms: durationMs,
        }).then(() => {});

        return {
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        };
      }),
    );

    // Add assistant content and tool results to continue the loop
    messages.push({ role: 'assistant', content: claudeData.content });
    messages.push({ role: 'user', content: toolResultBlocks });

    // Collect partial text
    if (textBlocks.length > 0) {
      finalResponse += textBlocks.map((b: any) => b.text).join('\n');
    }
  }

  // If exhausted iterations without final response
  if (iteration >= MAX_TOOL_ITERATIONS && !finalResponse) {
    finalResponse = 'Orchestrator reached maximum tool iterations for this task.';
  }

  return {
    response: finalResponse,
    toolsCalled: allToolCalls,
    tokensUsed: totalTokensUsed,
    actionsCount,
    notificationsCount,
  };
}

// ---------------------------------------------------------------------------
// Log Agent Event
// ---------------------------------------------------------------------------

async function logAgentEvent(
  supabase: ReturnType<typeof getServiceClient>,
  params: {
    userId: string;
    propertyId?: string | null;
    eventSource: string;
    eventType: string;
    modelUsed: string;
    contextSnapshot?: Record<string, unknown>;
    reasoning: string;
    toolsCalled: Array<{ name: string; input: Record<string, unknown> }>;
    autonomyLevel: number;
    confidence: number;
    outcome: string;
    tokensUsed: number;
    durationMs: number;
  },
): Promise<void> {
  try {
    await supabase.from('agent_events').insert({
      user_id: params.userId,
      property_id: params.propertyId || null,
      event_source: params.eventSource,
      event_type: params.eventType,
      model_used: params.modelUsed,
      context_snapshot: params.contextSnapshot || null,
      reasoning: params.reasoning.substring(0, 2000),
      tools_called: params.toolsCalled.length > 0 ? params.toolsCalled : null,
      autonomy_level: params.autonomyLevel,
      confidence: params.confidence,
      outcome: params.outcome,
      tokens_used: params.tokensUsed,
      duration_ms: params.durationMs,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[orchestrator] Failed to log agent event:', err);
  }
}

// ---------------------------------------------------------------------------
// Dispatch Notification Helper
// ---------------------------------------------------------------------------

async function dispatchNotification(
  supabase: ReturnType<typeof getServiceClient>,
  params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.functions.invoke('dispatch-notification', {
      body: {
        user_id: params.userId,
        notification_type: params.type,
        title: params.title,
        body: params.body,
        data: params.data || {},
      },
    });
  } catch (err) {
    console.error('[orchestrator] Notification dispatch failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Process Instant Events
// ---------------------------------------------------------------------------

async function processInstantEvents(
  supabase: ReturnType<typeof getServiceClient>,
  apiKey: string,
  startTime: number,
  maxUserId?: string,
): Promise<{
  eventsProcessed: number;
  actionsCount: number;
  notificationsCount: number;
  tokensUsed: number;
  errors: string[];
}> {
  // Fetch unprocessed events ordered by priority and time
  let query = supabase
    .from('agent_event_queue')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(20);

  if (maxUserId) {
    query = query.eq('user_id', maxUserId);
  }

  const { data: events, error: fetchErr } = await query;

  if (fetchErr || !events || events.length === 0) {
    return { eventsProcessed: 0, actionsCount: 0, notificationsCount: 0, tokensUsed: 0, errors: fetchErr ? [fetchErr.message] : [] };
  }

  // Sort: instant/emergency priority first
  const sorted = [...events].sort((a, b) => {
    const priorityOrder: Record<string, number> = { instant: 0, high: 1, normal: 2, low: 3 };
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
  }) as QueueEvent[];

  let eventsProcessed = 0;
  let totalActions = 0;
  let totalNotifications = 0;
  let totalTokens = 0;
  const errors: string[] = [];

  // Process events in batches of CONCURRENCY_LIMIT
  for (let i = 0; i < sorted.length; i += CONCURRENCY_LIMIT) {
    // Check runtime budget
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.warn('[orchestrator] Approaching runtime limit, stopping event processing');
      break;
    }

    const batch = sorted.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(
      batch.map(async (event) => {
        const eventStartTime = Date.now();
        try {
          // Load user context
          const [autonomyResult, profileResult, systemPrompt] = await Promise.all([
            supabase.from('agent_autonomy_settings').select('preset, category_overrides').eq('user_id', event.user_id).single(),
            supabase.from('profiles').select('subscription_tier').eq('id', event.user_id).single(),
            buildSystemPrompt(event.user_id, supabase),
          ]);

          const autonomySettings = (autonomyResult.data as AutonomySettings | null);
          const userTier = profileResult.data?.subscription_tier || 'starter';
          const eventPreset = autonomySettings?.preset || 'balanced';
          const model = selectModel(event.event_type, 'instant');
          const eventPrompt = await buildEventPrompt(event, supabase);

          // Augment system prompt with autonomy-aware orchestrator context
          const orchestratorSystemPrompt = systemPrompt + buildOrchestratorContextPrompt('instant', eventPreset) + `
Event source: trigger_${event.event_type}
Property ID: ${event.property_id || 'not specified'}`;

          const result = await executeToolLoop(
            event.user_id,
            orchestratorSystemPrompt,
            eventPrompt,
            model,
            apiKey,
            supabase,
            autonomySettings,
            userTier,
            `trigger_${event.event_type}`,
            event.property_id,
          );

          const durationMs = Date.now() - eventStartTime;

          // Log the event
          await logAgentEvent(supabase, {
            userId: event.user_id,
            propertyId: event.property_id,
            eventSource: `trigger_${event.event_type}`,
            eventType: 'action_taken',
            modelUsed: model,
            contextSnapshot: { event_payload: event.payload, event_id: event.id },
            reasoning: result.response.substring(0, 2000),
            toolsCalled: result.toolsCalled,
            autonomyLevel: 3,
            confidence: 0.8,
            outcome: result.toolsCalled.length > 0 ? 'completed' : 'reviewed',
            tokensUsed: result.tokensUsed,
            durationMs,
          });

          // Mark event as processed
          await supabase.from('agent_event_queue').update({
            processed: true,
            processed_at: new Date().toISOString(),
          }).eq('id', event.id);

          return {
            actions: result.actionsCount,
            notifications: result.notificationsCount,
            tokens: result.tokensUsed,
          };
        } catch (err: any) {
          console.error(`[orchestrator] Event ${event.id} failed:`, err.message);

          // Mark as processed with error so we don't retry indefinitely
          await supabase.from('agent_event_queue').update({
            processed: true,
            processed_at: new Date().toISOString(),
            error: err.message?.substring(0, 500) || 'Unknown error',
          }).eq('id', event.id);

          return { error: `Event ${event.id}: ${err.message}` };
        }
      }),
    );

    for (const result of results) {
      eventsProcessed++;
      if (result.status === 'fulfilled') {
        const val = result.value;
        if ('error' in val) {
          errors.push(val.error as string);
        } else {
          totalActions += val.actions;
          totalNotifications += val.notifications;
          totalTokens += val.tokens;
        }
      } else {
        errors.push(`Event batch error: ${result.reason}`);
      }
    }
  }

  return {
    eventsProcessed,
    actionsCount: totalActions,
    notificationsCount: totalNotifications,
    tokensUsed: totalTokens,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Build Batch Review Prompt
// ---------------------------------------------------------------------------

async function buildDailyReviewPrompt(
  userId: string,
  propertyId: string,
  supabase: ReturnType<typeof getServiceClient>,
  preset: string = 'balanced',
): Promise<string> {
  // Gather current state for this property
  const [
    arrearsResult,
    maintenanceResult,
    tenancyResult,
    complianceResult,
    paymentsResult,
  ] = await Promise.all([
    supabase.from('arrears_records')
      .select('id, total_overdue, days_overdue, escalation_level, tenancy_id')
      .eq('is_resolved', false)
      .in('tenancy_id', (
        await supabase.from('tenancies').select('id').eq('property_id', propertyId).eq('status', 'active')
      ).data?.map((t: any) => t.id) || []),
    supabase.from('maintenance_requests')
      .select('id, title, urgency, status, created_at')
      .eq('property_id', propertyId)
      .not('status', 'in', '("completed","cancelled")'),
    supabase.from('tenancies')
      .select('id, lease_end_date, rent_amount, rent_frequency, status')
      .eq('property_id', propertyId)
      .eq('status', 'active'),
    supabase.from('compliance_items')
      .select('id, compliance_type, status, due_date')
      .eq('property_id', propertyId)
      .not('status', 'eq', 'completed'),
    supabase.from('payments')
      .select('id, amount, status, created_at')
      .eq('property_id', propertyId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }),
  ]);

  const arrears = arrearsResult.data || [];
  const maintenance = maintenanceResult.data || [];
  const tenancies = tenancyResult.data || [];
  const compliance = complianceResult.data || [];
  const recentPayments = paymentsResult.data || [];

  // Check if property is due for routine inspection
  const { data: lastInspection } = await supabase
    .from('inspections')
    .select('id, inspection_type, completed_at, scheduled_date, status')
    .eq('property_id', propertyId)
    .eq('inspection_type', 'routine')
    .in('status', ['completed', 'finalized'])
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pendingInspection } = await supabase
    .from('inspections')
    .select('id')
    .eq('property_id', propertyId)
    .in('status', ['scheduled', 'in_progress', 'tenant_review'])
    .limit(1)
    .maybeSingle();

  // Check for upcoming lease expiries (90 days)
  const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const expiringLeases = tenancies.filter((t: any) => t.lease_end_date && t.lease_end_date <= ninetyDaysFromNow);

  // Build the context
  let prompt = `Daily property review for property ${propertyId}:\n\n`;

  if (arrears.length > 0) {
    prompt += `ARREARS (${arrears.length} active):\n`;
    for (const a of arrears) {
      prompt += `  - $${a.total_overdue} overdue, ${a.days_overdue} days, level: ${a.escalation_level}\n`;
    }
    prompt += '\n';
  } else {
    prompt += 'ARREARS: None - all rent is current.\n\n';
  }

  if (maintenance.length > 0) {
    prompt += `OPEN MAINTENANCE (${maintenance.length}):\n`;
    for (const m of maintenance) {
      prompt += `  - "${m.title}" [${m.urgency}] status: ${m.status}\n`;
    }
    prompt += '\n';
  } else {
    prompt += 'MAINTENANCE: No open requests.\n\n';
  }

  if (expiringLeases.length > 0) {
    prompt += `LEASE EXPIRIES (within 90 days):\n`;
    for (const t of expiringLeases) {
      const daysLeft = Math.ceil((new Date(t.lease_end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      const urgency = daysLeft <= 60 ? ' ⚠ ACTION NEEDED — within 60 days' : '';
      prompt += `  - Lease ending in ${daysLeft} days (${t.lease_end_date}), rent: $${t.rent_amount}/${t.rent_frequency}${urgency}\n`;
      if (daysLeft <= 60) {
        prompt += `    → This lease expires within 60 days. You MUST analyse the rent vs market rate, check tenant satisfaction, and recommend whether to renew, adjust rent, or let it lapse. Draft renewal terms if appropriate.\n`;
      }
    }
    prompt += '\n';
  }

  if (compliance.length > 0) {
    prompt += `COMPLIANCE ITEMS DUE:\n`;
    for (const c of compliance) {
      prompt += `  - ${c.compliance_type}: status ${c.status}, due ${c.due_date || 'no date set'}\n`;
    }
    prompt += '\n';
  }

  // Inspection due detection
  if (!pendingInspection) {
    if (!lastInspection) {
      prompt += 'INSPECTIONS: ⚠ No routine inspection on record for this property. Use the schedule_inspection tool to schedule one within the next 14 days. Check state regulations for required inspection frequency.\n\n';
    } else {
      const lastDate = lastInspection.completed_at ? new Date(lastInspection.completed_at) : null;
      if (lastDate) {
        const monthsSince = Math.floor((Date.now() - lastDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
        if (monthsSince >= 3) {
          prompt += `INSPECTIONS: ⚠ Last routine inspection was ${monthsSince} months ago (${lastDate.toISOString().split('T')[0]}). This property is OVERDUE for a routine inspection. Use the schedule_inspection tool to schedule one within the next 14 days.\n\n`;
        }
      }
    }
  }

  // Auto-schedule exit inspection for expiring leases
  const fourteenDaysFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const expiringForExit = tenancies.filter((t: any) => t.lease_end_date && t.lease_end_date <= fourteenDaysFromNow && t.status === 'active');
  if (expiringForExit.length > 0 && !pendingInspection) {
    const { data: exitInspection } = await supabase
      .from('inspections')
      .select('id')
      .eq('property_id', propertyId)
      .eq('inspection_type', 'exit')
      .in('status', ['scheduled', 'in_progress', 'tenant_review'])
      .limit(1)
      .maybeSingle();

    if (!exitInspection) {
      const daysUntilEnd = Math.ceil((new Date(expiringForExit[0].lease_end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      prompt += `EXIT INSPECTION NEEDED: ⚠ Lease expires in ${daysUntilEnd} days but no exit inspection is scheduled. Use the schedule_inspection tool to schedule an exit inspection BEFORE the lease ends.\n\n`;
    }
  }

  prompt += `RECENT PAYMENTS (7 days): ${recentPayments.length} payments\n`;
  if (recentPayments.length > 0) {
    const total = recentPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    prompt += `  Total: $${total.toFixed(2)}\n`;
  }

  if (preset === 'cautious') {
    prompt += `\nREVIEW THIS PROPERTY and create pending actions for the owner to approve:
For each issue found, create a specific pending action with:
1. Your recommended course of action and reasoning
2. Estimated costs where applicable
3. Priority level (emergency > urgent > routine)
4. Consequences of inaction
The owner will review and approve/decline each action in the app.`;
  } else {
    prompt += `\nYOU ARE THE PROPERTY MANAGER. Based on the data above, you MUST act on every issue:

1. ARREARS: If any exist, send rent reminders NOW using send_rent_reminder. If overdue >7 days, escalate the arrears level. If overdue >14 days, generate a formal breach notice.
2. MAINTENANCE: Follow up on any request open >48 hours without a status update. For emergency items, search for available trades immediately using find_local_trades.
3. LEASES: If expiring <90 days, analyse current rent vs market using get_market_data. Draft renewal terms. If <30 days with no action taken, create an urgent pending action for the owner.
4. COMPLIANCE: If any item is overdue, notify the owner immediately. If due within 14 days, search for service providers and create a booking task.
5. INSPECTIONS: If overdue (>3 months since last routine), schedule now using schedule_inspection with the correct state notice period.
6. PAYMENTS: For recent payments, verify they match expected rent amounts. Send receipts to tenants using send_receipt.
7. VACANT PROPERTIES: If no active tenancy, check if a listing exists. If not, recommend creating one with competitive pricing.

DO NOT just describe what you could do. Take action on every item using the available tools. A real property manager doesn't write reports — they get things done.`;
  }

  return prompt;
}

function buildWeeklyReviewPrompt(propertyCount: number): string {
  return `Weekly portfolio review. You have ${propertyCount} properties to review. Please:
1. Check for market rent data and compare against current rents
2. Review overall property health scores
3. Analyse tenant retention and satisfaction
4. Flag any properties with declining performance
5. Check all compliance deadlines for the next 30 days
6. Generate a brief weekly summary with key metrics and any actions needed

Keep the summary concise and action-oriented.`;
}

function buildMonthlyReviewPrompt(propertyCount: number): string {
  return `Monthly portfolio review and financial summary. You have ${propertyCount} properties. Please:
1. Generate a full financial summary for the past month (income, expenses, net)
2. Review property health scores across the portfolio
3. Check all compliance deadlines for the next 90 days
4. Analyse tenant satisfaction and renewal probability for each tenancy
5. Review market data and rent positioning
6. Identify investment opportunities or concerns
7. Generate a monthly digest notification with key highlights

This is a comprehensive review — be thorough but concise.`;
}

// ---------------------------------------------------------------------------
// Orchestrator Context Prompt — autonomy-aware behaviour
// ---------------------------------------------------------------------------

function buildOrchestratorContextPrompt(mode: string, preset: string): string {
  const presetBehaviours: Record<string, string> = {
    hands_off: `AUTONOMY: HANDS-OFF (Full Autonomous Mode)
You ARE the property manager. The owner trusts you to handle everything independently.
Execute all actions immediately. Only create pending actions for:
- Lease termination or eviction proceedings
- Expenditures exceeding $2,000
- Changes to rent amount
- Bond disputes or tribunal actions
Everything else: DO IT NOW, report in the daily digest.
The owner's experience is: wake up, see a summary of what you handled. That's it.`,

    balanced: `AUTONOMY: BALANCED (Execute & Report)
You are the property manager with moderate autonomy.
Execute routine actions immediately (reminders, scheduling, queries, reports).
Create pending actions for approval on:
- Financial decisions over $500
- Tenant communications beyond reminders
- Maintenance work order approvals
- Lease renewals and rent changes
- Any action you're uncertain about
Always explain WHY you're recommending an action.`,

    cautious: `AUTONOMY: CAUTIOUS (Recommend & Wait)
You are a property management advisor. The owner wants to approve every action.
For EVERY issue you find:
1. Create a specific pending action with your recommendation
2. Include estimated costs where applicable
3. Explain the urgency and consequences of inaction
4. Prioritise: emergency > urgent > routine
Never execute actions directly — always create pending actions for review.`,
  };

  const behaviourBlock = presetBehaviours[preset] || presetBehaviours.balanced;

  return `

ORCHESTRATOR CONTEXT — AUTONOMOUS PROPERTY MANAGER:
Mode: ${mode} batch review | Autonomy preset: ${preset}

${behaviourBlock}

You are not an assistant waiting for instructions — you are the property manager.
You MUST take every action that a competent property manager would take.
Every daily review must result in concrete actions, not just observations.

MANDATORY RULES:
- If something needs doing, DO IT (within autonomy limits) or create a pending action with a clear recommendation
- Never say "you might want to" or "consider" — either execute or create a specific action for approval
- Use multiple tools per review — a real PM does 5-10 things per property check, not 1
- Chain actions: arrears → send reminder → update record → notify owner → check payment plan eligibility
- Think in workflows: don't just flag a lease expiry — draft renewal terms AND compare market rent AND assess tenant history
- For urgent items (emergency maintenance, compliance overdue, payment failures): act IMMEDIATELY regardless of preset
- Always log what you did via agent events so the owner has a complete audit trail

Mode: heartbeat_${mode}`;
}

// ---------------------------------------------------------------------------
// Proactive Scanner — pre-loads event queue before daily batch
// ---------------------------------------------------------------------------

async function runProactiveScans(
  supabase: ReturnType<typeof getServiceClient>,
  startTime: number,
): Promise<{ eventsCreated: number; workflowsCreated: number; errors: string[] }> {
  let eventsCreated = 0;
  let workflowsCreated = 0;
  const errors: string[] = [];
  const now = new Date();
  const nowISO = now.toISOString();

  try {
    // ---------------------------------------------------------------
    // 1. Lease Expiry Scanner
    // Find leases expiring within 90 days that don't already have
    // a recent lease_expiring_soon event or active lease_renewal workflow
    // ---------------------------------------------------------------
    const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiringTenancies } = await supabase
      .from('tenancies')
      .select('id, property_id, lease_end_date, rent_amount, rent_frequency, tenant_id')
      .eq('status', 'active')
      .lte('lease_end_date', ninetyDaysFromNow)
      .gte('lease_end_date', nowISO);

    if (expiringTenancies && expiringTenancies.length > 0) {
      for (const tenancy of expiringTenancies) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) break;

        const daysLeft = Math.ceil((new Date(tenancy.lease_end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

        // Check if we already have an unprocessed event for this tenancy
        const { data: existingEvent } = await supabase
          .from('agent_event_queue')
          .select('id')
          .eq('event_type', 'lease_expiring_soon')
          .eq('processed', false)
          .contains('payload', { tenancy_id: tenancy.id })
          .limit(1)
          .maybeSingle();

        if (existingEvent) continue;

        // Check for active lease_renewal workflow
        const { data: existingWorkflow } = await supabase
          .from('agent_workflows')
          .select('id')
          .eq('tenancy_id', tenancy.id)
          .eq('workflow_type', 'lease_renewal')
          .in('status', ['active', 'pending'])
          .limit(1)
          .maybeSingle();

        if (existingWorkflow) continue;

        // Get owner
        const { data: property } = await supabase
          .from('properties')
          .select('owner_id')
          .eq('id', tenancy.property_id)
          .single();

        if (!property) continue;

        // Get tenant name
        const { data: tenant } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', tenancy.tenant_id)
          .maybeSingle();

        // Insert event
        await supabase.from('agent_event_queue').insert({
          event_type: 'lease_expiring_soon',
          priority: daysLeft <= 30 ? 'instant' : 'normal',
          payload: {
            tenancy_id: tenancy.id,
            days_remaining: daysLeft,
            lease_end_date: tenancy.lease_end_date,
            rent_amount: tenancy.rent_amount,
            rent_frequency: tenancy.rent_frequency,
            tenant_name: tenant?.full_name || 'Unknown',
          },
          user_id: property.owner_id,
          property_id: tenancy.property_id,
        });
        eventsCreated++;

        // Auto-create lease_renewal workflow if <60 days
        if (daysLeft <= 60) {
          await supabase.from('agent_workflows').insert({
            user_id: property.owner_id,
            property_id: tenancy.property_id,
            tenancy_id: tenancy.id,
            workflow_type: 'lease_renewal',
            current_step: 0,
            total_steps: 5,
            steps: [
              { name: 'Analyse market rent', status: 'pending', tool_name: 'get_market_data' },
              { name: 'Assess tenant satisfaction and payment history', status: 'pending', tool_name: 'get_tenant_details' },
              { name: 'Draft renewal terms', status: 'pending', tool_name: 'generate_lease' },
              { name: 'Send renewal offer to owner for approval', status: 'pending', tool_name: 'create_pending_action' },
              { name: 'Execute renewal', status: 'pending', tool_name: 'update_tenancy' },
            ],
            status: 'active',
            next_action_at: nowISO,
            metadata: { days_until_expiry: daysLeft, triggered_by: 'proactive_scan' },
          });
          workflowsCreated++;
        }
      }
    }

    // ---------------------------------------------------------------
    // 2. Compliance Due Scanner
    // Find compliance items due within 30 days or already overdue
    // ---------------------------------------------------------------
    if (Date.now() - startTime < MAX_RUNTIME_MS) {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: dueCompliance } = await supabase
        .from('property_compliance')
        .select('id, property_id, status, next_due_date, compliance_requirements!inner(category)')
        .not('status', 'eq', 'compliant')
        .not('status', 'eq', 'exempt')
        .not('status', 'eq', 'not_applicable')
        .lte('next_due_date', thirtyDaysFromNow);

      if (dueCompliance && dueCompliance.length > 0) {
        for (const item of dueCompliance) {
          if (Date.now() - startTime > MAX_RUNTIME_MS) break;

          const dueDate = (item as any).next_due_date;
          const complianceType = (item as any).compliance_requirements?.category || 'unknown';
          const isOverdue = new Date(dueDate) < now;
          const daysUntil = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

          // Skip if already queued
          const { data: existing } = await supabase
            .from('agent_event_queue')
            .select('id')
            .eq('event_type', 'compliance_overdue')
            .eq('processed', false)
            .contains('payload', { compliance_id: item.id })
            .limit(1)
            .maybeSingle();

          if (existing) continue;

          const { data: property } = await supabase
            .from('properties')
            .select('owner_id')
            .eq('id', item.property_id)
            .single();

          if (!property) continue;

          await supabase.from('agent_event_queue').insert({
            event_type: 'compliance_overdue',
            priority: isOverdue ? 'instant' : 'normal',
            payload: {
              compliance_id: item.id,
              compliance_type: complianceType,
              due_date: dueDate,
              days_overdue: isOverdue ? Math.abs(daysUntil) : 0,
              days_until_due: isOverdue ? 0 : daysUntil,
              status: item.status,
            },
            user_id: property.owner_id,
            property_id: item.property_id,
          });
          eventsCreated++;
        }
      }
    }

    // ---------------------------------------------------------------
    // 3. Stalled Maintenance Scanner
    // Find requests not updated in 48+ hours
    // ---------------------------------------------------------------
    if (Date.now() - startTime < MAX_RUNTIME_MS) {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: stalledRequests } = await supabase
        .from('maintenance_requests')
        .select('id, property_id, title, urgency, status, updated_at')
        .not('status', 'in', '("completed","cancelled")')
        .lt('updated_at', fortyEightHoursAgo);

      if (stalledRequests && stalledRequests.length > 0) {
        for (const req of stalledRequests) {
          if (Date.now() - startTime > MAX_RUNTIME_MS) break;

          const hoursSinceUpdate = Math.round((Date.now() - new Date(req.updated_at).getTime()) / (60 * 60 * 1000));
          const daysSinceUpdate = Math.round(hoursSinceUpdate / 24);

          // Skip if already queued
          const { data: existing } = await supabase
            .from('agent_event_queue')
            .select('id')
            .eq('event_type', 'maintenance_stalled')
            .eq('processed', false)
            .contains('payload', { request_id: req.id })
            .limit(1)
            .maybeSingle();

          if (existing) continue;

          const { data: property } = await supabase
            .from('properties')
            .select('owner_id')
            .eq('id', req.property_id)
            .single();

          if (!property) continue;

          await supabase.from('agent_event_queue').insert({
            event_type: 'maintenance_stalled',
            priority: req.urgency === 'emergency' ? 'instant' : 'normal',
            payload: {
              request_id: req.id,
              title: req.title,
              urgency: req.urgency,
              status: req.status,
              days_stalled: daysSinceUpdate,
              property_id: req.property_id,
            },
            user_id: property.owner_id,
            property_id: req.property_id,
          });
          eventsCreated++;
        }
      }
    }

    // ---------------------------------------------------------------
    // 4. Vacant Property Scanner
    // Find active properties with no active tenancy
    // ---------------------------------------------------------------
    if (Date.now() - startTime < MAX_RUNTIME_MS) {
      const { data: allProperties } = await supabase
        .from('properties')
        .select('id, owner_id, created_at')
        .eq('status', 'active')
        .is('deleted_at', null);

      if (allProperties && allProperties.length > 0) {
        for (const prop of allProperties) {
          if (Date.now() - startTime > MAX_RUNTIME_MS) break;

          const { count } = await supabase
            .from('tenancies')
            .select('id', { count: 'exact', head: true })
            .eq('property_id', prop.id)
            .eq('status', 'active');

          if (count && count > 0) continue;

          // Skip if already queued
          const { data: existing } = await supabase
            .from('agent_event_queue')
            .select('id')
            .eq('event_type', 'property_vacant')
            .eq('processed', false)
            .eq('property_id', prop.id)
            .limit(1)
            .maybeSingle();

          if (existing) continue;

          await supabase.from('agent_event_queue').insert({
            event_type: 'property_vacant',
            priority: 'normal',
            payload: {
              property_id: prop.id,
              days_vacant: Math.ceil((Date.now() - new Date(prop.created_at).getTime()) / (24 * 60 * 60 * 1000)),
            },
            user_id: prop.owner_id,
            property_id: prop.id,
          });
          eventsCreated++;
        }
      }
    }

    // ---------------------------------------------------------------
    // 5. Rent Review Scanner
    // Find tenancies where rent hasn't been reviewed in 12 months
    // ---------------------------------------------------------------
    if (Date.now() - startTime < MAX_RUNTIME_MS) {
      const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const { data: reviewDue } = await supabase
        .from('tenancies')
        .select('id, property_id, rent_amount, rent_frequency, tenant_id, lease_start_date')
        .eq('status', 'active')
        .lt('lease_start_date', twelveMonthsAgo);

      if (reviewDue && reviewDue.length > 0) {
        for (const tenancy of reviewDue) {
          if (Date.now() - startTime > MAX_RUNTIME_MS) break;

          // Skip if already queued
          const { data: existing } = await supabase
            .from('agent_event_queue')
            .select('id')
            .eq('event_type', 'rent_review_due')
            .eq('processed', false)
            .contains('payload', { tenancy_id: tenancy.id })
            .limit(1)
            .maybeSingle();

          if (existing) continue;

          const { data: property } = await supabase
            .from('properties')
            .select('owner_id')
            .eq('id', tenancy.property_id)
            .single();

          if (!property) continue;

          await supabase.from('agent_event_queue').insert({
            event_type: 'rent_review_due',
            priority: 'normal',
            payload: {
              tenancy_id: tenancy.id,
              rent_amount: tenancy.rent_amount,
              rent_frequency: tenancy.rent_frequency,
              last_review_date: tenancy.lease_start_date,
              property_id: tenancy.property_id,
            },
            user_id: property.owner_id,
            property_id: tenancy.property_id,
          });
          eventsCreated++;
        }
      }
    }

    // ---------------------------------------------------------------
    // 6. Auto-initiate arrears_escalation workflows
    // For arrears >7 days without an active escalation workflow
    // ---------------------------------------------------------------
    if (Date.now() - startTime < MAX_RUNTIME_MS) {
      const { data: activeArrears } = await supabase
        .from('arrears_records')
        .select('id, tenancy_id, tenant_id, total_overdue, days_overdue, severity')
        .eq('is_resolved', false)
        .gte('days_overdue', 7);

      if (activeArrears && activeArrears.length > 0) {
        for (const arrears of activeArrears) {
          if (Date.now() - startTime > MAX_RUNTIME_MS) break;

          // Check for existing workflow
          const { data: existingWf } = await supabase
            .from('agent_workflows')
            .select('id')
            .eq('tenancy_id', arrears.tenancy_id)
            .eq('workflow_type', 'arrears_escalation')
            .in('status', ['active', 'pending'])
            .limit(1)
            .maybeSingle();

          if (existingWf) continue;

          const { data: tenancy } = await supabase
            .from('tenancies')
            .select('property_id')
            .eq('id', arrears.tenancy_id)
            .single();

          if (!tenancy) continue;

          const { data: property } = await supabase
            .from('properties')
            .select('owner_id')
            .eq('id', tenancy.property_id)
            .single();

          if (!property) continue;

          await supabase.from('agent_workflows').insert({
            user_id: property.owner_id,
            property_id: tenancy.property_id,
            tenancy_id: arrears.tenancy_id,
            workflow_type: 'arrears_escalation',
            current_step: 0,
            total_steps: 4,
            steps: [
              { name: 'Send friendly rent reminder', status: 'pending', tool_name: 'send_rent_reminder' },
              { name: 'Generate formal arrears notice', status: 'pending', tool_name: 'generate_arrears_notice' },
              { name: 'Issue breach notice if unresolved', status: 'pending', tool_name: 'generate_breach_notice' },
              { name: 'Escalate to tribunal preparation', status: 'pending', tool_name: 'create_pending_action' },
            ],
            status: 'active',
            next_action_at: nowISO,
            metadata: {
              arrears_id: arrears.id,
              total_overdue: arrears.total_overdue,
              days_overdue: arrears.days_overdue,
              triggered_by: 'proactive_scan',
            },
          });
          workflowsCreated++;
        }
      }
    }

  } catch (err: any) {
    console.error('[orchestrator] Proactive scan error:', err.message);
    errors.push(`Proactive scan: ${err.message}`);
  }

  console.log(`[orchestrator] Proactive scan complete: ${eventsCreated} events, ${workflowsCreated} workflows created`);
  return { eventsCreated, workflowsCreated, errors };
}

// ---------------------------------------------------------------------------
// Process Batch Mode (daily / weekly / monthly)
// ---------------------------------------------------------------------------

async function processBatchMode(
  mode: 'daily' | 'weekly' | 'monthly',
  supabase: ReturnType<typeof getServiceClient>,
  apiKey: string,
  startTime: number,
  filterUserId?: string,
  filterPropertyId?: string,
  maxProperties?: number,
): Promise<{
  propertiesProcessed: number;
  workflowsAdvanced: number;
  actionsCount: number;
  notificationsCount: number;
  tokensUsed: number;
  errors: string[];
}> {
  // Get all owners with active properties
  let ownersQuery = supabase
    .from('properties')
    .select('owner_id')
    .is('deleted_at', null)
    .eq('status', 'active');

  if (filterUserId) {
    ownersQuery = ownersQuery.eq('owner_id', filterUserId);
  }

  const { data: ownerRows, error: ownerErr } = await ownersQuery;

  if (ownerErr || !ownerRows || ownerRows.length === 0) {
    return {
      propertiesProcessed: 0,
      workflowsAdvanced: 0,
      actionsCount: 0,
      notificationsCount: 0,
      tokensUsed: 0,
      errors: ownerErr ? [ownerErr.message] : [],
    };
  }

  // Deduplicate owner IDs
  const uniqueOwnerIds = [...new Set(ownerRows.map((r: any) => r.owner_id))];

  let totalPropertiesProcessed = 0;
  let totalWorkflowsAdvanced = 0;
  let totalActions = 0;
  let totalNotifications = 0;
  let totalTokens = 0;
  const errors: string[] = [];

  const propertyLimit = maxProperties || 50;

  for (const ownerId of uniqueOwnerIds) {
    // Check runtime budget
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.warn('[orchestrator] Approaching runtime limit, stopping batch processing');
      break;
    }

    try {
      // Get this owner's properties
      let propsQuery = supabase
        .from('properties')
        .select('id, address_line_1, suburb, state')
        .eq('owner_id', ownerId)
        .is('deleted_at', null)
        .eq('status', 'active')
        .limit(propertyLimit);

      if (filterPropertyId) {
        propsQuery = propsQuery.eq('id', filterPropertyId);
      }

      const { data: properties } = await propsQuery;
      if (!properties || properties.length === 0) continue;

      // Load user context once per owner
      const [autonomyResult, profileResult, systemPromptBase] = await Promise.all([
        supabase.from('agent_autonomy_settings').select('preset, category_overrides').eq('user_id', ownerId).single(),
        supabase.from('profiles').select('subscription_tier, full_name').eq('id', ownerId).single(),
        buildSystemPrompt(ownerId, supabase),
      ]);

      const autonomySettings = (autonomyResult.data as AutonomySettings | null);
      const userTier = profileResult.data?.subscription_tier || 'starter';
      const ownerName = profileResult.data?.full_name || 'Owner';
      const preset = autonomySettings?.preset || 'balanced';
      const model = mode === 'daily' ? HAIKU_MODEL : SONNET_MODEL;

      const orchestratorSystemPrompt = systemPromptBase + buildOrchestratorContextPrompt(mode, preset);

      if (mode === 'daily') {
        // Process properties concurrently in batches of CONCURRENCY_LIMIT
        for (let pi = 0; pi < properties.length; pi += CONCURRENCY_LIMIT) {
          if (Date.now() - startTime > MAX_RUNTIME_MS) break;
          if (totalPropertiesProcessed >= propertyLimit) break;

          const propBatch = properties.slice(pi, pi + CONCURRENCY_LIMIT);
          const propResults = await Promise.allSettled(
            propBatch.map(async (property: any) => {
              const propStartTime = Date.now();
              try {
                const reviewPrompt = await buildDailyReviewPrompt(ownerId, property.id, supabase, preset);

                const result = await executeToolLoop(
                  ownerId,
                  orchestratorSystemPrompt,
                  reviewPrompt,
                  model,
                  apiKey,
                  supabase,
                  autonomySettings,
                  userTier,
                  'heartbeat_daily',
                  property.id,
                );

                const durationMs = Date.now() - propStartTime;

                await logAgentEvent(supabase, {
                  userId: ownerId,
                  propertyId: property.id,
                  eventSource: 'heartbeat_daily',
                  eventType: 'property_review',
                  modelUsed: model,
                  contextSnapshot: { property_address: `${property.address_line_1}, ${property.suburb}` },
                  reasoning: result.response.substring(0, 2000),
                  toolsCalled: result.toolsCalled,
                  autonomyLevel: 3,
                  confidence: 0.75,
                  outcome: result.toolsCalled.length > 0 ? 'actions_taken' : 'no_action_needed',
                  tokensUsed: result.tokensUsed,
                  durationMs,
                });

                return {
                  actions: result.actionsCount,
                  notifications: result.notificationsCount,
                  tokens: result.tokensUsed,
                };
              } catch (err: any) {
                console.error(`[orchestrator] Daily review failed for property ${property.id}:`, err.message);
                return { error: `Property ${property.id}: ${err.message}` };
              }
            }),
          );

          for (const result of propResults) {
            totalPropertiesProcessed++;
            if (result.status === 'fulfilled') {
              const val = result.value;
              if ('error' in val) {
                errors.push(val.error as string);
              } else {
                totalActions += val.actions;
                totalNotifications += val.notifications;
                totalTokens += val.tokens;
              }
            } else {
              errors.push(`Property batch error: ${result.reason}`);
            }
          }
        }
      } else {
        // Weekly or monthly: single portfolio-level review per owner
        const portfolioPrompt = mode === 'weekly'
          ? buildWeeklyReviewPrompt(properties.length)
          : buildMonthlyReviewPrompt(properties.length);

        const portfolioStartTime = Date.now();

        try {
          const result = await executeToolLoop(
            ownerId,
            orchestratorSystemPrompt,
            portfolioPrompt,
            model,
            apiKey,
            supabase,
            autonomySettings,
            userTier,
            `heartbeat_${mode}`,
            null,
          );

          const durationMs = Date.now() - portfolioStartTime;

          await logAgentEvent(supabase, {
            userId: ownerId,
            eventSource: `heartbeat_${mode}`,
            eventType: 'property_review',
            modelUsed: model,
            contextSnapshot: { property_count: properties.length, owner_name: ownerName },
            reasoning: result.response.substring(0, 2000),
            toolsCalled: result.toolsCalled,
            autonomyLevel: 3,
            confidence: 0.8,
            outcome: result.toolsCalled.length > 0 ? 'actions_taken' : 'no_action_needed',
            tokensUsed: result.tokensUsed,
            durationMs,
          });

          // Send summary notification for weekly/monthly
          if (result.response && result.response.length > 20) {
            await dispatchNotification(supabase, {
              userId: ownerId,
              type: mode === 'weekly' ? 'weekly_summary' : 'monthly_digest',
              title: mode === 'weekly' ? 'Weekly Property Summary' : 'Monthly Portfolio Report',
              body: result.response.substring(0, 500),
              data: { mode, property_count: properties.length },
            });
            totalNotifications++;
          }

          totalPropertiesProcessed += properties.length;
          totalActions += result.actionsCount;
          totalNotifications += result.notificationsCount;
          totalTokens += result.tokensUsed;
        } catch (err: any) {
          console.error(`[orchestrator] ${mode} review failed for owner ${ownerId}:`, err.message);
          errors.push(`Owner ${ownerId}: ${err.message}`);
        }
      }

      // Advance workflows for this owner after reviewing properties
      const workflowsAdvanced = await advanceWorkflows(ownerId, supabase, apiKey, orchestratorSystemPrompt, autonomySettings, userTier, startTime);
      totalWorkflowsAdvanced += workflowsAdvanced;

    } catch (ownerErr: any) {
      console.error(`[orchestrator] Owner ${ownerId} processing failed:`, ownerErr.message);
      errors.push(`Owner ${ownerId}: ${ownerErr.message}`);
    }
  }

  return {
    propertiesProcessed: totalPropertiesProcessed,
    workflowsAdvanced: totalWorkflowsAdvanced,
    actionsCount: totalActions,
    notificationsCount: totalNotifications,
    tokensUsed: totalTokens,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Advance Workflows
// ---------------------------------------------------------------------------

async function advanceWorkflows(
  userId: string,
  supabase: ReturnType<typeof getServiceClient>,
  apiKey: string,
  systemPrompt: string,
  autonomySettings: AutonomySettings | null,
  userTier: string,
  overallStartTime: number,
): Promise<number> {
  const { data: workflows } = await supabase
    .from('agent_workflows')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('next_action_at', new Date().toISOString());

  if (!workflows || workflows.length === 0) return 0;

  let advanced = 0;

  for (const workflow of workflows as WorkflowRow[]) {
    // Check runtime budget
    if (Date.now() - overallStartTime > MAX_RUNTIME_MS) break;

    try {
      const currentStep = workflow.steps[workflow.current_step];
      if (!currentStep) {
        // No more steps, mark workflow as completed
        await supabase.from('agent_workflows').update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        }).eq('id', workflow.id);
        advanced++;
        continue;
      }

      // Build a prompt describing the workflow step
      const workflowPrompt = `Advancing workflow: ${workflow.workflow_type}
Step ${workflow.current_step + 1} of ${workflow.total_steps}: ${currentStep.name}
${currentStep.tool_name ? `Tool to use: ${currentStep.tool_name}` : ''}
${currentStep.tool_params ? `Parameters: ${JSON.stringify(currentStep.tool_params)}` : ''}
Workflow metadata: ${JSON.stringify(workflow.metadata || {})}

Please execute this workflow step. If the step has a specific tool, call it. Otherwise, determine the appropriate action.`;

      const result = await executeToolLoop(
        userId,
        systemPrompt,
        workflowPrompt,
        HAIKU_MODEL,
        apiKey,
        supabase,
        autonomySettings,
        userTier,
        `workflow_${workflow.workflow_type}`,
        workflow.property_id,
      );

      // Update the step as completed and advance
      const updatedSteps = [...workflow.steps];
      updatedSteps[workflow.current_step] = {
        ...currentStep,
        status: 'completed',
        result: result.response.substring(0, 500),
        completed_at: new Date().toISOString(),
      };

      const nextStep = workflow.current_step + 1;
      const isComplete = nextStep >= workflow.total_steps;

      // Calculate next action time (default: 1 hour for daily checks, immediate for urgent)
      const nextActionAt = isComplete
        ? null
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await supabase.from('agent_workflows').update({
        current_step: nextStep,
        steps: updatedSteps,
        status: isComplete ? 'completed' : 'active',
        next_action_at: nextActionAt,
        updated_at: new Date().toISOString(),
      }).eq('id', workflow.id);

      // Log workflow advancement
      await logAgentEvent(supabase, {
        userId,
        propertyId: workflow.property_id,
        eventSource: `workflow_${workflow.workflow_type}`,
        eventType: 'workflow_advanced',
        modelUsed: HAIKU_MODEL,
        contextSnapshot: {
          workflow_id: workflow.id,
          step: workflow.current_step + 1,
          total_steps: workflow.total_steps,
          step_name: currentStep.name,
        },
        reasoning: result.response.substring(0, 500),
        toolsCalled: result.toolsCalled,
        autonomyLevel: 3,
        confidence: 0.75,
        outcome: isComplete ? 'workflow_completed' : 'step_completed',
        tokensUsed: result.tokensUsed,
        durationMs: 0,
      });

      advanced++;
    } catch (err: any) {
      console.error(`[orchestrator] Workflow ${workflow.id} advancement failed:`, err.message);

      // Mark workflow step as failed but don't kill the workflow
      await supabase.from('agent_workflows').update({
        metadata: {
          ...workflow.metadata,
          last_error: err.message?.substring(0, 200),
          last_error_at: new Date().toISOString(),
        },
        next_action_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Retry in 30 min
        updated_at: new Date().toISOString(),
      }).eq('id', workflow.id);
    }
  }

  return advanced;
}

// ---------------------------------------------------------------------------
// Auth Verification
// ---------------------------------------------------------------------------

function verifyAuth(req: Request): boolean {
  // Check X-Cron-Secret header
  const cronSecret = req.headers.get('X-Cron-Secret') || req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
    return true;
  }

  // Check Authorization header with service role key
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (token && serviceKey && token === serviceKey) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Daily Digest — compile and send summary to each owner
// ---------------------------------------------------------------------------

async function sendDailyDigests(
  supabase: ReturnType<typeof getServiceClient>,
  startTime: number,
): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // Get all owners who had events processed today
  const { data: todaysEvents } = await supabase
    .from('agent_events')
    .select('user_id, event_type, reasoning, property_id, tools_called')
    .gte('created_at', todayISO)
    .eq('event_source', 'heartbeat_daily')
    .order('created_at', { ascending: true });

  if (!todaysEvents || todaysEvents.length === 0) return;

  // Group events by owner
  const eventsByOwner: Record<string, typeof todaysEvents> = {};
  for (const event of todaysEvents) {
    if (!eventsByOwner[event.user_id]) eventsByOwner[event.user_id] = [];
    eventsByOwner[event.user_id].push(event);
  }

  for (const [ownerId, events] of Object.entries(eventsByOwner)) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    try {
      // Get owner profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', ownerId)
        .single();

      if (!profile?.email) continue;

      // Compile actions list
      const actionsList: Array<{ description: string; property: string }> = [];
      for (const event of events) {
        const toolsCalled = (event.tools_called as Array<{ name: string }>) || [];
        if (toolsCalled.length > 0) {
          // Get property address for context
          let propertyAddress = 'Portfolio';
          if (event.property_id) {
            const { data: prop } = await supabase
              .from('properties')
              .select('address_line_1, suburb')
              .eq('id', event.property_id)
              .maybeSingle();
            if (prop) propertyAddress = `${prop.address_line_1}, ${prop.suburb}`;
          }

          // Use the reasoning as the action description (first 100 chars)
          const description = (event.reasoning || 'Action taken').substring(0, 150);
          actionsList.push({ description, property: propertyAddress });
        }
      }

      // Get pending actions count
      const { data: pendingActions } = await supabase
        .from('agent_pending_actions')
        .select('title, recommendation')
        .eq('user_id', ownerId)
        .eq('status', 'pending')
        .limit(5);

      // Get portfolio snapshot
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', ownerId)
        .is('deleted_at', null);

      const propertyIds = (properties || []).map((p: any) => p.id);
      let occupied = 0;
      let vacant = 0;
      let openMaintenance = 0;
      let overdueCompliance = 0;

      if (propertyIds.length > 0) {
        const { count: occupiedCount } = await supabase
          .from('tenancies')
          .select('id', { count: 'exact', head: true })
          .in('property_id', propertyIds)
          .eq('status', 'active');
        occupied = occupiedCount || 0;
        vacant = propertyIds.length - occupied;

        const { count: maintCount } = await supabase
          .from('maintenance_requests')
          .select('id', { count: 'exact', head: true })
          .in('property_id', propertyIds)
          .not('status', 'in', '("completed","cancelled")');
        openMaintenance = maintCount || 0;

        const { count: compCount } = await supabase
          .from('compliance_items')
          .select('id', { count: 'exact', head: true })
          .in('property_id', propertyIds)
          .not('status', 'eq', 'completed')
          .lt('due_date', new Date().toISOString());
        overdueCompliance = compCount || 0;
      }

      // Send the digest notification
      await dispatchNotification(supabase, {
        userId: ownerId,
        type: 'agent_action_summary',
        title: `Casa Daily Report — ${actionsList.length} action${actionsList.length !== 1 ? 's' : ''}`,
        body: `Casa took ${actionsList.length} action${actionsList.length !== 1 ? 's' : ''} today. ${(pendingActions || []).length > 0 ? `${(pendingActions || []).length} item${(pendingActions || []).length !== 1 ? 's' : ''} need your attention.` : 'Everything is on track.'}`,
        data: {
          owner_name: profile.full_name,
          actions_count: actionsList.length,
          actions_list: actionsList,
          date: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
          pending_actions: (pendingActions || []).map((a: any) => ({
            title: a.title,
            description: a.recommendation || '',
          })),
          portfolio_snapshot: {
            total_properties: propertyIds.length,
            occupied,
            vacant,
            open_maintenance: openMaintenance,
            overdue_compliance: overdueCompliance,
          },
        },
      });

      console.log(`[orchestrator] Daily digest sent to ${profile.email}`);
    } catch (err: any) {
      console.error(`[orchestrator] Digest for ${ownerId} failed:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const overallStartTime = Date.now();

  try {
    // Verify authentication
    if (!verifyAuth(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Provide X-Cron-Secret header or service role Bearer token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate API key is configured
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Agent configuration error: missing ANTHROPIC_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = getServiceClient();

    // Parse request body
    let body: OrchestratorRequest = { mode: 'instant' };
    try {
      body = await req.json();
    } catch {
      // Default to instant mode if no body
    }

    const mode = body.mode || 'instant';
    const response: OrchestratorResponse = {
      mode,
      processed: 0,
      events_processed: 0,
      workflows_advanced: 0,
      actions_taken: 0,
      notifications_sent: 0,
      errors: [],
      duration_ms: 0,
      total_tokens: 0,
    };

    if (mode === 'instant') {
      // Process instant events from the queue
      const result = await processInstantEvents(
        supabase,
        ANTHROPIC_API_KEY,
        overallStartTime,
        body.user_id,
      );

      response.events_processed = result.eventsProcessed;
      response.processed = result.eventsProcessed;
      response.actions_taken = result.actionsCount;
      response.notifications_sent = result.notificationsCount;
      response.total_tokens = result.tokensUsed;
      response.errors = result.errors;

      // Also advance any due workflows
      if (Date.now() - overallStartTime < MAX_RUNTIME_MS) {
        // Get all users with active workflows due now
        const { data: dueWorkflows } = await supabase
          .from('agent_workflows')
          .select('user_id')
          .eq('status', 'active')
          .lte('next_action_at', new Date().toISOString());

        if (dueWorkflows && dueWorkflows.length > 0) {
          const workflowOwners = [...new Set(dueWorkflows.map((w: any) => w.user_id))];
          for (const ownerId of workflowOwners) {
            if (Date.now() - overallStartTime > MAX_RUNTIME_MS) break;

            try {
              const [autonomyResult, profileResult, systemPrompt] = await Promise.all([
                supabase.from('agent_autonomy_settings').select('preset, category_overrides').eq('user_id', ownerId).single(),
                supabase.from('profiles').select('subscription_tier').eq('id', ownerId).single(),
                buildSystemPrompt(ownerId, supabase),
              ]);

              const autonomySettings = (autonomyResult.data as AutonomySettings | null);
              const userTier = profileResult.data?.subscription_tier || 'starter';

              const wfPreset = autonomySettings?.preset || 'balanced';
              const orchestratorPrompt = systemPrompt + buildOrchestratorContextPrompt('workflow', wfPreset);

              const wfAdvanced = await advanceWorkflows(
                ownerId,
                supabase,
                ANTHROPIC_API_KEY,
                orchestratorPrompt,
                autonomySettings,
                userTier,
                overallStartTime,
              );

              response.workflows_advanced += wfAdvanced;
            } catch (err: any) {
              response.errors.push(`Workflow owner ${ownerId}: ${err.message}`);
            }
          }
        }
      }
    } else {
      // Batch modes: daily, weekly, monthly

      // Run proactive scans before daily batch to pre-populate event queue
      if (mode === 'daily') {
        const scanResult = await runProactiveScans(supabase, overallStartTime);
        console.log(`[orchestrator] Proactive scan: ${scanResult.eventsCreated} events, ${scanResult.workflowsCreated} workflows`);
        if (scanResult.errors.length > 0) {
          response.errors.push(...scanResult.errors);
        }
      }

      const result = await processBatchMode(
        mode as 'daily' | 'weekly' | 'monthly',
        supabase,
        ANTHROPIC_API_KEY,
        overallStartTime,
        body.user_id,
        body.property_id,
        body.max_properties,
      );

      response.processed = result.propertiesProcessed;
      response.workflows_advanced = result.workflowsAdvanced;
      response.actions_taken = result.actionsCount;
      response.notifications_sent = result.notificationsCount;
      response.total_tokens = result.tokensUsed;
      response.errors.push(...result.errors);

      // Send daily digest notifications after daily batch completes
      if (mode === 'daily' && response.actions_taken > 0 && Date.now() - overallStartTime < MAX_RUNTIME_MS) {
        try {
          await sendDailyDigests(supabase, overallStartTime);
        } catch (err: any) {
          console.error('[orchestrator] Daily digest dispatch failed:', err.message);
          response.errors.push(`Digest: ${err.message}`);
        }
      }
    }

    response.duration_ms = Date.now() - overallStartTime;

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[orchestrator] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Orchestrator encountered a fatal error',
        duration_ms: Date.now() - overallStartTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
