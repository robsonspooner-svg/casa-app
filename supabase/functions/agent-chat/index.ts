// Agent Chat - Supabase Edge Function
// Casa - Mission 14: AI Agent Chat
//
// Handles AI chat conversations for property owners. Processes user messages,
// calls Claude with tool use, gates actions through the autonomy system,
// and stores all messages and decisions for audit.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { CLAUDE_TOOLS, TOOL_META, getClaudeTools } from '../_shared/tool-registry.ts';
import { executeToolHandler } from '../_shared/tool-dispatcher.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatRequest {
  conversationId?: string;
  message: string;
  action?: {
    type: 'approve' | 'reject';
    pendingActionId: string;
  };
}

// Tool execution is handled by the dispatcher module which maps all 125+
// tool names to their handler functions across query, action, generate,
// external, workflow, memory, and planning categories.
// See: _shared/tool-dispatcher.ts, tool-handlers.ts, tool-handlers-actions.ts, tool-handlers-generate.ts

// ---------------------------------------------------------------------------
// Autonomy Gate
// ---------------------------------------------------------------------------

// Preset defaults map tool-registry categories → max autonomy level the owner
// has pre-approved for that category. The actual per-tool required level comes
// from TOOL_META.autonomyLevel in the registry.
const AUTONOMY_PRESET_DEFAULTS: Record<string, Record<string, number>> = {
  cautious: {
    query: 4, action: 1, generate: 2, external: 1,
    integration: 1, workflow: 0, memory: 4, planning: 3,
  },
  balanced: {
    query: 4, action: 2, generate: 3, external: 3,
    integration: 2, workflow: 1, memory: 4, planning: 3,
  },
  hands_off: {
    query: 4, action: 3, generate: 4, external: 4,
    integration: 3, workflow: 2, memory: 4, planning: 3,
  },
};

function parseAutonomyLevel(level: string): number {
  // Convert "L3" -> 3, "L0" -> 0, etc.
  if (typeof level === 'string' && level.startsWith('L')) {
    return parseInt(level.substring(1), 10);
  }
  return parseInt(String(level), 10) || 2;
}

interface AutonomySettings {
  preset: string;
  category_overrides: Record<string, string>;
}

function getUserAutonomyForCategory(
  settings: AutonomySettings | null,
  category: string,
): number {
  const preset = settings?.preset || 'balanced';
  const overrides = settings?.category_overrides || {};

  // Check for category-specific override first
  if (overrides[category]) {
    return parseAutonomyLevel(overrides[category]);
  }

  // Fall back to preset defaults
  const presetDefaults = AUTONOMY_PRESET_DEFAULTS[preset] || AUTONOMY_PRESET_DEFAULTS.balanced;
  return presetDefaults[category] ?? 2;
}

// ---------------------------------------------------------------------------
// Tool Execution — delegates to the dispatcher module
// ---------------------------------------------------------------------------

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  return executeToolHandler(toolName, toolInput, userId, supabase);
}

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

async function buildSystemPrompt(
  userId: string,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<string> {
  // Load user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  // Load properties summary
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address_line_1, suburb, state, status, rent_amount')
    .eq('owner_id', userId)
    .is('deleted_at', null);

  // Load active tenancy count
  const { count: tenancyCount } = await supabase
    .from('tenancies')
    .select('id', { count: 'exact', head: true })
    .in('property_id', (properties || []).map((p: any) => p.id))
    .eq('status', 'active');

  // Load arrears summary
  const { data: arrearsData } = await supabase
    .from('arrears_records')
    .select('total_overdue')
    .eq('is_resolved', false)
    .in('tenancy_id',
      (await supabase
        .from('tenancies')
        .select('id')
        .in('property_id', (properties || []).map((p: any) => p.id))
      ).data?.map((t: any) => t.id) || [],
    );

  const arrearsCount = arrearsData?.length || 0;
  const arrearsTotal = (arrearsData || []).reduce(
    (sum: number, a: any) => sum + (a.total_overdue || 0), 0,
  );

  // Load autonomy settings
  const { data: autonomySettings } = await supabase
    .from('agent_autonomy_settings')
    .select('preset')
    .eq('user_id', userId)
    .single();

  const preset = autonomySettings?.preset || 'balanced';
  const ownerName = profile?.full_name || 'there';

  const propertyList = (properties || [])
    .map((p: any) => `  - ${p.address_line_1}, ${p.suburb} ${p.state} (${p.status}, $${p.rent_amount}/wk)`)
    .join('\n');

  // Build categorised tool listing for the prompt
  const toolsByCategory: Record<string, string[]> = {};
  for (const tool of CLAUDE_TOOLS) {
    const meta = TOOL_META[tool.name];
    const cat = meta?.category || 'other';
    if (!toolsByCategory[cat]) toolsByCategory[cat] = [];
    toolsByCategory[cat].push(tool.name);
  }

  const toolSummary = Object.entries(toolsByCategory)
    .map(([cat, names]) => `  ${cat} (${names.length}): ${names.join(', ')}`)
    .join('\n');

  return `You are Casa, an AI property manager for Australian rental properties. You are the owner's intelligent, proactive property management partner. You help owners manage every aspect of their portfolio — properties, tenants, rent, maintenance, compliance, finances, inspections, listings, and trades — autonomously and efficiently.

You replace the traditional property manager. You save owners ~$4,000/year by handling everything a human PM does, but faster and smarter.

Current user context:
- Owner: ${ownerName}
- Properties: ${(properties || []).length} properties
${propertyList}
- Active tenancies: ${tenancyCount || 0}
- Arrears: ${arrearsCount} overdue payment${arrearsCount !== 1 ? 's' : ''} totalling $${arrearsTotal.toFixed(2)}
- Autonomy: ${preset} mode

You have ${CLAUDE_TOOLS.length} tools available to you, organised by category:
${toolSummary}

Autonomy levels determine which actions you can take automatically vs. requiring owner approval:
- L0 (Inform): Always requires owner approval (e.g. terminate lease, breach notices)
- L1 (Suggest): You propose the action and wait for confirmation (e.g. create property, approve application)
- L2 (Draft): You prepare the action for review (e.g. create listing, update tenancy)
- L3 (Execute): You do it and report after (e.g. send rent reminder, schedule inspection)
- L4 (Autonomous): Silent execution (e.g. all queries, memory operations)

The owner's "${preset}" preset controls which categories auto-execute at which levels. If an action exceeds the owner's autonomy setting, present it as a recommendation and wait for approval.

Core capabilities:
- PROPERTY SETUP: Owners can set up properties entirely through conversation. Collect address details, then ask about bedrooms, bathrooms, parking, floor area, rent, bond, etc. Create the property via the create_property tool.
- TENANT FINDING: Create listings, generate compelling copy, publish to portals, score and rank applications, shortlist and approve tenants.
- RENT MANAGEMENT: Track payments, detect arrears early, send reminders, escalate through formal → breach → tribunal, create payment plans.
- MAINTENANCE: Create requests, triage urgency, find local trades, get quotes, compare quotes, approve and track work orders through completion.
- INSPECTIONS: Schedule entry/routine/exit inspections, generate reports, compare entry vs exit condition.
- FINANCIAL: Generate income/expense summaries, tax reports, track transactions, analyse rent vs market.
- COMPLIANCE: Track smoke alarms, gas safety, pool fences, electrical checks — record completions and flag overdue items.
- EXTERNAL: Search the web for regulations/market info, find local tradespeople, parse business details, create service provider cards, request quotes automatically.
- WORKFLOWS: Execute multi-step processes — find tenant, onboard tenant, end tenancy, maintenance lifecycle, arrears escalation.
- MEMORY: Remember owner preferences and past decisions to improve over time.

Guidelines:
1. Be proactive, concise, and action-oriented. When you see issues, propose solutions with specific actions.
2. Always use tools to get current data rather than making assumptions. Never fabricate data.
3. When an action requires approval, explain clearly what you want to do and why.
4. Format responses clearly. Use dot points for lists.
5. Always use Australian English (e.g. "colour", "organise", "centre").
6. When discussing money, use Australian dollars with $ symbol.
7. For dates, use DD/MM/YYYY format.
8. Be warm but professional. You are a knowledgeable property management partner, not a formal butler.
9. If a tool returns data with an "instruction" field, follow that instruction to generate content using the data provided.
10. When a tool returns an error saying it is "not yet wired up", acknowledge this to the owner and explain what the tool would do once connected. Do not pretend it worked.
11. For property setup via conversation: collect the minimum required fields first (address, suburb, state, postcode), create the property, then ask about additional details to fill in.
12. When finding trades: search for local tradespeople, parse their business details, and present structured options to the owner before requesting quotes.
13. Think in workflows, not isolated actions. If an owner says "my tenant hasn't paid rent", consider: check arrears → check payment history → draft reminder → offer escalation options.`;
}

// ---------------------------------------------------------------------------
// Conversation History
// ---------------------------------------------------------------------------

async function loadConversationHistory(
  conversationId: string,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<Array<{ role: string; content: any }>> {
  const { data: messages } = await supabase
    .from('agent_messages')
    .select('role, content, tool_calls, tool_results')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(40); // Last 40 messages for context window

  if (!messages || messages.length === 0) return [];

  const history: Array<{ role: string; content: any }> = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      history.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      // If the assistant message had tool calls, reconstruct the content blocks
      if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        const contentBlocks: any[] = [];
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }
        history.push({ role: 'assistant', content: contentBlocks });

        // Add corresponding tool results
        if (msg.tool_results && Array.isArray(msg.tool_results)) {
          const resultBlocks = msg.tool_results.map((tr: any) => ({
            type: 'tool_result',
            tool_use_id: tr.tool_use_id,
            content: JSON.stringify(tr.result),
          }));
          history.push({ role: 'user', content: resultBlocks });
        }
      } else {
        history.push({ role: 'assistant', content: msg.content });
      }
    }
  }

  return history;
}

// ---------------------------------------------------------------------------
// Pending Action Handling
// ---------------------------------------------------------------------------

async function handlePendingAction(
  action: { type: 'approve' | 'reject'; pendingActionId: string },
  userId: string,
  conversationId: string,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<{ message: string; toolResult?: unknown }> {
  const { data: pendingAction, error: paErr } = await supabase
    .from('agent_pending_actions')
    .select('*')
    .eq('id', action.pendingActionId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single();

  if (paErr || !pendingAction) {
    return { message: 'Pending action not found or already resolved.' };
  }

  if (action.type === 'reject') {
    await supabase
      .from('agent_pending_actions')
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', action.pendingActionId);

    return { message: `Action rejected: ${pendingAction.title}` };
  }

  // Approve and execute the tool
  const toolResult = await executeTool(
    pendingAction.tool_name,
    pendingAction.tool_params,
    userId,
    supabase,
  );

  // Update pending action status
  await supabase
    .from('agent_pending_actions')
    .update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq('id', action.pendingActionId);

  // Log the decision
  await supabase.from('agent_decisions').insert({
    user_id: userId,
    conversation_id: conversationId,
    decision_type: 'tool_execution_approved',
    tool_name: pendingAction.tool_name,
    input_data: pendingAction.tool_params,
    output_data: toolResult.data || null,
    autonomy_level: pendingAction.autonomy_level,
    owner_feedback: 'approved',
    was_auto_executed: false,
  });

  if (toolResult.success) {
    return {
      message: `Action approved and executed: ${pendingAction.title}`,
      toolResult: toolResult.data,
    };
  }
  return {
    message: `Action approved but execution failed: ${toolResult.error}`,
    toolResult: null,
  };
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request body
    const body: ChatRequest = await req.json();

    if (!body.message && !body.action) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: message or action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get or create conversation
    let conversationId = body.conversationId;

    if (!conversationId) {
      const { data: conversation, error: convErr } = await supabase
        .from('agent_conversations')
        .insert({
          user_id: user.id,
          status: 'active',
          is_active: true,
        })
        .select('id')
        .single();

      if (convErr || !conversation) {
        return new Response(
          JSON.stringify({ error: 'Failed to create conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      conversationId = conversation.id;
    } else {
      // Verify conversation belongs to user
      const { data: conv, error: convErr } = await supabase
        .from('agent_conversations')
        .select('id, user_id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (convErr || !conv) {
        return new Response(
          JSON.stringify({ error: 'Conversation not found or access denied' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Handle pending action approval/rejection
    if (body.action) {
      const actionResult = await handlePendingAction(
        body.action,
        user.id,
        conversationId,
        supabase,
      );

      // Store as user message
      await supabase.from('agent_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: body.message || `${body.action.type === 'approve' ? 'Approved' : 'Rejected'} action`,
      });

      // If approved and there is a tool result, feed it back through Claude for a natural response
      if (body.action.type === 'approve' && actionResult.toolResult) {
        // Continue with the message flow so Claude can summarise the result
        // The message will contain the approval context
      } else {
        // Store assistant response for rejection
        await supabase.from('agent_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: actionResult.message,
        });

        return new Response(
          JSON.stringify({
            conversationId,
            message: actionResult.message,
            toolResult: actionResult.toolResult || null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Store user message
    await supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: body.message,
    });

    // Build system prompt and load history
    const [systemPrompt, conversationHistory] = await Promise.all([
      buildSystemPrompt(user.id, supabase),
      loadConversationHistory(conversationId, supabase),
    ]);

    // Load autonomy settings
    const { data: autonomySettings } = await supabase
      .from('agent_autonomy_settings')
      .select('preset, category_overrides')
      .eq('user_id', user.id)
      .single();

    // Build messages array for Claude
    const messages: Array<{ role: string; content: any }> = [
      ...conversationHistory,
      { role: 'user', content: body.message },
    ];

    // Prepare tool definitions for Claude API — uses the full registry
    const claudeTools = getClaudeTools();

    // Agentic loop
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Agent configuration error: missing API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const model = Deno.env.get('AGENT_MODEL') || 'claude-sonnet-4-20250514';
    const maxIterations = 10;
    let iteration = 0;
    let finalResponse = '';
    let totalTokensUsed = 0;
    const allToolCalls: any[] = [];
    const allToolResults: any[] = [];
    const pendingActions: any[] = [];

    while (iteration < maxIterations) {
      iteration++;

      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools: claudeTools,
        }),
      });

      if (!claudeResponse.ok) {
        const errText = await claudeResponse.text();
        console.error('Claude API error:', claudeResponse.status, errText);
        return new Response(
          JSON.stringify({ error: 'AI service temporarily unavailable. Please try again.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const claudeData = await claudeResponse.json();
      totalTokensUsed += (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);

      // Extract text and tool use blocks
      const textBlocks = (claudeData.content || []).filter((b: any) => b.type === 'text');
      const toolUseBlocks = (claudeData.content || []).filter((b: any) => b.type === 'tool_use');

      // If no tool use, we are done
      if (claudeData.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        finalResponse = textBlocks.map((b: any) => b.text).join('\n');
        break;
      }

      // Process tool calls
      const toolResultBlocks: any[] = [];
      const iterationToolCalls: any[] = [];
      const iterationToolResults: any[] = [];

      for (const toolBlock of toolUseBlocks) {
        // Look up tool metadata from the registry
        const toolMeta = TOOL_META[toolBlock.name];
        if (!toolMeta) {
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({ success: false, error: `Unknown tool: ${toolBlock.name}` }),
          });
          continue;
        }

        // Check autonomy gate using registry categories
        const userAutonomyLevel = getUserAutonomyForCategory(
          autonomySettings as AutonomySettings | null,
          toolMeta.category,
        );
        const toolRequiredLevel = toolMeta.autonomyLevel;

        if (userAutonomyLevel < toolRequiredLevel) {
          // User's autonomy setting is lower than what the tool needs to auto-execute
          // Create a pending action for approval
          const toolDef = CLAUDE_TOOLS.find((t) => t.name === toolBlock.name);
          const { data: pendingAction } = await supabase
            .from('agent_pending_actions')
            .insert({
              user_id: user.id,
              conversation_id: conversationId,
              action_type: toolMeta.category,
              title: `${toolBlock.name}: ${toolBlock.input ? JSON.stringify(toolBlock.input).substring(0, 100) : ''}`,
              description: toolDef?.description || toolBlock.name,
              tool_name: toolBlock.name,
              tool_params: toolBlock.input,
              autonomy_level: toolRequiredLevel,
              status: 'pending',
              recommendation: `This action requires your approval because your autonomy setting for "${toolMeta.category}" is L${userAutonomyLevel} and this action requires L${toolRequiredLevel}.`,
            })
            .select('id')
            .single();

          const pendingId = pendingAction?.id || 'unknown';
          pendingActions.push({
            id: pendingId,
            tool_name: toolBlock.name,
            tool_params: toolBlock.input,
            description: toolDef?.description || toolBlock.name,
            category: toolMeta.category,
          });

          // Log the gated decision
          await supabase.from('agent_decisions').insert({
            user_id: user.id,
            conversation_id: conversationId,
            decision_type: 'autonomy_gate',
            tool_name: toolBlock.name,
            input_data: toolBlock.input,
            reasoning: `User autonomy for ${toolMeta.category} is L${userAutonomyLevel}, tool requires L${toolRequiredLevel}. Action queued for approval.`,
            autonomy_level: toolRequiredLevel,
            was_auto_executed: false,
          });

          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({
              success: false,
              needs_approval: true,
              pending_action_id: pendingId,
              message: `This action requires owner approval. A pending action has been created. The owner's autonomy setting for "${toolMeta.category}" is L${userAutonomyLevel} and this action requires L${toolRequiredLevel}.`,
            }),
          });
        } else {
          // Execute the tool
          const startTime = Date.now();
          const result = await executeTool(toolBlock.name, toolBlock.input, user.id, supabase);
          const durationMs = Date.now() - startTime;

          iterationToolCalls.push({
            id: toolBlock.id,
            name: toolBlock.name,
            input: toolBlock.input,
          });

          iterationToolResults.push({
            tool_use_id: toolBlock.id,
            result: result.data || result.error,
          });

          // Log the decision
          await supabase.from('agent_decisions').insert({
            user_id: user.id,
            conversation_id: conversationId,
            decision_type: 'tool_execution',
            tool_name: toolBlock.name,
            input_data: toolBlock.input,
            output_data: result.data || null,
            autonomy_level: toolRequiredLevel,
            was_auto_executed: true,
            duration_ms: durationMs,
          });

          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result),
          });
        }
      }

      allToolCalls.push(...iterationToolCalls);
      allToolResults.push(...iterationToolResults);

      // Add assistant message and tool results to the conversation for next iteration
      messages.push({ role: 'assistant', content: claudeData.content });
      messages.push({ role: 'user', content: toolResultBlocks });

      // Collect partial text response
      if (textBlocks.length > 0) {
        finalResponse += textBlocks.map((b: any) => b.text).join('\n');
      }
    }

    // If we exhausted iterations without a final response
    if (iteration >= maxIterations && !finalResponse) {
      finalResponse = 'I apologise, but I ran into some complexity processing your request. Could you try rephrasing or breaking it into smaller steps?';
    }

    // Store assistant message with tool calls and results
    await supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: finalResponse,
      tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
      tool_results: allToolResults.length > 0 ? allToolResults : null,
      tokens_used: totalTokensUsed,
    });

    // Update conversation metadata
    await supabase
      .from('agent_conversations')
      .update({
        updated_at: new Date().toISOString(),
        total_tokens_used: totalTokensUsed,
        model,
      })
      .eq('id', conversationId);

    // Build response
    const response: Record<string, unknown> = {
      conversationId,
      message: finalResponse,
      tokensUsed: totalTokensUsed,
      toolsUsed: allToolCalls.map((tc) => tc.name),
    };

    if (pendingActions.length > 0) {
      response.pendingActions = pendingActions;
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Agent chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
