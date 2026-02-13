// Agent Chat - Supabase Edge Function
// Casa - Mission 14: AI Agent Chat
//
// Handles AI chat conversations for property owners. Processes user messages,
// calls Claude with tool use, gates actions through the autonomy system,
// and stores all messages and decisions for audit.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { CLAUDE_TOOLS, TOOL_META, getClaudeTools, getContextualTools } from '../_shared/tool-registry.ts';
import { classifyToolError } from '../_shared/tool-dispatcher.ts';
import { generateEmbedding, buildDecisionEmbeddingText, formatEmbeddingForStorage } from '../_shared/embeddings.ts';
import {
  TIER_TOOL_ACCESS,
  AUTONOMY_PRESET_DEFAULTS,
  parseAutonomyLevel,
  getUserAutonomyForCategory,
  executeTool,
  updateToolGenome,
  updateCoOccurrence,
  calculateConfidence,
  computeIntentHash,
  computeIntentLabel,
  estimateTokens,
  estimateMessagesTokens,
  compactMessages,
  buildSystemPrompt,
  loadConversationHistory,
  detectAndRecordCorrection,
  CORRECTION_PATTERNS,
  GENOME_EMA_ALPHA,
  SOURCE_QUALITY_MAP,
  type AutonomySettings,
  type ConfidenceFactors,
} from '../_shared/agent-core.ts';

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

    // Active Learning: extract a rule from the rejection to prevent future similar actions
    const toolCategory = pendingAction.action_type || 'general';
    const ruleText = `Owner rejected "${pendingAction.tool_name}" action: ${pendingAction.title}. Do not auto-execute similar ${toolCategory} actions without explicit approval.`;

    await supabase.from('agent_rules').upsert({
      user_id: userId,
      rule_text: ruleText,
      category: toolCategory,
      confidence: 0.7, // Initial confidence from single rejection
      source: 'correction',
      active: true,
    }, { onConflict: 'user_id,rule_text' }).then(() => {});

    // Log the rejection decision for learning pipeline
    const { data: rejectionDecision } = await supabase.from('agent_decisions').insert({
      user_id: userId,
      conversation_id: conversationId,
      decision_type: 'action_rejected',
      tool_name: pendingAction.tool_name,
      input_data: pendingAction.tool_params,
      reasoning: `Owner rejected this action. A learning rule has been created to prevent similar auto-executions.`,
      was_auto_executed: false,
      owner_feedback: 'rejected',
    }).select('id').single();

    // Feed rejection into the learning pipeline for graduation tracking
    if (rejectionDecision) {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-learning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          action: 'process_feedback',
          user_id: userId,
          decision_id: rejectionDecision.id,
          feedback: 'rejected',
          category: toolCategory,
        }),
      }).catch(() => {});
    }

    return { message: `Action rejected: ${pendingAction.title}. I've noted this preference and won't attempt similar actions without your approval in the future.` };
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

  // Log the decision and feed into learning pipeline
  const { data: approvalDecision } = await supabase.from('agent_decisions').insert({
    user_id: userId,
    conversation_id: conversationId,
    decision_type: 'tool_execution_approved',
    tool_name: pendingAction.tool_name,
    input_data: pendingAction.tool_params,
    output_data: toolResult.data || null,
    autonomy_level: pendingAction.autonomy_level,
    owner_feedback: 'approved',
    was_auto_executed: false,
  }).select('id').single();

  // Feed approval into the learning pipeline for graduation tracking
  if (approvalDecision) {
    const toolCategory = pendingAction.action_type || 'general';
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-learning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'process_feedback',
        user_id: userId,
        decision_id: approvalDecision.id,
        feedback: 'approved',
        category: toolCategory,
      }),
    }).catch(() => {});
  }

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

    // Detect user role (owner vs tenant)
    let userRole = 'owner';
    try {
      const { data: roleProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      userRole = roleProfile?.role || 'owner';
    } catch (roleErr: any) {
      console.error('[agent-chat] Role detection failed:', roleErr);
      // Continue with default role 'owner' rather than crashing
    }

    // Rate limiting: 30 messages per 15-minute window
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: userConvs } = await supabase
        .from('agent_conversations')
        .select('id')
        .eq('user_id', user.id);

      if (userConvs && userConvs.length > 0) {
        const convIds = userConvs.map(c => c.id);
        const { count: recentMessageCount } = await supabase
          .from('agent_messages')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'user')
          .gte('created_at', fifteenMinutesAgo)
          .in('conversation_id', convIds);

        if ((recentMessageCount ?? 0) >= 30) {
          return new Response(
            JSON.stringify({
              error: "You've sent a lot of messages recently. Please wait a few minutes before sending more.",
              retryAfter: 60,
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } },
          );
        }
      }
    } catch (rateLimitErr: any) {
      console.error('[agent-chat] Rate limiting check failed:', rateLimitErr);
      // Continue without rate limiting rather than crashing
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
      // Auto-generate a title from the user's first message
      const autoTitle = body.message.length <= 60
        ? body.message
        : body.message.substring(0, 57) + '...';

      const { data: conversation, error: convErr } = await supabase
        .from('agent_conversations')
        .insert({
          user_id: user.id,
          status: 'active',
          is_active: true,
          title: autoTitle,
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

    // Inline correction detection — fire and forget, does not block response
    detectAndRecordCorrection(user.id, conversationId, body.message, supabase);

    // Build system prompt and load history
    let systemPrompt: string;
    let conversationHistory: Array<{ role: string; content: any }>;
    try {
      [systemPrompt, conversationHistory] = await Promise.all([
        buildSystemPrompt(user.id, supabase, body.message, userRole),
        loadConversationHistory(conversationId, supabase),
      ]);
    } catch (promptErr: any) {
      console.error('[agent-chat] buildSystemPrompt/loadHistory failed:', promptErr);
      return new Response(
        JSON.stringify({ error: `System prompt build failed: ${promptErr.message || promptErr}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Load autonomy settings
    let autonomySettings: any = null;
    try {
      const { data } = await supabase
        .from('agent_autonomy_settings')
        .select('preset, category_overrides')
        .eq('user_id', user.id)
        .single();
      autonomySettings = data;
    } catch (autoErr: any) {
      console.error('[agent-chat] Autonomy settings load failed:', autoErr);
    }

    // Load user profile for tier enforcement
    let userTier = 'starter';
    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
      userTier = userProfile?.subscription_tier || 'starter';
    } catch (tierErr: any) {
      console.error('[agent-chat] Tier load failed:', tierErr);
    }
    const allowedCategories = TIER_TOOL_ACCESS[userTier] || TIER_TOOL_ACCESS.starter;

    // Build messages array for Claude
    let messages: Array<{ role: string; content: any }> = [
      ...conversationHistory,
      { role: 'user', content: body.message },
    ];

    // Context Window Guard — compact messages if they exceed token budget
    // Claude's context window is 200K tokens; reserve 50K for system prompt + tools + response
    const MESSAGE_TOKEN_BUDGET = 120_000;
    const systemPromptTokens = estimateTokens(systemPrompt);
    const messageTokenBudget = MESSAGE_TOKEN_BUDGET - systemPromptTokens;
    messages = compactMessages(messages, messageTokenBudget);

    // Prepare tool definitions for Claude API — contextual filtering reduces 130 → ~20-40 tools
    const claudeTools = userRole === 'tenant' ? [] : getContextualTools(body.message || '');

    // Agentic loop
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Agent configuration error: missing API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Smart model routing: use Haiku for simple queries, Sonnet for complex/tool-heavy tasks
    const defaultModel = Deno.env.get('AGENT_MODEL') || 'claude-sonnet-4-20250514';
    const haikuModel = 'claude-3-5-haiku-20241022';
    const userMsg = (body.message || '').toLowerCase();
    const isSimpleQuery = (
      messages.length <= 2 && // First or second message in conversation
      !userMsg.match(/create|update|send|schedule|generate|find.*trade|find.*plumb|find.*electric|find.*service|search|web|online|remind|pay|invoice|add.*trade|add.*network/) &&
      userMsg.length < 200
    );
    const model = isSimpleQuery ? haikuModel : defaultModel;
    const maxIterations = 10;
    const agentLoopStartTime = Date.now();
    let iteration = 0;
    let finalResponse = '';
    let totalTokensUsed = 0;
    const allToolCalls: any[] = [];
    const allToolResults: any[] = [];
    const pendingActions: any[] = [];
    const inlineActions: Array<{ type: string; label: string; route: string; params?: Record<string, string> }> = [];

    while (iteration < maxIterations) {
      iteration++;

      // Call Claude API with retry logic for rate limits (429) and overload (529)
      // Keep retries short to stay within Supabase Edge Function time limits (~150s)
      let claudeData: any;
      const API_MAX_RETRIES = 3;
      for (let apiAttempt = 0; apiAttempt < API_MAX_RETRIES; apiAttempt++) {
        if (apiAttempt > 0) {
          // Short backoff: 5s, 10s — client should retry for longer waits
          const backoffMs = 5_000 * Math.pow(2, apiAttempt - 1);
          console.log(`Claude API retry ${apiAttempt}/${API_MAX_RETRIES - 1}, waiting ${backoffMs / 1000}s...`);
          await new Promise((r) => setTimeout(r, backoffMs));
        }

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
            ...(claudeTools.length > 0 ? { tools: claudeTools } : {}),
          }),
        });

        if (claudeResponse.ok) {
          claudeData = await claudeResponse.json();
          break;
        }

        const errText = await claudeResponse.text();
        console.error(`Claude API error (attempt ${apiAttempt + 1}):`, claudeResponse.status, errText);

        // Retry on rate limit (429) or overloaded (529)
        if ((claudeResponse.status === 429 || claudeResponse.status === 529) && apiAttempt < API_MAX_RETRIES - 1) {
          continue;
        }

        // Non-retryable error or exhausted retries
        const isRateLimit = claudeResponse.status === 429 || claudeResponse.status === 529;
        const retryAfter = isRateLimit ? '30' : '10';
        return new Response(
          JSON.stringify({
            error: isRateLimit
              ? 'The AI agent is currently busy. Please try again in a moment.'
              : 'AI service temporarily unavailable. Please try again.',
            retryAfter: parseInt(retryAfter),
          }),
          {
            status: isRateLimit ? 429 : 502,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': retryAfter,
            },
          },
        );
      }

      if (!claudeData) {
        return new Response(
          JSON.stringify({ error: 'AI service unavailable after retries.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      totalTokensUsed += (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);

      // Extract text and tool use blocks
      const textBlocks = (claudeData.content || []).filter((b: any) => b.type === 'text');
      const toolUseBlocks = (claudeData.content || []).filter((b: any) => b.type === 'tool_use');

      // If no tool use, we are done
      if (claudeData.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        finalResponse = textBlocks.map((b: any) => b.text).join('\n');
        break;
      }

      // Process tool calls — execute in parallel for speed
      const iterationToolCalls: any[] = [];
      const iterationToolResults: any[] = [];

      // Process all tool blocks concurrently
      const toolPromises = toolUseBlocks.map(async (toolBlock: any) => {
        const toolMeta = TOOL_META[toolBlock.name];
        if (!toolMeta) {
          return {
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({ success: false, error: `Unknown tool: ${toolBlock.name}` }),
          };
        }

        // Tier enforcement: check if user's subscription allows this tool category
        if (!allowedCategories.has(toolMeta.category)) {
          const tierName = userTier === 'hands_off' ? 'Hands Off' : userTier.charAt(0).toUpperCase() + userTier.slice(1);
          const requiredTier = toolMeta.category === 'external' || toolMeta.category === 'integration'
            ? 'Hands Off'
            : 'Pro';
          return {
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({
              success: false,
              tier_blocked: true,
              message: `This feature is available on the ${requiredTier} plan. The owner is currently on the ${tierName} plan. Suggest they visit Settings > Subscription to learn about upgrading.`,
            }),
          };
        }

        const userAutonomyLevel = getUserAutonomyForCategory(
          autonomySettings as AutonomySettings | null,
          toolMeta.category,
        );
        const toolRequiredLevel = toolMeta.autonomyLevel;

        if (userAutonomyLevel < toolRequiredLevel) {
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

          // Log gated decision (fire and forget — don't block)
          supabase.from('agent_decisions').insert({
            user_id: user.id,
            conversation_id: conversationId,
            decision_type: 'autonomy_gate',
            tool_name: toolBlock.name,
            input_data: toolBlock.input,
            reasoning: `User autonomy for ${toolMeta.category} is L${userAutonomyLevel}, tool requires L${toolRequiredLevel}. Action queued for approval.`,
            autonomy_level: toolRequiredLevel,
            was_auto_executed: false,
          }).then(() => {});

          return {
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({
              success: false,
              needs_approval: true,
              pending_action_id: pendingId,
              message: `This action requires owner approval. A pending action has been created. The owner's autonomy setting for "${toolMeta.category}" is L${userAutonomyLevel} and this action requires L${toolRequiredLevel}.`,
            }),
          };
        }

        // Calculate confidence for non-query/non-memory tools
        let confidenceFactors: ConfidenceFactors | null = null;
        if (toolMeta.category !== 'query' && toolMeta.category !== 'memory') {
          try {
            confidenceFactors = await calculateConfidence(user.id, toolBlock.name, supabase);

            // Confidence-aware autonomy gating: if confidence is very low,
            // require one higher level of approval for borderline cases
            if (confidenceFactors.composite < 0.5) {
              const adjustedRequired = Math.min(toolRequiredLevel + 1, 4);
              if (userAutonomyLevel < adjustedRequired && userAutonomyLevel >= toolRequiredLevel) {
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
                    autonomy_level: adjustedRequired,
                    status: 'pending',
                    recommendation: `This action has low confidence (${Math.round(confidenceFactors.composite * 100)}%) and requires your approval as a safety measure.`,
                  })
                  .select('id')
                  .single();

                const pendingId = pendingAction?.id || 'unknown';

                // Audit log: record the confidence-gated decision for traceability
                supabase.from('agent_decisions').insert({
                  user_id: user.id,
                  conversation_id: conversationId,
                  decision_type: 'confidence_gate',
                  tool_name: toolBlock.name,
                  input_data: toolBlock.input,
                  output_data: { gated: true, pending_action_id: pendingId },
                  reasoning: `Low confidence (${Math.round(confidenceFactors.composite * 100)}%) triggered approval gate. Autonomy escalated from L${toolRequiredLevel} to L${adjustedRequired}.`,
                  confidence: confidenceFactors.composite,
                  confidence_factors: confidenceFactors,
                  autonomy_level: adjustedRequired,
                }).then(() => {});

                pendingActions.push({
                  id: pendingId,
                  tool_name: toolBlock.name,
                  tool_params: toolBlock.input,
                  description: toolDef?.description || toolBlock.name,
                  category: toolMeta.category,
                });

                return {
                  type: 'tool_result',
                  tool_use_id: toolBlock.id,
                  content: JSON.stringify({
                    success: false,
                    needs_approval: true,
                    pending_action_id: pendingId,
                    message: `This action requires owner approval due to low confidence (${Math.round(confidenceFactors.composite * 100)}%).`,
                  }),
                };
              }
            }
          } catch (confErr) {
            // Don't block execution on confidence calculation failure
            console.warn(`[confidence] calculation failed for ${toolBlock.name}:`, confErr);
          }
        }

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

        // Classify errors for learning pipeline
        const classified = (!result.success && result.error)
          ? classifyToolError(toolBlock.name, toolBlock.input || {}, result.error)
          : null;

        // Log decision with semantic embedding (fire and forget — don't block response)
        (async () => {
          try {
            const embeddingText = buildDecisionEmbeddingText(
              toolBlock.name,
              confidenceFactors ? `confidence: ${confidenceFactors.composite}` : null,
              toolBlock.input,
            );
            const embedding = await generateEmbedding(embeddingText);
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
              embedding: formatEmbeddingForStorage(embedding),
              ...(classified ? {
                error_type: classified.type,
                error_details: classified.details,
              } : {}),
              ...(confidenceFactors ? {
                confidence: confidenceFactors.composite,
                confidence_factors: confidenceFactors,
              } : {}),
            });
          } catch (embErr) {
            // Fallback: insert without embedding if embedding generation fails
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
              ...(classified ? {
                error_type: classified.type,
                error_details: classified.details,
              } : {}),
              ...(confidenceFactors ? {
                confidence: confidenceFactors.composite,
                confidence_factors: confidenceFactors,
              } : {}),
            });
          }
        })();

        // Update tool genome (fire and forget)
        updateToolGenome(user.id, toolBlock.name, result.success, durationMs, toolBlock.input || {}, supabase, result.error);

        // Record outcome for non-query tools (fire and forget)
        if (toolMeta.category !== 'query' && toolMeta.category !== 'memory') {
          supabase.from('agent_outcomes').insert({
            user_id: user.id,
            tool_name: toolBlock.name,
            outcome_type: result.success ? 'success' : 'failure',
            outcome_details: {
              tool_name: toolBlock.name,
              duration_ms: durationMs,
              error: result.error || null,
            },
          }).then(() => {});
        }

        // If error was classified, send to learning pipeline for error-routed learning
        if (classified) {
          supabase.functions.invoke('agent-learning', {
            body: {
              action: 'classify_and_learn',
              user_id: user.id,
              error_type: classified.type,
              tool_name: toolBlock.name,
              error_message: classified.error,
              input_summary: classified.details.input_summary,
            },
          }).catch(() => {});
        }

        return {
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        };
      });

      // Wait for all tools to complete in parallel
      const toolResultBlocks = await Promise.all(toolPromises);

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

    // Extract inline navigation actions from tool results (e.g., document creation, suggest_navigation)
    for (const tr of allToolResults) {
      const result = tr.result;
      if (result && typeof result === 'object') {
        const r = result as Record<string, unknown>;
        if (r.document_id && r.view_route) {
          inlineActions.push({
            type: 'navigation',
            label: `View ${(r.title as string) || 'Document'}`,
            route: r.view_route as string,
            params: { id: r.document_id as string },
          });
        }
        if (r._navigation === true && r.view_route) {
          inlineActions.push({
            type: 'navigation',
            label: (r.label as string) || 'Open',
            route: r.view_route as string,
            params: (r.params as Record<string, string>) || {},
          });
        }
      }
    }

    // Store message, update conversation, and record trajectory in parallel
    const totalDurationMs = Date.now() - agentLoopStartTime;
    const dbWrites: Promise<any>[] = [
      // Store assistant message
      supabase.from('agent_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: finalResponse,
        tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
        tool_results: allToolResults.length > 0 ? allToolResults : null,
        inline_actions: inlineActions.length > 0 ? inlineActions : null,
        tokens_used: totalTokensUsed,
      }),
      // Update conversation metadata
      supabase.from('agent_conversations').update({
        updated_at: new Date().toISOString(),
        total_tokens_used: totalTokensUsed,
        model,
      }).eq('id', conversationId),
    ];

    // Record trajectory if tools were used, with intent-based optimisation comparison
    let efficiencyNote = '';
    let shouldPromoteGolden = false;
    if (allToolCalls.length > 0) {
      const hasErrors = allToolResults.some((tr: any) =>
        tr.result && typeof tr.result === 'object' && tr.result.error,
      );

      const currentScore = iteration <= 2 ? 1.0 : iteration <= 5 ? 0.7 : 0.4;
      const toolNames = allToolCalls.map((tc: any) => tc.name);
      const intentHash = computeIntentHash(body.message, toolNames);
      const intentLabel = computeIntentLabel(body.message);
      const toolCount = allToolCalls.length;

      dbWrites.push(
        supabase.from('agent_trajectories').insert({
          user_id: user.id,
          conversation_id: conversationId,
          tool_sequence: allToolCalls.map((tc: any) => ({
            name: tc.name,
            input_summary: tc.input ? Object.keys(tc.input).join(', ') : '',
          })),
          total_duration_ms: totalDurationMs,
          success: !hasErrors,
          efficiency_score: currentScore,
          goal: body.message.substring(0, 200),
          intent_hash: intentHash,
          intent_label: intentLabel,
          tool_count: toolCount,
        }),
      );

      // Update co-occurrence tracking for tools used together (fire and forget)
      if (toolNames.length >= 2) {
        updateCoOccurrence(user.id, toolNames, !hasErrors, supabase);
      }

      // Trajectory optimisation: compare against similar past trajectories by intent hash
      if (!hasErrors) {
        const { data: pastTrajectories } = await supabase
          .from('agent_trajectories')
          .select('id, tool_sequence, total_duration_ms, efficiency_score, tool_count')
          .eq('user_id', user.id)
          .eq('intent_hash', intentHash)
          .eq('success', true)
          .order('efficiency_score', { ascending: false })
          .limit(20);

        if (pastTrajectories && pastTrajectories.length >= 2) {
          const avgDuration = pastTrajectories.reduce((s: number, t: any) => s + (t.total_duration_ms || 0), 0) / pastTrajectories.length;
          const avgToolCount = pastTrajectories.reduce((s: number, t: any) => s + (t.tool_count || 0), 0) / pastTrajectories.length;
          const bestScore = pastTrajectories[0].efficiency_score;

          if (currentScore >= bestScore && toolCount <= avgToolCount) {
            shouldPromoteGolden = true;
          }

          const durationImprovement = avgDuration > 0 ? Math.round(((avgDuration - totalDurationMs) / avgDuration) * 100) : 0;
          const toolImprovement = avgToolCount > 0 ? Math.round(((avgToolCount - toolCount) / avgToolCount) * 100) : 0;

          if (durationImprovement > 20) {
            efficiencyNote = `\n\n(I completed this ${durationImprovement}% faster than my average for similar requests.)`;
          } else if (toolImprovement > 0 && toolCount < avgToolCount) {
            efficiencyNote = `\n\n(I used ${toolCount} tools this time vs my usual ${Math.round(avgToolCount)} — getting more efficient!)`;
          }
        }
      }

      // Store golden promotion flag and intent hash for after DB commit
      if (shouldPromoteGolden) {
        dbWrites.push(
          // Un-golden previous golden for this intent, then promote current
          supabase.from('agent_trajectories')
            .update({ is_golden: false })
            .eq('user_id', user.id)
            .eq('intent_hash', intentHash)
            .eq('is_golden', true)
        );
      }
    }

    // Commit all DB writes (messages, conversation update, trajectory insert, un-golden)
    await Promise.all(dbWrites);

    // Golden trajectory promotion — runs AFTER trajectory insert + un-golden are committed
    // Now the current trajectory exists in the DB and old goldens are cleared
    // Only promote if the trajectory comparison determined this is the best path
    if (allToolCalls.length > 0 && shouldPromoteGolden) {
      const toolNames = allToolCalls.map((tc: any) => tc.name);
      const intentHashForGolden = computeIntentHash(body.message, toolNames);
      // Mark the latest successful trajectory with this intent as golden (fire and forget)
      supabase.from('agent_trajectories')
        .update({ is_golden: true })
        .eq('user_id', user.id)
        .eq('intent_hash', intentHashForGolden)
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(() => {});
    }

    // Append efficiency note to response if applicable
    if (efficiencyNote) {
      finalResponse += efficiencyNote;
    }

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

    if (inlineActions.length > 0) {
      response.inlineActions = inlineActions;
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
