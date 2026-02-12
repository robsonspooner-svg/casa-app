// Mission 15: Learning Pipeline Edge Function
// Handles: correction recording, pattern detection, rule generation, autonomy graduation
// Called by agent-chat after owner provides feedback on agent actions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { generateEmbedding, cosineSimilarity, formatEmbeddingForStorage } from '../_shared/embeddings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

// ============================================================
// Core Types
// ============================================================

interface CorrectionInput {
  user_id: string;
  decision_id?: string;
  original_action: string;
  correction: string;
  context_snapshot: Record<string, unknown>;
  category?: string;
}

interface FeedbackInput {
  user_id: string;
  decision_id: string;
  feedback: 'approved' | 'rejected' | 'corrected';
  correction?: string;
  category?: string;
}

interface GraduationCheckInput {
  user_id: string;
  category: string;
}

// ============================================================
// Supabase Client
// ============================================================

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ============================================================
// 1. Record Correction
// ============================================================

async function recordCorrection(input: CorrectionInput): Promise<{ correction_id: string; rule?: { id: string; rule_text: string } }> {
  const supabase = getServiceClient();

  // Generate embedding for this correction (for semantic similarity matching)
  let correctionEmbedding: number[] | null = null;
  try {
    correctionEmbedding = await generateEmbedding(`${input.correction} ${input.original_action}`);
  } catch {
    // Don't block on embedding failure
  }

  // Store correction with embedding
  const { data: correction, error: corrErr } = await supabase
    .from('agent_corrections')
    .insert({
      user_id: input.user_id,
      decision_id: input.decision_id || null,
      original_action: input.original_action,
      correction: input.correction,
      context_snapshot: input.context_snapshot,
      pattern_matched: false,
      ...(correctionEmbedding ? { embedding: formatEmbeddingForStorage(correctionEmbedding) } : {}),
    })
    .select()
    .single();

  if (corrErr) throw new Error(`Failed to store correction: ${corrErr.message}`);

  // Run pattern detection
  const rule = await detectCorrectionPattern(input.user_id, correction);

  return { correction_id: correction.id, rule: rule || undefined };
}

// ============================================================
// 2. Pattern Detection
// ============================================================

async function detectCorrectionPattern(
  userId: string,
  newCorrection: { id: string; original_action: string; correction: string; context_snapshot: Record<string, unknown> }
): Promise<{ id: string; rule_text: string } | null> {
  const supabase = getServiceClient();

  // Find unmatched corrections for this user
  const { data: corrections } = await supabase
    .from('agent_corrections')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_matched', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!corrections || corrections.length < 3) return null;

  // Group by inferred category (simple keyword-based)
  const newCategory = inferCategory(newCorrection.original_action, newCorrection.correction);
  const categoryCorrections = corrections.filter(c =>
    inferCategory(c.original_action, c.correction) === newCategory
  );

  if (categoryCorrections.length < 3) return null;

  // Check for semantic similarity (with bag-of-words fallback)
  const similar = await findSimilarCorrections(newCorrection, categoryCorrections);

  if (similar.length < 3) return null;

  // Generate rule via Claude
  const rule = await generateRuleFromCorrections(userId, similar, newCategory);

  if (rule) {
    // Mark corrections as pattern-matched
    await supabase
      .from('agent_corrections')
      .update({ pattern_matched: true })
      .in('id', similar.map(c => c.id));
  }

  return rule;
}

function inferCategory(originalAction: string, correction: string): string {
  const text = `${originalAction} ${correction}`.toLowerCase();

  // Order matters: more specific domains first, communication last (its keywords are too generic).
  // Word-boundary \b at START prevents partial prefix matches (e.g. "contact" in "contractor").
  // No \b at END so stems match their inflections (e.g. "plumb" matches "plumber", "plumbing").
  if (text.match(/\b(maintenance|repair|plumb|electri|trade(?:s|sman)|contractor)/)) return 'maintenance';
  if (text.match(/\b(rent\b|payment|bond\b|fee\b|cost|price|financial|money|expense)/)) return 'financial';
  if (text.match(/\b(schedul|inspect|appointment|calendar)/)) return 'scheduling';
  if (text.match(/\b(tenant|lease\b|application|vacancy)/)) return 'tenant_relations';
  if (text.match(/\b(compliance|smoke\b|pool\b|gas\b|safety|insurance)/)) return 'compliance';
  if (text.match(/\b(message|email|sms\b|notify|notification|communicat)/)) return 'communication';
  return 'general';
}

async function findSimilarCorrections(
  target: { correction: string; original_action: string },
  candidates: Array<{ id: string; correction: string; original_action: string; context_snapshot: Record<string, unknown>; embedding?: number[] | null }>
): Promise<Array<{ id: string; correction: string; original_action: string; context_snapshot: Record<string, unknown> }>> {
  // Try semantic similarity first
  try {
    const targetEmbedding = await generateEmbedding(`${target.correction} ${target.original_action}`);
    const semanticMatches = candidates.filter(c => {
      if (!c.embedding || !Array.isArray(c.embedding)) return false;
      return cosineSimilarity(targetEmbedding, c.embedding) > 0.6;
    });
    if (semanticMatches.length > 0) return semanticMatches;
  } catch {
    // Fall through to bag-of-words if embedding fails
  }

  // Fallback: bag-of-words overlap (original algorithm)
  const targetWords = new Set(
    `${target.correction} ${target.original_action}`.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );

  return candidates.filter(c => {
    const words = `${c.correction} ${c.original_action}`.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = words.filter(w => targetWords.has(w)).length;
    const similarity = overlap / Math.max(targetWords.size, words.length);
    return similarity > 0.3;
  });
}

// ============================================================
// 3. Rule Generation via Claude
// ============================================================

async function generateRuleFromCorrections(
  userId: string,
  corrections: Array<{ id: string; correction: string; original_action: string; context_snapshot: Record<string, unknown> }>,
  category: string
): Promise<{ id: string; rule_text: string } | null> {
  const supabase = getServiceClient();

  const prompt = `You are analysing patterns in a property owner's corrections to their AI property manager.

The owner has corrected the agent ${corrections.length} times in similar situations:

${corrections.slice(0, 5).map((c, i) => `
Correction ${i + 1}:
- Agent's action: ${c.original_action}
- Owner's correction: ${c.correction}
- Context: ${JSON.stringify(c.context_snapshot).slice(0, 500)}
`).join('\n')}

Generate a single, concise rule that captures the owner's preference. The rule should:
1. Be written as an imperative instruction to the agent
2. Be specific enough to apply correctly but general enough to cover similar future situations
3. Include any relevant thresholds, times, or conditions

Examples of good rules:
- "Never send messages to tenants before 9am or after 8pm AEST"
- "Always get owner approval for maintenance quotes over $300"
- "When multiple quotes are available, recommend the cheapest option unless quality ratings differ by more than 1 star"
- "For routine maintenance at 42 Smith St, always contact Reliable Plumbing first"

Return ONLY the rule text, nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return null;
    }

    const data = await response.json();
    const ruleText = data.content[0]?.text?.trim();

    if (!ruleText) return null;

    // Check for conflicting/duplicate rules before inserting
    const conflict = await checkRuleConflicts(supabase, userId, ruleText);
    if (conflict.shouldSkip) {
      console.log(`Rule dedup: skipping duplicate rule (similar to ${conflict.conflictId})`);
      return null;
    }

    // Generate embedding for the new rule
    let ruleEmbedding: number[] | null = null;
    try { ruleEmbedding = await generateEmbedding(ruleText); } catch { /* ok */ }

    // Store the rule with embedding
    const { data: rule, error } = await supabase
      .from('agent_rules')
      .insert({
        user_id: userId,
        rule_text: ruleText,
        category: category,
        confidence: 0.70,
        source: 'correction_pattern',
        correction_ids: corrections.map(c => c.id),
        active: true,
        applications_count: 0,
        rejections_count: 0,
        ...(ruleEmbedding ? { embedding: formatEmbeddingForStorage(ruleEmbedding) } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to store rule:', error);
      return null;
    }

    return { id: rule.id, rule_text: ruleText };
  } catch (err) {
    console.error('Rule generation failed:', err);
    return null;
  }
}

// ============================================================
// 4. Process Feedback (approve/reject/correct)
// ============================================================

async function processFeedback(input: FeedbackInput): Promise<{
  updated: boolean;
  graduation_eligible?: boolean;
  rule_updated?: boolean;
}> {
  const supabase = getServiceClient();

  // Update the decision with feedback
  const { error: decErr } = await supabase
    .from('agent_decisions')
    .update({
      owner_feedback: input.feedback,
      owner_correction: input.correction || null,
    })
    .eq('id', input.decision_id);

  if (decErr) throw new Error(`Failed to update decision: ${decErr.message}`);

  // Get the decision to find its tool info
  const { data: decision } = await supabase
    .from('agent_decisions')
    .select('*')
    .eq('id', input.decision_id)
    .single();

  if (!decision) throw new Error('Decision not found');

  const category = input.category || inferCategory(decision.tool_name, decision.decision_type);

  // Update autonomy graduation tracking
  const graduationResult = await updateGraduationTracking(input.user_id, category, input.feedback);

  // Update rule confidence if a rule was applied
  let ruleUpdated = false;
  if (decision.reasoning) {
    ruleUpdated = await updateRuleConfidence(input.user_id, decision.reasoning, input.feedback);
  }

  // If corrected, record the correction
  if (input.feedback === 'corrected' && input.correction) {
    await recordCorrection({
      user_id: input.user_id,
      decision_id: input.decision_id,
      original_action: `${decision.tool_name}: ${JSON.stringify(decision.input_data).slice(0, 200)}`,
      correction: input.correction,
      context_snapshot: {
        tool_name: decision.tool_name,
        decision_type: decision.decision_type,
        input_data: decision.input_data,
        output_data: decision.output_data,
      },
      category,
    });
  }

  return {
    updated: true,
    graduation_eligible: graduationResult.eligible,
    rule_updated: ruleUpdated,
  };
}

// ============================================================
// 5. Autonomy Graduation Tracking
// ============================================================

async function updateGraduationTracking(
  userId: string,
  category: string,
  feedback: 'approved' | 'rejected' | 'corrected'
): Promise<{ eligible: boolean; consecutive: number }> {
  const supabase = getServiceClient();

  // Get or create tracking record
  let { data: tracking } = await supabase
    .from('autonomy_graduation_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .single();

  if (!tracking) {
    const { data: newTracking } = await supabase
      .from('autonomy_graduation_tracking')
      .insert({
        user_id: userId,
        category,
        consecutive_approvals: 0,
        total_approvals: 0,
        total_rejections: 0,
        current_level: 1,
        graduation_threshold: 10,
        backoff_multiplier: 1,
      })
      .select()
      .single();
    tracking = newTracking;
  }

  if (!tracking) return { eligible: false, consecutive: 0 };

  if (feedback === 'approved') {
    const newConsecutive = tracking.consecutive_approvals + 1;
    await supabase
      .from('autonomy_graduation_tracking')
      .update({
        consecutive_approvals: newConsecutive,
        total_approvals: tracking.total_approvals + 1,
        last_approval_at: new Date().toISOString(),
      })
      .eq('id', tracking.id);

    const threshold = tracking.graduation_threshold * tracking.backoff_multiplier;
    return {
      eligible: newConsecutive >= threshold && tracking.current_level < 4,
      consecutive: newConsecutive,
    };
  } else {
    // Rejection or correction resets consecutive count
    await supabase
      .from('autonomy_graduation_tracking')
      .update({
        consecutive_approvals: 0,
        total_rejections: tracking.total_rejections + 1,
        last_rejection_at: new Date().toISOString(),
      })
      .eq('id', tracking.id);

    return { eligible: false, consecutive: 0 };
  }
}

async function checkGraduation(input: GraduationCheckInput): Promise<{
  eligible: boolean;
  category: string;
  current_level: number;
  consecutive_approvals: number;
  threshold: number;
}> {
  const supabase = getServiceClient();

  const { data: tracking } = await supabase
    .from('autonomy_graduation_tracking')
    .select('*')
    .eq('user_id', input.user_id)
    .eq('category', input.category)
    .single();

  if (!tracking) {
    return {
      eligible: false,
      category: input.category,
      current_level: 1,
      consecutive_approvals: 0,
      threshold: 10,
    };
  }

  const threshold = tracking.graduation_threshold * tracking.backoff_multiplier;
  return {
    eligible: tracking.consecutive_approvals >= threshold && tracking.current_level < 4,
    category: input.category,
    current_level: tracking.current_level,
    consecutive_approvals: tracking.consecutive_approvals,
    threshold,
  };
}

async function acceptGraduation(userId: string, category: string): Promise<{ new_level: number }> {
  const supabase = getServiceClient();

  const { data: tracking } = await supabase
    .from('autonomy_graduation_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .single();

  if (!tracking) throw new Error('No tracking record found');

  const newLevel = Math.min(tracking.current_level + 1, 4);

  await supabase
    .from('autonomy_graduation_tracking')
    .update({
      current_level: newLevel,
      consecutive_approvals: 0,
      backoff_multiplier: 1,
      last_suggestion_at: new Date().toISOString(),
    })
    .eq('id', tracking.id);

  // Also update the autonomy settings
  const { data: settings } = await supabase
    .from('agent_autonomy_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (settings) {
    const overrides = settings.category_overrides || {};
    const levelMap: Record<number, string> = { 0: 'L0', 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4' };
    overrides[category] = levelMap[newLevel];

    await supabase
      .from('agent_autonomy_settings')
      .update({ category_overrides: overrides })
      .eq('user_id', userId);
  }

  return { new_level: newLevel };
}

async function declineGraduation(userId: string, category: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: tracking } = await supabase
    .from('autonomy_graduation_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .single();

  if (!tracking) return;

  // Double the backoff multiplier and reset consecutive count
  await supabase
    .from('autonomy_graduation_tracking')
    .update({
      consecutive_approvals: 0,
      backoff_multiplier: Math.min(tracking.backoff_multiplier * 2, 8),
      last_suggestion_at: new Date().toISOString(),
    })
    .eq('id', tracking.id);
}

// ============================================================
// 6. Rule Confidence Updates
// ============================================================

async function updateRuleConfidence(
  userId: string,
  reasoning: string,
  feedback: 'approved' | 'rejected' | 'corrected'
): Promise<boolean> {
  const supabase = getServiceClient();

  // Get active rules for this user (with embeddings for semantic matching)
  const { data: rules } = await supabase
    .from('agent_rules')
    .select('*, embedding')
    .eq('user_id', userId)
    .eq('active', true);

  if (!rules || rules.length === 0) return false;

  let updated = false;

  // Generate embedding for the reasoning to compare against rules
  let reasoningEmbedding: number[] | null = null;
  try {
    reasoningEmbedding = await generateEmbedding(reasoning);
  } catch {
    // Fall through to substring matching
  }

  for (const rule of rules) {
    let matches = false;

    // Prefer semantic matching if both embeddings exist
    if (reasoningEmbedding && rule.embedding && Array.isArray(rule.embedding)) {
      const similarity = cosineSimilarity(reasoningEmbedding, rule.embedding);
      matches = similarity > 0.65;
    } else {
      // Fallback: substring matching (original approach, still useful for rules without embeddings)
      matches = reasoning.toLowerCase().includes(rule.rule_text.toLowerCase().slice(0, 50));
    }

    if (matches) {
      const confidenceChange = feedback === 'approved' ? 0.05 : feedback === 'rejected' ? -0.15 : -0.10;
      const newConfidence = Math.max(0, Math.min(1, rule.confidence + confidenceChange));
      const shouldDeactivate = newConfidence < 0.3;

      await supabase
        .from('agent_rules')
        .update({
          confidence: newConfidence,
          active: !shouldDeactivate,
          applications_count: feedback === 'approved' ? rule.applications_count + 1 : rule.applications_count,
          rejections_count: feedback !== 'approved' ? rule.rejections_count + 1 : rule.rejections_count,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id);

      updated = true;
    }
  }

  return updated;
}

// ============================================================
// 7. Process Message Feedback (thumbs up/down on chat messages)
// ============================================================

interface MessageFeedbackInput {
  user_id: string;
  message_id: string;
  feedback: 'positive' | 'negative';
  category?: string;
}

async function processMessageFeedback(input: MessageFeedbackInput): Promise<{
  processed: boolean;
  rule_updated?: boolean;
}> {
  const supabase = getServiceClient();

  // Look up the message to get context
  const { data: message } = await supabase
    .from('agent_messages')
    .select('id, conversation_id, content, tool_calls, tool_results')
    .eq('id', input.message_id)
    .single();

  if (!message) return { processed: false };

  // Determine the category from tool calls or input
  const toolNames = (message.tool_calls || []).map((tc: any) => tc.name || '').join(' ');
  const category = input.category || inferCategory(toolNames, message.content || '');

  // If negative feedback: update any rules that may have influenced the response
  let ruleUpdated = false;
  if (input.feedback === 'negative') {
    // Check if agent was following a rule that produced a bad result
    const { data: rules } = await supabase
      .from('agent_rules')
      .select('*')
      .eq('user_id', input.user_id)
      .eq('active', true);

    if (rules && rules.length > 0) {
      const messageContent = (message.content || '').toLowerCase();
      for (const rule of rules) {
        // If the message content references concepts from this rule, reduce confidence
        const ruleWords = rule.rule_text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
        const matchingWords = ruleWords.filter((w: string) => messageContent.includes(w));
        if (matchingWords.length >= 3) {
          const newConfidence = Math.max(0, rule.confidence - 0.05);
          await supabase
            .from('agent_rules')
            .update({
              confidence: newConfidence,
              rejections_count: rule.rejections_count + 1,
              active: newConfidence >= 0.3,
            })
            .eq('id', rule.id);
          ruleUpdated = true;
        }
      }
    }
  } else {
    // Positive feedback: boost confidence of any applied rules
    const { data: rules } = await supabase
      .from('agent_rules')
      .select('*')
      .eq('user_id', input.user_id)
      .eq('active', true);

    if (rules && rules.length > 0) {
      const messageContent = (message.content || '').toLowerCase();
      for (const rule of rules) {
        const ruleWords = rule.rule_text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
        const matchingWords = ruleWords.filter((w: string) => messageContent.includes(w));
        if (matchingWords.length >= 3) {
          const newConfidence = Math.min(1, rule.confidence + 0.02);
          await supabase
            .from('agent_rules')
            .update({
              confidence: newConfidence,
              applications_count: rule.applications_count + 1,
            })
            .eq('id', rule.id);
          ruleUpdated = true;
        }
      }
    }
  }

  return { processed: true, rule_updated: ruleUpdated };
}

// ============================================================
// 8. Classify and Learn (error-routed learning)
// ============================================================

type ErrorType = 'FACTUAL_ERROR' | 'REASONING_ERROR' | 'TOOL_MISUSE' | 'CONTEXT_MISSING';

interface ClassifyErrorInput {
  user_id: string;
  error_type: ErrorType;
  tool_name: string;
  error_message: string;
  input_summary: Record<string, unknown>;
  category?: string;
}

/**
 * Generate a specific, actionable rule or guidance using Claude Haiku.
 * Replaces boilerplate template strings with contextual AI-generated guidance.
 */
async function generateErrorGuidance(
  errorType: string,
  toolName: string,
  errorMessage: string,
  inputSummary: Record<string, unknown>,
): Promise<string> {
  try {
    const prompt = `You are a property management AI learning from its mistakes. Write a single, specific, actionable rule to prevent this error from recurring.

Error type: ${errorType}
Tool: ${toolName}
Error: ${errorMessage}
Input: ${JSON.stringify(inputSummary).slice(0, 200)}

Write ONLY the rule text (one sentence, imperative form). Be specific to this exact situation, not generic.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text?.trim();
    if (text && text.length > 10) return text;
  } catch {
    // Fall through to template
  }
  // Fallback template if Haiku fails
  return `When using "${toolName}": ${errorType === 'CONTEXT_MISSING' ? 'verify referenced entities exist first' : 'verify data before execution'}. Error: ${errorMessage.slice(0, 100)}`;
}

/**
 * Check for semantically similar existing rules before creating a new one.
 * Prevents duplicate/conflicting rules from accumulating.
 */
async function checkRuleConflicts(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  newRuleText: string,
): Promise<{ shouldSkip: boolean; conflictId?: string }> {
  try {
    const embedding = await generateEmbedding(newRuleText);
    const { data: similar } = await supabase.rpc('search_similar_rules', {
      query_embedding: formatEmbeddingForStorage(embedding),
      match_user_id: userId,
      match_threshold: 0.75,
      match_count: 3,
    });

    if (similar && similar.length > 0) {
      // Very similar rule exists (>0.85 similarity) — skip creation (dedup)
      const highMatch = similar.find((r: any) => r.similarity > 0.85);
      if (highMatch) {
        return { shouldSkip: true, conflictId: highMatch.id };
      }
      // Moderate match (0.75-0.85) — allow creation but log the conflict
      console.log(`Rule conflict detected: new rule similar to ${similar[0].id} (similarity: ${similar[0].similarity})`);
    }
  } catch {
    // Don't block on conflict check failure
  }
  return { shouldSkip: false };
}

async function classifyAndLearn(input: ClassifyErrorInput): Promise<{
  learned: boolean;
  artifact_type: string;
  artifact_id?: string;
}> {
  const supabase = getServiceClient();
  const category = input.category || inferCategory(input.tool_name, input.error_message);

  switch (input.error_type) {
    case 'FACTUAL_ERROR': {
      // Generate specific rule text via Claude Haiku (not boilerplate)
      const ruleText = await generateErrorGuidance('FACTUAL_ERROR', input.tool_name, input.error_message, input.input_summary);

      // Check for conflicting/duplicate rules before inserting
      const conflict = await checkRuleConflicts(supabase, input.user_id, ruleText);
      if (conflict.shouldSkip) {
        return { learned: false, artifact_type: 'rule_dedup', artifact_id: conflict.conflictId };
      }

      // Generate embedding for the new rule
      let embedding: number[] | null = null;
      try { embedding = await generateEmbedding(ruleText); } catch { /* ok */ }

      const { data: rule } = await supabase
        .from('agent_rules')
        .insert({
          user_id: input.user_id,
          rule_text: ruleText,
          category,
          confidence: 0.50,
          source: 'error_classification',
          active: true,
          applications_count: 0,
          rejections_count: 0,
          ...(embedding ? { embedding: formatEmbeddingForStorage(embedding) } : {}),
        })
        .select('id')
        .single();

      return { learned: true, artifact_type: 'rule', artifact_id: rule?.id };
    }

    case 'REASONING_ERROR': {
      // Generate specific guidance via Claude Haiku
      const guidanceText = await generateErrorGuidance('REASONING_ERROR', input.tool_name, input.error_message, input.input_summary);

      let embedding: number[] | null = null;
      try { embedding = await generateEmbedding(`prompt_guidance reasoning ${category} ${input.tool_name} ${guidanceText}`); } catch { /* ok */ }

      const { data: pref } = await supabase
        .from('agent_preferences')
        .upsert({
          user_id: input.user_id,
          category: 'prompt_guidance',
          preference_key: `reasoning_${category}_${input.tool_name}`,
          preference_value: guidanceText,
          source: 'learned',
          updated_at: new Date().toISOString(),
          ...(embedding ? { embedding: formatEmbeddingForStorage(embedding) } : {}),
        }, { onConflict: 'user_id,property_id,category,preference_key' })
        .select('id')
        .single();

      return { learned: true, artifact_type: 'prompt_guidance', artifact_id: pref?.id };
    }

    case 'TOOL_MISUSE': {
      // Update tool genome parameter insights — record what went wrong
      const { data: genome } = await supabase
        .from('tool_genome')
        .select('parameter_insights, failure_patterns')
        .eq('user_id', input.user_id)
        .eq('tool_name', input.tool_name)
        .single();

      const failurePatterns = genome?.failure_patterns || {};
      const patternKey = input.error_message.slice(0, 80).replace(/[^a-zA-Z0-9_\s]/g, '').trim();
      failurePatterns[patternKey] = (failurePatterns[patternKey] || 0) + 1;

      const paramInsights = genome?.parameter_insights || { success_params: [], failure_params: [] };
      const paramKeys = Object.keys(input.input_summary).sort().join(',');
      const failureArr = paramInsights.failure_params || [];
      failureArr.push(paramKeys);
      if (failureArr.length > 10) failureArr.shift();
      paramInsights.failure_params = failureArr;

      await supabase
        .from('tool_genome')
        .upsert({
          user_id: input.user_id,
          tool_name: input.tool_name,
          failure_patterns: failurePatterns,
          parameter_insights: paramInsights,
          last_error: input.error_message.slice(0, 200),
          last_error_at: new Date().toISOString(),
        }, { onConflict: 'user_id,tool_name' });

      return { learned: true, artifact_type: 'tool_genome_update' };
    }

    case 'CONTEXT_MISSING': {
      // Generate specific context guidance via Claude Haiku
      const contextGuidance = await generateErrorGuidance('CONTEXT_MISSING', input.tool_name, input.error_message, input.input_summary);

      let embedding: number[] | null = null;
      try { embedding = await generateEmbedding(`context_patterns missing_context ${input.tool_name} ${contextGuidance}`); } catch { /* ok */ }

      const { data: pref } = await supabase
        .from('agent_preferences')
        .upsert({
          user_id: input.user_id,
          category: 'context_patterns',
          preference_key: `missing_context_${input.tool_name}`,
          preference_value: contextGuidance,
          source: 'learned',
          updated_at: new Date().toISOString(),
          ...(embedding ? { embedding: formatEmbeddingForStorage(embedding) } : {}),
        }, { onConflict: 'user_id,property_id,category,preference_key' })
        .select('id')
        .single();

      return { learned: true, artifact_type: 'context_pattern', artifact_id: pref?.id };
    }

    default:
      return { learned: false, artifact_type: 'unknown' };
  }
}

// ============================================================
// Server Handler
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    let result: unknown;

    switch (action) {
      case 'record_correction':
        result = await recordCorrection(params as CorrectionInput);
        break;

      case 'process_feedback':
        result = await processFeedback(params as FeedbackInput);
        break;

      case 'process_message_feedback':
        result = await processMessageFeedback(params as MessageFeedbackInput);
        break;

      case 'check_graduation':
        result = await checkGraduation(params as GraduationCheckInput);
        break;

      case 'accept_graduation':
        result = await acceptGraduation(params.user_id, params.category);
        break;

      case 'decline_graduation':
        await declineGraduation(params.user_id, params.category);
        result = { success: true };
        break;

      case 'classify_and_learn':
        result = await classifyAndLearn(params as ClassifyErrorInput);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('agent-learning error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
