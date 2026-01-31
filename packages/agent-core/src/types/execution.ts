import type { ToolDefinition, ToolContext, ToolResult, AgentRule, AgentPreference } from './tools';
import type { ToolResilience, ErrorCategory, CircuitBreakerConfig } from './resilience';
import type { WorkflowCheckpoint, BackgroundTaskDefinition } from './workflows';
import { AutonomyLevel } from './autonomy';

// ─── Tool Execution Pipeline ────────────────────────────────────────────────

/**
 * Result of resolving effective autonomy for a tool call.
 * Combines tool default, owner preferences, rules, and graduation state.
 */
export interface AutonomyResolution {
  /** The resolved effective autonomy level */
  effectiveLevel: AutonomyLevel;
  /** Source of the autonomy level */
  source: 'tool_default' | 'owner_preference' | 'rule_override' | 'graduated' | 'never_auto';
  /** Whether this tool requires approval at this autonomy level */
  requiresApproval: boolean;
  /** Number of successful past executions (for graduation tracking) */
  approvalCount: number;
  /** Reason if escalated */
  escalationReason?: string;
}

/**
 * Complete context assembled for a tool execution.
 * Built by the ContextAssembler before the reasoning loop.
 */
export interface ExecutionContext {
  /** Authenticated user ID (from JWT) */
  userId: string;
  /** Current conversation ID */
  conversationId: string;
  /** Message ID that triggered this execution */
  messageId: string;
  /** Active property IDs in scope */
  propertyIds: string[];
  /** Owner's active rules (filtered by relevance) */
  rules: AgentRule[];
  /** Owner's preferences (filtered by relevance) */
  preferences: AgentPreference[];
  /** Current mission level (determines tool availability) */
  missionLevel: number;
  /** Financial threshold for auto-approval (from owner preferences) */
  financialThreshold: number;
  /** Recent trajectory summaries for precedent-informed decisions */
  recentTrajectories: TrajectoryReference[];
}

/**
 * Lightweight reference to a past trajectory for context injection.
 */
export interface TrajectoryReference {
  /** Tools used in sequence */
  toolSequence: string[];
  /** Whether this trajectory was successful */
  success: boolean;
  /** Similarity score to current context (0-1) */
  relevance: number;
}

// ─── Tool Router ────────────────────────────────────────────────────────────

/**
 * Input to the tool router for resolving available tools.
 */
export interface ToolRouterInput {
  /** Current execution context */
  context: ExecutionContext;
  /** Specific tool name requested (if any) */
  requestedTool?: string;
}

/**
 * Result of tool routing — which tools are available and their effective autonomy.
 */
export interface ToolRouterResult {
  /** Tools available for this context (mission-gated + active) */
  availableTools: ToolDefinition[];
  /** Tool definitions formatted for Claude's tool_use parameter */
  claudeToolDefs: ClaudeToolDefinition[];
  /** Pre-computed autonomy resolutions per tool */
  autonomyMap: Record<string, AutonomyResolution>;
}

/**
 * Tool definition formatted for Claude API's tool_use parameter.
 */
export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ─── Tool Executor ──────────────────────────────────────────────────────────

/**
 * Request to execute a specific tool (from Claude's tool_use response).
 */
export interface ToolExecutionRequest {
  /** Tool name from Claude's response */
  toolName: string;
  /** Tool input parameters from Claude's response */
  toolInput: Record<string, unknown>;
  /** Execution context */
  context: ExecutionContext;
  /** Pre-resolved autonomy for this tool */
  autonomy: AutonomyResolution;
  /** Tool definition (resolved from catalog) */
  toolDef: ToolDefinition;
}

/**
 * Result of tool execution with full audit data.
 */
export interface ToolExecutionResult {
  /** Tool result (success or error) */
  result: ToolResult;
  /** Whether execution was actually performed (false if gated) */
  executed: boolean;
  /** If not executed, the pending action ID created */
  pendingActionId?: string;
  /** Execution duration (ms) */
  durationMs: number;
  /** Number of retries attempted */
  retriesUsed: number;
  /** Whether circuit breaker was triggered */
  circuitBreakerTriggered: boolean;
  /** Whether fallback was used */
  fallbackUsed: boolean;
  /** Error category if failed */
  errorCategory?: ErrorCategory;
  /** Idempotency key used (for dedup) */
  idempotencyKey?: string;
}

// ─── Circuit Breaker State ──────────────────────────────────────────────────

/**
 * Runtime state of a circuit breaker (stored in Durable Object).
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerStatus {
  /** Current circuit state */
  state: CircuitBreakerState;
  /** Service name */
  service: string;
  /** Number of failures in current window */
  failureCount: number;
  /** When the current failure window started */
  windowStartMs: number;
  /** When the circuit was opened (if open) */
  openedAtMs?: number;
  /** Attempts made in half-open state */
  halfOpenAttempts: number;
}

// ─── Idempotency ────────────────────────────────────────────────────────────

/**
 * Idempotency record stored in KV.
 */
export interface IdempotencyRecord {
  /** The idempotency key */
  key: string;
  /** Tool result from first execution */
  result: ToolResult;
  /** When this record was created */
  createdAt: string;
  /** When this record expires */
  expiresAt: string;
}

// ─── Streaming & SSE ────────────────────────────────────────────────────────

/**
 * SSE event types sent from Worker to client.
 */
export type SSEEventType =
  | 'token'           // Streaming text token
  | 'tool_start'      // Tool execution started
  | 'tool_result'     // Tool execution completed
  | 'tool_gated'      // Tool requires approval
  | 'workflow_step'   // Workflow step completed
  | 'error'           // Error occurred
  | 'done';           // Stream complete

/**
 * SSE event payload sent to client.
 */
export interface SSEEvent {
  type: SSEEventType;
  data: SSETokenEvent | SSEToolEvent | SSEWorkflowEvent | SSEErrorEvent | SSEDoneEvent;
}

export interface SSETokenEvent {
  text: string;
}

export interface SSEToolEvent {
  toolName: string;
  status: 'started' | 'completed' | 'failed' | 'gated';
  result?: ToolResult;
  pendingActionId?: string;
  durationMs?: number;
}

export interface SSEWorkflowEvent {
  workflowName: string;
  stepIndex: number;
  stepDescription: string;
  status: 'completed' | 'waiting_gate' | 'failed';
}

export interface SSEErrorEvent {
  message: string;
  recoverable: boolean;
}

export interface SSEDoneEvent {
  messageId: string;
  toolsUsed: string[];
  totalDurationMs: number;
}

// ─── Agent Request/Response ─────────────────────────────────────────────────

/**
 * Request body from client to Worker.
 */
export interface AgentRequest {
  /** User message content */
  message: string;
  /** Conversation ID (omit for new conversation) */
  conversationId?: string;
  /** Property context (which properties are relevant) */
  propertyIds?: string[];
  /** Whether to use streaming (SSE) response */
  stream?: boolean;
}

/**
 * Non-streaming response from Worker.
 */
export interface AgentResponse {
  /** Conversation ID (created or existing) */
  conversationId: string;
  /** Message ID for this response */
  messageId: string;
  /** Agent's text response */
  content: string;
  /** Tools that were executed */
  toolsUsed: ToolExecutionSummary[];
  /** Pending actions created (needs approval) */
  pendingActions: PendingActionSummary[];
  /** Total processing time (ms) */
  durationMs: number;
}

export interface ToolExecutionSummary {
  toolName: string;
  category: string;
  success: boolean;
  durationMs: number;
  fallbackUsed: boolean;
}

export interface PendingActionSummary {
  id: string;
  toolName: string;
  description: string;
  previewData?: Record<string, unknown>;
  expiresAt: string;
}

// ─── Pending Action Resolution ──────────────────────────────────────────────

/**
 * Owner's response to a pending action.
 */
export interface PendingActionResolution {
  /** Pending action ID */
  actionId: string;
  /** Owner's decision */
  decision: 'approve' | 'reject' | 'modify';
  /** Modified parameters (if decision is 'modify') */
  modifiedParams?: Record<string, unknown>;
  /** Owner's feedback/reason */
  feedback?: string;
}

// ─── Background Task Execution ──────────────────────────────────────────────

/**
 * Background task execution request (from cron or event trigger).
 */
export interface BackgroundTaskRequest {
  /** Task definition name */
  taskName: string;
  /** Trigger source */
  trigger: 'cron' | 'event';
  /** Event data (if event-triggered) */
  eventData?: Record<string, unknown>;
  /** User ID scope (for cron tasks, iterates all users) */
  userId?: string;
}

/**
 * Background task execution result.
 */
export interface BackgroundTaskResult {
  /** Task name */
  taskName: string;
  /** Whether task completed successfully */
  success: boolean;
  /** Number of tool executions within this task */
  toolExecutions: number;
  /** Actions that were auto-executed */
  autoExecuted: string[];
  /** Actions that created pending approvals */
  pendingCreated: string[];
  /** Errors encountered */
  errors: string[];
  /** Total duration (ms) */
  durationMs: number;
}
