# Mission 15: Learning Engine & Compliance

> **This is Casa's competitive moat.** After 3 months of use, each owner's agent is uniquely optimised to their management style. No competitor can replicate an agent that has learned 200+ owner-specific preferences, built a library of precedent decisions, and graduated its own autonomy through trust-building. This mission activates that flywheel.

## Overview
**Goal**: Activate the full learning pipeline (corrections to rules to autonomy graduation), implement pgvector-powered precedent retrieval, build the Rule Management UI, and ensure owners stay compliant with state-specific tenancy laws via proactive agent-driven compliance scheduling.

**Dependencies**: Mission 14 (AI Orchestrator — Phases A-H must be COMPLETE, specifically: trajectory recording, correction endpoint, pgvector embeddings populating)

**Estimated Complexity**: Critical (this is the intelligence layer that differentiates Casa from every other property management tool)

---

## Why This Mission Matters

Traditional property management software is static — it does exactly what you tell it, forever. Casa's learning engine makes the agent **smarter with every interaction**:

1. **Correction-to-Rule Pipeline**: Owner corrections become permanent behavioral rules. The agent never makes the same mistake twice.
2. **Precedent-Based Decisions**: Every past decision is embedded and searchable. When facing a new situation, the agent finds similar past decisions and applies the same logic.
3. **Autonomy Graduation**: Trust builds over time. The agent starts cautious (asking permission for everything) and gradually earns autonomy as the owner approves its decisions.
4. **Proactive Compliance**: The agent knows every state-specific compliance deadline and schedules checks before they're due — something most human property managers forget.

The result: an agent that manages properties better the longer you use it, creating a switching cost that no competitor can overcome.

---

## Success Criteria

### Phase A: Database Schema (Compliance)
- [ ] Create `compliance_requirements` table (templates per state)
- [ ] Create `property_compliance` table (tracking per property)
- [ ] Create `compliance_reminders` table (sent reminders log)
- [ ] Create `learning_content` table
- [ ] Create `user_learning_progress` table
- [ ] Create `regulatory_updates` table
- [ ] Set up RLS policies for all tables
- [ ] Verify all agent learning tables exist from Mission 14 migration (`agent_decisions`, `agent_corrections`, `agent_rules`, `agent_preferences`, `agent_trajectories`)

### Phase B: Learning Pipeline — Correction-to-Rule Engine
- [ ] Implement correction recording endpoint (owner approves/rejects/corrects agent action)
- [ ] Store corrections in `agent_corrections` with full context snapshot
- [ ] Implement pattern detection: 3+ similar corrections trigger rule generation
- [ ] Claude generates rule text from correction patterns (via dedicated prompt)
- [ ] Rules stored in `agent_rules` (confidence starts at 0.7)
- [ ] Active rules injected into agent system prompt for future calls
- [ ] Rule confidence grows with successful applications (+0.05 per approval, max 1.0)
- [ ] Rule confidence decays with rejections (-0.15 per rejection, deactivation at 0.3)
- [ ] Rule categorisation (communication, maintenance, financial, scheduling, tenant_relations, compliance, general)

### Phase C: pgvector Memory Retrieval
- [ ] Implement embedding generation for every `agent_decisions` record
- [ ] Implement `search_precedent` tool: cosine similarity search on `agent_decisions.embedding`
- [ ] Top 3 precedents injected into context for similar new decisions
- [ ] Embedding generation happens asynchronously after tool execution (non-blocking)
- [ ] Precedent display: show reasoning, outcome, and owner feedback from matched decisions
- [ ] Implement `remember` tool: store explicit preference with embedding
- [ ] Implement `recall` tool: retrieve preferences via semantic search

### Phase D: Autonomy Graduation
- [ ] Track approval rate per tool category in `agent_decisions`
- [ ] After N consecutive approvals (configurable, default 10) with 0 rejections, suggest autonomy upgrade
- [ ] Graduation suggestion appears as a chat message: "You've approved N maintenance actions in a row. Want me to handle these automatically?"
- [ ] Owner can accept (autonomy level increases for that category) or decline
- [ ] If owner declines, agent waits another N approvals before suggesting again (backoff doubles: 10 → 20 → 40)
- [ ] Graduation resets if owner rejects or corrects an action in that category
- [ ] Display graduation progress in Autonomy Settings screen

### Phase E: Compliance Engine
- [ ] Define compliance requirements by state (NSW, VIC, QLD, SA, WA, TAS, NT, ACT)
- [ ] Track compliance status per property (compliant / overdue / upcoming / exempt)
- [ ] Smoke alarm checks (annual all states; per-tenancy QLD)
- [ ] Pool safety certificates (triennial QLD, non-standard registration NSW/VIC)
- [ ] Gas safety checks (biennial VIC, not required others unless gas appliances)
- [ ] Electrical safety switch (biennial QLD)
- [ ] Building insurance tracking (annual all states)
- [ ] Agent proactively schedules compliance checks via heartbeat scanner
- [ ] Compliance calendar per property (next 12 months view)
- [ ] Auto-create compliance tracking records when property is added

### Phase F: Compliance Dashboard & Reminders
- [ ] Create ComplianceScreen (owner app) with property-grouped view
- [ ] Show compliance status with colour indicators (green/amber/red)
- [ ] Highlight overdue items with days-overdue count
- [ ] Upcoming compliance deadlines (next 90 days)
- [ ] Quick action to record compliance completion with evidence upload
- [ ] Automated reminders before due dates (30, 14, 7, 1 day)
- [ ] Escalating reminder urgency (info → warning → critical)
- [ ] Agent chat message for critical compliance items

### Phase G: Rule Management UI
- [ ] Settings → Casa Rules screen: list of all learned rules
- [ ] Each rule card shows: rule text, category badge, confidence %, times applied, times rejected
- [ ] Owner can activate/deactivate rules via toggle
- [ ] Owner can edit rule text inline
- [ ] Owner can delete rules (with confirmation)
- [ ] Owner can manually add rules: free-text input with category picker
- [ ] Manual rules created with source='explicit' and confidence=1.0
- [ ] Rules sorted by: active first, then by confidence descending
- [ ] Empty state: "Casa will learn your preferences as you use it. Rules will appear here automatically."

### Phase H: Learning Content & Regulatory Updates
- [ ] Create article/guide system with markdown rendering
- [ ] State-specific content (NSW, VIC, QLD)
- [ ] Categories (getting started, legal, financial, maintenance, tenant relations)
- [ ] Search functionality across content
- [ ] Bookmarking
- [ ] Interactive checklists with progress tracking
- [ ] Track tenancy law changes (regulatory updates)
- [ ] Notify affected owners of regulatory changes
- [ ] Explain impact and required actions

### Phase I: Trajectory Optimisation
- [ ] Compare new trajectories against similar past ones via pgvector
- [ ] Score efficiency (fewer tools = higher score for same outcome)
- [ ] Feed efficient trajectories into context for similar future requests
- [ ] Prune low-efficiency trajectory patterns after 30 days
- [ ] Surface efficiency improvements to owner: "I completed this 30% faster than last time"

### Phase J: Proactive Intelligence
- [ ] Agent suggests actions based on learned patterns
- [ ] "You usually send a rent reminder on day 2 — should I auto-send?"
- [ ] Surface insights from trajectory data ("Maintenance costs are 30% lower this quarter")
- [ ] Anomaly detection from historical data (unusual payment patterns, high vacancy)
- [ ] Weekly digest of agent learnings and efficiency gains

### Phase K: Testing
- [ ] Unit tests for rule generation pipeline
- [ ] Unit tests for precedent search (pgvector cosine similarity)
- [ ] Unit tests for autonomy graduation logic
- [ ] Unit tests for compliance date calculations (state-specific)
- [ ] Integration tests for correction → rule → prompt injection flow
- [ ] Integration tests for compliance reminders
- [ ] E2E test: Owner corrects agent → rule generated → rule appears in settings
- [ ] E2E test: View compliance → Record completion with evidence

---

## 1. Learning Pipeline: Correction-to-Rule Engine (The Core Loop)

This is the heart of Casa's competitive moat. Every owner interaction makes the agent smarter.

### 1.1 The Full Pipeline

```
Owner performs action OR agent suggests action
    |
    v
Owner provides feedback: APPROVED / REJECTED / CORRECTED
    |
    +--- APPROVED ----> Increment approval count for tool category
    |                   Record in agent_decisions (owner_feedback='approved')
    |                   Update confidence on any matching rule (+0.05)
    |                   Check graduation eligibility
    |
    +--- REJECTED ----> Record in agent_decisions (owner_feedback='rejected')
    |                   Reset consecutive approval count for category
    |                   Decay confidence on any matching rule (-0.15)
    |                   If rule confidence < 0.3, deactivate rule
    |
    +--- CORRECTED ---> Record in agent_decisions (owner_feedback='corrected')
                        Store correction in agent_corrections (with full context)
                        Reset consecutive approval count for category
                        Run pattern detection...
                            |
                            v
                        3+ similar corrections in same category?
                            |
                            +--- NO ---> Wait for more data
                            |
                            +--- YES --> Generate rule via Claude
                                            |
                                            v
                                        Rule stored in agent_rules
                                        (confidence: 0.7, source: 'correction_pattern')
                                            |
                                            v
                                        Rule injected into system prompt
                                        for ALL future calls for this owner
                                            |
                                            v
                                        Confidence increases with approvals
                                            |
                                            v
                                        After 5+ approvals, 0 rejections:
                                        Suggest autonomy level upgrade
```

### 1.2 Pattern Detection Algorithm

Pattern detection runs after every correction is stored. The algorithm:

```typescript
async function detectCorrectionPattern(
  userId: string,
  newCorrection: AgentCorrection
): Promise<AgentRule | null> {

  // 1. Find similar corrections for this user
  const similarCorrections = await supabase
    .from('agent_corrections')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_matched', false)
    .order('created_at', { ascending: false })
    .limit(50);

  // 2. Group by category (inferred from original_action context)
  const category = inferCategory(newCorrection.original_action);

  const categoryCorrections = similarCorrections.data.filter(c =>
    inferCategory(c.original_action) === category
  );

  // 3. Check for semantic similarity using embeddings
  // Corrections with cosine similarity > 0.85 are "similar"
  const semanticallySimilar = await findSemanticallySimilar(
    newCorrection.context_snapshot,
    categoryCorrections,
    threshold: 0.85
  );

  // 4. If 3+ similar corrections exist, generate a rule
  if (semanticallySimilar.length >= 3) {
    const rule = await generateRuleFromCorrections(
      userId,
      semanticallySimilar,
      category
    );

    // Mark corrections as pattern-matched
    await supabase
      .from('agent_corrections')
      .update({ pattern_matched: true })
      .in('id', semanticallySimilar.map(c => c.id));

    return rule;
  }

  return null;
}
```

### 1.3 Rule Generation via Claude

When a pattern is detected, Claude generates a concise, actionable rule:

```typescript
async function generateRuleFromCorrections(
  userId: string,
  corrections: AgentCorrection[],
  category: string
): Promise<AgentRule> {

  const prompt = `You are analysing patterns in an owner's corrections to their AI property manager.

The owner has corrected the agent ${corrections.length} times in similar situations:

${corrections.map((c, i) => `
Correction ${i + 1}:
- Agent's action: ${c.original_action}
- Owner's correction: ${c.correction}
- Context: ${JSON.stringify(c.context_snapshot)}
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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  });

  const ruleText = response.content[0].text.trim();

  // Store the rule
  const { data: rule } = await supabase
    .from('agent_rules')
    .insert({
      user_id: userId,
      rule_text: ruleText,
      category: category,
      confidence: 0.70,
      source: 'correction_pattern',
      correction_ids: corrections.map(c => c.id),
      applications_count: 0,
      rejections_count: 0,
      active: true
    })
    .select()
    .single();

  return rule;
}
```

### 1.4 Rule Injection into System Prompt

Active rules are loaded during context assembly and injected into every agent call:

```typescript
function injectRulesIntoPrompt(
  basePrompt: string,
  rules: AgentRule[]
): string {
  if (rules.length === 0) return basePrompt;

  const rulesSection = `
## Owner's Learned Rules
These rules were learned from the owner's past corrections and preferences.
You MUST follow these rules. They override default behaviour.

${rules
  .sort((a, b) => b.confidence - a.confidence)
  .map((r, i) => `${i + 1}. [${r.category}] ${r.rule_text} (confidence: ${(r.confidence * 100).toFixed(0)}%)`)
  .join('\n')}
`;

  return basePrompt + '\n' + rulesSection;
}
```

### 1.5 Confidence Lifecycle

| Event | Confidence Change | Notes |
|-------|-------------------|-------|
| Rule created from corrections | Starts at 0.70 | |
| Rule created manually by owner | Starts at 1.00 | Owner-created rules start at max |
| Agent follows rule, owner approves | +0.05 (max 1.0) | Slow growth builds trust |
| Agent follows rule, owner rejects | -0.15 (min 0.0) | Fast decay on failure |
| Agent follows rule, owner corrects | -0.10, rule updated | Rule text may be refined |
| Confidence drops below 0.3 | Rule auto-deactivated | Owner notified, can re-enable |
| Rule unused for 90 days | No change | Rules don't decay from disuse |

### 1.6 Rule Categories

| Category | Examples |
|----------|----------|
| `communication` | Message timing, tone preferences, channel preferences |
| `maintenance` | Trade preferences, quote thresholds, approval limits |
| `financial` | Payment plan terms, rent increase approach, expense limits |
| `scheduling` | Inspection timing, availability windows, blackout dates |
| `tenant_relations` | Communication style, escalation preferences, flexibility |
| `compliance` | Extra compliance steps, documentation preferences |
| `general` | Catch-all for preferences that don't fit other categories |

---

## 2. pgvector Memory Retrieval (Precedent-Based Decisions)

Every tool call the agent makes is recorded in `agent_decisions` with a 1536-dimensional embedding. When the agent faces a new decision, it searches for similar past decisions to inform its approach.

### 2.1 How It Works

```
Agent faces new decision (e.g., "tenant requests early lease termination")
    |
    v
Generate embedding of current context (decision_type + input_data + property context)
    |
    v
Cosine similarity search against agent_decisions.embedding
WHERE user_id = current_owner AND owner_feedback IS NOT NULL
ORDER BY similarity DESC
LIMIT 3
    |
    v
Top 3 precedents returned with:
  - What the agent did
  - What the owner's feedback was (approved/rejected/corrected)
  - The reasoning used
  - The outcome
    |
    v
Precedents injected into system prompt:

"## Relevant Precedents
1. [2024-11-15] Similar situation: tenant at 42 Smith St requested early termination.
   You suggested: negotiate 2 weeks' rent as break fee.
   Owner approved. Outcome: tenant agreed, lease terminated cleanly.

2. [2024-09-03] Similar situation: tenant at 18 Park Ave wanted to sublet.
   You suggested: approve with landlord consent clause.
   Owner corrected: 'Never allow subletting — always decline.'

3. [2024-12-01] Similar situation: tenant at 7 Ocean Rd late on rent by 5 days.
   You suggested: send friendly reminder.
   Owner approved. Outcome: tenant paid within 24 hours."
    |
    v
Agent uses precedents to make better decisions
(e.g., knows this owner prefers flexible early termination but no subletting)
```

### 2.2 Embedding Generation

Embeddings are generated asynchronously after each tool execution:

```typescript
async function generateDecisionEmbedding(
  decision: AgentDecision
): Promise<void> {
  // Build a text representation of the decision for embedding
  const embeddingText = [
    `Decision type: ${decision.decision_type}`,
    `Tool: ${decision.tool_name}`,
    `Context: ${JSON.stringify(decision.input_data)}`,
    `Reasoning: ${decision.reasoning || 'none'}`,
    `Outcome: ${decision.owner_feedback || 'pending'}`,
    decision.owner_correction ? `Correction: ${decision.owner_correction}` : ''
  ].filter(Boolean).join('\n');

  // Generate embedding via OpenAI embeddings API (or Anthropic when available)
  const embedding = await generateEmbedding(embeddingText);

  // Store embedding
  await supabase
    .from('agent_decisions')
    .update({ embedding })
    .eq('id', decision.id);
}
```

### 2.3 Precedent Search

```typescript
async function searchPrecedents(
  userId: string,
  currentContext: {
    decision_type: string;
    tool_name: string;
    input_data: Record<string, any>;
  },
  limit: number = 3
): Promise<AgentDecision[]> {

  // Generate embedding for current context
  const contextText = [
    `Decision type: ${currentContext.decision_type}`,
    `Tool: ${currentContext.tool_name}`,
    `Context: ${JSON.stringify(currentContext.input_data)}`
  ].join('\n');

  const queryEmbedding = await generateEmbedding(contextText);

  // Cosine similarity search via pgvector
  const { data: precedents } = await supabase.rpc(
    'search_similar_decisions',
    {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_threshold: 0.7,  // minimum similarity
      match_count: limit
    }
  );

  return precedents;
}

-- SQL function for pgvector search
CREATE OR REPLACE FUNCTION search_similar_decisions(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  decision_type TEXT,
  tool_name TEXT,
  input_data JSONB,
  output_data JSONB,
  reasoning TEXT,
  owner_feedback TEXT,
  owner_correction TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id,
    ad.decision_type,
    ad.tool_name,
    ad.input_data,
    ad.output_data,
    ad.reasoning,
    ad.owner_feedback,
    ad.owner_correction,
    1 - (ad.embedding <=> query_embedding) AS similarity,
    ad.created_at
  FROM agent_decisions ad
  WHERE ad.user_id = match_user_id
    AND ad.owner_feedback IS NOT NULL
    AND ad.embedding IS NOT NULL
    AND 1 - (ad.embedding <=> query_embedding) > match_threshold
  ORDER BY ad.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 2.4 What the Agent Learns from Precedents

| Pattern | What It Learns |
|---------|----------------|
| Owner always approves cheapest quote | "This owner prioritises cost over speed" |
| Owner always picks same plumber | "This owner has a preferred trade for plumbing" |
| Owner rejects weekend inspection slots | "This owner doesn't want inspections on weekends" |
| Owner corrects formal messages to casual | "This owner prefers casual communication tone" |
| Owner always approves rent reminders on day 1 | "This owner wants early rent reminders" |

---

## 3. Autonomy Graduation

Autonomy graduation is the trust-building mechanism. The agent starts conservative and earns the right to act independently.

### 3.1 Graduation Flow

```
Agent executes action in category (e.g., "maintenance")
    |
    v
Owner approves? ──NO──> Reset consecutive count for category
    |                    (rejection or correction)
    YES
    |
    v
Increment consecutive approval count for category
    |
    v
Count >= graduation_threshold (default: 10)?
    |
    +--- NO ---> Continue tracking
    |
    +--- YES --> Check: 0 rejections/corrections in last N actions?
                    |
                    +--- NO ---> Continue tracking (not clean enough)
                    |
                    +--- YES --> Generate graduation suggestion
                                    |
                                    v
                                Agent sends chat message:
                                "You've approved 15 maintenance actions in a row.
                                 Would you like me to handle routine maintenance
                                 decisions automatically?"
                                    |
                                    +--- Owner accepts ---> Increase autonomy level
                                    |                       for this category
                                    |                       (e.g., L1 → L2, or L2 → L3)
                                    |
                                    +--- Owner declines --> Set backoff multiplier
                                                            (next suggestion after 2x threshold)
                                                            Backoff doubles each decline:
                                                            10 → 20 → 40 → 80
```

### 3.2 Graduation Thresholds by Category

| Category | Default Threshold | Max Auto-Autonomy | Notes |
|----------|-------------------|-------------------|-------|
| Query (read-only) | 0 (always auto) | L4 | Reading data is always safe |
| Communication (routine) | 5 | L3 | Rent reminders, receipts |
| Communication (custom) | 15 | L2 | Custom messages stay as drafts |
| Maintenance (triage) | 3 | L3 | Categorise and prioritise |
| Maintenance (action) | 10 | L2 | Create requests, assign trades |
| Financial (routine) | 10 | L3 | Process normal payments, receipts |
| Financial (significant) | Never | L1 | Large expenses, refunds always need approval |
| Legal (notices) | Never | L0 | Breach notices, terminations always inform-only |
| Scheduling | 5 | L3 | Inspections, maintenance windows |
| Compliance | 5 | L3 | Book compliance checks |

### 3.3 Graduation UI

The Autonomy Settings screen (built in Mission 14) is enhanced with:

```
┌─────────────────────────────────────────────────┐
│ Autonomy Settings                          ← Back│
├─────────────────────────────────────────────────┤
│                                                   │
│ 🎯 Graduation Progress                           │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ Maintenance Actions                     L2 → L3│ │
│ │ ████████████████████░░░░  8/10 approvals     │ │
│ │ 2 more approvals to unlock auto-execute      │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ Communication (Routine)              L2 → L3  │ │
│ │ ██████████████████████████  12/5 ✓ Ready!    │ │
│ │ [Let Casa handle this automatically]          │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ Financial (Routine)                  L1 → L2  │ │
│ │ ████░░░░░░░░░░░░░░░░░░  2/10 approvals      │ │
│ │ 8 more approvals needed                      │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ Manual Overrides                                  │
│ You can always override autonomy levels manually. │
│ Graduation suggestions are just recommendations.  │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 3.4 Suggest Autonomy Upgrade Tool

```typescript
const suggest_autonomy_upgrade: Tool = {
  name: 'suggest_autonomy_upgrade',
  description: 'Suggest upgrading autonomy level for a tool category based on approval history',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['communication', 'maintenance', 'financial', 'scheduling', 'compliance'],
        description: 'The tool category to suggest upgrade for'
      },
      current_level: {
        type: 'number',
        enum: [0, 1, 2, 3],
        description: 'Current autonomy level'
      },
      suggested_level: {
        type: 'number',
        enum: [1, 2, 3, 4],
        description: 'Suggested new autonomy level'
      },
      approval_count: {
        type: 'number',
        description: 'Number of consecutive approvals'
      },
      example_actions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Recent approved actions as evidence'
      }
    },
    required: ['category', 'current_level', 'suggested_level', 'approval_count']
  },
  category: 'action',
  autonomyLevel: 1,  // Always suggest, never auto-execute
  riskLevel: 'low',
  reversible: true
};
```

---

## 4. Agent Tools for Learning

These tools are added to the agent's tool catalog by this mission:

| Tool Name | Category | Default Autonomy | Description |
|-----------|----------|-------------------|-------------|
| `remember` | memory | L4 (autonomous) | Store a preference or learning about the owner. Called automatically when the agent infers something important. |
| `recall` | memory | L4 (autonomous) | Retrieve stored preferences and facts relevant to current context. Searches `agent_preferences` by key and semantic similarity. |
| `search_precedent` | memory | L4 (autonomous) | Find similar past decisions via pgvector cosine similarity on `agent_decisions.embedding`. Returns top 3 matches with reasoning and outcome. |
| `get_rules` | query | L4 (autonomous) | Get all active rules for the current owner, optionally filtered by category. Used during context assembly. |
| `suggest_autonomy_upgrade` | action | L1 (suggest) | Suggest moving to the next autonomy level for a tool category. Requires explicit owner approval. |
| `get_compliance_status` | query | L4 (autonomous) | Check compliance status for all properties owned by the current user. Returns overdue, upcoming, and compliant items grouped by property. |
| `schedule_compliance_check` | action | L3 (execute) | Book a compliance service (smoke alarm check, pool inspection, etc.) for a property. Creates a maintenance request linked to the compliance item. |
| `record_compliance` | action | L2 (draft) | Record that a compliance check has been completed, with optional certificate upload and notes. |
| `get_learning_content` | query | L4 (autonomous) | Search learning content articles and guides. Used when owner asks questions about property management. |

### Tool Definitions

```typescript
// Remember a preference or learning
const remember: Tool = {
  name: 'remember',
  description: 'Store an important preference or fact about the owner for future reference. Use this when you learn something about how the owner likes things done.',
  input_schema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'What to remember (e.g., "preferred_plumber", "communication_style", "rent_reminder_timing")'
      },
      value: {
        type: 'string',
        description: 'The preference or fact to store'
      },
      category: {
        type: 'string',
        enum: ['communication', 'maintenance', 'financial', 'scheduling', 'tenant_relations', 'compliance', 'general'],
        description: 'Category for this preference'
      },
      property_id: {
        type: 'string',
        description: 'Property this applies to (omit for global preferences)'
      }
    },
    required: ['key', 'value', 'category']
  },
  category: 'memory',
  autonomyLevel: 4,
  riskLevel: 'none',
  reversible: true
};

// Recall stored preferences
const recall: Tool = {
  name: 'recall',
  description: 'Retrieve stored preferences and facts relevant to the current situation. Searches by keyword and semantic similarity.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What to look up (e.g., "plumber preference", "communication style")'
      },
      category: {
        type: 'string',
        enum: ['communication', 'maintenance', 'financial', 'scheduling', 'tenant_relations', 'compliance', 'general'],
        description: 'Filter by category'
      },
      property_id: {
        type: 'string',
        description: 'Filter by property (also returns global preferences)'
      }
    },
    required: ['query']
  },
  category: 'memory',
  autonomyLevel: 4,
  riskLevel: 'none',
  reversible: true
};

// Search for similar past decisions
const search_precedent: Tool = {
  name: 'search_precedent',
  description: 'Find similar past decisions to inform the current situation. Uses vector similarity search to find precedents where the owner has given feedback.',
  input_schema: {
    type: 'object',
    properties: {
      decision_type: {
        type: 'string',
        description: 'Type of decision (e.g., "maintenance_triage", "quote_selection", "tenant_communication")'
      },
      context: {
        type: 'string',
        description: 'Description of the current situation to find similar precedents for'
      },
      limit: {
        type: 'number',
        default: 3,
        description: 'Number of precedents to return'
      }
    },
    required: ['context']
  },
  category: 'memory',
  autonomyLevel: 4,
  riskLevel: 'none',
  reversible: true
};

// Get compliance status
const get_compliance_status: Tool = {
  name: 'get_compliance_status',
  description: 'Check compliance status for all properties. Returns overdue items, upcoming deadlines, and current compliance status grouped by property.',
  input_schema: {
    type: 'object',
    properties: {
      property_id: {
        type: 'string',
        description: 'Filter to a specific property (omit for all properties)'
      },
      status_filter: {
        type: 'string',
        enum: ['all', 'overdue', 'upcoming', 'compliant'],
        default: 'all',
        description: 'Filter by compliance status'
      },
      days_ahead: {
        type: 'number',
        default: 90,
        description: 'For upcoming items, how many days ahead to look'
      }
    },
    required: []
  },
  category: 'query',
  autonomyLevel: 4,
  riskLevel: 'none',
  reversible: true
};

// Schedule compliance check
const schedule_compliance_check: Tool = {
  name: 'schedule_compliance_check',
  description: 'Book a compliance service for a property. Creates a maintenance request linked to the compliance requirement.',
  input_schema: {
    type: 'object',
    properties: {
      property_compliance_id: {
        type: 'string',
        description: 'The property_compliance record ID'
      },
      preferred_date: {
        type: 'string',
        format: 'date',
        description: 'Preferred date for the service'
      },
      trade_id: {
        type: 'string',
        description: 'Preferred trade/contractor (omit to use agent selection)'
      },
      notes: {
        type: 'string',
        description: 'Additional notes for the service provider'
      }
    },
    required: ['property_compliance_id']
  },
  category: 'action',
  autonomyLevel: 3,
  riskLevel: 'low',
  reversible: true
};
```

---

## 5. Compliance Engine

### 5.1 State-Specific Compliance Requirements

| Requirement | NSW | VIC | QLD | SA | WA | TAS |
|-------------|-----|-----|-----|----|----|-----|
| **Smoke alarms** | Annual check | Annual check | Annual + per-tenancy change | Annual check | Annual check | Annual check |
| **Pool safety** | Register required | Register + inspection | Triennial certificate | Pool fencing required | Pool fencing inspection | Pool fencing required |
| **Gas safety** | If gas appliances (recommended annual) | **Mandatory biennial** by licensed gasfitter | If gas appliances (recommended) | If gas appliances | If gas appliances | If gas appliances |
| **Electrical safety** | RCD recommended | RCD recommended | **Mandatory biennial** safety switch test | RCD required at switchboard | RCD required | RCD recommended |
| **Blind cord safety** | Mandatory compliance | Mandatory compliance | Mandatory compliance | Recommended | Recommended | Recommended |
| **Building insurance** | Required | Required | Required | Required | Required | Required |
| **Landlord insurance** | Recommended | Recommended | Recommended | Recommended | Recommended | Recommended |
| **Energy rating** | Required for new leases | Required for new leases | Not required | Not required | Not required | Not required |
| **Asbestos register** | Required pre-2003 buildings | Required pre-2003 buildings | Not required | Not required | Required pre-1990 | Not required |

### 5.2 Compliance Heartbeat Scanner

The agent's heartbeat engine (built in Mission 14) is extended with a compliance scanner:

```typescript
// Runs daily as part of agent-heartbeat
async function scanCompliance(userId: string): Promise<HeartbeatResult[]> {
  const results: HeartbeatResult[] = [];

  // Get all property compliance items for this owner
  const { data: complianceItems } = await supabase
    .from('property_compliance')
    .select(`
      *,
      property:properties!inner(id, address, state, owner_id),
      requirement:compliance_requirements(*)
    `)
    .eq('property.owner_id', userId)
    .in('status', ['pending', 'compliant']); // Skip 'exempt' and 'not_applicable'

  const today = new Date();

  for (const item of complianceItems) {
    if (!item.next_due_date) continue;

    const dueDate = new Date(item.next_due_date);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Check if overdue
    if (daysUntilDue < 0) {
      await supabase
        .from('property_compliance')
        .update({ status: 'overdue' })
        .eq('id', item.id);

      results.push({
        type: 'compliance_overdue',
        severity: 'critical',
        property_id: item.property_id,
        message: `${item.requirement.name} is ${Math.abs(daysUntilDue)} days overdue at ${item.property.address}`,
        suggested_action: 'schedule_compliance_check',
        suggested_params: { property_compliance_id: item.id }
      });
    }
    // Check reminder thresholds
    else if ([30, 14, 7, 1].includes(daysUntilDue)) {
      results.push({
        type: 'compliance_upcoming',
        severity: daysUntilDue <= 7 ? 'warning' : 'info',
        property_id: item.property_id,
        message: `${item.requirement.name} due in ${daysUntilDue} days at ${item.property.address}`,
        suggested_action: daysUntilDue <= 14 ? 'schedule_compliance_check' : null,
        suggested_params: daysUntilDue <= 14 ? { property_compliance_id: item.id } : null
      });

      // Send reminder if not already sent for this threshold
      await sendComplianceReminder(item, daysUntilDue);
    }
  }

  return results;
}
```

### 5.3 Compliance Calendar

Each property gets a 12-month compliance calendar showing all upcoming deadlines:

```
┌─────────────────────────────────────────────────────┐
│ Compliance Calendar — 42 Smith St, Bondi           │
├──────┬──────────────────────────────────────────────┤
│ Feb  │ ✅ Smoke Alarm Check (completed 15 Jan)      │
│ Mar  │                                               │
│ Apr  │ 🔶 Building Insurance Renewal (due 12 Apr)   │
│ May  │                                               │
│ Jun  │ 🔶 Pool Safety Certificate (due 30 Jun)      │
│ Jul  │                                               │
│ Aug  │                                               │
│ Sep  │                                               │
│ Oct  │                                               │
│ Nov  │ 🔶 Gas Safety Check (due 15 Nov)             │
│ Dec  │                                               │
│ Jan  │ 🔶 Smoke Alarm Check (due 15 Jan)            │
└──────┴──────────────────────────────────────────────┘
```

---

## 6. Rule Management UI

### 6.1 Screen: Settings → Casa Rules

Located at `apps/owner/app/(app)/settings/agent-rules.tsx`

```
┌─────────────────────────────────────────────────┐
│ Casa Rules                                 ← Back│
├─────────────────────────────────────────────────┤
│                                                   │
│ Casa learns your preferences from your feedback.  │
│ Rules appear here automatically. You can also     │
│ add your own.                                     │
│                                                   │
│ [+ Add Rule]                                      │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ 🟢 Active                                     │ │
│ │ "Never send messages to tenants before 9am    │ │
│ │  or after 8pm AEST"                           │ │
│ │                                                │ │
│ │ Communication  ·  92% confidence               │ │
│ │ Applied 14 times  ·  0 rejections              │ │
│ │                                                │ │
│ │ [Toggle: ON]  [Edit]  [Delete]                │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ 🟢 Active                                     │ │
│ │ "For plumbing issues, always contact          │ │
│ │  Reliable Plumbing (0412 345 678) first"      │ │
│ │                                                │ │
│ │ Maintenance  ·  85% confidence                 │ │
│ │ Applied 7 times  ·  1 rejection                │ │
│ │                                                │ │
│ │ [Toggle: ON]  [Edit]  [Delete]                │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ 🔴 Inactive (confidence below 30%)            │ │
│ │ "Always choose the cheapest maintenance quote"│ │
│ │                                                │ │
│ │ Financial  ·  25% confidence                   │ │
│ │ Applied 5 times  ·  3 rejections               │ │
│ │                                                │ │
│ │ [Toggle: OFF]  [Edit]  [Delete]               │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 6.2 Add Rule Modal

```
┌─────────────────────────────────────────────────┐
│ Add Rule                                    ✕    │
├─────────────────────────────────────────────────┤
│                                                   │
│ Tell Casa how you want things done.               │
│                                                   │
│ Rule                                              │
│ ┌───────────────────────────────────────────────┐ │
│ │ Always pick the cheapest quote unless quality │ │
│ │ ratings differ by more than 1 star            │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ Category                                          │
│ [Financial            ▾]                          │
│                                                   │
│ Applies to                                        │
│ ○ All properties                                  │
│ ○ Specific property: [Select property ▾]          │
│                                                   │
│ Examples of good rules:                           │
│ • "Never contact me on weekends"                  │
│ • "Always get my approval for expenses over $200" │
│ • "Use SMS instead of email for urgent items"     │
│ • "For 42 Smith St, preferred electrician is       │
│    Spark Bros (0413 555 123)"                     │
│                                                   │
│ [Cancel]                        [Add Rule]        │
└─────────────────────────────────────────────────┘
```

### 6.3 Rule Management API Hooks

```typescript
// packages/api/src/hooks/useAgentRules.ts

export function useAgentRules(propertyId?: string) {
  // Fetch all rules for current user
  const { data: rules, isLoading, refetch } = useQuery(
    ['agent-rules', propertyId],
    () => fetchRules(propertyId)
  );

  // Toggle rule active/inactive
  const toggleRule = useMutation(
    (ruleId: string) => toggleRuleActive(ruleId),
    { onSuccess: () => refetch() }
  );

  // Update rule text
  const updateRule = useMutation(
    ({ ruleId, ruleText }: { ruleId: string; ruleText: string }) =>
      updateRuleText(ruleId, ruleText),
    { onSuccess: () => refetch() }
  );

  // Delete rule
  const deleteRule = useMutation(
    (ruleId: string) => deleteRuleById(ruleId),
    { onSuccess: () => refetch() }
  );

  // Create manual rule
  const createRule = useMutation(
    (rule: { rule_text: string; category: string; property_id?: string }) =>
      createManualRule(rule),
    { onSuccess: () => refetch() }
  );

  return {
    rules,
    isLoading,
    toggleRule,
    updateRule,
    deleteRule,
    createRule,
    refetch
  };
}
```

---

## 7. Database Schema

### 7.1 Agent Learning Tables (from Mission 14 migration — verify exist)

These tables should already exist from Mission 14's Phase A migration. Verify they are deployed and add any missing columns.

```sql
-- Agent decisions: every tool call + outcome + confidence + embedding
-- This is the primary learning data table
CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id),
  property_id UUID REFERENCES properties(id),

  -- What was decided
  decision_type TEXT NOT NULL,            -- e.g., 'maintenance_triage', 'quote_selection'
  tool_name TEXT NOT NULL,                -- The tool that was called
  input_data JSONB NOT NULL,              -- Tool input parameters
  output_data JSONB,                      -- Tool output/result

  -- Reasoning
  reasoning TEXT,                          -- Why the agent made this decision

  -- Confidence & autonomy
  confidence DECIMAL(3,2),                -- Agent's confidence in this decision (0.0-1.0)
  autonomy_level INTEGER NOT NULL DEFAULT 1,

  -- Owner feedback (filled in after owner responds)
  owner_feedback TEXT CHECK (owner_feedback IN ('approved', 'rejected', 'corrected')),
  owner_correction TEXT,                   -- If corrected, what the owner wanted instead

  -- pgvector embedding for precedent search (1536-dim, OpenAI text-embedding-3-small)
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent corrections: owner corrections with full context
-- Input for the correction-to-rule pipeline
CREATE TABLE IF NOT EXISTS agent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES agent_decisions(id),

  -- What was corrected
  original_action TEXT NOT NULL,           -- What the agent did/suggested
  correction TEXT NOT NULL,                -- What the owner wanted instead
  category TEXT NOT NULL DEFAULT 'general', -- communication, maintenance, financial, etc.

  -- Full context at time of correction (for pattern matching)
  context_snapshot JSONB NOT NULL,         -- property_id, tenant_id, time, situation

  -- Pattern tracking
  pattern_matched BOOLEAN DEFAULT false,   -- True once this correction contributed to a rule

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent rules: generated behavioral rules
-- The output of the correction-to-rule pipeline
CREATE TABLE IF NOT EXISTS agent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),  -- NULL = applies to all properties

  -- The rule itself
  rule_text TEXT NOT NULL,                 -- Human-readable rule (injected into system prompt)
  category TEXT NOT NULL,                  -- communication, maintenance, financial, etc.

  -- Confidence tracking
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  source TEXT NOT NULL CHECK (source IN ('correction_pattern', 'explicit', 'inferred')),

  -- Usage tracking
  applications_count INTEGER NOT NULL DEFAULT 0,  -- Times this rule was applied
  rejections_count INTEGER NOT NULL DEFAULT 0,     -- Times owner rejected when rule was active
  correction_ids UUID[] DEFAULT '{}',              -- Corrections that generated this rule

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent preferences: owner settings + inferred preferences
CREATE TABLE IF NOT EXISTS agent_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),

  -- Preference details
  category TEXT NOT NULL,                  -- communication, maintenance, financial, etc.
  preference_key TEXT NOT NULL,            -- e.g., 'preferred_plumber', 'message_tone'
  preference_value JSONB NOT NULL,         -- The preference value (flexible type)

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN ('explicit', 'inferred', 'default')),
  confidence DECIMAL(3,2) DEFAULT 1.00,    -- 1.0 for explicit, lower for inferred

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, property_id, category, preference_key)
);

-- Agent trajectories: tool call sequences + efficiency scores
CREATE TABLE IF NOT EXISTS agent_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id),

  -- The execution path
  tool_sequence JSONB NOT NULL,            -- [{tool, input, output, duration_ms}]
  total_duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  efficiency_score DECIMAL(3,2),           -- Compared to similar past trajectories

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Autonomy graduation tracking (NEW table for this mission)
CREATE TABLE agent_graduation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Category tracking
  category TEXT NOT NULL,                  -- Tool category being tracked
  consecutive_approvals INTEGER NOT NULL DEFAULT 0,
  total_approvals INTEGER NOT NULL DEFAULT 0,
  total_rejections INTEGER NOT NULL DEFAULT 0,
  total_corrections INTEGER NOT NULL DEFAULT 0,

  -- Graduation state
  current_autonomy_level INTEGER NOT NULL DEFAULT 1,
  graduation_threshold INTEGER NOT NULL DEFAULT 10,  -- How many approvals needed
  backoff_multiplier INTEGER NOT NULL DEFAULT 1,      -- Doubles after each decline
  last_suggestion_at TIMESTAMPTZ,                     -- When we last suggested upgrade
  last_suggestion_declined BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, category)
);
```

### 7.2 Compliance Tables (NEW — this mission's migration)

```sql
-- Compliance requirement types
CREATE TYPE compliance_type AS ENUM (
  'smoke_alarm',
  'pool_safety',
  'electrical_safety',
  'gas_safety',
  'blind_cord_safety',
  'water_efficiency',
  'energy_rating',
  'asbestos_register',
  'building_insurance',
  'landlord_insurance',
  'other'
);

-- Compliance frequency
CREATE TYPE compliance_frequency AS ENUM (
  'annual',
  'biennial',      -- Every 2 years
  'triennial',     -- Every 3 years
  'five_yearly',
  'per_tenancy',   -- Required at start of each new tenancy
  'once',          -- One-time requirement
  'ongoing'        -- No specific renewal
);

-- Compliance requirements (templates — seeded by migration)
CREATE TABLE compliance_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Requirement details
  compliance_type compliance_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  frequency compliance_frequency NOT NULL,

  -- State applicability
  states TEXT[] NOT NULL, -- ['NSW', 'VIC', 'QLD', etc.]

  -- Property type applicability
  property_types property_type[], -- NULL means all types

  -- Timing
  days_before_reminder INTEGER NOT NULL DEFAULT 30,
  grace_period_days INTEGER NOT NULL DEFAULT 0,

  -- Evidence requirements
  requires_certificate BOOLEAN NOT NULL DEFAULT FALSE,
  requires_photo BOOLEAN NOT NULL DEFAULT FALSE,
  certificate_types TEXT[],

  -- Resources
  info_url TEXT,
  how_to_guide_id UUID,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE,
  effective_until DATE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Property compliance tracking
CREATE TABLE property_compliance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'compliant', 'overdue', 'not_applicable', 'exempt')),

  -- Dates
  last_completed_date DATE,
  next_due_date DATE,
  expires_at DATE,

  -- Evidence
  certificate_url TEXT,
  certificate_number TEXT,
  photo_urls TEXT[],
  notes TEXT,

  -- Completed by
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,

  -- Exemption
  exemption_reason TEXT,
  exemption_approved_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(property_id, requirement_id)
);

-- Compliance reminders sent
CREATE TABLE compliance_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_compliance_id UUID NOT NULL REFERENCES property_compliance(id) ON DELETE CASCADE,

  -- Reminder details
  reminder_type TEXT NOT NULL, -- '30_day', '14_day', '7_day', '1_day', 'overdue'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel TEXT NOT NULL, -- 'email', 'push', 'in_app', 'agent_chat'

  -- Status
  delivered BOOLEAN,
  opened BOOLEAN,
  acted_upon BOOLEAN
);

-- Learning content
CREATE TABLE learning_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content details
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  content TEXT NOT NULL, -- Markdown
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'guide', 'checklist', 'video', 'faq')),

  -- Categorization
  category TEXT NOT NULL,
  subcategory TEXT,
  tags TEXT[],

  -- State specificity
  states TEXT[], -- NULL means applicable to all

  -- Media
  featured_image_url TEXT,
  video_url TEXT,
  video_duration_seconds INTEGER,

  -- Related
  related_content_ids UUID[],
  related_compliance_type compliance_type,

  -- SEO
  meta_title TEXT,
  meta_description TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,

  -- Metadata
  author TEXT,
  reading_time_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Learning progress
CREATE TABLE user_learning_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES learning_content(id) ON DELETE CASCADE,

  -- Progress
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  progress_percent INTEGER NOT NULL DEFAULT 0,

  -- Checklist progress (for checklists)
  checklist_items_completed INTEGER[],

  -- Bookmarked
  is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  bookmarked_at TIMESTAMPTZ,

  UNIQUE(user_id, content_id)
);

-- Regulatory updates
CREATE TABLE regulatory_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Update details
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_content TEXT,

  -- Applicability
  states TEXT[] NOT NULL,
  effective_date DATE NOT NULL,
  compliance_types compliance_type[],

  -- Impact
  impact_level TEXT NOT NULL CHECK (impact_level IN ('info', 'low', 'medium', 'high', 'critical')),
  required_actions TEXT[],

  -- Resources
  source_url TEXT,
  related_content_ids UUID[],

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User acknowledgment of regulatory updates
CREATE TABLE user_regulatory_acknowledgments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  update_id UUID NOT NULL REFERENCES regulatory_updates(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, update_id)
);
```

### 7.3 Seed Data

```sql
-- Insert default compliance requirements
INSERT INTO compliance_requirements (compliance_type, name, description, frequency, states, days_before_reminder, requires_certificate) VALUES
('smoke_alarm', 'Smoke Alarm Compliance', 'Annual inspection and maintenance of smoke alarms. Must be working and correctly positioned per AS 3786.', 'annual', ARRAY['NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT'], 30, FALSE),
('smoke_alarm', 'Smoke Alarm Compliance (QLD)', 'Annual check + replacement/upgrade required at start of each new tenancy. Must comply with QLD Fire and Emergency Services standards.', 'per_tenancy', ARRAY['QLD'], 30, FALSE),
('pool_safety', 'Pool Safety Certificate (QLD)', 'Pool barrier compliance certificate required for properties with swimming pools. Must be renewed every 3 years.', 'triennial', ARRAY['QLD'], 60, TRUE),
('pool_safety', 'Pool Safety Registration (NSW)', 'Swimming pool must be registered on NSW Swimming Pool Register and comply with barrier requirements.', 'triennial', ARRAY['NSW'], 60, TRUE),
('electrical_safety', 'Electrical Safety Switch (QLD)', 'Safety switch (RCD) must be installed and tested every 2 years by licensed electrician. Required in all QLD rental properties.', 'biennial', ARRAY['QLD'], 30, TRUE),
('gas_safety', 'Gas Safety Check (VIC)', 'Mandatory gas safety check every 2 years by licensed gasfitter for all VIC properties with gas appliances or fittings.', 'biennial', ARRAY['VIC'], 30, TRUE),
('blind_cord_safety', 'Blind Cord Safety', 'Window blind cords must be secured or replaced with cordless alternatives to prevent strangulation hazard.', 'once', ARRAY['NSW', 'VIC', 'QLD'], 0, FALSE),
('building_insurance', 'Building Insurance', 'Adequate building insurance must be maintained for the property at all times during tenancy.', 'annual', ARRAY['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'], 30, TRUE),
('energy_rating', 'Energy Efficiency Disclosure', 'Energy efficiency rating disclosure required for new leases.', 'ongoing', ARRAY['NSW', 'VIC', 'ACT'], 0, FALSE),
('asbestos_register', 'Asbestos Register', 'Asbestos management plan required for buildings constructed before 2003 (NSW/VIC) or 1990 (WA).', 'once', ARRAY['NSW', 'VIC', 'WA'], 0, TRUE);
```

### 7.4 Indexes

```sql
-- Compliance indexes
CREATE INDEX idx_compliance_requirements_states ON compliance_requirements USING GIN (states);
CREATE INDEX idx_property_compliance_property ON property_compliance(property_id);
CREATE INDEX idx_property_compliance_status ON property_compliance(status, next_due_date)
  WHERE status IN ('pending', 'overdue');
CREATE INDEX idx_learning_content_category ON learning_content(category, status)
  WHERE status = 'published';
CREATE INDEX idx_learning_content_slug ON learning_content(slug);
CREATE INDEX idx_user_learning_progress ON user_learning_progress(user_id);

-- Agent learning indexes (verify from Mission 14)
CREATE INDEX IF NOT EXISTS idx_agent_decisions_user ON agent_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_embedding
  ON agent_decisions USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_feedback
  ON agent_decisions(user_id, owner_feedback)
  WHERE owner_feedback IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_rules_user ON agent_rules(user_id, active);
CREATE INDEX IF NOT EXISTS idx_agent_corrections_user
  ON agent_corrections(user_id, category, pattern_matched);
CREATE INDEX IF NOT EXISTS idx_agent_graduation_user
  ON agent_graduation_progress(user_id, category);
```

### 7.5 RLS Policies

```sql
-- Compliance RLS
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_regulatory_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_graduation_progress ENABLE ROW LEVEL SECURITY;

-- Requirements: public read
CREATE POLICY "Anyone can view requirements"
  ON compliance_requirements FOR SELECT
  USING (is_active);

-- Property compliance: owners only
CREATE POLICY "Owners manage property compliance"
  ON property_compliance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_compliance.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Learning content: public read for published
CREATE POLICY "Anyone can view published content"
  ON learning_content FOR SELECT
  USING (status = 'published');

-- Learning progress: users manage own
CREATE POLICY "Users manage own progress"
  ON user_learning_progress FOR ALL
  USING (auth.uid() = user_id);

-- Regulatory updates: public read for published
CREATE POLICY "Anyone can view published updates"
  ON regulatory_updates FOR SELECT
  USING (status = 'published');

-- Graduation progress: users manage own
CREATE POLICY "users_own_graduation"
  ON agent_graduation_progress FOR ALL
  USING (auth.uid() = user_id);

-- Agent learning tables RLS (verify from Mission 14)
-- agent_decisions, agent_corrections, agent_rules, agent_preferences, agent_trajectories
-- All use: auth.uid() = user_id
```

### 7.6 Triggers & Functions

```sql
-- Auto-create compliance tracking when property is added
CREATE OR REPLACE FUNCTION create_property_compliance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO property_compliance (property_id, requirement_id, status, next_due_date)
  SELECT
    NEW.id,
    cr.id,
    'pending',
    CURRENT_DATE + INTERVAL '30 days'
  FROM compliance_requirements cr
  WHERE cr.is_active
    AND NEW.state = ANY(cr.states)
    AND (cr.property_types IS NULL OR NEW.property_type = ANY(cr.property_types));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER property_compliance_init
  AFTER INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION create_property_compliance();

-- pgvector similarity search function
CREATE OR REPLACE FUNCTION search_similar_decisions(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  decision_type TEXT,
  tool_name TEXT,
  input_data JSONB,
  output_data JSONB,
  reasoning TEXT,
  owner_feedback TEXT,
  owner_correction TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id,
    ad.decision_type,
    ad.tool_name,
    ad.input_data,
    ad.output_data,
    ad.reasoning,
    ad.owner_feedback,
    ad.owner_correction,
    1 - (ad.embedding <=> query_embedding) AS similarity,
    ad.created_at
  FROM agent_decisions ad
  WHERE ad.user_id = match_user_id
    AND ad.owner_feedback IS NOT NULL
    AND ad.embedding IS NOT NULL
    AND 1 - (ad.embedding <=> query_embedding) > match_threshold
  ORDER BY ad.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Updated_at triggers
CREATE TRIGGER compliance_requirements_updated_at
  BEFORE UPDATE ON compliance_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER property_compliance_updated_at
  BEFORE UPDATE ON property_compliance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER learning_content_updated_at
  BEFORE UPDATE ON learning_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agent_rules_updated_at
  BEFORE UPDATE ON agent_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agent_graduation_updated_at
  BEFORE UPDATE ON agent_graduation_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 8. Files to Create/Modify

### Learning Engine (Cloudflare Worker)
```
workers/agent/src/learning/
├── corrections.ts              # Correction recording + pattern detection
├── rule-generator.ts           # Claude-powered rule generation from correction patterns
├── rule-injector.ts            # Inject active rules into system prompt
├── precedent-search.ts         # pgvector cosine similarity search on agent_decisions
├── embedding-generator.ts      # Generate embeddings for decisions (async, non-blocking)
├── trajectory-optimizer.ts     # Efficiency scoring + pruning of tool sequences
├── autonomy-graduation.ts      # Track approvals, compute graduation eligibility, suggest upgrades
├── proactive-insights.ts       # Pattern-based suggestions + anomaly detection
└── index.ts                    # Barrel export for all learning modules
```

### Learning Engine Tools (Agent Tool Handlers)
```
workers/agent/src/tools/memory/
├── remember.ts                 # Store preference in agent_preferences
├── recall.ts                   # Retrieve preferences by key + semantic search
├── search-precedent.ts         # pgvector search on agent_decisions
└── get-rules.ts                # Fetch active rules for current context

workers/agent/src/tools/compliance/
├── get-compliance-status.ts    # Query property_compliance for owner's properties
├── schedule-compliance-check.ts # Create maintenance request linked to compliance item
└── record-compliance.ts        # Mark compliance item as complete with evidence
```

### Packages (Shared API Layer)
```
packages/api/src/
├── queries/
│   ├── compliance.ts           # Compliance CRUD (requirements, tracking, reminders)
│   ├── agentRules.ts           # Agent rules CRUD (create, update, toggle, delete)
│   ├── agentGraduation.ts      # Graduation progress queries
│   ├── learningContent.ts      # Content queries (search, filter by state/category)
│   └── regulatoryUpdates.ts    # Updates queries
├── hooks/
│   ├── useCompliance.ts        # Property compliance status + calendar
│   ├── useAgentRules.ts        # Rule management (CRUD + toggle)
│   ├── useAgentGraduation.ts   # Graduation progress per category
│   ├── useLearningContent.ts   # Content browsing + bookmarks + progress
│   └── useRegulatoryUpdates.ts # Regulatory update list + acknowledgements
└── services/
    └── complianceChecker.ts    # Check compliance status (used by heartbeat)
```

### Backend (Edge Functions)
```
supabase/functions/
├── check-compliance/
│   └── index.ts                # Scheduled (daily): check due dates, update statuses
├── send-compliance-reminders/
│   └── index.ts                # Scheduled (daily): send reminders at 30/14/7/1 day
└── agent-chat/
    └── index.ts                # UPDATE: Add learning pipeline hooks (correction recording,
                                #   rule injection, precedent search, graduation tracking)
```

### Owner App — Compliance Screens
```
apps/owner/app/(app)/
├── compliance/
│   ├── index.tsx               # Compliance dashboard (all properties)
│   ├── [propertyId].tsx        # Property-specific compliance + calendar
│   └── record/
│       └── [id].tsx            # Record compliance completion (evidence upload)
├── learn/
│   ├── index.tsx               # Learning hub (articles + guides)
│   ├── [slug].tsx              # Article/guide view (markdown renderer)
│   ├── category/
│   │   └── [category].tsx      # Category listing
│   └── bookmarks.tsx           # Saved content
├── updates/
│   └── index.tsx               # Regulatory updates feed
```

### Owner App — Learning Engine Screens
```
apps/owner/app/(app)/settings/
├── autonomy.tsx                # UPDATE: Add graduation progress bars + upgrade buttons
└── agent-rules.tsx             # NEW: Rule management (list, add, edit, delete, toggle)
```

### Owner App — Components
```
apps/owner/components/
├── ComplianceStatusCard.tsx    # Compliance summary card (for property detail + dashboard)
├── ComplianceItem.tsx          # Single compliance requirement row
├── ComplianceRecordForm.tsx    # Record completion form (date, certificate, photos, notes)
├── ComplianceCalendar.tsx      # 12-month calendar view of compliance deadlines
├── RuleCard.tsx                # Single rule card (text, confidence, toggle, edit, delete)
├── AddRuleModal.tsx            # Modal for manually adding a rule
├── GraduationProgressBar.tsx   # Category graduation progress (approvals / threshold)
├── ContentCard.tsx             # Learning content card (title, category, read time)
├── ArticleView.tsx             # Markdown article renderer
├── ChecklistView.tsx           # Interactive checklist with progress
├── RegulatoryAlert.tsx         # Update notification card (impact level, required actions)
└── ProgressBar.tsx             # Generic progress bar (used for learning + graduation)
```

---

## 9. Learning Content Categories

```
├── Getting Started
│   ├── New landlord guide
│   ├── Setting up your first property
│   └── Understanding your obligations
├── Legal & Compliance
│   ├── State-specific tenancy laws (NSW / VIC / QLD / SA / WA / TAS)
│   ├── Bond requirements by state
│   ├── Entry rights and notice periods
│   ├── Smoke alarm obligations
│   ├── Pool safety requirements
│   └── Dispute resolution pathways
├── Financial Management
│   ├── Tax deductions for landlords
│   ├── Depreciation schedules
│   ├── Record keeping for ATO
│   └── Rent pricing strategies
├── Tenant Relations
│   ├── Screening tenants effectively
│   ├── Communication best practices
│   └── Handling disputes professionally
├── Maintenance & Repairs
│   ├── Urgent vs routine repairs (legal obligations)
│   ├── Finding reliable tradespeople
│   └── Preventive maintenance schedules
└── End of Tenancy
    ├── Exit inspections best practice
    ├── Bond claims process by state
    └── Re-letting timeline and strategy
```

---

## 10. Validation Commands

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern

```
feat(learning): <description>

Mission-15: Learning Engine & Compliance
```

---

## 11. Implementation Notes

### Prerequisites (from Mission 14)
Before starting this mission, verify these Mission 14 deliverables are working:
1. `agent_decisions` table is being populated on every tool call
2. `agent_corrections` table is being written to when owner provides correction feedback
3. `agent_trajectories` table records tool sequences with timing data
4. pgvector extension is enabled and the `embedding` column on `agent_decisions` exists
5. The `agent-chat` edge function accepts owner feedback (approved/rejected/corrected) on agent responses

### Embedding Strategy
- Use OpenAI `text-embedding-3-small` (1536 dimensions) for decision embeddings
- Embeddings are generated asynchronously (non-blocking) after tool execution completes
- If embedding generation fails (API error, timeout), the decision is still recorded without an embedding
- A background job (daily) retries embedding generation for decisions missing embeddings
- Future: Switch to Anthropic embeddings when available

### Performance Considerations
- Rule injection: load rules once at context assembly time, not on every tool call
- Precedent search: limit to 3 results, minimum similarity 0.7 (reduces noise)
- Embedding generation: async queue, max 10 per minute per user (rate limit)
- Trajectory comparison: only compare against last 100 trajectories (rolling window)
- Compliance scanner: runs once daily per user, batched across all properties

### Agent Learning Is the Core Moat
After 3 months of active use, a typical owner's agent will have:
- 50-100 learned rules covering their management style
- 500+ embedded decisions for precedent search
- Graduated autonomy in 3-5 categories (saving hours per month)
- A compliance calendar that proactively manages all state requirements

This data is the switching cost. A competitor would need to learn everything from scratch.

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All compliance migrations applied to remote Supabase (`compliance_requirements`, `property_compliance`, `compliance_reminders`, `learning_content`, `user_learning_progress`, `regulatory_updates`)
- [ ] `agent_graduation_progress` table created and populated on first approval
- [ ] `agent_corrections` table receives owner corrections correctly (verify from Mission 14)
- [ ] `agent_rules` table stores generated rules with proper ownership and confidence
- [ ] `agent_decisions.embedding` column populated (verify pgvector index exists)
- [ ] `search_similar_decisions` SQL function deployed and returns results
- [ ] RLS policies verified: owners can only access compliance for their own properties
- [ ] RLS policies verified: agent rules/preferences/corrections are per-user
- [ ] RLS policies verified: learning progress is per-user
- [ ] Compliance tracking records auto-created when a new property is added
- [ ] Indexes verified for: due-date queries, pgvector cosine similarity, rule lookups

### Learning Pipeline Verification
- [ ] Owner corrects an agent action → correction stored in `agent_corrections` with context snapshot
- [ ] 3 similar corrections in same category → rule auto-generated via Claude
- [ ] Generated rule text is concise, actionable, and correctly categorised
- [ ] Generated rule has initial confidence of 0.70 and source='correction_pattern'
- [ ] Active rules appear in agent system prompt on next conversation
- [ ] Rule confidence increases (+0.05) when owner approves action matching rule
- [ ] Rule confidence decreases (-0.15) when owner rejects action matching rule
- [ ] Rule auto-deactivates when confidence drops below 0.30
- [ ] Deactivated rule is visible in Rule Management UI with inactive badge

### pgvector Precedent Search Verification
- [ ] Embeddings generated for agent_decisions records (async, non-blocking)
- [ ] `search_precedent` tool returns top 3 similar past decisions
- [ ] Precedent results include: decision type, reasoning, owner feedback, similarity score
- [ ] Precedents injected into system prompt context for agent reasoning
- [ ] Minimum similarity threshold (0.7) filters out irrelevant results
- [ ] `remember` tool stores preferences in `agent_preferences`
- [ ] `recall` tool retrieves preferences by keyword and semantic similarity

### Autonomy Graduation Verification
- [ ] Consecutive approval count tracked per user per category in `agent_graduation_progress`
- [ ] Approval count resets to 0 on rejection or correction
- [ ] After N consecutive approvals (default 10), graduation suggestion appears in chat
- [ ] Graduation suggestion message is clear and includes count + category
- [ ] Owner accepts → autonomy level increases for that category
- [ ] Owner declines → backoff multiplier doubles (next suggestion at 2x threshold)
- [ ] Graduation progress visible in Autonomy Settings screen
- [ ] Manual autonomy overrides still work independently of graduation

### Compliance Verification
- [ ] Compliance dashboard shows status by property (compliant/overdue/upcoming)
- [ ] Compliance requirements vary correctly by state (NSW/VIC/QLD/SA/WA/TAS)
- [ ] Smoke alarm: annual check all states, per-tenancy QLD
- [ ] Pool safety: triennial QLD, registration NSW
- [ ] Gas safety: biennial VIC
- [ ] Electrical safety switch: biennial QLD
- [ ] Building insurance: annual all states
- [ ] Compliance calendar shows next 12 months of deadlines per property
- [ ] Automated reminders fire before due dates (30/14/7/1 day)
- [ ] Reminder escalation: info → warning → critical severity
- [ ] Owner can record compliance completion with certificate upload
- [ ] Heartbeat scanner detects overdue items and updates status
- [ ] Agent proactively suggests scheduling compliance checks via chat
- [ ] `schedule_compliance_check` tool creates linked maintenance request

### Rule Management UI Verification
- [ ] Settings → Casa Rules screen shows all rules for current user
- [ ] Each rule displays: text, category, confidence %, applications count, rejections count
- [ ] Owner can toggle rules active/inactive
- [ ] Owner can edit rule text inline (saves on confirm)
- [ ] Owner can delete rules (with confirmation dialog)
- [ ] Owner can add manual rules with free-text + category picker
- [ ] Manual rules created with source='explicit' and confidence=1.0
- [ ] Rules sorted: active first, then by confidence descending
- [ ] Empty state shown when no rules exist yet

### Learning Content Verification
- [ ] Articles display by state and category
- [ ] Search finds relevant content across titles, summaries, and tags
- [ ] Bookmarking works (add/remove, bookmarks page shows saved items)
- [ ] Interactive checklists track step-by-step progress
- [ ] Regulatory updates display with impact level badges
- [ ] Owner can acknowledge regulatory updates

### Visual & UX
- [ ] Tested on physical iOS device via Expo Go
- [ ] UI matches BRAND-AND-UI.md design system
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes
- [ ] Rule cards, compliance cards, and graduation bars match design system
- [ ] Empty states for all new screens (no blank pages)

### Regression (All Prior Missions)
- [ ] All prior mission critical paths still work (see TESTING-METHODOLOGY.md Section 4)
- [ ] Navigation between all existing screens works
- [ ] Previously created data still loads correctly
- [ ] No new TypeScript errors in existing code
- [ ] Agent chat still works correctly with rule injection added to prompt
- [ ] Agent tasks tab still shows correct pending/completed items

### Auth & Security
- [ ] Authenticated routes redirect unauthenticated users
- [ ] User can only access their own data (RLS verified for all new tables)
- [ ] Session persists across app restarts
- [ ] No sensitive data in logs or error messages
- [ ] Agent rules cannot be read or modified by other users
- [ ] Compliance data scoped to property ownership
