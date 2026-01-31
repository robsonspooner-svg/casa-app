/**
 * Gate types that pause workflow execution until a condition is met.
 */
export type WorkflowGate =
  | 'owner_approval'
  | 'webhook_wait'
  | 'schedule_wait';

/**
 * How step parameters are resolved at runtime.
 */
export type ParamResolver =
  | 'static'
  | 'from_previous'
  | 'from_context';

/**
 * A single step in a workflow composition.
 */
export interface WorkflowStep {
  /** Step index (0-based) */
  stepIndex: number;

  /** Tool to execute at this step */
  toolName: string;

  /** How to resolve parameters for this step */
  paramResolver: ParamResolver;

  /** Static parameters (when paramResolver is 'static') */
  staticParams?: Record<string, unknown>;

  /** Gate that pauses execution until condition is met */
  gate?: WorkflowGate;

  /** Tool to call to undo this step on workflow failure */
  compensationTool?: string;

  /** Parameters for the compensation tool */
  compensationParams?: Record<string, unknown>;

  /** If true, step failure doesn't halt the workflow */
  optional?: boolean;

  /** If true, execute once per item in a collection result */
  perItem?: boolean;

  /** Human-readable description of what this step does */
  description: string;
}

/**
 * Complete workflow definition.
 * Orchestrates multi-step tool sequences with checkpointing and compensation.
 */
export interface WorkflowDefinition {
  /** Unique workflow identifier */
  name: string;

  /** Human-readable description for the LLM */
  description: string;

  /** Ordered steps in this workflow */
  steps: WorkflowStep[];

  /** Maximum total execution time before timeout (ms) */
  maxDurationMs: number;

  /** Whether to persist state after each step */
  checkpointAfterEachStep: boolean;

  /** Whether a paused/failed workflow can be resumed */
  resumable: boolean;

  /** How long a paused workflow stays resumable (ms) */
  resumeWindowMs: number;

  /** Mission number when this workflow becomes available */
  availableFromMission: number;
}

/**
 * Compensation action stored on the stack for rollback.
 */
export interface CompensationAction {
  /** Step index that created this compensation */
  stepIndex: number;

  /** Tool to call for compensation */
  toolName: string;

  /** Parameters for the compensation tool */
  params: Record<string, unknown>;
}

/**
 * Checkpoint state for a running workflow.
 * Enables resume after pause/failure.
 */
export interface WorkflowCheckpoint {
  /** Unique workflow execution ID */
  workflowId: string;

  /** Workflow definition name */
  workflowName: string;

  /** User who initiated the workflow */
  userId: string;

  /** Current step index */
  stepIndex: number;

  /** Result from the most recent step */
  stepResult: unknown;

  /** Indices of completed steps */
  completedSteps: number[];

  /** Gate currently blocking execution */
  pendingGate?: WorkflowGate;

  /** Stack of compensation actions for rollback */
  compensationStack: CompensationAction[];

  /** Accumulated context from all completed steps */
  accumulatedContext: Record<string, unknown>;

  /** When this checkpoint expires */
  expiresAt: string;

  /** When the workflow was started */
  startedAt: string;

  /** Current status */
  status: 'running' | 'paused' | 'failed' | 'completed' | 'compensating';
}

/**
 * Background task trigger types.
 */
export type TriggerType = 'cron' | 'event';

/**
 * Background task definition for automated agent operations.
 */
export interface BackgroundTaskDefinition {
  /** Unique task identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** How this task is triggered */
  triggerType: TriggerType;

  /** Cron expression (if triggerType is 'cron') — IANA timezone: Australia/Sydney */
  cronExpression?: string;

  /** Event name that triggers this task (if triggerType is 'event') */
  eventName?: string;

  /** Tools used in this task */
  toolsUsed: string[];

  /** Default autonomy level for this background task */
  defaultAutonomy: number;

  /** Mission when this task becomes available */
  availableFromMission: number;
}
