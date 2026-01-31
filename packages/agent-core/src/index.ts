// Types — Autonomy
export {
  AutonomyLevel,
  RiskLevel,
  RISK_TO_MAX_AUTONOMY,
  GRADUATION_THRESHOLD,
  GRADUATION_CORRECTION_TOLERANCE,
  RULE_CONFIDENCE_INITIAL,
  RULE_CONFIDENCE_MIN,
  RULE_CONFIDENCE_MAX,
  RULE_CONFIDENCE_INCREMENT,
  RULE_CONFIDENCE_DECREMENT,
  CORRECTION_PATTERN_THRESHOLD,
  ErrorCategory,
} from './types/autonomy';
export type { AutonomyLevelNumber } from './types/autonomy';

// Types — Tools
export type {
  ToolCategory,
  JSONSchema,
  ToolDefinition,
  ToolContext,
  ToolResult,
  AgentRule,
  AgentPreference,
} from './types/tools';

// Types — Decisions
export type {
  AgentDecision,
  AgentTrajectory,
  TrajectoryStep,
  AgentPendingAction,
  AgentBackgroundTask,
} from './types/decisions';

// Types — Rules
export type {
  AgentCorrection,
  CorrectionContext,
  RuleGenerationInput,
  GeneratedRule,
} from './types/rules';

// Types — Preferences
export type { PreferenceCategory, PropertyDefaults } from './types/preferences';
export { DEFAULT_PROPERTY_PREFERENCES } from './types/preferences';

// Types — Resilience
export type {
  RetryConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  FallbackConfig,
  IdempotencyConfig,
  ToolResilience,
  TimeoutTier,
  FallbackStrategy,
} from './types/resilience';
export { TIMEOUT_TIER_MS, RESILIENCE_PRESETS } from './types/resilience';

// Types — Workflows
export type {
  WorkflowGate,
  ParamResolver,
  WorkflowStep,
  WorkflowDefinition,
  CompensationAction,
  WorkflowCheckpoint,
  TriggerType,
  BackgroundTaskDefinition,
} from './types/workflows';

// Types — Execution (Tool-to-Platform Integration)
export type {
  AutonomyResolution,
  ExecutionContext,
  TrajectoryReference,
  ToolRouterInput,
  ToolRouterResult,
  ClaudeToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
  CircuitBreakerState,
  CircuitBreakerStatus,
  IdempotencyRecord,
  SSEEventType,
  SSEEvent,
  SSETokenEvent,
  SSEToolEvent,
  SSEWorkflowEvent,
  SSEErrorEvent,
  SSEDoneEvent,
  AgentRequest,
  AgentResponse,
  ToolExecutionSummary,
  PendingActionSummary,
  PendingActionResolution,
  BackgroundTaskRequest,
  BackgroundTaskResult,
} from './types/execution';

// Constants — Autonomy Defaults
export {
  CATEGORY_DEFAULT_AUTONOMY,
  NEVER_AUTO_EXECUTE,
  GRADUATED_AUTO_EXECUTE,
} from './constants/autonomy-defaults';

// Constants — Risk Matrix
export {
  ACTION_RISK_MATRIX,
  DEFAULT_FINANCIAL_THRESHOLD,
  CONFIDENCE_ESCALATION_THRESHOLD,
} from './constants/risk-matrix';

// Constants — Tool Catalog
export {
  TOOL_CATALOG,
  TOOL_BY_NAME,
  TOOL_COUNTS,
  getToolsForMission,
  getToolsByCategory,
} from './constants/tool-catalog';

// Constants — Circuit Breakers
export {
  CIRCUIT_BREAKER_CONFIGS,
  NOTIFICATION_FALLBACK_CHAIN,
  PAYMENT_RETRY_STRATEGY,
} from './constants/circuit-breakers';

// Constants — Workflows
export {
  WORKFLOW_FIND_TENANT,
  WORKFLOW_ONBOARD_TENANT,
  WORKFLOW_END_TENANCY,
  WORKFLOW_MAINTENANCE_LIFECYCLE,
  WORKFLOW_ARREARS_ESCALATION,
  WORKFLOW_DEFINITIONS,
  WORKFLOW_BY_NAME,
} from './constants/workflows';

// Constants — Background Tasks
export {
  BACKGROUND_TASKS,
  BACKGROUND_TASK_BY_NAME,
  getBackgroundTasksForMission,
} from './constants/background-tasks';
