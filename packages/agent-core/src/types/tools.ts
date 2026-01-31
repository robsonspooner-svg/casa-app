import { AutonomyLevel, RiskLevel } from './autonomy';
import type { ToolResilience } from './resilience';

/**
 * Tool categories for the agent system.
 * Each category has different default autonomy and risk profiles.
 */
export type ToolCategory =
  | 'query'
  | 'action'
  | 'generate'
  | 'workflow'
  | 'memory'
  | 'planning'
  | 'integration';

/**
 * JSON Schema type for tool input validation.
 */
export interface JSONSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, JSONSchema & { description?: string }>;
  required?: string[];
  items?: JSONSchema;
  enum?: string[];
  description?: string;
}

/**
 * Tool definition interface.
 * Every tool in the agent system implements this shape.
 */
export interface ToolDefinition {
  /** Unique tool identifier (snake_case) */
  name: string;

  /** Human-readable description — the LLM reads this to decide when to use the tool */
  description: string;

  /** JSON Schema defining the tool's input parameters */
  input_schema: JSONSchema;

  /** Tool category for grouping and default autonomy */
  category: ToolCategory;

  /** Default autonomy level (can be overridden by owner preferences) */
  autonomyLevel: AutonomyLevel;

  /** Risk level determines escalation behavior */
  riskLevel: RiskLevel;

  /** Whether the action can be undone */
  reversible: boolean;

  /** Mission number when this tool becomes available */
  availableFromMission: number;

  /** Resilience configuration (retry, circuit breaker, timeout, fallback, idempotency) */
  resilience: ToolResilience;

  /** Tool to call to undo/compensate this action (if reversible) */
  compensationTool?: string;

  /** Tools that must succeed before this tool can execute in a workflow */
  dependsOn?: string[];
}

/**
 * Context passed to tool execution.
 * Contains user identity, property context, and preferences.
 */
export interface ToolContext {
  /** Authenticated user ID */
  userId: string;

  /** Current conversation ID (if in conversation) */
  conversationId?: string;

  /** Property ID (if property-scoped action) */
  propertyId?: string;

  /** Owner's active rules for this context */
  rules: AgentRule[];

  /** Owner's preferences for this context */
  preferences: AgentPreference[];

  /** Current effective autonomy level for this tool */
  effectiveAutonomy: AutonomyLevel;
}

/**
 * Result from tool execution.
 */
export interface ToolResult {
  /** Whether the tool executed successfully */
  success: boolean;

  /** Result data (passed back to Claude) */
  data?: unknown;

  /** Error message if failed */
  error?: string;

  /** Whether this result requires owner approval before proceeding */
  requiresApproval?: boolean;

  /** Preview data for pending action cards */
  previewData?: {
    title: string;
    description: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Agent rule — learned constraint injected into system prompt.
 */
export interface AgentRule {
  id: string;
  userId: string;
  propertyId?: string;
  ruleText: string;
  category: string;
  confidence: number;
  source: 'correction_pattern' | 'explicit' | 'inferred';
  active: boolean;
}

/**
 * Agent preference — owner setting or inferred preference.
 */
export interface AgentPreference {
  id: string;
  userId: string;
  propertyId?: string;
  category: string;
  preferenceKey: string;
  preferenceValue: unknown;
  source: 'explicit' | 'inferred' | 'default';
  confidence: number;
}
