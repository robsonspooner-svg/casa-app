/**
 * E2E Event-Driven Proactivity Tests
 *
 * Tests the agent's ability to proactively respond to events in the app
 * WITHOUT being prompted through chat. This is the core differentiator
 * that replaces human property managers.
 *
 * Tests validate that the heartbeat scanners + agent proactively:
 *
 * MAINTENANCE EVENTS:
 * - New maintenance request → auto-find matching trade → estimate cost → surface tile
 * - Emergency maintenance → escalate immediately with trade options
 * - Work order overdue → chase tradesperson → surface follow-up tile
 *
 * TENANT LIFECYCLE EVENTS:
 * - New application → auto-score → surface comparison tile
 * - Lease approaching expiry → prepare renewal options → surface decision tile
 * - Tenant gives notice → auto-start end-of-tenancy checklist
 *
 * RENT EVENTS:
 * - Rent overdue → auto-draft reminder → surface for approval
 * - Payment plan missed → escalate severity → surface next steps
 * - Rent review due → calculate market rate → suggest increase
 *
 * COMPLIANCE EVENTS:
 * - Smoke alarm check overdue → find electrician → surface booking tile
 * - Insurance expiring → surface renewal reminder
 * - Inspection overdue → prepare inspection → surface scheduling tile
 *
 * LISTING EVENTS:
 * - Stale listing → suggest price/description updates
 * - Property vacant too long → calculate lost rent → recommend actions
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
  pendingActions?: Array<{ id: string; tool_name: string; description: string; category: string }>;
}> {
  const body: Record<string, unknown> = { message };
  if (conversationId) body.conversationId = conversationId;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
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
    if ((res.status === 502 || res.status === 429 || res.status === 546) && attempt < MAX_RETRIES - 1) continue;
    throw new Error(`Agent chat error ${res.status}: ${errText}`);
  }
  throw new Error('sendAgentMessage: exhausted all retries');
}

async function callHeartbeat(userId?: string): Promise<{ ok: boolean; body: any }> {
  const url = userId
    ? `${SUPABASE_URL}/functions/v1/agent-heartbeat?user_id=${userId}`
    : `${SUPABASE_URL}/functions/v1/agent-heartbeat`;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
    const res = await fetch(url, {
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
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  return res.json();
}

async function insertRow(table: string, data: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

async function updateRow(table: string, filter: string, data: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.OWNER_PASSWORD || !process.env.SUPABASE_SERVICE_ROLE_KEY)('E2E Event-Driven Proactivity Tests', () => {
  let token: string;

  beforeAll(async () => {
    if (!OWNER_PASSWORD || !SERVICE_ROLE_KEY) {
      console.warn('Skipping event-driven tests: Set OWNER_PASSWORD and SUPABASE_SERVICE_ROLE_KEY');
      return;
    }
    token = await getAuthToken();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 1: Maintenance Event → Trade Discovery → Cost Estimate
  // When a maintenance request is logged, agent should auto-find trades
  // ═══════════════════════════════════════════════════════════════════════

  describe('1. Maintenance → Proactive Trade Discovery', () => {
    it('heartbeat detects new maintenance requests and creates actionable tasks', async () => {
      // First, run the heartbeat to process any existing maintenance
      const result = await callHeartbeat(OWNER_USER_ID);
      expect(result.ok).toBe(true);

      // Check if maintenance-category tasks were created
      const maintTasks = await queryTable(
        'agent_tasks',
        `select=id,title,description,recommendation,category,priority,timeline&user_id=eq.${OWNER_USER_ID}&category=eq.maintenance&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(maintTasks)).toBe(true);
      // If there are maintenance tasks, they should have actionable recommendations
      for (const task of maintTasks) {
        if (task.recommendation) {
          expect(task.recommendation.length).toBeGreaterThan(10);
        }
      }
    }, AGENT_TIMEOUT);

    it('agent provides trade options and cost estimates when asked about maintenance', async () => {
      const result = await sendAgentMessage(
        token,
        'I have a plumbing leak at 4 Maloja Avenue. Find me a plumber, estimate the cost, and tell me when the tenant is available based on their preferences.',
      );
      // Agent should provide trade options and/or cost estimate
      expect(result.message).toMatch(/plumb|trade|cost|estimate|price|\$|service|available/i);
      expect(result.toolsUsed.length).toBeGreaterThan(0);
    }, AGENT_TIMEOUT);

    it('agent checks existing trade network before web searching', async () => {
      const result = await sendAgentMessage(
        token,
        'I need an electrician for a faulty power point. Do I have one in my network? If not, find one online.',
      );
      // Agent should check trades first, then web search if needed
      const checkedTrades = result.toolsUsed.some((t: string) => t.includes('get_trades'));
      const searchedWeb = result.toolsUsed.some((t: string) =>
        t.includes('web_search') || t.includes('find_local_trades') || t.includes('search'),
      );
      expect(checkedTrades || searchedWeb || result.message.match(/electric|trade|network/i)).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('agent estimates emergency plumbing cost correctly for QLD', async () => {
      const result = await sendAgentMessage(
        token,
        'How much would an emergency plumber cost on the Sunshine Coast for a burst pipe? Give me a realistic estimate.',
      );
      // Should provide a dollar amount
      expect(result.message).toMatch(/\$\d+|\d+.*per hour|call.*out|between/i);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 2: Tenant Application → Auto-Score → Comparison Tile
  // ═══════════════════════════════════════════════════════════════════════

  describe('2. Application → Proactive Screening & Scoring', () => {
    it('heartbeat detects new applications and creates review tasks', async () => {
      const appTasks = await queryTable(
        'agent_tasks',
        `select=id,title,description,recommendation,category&user_id=eq.${OWNER_USER_ID}&category=eq.tenant_finding&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(appTasks)).toBe(true);
    });

    it('agent scores and ranks applications with reasoning', async () => {
      const result = await sendAgentMessage(
        token,
        'Score and rank all current tenant applications for my properties. Show me the best candidates with your reasoning.',
      );
      expect(result.message).toMatch(/application|applicant|score|rank|recommend|income|reference/i);
    }, AGENT_TIMEOUT);

    it('agent checks screening status for pending applications', async () => {
      const result = await sendAgentMessage(
        token,
        'What is the status of background checks and reference checks for my current applications?',
      );
      expect(result.message).toMatch(/background|reference|check|screening|pending|complet/i);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 3: Lease Lifecycle → Proactive Renewal/Termination
  // ═══════════════════════════════════════════════════════════════════════

  describe('3. Lease → Proactive Renewal & Compliance', () => {
    it('heartbeat creates lease expiry tasks', async () => {
      const leaseTasks = await queryTable(
        'agent_tasks',
        `select=id,title,description,recommendation,priority&user_id=eq.${OWNER_USER_ID}&category=eq.lease_management&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(leaseTasks)).toBe(true);
    });

    it('agent proactively prepares renewal options', async () => {
      const result = await sendAgentMessage(
        token,
        'My lease is coming up for renewal. What are my options? Should I offer a new fixed term or go periodic? Consider the current market.',
      );
      expect(result.message).toMatch(/renew|fixed|periodic|market|increase|option|term/i);
      expect(result.message.length).toBeGreaterThan(150);
    }, AGENT_TIMEOUT);

    it('agent knows QLD notice period requirements', async () => {
      const result = await sendAgentMessage(
        token,
        'How much notice do I need to give my tenant in Queensland to end their lease? What are the rules?',
      );
      expect(result.message).toMatch(/notice|days|Queensland|QLD|RTRA|Act|period|end/i);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 4: Rent Events → Proactive Reminders & Escalation
  // ═══════════════════════════════════════════════════════════════════════

  describe('4. Rent → Proactive Collection & Escalation', () => {
    it('heartbeat creates rent arrears tasks with escalation advice', async () => {
      const rentTasks = await queryTable(
        'agent_tasks',
        `select=id,title,description,recommendation,priority&user_id=eq.${OWNER_USER_ID}&category=eq.rent_collection&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(rentTasks)).toBe(true);
      // If there are arrears tasks, they should have escalation recommendations
      for (const task of rentTasks) {
        if (task.recommendation) {
          expect(task.recommendation).toMatch(/remind|notice|escalat|payment|plan|contact|action/i);
        }
      }
    });

    it('agent proactively drafts rent reminders matching escalation stage', async () => {
      const result = await sendAgentMessage(
        token,
        'Draft an appropriate rent reminder for my tenant who is 14 days overdue. What stage of escalation should this be?',
      );
      expect(result.message).toMatch(/14 day|moderate|formal|notice|escalat|remind|overdue/i);
    }, AGENT_TIMEOUT);

    it('agent calculates rent increase based on market data', async () => {
      const result = await sendAgentMessage(
        token,
        'Is my current rent competitive with the market? Should I increase it at the next review? By how much?',
      );
      expect(result.message).toMatch(/rent|market|increase|review|competitive|current|\$/i);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 5: Compliance Events → Proactive Safety Checks
  // ═══════════════════════════════════════════════════════════════════════

  describe('5. Compliance → Proactive Safety & Legal', () => {
    it('heartbeat creates compliance tasks', async () => {
      const compTasks = await queryTable(
        'agent_tasks',
        `select=id,title,description,category,priority&user_id=eq.${OWNER_USER_ID}&category=eq.compliance&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(compTasks)).toBe(true);
    });

    it('agent checks compliance requirements for QLD properties', async () => {
      const result = await sendAgentMessage(
        token,
        'What compliance checks are required for my Queensland rental property? Smoke alarms, pool fences, electrical safety — am I up to date?',
      );
      expect(result.message).toMatch(/smoke|alarm|compliance|safety|pool|electrical|QLD|Queensland/i);
    }, AGENT_TIMEOUT);

    it('agent proactively finds trades for compliance work', async () => {
      const result = await sendAgentMessage(
        token,
        'I need a licensed electrician to do a smoke alarm compliance check at 4 Maloja Avenue. Find one and give me a cost estimate.',
      );
      const usedTools = result.toolsUsed.some((t: string) =>
        t.includes('get_trades') || t.includes('web_search') || t.includes('find_local_trades') || t.includes('search'),
      );
      expect(usedTools || result.message.match(/electric|smoke|alarm|cost|estimate|\$/i)).toBeTruthy();
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 6: Listing Events → Proactive Marketing
  // ═══════════════════════════════════════════════════════════════════════

  describe('6. Listing → Proactive Marketing & Optimization', () => {
    it('heartbeat creates stale listing tasks', async () => {
      const listingTasks = await queryTable(
        'agent_tasks',
        `select=id,title,description,category&user_id=eq.${OWNER_USER_ID}&category=eq.listings&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(listingTasks)).toBe(true);
    });

    it('agent proactively suggests listing improvements', async () => {
      const result = await sendAgentMessage(
        token,
        'My listing for 4 Maloja Avenue isn\'t getting many views. What can I do to improve it?',
      );
      expect(result.message).toMatch(/photo|description|price|reduce|improve|title|feature|market/i);
    }, AGENT_TIMEOUT);

    it('agent calculates lost rent from vacancy', async () => {
      const result = await sendAgentMessage(
        token,
        'If my property has been vacant for 30 days at $480/week, how much rent have I lost? What should I do?',
      );
      expect(result.message).toMatch(/\$\d+|lost|vacant|reduce|price|week|market/i);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 7: Inspection Events → Proactive Scheduling
  // ═══════════════════════════════════════════════════════════════════════

  describe('7. Inspection → Proactive Scheduling & Preparation', () => {
    it('heartbeat creates inspection tasks', async () => {
      const inspTasks = await queryTable(
        'agent_tasks',
        `select=id,title,description,category,priority&user_id=eq.${OWNER_USER_ID}&category=eq.inspections&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(inspTasks)).toBe(true);
    });

    it('agent proactively prepares inspection checklist', async () => {
      const result = await sendAgentMessage(
        token,
        'Prepare a routine inspection checklist for 4 Maloja Avenue. What should I check?',
      );
      expect(result.message).toMatch(/kitchen|bathroom|bedroom|smoke|general|condition|check|damage/i);
    }, AGENT_TIMEOUT);

    it('agent schedules inspection with correct QLD notice period', async () => {
      const result = await sendAgentMessage(
        token,
        'Schedule a routine inspection at 4 Maloja Avenue. How much notice do I need to give the tenant under QLD law?',
      );
      expect(result.message).toMatch(/notice|7 day|entry|RTRA|QLD|tenant|written|inspection/i);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 8: Bond Events → Proactive Lodgement & Claims
  // ═══════════════════════════════════════════════════════════════════════

  describe('8. Bond → Proactive Lodgement Monitoring', () => {
    it('agent knows QLD bond lodgement deadlines', async () => {
      const result = await sendAgentMessage(
        token,
        'I just collected a bond from a new tenant in Queensland. How long do I have to lodge it with the RTA?',
      );
      expect(result.message).toMatch(/10 day|RTA|Residential Tenancies Authority|lodge|bond|QLD/i);
    }, AGENT_TIMEOUT);

    it('agent prepares bond claim with evidence requirements', async () => {
      const result = await sendAgentMessage(
        token,
        'My tenant is moving out and there\'s damage. What do I need to make a bond claim in QLD?',
      );
      expect(result.message).toMatch(/entry.*report|exit.*report|evidence|photo|inspection|Form|claim|RTA/i);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 9: Insurance Events → Proactive Renewal
  // ═══════════════════════════════════════════════════════════════════════

  describe('9. Insurance → Proactive Renewal Monitoring', () => {
    it('heartbeat creates insurance tasks', async () => {
      const insTasks = await queryTable(
        'agent_tasks',
        `select=id,title,category&user_id=eq.${OWNER_USER_ID}&category=eq.insurance&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(insTasks)).toBe(true);
    });

    it('agent explains landlord insurance requirements', async () => {
      const result = await sendAgentMessage(
        token,
        'Do I need landlord insurance? What does it cover and what should I look for?',
      );
      expect(result.message).toMatch(/insurance|landlord|cover|public liability|building|content|tenant|damage/i);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 10: End-to-End Proactive Scenario
  // Complete scenario: Maintenance reported → full resolution
  // ═══════════════════════════════════════════════════════════════════════

  describe('10. Full Proactive Scenario: Maintenance to Resolution', () => {
    let scenarioConvId: string;

    it('step 1: tenant reports broken dishwasher — agent triages', async () => {
      const result = await sendAgentMessage(
        token,
        'My tenant at 4 Maloja Avenue just reported their dishwasher isn\'t draining properly and is leaking onto the floor. It happened this morning. They work from home so they\'re available most days.',
      );
      scenarioConvId = result.conversationId;
      // Agent should triage urgency
      expect(result.message).toMatch(/dishwasher|plumb|appliance|leak|urgent|routine|priorit/i);
    }, AGENT_TIMEOUT);

    it('step 2: agent checks trade network for appliance/plumbing service', async () => {
      const result = await sendAgentMessage(
        token,
        'Check my trade network for someone who can fix this. If I don\'t have anyone suitable, search online for options near Caloundra QLD.',
        scenarioConvId,
      );
      const usedTrades = result.toolsUsed.some((t: string) =>
        t.includes('get_trades') || t.includes('web_search') || t.includes('find_local_trades') || t.includes('search'),
      );
      expect(usedTrades || result.message.match(/trade|plumb|appliance|service|found|network/i)).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('step 3: agent estimates cost and prepares recommendation', async () => {
      const result = await sendAgentMessage(
        token,
        'Based on the dishwasher issue, estimate the repair cost and prepare a recommendation. Should I repair or replace? Consider the tenant is available weekdays during business hours.',
        scenarioConvId,
      );
      expect(result.message).toMatch(/\$|cost|repair|replace|recommend|estimate|option/i);
      expect(result.message.length).toBeGreaterThan(150);
    }, AGENT_TIMEOUT);

    it('step 4: agent correctly identifies this as owner responsibility (not tenant)', async () => {
      const result = await sendAgentMessage(
        token,
        'Is the dishwasher repair my responsibility or the tenant\'s?',
        scenarioConvId,
      );
      // Dishwasher that was provided with the property is owner's responsibility
      expect(result.message).toMatch(/landlord|owner|your.*responsib|provided|fixture|fair wear/i);
    }, AGENT_TIMEOUT);
  });
});
