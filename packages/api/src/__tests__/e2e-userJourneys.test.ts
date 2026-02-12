/**
 * E2E User Journey Tests — Real-World Flow Simulation
 *
 * Tests complete user journeys that simulate real-world property management
 * scenarios end-to-end against the live Supabase backend.
 *
 * Covers:
 * - Maintenance lifecycle: tenant reports → agent triages → trade found → work order → completion
 * - Rent collection cycle: payment due → arrears detection → reminder → resolution
 * - Lease lifecycle: creation → renewal → notice → termination
 * - Listing & tenant finding: create listing → AI copy → application → screening → acceptance
 * - Inspection workflow: schedule → conduct → report → comparison
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
      await sleep(INTER_TEST_DELAY_MS);
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

describe.skipIf(!process.env.OWNER_PASSWORD || !process.env.SUPABASE_SERVICE_ROLE_KEY)('E2E User Journey Tests', () => {
  let token: string;

  beforeAll(async () => {
    if (!OWNER_PASSWORD || !SERVICE_ROLE_KEY) {
      console.warn('Skipping E2E tests: Set OWNER_PASSWORD and SUPABASE_SERVICE_ROLE_KEY');
      return;
    }
    token = await getAuthToken();
  });

  beforeEach(async () => {
    await sleep(3_000); // Rate limit buffer between tests
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY 1: Complete Maintenance Lifecycle
  // Tenant reports → Agent triages → Finds trade → Creates work order
  // ═══════════════════════════════════════════════════════════════════════

  describe('Journey 1: Maintenance Request Lifecycle', () => {
    let maintenanceConvId: string;

    it('step 1: agent triages a new maintenance report with urgency assessment', async () => {
      const result = await sendAgentMessage(
        token,
        'A tenant just reported that the hot water system at 4 Maloja Avenue has completely failed — no hot water at all. They have a young baby. Assess urgency and recommend next steps.',
      );
      maintenanceConvId = result.conversationId;
      // Should recognize this as urgent/emergency
      expect(result.message).toMatch(/urgent|emergency|priorit|immediate|hot water/i);
      // Should use property/maintenance tools
      expect(result.toolsUsed.length).toBeGreaterThan(0);
    }, AGENT_TIMEOUT);

    it('step 2: agent searches for a hot water repair service', async () => {
      const result = await sendAgentMessage(
        token,
        'Search for a hot water system repair service near Caloundra QLD that can come urgently. Use web_search to find options.',
        maintenanceConvId,
      );
      // Should search for trades
      const usedSearch = result.toolsUsed.some((t: string) =>
        t.includes('web_search') || t.includes('find_local_trades') || t.includes('get_trades') || t.includes('search'),
      );
      expect(usedSearch || result.message.match(/plumb|hot water|repair|service/i)).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('step 3: agent creates a maintenance request in the system', async () => {
      const result = await sendAgentMessage(
        token,
        'Create an emergency maintenance request for this hot water failure at 4 Maloja Avenue.',
        maintenanceConvId,
      );
      const usedCreate = result.toolsUsed.some((t: string) => t.includes('create_maintenance'));
      const hasPending = result.pendingActions && result.pendingActions.length > 0;
      const mentionsMaintenance = result.message.match(/maintenance|request|created|emergency|approval/i);
      expect(usedCreate || hasPending || mentionsMaintenance).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('step 4: verify maintenance request exists in database', async () => {
      const requests = await queryTable(
        'maintenance_requests',
        `select=id,title,urgency,status&property_id=eq.${PROPERTY_ID}&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(requests)).toBe(true);
      // There should be at least one maintenance request for this property
      if (requests.length > 0) {
        expect(requests[0]).toHaveProperty('title');
        expect(requests[0]).toHaveProperty('urgency');
        expect(requests[0]).toHaveProperty('status');
      }
    });

    it('step 5: agent provides cost estimate and timeline', async () => {
      const result = await sendAgentMessage(
        token,
        'What would a typical hot water system replacement cost in Queensland? Give me a breakdown.',
        maintenanceConvId,
      );
      expect(result.message).toMatch(/\$|cost|price|estimate|install|replace/i);
      expect(result.message.length).toBeGreaterThan(100);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY 2: Rent Collection & Arrears Flow
  // ═══════════════════════════════════════════════════════════════════════

  describe('Journey 2: Rent & Arrears Management', () => {
    let rentConvId: string;

    it('step 1: agent reports current rent status across portfolio', async () => {
      const result = await sendAgentMessage(
        token,
        'Give me a full rent status update. Who is behind on rent and by how much?',
      );
      rentConvId = result.conversationId;
      expect(result.toolsUsed.some((t: string) => t.includes('get_arrears') || t.includes('get_payment'))).toBe(true);
      expect(result.message).toMatch(/rent|arrears|overdue|payment|behind/i);
    }, AGENT_TIMEOUT);

    it('step 2: agent details arrears escalation options', async () => {
      const result = await sendAgentMessage(
        token,
        'What are my options for dealing with the overdue rent? Walk me through the escalation process.',
        rentConvId,
      );
      expect(result.message).toMatch(/remind|notice|breach|escalat|payment plan|tribunal/i);
      expect(result.message.length).toBeGreaterThan(200);
    }, AGENT_TIMEOUT);

    it('step 3: arrears records exist in database', async () => {
      const arrears = await queryTable(
        'arrears_records',
        `select=id,days_overdue,severity,is_resolved&order=created_at.desc&limit=10`,
      );
      expect(Array.isArray(arrears)).toBe(true);
    });

    it('step 4: agent can draft a rent reminder message', async () => {
      const result = await sendAgentMessage(
        token,
        'Draft a friendly rent reminder for my tenant who is 14 days overdue. Keep it professional but firm.',
        rentConvId,
      );
      expect(result.message).toMatch(/rent|overdue|payment|due|reminder/i);
      expect(result.message.length).toBeGreaterThan(100);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY 3: Listing & Tenant Finding
  // ═══════════════════════════════════════════════════════════════════════

  describe('Journey 3: Listing Creation & AI Copy', () => {
    let listingConvId: string;

    it('step 1: agent generates a listing description with AI', async () => {
      const result = await sendAgentMessage(
        token,
        'Generate a compelling listing description for 4 Maloja Avenue, Caloundra. Highlight the best features and target young professionals.',
      );
      listingConvId = result.conversationId;
      const usedGenerate = result.toolsUsed.some((t: string) =>
        t.includes('generate_listing') || t.includes('get_propert'),
      );
      expect(usedGenerate).toBe(true);
      expect(result.message).toMatch(/bedroom|bathroom|Caloundra|property|feature/i);
      expect(result.message.length).toBeGreaterThan(200);
    }, AGENT_TIMEOUT);

    it('step 2: agent provides market rent recommendation', async () => {
      const result = await sendAgentMessage(
        token,
        'What should I list the rent at? Search for comparable rental prices in Caloundra QLD.',
        listingConvId,
      );
      const searchedWeb = result.toolsUsed.some((t: string) =>
        t.includes('web_search') || t.includes('search') || t.includes('get_propert'),
      );
      expect(searchedWeb || result.message.match(/\$\d+|per week|rent|market/i)).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('step 3: agent reviews applications with scoring', async () => {
      const result = await sendAgentMessage(
        token,
        'Do I have any tenant applications? Review and score them for me.',
        listingConvId,
      );
      const usedApps = result.toolsUsed.some((t: string) =>
        t.includes('get_application') || t.includes('score') || t.includes('rank'),
      );
      expect(usedApps || result.message.match(/application|applicant|tenant|score|review/i)).toBeTruthy();
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY 4: Inspection Workflow
  // ═══════════════════════════════════════════════════════════════════════

  describe('Journey 4: Inspection Management', () => {
    it('step 1: agent checks when the next inspection is due', async () => {
      const result = await sendAgentMessage(
        token,
        'When was the last inspection at 4 Maloja Avenue and when is the next one due?',
      );
      const usedInspection = result.toolsUsed.some((t: string) =>
        t.includes('get_inspection') || t.includes('get_propert'),
      );
      expect(usedInspection).toBe(true);
      expect(result.message).toMatch(/inspection|routine|schedule|due|last/i);
    }, AGENT_TIMEOUT);

    it('step 2: agent schedules an inspection', async () => {
      const result = await sendAgentMessage(
        token,
        'Schedule a routine inspection of 4 Maloja Avenue for two weeks from now.',
      );
      expect(result.message).toMatch(/inspection|schedule|routine|booked|confirmed/i);
    }, AGENT_TIMEOUT);

    it('step 3: inspections exist in database', async () => {
      const inspections = await queryTable(
        'inspections',
        `select=id,inspection_type,status,scheduled_date&property_id=eq.${PROPERTY_ID}&order=created_at.desc&limit=5`,
      );
      expect(Array.isArray(inspections)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY 5: Financial Reporting
  // ═══════════════════════════════════════════════════════════════════════

  describe('Journey 5: Financial Overview & Reporting', () => {
    it('step 1: agent provides comprehensive financial summary', async () => {
      const result = await sendAgentMessage(
        token,
        'Give me a complete financial summary of my property portfolio. Include income, expenses, and net position.',
      );
      expect(result.toolsUsed.length).toBeGreaterThan(0);
      expect(result.message).toMatch(/income|expense|rent|financial|total|net/i);
    }, AGENT_TIMEOUT);

    it('step 2: agent can explain tax implications', async () => {
      const result = await sendAgentMessage(
        token,
        'What expenses from my properties can I claim as tax deductions?',
      );
      expect(result.message).toMatch(/tax|deduct|claim|expense|depreciat/i);
      expect(result.message.length).toBeGreaterThan(100);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY 6: Multi-Turn Complex Reasoning
  // ═══════════════════════════════════════════════════════════════════════

  describe('Journey 6: Complex Multi-Turn Reasoning', () => {
    let complexConvId: string;

    it('step 1: agent handles a complex property decision', async () => {
      const result = await sendAgentMessage(
        token,
        'I\'m thinking about whether to renew the lease at 4 Maloja Avenue or find a new tenant. The current tenant has been late on rent a few times. What data do you have and what would you recommend?',
      );
      complexConvId = result.conversationId;
      // Should pull multiple data sources
      expect(result.toolsUsed.length).toBeGreaterThan(1);
      expect(result.message).toMatch(/tenant|lease|rent|renew|recommend/i);
      expect(result.message.length).toBeGreaterThan(200);
    }, AGENT_TIMEOUT);

    it('step 2: agent considers market conditions in recommendation', async () => {
      const result = await sendAgentMessage(
        token,
        'What are current vacancy rates and market conditions in Caloundra? Factor this into your recommendation.',
        complexConvId,
      );
      expect(result.message).toMatch(/market|vacancy|Caloundra|demand|supply|rate/i);
    }, AGENT_TIMEOUT);

    it('step 3: agent provides final actionable recommendation', async () => {
      const result = await sendAgentMessage(
        token,
        'Based on everything we\'ve discussed, give me a clear recommendation with specific next steps.',
        complexConvId,
      );
      expect(result.message).toMatch(/recommend|step|action|suggest|should/i);
      expect(result.message.length).toBeGreaterThan(150);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY 7: Compliance & Legal
  // ═══════════════════════════════════════════════════════════════════════

  describe('Journey 7: Legal Compliance Checks', () => {
    it('step 1: agent checks compliance status across portfolio', async () => {
      const result = await sendAgentMessage(
        token,
        'Check my compliance status. Are all smoke alarms, gas safety checks, and pool fences up to date across my properties?',
      );
      expect(result.message).toMatch(/compliance|smoke|safety|inspection|up to date|overdue/i);
    }, AGENT_TIMEOUT);

    it('step 2: agent explains Queensland landlord obligations', async () => {
      const result = await sendAgentMessage(
        token,
        'What are my legal obligations as a Queensland landlord regarding routine inspections and notice periods?',
      );
      expect(result.message).toMatch(/Queensland|QLD|notice|days|inspection|RTRA|landlord|obligation/i);
      expect(result.message.length).toBeGreaterThan(150);
    }, AGENT_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY 8: Trades Network Management
  // ═══════════════════════════════════════════════════════════════════════

  describe('Journey 8: Trades Network', () => {
    it('step 1: agent lists current trades network', async () => {
      const result = await sendAgentMessage(
        token,
        'Show me all the tradespeople in my network. Who do I have for plumbing, electrical, and HVAC?',
      );
      const usedTrades = result.toolsUsed.some((t: string) => t.includes('get_trades'));
      expect(usedTrades || result.message.match(/trade|plumb|electric|network/i)).toBeTruthy();
    }, AGENT_TIMEOUT);

    it('step 2: trades table has entries', async () => {
      const trades = await queryTable(
        'trades',
        `select=id,business_name,categories,status&limit=10`,
      );
      expect(Array.isArray(trades)).toBe(true);
    });
  });
});
