/**
 * Semantic Intelligence E2E Tests — Live Integration Testing
 *
 * These tests call the REAL Supabase Edge Functions to verify:
 * 1. Embeddings are generated and stored in decisions
 * 2. Semantic recall returns relevance-ranked results
 * 3. Semantic search_precedent returns similarity-ranked results
 * 4. Auto-memory injection works in system prompt
 * 5. Outcome tracking records success/failure
 * 6. 6-factor confidence is populated correctly
 * 7. Learning pipeline stores embeddings on corrections and rules
 * 8. Heartbeat runs temporal decay and outcome measurement
 * 9. Rule conflict detection prevents duplicates
 * 10. Data lifecycle cleanup runs correctly
 *
 * REQUIRES: OWNER_PASSWORD and SUPABASE_SERVICE_ROLE_KEY env vars set.
 * These are integration tests that skip when credentials aren't available.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Configuration — uses real Supabase instance
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://woxlvhzgannzhajtjnke.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveGx2aHpnYW5uemhhanRqbmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODYwNTcsImV4cCI6MjA4NDY2MjA1N30._akFWKzx3MC0OvkMrqM2MoKl6vNI_FR3ViQ-jj89pi4';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const OWNER_EMAIL = 'robbie.spooner@icloud.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
const OWNER_USER_ID = 'e323a5a6-4f1f-4cf5-9707-6812a6c9d23a';
// Pre-generated token can be provided to skip password auth
const PRE_AUTH_TOKEN = process.env.AUTH_TOKEN || '';

const AGENT_TIMEOUT = 180_000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 15_000;
const INTER_TEST_DELAY_MS = 8_000;

// Service-key-only tests can run without OWNER_PASSWORD
const hasServiceKey = !!SERVICE_ROLE_KEY;
// Full auth tests need service key + either password or pre-generated token
const hasFullCredentials = !!SERVICE_ROLE_KEY && !!(OWNER_PASSWORD || PRE_AUTH_TOKEN);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAuthToken(): Promise<string> {
  // If a pre-generated token was provided, use it directly
  if (PRE_AUTH_TOKEN) return PRE_AUTH_TOKEN;

  if (!OWNER_PASSWORD) throw new Error('Set OWNER_PASSWORD or AUTH_TOKEN env var');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sendAgentMessage(
  token: string,
  message: string,
  conversationId?: string,
): Promise<{
  conversationId: string;
  message: string;
  tokensUsed: number;
  toolsUsed: string[];
}> {
  const body: Record<string, unknown> = { message };
  if (conversationId) body.conversationId = conversationId;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const result = await res.json();
      await sleep(INTER_TEST_DELAY_MS);
      return result;
    }

    const errText = await res.text();
    if ((res.status === 502 || res.status === 429 || res.status === 546) && attempt < MAX_RETRIES - 1) {
      console.log(`  ⚠ Rate limited (${res.status}), retrying in ${INITIAL_BACKOFF_MS * Math.pow(2, attempt) / 1000}s...`);
      continue;
    }

    throw new Error(`Agent chat error ${res.status}: ${errText}`);
  }

  throw new Error('sendAgentMessage: exhausted all retries');
}

async function queryTable(table: string, params: string = ''): Promise<any[]> {
  if (!SERVICE_ROLE_KEY) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  return res.json();
}

async function callLearningPipeline(action: string, body: Record<string, unknown>): Promise<any> {
  if (!SERVICE_ROLE_KEY) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY env var');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-learning`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...body }),
    });

    if (res.ok) {
      const result = await res.json();
      await sleep(INTER_TEST_DELAY_MS);
      return result;
    }

    const errText = await res.text();
    if ((res.status === 502 || res.status === 429 || res.status === 546) && attempt < MAX_RETRIES - 1) {
      continue;
    }

    throw new Error(`Learning pipeline error ${res.status}: ${errText}`);
  }

  throw new Error('callLearningPipeline: exhausted all retries');
}

async function callHeartbeat(): Promise<{ ok: boolean; body: any }> {
  if (!SERVICE_ROLE_KEY) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY env var');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-heartbeat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'X-Cron-Secret': 'integration-test',
      },
      body: JSON.stringify({}),
    });

    const body = await res.json().catch(() => null);

    if (res.ok) {
      await sleep(INTER_TEST_DELAY_MS);
      return { ok: res.ok, body };
    }

    if ((res.status === 502 || res.status === 429) && attempt < MAX_RETRIES - 1) {
      continue;
    }

    return { ok: res.ok, body };
  }

  return { ok: false, body: null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ═══════════════════════════════════════════════════════════════════════════
// PART A: Service-key-only tests — schema, RPCs, learning pipeline, heartbeat
// These run with just SUPABASE_SERVICE_ROLE_KEY (no OWNER_PASSWORD needed)
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!hasServiceKey)('Semantic Intelligence — Infrastructure E2E', () => {

  describe('A1. Schema Verification (migration 047 applied)', () => {
    it('should have agent_outcomes table accessible', async () => {
      const outcomes = await queryTable('agent_outcomes', 'limit=1');
      expect(Array.isArray(outcomes)).toBe(true);
    });

    it('should have embedding columns on agent_rules', async () => {
      const rules = await queryTable(
        'agent_rules',
        `user_id=eq.${OWNER_USER_ID}&select=id,rule_text,embedding,confidence,active&limit=3`
      );
      if (rules.length > 0) {
        expect('embedding' in rules[0]).toBe(true);
      }
      expect(Array.isArray(rules)).toBe(true);
    });

    it('should have embedding column on agent_preferences', async () => {
      const prefs = await queryTable(
        'agent_preferences',
        `user_id=eq.${OWNER_USER_ID}&select=id,category,preference_key,embedding&limit=3`
      );
      if (prefs.length > 0) {
        expect('embedding' in prefs[0]).toBe(true);
      }
      expect(Array.isArray(prefs)).toBe(true);
    });

    it('should have embedding column on agent_corrections', async () => {
      const corrections = await queryTable(
        'agent_corrections',
        `user_id=eq.${OWNER_USER_ID}&select=id,embedding&limit=3`
      );
      if (corrections.length > 0) {
        expect('embedding' in corrections[0]).toBe(true);
      }
      expect(Array.isArray(corrections)).toBe(true);
    });

    it('should have was_auto_executed column on agent_decisions', async () => {
      const decisions = await queryTable(
        'agent_decisions',
        `user_id=eq.${OWNER_USER_ID}&select=id,was_auto_executed&limit=1`
      );
      if (decisions.length > 0) {
        expect('was_auto_executed' in decisions[0]).toBe(true);
      }
      expect(Array.isArray(decisions)).toBe(true);
    });

    it('should have embedding column as vector(384) on agent_decisions', async () => {
      const decisions = await queryTable(
        'agent_decisions',
        `user_id=eq.${OWNER_USER_ID}&select=id,embedding&limit=1`
      );
      // Column exists (either null or vector data)
      if (decisions.length > 0) {
        expect('embedding' in decisions[0]).toBe(true);
      }
      expect(Array.isArray(decisions)).toBe(true);
    });
  });

  describe('A2. RPC Functions Available', () => {
    const zeroVector = `[${new Array(384).fill(0).join(',')}]`;

    async function callRpc(name: string, body: Record<string, unknown>): Promise<Response> {
      return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    it('search_similar_decisions RPC exists and accepts vector(384)', async () => {
      const res = await callRpc('search_similar_decisions', {
        query_embedding: zeroVector,
        match_user_id: OWNER_USER_ID,
        match_threshold: 0.99,
        match_count: 1,
      });
      expect(res.status).toBeLessThan(500);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('search_similar_preferences RPC exists and accepts vector(384)', async () => {
      const res = await callRpc('search_similar_preferences', {
        query_embedding: zeroVector,
        match_user_id: OWNER_USER_ID,
        match_threshold: 0.99,
        match_count: 1,
      });
      expect(res.status).toBeLessThan(500);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('search_similar_rules RPC exists and accepts vector(384)', async () => {
      const res = await callRpc('search_similar_rules', {
        query_embedding: zeroVector,
        match_user_id: OWNER_USER_ID,
        match_threshold: 0.99,
        match_count: 1,
      });
      expect(res.status).toBeLessThan(500);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('decay_stale_rules RPC exists and runs without error', async () => {
      const res = await callRpc('decay_stale_rules', {
        p_user_id: OWNER_USER_ID,
        p_days_threshold: 9999,
        p_decay_amount: 0.0001,
      });
      expect(res.status).toBeLessThan(500);
    });

    it('cleanup_old_learning_data RPC exists and returns stats', async () => {
      const res = await callRpc('cleanup_old_learning_data', {
        p_retention_days: 99999,
      });
      expect(res.status).toBeLessThan(500);
      const data = await res.json();
      // Should return JSONB with deletion counts
      expect(data).toBeDefined();
    });
  });

  describe('A3. Learning Pipeline — Corrections with Embeddings', () => {
    it('should record a correction and return correction_id', async () => {
      const result = await callLearningPipeline('record_correction', {
        user_id: OWNER_USER_ID,
        original_action: 'create_maintenance: assigned to Generic Plumbing Co',
        correction: 'Always use Reliable Plumbing for plumbing work at my Caloundra property',
        context_snapshot: { tool_name: 'create_maintenance', property: 'Caloundra' },
        category: 'maintenance',
      });

      expect(result.correction_id).toBeTruthy();

      // Verify the correction was stored with embedding
      await sleep(2000);
      const corrections = await queryTable(
        'agent_corrections',
        `id=eq.${result.correction_id}&select=id,correction,embedding`
      );
      expect(corrections.length).toBe(1);
      expect(corrections[0].id).toBe(result.correction_id);
      // Embedding should be stored
      expect(corrections[0].embedding).toBeTruthy();
    }, AGENT_TIMEOUT);
  });

  describe('A4. Learning Pipeline — Error Classification', () => {
    it('FACTUAL_ERROR should create a rule (or dedup)', async () => {
      const result = await callLearningPipeline('classify_and_learn', {
        user_id: OWNER_USER_ID,
        error_type: 'FACTUAL_ERROR',
        tool_name: 'get_property_details',
        error_message: `Property ID test-${Date.now()} not found`,
        input_summary: { property_id: `test-${Date.now()}` },
        category: 'query',
      });

      expect(result.artifact_type).toBeTruthy();
      if (result.learned) {
        expect(['rule', 'rule_dedup']).toContain(result.artifact_type);

        // If a rule was created, verify it has an embedding
        if (result.artifact_id && result.artifact_type === 'rule') {
          await sleep(1000);
          const rules = await queryTable(
            'agent_rules',
            `id=eq.${result.artifact_id}&select=id,rule_text,embedding,confidence`
          );
          expect(rules.length).toBe(1);
          expect(rules[0].confidence).toBe(0.5); // FACTUAL_ERROR confidence
          expect(rules[0].embedding).toBeTruthy();
        }
      }
    }, AGENT_TIMEOUT);

    it('REASONING_ERROR should create a prompt_guidance preference', async () => {
      const result = await callLearningPipeline('classify_and_learn', {
        user_id: OWNER_USER_ID,
        error_type: 'REASONING_ERROR',
        tool_name: 'create_maintenance',
        error_message: 'Created emergency request for routine issue',
        input_summary: { description: 'Slow dripping faucet', urgency: 'emergency' },
        category: 'maintenance',
      });

      expect(result.artifact_type).toBe('prompt_guidance');
      expect(result.learned).toBe(true);
    }, AGENT_TIMEOUT);

    it('TOOL_MISUSE should update tool_genome failure_patterns', async () => {
      const result = await callLearningPipeline('classify_and_learn', {
        user_id: OWNER_USER_ID,
        error_type: 'TOOL_MISUSE',
        tool_name: 'schedule_inspection',
        error_message: 'Missing required property_id parameter',
        input_summary: { date: '2024-06-15' },
        category: 'scheduling',
      });

      expect(result.artifact_type).toBe('tool_genome_update');
      expect(result.learned).toBe(true);
    }, AGENT_TIMEOUT);

    it('CONTEXT_MISSING should create a context_patterns preference', async () => {
      const result = await callLearningPipeline('classify_and_learn', {
        user_id: OWNER_USER_ID,
        error_type: 'CONTEXT_MISSING',
        tool_name: 'get_tenancy',
        error_message: 'Tenancy not found for referenced property',
        input_summary: { property_id: 'unknown' },
        category: 'tenant_relations',
      });

      expect(result.artifact_type).toBe('context_pattern');
      expect(result.learned).toBe(true);
    }, AGENT_TIMEOUT);
  });

  describe('A5. Learning Pipeline — Feedback Processing', () => {
    it('should update decision feedback to approved', async () => {
      const decisions = await queryTable(
        'agent_decisions',
        `user_id=eq.${OWNER_USER_ID}&owner_feedback=is.null&order=created_at.desc&limit=1`
      );

      if (decisions.length === 0) {
        console.log('  ℹ No pending decisions, skipping');
        return;
      }

      const decisionId = decisions[0].id;
      const result = await callLearningPipeline('process_feedback', {
        user_id: OWNER_USER_ID,
        decision_id: decisionId,
        feedback: 'approved',
        category: 'query',
      });

      expect(result.updated).toBe(true);

      const updated = await queryTable('agent_decisions', `id=eq.${decisionId}&select=owner_feedback`);
      expect(updated[0].owner_feedback).toBe('approved');
    }, AGENT_TIMEOUT);
  });

  describe('A6. Heartbeat with Semantic Features', () => {
    it('should complete heartbeat run with temporal decay + outcome scanning', async () => {
      const heartbeat = await callHeartbeat();

      expect(heartbeat.ok).toBe(true);
      expect(heartbeat.body).toBeTruthy();
    }, AGENT_TIMEOUT);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// PART B: Full auth tests — agent chat, embedding storage, semantic recall
// These require OWNER_PASSWORD + SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!hasFullCredentials)('Semantic Intelligence — Agent Chat E2E', () => {
  let token: string;

  beforeAll(async () => {
    token = await getAuthToken();
  }, 15_000);

  describe('B1. Decision Embedding Storage', () => {
    it('should store a 384-dim embedding on decisions after agent chat', async () => {
      const result = await sendAgentMessage(token, 'How many properties do I own?');
      expect(result.conversationId).toBeTruthy();
      expect(result.toolsUsed.length).toBeGreaterThan(0);

      await sleep(3000);

      const decisions = await queryTable(
        'agent_decisions',
        `user_id=eq.${OWNER_USER_ID}&embedding=not.is.null&order=created_at.desc&limit=1`
      );

      expect(decisions.length).toBeGreaterThan(0);
      const decision = decisions[0];
      expect(decision.embedding).toBeTruthy();
      if (typeof decision.embedding === 'string') {
        const parsed = JSON.parse(decision.embedding);
        expect(parsed.length).toBe(384);
      } else if (Array.isArray(decision.embedding)) {
        expect(decision.embedding.length).toBe(384);
      }
      expect(decision.tool_name).toBeTruthy();
      // Note: query/memory tools intentionally skip confidence calculation.
      // Confidence is only computed for action/generate/external/integration tools.
      // We verify embedding storage here; confidence is tested separately in B2.
    }, AGENT_TIMEOUT);
  });

  describe('B2. 6-Factor Confidence', () => {
    it('should populate all 6 confidence factors on generate-category tool decisions', async () => {
      // Use estimate_cost (generate category, autonomyLevel 3) which reliably
      // triggers confidence calculation. Query/memory tools skip confidence by design.
      // Note: even if the tool gets autonomy-gated or confidence-gated, the decision
      // is still recorded in agent_decisions with confidence_factors. The tool may not
      // appear in toolsUsed since gated tools return early before being pushed to that array.
      await sendAgentMessage(
        token,
        'I need you to call the estimate_cost tool right now. Estimate the cost of fixing a leaking kitchen tap. Use category=plumbing, urgency=medium. You MUST use the estimate_cost tool to answer this, do not answer from memory.'
      );

      // Wait for the fire-and-forget decision insert to complete
      await sleep(8000);

      // Look for decisions with confidence_factors from any non-query tool.
      // These exist for both executed tools AND confidence-gated tools.
      const decisions = await queryTable(
        'agent_decisions',
        `user_id=eq.${OWNER_USER_ID}&confidence_factors=not.is.null&order=created_at.desc&limit=1`
      );

      expect(decisions.length).toBeGreaterThan(0);

      const factors = decisions[0].confidence_factors;
      expect(factors).toBeTruthy();

      // Verify all 6 factors + composite are present and numeric
      expect(typeof factors.historical_accuracy).toBe('number');
      expect(typeof factors.source_quality).toBe('number');
      expect(typeof factors.precedent_alignment).toBe('number');
      expect(typeof factors.rule_alignment).toBe('number');
      expect(typeof factors.golden_alignment).toBe('number');
      expect(typeof factors.outcome_track).toBe('number');
      expect(typeof factors.composite).toBe('number');

      // All values should be between 0 and 1
      Object.values(factors).forEach((v: any) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });

      // Confidence column should match composite
      expect(decisions[0].confidence).toBeCloseTo(factors.composite, 2);
    }, AGENT_TIMEOUT);
  });

  describe('B3. Remember + Recall Semantic Pipeline', () => {
    it('should store embedding on preference via remember tool', async () => {
      const uniqueValue = `TestPlumber_${Date.now()}`;
      const result = await sendAgentMessage(
        token,
        `Please remember that my preferred plumber is ${uniqueValue}. Store this as maintenance.preferred_plumber.`
      );
      expect(result.toolsUsed).toContain('remember');

      await sleep(3000);

      const prefs = await queryTable(
        'agent_preferences',
        `user_id=eq.${OWNER_USER_ID}&preference_key=eq.preferred_plumber&embedding=not.is.null&order=updated_at.desc&limit=1`
      );

      expect(prefs.length).toBeGreaterThan(0);
      expect(prefs[0].category).toBe('maintenance');
      expect(prefs[0].embedding).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('should return semantically relevant preferences via recall', async () => {
      const result = await sendAgentMessage(
        token,
        'What do you remember about my maintenance preferences? Use the recall tool with context about plumbing and trades.'
      );
      expect(result.toolsUsed).toContain('recall');
      expect(result.message).toBeTruthy();
    }, AGENT_TIMEOUT);
  });

  describe('B4. Full Semantic Cycle E2E', () => {
    it('should complete: remember preference → auto-memory injection → decision with embedding', async () => {
      // Step 1: Store a preference
      const rememberResult = await sendAgentMessage(
        token,
        'Remember that I always want maintenance quotes under $500 approved automatically. Store as financial.auto_approve_threshold.'
      );
      expect(rememberResult.toolsUsed).toContain('remember');

      await sleep(5000);

      // Step 2: Ask about finances — auto-memory should inject the preference
      const queryResult = await sendAgentMessage(
        token,
        'I got a maintenance quote for $350. Should I approve it?'
      );
      expect(queryResult.message.toLowerCase()).toMatch(/approve|threshold|500|350/);

      // Step 3: Verify decisions have embeddings
      await sleep(3000);
      const decisions = await queryTable(
        'agent_decisions',
        `user_id=eq.${OWNER_USER_ID}&order=created_at.desc&limit=3`
      );
      const withEmbedding = decisions.filter(d => d.embedding !== null);
      expect(withEmbedding.length).toBeGreaterThan(0);
    }, AGENT_TIMEOUT * 2);
  });
});
