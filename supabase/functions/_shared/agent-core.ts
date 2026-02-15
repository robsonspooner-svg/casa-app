// Agent Core — shared intelligence pipeline for Casa agent
// Extracted from agent-chat/index.ts so both agent-chat and agent-orchestrator
// can share the same autonomy, confidence, tool execution, and prompt logic.

import { getServiceClient } from './supabase.ts';
import { CLAUDE_TOOLS, TOOL_META } from './tool-registry.ts';
import { executeToolHandler, classifyToolError } from './tool-dispatcher.ts';
import { generateEmbedding, buildDecisionEmbeddingText, formatEmbeddingForStorage, cosineSimilarity } from './embeddings.ts';

// Re-export classifyToolError so consumers can import from agent-core
export { classifyToolError };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutonomySettings {
  preset: string;
  category_overrides: Record<string, string>;
}

export interface ConfidenceFactors {
  historical_accuracy: number;
  source_quality: number;
  precedent_alignment: number;
  rule_alignment: number;
  golden_alignment: number;
  outcome_track: number;
  composite: number;
}

// ---------------------------------------------------------------------------
// Autonomy Gate
// ---------------------------------------------------------------------------

// Preset defaults map tool-registry categories to max autonomy level the owner
// has pre-approved for that category. The actual per-tool required level comes
// from TOOL_META.autonomyLevel in the registry.
// Tier-based tool access control
export const TIER_TOOL_ACCESS: Record<string, Set<string>> = {
  starter: new Set(['query', 'memory', 'planning', 'action', 'generate']),
  pro: new Set(['query', 'memory', 'planning', 'action', 'generate', 'workflow']),
  hands_off: new Set(['query', 'memory', 'planning', 'action', 'generate', 'workflow', 'external', 'integration']),
};

export const AUTONOMY_PRESET_DEFAULTS: Record<string, Record<string, number>> = {
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

export function parseAutonomyLevel(level: string): number {
  // Convert "L3" -> 3, "L0" -> 0, etc.
  if (typeof level === 'string' && level.startsWith('L')) {
    return parseInt(level.substring(1), 10);
  }
  return parseInt(String(level), 10) || 2;
}

export function getUserAutonomyForCategory(
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

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Tool execution timeout — prevent infinite hangs
  const TOOL_TIMEOUT_MS = 30_000; // 30 seconds max per tool
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      executeToolHandler(toolName, toolInput, userId, supabase),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () =>
          reject(new Error(`Tool "${toolName}" timed out after ${TOOL_TIMEOUT_MS / 1000}s`)),
        );
      }),
    ]);
    return result;
  } catch (err: any) {
    return { success: false, error: err.message || `Tool execution failed: ${toolName}` };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Tool Genome Tracking — EMA-based per-tool performance metrics
// ---------------------------------------------------------------------------

export const GENOME_EMA_ALPHA = 0.15;

export async function updateToolGenome(
  userId: string,
  toolName: string,
  success: boolean,
  durationMs: number,
  input: Record<string, unknown>,
  supabase: ReturnType<typeof getServiceClient>,
  errorMessage?: string,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('tool_genome')
      .select('success_rate_ema, avg_duration_ms, total_executions, total_successes, total_failures, parameter_insights')
      .eq('user_id', userId)
      .eq('tool_name', toolName)
      .single();

    const paramKeys = Object.keys(input || {}).sort().join(',');

    if (existing) {
      const newEma = existing.success_rate_ema * (1 - GENOME_EMA_ALPHA) + (success ? 1 : 0) * GENOME_EMA_ALPHA;
      const newAvgDur = existing.avg_duration_ms * (1 - GENOME_EMA_ALPHA) + durationMs * GENOME_EMA_ALPHA;

      const insights = existing.parameter_insights || { success_params: [], failure_params: [] };
      const bucket = success ? 'success_params' : 'failure_params';
      const arr = insights[bucket] || [];
      arr.push(paramKeys);
      if (arr.length > 5) arr.shift();
      insights[bucket] = arr;

      await supabase.from('tool_genome').update({
        success_rate_ema: Math.round(newEma * 10000) / 10000,
        avg_duration_ms: Math.round(newAvgDur * 100) / 100,
        total_executions: existing.total_executions + 1,
        total_successes: existing.total_successes + (success ? 1 : 0),
        total_failures: existing.total_failures + (success ? 0 : 1),
        parameter_insights: insights,
        ...(success
          ? { last_success_at: new Date().toISOString() }
          : { last_error: errorMessage ? errorMessage.slice(0, 200) : null, last_error_at: new Date().toISOString() }
        ),
      }).eq('user_id', userId).eq('tool_name', toolName);
    } else {
      await supabase.from('tool_genome').insert({
        user_id: userId,
        tool_name: toolName,
        success_rate_ema: success ? 0.9 : 0.5,
        avg_duration_ms: durationMs,
        total_executions: 1,
        total_successes: success ? 1 : 0,
        total_failures: success ? 0 : 1,
        parameter_insights: {
          success_params: success ? [paramKeys] : [],
          failure_params: success ? [] : [paramKeys],
        },
        ...(success
          ? { last_success_at: new Date().toISOString() }
          : { last_error: errorMessage ? errorMessage.slice(0, 200) : null, last_error_at: new Date().toISOString() }
        ),
      });
    }
  } catch (err) {
    console.error('Tool genome update failed:', err);
  }
}

export async function updateCoOccurrence(
  userId: string,
  toolNames: string[],
  success: boolean,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<void> {
  try {
    for (const toolName of toolNames) {
      const { data: genome } = await supabase
        .from('tool_genome')
        .select('co_occurrence')
        .eq('user_id', userId)
        .eq('tool_name', toolName)
        .single();

      if (!genome) continue;

      const coOcc = genome.co_occurrence || {};
      for (const otherTool of toolNames) {
        if (otherTool === toolName) continue;
        if (!coOcc[otherTool]) coOcc[otherTool] = { count: 0, successes: 0 };
        coOcc[otherTool].count += 1;
        if (success) coOcc[otherTool].successes += 1;
      }

      await supabase.from('tool_genome')
        .update({ co_occurrence: coOcc })
        .eq('user_id', userId)
        .eq('tool_name', toolName);
    }
  } catch (err) {
    console.error('Co-occurrence update failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Confidence Calibration — multi-factor weighted confidence scoring
// ---------------------------------------------------------------------------

export const SOURCE_QUALITY_MAP: Record<string, number> = {
  query: 0.95,
  memory: 0.90,
  generate: 0.75,
  action: 0.85,
  external: 0.65,
  integration: 0.60,
  workflow: 0.70,
  planning: 0.80,
};

export async function calculateConfidence(
  userId: string,
  toolName: string,
  supabase: ReturnType<typeof getServiceClient>,
  intentHash?: string,
): Promise<ConfidenceFactors> {
  const meta = TOOL_META[toolName];

  // Run all factor queries in parallel for speed
  const [genomeResult, similarResult, rulesResult, goldenResult, outcomeResult] = await Promise.all([
    // Factor 1: Historical accuracy from tool genome
    supabase.from('tool_genome').select('success_rate_ema, total_executions').eq('user_id', userId).eq('tool_name', toolName).maybeSingle(),

    // Factor 3: Precedent alignment from recent decisions with feedback
    supabase.from('agent_decisions').select('owner_feedback').eq('user_id', userId).eq('tool_name', toolName).not('owner_feedback', 'is', null).order('created_at', { ascending: false }).limit(5),

    // Factor 4: Rule alignment from category-matching active rules
    supabase.from('agent_rules').select('confidence').eq('user_id', userId).eq('active', true).eq('category', meta?.category || 'general').limit(5),

    // Factor 5: Golden path alignment — does this tool appear in a golden trajectory for the current intent?
    intentHash
      ? supabase.from('agent_trajectories').select('tool_sequence').eq('user_id', userId).eq('is_golden', true).eq('intent_hash', intentHash).limit(1)
      : Promise.resolve({ data: null }),

    // Factor 6: Outcome tracking — recent success rate from measured outcomes
    supabase.from('agent_outcomes').select('outcome_type').eq('user_id', userId).eq('tool_name', toolName).order('created_at', { ascending: false }).limit(20),
  ]);

  // Factor 1: Historical accuracy from tool genome
  let historicalAccuracy = 0.8;
  if (genomeResult.data && genomeResult.data.total_executions >= 3) {
    historicalAccuracy = genomeResult.data.success_rate_ema;
  }

  // Factor 2: Source quality from tool category
  const sourceQuality = SOURCE_QUALITY_MAP[meta?.category || 'action'] || 0.7;

  // Factor 3: Precedent alignment from recent decisions with feedback
  let precedentAlignment = 0.7;
  if (similarResult.data && similarResult.data.length >= 2) {
    const approved = similarResult.data.filter((d: any) => d.owner_feedback === 'approved').length;
    precedentAlignment = approved / similarResult.data.length;
  }

  // Factor 4: Rule alignment from category-matching active rules
  let ruleAlignment = 0.8;
  if (rulesResult.data && rulesResult.data.length > 0) {
    ruleAlignment = rulesResult.data.reduce((sum: number, r: any) => sum + r.confidence, 0) / rulesResult.data.length;
  }

  // Factor 5: Golden path alignment — boost if tool is in a golden trajectory
  let goldenAlignment = 0.5; // neutral default
  if (goldenResult.data && goldenResult.data.length > 0) {
    const goldenTools = (goldenResult.data[0].tool_sequence || []).map((s: any) => s.name);
    if (goldenTools.includes(toolName)) {
      goldenAlignment = 1.0; // strong boost — this tool is in the proven best path
    }
  }

  // Factor 6: Outcome tracking — measured success rate from downstream outcomes
  let outcomeTrack = 0.7; // neutral default when no outcomes recorded
  if (outcomeResult.data && outcomeResult.data.length >= 3) {
    const successes = outcomeResult.data.filter((o: any) => o.outcome_type === 'success').length;
    outcomeTrack = successes / outcomeResult.data.length;
  }

  // Composite: 6-factor weighted average
  const composite =
    historicalAccuracy * 0.30 +
    sourceQuality * 0.10 +
    precedentAlignment * 0.20 +
    ruleAlignment * 0.15 +
    goldenAlignment * 0.10 +
    outcomeTrack * 0.15;

  return {
    historical_accuracy: Math.round(historicalAccuracy * 1000) / 1000,
    source_quality: Math.round(sourceQuality * 1000) / 1000,
    precedent_alignment: Math.round(precedentAlignment * 1000) / 1000,
    rule_alignment: Math.round(ruleAlignment * 1000) / 1000,
    golden_alignment: Math.round(goldenAlignment * 1000) / 1000,
    outcome_track: Math.round(outcomeTrack * 1000) / 1000,
    composite: Math.round(composite * 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// Intent Hashing — deterministic hash for trajectory matching
// ---------------------------------------------------------------------------

export function computeIntentHash(userMessage: string, toolsUsed: string[]): string {
  const words = userMessage.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .sort();

  const toolSig = toolsUsed.slice(0, 3).sort().join('+');
  const msgSig = [...new Set(words)].slice(0, 10).join('_');

  const raw = `${msgSig}|${toolSig}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `intent_${Math.abs(hash).toString(36)}`;
}

export function computeIntentLabel(userMessage: string): string {
  return userMessage.length <= 60 ? userMessage : userMessage.substring(0, 57) + '...';
}

// ---------------------------------------------------------------------------
// Context Window Guard — estimate tokens and compact if needed
// ---------------------------------------------------------------------------

export function estimateTokens(text: string): number {
  // ~4 chars per token for English text, conservative estimate
  return Math.ceil(text.length / 3.5);
}

export function estimateMessagesTokens(messages: Array<{ role: string; content: any }>): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text') total += estimateTokens(block.text || '');
        else if (block.type === 'tool_use') total += estimateTokens(JSON.stringify(block.input || {})) + 20;
        else if (block.type === 'tool_result') total += estimateTokens(typeof block.content === 'string' ? block.content : JSON.stringify(block.content || ''));
      }
    }
    total += 5; // message overhead
  }
  return total;
}

export function compactMessages(
  messages: Array<{ role: string; content: any }>,
  maxTokenBudget: number,
): Array<{ role: string; content: any }> {
  // Always keep first 2 messages (initial context) and last 10 messages (recent context)
  if (messages.length <= 12) return messages;

  const keepFirst = 2;
  const keepLast = 10;
  const firstMessages = messages.slice(0, keepFirst);
  const lastMessages = messages.slice(-keepLast);
  const middleMessages = messages.slice(keepFirst, -keepLast);

  // Check if we're within budget with all messages
  const totalEstimate = estimateMessagesTokens(messages);
  if (totalEstimate <= maxTokenBudget) return messages;

  // Compact middle: summarize tool results to just success/error status
  const compactedMiddle: Array<{ role: string; content: any }> = [];
  for (const msg of middleMessages) {
    if (Array.isArray(msg.content)) {
      const compactBlocks = msg.content.map((block: any) => {
        if (block.type === 'tool_result') {
          try {
            const parsed = JSON.parse(block.content);
            return { ...block, content: JSON.stringify({ success: parsed.success, summary: parsed.error || 'completed' }) };
          } catch { return block; }
        }
        return block;
      });
      compactedMiddle.push({ ...msg, content: compactBlocks });
    } else {
      compactedMiddle.push(msg);
    }
  }

  const compactedAll = [...firstMessages, ...compactedMiddle, ...lastMessages];
  const compactedEstimate = estimateMessagesTokens(compactedAll);

  // If still too large, drop middle messages entirely
  if (compactedEstimate > maxTokenBudget) {
    return [
      ...firstMessages,
      { role: 'user', content: '[Earlier conversation history has been compacted to stay within context limits]' },
      ...lastMessages,
    ];
  }

  return compactedAll;
}

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

export async function buildSystemPrompt(
  userId: string,
  supabase: ReturnType<typeof getServiceClient>,
  latestMessage?: string,
  role?: string,
): Promise<string> {
  // Generate embedding for the user's latest message (for auto-memory retrieval)
  let messageEmbedding: number[] | null = null;
  if (latestMessage) {
    try {
      messageEmbedding = await generateEmbedding(latestMessage);
    } catch {
      // Don't block on embedding failure
    }
  }

  if (role === 'tenant') {
    return buildTenantSystemPrompt(userId, supabase);
  }

  // Parallel DB queries — run all independent queries concurrently for speed
  // Use Promise.allSettled so individual query failures don't crash the whole function
  const queryPromises: Promise<any>[] = [
    supabase.from('profiles').select('full_name, email').eq('id', userId).single(),
    supabase.from('properties').select('id, address_line_1, suburb, state, status, rent_amount').eq('owner_id', userId).is('deleted_at', null),
    supabase.from('agent_autonomy_settings').select('preset').eq('user_id', userId).single(),
    supabase.from('agent_rules').select('rule_text, category, confidence, source').eq('user_id', userId).eq('active', true).order('confidence', { ascending: false }).limit(20),
    supabase.from('agent_preferences').select('category, preference_key, preference_value, source').eq('user_id', userId).order('category', { ascending: true }).limit(30),
    supabase.from('agent_trajectories').select('tool_sequence, efficiency_score, intent_label').eq('user_id', userId).eq('is_golden', true).order('efficiency_score', { ascending: false }).limit(8),
    supabase.from('tool_genome').select('tool_name, success_rate_ema, avg_duration_ms, last_error, co_occurrence').eq('user_id', userId).lt('success_rate_ema', 0.7).order('success_rate_ema', { ascending: true }).limit(10),
    supabase.from('tool_genome').select('tool_name, co_occurrence').eq('user_id', userId).not('co_occurrence', 'eq', '{}').limit(20),
  ];

  // Add semantic preference search if we have a message embedding
  if (messageEmbedding) {
    queryPromises.push(
      supabase.rpc('search_similar_preferences', {
        query_embedding: formatEmbeddingForStorage(messageEmbedding),
        match_user_id: userId,
        match_threshold: 0.5,
        match_count: 8,
      })
    );
  }

  const settled = await Promise.allSettled(queryPromises);
  const safeResult = (idx: number) =>
    settled[idx]?.status === 'fulfilled' ? settled[idx].value : { data: null, count: null };

  const { data: profile } = safeResult(0);
  const { data: properties } = safeResult(1);
  const { data: autonomySettings } = safeResult(2);
  const { data: ownerRules } = safeResult(3);
  const { data: ownerPreferences } = safeResult(4);
  const { data: goldenTrajectories } = safeResult(5);
  const { data: toolGenomeWarnings } = safeResult(6);
  const { data: coOccurrenceData } = safeResult(7);
  const relevantPrefs = messageEmbedding && settled[8]?.status === 'fulfilled' ? settled[8].value?.data : null;

  // Second round — depends on properties result
  const propertyIds = (properties || []).map((p: any) => p.id);
  const propertyStates = [...new Set((properties || []).map((p: any) => (p.state || '').toUpperCase()).filter(Boolean))];

  // Guard against empty arrays — PostgREST .in() with [] generates invalid SQL
  let tenancyCount: number | null = 0;
  let tenancyIds: any[] | null = null;
  let regulatoryRules: any[] | null = null;

  if (propertyIds.length > 0) {
    try {
      const round2 = await Promise.allSettled([
        supabase.from('tenancies').select('id', { count: 'exact', head: true }).in('property_id', propertyIds).eq('status', 'active'),
        supabase.from('tenancies').select('id').in('property_id', propertyIds),
        propertyStates.length > 0
          ? supabase
              .from('tenancy_law_rules')
              .select('state, category, rule_key, rule_text, notice_days, notice_business_days, max_frequency_months, max_amount, enforcement_level, agent_action, legislation_ref')
              .in('state', [...propertyStates, 'ALL'])
              .eq('is_active', true)
              .in('enforcement_level', ['mandatory'])
              .order('state')
              .order('category')
          : Promise.resolve({ data: null }),
      ]);
      tenancyCount = round2[0]?.status === 'fulfilled' ? round2[0].value?.count : 0;
      tenancyIds = round2[1]?.status === 'fulfilled' ? round2[1].value?.data : null;
      regulatoryRules = round2[2]?.status === 'fulfilled' ? round2[2].value?.data : null;
    } catch (e) {
      console.warn('[buildSystemPrompt] round 2 queries failed:', e);
    }
  }

  // Third round — depends on tenancy IDs
  const tenancyIdList = (tenancyIds || []).map((t: any) => t.id);
  let arrearsData: any[] | null = null;
  if (tenancyIdList.length > 0) {
    try {
      const r = await supabase
        .from('arrears_records')
        .select('total_overdue')
        .eq('is_resolved', false)
        .in('tenancy_id', tenancyIdList);
      arrearsData = r.data;
    } catch (e) {
      console.warn('[buildSystemPrompt] arrears query failed:', e);
    }
  }

  const arrearsCount = arrearsData?.length || 0;
  const arrearsTotal = (arrearsData || []).reduce(
    (sum: number, a: any) => sum + (a.total_overdue || 0), 0,
  );

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
${(ownerRules && ownerRules.length > 0) ? `
Owner rules (MUST follow — these are learned from past corrections and explicit instructions):
${ownerRules.map((r: any) => `  - [${r.category}] ${r.rule_text} (confidence: ${r.confidence}, source: ${r.source})`).join('\n')}
` : ''}${(ownerPreferences && ownerPreferences.length > 0) ? `
Owner preferences (follow when relevant):
${ownerPreferences.map((p: any) => `  - [${p.category}] ${p.preference_key}: ${typeof p.preference_value === 'string' ? p.preference_value : JSON.stringify(p.preference_value)}`).join('\n')}
` : ''}
Core capabilities:
- PROPERTY SETUP: Owners can set up properties entirely through conversation. Collect address details, then ask about bedrooms, bathrooms, parking, floor area, rent, bond, etc. Create the property via the create_property tool.
- TENANT FINDING: Create listings, generate compelling copy, publish to portals, score and rank applications, shortlist and approve tenants.
- RENT MANAGEMENT: Track payments, detect arrears early, send reminders, escalate through formal → breach → tribunal, create payment plans.
- MAINTENANCE: Create requests, triage urgency, find local trades, get quotes, compare quotes, approve and track work orders through completion.
- INSPECTIONS: Schedule entry/routine/exit inspections, generate reports, compare entry vs exit condition.
- FINANCIAL: Generate income/expense summaries, tax reports, track transactions, analyse rent vs market.
- COMPLIANCE: Track smoke alarms, gas safety, pool fences, electrical checks — record completions and flag overdue items. You have access to a comprehensive tenancy law database via check_regulatory_requirements and get_tenancy_law tools.
- REGULATORY GUARDIAN: You are the owner's compliance shield. You MUST proactively enforce all tenancy law. NEVER allow an action that violates state regulation. Before ANY rent increase, inspection, bond action, termination notice, or entry — automatically check the applicable law. If a landlord asks to do something non-compliant, explain WHY it's not allowed and what the correct approach is. Prompt the landlord to complete physical obligations they must do (install locks, fix safety items, etc).
- EXTERNAL: Search the web for regulations/market info, find local tradespeople, parse business details, create service provider cards, request quotes automatically.
- WORKFLOWS: Execute multi-step processes — find tenant, onboard tenant, end tenancy, maintenance lifecycle, arrears escalation.
- MEMORY: Remember owner preferences and past decisions to improve over time.
- PROPERTY INTELLIGENCE: Calculate and track property health scores (0-100) across maintenance, financials, compliance, tenant satisfaction, and market position. Predict vacancy risk and maintenance costs. Generate actionable improvement plans per property.
- PORTFOLIO WEALTH: Monthly portfolio snapshots tracking total value, equity, yields, occupancy, and growth trends. Generate professional investment-grade wealth reports with projections. Calculate ROI metrics (gross yield, net yield, cash-on-cash return).
- TENANT RETENTION: Score tenant satisfaction and predict renewal probability. Flag at-risk tenants early based on maintenance response times, payment reliability, and communication patterns. Proactively suggest retention strategies.
- PREDICTIVE MAINTENANCE: Analyse maintenance history to predict recurring issues and estimate future costs. Flag infrastructure concerns based on property age (hot water systems, roofing, electrical). Generate preventive maintenance schedules.
- MARKET INTELLIGENCE: Track suburb-level rental market data — median rents, vacancy rates, demand/supply balance, days on market. Alert when market rents shift significantly. Advise on optimal rent pricing relative to market.

Features coming soon (not yet available — when asked, provide the workaround):
- Listing syndication to Domain/REA: "I can draft your listing content for you to copy into Domain's or realestate.com.au's portal directly. Want me to prepare it?"
- Automated credit/TICA checks: "I can help you outline what to check and provide the TICA portal link (tica.com.au) for you to run the check manually."
- DocuSign document signing: "I can draft the document content. For now, you'll need to send it via email or print for signing."
- Automated bond lodgement: "I can prepare the bond details. Here's the link to your state's bond authority for lodgement."
- hipages trade search: "I can search for local tradespeople using other methods and add them to your network."
- Automated rent collection via Stripe: "I can track rent manually and send reminders. Automated Stripe collection is coming soon."
- Automated refunds via Stripe: "I can help calculate refund amounts and provide details for you to process manually."

When the owner asks about any of these, always offer a helpful manual workaround rather than just saying it's unavailable.

New conversation behaviour:
When this is the first message in a new conversation, start with a brief, contextual greeting that shows awareness of the owner's portfolio. Include proactive observations about things that need attention — like an executive assistant giving a morning briefing:
- Mention upcoming lease expiries (within 90 days)
- Flag unresolved maintenance requests
- Note any arrears or overdue payments
- Highlight upcoming inspection deadlines
Only mention items that genuinely need attention. If everything looks good, say something like "Everything looks good across your properties. How can I help?" Keep it concise — 2-4 bullet points maximum. Then address their actual question.

Guidelines:
1. Be proactive, concise, and action-oriented. When you see issues, propose solutions with specific actions.
2. Always use tools to get current data rather than making assumptions. Never fabricate data.
3. When an action requires approval, explain clearly what you want to do and why.
4. Format responses as plain text only. Do NOT use Markdown formatting (no headings with #, no bold with asterisks, no code blocks). Use plain bullet points for lists and line breaks for structure.
5. Always use Australian English (e.g. "colour", "organise", "centre").
6. When discussing money, use Australian dollars with $ symbol.
7. For dates, use DD/MM/YYYY format.
8. Be warm but professional — like a capable property manager who genuinely cares about the owner's success. Use first person ("I'll look into that", "Let me check"). Refer to tenants and owners by name. Never say "I'm just an AI" — act like a capable property management partner.
9. If a tool returns data with an "instruction" field, follow that instruction to generate content using the data provided.
10. When a tool returns an error saying it is "not yet wired up", acknowledge this to the owner and offer a manual workaround. Do not pretend it worked.
11. For property setup via conversation: collect the minimum required fields first (address, suburb, state, postcode), create the property, then ask about additional details to fill in.
12. When finding trades: ALWAYS use the find_local_trades or web_search tool to search for tradespeople. Never just describe what you could do — actually perform the search. After getting results, ALWAYS call create_service_provider for each business found to add them to the owner's network so they appear as service provider cards. Extract business_name, trade_type, and phone at minimum. If you have a URL, use parse_business_details first to get full details (ABN, email, license). Only skip creating service providers if the owner explicitly says they just want to see options without adding them.
13. Think in workflows, not isolated actions. If an owner says "my tenant hasn't paid rent", consider: check arrears → check payment history → draft reminder → offer escalation options.
14. When a property, tenant, or record is not found: clearly say "I couldn't find [X]" or "there is no [X] in your portfolio". Do not just list what does exist — explicitly state the requested item was not found.
15. When the owner asks you to remember a preference, ALWAYS use the remember tool to store it. Confirm what you stored.
16. When the owner asks you to find, search for, or locate tradespeople, services, or businesses: ALWAYS use find_local_trades or web_search to perform a real search. Do not just offer to search — do it. After finding results, call create_service_provider for each business to populate their service provider cards in the app.
17. In cautious mode, ALWAYS attempt to use the appropriate action tool for the request — even if it will be gated. This creates a pending action the owner can approve. Do not avoid calling action tools just because they might need approval.
18. For vague maintenance reports (e.g. "there's a problem with the tap"), ask what the actual issue is (leaking? dripping? broken handle? won't turn off?) before creating a request. You need to understand the severity to set the right urgency level. Don't assume urgency — ask.
19. For financial actions (rent changes, payment plans, bond adjustments), always confirm the details with the owner before executing. State what you will do and ask "Shall I go ahead?" — do not immediately execute financial changes from a single message expressing intent.
20. DOCUMENTS: Whenever you generate a document (lease, notice, report, etc.), ALWAYS save it using create_document with the correct property_id and tenancy_id. After saving, use suggest_navigation to let the owner view it. If the document is for a tenant (lease, notice, inspection report), offer to send it to the tenant using submit_document_email. If the owner confirms, send it immediately. Every generated document must end up saved in the owner's documents tab — never generate content without persisting it.
21. NAVIGATION: After creating or looking up a resource, use suggest_navigation to show the user a button they can tap to go to the relevant screen. Available routes:
  - /(app)/properties/[id] (params: { id }) — Property detail
  - /(app)/properties/add — Add new property
  - /(app)/tenancies/[id]/edit (params: { id }) — Tenancy detail
  - /(app)/tenancies/create — Create tenancy
  - /(app)/listings/[id] (params: { id }) — Listing detail
  - /(app)/listings/create — Create listing
  - /(app)/maintenance/[id] (params: { id }) — Maintenance request
  - /(app)/inspections/[id] (params: { id }) — Inspection detail
  - /(app)/inspections/schedule — Schedule inspection
  - /(app)/payments — Payments list
  - /(app)/payments/[id] (params: { id }) — Payment detail
  - /(app)/arrears — Arrears dashboard
  - /(app)/arrears/[id] (params: { id }) — Arrears detail
  - /(app)/documents — Documents list
  - /(app)/documents/[id] (params: { id }) — Document detail
  - /(app)/trades — Trades network
  - /(app)/trades/[id] (params: { id }) — Trade detail
  - /(app)/work-orders/[id] (params: { id }) — Work order
  - /(app)/connections — Connections / tenant invites
  - /(app)/reports — Reports dashboard
  - /(app)/reports/financial — Financial report
  - /(app)/reports/tax — Tax report
  - /(app)/(tabs) — Home dashboard
  - /(app)/settings/subscription — Subscription
  - /(app)/profile — User profile${(goldenTrajectories && goldenTrajectories.length > 0) ? `

Golden tool paths (proven efficient approaches — prefer these sequences for similar requests):
${goldenTrajectories.map((t: any) => {
  const seq = Array.isArray(t.tool_sequence) ? t.tool_sequence.map((s: any) => s.name).join(' → ') : '';
  const label = t.intent_label || 'general';
  return `  - "${label}": ${seq} (score: ${t.efficiency_score})`;
}).join('\n')}` : ''}${(toolGenomeWarnings && toolGenomeWarnings.length > 0) ? `

Tool performance warnings (these tools have been unreliable recently — use with extra care or try alternatives):
${toolGenomeWarnings.map((g: any) =>
  `  - ${g.tool_name}: ${Math.round(g.success_rate_ema * 100)}% success rate, avg ${Math.round(g.avg_duration_ms)}ms${g.last_error ? `. Last error: ${g.last_error.slice(0, 80)}` : ''}`
).join('\n')}` : ''}${(() => {
  // Extract top tool pairs from co-occurrence data
  if (!coOccurrenceData || coOccurrenceData.length === 0) return '';
  const pairs: Array<{ tools: string; successRate: number; count: number }> = [];
  for (const genome of coOccurrenceData) {
    const coOcc = genome.co_occurrence || {};
    for (const [otherTool, stats] of Object.entries(coOcc)) {
      const s = stats as { count: number; successes: number };
      if (s.count >= 3) {
        pairs.push({
          tools: `${genome.tool_name} + ${otherTool}`,
          successRate: s.count > 0 ? s.successes / s.count : 0,
          count: s.count,
        });
      }
    }
  }
  // Deduplicate (A+B same as B+A) and sort by success rate
  const seen = new Set<string>();
  const unique = pairs.filter(p => {
    const parts = p.tools.split(' + ').sort().join('+');
    if (seen.has(parts)) return false;
    seen.add(parts);
    return true;
  }).sort((a, b) => b.successRate - a.successRate).slice(0, 5);
  if (unique.length === 0) return '';
  return `\n\nEffective tool combinations (proven to work well together):
${unique.map(p => `  - ${p.tools}: ${Math.round(p.successRate * 100)}% success rate (${p.count} uses)`).join('\n')}`;
})()}${(() => {
  // Auto-inject semantically relevant preferences for this conversation
  if (!relevantPrefs || relevantPrefs.length === 0) return '';
  return `\n\nRelevant context for this conversation (auto-retrieved from owner preferences):
${relevantPrefs.map((p: any) => `  - [${p.category}] ${p.preference_key}: ${typeof p.preference_value === 'string' ? p.preference_value : JSON.stringify(p.preference_value)} (relevance: ${Math.round((p.similarity || 0) * 100)}%)`).join('\n')}`;
})()}${(() => {
  // Inject state-specific tenancy law rules for the owner's property states
  if (!regulatoryRules || regulatoryRules.length === 0) return '';
  // Group rules by state then category
  const byState: Record<string, Record<string, Array<{ rule_key: string; rule_text: string; notice_days: number | null; max_frequency_months: number | null; max_amount: number | null; agent_action: string | null; legislation_ref: string | null }>>> = {};
  for (const r of regulatoryRules) {
    if (!byState[r.state]) byState[r.state] = {};
    if (!byState[r.state][r.category]) byState[r.state][r.category] = [];
    byState[r.state][r.category].push(r);
  }
  let section = '\n\nSTATE-SPECIFIC TENANCY LAW (MANDATORY — you MUST enforce these rules):';
  for (const [state, categories] of Object.entries(byState)) {
    section += `\n\n${state}:`;
    for (const [category, rules] of Object.entries(categories)) {
      section += `\n  ${category.replace(/_/g, ' ').toUpperCase()}:`;
      for (const rule of rules) {
        let line = `    - ${rule.rule_text}`;
        if (rule.notice_days) line += ` [${rule.notice_days} days notice]`;
        if (rule.max_frequency_months) line += ` [max every ${rule.max_frequency_months} months]`;
        if (rule.max_amount) line += ` [max ${rule.max_amount} weeks rent]`;
        if (rule.agent_action) line += ` → Agent: ${rule.agent_action}`;
        section += `\n${line}`;
      }
    }
  }
  section += '\n\nCRITICAL COMPLIANCE RULES:';
  section += '\n1. NEVER allow a rent increase that violates frequency limits — hard block the action and explain.';
  section += '\n2. ALWAYS check entry notice periods before scheduling inspections — warn if insufficient notice.';
  section += '\n3. NEVER allow bond amounts exceeding state limits — hard block and state the maximum.';
  section += '\n4. PROACTIVELY remind owners of upcoming compliance deadlines — do not wait to be asked.';
  section += '\n5. When a landlord needs to do something physical (install locks, fix safety items, attend tribunal), tell them clearly and give them the deadline.';
  section += '\n6. Use check_regulatory_requirements or get_tenancy_law tools for detailed lookups when needed.';
  return section;
})()}`;
}

// ---------------------------------------------------------------------------
// Tenant System Prompt Builder
// ---------------------------------------------------------------------------

async function buildTenantSystemPrompt(
  userId: string,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<string> {
  // Get tenant profile
  const { data: profile } = await supabase.from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  // Get tenant's linked tenancies via tenancy_tenants
  const { data: tenantLinks } = await supabase
    .from('tenancy_tenants')
    .select('tenancy_id')
    .eq('tenant_id', userId);

  const tenancyIds = (tenantLinks || []).map((t: any) => t.tenancy_id);

  let tenancyContext = '';
  if (tenancyIds.length > 0) {
    // Get tenancy details with property info
    const { data: tenancies } = await supabase
      .from('tenancies')
      .select('id, property_id, lease_start_date, lease_end_date, rent_amount, rent_frequency, bond_amount, status')
      .in('id', tenancyIds)
      .eq('status', 'active');

    if (tenancies && tenancies.length > 0) {
      const propertyIds = tenancies.map((t: any) => t.property_id);
      const { data: properties } = await supabase
        .from('properties')
        .select('id, address_line_1, suburb, state')
        .in('id', propertyIds);

      const propertyMap = new Map((properties || []).map((p: any) => [p.id, p]));

      // Get upcoming rent
      const { data: rentSchedule } = await supabase
        .from('rent_schedule')
        .select('amount, due_date, status')
        .in('tenancy_id', tenancyIds)
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true })
        .limit(3);

      // Get active maintenance requests
      const { data: maintenanceRequests } = await supabase
        .from('maintenance_requests')
        .select('title, status, urgency, created_at')
        .in('property_id', propertyIds)
        .in('status', ['reported', 'in_progress', 'awaiting_quote'])
        .order('created_at', { ascending: false })
        .limit(5);

      const tenancyLines = tenancies.map((t: any) => {
        const prop = propertyMap.get(t.property_id);
        const addr = prop ? `${prop.address_line_1}, ${prop.suburb} ${prop.state}` : 'Unknown property';
        return `  - ${addr}: $${t.rent_amount}/${t.rent_frequency}, lease ${t.lease_start_date || '?'} to ${t.lease_end_date || '?'}`;
      }).join('\n');

      const rentLines = (rentSchedule || []).map((r: any) =>
        `  - $${r.amount} due ${r.due_date} (${r.status})`
      ).join('\n');

      const maintenanceLines = (maintenanceRequests || []).map((m: any) =>
        `  - ${m.title} (${m.status}, ${m.urgency})`
      ).join('\n');

      tenancyContext = `
Your tenancies:
${tenancyLines}
${rentLines ? `\nUpcoming rent:\n${rentLines}` : ''}
${maintenanceLines ? `\nActive maintenance:\n${maintenanceLines}` : ''}`;
    }
  }

  const tenantName = profile?.full_name || 'there';

  return `You are Casa, a helpful AI assistant for tenants. You help ${tenantName} with questions about their tenancy.
${tenancyContext || '\nNo linked tenancies found yet. The tenant can connect by sharing their 6-character connection code from their landlord.'}

TOOLS:
You have the following tools available. Use them proactively to answer tenant questions:

- get_my_tenancy — Get the tenant's active tenancy details (property, rent, lease dates, landlord info). Use when the tenant asks about their lease, property, rent details, or landlord.
- get_my_payments — Get payment history and upcoming rent schedule. Use when the tenant asks about payments, rent due dates, or payment status.
- get_my_arrears — Get any outstanding arrears. Use when the tenant asks about overdue rent, arrears, or amounts owed.
- get_my_documents — Get documents shared with the tenant. Use when the tenant asks about their lease document, notices, inspection reports, or any documents.
- request_maintenance — Submit a maintenance request. Use when the tenant wants to report a repair, something broken, or an issue at the property. Ask for details (what, where, urgency) then submit.
- get_my_maintenance — Get the tenant's maintenance requests and statuses. Use when the tenant asks about the status of their repairs or maintenance requests.
- send_message_to_owner — Send a message to the property owner. Use when the tenant wants to communicate with their landlord/property manager.
- tenant_connect_with_code — Connect to a property using a 6-character code from the landlord.
- suggest_navigation — Show a navigation button to a specific app screen.

CONNECTION CODES:
If a tenant types what looks like a 6-character alphanumeric code (e.g. "ABC123", "XK9F2L") or says something like "my code is ABC123" or "connect me with ABC123", use the tenant_connect_with_code tool immediately to link their account. After a successful connection, use suggest_navigation to show a button to their home screen.

NAVIGATION:
After helping a tenant, use suggest_navigation to show them a button to the relevant screen.
Available tenant routes:
  - /(app)/(tabs) — Home
  - /(app)/(tabs)/chat — Chat with Casa AI
  - /(app)/maintenance — Maintenance requests
  - /(app)/(tabs)/rent — Rent & payments
  - /(app)/settings — Settings
  - /(app)/profile — Profile

Guidelines:
1. Be friendly, helpful, and concise.
2. Use Australian English.
3. For dates, use DD/MM/YYYY format.
4. For money, use Australian dollars with $ symbol.
5. Format responses as plain text only. Do NOT use Markdown formatting.
6. Never fabricate data — only use data returned from tools.
7. Use tools proactively: when a tenant asks "how much is my rent?", call get_my_tenancy rather than just checking context. Tools return live data.
8. If asked about something you have no tool for, suggest they check the relevant section of the app or contact their property manager.
9. If the tenant has no linked property, proactively ask if they have a connection code from their landlord.
10. When submitting maintenance requests, gather the title, description, category, and urgency before calling request_maintenance. If the tenant gives a vague description like "tap is broken", ask clarifying questions (which tap? kitchen/bathroom? is it dripping or not turning off?) before submitting.`;
}

// ---------------------------------------------------------------------------
// Conversation History
// ---------------------------------------------------------------------------

export async function loadConversationHistory(
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
// Inline Correction Detection
// ---------------------------------------------------------------------------

export const CORRECTION_PATTERNS = /\b(no[,.]?\s+(don't|do not|instead|actually|rather)|that'?s (wrong|incorrect|not right)|don't (do that|send|contact|use)|stop (doing|sending)|never (do|send|contact)|wrong (trade|plumber|electrician|person|company)|use \w+ instead|I (said|meant|wanted)|not what I (asked|wanted|meant))\b/i;

/**
 * Detect when a user message contradicts or corrects the agent's previous action.
 * Fires asynchronously to the learning pipeline — does not block chat response.
 */
export function detectAndRecordCorrection(
  userId: string,
  conversationId: string,
  userMessage: string,
  supabase: ReturnType<typeof getServiceClient>,
): void {
  if (!CORRECTION_PATTERNS.test(userMessage)) return;

  // Fire and forget — find the most recent agent action in this conversation
  (async () => {
    try {
      // Get the last assistant message with tool calls in this conversation
      const { data: recentMessages } = await supabase
        .from('agent_messages')
        .select('content, tool_calls')
        .eq('conversation_id', conversationId)
        .eq('role', 'assistant')
        .not('tool_calls', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!recentMessages || recentMessages.length === 0) return;

      const lastAssistant = recentMessages[0];
      const toolCalls = lastAssistant.tool_calls as Array<{ name: string; input?: Record<string, unknown> }> | null;
      if (!toolCalls || toolCalls.length === 0) return;

      const lastToolCall = toolCalls[toolCalls.length - 1];
      const originalAction = `${lastToolCall.name}: ${lastToolCall.input ? JSON.stringify(lastToolCall.input).substring(0, 200) : ''}`;

      // Send to learning pipeline as a correction
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-learning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          action: 'record_correction',
          user_id: userId,
          original_action: originalAction,
          correction: userMessage,
          context_snapshot: {
            conversation_id: conversationId,
            tool_name: lastToolCall.name,
            tool_input: lastToolCall.input,
            detection_method: 'inline_chat_pattern',
          },
        }),
      }).catch((err) => {
        console.warn('[correction-detect] failed to send to learning pipeline:', err);
      });
    } catch (err) {
      console.warn('[correction-detect] detection error:', err);
    }
  })();
}
