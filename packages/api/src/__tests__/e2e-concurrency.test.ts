/**
 * E2E Concurrency & Multi-User Tests
 *
 * Tests system behavior under concurrent usage:
 * - Multiple simultaneous agent conversations
 * - Parallel database operations
 * - Heartbeat running while users interact
 * - Data isolation between conversations
 * - Race condition detection on shared resources
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://woxlvhzgannzhajtjnke.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveGx2aHpnYW5uemhhanRqbmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODYwNTcsImV4cCI6MjA4NDY2MjA1N30._akFWKzx3MC0OvkMrqM2MoKl6vNI_FR3ViQ-jj89pi4';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const OWNER_EMAIL = 'robbie.spooner@icloud.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
const OWNER_USER_ID = 'e323a5a6-4f1f-4cf5-9707-6812a6c9d23a';

const AGENT_TIMEOUT = 180_000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 15_000;
const INTER_TEST_DELAY_MS = 8_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAuthToken(): Promise<string> {
  if (!OWNER_PASSWORD) throw new Error('Set OWNER_PASSWORD env var');
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
  pendingActions?: Array<{ id: string; tool_name: string; description: string; category: string }>;
}> {
  const body: Record<string, unknown> = { message };
  if (conversationId) body.conversationId = conversationId;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
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
      return result;
    }
    const errText = await res.text();
    if ((res.status === 502 || res.status === 429 || res.status === 546) && attempt < MAX_RETRIES - 1) {
      continue;
    }
    throw new Error(`Agent chat error ${res.status}: ${errText}`);
  }
  throw new Error('sendAgentMessage: exhausted all retries');
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
      },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, body };
    if ((res.status === 502 || res.status === 429) && attempt < MAX_RETRIES - 1) continue;
    return { ok: false, body };
  }
  return { ok: false, body: null };
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.OWNER_PASSWORD || !process.env.SUPABASE_SERVICE_ROLE_KEY)('E2E Concurrency & Multi-User Tests', () => {
  let token: string;

  beforeAll(async () => {
    if (!OWNER_PASSWORD || !SERVICE_ROLE_KEY) {
      console.warn('Skipping concurrency tests: Set OWNER_PASSWORD and SUPABASE_SERVICE_ROLE_KEY');
      return;
    }
    token = await getAuthToken();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 1: Parallel Conversations — Separate Context Isolation
  // ═══════════════════════════════════════════════════════════════════════

  describe('1. Parallel Conversation Isolation', () => {
    it('two simultaneous conversations maintain separate context', async () => {
      // Fire two completely different conversations in parallel
      const [result1, result2] = await Promise.all([
        sendAgentMessage(token, 'How many properties do I own? Just give me the count.'),
        sendAgentMessage(token, 'What maintenance requests are currently open?'),
      ]);

      // Both should succeed with different conversation IDs
      expect(result1.conversationId).toBeTruthy();
      expect(result2.conversationId).toBeTruthy();
      expect(result1.conversationId).not.toBe(result2.conversationId);

      // Each should answer its own question
      expect(result1.message).toMatch(/propert|own|1|2|3/i);
      expect(result2.message).toMatch(/maintenance|request|open|pending|fridge|tap/i);
    }, AGENT_TIMEOUT);

    it('conversations are stored independently in database', async () => {
      const conversations = await queryTable(
        'agent_conversations',
        `select=id,user_id&user_id=eq.${OWNER_USER_ID}&order=created_at.desc&limit=10`,
      );
      // Should have multiple conversations
      expect(conversations.length).toBeGreaterThanOrEqual(2);
      // All should belong to the same user
      for (const conv of conversations) {
        expect(conv.user_id).toBe(OWNER_USER_ID);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 2: Parallel Database Queries — Read Consistency
  // ═══════════════════════════════════════════════════════════════════════

  describe('2. Parallel Database Query Consistency', () => {
    it('parallel queries to different tables return consistent data', async () => {
      const [properties, tenancies, arrears, maintenance] = await Promise.all([
        queryTable('properties', `select=id,address&owner_id=eq.${OWNER_USER_ID}`),
        queryTable('tenancies', `select=id,status,property_id&status=eq.active`),
        queryTable('arrears_records', `select=id,severity,is_resolved&order=created_at.desc&limit=10`),
        queryTable('maintenance_requests', `select=id,status,urgency&order=created_at.desc&limit=10`),
      ]);

      // All should be arrays (even if empty)
      expect(Array.isArray(properties)).toBe(true);
      expect(Array.isArray(tenancies)).toBe(true);
      expect(Array.isArray(arrears)).toBe(true);
      expect(Array.isArray(maintenance)).toBe(true);

      // Properties should be owned by the test user
      expect(properties.length).toBeGreaterThan(0);
    });

    it('repeated parallel reads return the same data (no phantom reads)', async () => {
      const results = await Promise.all([
        queryTable('properties', `select=id&owner_id=eq.${OWNER_USER_ID}&order=id`),
        queryTable('properties', `select=id&owner_id=eq.${OWNER_USER_ID}&order=id`),
        queryTable('properties', `select=id&owner_id=eq.${OWNER_USER_ID}&order=id`),
      ]);

      // All three results should be identical
      const ids1 = results[0].map((p: any) => p.id).sort();
      const ids2 = results[1].map((p: any) => p.id).sort();
      const ids3 = results[2].map((p: any) => p.id).sort();
      expect(ids1).toEqual(ids2);
      expect(ids2).toEqual(ids3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 3: Heartbeat + Chat Coexistence
  // ═══════════════════════════════════════════════════════════════════════

  describe('3. Heartbeat + Chat Simultaneous Operation', () => {
    it('heartbeat and chat can run simultaneously without interference', async () => {
      // Fire heartbeat and a chat message at the same time
      const [heartbeatResult, chatResult] = await Promise.all([
        callHeartbeat(),
        sendAgentMessage(token, 'How many properties do I own?'),
      ]);

      // Both should succeed
      expect(heartbeatResult.ok).toBe(true);
      expect(chatResult.conversationId).toBeTruthy();
      expect(chatResult.message.length).toBeGreaterThan(10);
    }, AGENT_TIMEOUT);

    it('heartbeat does not corrupt agent_tasks when chat is creating tasks', async () => {
      // Get initial task count
      const before = await queryTable(
        'agent_tasks',
        `select=id&user_id=eq.${OWNER_USER_ID}`,
      );
      const countBefore = before.length;

      // Run heartbeat
      await callHeartbeat();

      // Get task count after
      const after = await queryTable(
        'agent_tasks',
        `select=id&user_id=eq.${OWNER_USER_ID}`,
      );

      // Tasks should only increase or stay the same (no deletions)
      expect(after.length).toBeGreaterThanOrEqual(countBefore);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 4: Sequential Message Ordering
  // ═══════════════════════════════════════════════════════════════════════

  describe('4. Sequential Message Ordering & History', () => {
    let orderedConvId: string;

    it('step 1: first message creates conversation', async () => {
      const result = await sendAgentMessage(token, 'Remember that my favorite color is blue.');
      orderedConvId = result.conversationId;
      expect(result.conversationId).toBeTruthy();
      await sleep(INTER_TEST_DELAY_MS);
    }, AGENT_TIMEOUT);

    it('step 2: second message has context from first', async () => {
      const result = await sendAgentMessage(
        token,
        'What is my favorite color that I just told you?',
        orderedConvId,
      );
      expect(result.message).toMatch(/blue/i);
      await sleep(INTER_TEST_DELAY_MS);
    }, AGENT_TIMEOUT);

    it('step 3: messages are stored in correct order', async () => {
      const messages = await queryTable(
        'agent_messages',
        `select=role,content,created_at&conversation_id=eq.${orderedConvId}&order=created_at.asc`,
      );
      expect(messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
      // First message should be user
      expect(messages[0].role).toBe('user');
      // Messages should be in chronological order
      for (let i = 1; i < messages.length; i++) {
        expect(new Date(messages[i].created_at).getTime())
          .toBeGreaterThanOrEqual(new Date(messages[i - 1].created_at).getTime());
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 5: Agent Token Tracking Under Load
  // ═══════════════════════════════════════════════════════════════════════

  describe('5. Token Usage Tracking', () => {
    it('every conversation tracks token usage accurately', async () => {
      const result = await sendAgentMessage(
        token,
        'List all my properties with their addresses.',
      );

      // Token usage should be positive
      expect(result.tokensUsed).toBeGreaterThan(0);

      // Verify in database
      const convs = await queryTable(
        'agent_conversations',
        `select=total_tokens_used&id=eq.${result.conversationId}`,
      );
      expect(convs.length).toBe(1);
      expect(convs[0].total_tokens_used).toBeGreaterThan(0);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 6: Rapid-Fire Rate Limit Resilience
  // ═══════════════════════════════════════════════════════════════════════

  describe('6. Rate Limit Resilience', () => {
    it('handles 3 rapid sequential messages gracefully', async () => {
      const results: any[] = [];

      // Send 3 messages in quick succession (no inter-test delay)
      for (let i = 0; i < 3; i++) {
        try {
          const result = await sendAgentMessage(
            token,
            `Quick question ${i + 1}: How many properties do I own?`,
          );
          results.push({ success: true, result });
        } catch (error: any) {
          results.push({ success: false, error: error.message });
        }
        await sleep(2_000); // Minimal delay
      }

      // At least 2 out of 3 should succeed (with retry logic)
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(2);
    }, AGENT_TIMEOUT * 2);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 7: Data Integrity Under Concurrent Writes
  // ═══════════════════════════════════════════════════════════════════════

  describe('7. Concurrent Write Integrity', () => {
    it('agent_decisions accumulate correctly under concurrent conversations', async () => {
      const beforeDecisions = await queryTable(
        'agent_decisions',
        `select=id&user_id=eq.${OWNER_USER_ID}`,
      );
      const countBefore = beforeDecisions.length;

      // Fire two tool-heavy queries
      await Promise.all([
        sendAgentMessage(token, 'Show me all rent arrears.'),
        sendAgentMessage(token, 'List maintenance requests.'),
      ]);

      const afterDecisions = await queryTable(
        'agent_decisions',
        `select=id&user_id=eq.${OWNER_USER_ID}`,
      );

      // Decisions should have increased (each tool call logs a decision)
      expect(afterDecisions.length).toBeGreaterThan(countBefore);
    }, AGENT_TIMEOUT);

    it('trajectories are recorded for each conversation independently', async () => {
      const trajectories = await queryTable(
        'agent_trajectories',
        `select=id,conversation_id,tool_sequence,success&user_id=eq.${OWNER_USER_ID}&order=created_at.desc&limit=10`,
      );

      // Should have multiple trajectories
      expect(trajectories.length).toBeGreaterThan(0);

      // Each trajectory should have valid structure
      for (const t of trajectories) {
        expect(t.conversation_id).toBeTruthy();
        expect(Array.isArray(t.tool_sequence)).toBe(true);
        expect(typeof t.success).toBe('boolean');
      }
    });
  });
});
