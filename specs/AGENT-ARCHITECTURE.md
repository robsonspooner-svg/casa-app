# Casa Agent Architecture (Frontier Design)

> **Philosophy**: The Casa agent should "just work" like Claude Code or Manus - autonomous, reliable, and transparent. Users give high-level intents, the agent figures out how to accomplish them.

---

## 1. Core Principles

### 1.1 Design Philosophy

```
"Tell me what you want, not how to do it"
```

The Casa agent (Casa) operates on **intent**, not instructions. Users express what they want to achieve, and Casa:
1. **Understands** the goal and context
2. **Plans** the steps to achieve it
3. **Executes** using available tools
4. **Verifies** the outcome
5. **Learns** from corrections

### 1.2 Autonomy Levels

| Level | Description | Example | User Interaction |
|-------|-------------|---------|------------------|
| **L0: Inform** | Just tell the user | "Rent is due tomorrow" | None |
| **L1: Suggest** | Recommend action | "Should I send a reminder?" | Confirm/Reject |
| **L2: Draft** | Prepare but don't execute | "Here's a draft message..." | Edit/Send/Cancel |
| **L3: Execute** | Do it, report after | "Sent reminder to tenant" | Undo available |
| **L4: Autonomous** | Do it silently | Auto-retry failed payment | Logged, no notification |

Users configure autonomy per action type. Smart defaults based on risk:
- **L4 (Autonomous)**: Read data, send routine reminders
- **L3 (Execute)**: Schedule inspections, process normal payments
- **L2 (Draft)**: Send custom messages, create maintenance requests
- **L1 (Suggest)**: Approve applications, process large expenses
- **L0 (Inform)**: Legal actions, tribunal applications

---

## 2. Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CASA AGENT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         CONVERSATION LAYER                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────────┐ │ │
│  │  │   Message    │  │   Context    │  │     Conversation Memory       │ │ │
│  │  │   Handler    │  │   Builder    │  │  (sliding window + retrieval) │ │ │
│  │  └──────────────┘  └──────────────┘  └───────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  ┌────────────────────────────────────▼───────────────────────────────────┐ │
│  │                          REASONING ENGINE                               │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │                    Claude API (Tool Use)                         │   │ │
│  │  │                                                                  │   │ │
│  │  │  System Prompt: "You are Casa, an AI property manager..."      │   │ │
│  │  │  + User context (properties, tenants, preferences)              │   │ │
│  │  │  + Available tools (dynamically selected based on context)      │   │ │
│  │  │  + Autonomy rules (what can be done without asking)             │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                         ┌────────────┴────────────┐                          │
│                         ▼                         ▼                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │      TOOL EXECUTOR          │  │        ACTION QUEUE                  │   │
│  │                             │  │                                      │   │
│  │  • Execute tool calls       │  │  • Pending actions (need approval)  │   │
│  │  • Return results to LLM    │  │  • Scheduled actions (future)       │   │
│  │  • Handle errors gracefully │  │  • Background tasks (async)         │   │
│  └─────────────────────────────┘  └─────────────────────────────────────┘   │
│                                      │                                       │
│  ┌───────────────────────────────────▼────────────────────────────────────┐ │
│  │                            TOOL LIBRARY                                 │ │
│  │                                                                         │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │ │
│  │  │   Query     │ │   Action    │ │  Generate   │ │ Integration │      │ │
│  │  │   Tools     │ │   Tools     │ │   Tools     │ │   Tools     │      │ │
│  │  │             │ │             │ │             │ │             │      │ │
│  │  │ • get_props │ │ • send_msg  │ │ • draft_msg │ │ • domain    │      │ │
│  │  │ • get_tenant│ │ • create_*  │ │ • gen_desc  │ │ • equifax   │      │ │
│  │  │ • get_pay   │ │ • update_*  │ │ • summarize │ │ • stripe    │      │ │
│  │  │ • get_maint │ │ • schedule  │ │ • analyze   │ │ • twilio    │      │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │ │
│  │                                                                         │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │ │
│  │  │  Workflow   │ │   Memory    │ │  Planning   │                       │ │
│  │  │   Tools     │ │   Tools     │ │   Tools     │                       │ │
│  │  │             │ │             │ │             │                       │ │
│  │  │ • find_ten  │ │ • remember  │ │ • plan_task │                       │ │
│  │  │ • onboard   │ │ • recall    │ │ • check_plan│                       │ │
│  │  │ • end_lease │ │ • learn     │ │ • replan    │                       │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                          LEARNING ENGINE                                 │ │
│  │  • Observes all interactions                                            │ │
│  │  • Tracks when user corrects/overrides                                  │ │
│  │  • Updates preference weights                                           │ │
│  │  • Improves future tool selection and parameters                        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Why This Is Frontier-Level

| Feature | Traditional Chatbot | Casa Agent |
|---------|--------------------|--------------|
| **Tool Use** | Fixed endpoints | Dynamic tool selection by LLM |
| **Multi-Step** | One request → one response | Agentic loop until task complete |
| **Context** | Last N messages | Smart retrieval + summarization |
| **Planning** | None | Explicit planning for complex tasks |
| **Self-Correction** | Fail immediately | Retry with different approach |
| **Learning** | Static | Actively learns from corrections |

---

## 3. Tool System

### 3.1 Tool Definition Standard

Every tool follows this structure (compatible with Claude's tool use):

```typescript
interface Tool {
  name: string;
  description: string;  // Clear, concise - LLM reads this
  input_schema: {
    type: 'object';
    properties: Record<string, JSONSchema>;
    required: string[];
  };
  // Execution
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
  // Metadata
  category: 'query' | 'action' | 'generate' | 'integration' | 'workflow' | 'memory' | 'planning';
  autonomyLevel: 0 | 1 | 2 | 3 | 4;  // Default autonomy required
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  reversible: boolean;
}

interface ToolContext {
  userId: string;
  propertyIds: string[];  // User's properties for scoping
  autonomyOverrides: Record<string, number>;  // User's custom autonomy settings
  conversationId: string;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  display?: string;  // Human-readable summary for response
  actions?: PendingAction[];  // Actions that need user approval
}
```

### 3.2 Core Tool Categories

#### Query Tools (Read-Only, L4 Autonomy)

```typescript
// Get property details
const get_property: Tool = {
  name: 'get_property',
  description: 'Get details about a property including address, tenancy status, and recent activity',
  input_schema: {
    type: 'object',
    properties: {
      property_id: { type: 'string', description: 'Property UUID' },
      include: {
        type: 'array',
        items: { type: 'string', enum: ['tenancy', 'maintenance', 'payments', 'inspections'] },
        description: 'Related data to include'
      }
    },
    required: ['property_id']
  },
  category: 'query',
  autonomyLevel: 4,
  riskLevel: 'none',
  reversible: true,
  execute: async (params, ctx) => { /* ... */ }
};

// Search tenants
const search_tenants: Tool = {
  name: 'search_tenants',
  description: 'Search for tenants by name, email, phone, or property',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      property_id: { type: 'string', description: 'Filter by property' },
      status: { type: 'string', enum: ['current', 'past', 'all'] }
    },
    required: []
  },
  // ...
};

// Get payment history
const get_payments: Tool = {
  name: 'get_payments',
  description: 'Get payment history for a tenant or property',
  input_schema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      property_id: { type: 'string' },
      period: { type: 'string', enum: ['this_month', 'last_month', 'this_year', 'all'] },
      status: { type: 'string', enum: ['paid', 'overdue', 'all'] }
    },
    required: []
  },
  // ...
};

// Get arrears summary
const get_arrears: Tool = {
  name: 'get_arrears',
  description: 'Get all tenants currently in arrears with amounts and days overdue',
  input_schema: {
    type: 'object',
    properties: {
      property_id: { type: 'string', description: 'Filter by property (optional)' },
      min_days_overdue: { type: 'number', description: 'Minimum days overdue to include' }
    },
    required: []
  },
  // ...
};

// Get maintenance requests
const get_maintenance: Tool = {
  name: 'get_maintenance',
  description: 'Get maintenance requests, optionally filtered by property or status',
  input_schema: {
    type: 'object',
    properties: {
      property_id: { type: 'string' },
      status: { type: 'string', enum: ['reported', 'in_progress', 'completed', 'all'] },
      urgency: { type: 'string', enum: ['emergency', 'urgent', 'normal', 'low', 'all'] }
    },
    required: []
  },
  // ...
};
```

#### Action Tools (Write Operations, L1-L3 Autonomy)

```typescript
// Send message to tenant
const send_message: Tool = {
  name: 'send_message',
  description: 'Send a message to a tenant via their preferred channel (SMS, email, or app)',
  input_schema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant to message' },
      message: { type: 'string', description: 'Message content' },
      channel: { type: 'string', enum: ['preferred', 'sms', 'email', 'app'], default: 'preferred' },
      urgent: { type: 'boolean', default: false }
    },
    required: ['tenant_id', 'message']
  },
  category: 'action',
  autonomyLevel: 2,  // Draft by default
  riskLevel: 'low',
  reversible: false,
  // ...
};

// Create maintenance request
const create_maintenance: Tool = {
  name: 'create_maintenance',
  description: 'Create a new maintenance request for a property',
  input_schema: {
    type: 'object',
    properties: {
      property_id: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string', enum: ['plumbing', 'electrical', 'appliance', 'structural', 'pest', 'garden', 'other'] },
      urgency: { type: 'string', enum: ['emergency', 'urgent', 'normal', 'low'] },
      photos: { type: 'array', items: { type: 'string' } }
    },
    required: ['property_id', 'title', 'description', 'category', 'urgency']
  },
  category: 'action',
  autonomyLevel: 2,
  riskLevel: 'low',
  reversible: true,  // Can be cancelled
  // ...
};

// Schedule inspection
const schedule_inspection: Tool = {
  name: 'schedule_inspection',
  description: 'Schedule a routine or entry/exit inspection',
  input_schema: {
    type: 'object',
    properties: {
      property_id: { type: 'string' },
      type: { type: 'string', enum: ['routine', 'entry', 'exit'] },
      proposed_dates: { type: 'array', items: { type: 'string', format: 'date-time' } },
      notify_tenant: { type: 'boolean', default: true }
    },
    required: ['property_id', 'type', 'proposed_dates']
  },
  category: 'action',
  autonomyLevel: 3,  // Can execute, owner can undo
  riskLevel: 'low',
  reversible: true,
  // ...
};

// Approve maintenance quote
const approve_quote: Tool = {
  name: 'approve_quote',
  description: 'Approve a maintenance quote and schedule the work',
  input_schema: {
    type: 'object',
    properties: {
      quote_id: { type: 'string' },
      schedule_for: { type: 'string', format: 'date-time', description: 'Preferred date/time' }
    },
    required: ['quote_id']
  },
  category: 'action',
  autonomyLevel: 1,  // Suggest (owner must approve manually for now)
  riskLevel: 'medium',  // Involves money
  reversible: false,
  // ...
};
```

#### Generation Tools (AI Content, L3 Autonomy)

```typescript
// Draft a message
const draft_message: Tool = {
  name: 'draft_message',
  description: 'Generate a draft message to a tenant. Returns draft for review, does not send.',
  input_schema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      purpose: { type: 'string', enum: ['reminder', 'notice', 'update', 'welcome', 'response', 'custom'] },
      context: { type: 'string', description: 'Additional context or specific points to include' },
      tone: { type: 'string', enum: ['friendly', 'professional', 'firm'], default: 'professional' }
    },
    required: ['tenant_id', 'purpose']
  },
  category: 'generate',
  autonomyLevel: 3,
  riskLevel: 'none',
  reversible: true,
  // ...
};

// Generate listing description
const generate_listing: Tool = {
  name: 'generate_listing',
  description: 'Generate compelling listing copy for a property',
  input_schema: {
    type: 'object',
    properties: {
      property_id: { type: 'string' },
      highlight_features: { type: 'array', items: { type: 'string' } },
      target_audience: { type: 'string', enum: ['families', 'professionals', 'students', 'retirees', 'general'] }
    },
    required: ['property_id']
  },
  // ...
};

// Summarize applications
const summarize_applications: Tool = {
  name: 'summarize_applications',
  description: 'Summarize and rank tenant applications for a listing',
  input_schema: {
    type: 'object',
    properties: {
      listing_id: { type: 'string' },
      top_n: { type: 'number', default: 3 }
    },
    required: ['listing_id']
  },
  // ...
};

// Analyze rent pricing
const analyze_rent: Tool = {
  name: 'analyze_rent',
  description: 'Analyze current rent vs market and suggest adjustments',
  input_schema: {
    type: 'object',
    properties: {
      property_id: { type: 'string' },
      include_comparables: { type: 'boolean', default: true }
    },
    required: ['property_id']
  },
  // ...
};
```

#### Workflow Tools (Multi-Step Processes, L1-L2 Autonomy)

```typescript
// Find new tenant workflow
const workflow_find_tenant: Tool = {
  name: 'workflow_find_tenant',
  description: 'Start the full tenant finding workflow: create listing, syndicate, manage applications',
  input_schema: {
    type: 'object',
    properties: {
      property_id: { type: 'string' },
      available_from: { type: 'string', format: 'date' },
      weekly_rent: { type: 'number', description: 'Weekly rent in dollars' },
      lease_term_months: { type: 'number', default: 12 }
    },
    required: ['property_id', 'available_from', 'weekly_rent']
  },
  category: 'workflow',
  autonomyLevel: 1,  // Requires approval to start
  riskLevel: 'medium',
  reversible: true,  // Can pause/cancel
  // ...
};

// Onboard new tenant workflow
const workflow_onboard_tenant: Tool = {
  name: 'workflow_onboard_tenant',
  description: 'Onboard an approved tenant: generate lease, collect bond, lodge with state',
  input_schema: {
    type: 'object',
    properties: {
      application_id: { type: 'string' },
      start_date: { type: 'string', format: 'date' }
    },
    required: ['application_id', 'start_date']
  },
  // ...
};

// End tenancy workflow
const workflow_end_tenancy: Tool = {
  name: 'workflow_end_tenancy',
  description: 'Process end of tenancy: exit inspection, bond return, re-list property',
  input_schema: {
    type: 'object',
    properties: {
      tenancy_id: { type: 'string' },
      vacate_date: { type: 'string', format: 'date' },
      re_list: { type: 'boolean', default: true }
    },
    required: ['tenancy_id', 'vacate_date']
  },
  // ...
};
```

#### Memory Tools (Context Management, L4 Autonomy)

```typescript
// Remember preference
const remember: Tool = {
  name: 'remember',
  description: 'Store a user preference or important fact for future reference',
  input_schema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'What to remember (e.g., "preferred_plumber", "rent_increase_policy")' },
      value: { type: 'string', description: 'The preference or fact' },
      context: { type: 'string', description: 'When this applies (e.g., property_id)' }
    },
    required: ['key', 'value']
  },
  category: 'memory',
  autonomyLevel: 4,
  riskLevel: 'none',
  reversible: true,
  // ...
};

// Recall information
const recall: Tool = {
  name: 'recall',
  description: 'Retrieve stored preferences and facts relevant to current context',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to look up' },
      context: { type: 'string', description: 'Context to filter by (e.g., property_id)' }
    },
    required: ['query']
  },
  // ...
};
```

#### Planning Tools (Complex Task Management, L3 Autonomy)

```typescript
// Create a plan
const plan_task: Tool = {
  name: 'plan_task',
  description: 'Break down a complex request into steps. Use for multi-step tasks.',
  input_schema: {
    type: 'object',
    properties: {
      goal: { type: 'string', description: 'What the user wants to achieve' },
      constraints: { type: 'array', items: { type: 'string' }, description: 'Constraints or preferences' }
    },
    required: ['goal']
  },
  category: 'planning',
  autonomyLevel: 3,
  riskLevel: 'none',
  reversible: true,
  // ...
};

// Check and update plan
const check_plan: Tool = {
  name: 'check_plan',
  description: 'Review progress on current plan and identify next steps',
  input_schema: {
    type: 'object',
    properties: {
      plan_id: { type: 'string' }
    },
    required: ['plan_id']
  },
  // ...
};
```

---

## 4. Agentic Loop

### 4.1 Main Execution Loop

```typescript
async function agentLoop(
  userMessage: string,
  context: AgentContext
): Promise<AgentResponse> {

  // 1. Build full context for LLM
  const systemPrompt = buildSystemPrompt(context);
  const conversationHistory = await getRelevantHistory(context);
  const availableTools = selectToolsForContext(context);

  // 2. Initial LLM call
  let messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  // 3. Agentic loop - continue until done or max iterations
  const maxIterations = 10;
  let iteration = 0;
  let finalResponse: string | null = null;

  while (iteration < maxIterations) {
    iteration++;

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: availableTools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema
      }))
    });

    // 4. Check if done (no tool use)
    if (response.stop_reason === 'end_turn') {
      finalResponse = extractTextResponse(response);
      break;
    }

    // 5. Process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolUse = extractToolUse(response);
      const results: ToolResult[] = [];

      for (const call of toolUse) {
        const tool = availableTools.find(t => t.name === call.name);
        if (!tool) continue;

        // 5a. Check autonomy level
        const requiredLevel = context.autonomyOverrides[tool.name] ?? tool.autonomyLevel;

        if (requiredLevel < context.userAutonomyLevel) {
          // Need user approval
          return {
            type: 'needs_approval',
            pendingAction: {
              tool: tool.name,
              params: call.input,
              reason: tool.description
            },
            partialResponse: extractTextResponse(response)
          };
        }

        // 5b. Execute tool
        try {
          const result = await tool.execute(call.input, context);
          results.push(result);

          // Log for learning
          await logToolExecution(context.userId, tool.name, call.input, result);
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            display: `Failed to ${tool.name}: ${error.message}`
          });
        }
      }

      // 5c. Add tool results to conversation
      messages.push({
        role: 'assistant',
        content: response.content
      });

      messages.push({
        role: 'user',
        content: results.map(r => ({
          type: 'tool_result',
          tool_use_id: r.toolUseId,
          content: JSON.stringify(r)
        }))
      });
    }
  }

  // 6. Return final response
  return {
    type: 'complete',
    response: finalResponse,
    toolsUsed: messages.filter(m => m.role === 'assistant' && hasToolUse(m)).length
  };
}
```

### 4.2 System Prompt Structure

```typescript
function buildSystemPrompt(context: AgentContext): string {
  return `You are Casa, an AI property manager for Casa. You help property owners manage their rentals efficiently.

## Your Capabilities
You have access to tools that let you:
- Query property, tenant, payment, and maintenance information
- Send messages to tenants
- Create and manage maintenance requests
- Schedule inspections
- Generate listings and documents
- Run multi-step workflows (finding tenants, onboarding, end of tenancy)

## Current Context
- Owner: ${context.ownerName}
- Properties: ${context.properties.map(p => p.address).join(', ')}
- Active tenancies: ${context.activeTenancies}
- Pending items: ${context.pendingItems}

## Autonomy Rules
You can perform these actions without asking:
${context.autonomousActions.map(a => `- ${a}`).join('\n')}

You must ask before:
${context.requiresApproval.map(a => `- ${a}`).join('\n')}

## Learned Preferences
${context.preferences.map(p => `- ${p.key}: ${p.value}`).join('\n')}

## Guidelines
1. Be proactive but not presumptuous - suggest actions but confirm important ones
2. Use tools to get current data rather than making assumptions
3. When unsure, ask clarifying questions
4. Always explain your reasoning briefly
5. Format responses clearly with key information highlighted
6. For complex tasks, use plan_task to break them down first
7. Remember important preferences using the remember tool

## Tone
Professional but warm. You're a knowledgeable assistant, not a formal butler. Use Australian English.`;
}
```

### 4.3 Error Handling & Self-Correction

```typescript
async function executeWithRetry(
  tool: Tool,
  params: any,
  context: AgentContext,
  maxRetries: number = 3
): Promise<ToolResult> {

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await tool.execute(params, context);

      if (result.success) {
        return result;
      }

      // Tool returned failure - can we fix it?
      if (result.error?.includes('not found')) {
        // Try to search for the correct entity
        // ... self-correction logic
      }

      lastError = new Error(result.error);
    } catch (error) {
      lastError = error;

      // Transient error - retry with backoff
      if (isTransient(error)) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }

      // Permanent error - don't retry
      break;
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error after retries',
    display: `I wasn't able to complete this action. Error: ${lastError?.message}`
  };
}
```

---

## 5. Learning Engine

### 5.1 Preference Learning

```typescript
interface LearnedPreference {
  userId: string;
  preferenceType: string;
  key: string;
  value: any;
  confidence: number;  // 0-1
  source: 'explicit' | 'inferred' | 'correction';
  lastUpdated: Date;
}

// Track corrections to improve
async function trackCorrection(
  userId: string,
  originalAction: { tool: string; params: any; result: any },
  correction: { action: string; params: any }
) {
  // Store the correction pattern
  await db.corrections.create({
    userId,
    context: await getCurrentContext(userId),
    original: originalAction,
    corrected: correction,
    timestamp: new Date()
  });

  // Update preference if pattern emerges
  const similarCorrections = await db.corrections.count({
    userId,
    'original.tool': originalAction.tool,
    // similar context...
  });

  if (similarCorrections >= 3) {
    // Pattern detected - learn preference
    await updatePreference(userId, {
      preferenceType: 'action_override',
      key: `${originalAction.tool}_${hashContext(context)}`,
      value: correction,
      confidence: Math.min(0.5 + similarCorrections * 0.1, 0.95),
      source: 'correction'
    });
  }
}
```

### 5.2 Preference Retrieval

```typescript
async function getRelevantPreferences(
  userId: string,
  context: ToolContext
): Promise<LearnedPreference[]> {
  // Get all preferences above confidence threshold
  const preferences = await db.preferences.find({
    userId,
    confidence: { $gte: 0.6 }
  });

  // Filter to relevant context
  return preferences.filter(p =>
    isRelevantToContext(p, context)
  );
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Mission 14A)
- [ ] Claude API integration with tool use
- [ ] Core query tools (properties, tenants, payments, maintenance)
- [ ] Basic conversation handling
- [ ] Simple system prompt
- [ ] Conversation memory (last 20 messages)

### Phase 2: Actions (Mission 14B)
- [ ] Action tools (send_message, create_maintenance, schedule_inspection)
- [ ] Autonomy level system
- [ ] Action approval flow in app
- [ ] Action audit logging

### Phase 3: Generation (Mission 14C)
- [ ] Generation tools (draft_message, generate_listing, summarize_applications)
- [ ] Template system for common generations
- [ ] Owner feedback loop

### Phase 4: Workflows (Mission 14D)
- [ ] Multi-step workflow tools
- [ ] Planning tools (plan_task, check_plan)
- [ ] Background task execution
- [ ] Progress tracking UI

### Phase 5: Learning (Mission 14E)
- [ ] Preference storage and retrieval
- [ ] Correction tracking
- [ ] Automatic preference inference
- [ ] Confidence decay over time

### Phase 6: Polish (Mission 14F)
- [ ] Proactive insights system
- [ ] Smart context retrieval (vector search)
- [ ] Response caching for common queries
- [ ] Performance optimization

---

## 7. Database Schema (Updated)

```sql
-- Agent conversations (enhanced)
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- Context
  context_summary TEXT,  -- AI-generated summary of conversation

  -- Metadata
  messages_count INTEGER NOT NULL DEFAULT 0,
  tools_used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent messages (enhanced)
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,

  -- Message
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool_result')),
  content TEXT NOT NULL,

  -- Tool use (if assistant message with tools)
  tool_calls JSONB,  -- Array of tool calls
  tool_results JSONB,  -- Array of results

  -- Metrics
  latency_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,

  -- Feedback
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent tool executions (audit log)
CREATE TABLE agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id),
  message_id UUID REFERENCES agent_messages(id),
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Tool info
  tool_name TEXT NOT NULL,
  tool_params JSONB NOT NULL,

  -- Result
  success BOOLEAN NOT NULL,
  result JSONB,
  error TEXT,

  -- Autonomy
  autonomy_level INTEGER NOT NULL,
  required_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

-- Learned preferences
CREATE TABLE agent_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Preference
  preference_type TEXT NOT NULL,  -- 'autonomy', 'action_override', 'communication_style', etc.
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,

  -- Learning
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL CHECK (source IN ('explicit', 'inferred', 'correction')),

  -- Context (when this applies)
  context_filter JSONB,  -- e.g., { property_id: '...' }

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, preference_type, preference_key)
);

-- Corrections (for learning)
CREATE TABLE agent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id),

  -- What was corrected
  original_tool TEXT NOT NULL,
  original_params JSONB NOT NULL,
  original_result JSONB,

  -- The correction
  correction_type TEXT NOT NULL,  -- 'override', 'undo', 'modify'
  corrected_value JSONB,

  -- Context for pattern matching
  context_snapshot JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pending actions (need approval)
CREATE TABLE agent_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id),

  -- Action details
  tool_name TEXT NOT NULL,
  tool_params JSONB NOT NULL,
  reason TEXT NOT NULL,  -- Why this needs approval

  -- Preview
  preview_text TEXT,  -- Human-readable preview

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_note TEXT,

  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Background tasks (long-running workflows)
CREATE TABLE agent_background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Task info
  task_type TEXT NOT NULL,  -- 'workflow_find_tenant', 'workflow_onboard', etc.
  task_params JSONB NOT NULL,

  -- Progress
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER,
  progress_detail TEXT,

  -- Result
  result JSONB,
  error TEXT,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_conv_user ON agent_conversations(user_id, status, last_message_at DESC);
CREATE INDEX idx_agent_msg_conv ON agent_messages(conversation_id, created_at);
CREATE INDEX idx_agent_tools_user ON agent_tool_executions(user_id, created_at DESC);
CREATE INDEX idx_agent_prefs_user ON agent_preferences(user_id);
CREATE INDEX idx_agent_pending ON agent_pending_actions(user_id, status) WHERE status = 'pending';
CREATE INDEX idx_agent_tasks_user ON agent_background_tasks(user_id, status);
CREATE INDEX idx_agent_tasks_next ON agent_background_tasks(next_run_at) WHERE status = 'pending';

-- RLS Policies (users access only their own data)
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_background_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_conversations" ON agent_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_messages" ON agent_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM agent_conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "users_own_tool_executions" ON agent_tool_executions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_preferences" ON agent_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_corrections" ON agent_corrections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_pending_actions" ON agent_pending_actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_background_tasks" ON agent_background_tasks FOR ALL USING (auth.uid() = user_id);
```

---

## 8. Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **LLM** | Claude Sonnet 4 | Best tool use, reasoning, Australian English |
| **Runtime** | Cloudflare Workers | Edge latency, scales to zero, Durable Objects for state |
| **Queue** | Cloudflare Queues | Native integration, reliable |
| **Vector DB** | Supabase pgvector | Already using Supabase, good enough for scale |
| **Cache** | Cloudflare KV | Fast reads for preferences, recent context |

---

## 9. Key Differences from Current Design

| Aspect | Current CASA-BIBLE Design | New Frontier Design |
|--------|---------------------------|---------------------|
| Architecture | Separate agents per domain | Single agent with tool library |
| Tool Selection | Hardcoded routing | LLM chooses dynamically |
| Multi-Step | Manual orchestration | Agentic loop with planning |
| Approval | Binary (needs or doesn't) | 5-level autonomy system |
| Learning | Basic preference storage | Active learning from corrections |
| Context | Simple conversation memory | Retrieval + summarization |
| Error Handling | Fail and report | Self-correction attempts |

This new architecture makes the Casa agent truly autonomous - give it a goal, and it figures out how to achieve it.

---

## 10. Frontier Evolution — Moltbot-Calibre Architecture

> Full implementation details: See `MISSION-14-AI-ORCHESTRATOR.md` and `STEAD-BIBLE.md` (legacy name) Section 11.

The architecture above is the foundation. The frontier target is a Moltbot-calibre autonomous property manager with these additional capabilities:

### 10.1 Self-Evolving Skills
The agent creates new `agent_rules` as persistent tool behaviors. When 3+ similar corrections are received, the system generates a persistent rule that modifies future behavior without code changes. Rules are injected into the system prompt dynamically via context assembly. Owners can view, edit, and deactivate rules in Settings.

### 10.2 Expanded Tool Catalog (87 Tools)
The 30+ tools defined above expand to 87 across 7 categories:
- Property Intelligence (12): All portfolio queries + market comparables + compliance status
- Action Execution (25): Every CRUD operation an owner can do manually
- Integration Bridge (15): Domain, REA, Stripe, Twilio, SendGrid, Equifax, TICA, State Bond APIs
- Workflow Orchestration (10): Multi-step processes (find tenant, onboard, exit, maintenance, compliance, rent increase, lease renewal, inspection, arrears, property onboard)
- Memory & Learning (10): Preferences, corrections, rules, precedent search, trajectory evaluation
- Planning & Reasoning (8): Plans, cost estimation, risk assessment, yield calculation, cashflow forecasting
- Communication & Reporting (7): Draft messages, notices, income/tax/portfolio reports, notifications

### 10.3 Claude Agent SDK Migration
**Current**: Supabase Edge Function (Deno, 60s timeout, cold starts)
**Target**: Cloudflare Worker with `@anthropic-ai/claude-agent-sdk`

Key capabilities:
- **Tool Search Tool**: Dynamically discovers relevant tools from 87-tool catalog (5-10 per call instead of all 87)
- **Programmatic Tool Calling**: Agent calls tools based on runtime context, not static definitions
- **MCP Server Connections**: Each integration as a standalone MCP server (Stripe MCP, Twilio MCP, Domain MCP, Equifax MCP, SendGrid MCP, State Bond MCP)
- **Durable Objects**: Persistent state for long-running workflows (tenant finding spans days/weeks)

### 10.4 Memory with Retrieval (pgvector)
Every `agent_decision` generates an embedding. On new decisions, cosine similarity search against past decisions enables:
- Precedent-based confidence scoring
- Semantic owner preference retrieval
- Trajectory pattern optimisation

### 10.5 Proactive Heartbeat Engine (14 Scanners)
Expands from 4 to 14 scanners covering: lease lifecycle, rent collection, maintenance follow-up, compliance deadlines, inspection scheduling, communication follow-up, insurance renewal, market rent analysis, listing performance, application processing, payment plan monitoring, and more. Each scanner checks autonomy threshold before acting.
