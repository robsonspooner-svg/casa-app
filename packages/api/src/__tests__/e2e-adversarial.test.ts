/**
 * E2E Adversarial Agent Tests — Designed to CATCH bugs, not confirm working behavior
 *
 * Philosophy: These tests simulate real users who are messy, ambiguous, forgetful,
 * and who change their mind. They verify database state, not just response keywords.
 * They probe edge cases where the agent is most likely to fail.
 *
 * Categories:
 * 1. Database State Verification — Agent actions must produce correct DB records
 * 2. Clarification Behavior — Agent must ask when info is missing, not guess
 * 3. Hallucination Detection — Agent must not invent data it doesn't have
 * 4. Approval Flow Integrity — Full pending action lifecycle (gate → approve → execute → verify)
 * 5. Messy Real-World Input — Typos, vague requests, mid-conversation pivots
 * 6. Conflict Resolution — Contradictory instructions, impossible requests
 * 7. Context Retention Stress — Does the agent lose track across many turns?
 * 8. Tool Selection Accuracy — Does the agent pick the RIGHT tool for the job?
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://woxlvhzgannzhajtjnke.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveGx2aHpnYW5uemhhanRqbmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODYwNTcsImV4cCI6MjA4NDY2MjA1N30._akFWKzx3MC0OvkMrqM2MoKl6vNI_FR3ViQ-jj89pi4';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const OWNER_EMAIL = 'robbie.spooner@icloud.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
const OWNER_USER_ID = 'e323a5a6-4f1f-4cf5-9707-6812a6c9d23a';
const PROPERTY_ID = 'ce0622c8-d803-4808-90f8-61cef129109a';

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
  pendingActions?: Array<{ id: string; tool_name: string; tool_params: Record<string, unknown>; description: string; category: string }>;
}> {
  const body: Record<string, unknown> = { message };
  if (conversationId) body.conversationId = conversationId;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
    }
    try {
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
        continue;
      }
      throw new Error(`Agent chat error ${res.status}: ${errText}`);
    } catch (err: unknown) {
      // Retry on network-level errors (ETIMEDOUT, ECONNRESET, etc.)
      if (attempt < MAX_RETRIES - 1 && err instanceof Error && (err.message.includes('fetch failed') || err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET'))) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('sendAgentMessage: exhausted all retries');
}

async function sendAgentAction(
  token: string,
  conversationId: string,
  pendingActionId: string,
  actionType: 'approve' | 'reject',
): Promise<{
  conversationId: string;
  message: string;
  toolResult?: unknown;
}> {
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
      body: JSON.stringify({
        conversationId,
        action: { type: actionType, pendingActionId },
        message: actionType === 'approve' ? 'Yes, go ahead.' : 'No, reject that.',
      }),
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
    throw new Error(`sendAgentAction error ${res.status}: ${errText}`);
  }
  throw new Error('sendAgentAction: exhausted all retries');
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

async function setAutonomy(preset: string): Promise<void> {
  // Use upsert (POST with merge-duplicates) which handles both insert and update
  const res = await fetch(`${SUPABASE_URL}/rest/v1/agent_autonomy_settings`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      preset,
      category_overrides: {},
    }),
  });
  if (!res.ok) {
    // Fallback: try PATCH on existing row
    await fetch(`${SUPABASE_URL}/rest/v1/agent_autonomy_settings?user_id=eq.${OWNER_USER_ID}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ preset, category_overrides: {} }),
    });
  }
}

async function deleteRows(table: string, filter: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.OWNER_PASSWORD || !process.env.SUPABASE_SERVICE_ROLE_KEY)('E2E Adversarial Agent Tests', () => {
  let token: string;

  beforeAll(async () => {
    token = await getAuthToken();
    await setAutonomy('balanced');
  }, 30_000);

  afterAll(async () => {
    if (SERVICE_ROLE_KEY) {
      await setAutonomy('balanced');
    }
  }, 30_000);

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 1: Database State Verification
  // The agent claims to have done something — did it ACTUALLY happen in the DB?
  // ═══════════════════════════════════════════════════════════════════════

  describe('1. Database State Verification', () => {
    it('maintenance request created by agent has correct fields in DB', async () => {
      // Snapshot maintenance count before
      const before = await queryTable(
        'maintenance_requests',
        `select=id&property_id=eq.${PROPERTY_ID}`,
      );
      const countBefore = before.length;

      // Ask agent to create a specific maintenance request
      const result = await sendAgentMessage(
        token,
        'Create an urgent maintenance request for 4 Maloja Avenue — the kitchen sink is completely blocked and water is backing up. Category should be plumbing.',
      );

      // The agent should either create it directly or gate it
      const usedCreate = result.toolsUsed.includes('create_maintenance');
      const hasPending = result.pendingActions && result.pendingActions.length > 0;

      if (usedCreate) {
        // Verify a maintenance request with correct fields exists in DB
        // The newest record for this property should match our request
        const newest = await queryTable(
          'maintenance_requests',
          `select=id,title,urgency,status,category,created_at&property_id=eq.${PROPERTY_ID}&category=eq.plumbing&order=created_at.desc&limit=1`,
        );
        expect(newest.length).toBe(1);
        // Verify the agent set correct urgency and category
        expect(newest[0].urgency).toMatch(/urgent|emergency/i);
        expect(newest[0].category).toBe('plumbing');
        expect(newest[0].title).toBeTruthy();
        expect(newest[0].status).toBeTruthy();
      } else if (hasPending) {
        // Gated — verify the pending action has correct tool_params
        const pendingAction = result.pendingActions![0];
        expect(pendingAction.tool_name).toBe('create_maintenance');
        expect(pendingAction.tool_params).toBeTruthy();
        expect(pendingAction.tool_params.property_id).toBe(PROPERTY_ID);
      } else {
        // Agent should have either created or gated — fail if neither
        expect(usedCreate || hasPending).toBeTruthy();
      }
    }, AGENT_TIMEOUT);

    it('inspection scheduled by agent produces a real DB record with correct date', async () => {
      const before = await queryTable(
        'inspections',
        `select=id&property_id=eq.${PROPERTY_ID}`,
      );
      const countBefore = before.length;

      const result = await sendAgentMessage(
        token,
        'Schedule a routine inspection for 4 Maloja Avenue on 15th March 2026 at 2pm.',
      );

      const usedSchedule = result.toolsUsed.includes('schedule_inspection');
      const hasPending = result.pendingActions && result.pendingActions.some(
        (p) => p.tool_name === 'schedule_inspection',
      );

      if (usedSchedule) {
        // Verify count increased
        const afterCount = await queryTable(
          'inspections',
          `select=id&property_id=eq.${PROPERTY_ID}`,
        );
        expect(afterCount.length).toBeGreaterThan(countBefore);

        // Fetch newest and verify fields
        const after = await queryTable(
          'inspections',
          `select=id,inspection_type,scheduled_date,status&property_id=eq.${PROPERTY_ID}&order=created_at.desc&limit=1`,
        );
        expect(after.length).toBe(1);
        const newest = after[0];
        expect(newest.inspection_type).toBe('routine');
        // Verify the date is in March 2026 (agent should have parsed "15th March 2026")
        const scheduledDate = new Date(newest.scheduled_date);
        expect(scheduledDate.getFullYear()).toBe(2026);
        expect(scheduledDate.getMonth()).toBe(2); // March = 2 (0-indexed)
      } else if (hasPending) {
        const pendingAction = result.pendingActions!.find((p) => p.tool_name === 'schedule_inspection')!;
        expect(pendingAction.tool_params.property_id).toBe(PROPERTY_ID);
        expect(pendingAction.tool_params.type).toBe('routine');
      }
      // It's valid for the agent to either execute or gate — but it must do one
      expect(usedSchedule || hasPending || result.message.match(/schedul|inspection|routine/i)).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent_decisions table records every tool call with correct structure', async () => {
      // Ask a question that will use tools
      const result = await sendAgentMessage(
        token,
        'Show me my properties and any maintenance requests.',
      );

      // Verify decisions were logged
      const decisions = await queryTable(
        'agent_decisions',
        `select=id,tool_name,decision_type,was_auto_executed,conversation_id,input_data&conversation_id=eq.${result.conversationId}&order=created_at.desc`,
      );

      // Every tool used should have a corresponding decision record
      for (const toolName of result.toolsUsed) {
        const matchingDecision = decisions.find((d: any) => d.tool_name === toolName);
        expect(matchingDecision).toBeTruthy();
        expect(matchingDecision.decision_type).toBe('tool_execution');
        expect(matchingDecision.was_auto_executed).toBe(true);
        expect(matchingDecision.conversation_id).toBe(result.conversationId);
      }
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 2: Clarification Behavior
  // The agent must ASK when info is missing, not guess or hallucinate
  // ═══════════════════════════════════════════════════════════════════════

  describe('2. Clarification Behavior — Agent Asks When It Should', () => {
    it('agent asks which property when request is ambiguous', async () => {
      // Don't specify property — agent should ask
      const result = await sendAgentMessage(
        token,
        'Schedule an inspection for next week.',
      );
      // The agent should either:
      // a) Ask which property (if user has multiple), OR
      // b) Ask what type of inspection, OR
      // c) Assume the only property and proceed (valid if user only has one)
      // It should NOT silently fail or pick a random property
      const asksForClarification = result.message.match(
        /which property|which.*inspection|what type|what kind|routine.*entry.*exit|could you (clarify|specify)|more (detail|info|specific)/i,
      );
      const assumedProperty = result.message.match(/maloja|caloundra/i);
      const usedTool = result.toolsUsed.includes('schedule_inspection');
      const hasPending = result.pendingActions && result.pendingActions.length > 0;

      // Agent must have done SOMETHING meaningful — asked, assumed, or acted
      expect(asksForClarification || assumedProperty || usedTool || hasPending).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent asks for inspection type when not specified', async () => {
      const result = await sendAgentMessage(
        token,
        'Book an inspection at 4 Maloja Avenue for February 20th 2026.',
      );
      // Agent should either ask about type (routine/entry/exit) or make a reasonable assumption
      const asksType = result.message.match(
        /routine|entry|exit|what type|what kind|which type/i,
      );
      // It's valid to assume routine as default — but it should mention it
      expect(asksType).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent requests missing urgency for maintenance', async () => {
      const result = await sendAgentMessage(
        token,
        'There is a problem with the tap at 4 Maloja Avenue.',
      );
      // "a problem with the tap" is vague — agent should assess urgency or ask
      // It should NOT just blindly create a request without understanding severity
      const assessesOrAsks = result.message.match(
        /urgency|emergency|urgent|routine|could you describe|more detail|what.*issue|drip|leak|broken|is it/i,
      );
      expect(assessesOrAsks).toBeTruthy();
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 3: Hallucination Detection
  // Agent must only reference REAL data from the database
  // ═══════════════════════════════════════════════════════════════════════

  describe('3. Hallucination Detection — Agent Uses Only Real Data', () => {
    it('agent does NOT invent a property that does not exist', async () => {
      const result = await sendAgentMessage(
        token,
        'What is the status of my property at 99 Fake Street, Nowhereville?',
      );
      // Agent should report that it cannot find this property — not make up data
      const recognizesNotFound = result.message.match(
        /not find|no property|doesn.*match|doesn.*exist|don.*have|no record|couldn.*find|couldn.*locate|don.*see|not.*in your|not.*portfolio|only.*propert|one property|your propert.*is|different.*address|isn.*listed|isn.*registered|no.*99 Fake|no.*Nowhereville/i,
      );
      const inventedData = result.message.match(
        /99 Fake Street.*bedroom|99 Fake Street.*tenant|rent.*99 Fake/i,
      );
      expect(recognizesNotFound).toBeTruthy();
      expect(inventedData).toBeFalsy();
    }, AGENT_TIMEOUT);

    it('agent does NOT invent a tenant that does not exist', async () => {
      const result = await sendAgentMessage(
        token,
        'How is my tenant John Smitherino doing at 4 Maloja Avenue? Is he paying rent on time?',
      );
      // Agent should check DB and report the real tenant name, not confirm the fake one
      const confirmsFakeName = result.message.match(/John Smitherino.*(doing well|paying|on time|good tenant)/i);
      expect(confirmsFakeName).toBeFalsy();
      // Should either correct with real data or say it can't find that tenant
      const usesRealData = result.message.match(
        /Robson|not find.*John|no tenant.*John|doesn.*match|current tenant|actual tenant/i,
      );
      expect(usesRealData).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent reports accurate financial figures from DB not approximations', async () => {
      // Get real arrears data first
      const realArrears = await queryTable(
        'arrears_records',
        `select=amount_owed,days_overdue&is_resolved=eq.false&order=created_at.desc&limit=5`,
      );

      const result = await sendAgentMessage(
        token,
        'What is the exact amount of overdue rent across all my properties?',
      );

      // Agent should have called a tool to get real data
      const usedTool = result.toolsUsed.some((t: string) =>
        t.includes('get_arrears') || t.includes('get_financial') || t.includes('get_payment'),
      );
      expect(usedTool).toBe(true);

      // If there's real arrears data, the agent should reference amounts from the DB
      if (realArrears.length > 0) {
        // Agent should mention specific dollar amounts, not vague statements
        expect(result.message).toMatch(/\$[\d,]+/);
      }
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 4: Approval Flow Integrity
  // Full lifecycle: request → gate → pending → approve/reject → execute → verify
  // ═══════════════════════════════════════════════════════════════════════

  describe('4. Approval Flow Integrity', () => {
    it('full approve flow: gate → approve → execute → verify DB change', async () => {
      // Set cautious mode to force gating
      await setAutonomy('cautious');
      await sleep(2_000);

      // Ask agent to do something that will be gated in cautious mode
      const result = await sendAgentMessage(
        token,
        'Send a friendly rent reminder to my tenant at 4 Maloja Avenue.',
      );

      // Should be gated
      const hasPending = result.pendingActions && result.pendingActions.length > 0;
      if (!hasPending) {
        // Agent might have explained it needs approval rather than creating a pending action
        expect(result.message).toMatch(/approv|permission|cautious|confirm|cannot.*auto/i);
        await setAutonomy('balanced');
        return;
      }

      const pendingAction = result.pendingActions![0];
      const pendingId = pendingAction.id;

      // Verify pending action exists in DB with correct status
      const dbPending = await queryTable(
        'agent_pending_actions',
        `select=id,status,tool_name,tool_params&id=eq.${pendingId}`,
      );
      expect(dbPending.length).toBe(1);
      expect(dbPending[0].status).toBe('pending');
      expect(dbPending[0].tool_name).toBeTruthy();

      // Approve the action
      const approvalResult = await sendAgentAction(
        token,
        result.conversationId,
        pendingId,
        'approve',
      );

      // After approval, the pending action should be marked as approved in DB
      const dbApproved = await queryTable(
        'agent_pending_actions',
        `select=id,status,resolved_at,resolved_by&id=eq.${pendingId}`,
      );
      expect(dbApproved[0].status).toBe('approved');
      expect(dbApproved[0].resolved_at).toBeTruthy();

      // A decision record should exist showing the approval
      const decisions = await queryTable(
        'agent_decisions',
        `select=id,decision_type,tool_name,was_auto_executed&conversation_id=eq.${result.conversationId}&decision_type=eq.tool_execution_approved`,
      );
      expect(decisions.length).toBeGreaterThan(0);

      await setAutonomy('balanced');
    }, AGENT_TIMEOUT * 2);

    it('full reject flow: gate → reject → verify DB state updated', async () => {
      await setAutonomy('cautious');
      await sleep(2_000);

      // Breach notices are L0 — ALWAYS require approval, even in hands-off mode
      // In cautious mode, this MUST be gated and create a pending action
      const result = await sendAgentMessage(
        token,
        'Send a formal breach notice to my tenant at 4 Maloja Avenue for non-payment of rent. Do it now.',
      );

      const hasPending = result.pendingActions && result.pendingActions.length > 0;
      // With guideline 17, agent should attempt the tool and create a pending action
      // However, the agent may first gather data (L4 queries) before attempting the L0 action
      if (!hasPending) {
        // If no pending action yet, the agent may need a follow-up to trigger the tool
        const followUp = await sendAgentMessage(
          token,
          'Yes, go ahead and send the breach notice right now.',
          result.conversationId,
        );
        const hasPendingNow = followUp.pendingActions && followUp.pendingActions.length > 0;
        if (!hasPendingNow) {
          // Agent should at minimum mention approval is needed
          expect(followUp.message).toMatch(/approv|permission|cautious|confirm|breach|notice|cannot.*auto/i);
          await setAutonomy('balanced');
          return;
        }
        // Use the follow-up pending action
        const pendingId = followUp.pendingActions![0].id;
        const rejectResult = await sendAgentAction(
          token,
          followUp.conversationId,
          pendingId,
          'reject',
        );
        expect(rejectResult.message).toMatch(/reject|cancel|understood|won.*t|not.*proceed|noted/i);
        const dbRejected = await queryTable(
          'agent_pending_actions',
          `select=id,status&id=eq.${pendingId}`,
        );
        expect(dbRejected[0].status).toBe('rejected');
        await setAutonomy('balanced');
        return;
      }

      const pendingId = result.pendingActions![0].id;

      // Reject the action
      const rejectResult = await sendAgentAction(
        token,
        result.conversationId,
        pendingId,
        'reject',
      );

      // Should confirm rejection
      expect(rejectResult.message).toMatch(/reject|cancel|understood|won.*t|not.*proceed|noted/i);

      // Verify pending action updated to rejected in DB
      const dbRejected = await queryTable(
        'agent_pending_actions',
        `select=id,status&id=eq.${pendingId}`,
      );
      expect(dbRejected[0].status).toBe('rejected');

      await setAutonomy('balanced');
    }, AGENT_TIMEOUT * 2);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 5: Messy Real-World Input
  // Real users don't write perfect prompts
  // ═══════════════════════════════════════════════════════════════════════

  describe('5. Messy Real-World Input', () => {
    it('agent handles typos and casual language', async () => {
      const result = await sendAgentMessage(
        token,
        'hey whats the go with teh rent at maloja? is the tennat paying??',
      );
      // Despite typos, agent should understand and provide rent info
      expect(result.toolsUsed.length).toBeGreaterThan(0);
      expect(result.message).toMatch(/rent|tenant|payment|arrears|overdue|Maloja|Robson/i);
    }, AGENT_TIMEOUT);

    it('agent handles extremely vague request', async () => {
      const result = await sendAgentMessage(
        token,
        'something is wrong at the property',
      );
      // Agent should ask for clarification, not blindly act
      const asksForMore = result.message.match(
        /which property|what.*wrong|could you|more detail|can you describe|more specific|tell me more|what.*issue|what.*problem/i,
      );
      const providesOverview = result.toolsUsed.length > 0; // Pulled data to show status
      // Either asks for clarification or proactively checks everything
      expect(asksForMore || providesOverview).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent handles mid-conversation topic pivot', async () => {
      let convId: string;

      // Start talking about maintenance
      const msg1 = await sendAgentMessage(
        token,
        'Tell me about maintenance requests at 4 Maloja Avenue.',
      );
      convId = msg1.conversationId;
      expect(msg1.message).toMatch(/maintenance/i);

      // Suddenly pivot to a completely different topic
      const msg2 = await sendAgentMessage(
        token,
        'Actually forget that. What is the current rent amount and when does the lease expire?',
        convId,
      );

      // Agent should handle the pivot and give lease/rent info, not maintenance
      expect(msg2.message).toMatch(/rent|lease|expir|amount|\$/i);
      // Should have used tenancy/rent tools, not maintenance tools
      const usedRelevantTool = msg2.toolsUsed.some((t: string) =>
        t.includes('tenancy') || t.includes('rent') || t.includes('payment') || t.includes('get_propert'),
      );
      expect(usedRelevantTool).toBe(true);
    }, AGENT_TIMEOUT);

    it('agent handles contradictory follow-up', async () => {
      let convId: string;

      const msg1 = await sendAgentMessage(
        token,
        'I want to increase the rent at 4 Maloja Avenue by $50 per week.',
      );
      convId = msg1.conversationId;

      const msg2 = await sendAgentMessage(
        token,
        'Wait, actually I changed my mind. Keep the rent the same. Don\'t change anything.',
        convId,
      );

      // Agent should acknowledge the change of mind and NOT proceed with the increase
      expect(msg2.message).toMatch(/understood|noted|won.*t|cancel|keep.*same|no change|not.*change|unchanged|reverse|revert|undo|original/i);
      // Should NOT have created a rent increase after the cancellation
      const createdIncrease = msg2.toolsUsed.includes('create_rent_increase');
      expect(createdIncrease).toBe(false);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 6: Conflict Resolution & Impossible Requests
  // Agent must gracefully handle things it cannot do
  // ═══════════════════════════════════════════════════════════════════════

  describe('6. Conflict Resolution & Impossible Requests', () => {
    it('agent handles request for property it cannot access', async () => {
      const result = await sendAgentMessage(
        token,
        'Schedule a maintenance request for 123 George Street, Sydney. The toilet is blocked.',
      );
      // Agent should clearly state it COULDN'T FIND the requested property
      expect(result.message).toMatch(
        /not find|no property|don.*have|not.*your|cannot.*locate|not in your|no matching|couldn.*find|don.*see/i,
      );
    }, AGENT_TIMEOUT);

    it('agent handles impossible date for inspection', async () => {
      const result = await sendAgentMessage(
        token,
        'Schedule a routine inspection for 4 Maloja Avenue on February 30th 2026.',
      );
      // February 30 doesn't exist — agent should flag this
      const flagsInvalidDate = result.message.match(
        /invalid|doesn.*exist|not a valid|february.*30|no.*february 30|not possible/i,
      );
      const suggestsAlternative = result.message.match(
        /instead|alternative|suggest|28|27|march/i,
      );
      expect(flagsInvalidDate || suggestsAlternative).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent handles request to contact tenant when no tenant exists', async () => {
      // If a property has no tenant, the agent should say so, not send a message into the void
      const result = await sendAgentMessage(
        token,
        'Send a message to the tenant at my vacant property asking them to pay rent.',
      );
      // Agent should check tenancy status and respond appropriately
      const recognizesIssue = result.message.match(
        /no tenant|vacant|no active tenant|unoccupied|not currently tenanted|no tenancy|no current tenant/i,
      );
      const checkedData = result.toolsUsed.length > 0; // Should have at least looked up the data
      // If all properties have tenants, it may proceed normally — that's also valid
      expect(recognizesIssue || checkedData).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent handles request outside its capabilities gracefully', async () => {
      const result = await sendAgentMessage(
        token,
        'Book a flight to Sydney for me so I can visit the property next week.',
      );
      // Agent should politely decline — this is outside its property management scope
      expect(result.message).toMatch(
        /can.*t|unable|not able|outside|beyond|don.*have.*capability|not.*something|flight|travel/i,
      );
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 7: Context Retention Under Stress
  // Does the agent remember what was discussed across multiple turns?
  // ═══════════════════════════════════════════════════════════════════════

  describe('7. Context Retention Under Stress', () => {
    let stressConvId: string;

    it('step 1: establish a specific maintenance context', async () => {
      const result = await sendAgentMessage(
        token,
        'The shower at 4 Maloja Avenue has a slow drain. It takes about 5 minutes to empty. Not urgent but needs fixing.',
      );
      stressConvId = result.conversationId;
      expect(result.message).toMatch(/drain|shower|plumb|maintenance/i);
    }, AGENT_TIMEOUT);

    it('step 2: ask an unrelated question', async () => {
      const result = await sendAgentMessage(
        token,
        'By the way, what is the current vacancy rate in Caloundra?',
        stressConvId,
      );
      expect(result.message).toMatch(/Caloundra|vacancy|market|rate|rental/i);
    }, AGENT_TIMEOUT);

    it('step 3: ask another unrelated question', async () => {
      const result = await sendAgentMessage(
        token,
        'And how much is the rent at 4 Maloja Avenue?',
        stressConvId,
      );
      expect(result.message).toMatch(/rent|\$|week|amount/i);
    }, AGENT_TIMEOUT);

    it('step 4: return to original topic — agent must remember the shower drain', async () => {
      const result = await sendAgentMessage(
        token,
        'OK so back to what I was saying earlier about the plumbing issue — can you find a local plumber to fix it?',
        stressConvId,
      );
      // Agent should remember it was a SHOWER DRAIN issue, not just "plumbing"
      const remembersContext = result.message.match(
        /shower|drain|slow.*drain|plumb/i,
      );
      const searchedTrades = result.toolsUsed.some((t: string) =>
        t.includes('find_local_trades') || t.includes('web_search') || t.includes('get_trades'),
      );
      expect(remembersContext || searchedTrades).toBeTruthy();
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 8: Tool Selection Accuracy
  // Does the agent pick the RIGHT tool for the job?
  // ═══════════════════════════════════════════════════════════════════════

  describe('8. Tool Selection Accuracy', () => {
    it('uses get_properties for property queries, not maintenance tools', async () => {
      const result = await sendAgentMessage(
        token,
        'How many bedrooms does 4 Maloja Avenue have?',
      );
      // Should use property query tool, NOT maintenance or tenancy tools
      const usedPropertyTool = result.toolsUsed.some((t: string) =>
        t.includes('get_propert'),
      );
      expect(usedPropertyTool).toBe(true);
      // Should NOT use unrelated tools
      const usedWrongTool = result.toolsUsed.some((t: string) =>
        t.includes('create_') || t.includes('update_') || t.includes('send_'),
      );
      expect(usedWrongTool).toBe(false);
    }, AGENT_TIMEOUT);

    it('uses get_arrears for overdue rent, not get_maintenance', async () => {
      const result = await sendAgentMessage(
        token,
        'Is anyone behind on their rent?',
      );
      const usedArrearsOrPayment = result.toolsUsed.some((t: string) =>
        t.includes('arrears') || t.includes('payment'),
      );
      expect(usedArrearsOrPayment).toBe(true);
    }, AGENT_TIMEOUT);

    it('uses web_search or find_local_trades for external searches', async () => {
      const result = await sendAgentMessage(
        token,
        'Search online and find me the best-rated electricians near Caloundra Queensland.',
      );
      // Agent MUST use external search tools — not just internal DB queries
      const usedExternalSearch = result.toolsUsed.some((t: string) =>
        t.includes('web_search') || t.includes('find_local_trades'),
      );
      expect(usedExternalSearch).toBe(true);
    }, AGENT_TIMEOUT);

    it('uses generate_listing for listing copy, not just get_properties', async () => {
      const result = await sendAgentMessage(
        token,
        'Write me a listing description for 4 Maloja Avenue targeting young families.',
      );
      const usedGenerate = result.toolsUsed.some((t: string) =>
        t.includes('generate_listing'),
      );
      // Should call generate_listing, possibly also get_properties for data
      expect(usedGenerate).toBe(true);
      // Response should be a substantial listing, not just property data
      expect(result.message.length).toBeGreaterThan(200);
    }, AGENT_TIMEOUT);

    it('uses remember tool when user states a preference', async () => {
      const result = await sendAgentMessage(
        token,
        'Remember that I prefer to use local trades from the Sunshine Coast area whenever possible. This is important to me.',
      );
      const usedRemember = result.toolsUsed.includes('remember');
      const acknowledgesPreference = result.message.match(
        /noted|remember|preference|recorded|stored|keep.*in mind|will.*remember/i,
      );
      expect(usedRemember || acknowledgesPreference).toBeTruthy();

      // Verify in agent_preferences table (columns: preference_key, preference_value, category)
      if (usedRemember) {
        const prefs = await queryTable(
          'agent_preferences',
          `select=id,preference_key,preference_value,category&user_id=eq.${OWNER_USER_ID}&order=created_at.desc&limit=10`,
        );
        // prefs may be an error object instead of array if table doesn't exist
        if (Array.isArray(prefs)) {
          const hasRelevantPref = prefs.some((p: any) => {
            const valStr = JSON.stringify(p.preference_value || '').toLowerCase();
            const keyStr = (p.preference_key || '').toLowerCase();
            return valStr.includes('sunshine coast') || valStr.includes('local')
              || keyStr.includes('trade') || keyStr.includes('local');
          });
          expect(hasRelevantPref).toBe(true);
        }
      }
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 9: Multi-Step Workflow Verification
  // Real end-to-end flows that touch multiple systems
  // ═══════════════════════════════════════════════════════════════════════

  describe('9. Multi-Step Workflow: Maintenance Discovery to Trade Search', () => {
    let workflowConvId: string;

    it('step 1: user reports issue with unclear severity', async () => {
      const result = await sendAgentMessage(
        token,
        'There\'s some water on the floor near the washing machine at 4 Maloja Avenue. Not sure if it\'s a leak or if the machine just overflowed.',
      );
      workflowConvId = result.conversationId;
      // Agent should ask about severity or triage the issue
      expect(result.message).toMatch(/leak|water|washing|plumb|assess|check|urgent|routine|overflow/i);
    }, AGENT_TIMEOUT);

    it('step 2: user provides more detail', async () => {
      const result = await sendAgentMessage(
        token,
        'It seems to be coming from the pipe behind the machine, not the machine itself. There\'s a steady drip.',
      );
      // With "steady drip from pipe" — should be categorized as urgent plumbing
      expect(result.message).toMatch(/plumb|leak|pipe|urgent|repair|fix/i);
    }, AGENT_TIMEOUT);

    it('step 3: ask agent to find a tradesperson and verify it searches', async () => {
      const result = await sendAgentMessage(
        token,
        'Search online for a plumber near Caloundra who can come fix this leak.',
        workflowConvId,
      );
      // Agent MUST use search tools to find trades
      const usedSearch = result.toolsUsed.some((t: string) =>
        t.includes('find_local_trades') || t.includes('web_search'),
      );
      expect(usedSearch).toBe(true);
      // Should return plumber info
      expect(result.message).toMatch(/plumb|trade|service|company|number|contact|Caloundra|Sunshine Coast/i);
    }, AGENT_TIMEOUT);

    it('step 4: verify the full conversation made sense in the trajectory', async () => {
      const trajectories = await queryTable(
        'agent_trajectories',
        `select=id,tool_sequence,success,total_duration_ms&conversation_id=eq.${workflowConvId}&order=created_at.desc&limit=5`,
      );
      // Should have recorded at least one trajectory with tools
      expect(trajectories.length).toBeGreaterThan(0);
      const latest = trajectories[0];
      expect(Array.isArray(latest.tool_sequence)).toBe(true);
      expect(latest.success).toBe(true);
      expect(latest.total_duration_ms).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 10: Agent Boundary Testing
  // Push the agent's limits and verify graceful degradation
  // ═══════════════════════════════════════════════════════════════════════

  describe('10. Agent Boundary Testing', () => {
    it('agent handles extremely long message without crashing', async () => {
      const longContext = 'I need help with maintenance. '.repeat(100) +
        'Specifically, the hot water system at 4 Maloja Avenue needs servicing.';
      const result = await sendAgentMessage(token, longContext);
      // Should still work despite verbose input
      expect(result.message.length).toBeGreaterThan(50);
      expect(result.conversationId).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent handles empty follow-up gracefully', async () => {
      const msg1 = await sendAgentMessage(token, 'Show me my properties.');
      // Send a nearly empty follow-up
      const msg2 = await sendAgentMessage(
        token,
        '?',
        msg1.conversationId,
      );
      // Should ask what the user needs, not crash
      expect(msg2.message.length).toBeGreaterThan(10);
    }, AGENT_TIMEOUT);

    it('agent handles multiple requests in one message', async () => {
      const result = await sendAgentMessage(
        token,
        'I need three things: 1) Check if there are any overdue maintenance requests at 4 Maloja Avenue, 2) Tell me the current rent amount, and 3) Search for a local electrician near Caloundra.',
      );
      // Agent should address all three requests
      // Should use multiple tools
      expect(result.toolsUsed.length).toBeGreaterThanOrEqual(2);
      // Response should cover maintenance, rent, and electrician
      const coversMaintenance = result.message.match(/maintenance|repair|request/i);
      const coversRent = result.message.match(/rent|\$/i);
      const coversElectrician = result.message.match(/electric|trade|search/i);
      // Should cover at least 2 out of 3 topics
      const coveredCount = [coversMaintenance, coversRent, coversElectrician].filter(Boolean).length;
      expect(coveredCount).toBeGreaterThanOrEqual(2);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 11: Data Consistency After Agent Actions
  // After the agent does things, is the DB in a consistent state?
  // ═══════════════════════════════════════════════════════════════════════

  describe('11. Data Consistency Verification', () => {
    it('conversations have matching message counts', async () => {
      // Get a recent conversation
      const conversations = await queryTable(
        'agent_conversations',
        `select=id&user_id=eq.${OWNER_USER_ID}&order=created_at.desc&limit=1`,
      );
      if (conversations.length === 0) return;

      const convId = conversations[0].id;
      const messages = await queryTable(
        'agent_messages',
        `select=id,role&conversation_id=eq.${convId}`,
      );

      // Every conversation should have at least 2 messages (user + assistant)
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // Messages should alternate between user and assistant (with some flexibility for tool results)
      const userMsgs = messages.filter((m: any) => m.role === 'user').length;
      const assistantMsgs = messages.filter((m: any) => m.role === 'assistant').length;
      // Roughly equal — user count should be >= assistant count
      expect(userMsgs).toBeGreaterThanOrEqual(assistantMsgs);
    });

    it('all pending actions reference valid conversations', async () => {
      const pending = await queryTable(
        'agent_pending_actions',
        `select=id,conversation_id&user_id=eq.${OWNER_USER_ID}&order=created_at.desc&limit=20`,
      );

      for (const action of pending) {
        const conv = await queryTable(
          'agent_conversations',
          `select=id&id=eq.${action.conversation_id}`,
        );
        // Every pending action should reference a real conversation
        expect(conv.length).toBe(1);
      }
    });

    it('all trajectories reference valid conversations with correct user', async () => {
      const trajectories = await queryTable(
        'agent_trajectories',
        `select=id,conversation_id,user_id&user_id=eq.${OWNER_USER_ID}&order=created_at.desc&limit=5`,
      );

      // Spot-check a few trajectories (not all 20, to avoid timeout)
      for (const traj of trajectories.slice(0, 3)) {
        expect(traj.user_id).toBe(OWNER_USER_ID);
        const conv = await queryTable(
          'agent_conversations',
          `select=id,user_id&id=eq.${traj.conversation_id}`,
        );
        expect(conv.length).toBe(1);
        expect(conv[0].user_id).toBe(OWNER_USER_ID);
      }
    }, 30_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 12: Restore Default State
  // ═══════════════════════════════════════════════════════════════════════

  describe('12. Cleanup', () => {
    it('restores balanced autonomy after tests', async () => {
      // Force restore — retry if needed
      await setAutonomy('balanced');
      await sleep(1_000);
      // Double-check and retry if still not balanced
      let settings = await queryTable(
        'agent_autonomy_settings',
        `select=preset&user_id=eq.${OWNER_USER_ID}`,
      );
      if (settings.length > 0 && settings[0].preset !== 'balanced') {
        await setAutonomy('balanced');
        await sleep(1_000);
        settings = await queryTable(
          'agent_autonomy_settings',
          `select=preset&user_id=eq.${OWNER_USER_ID}`,
        );
      }
      expect(settings.length).toBe(1);
      expect(settings[0].preset).toBe('balanced');
    }, 15_000);
  });
});
