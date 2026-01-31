/**
 * Error categories for the agent system.
 * Every tool failure is classified into one of these categories.
 */
export enum ErrorCategory {
  /** E1xx — Network timeout, rate limit, 502/503. Retry with backoff. */
  Transient = 'transient',
  /** E2xx — API slow, partial data. Retry then fallback. */
  Degraded = 'degraded',
  /** E3xx — API removed, auth revoked. Fallback path, alert ops. */
  PermanentSystem = 'permanent_system',
  /** E4xx — Invalid input, entity not found. Return to agent for re-plan. */
  PermanentLogic = 'permanent_logic',
  /** E5xx — Insufficient funds, legal decision. Escalate to owner. */
  UserActionRequired = 'user_action_required',
  /** E6xx — Data corruption, compliance violation. Stop execution, notify admin. */
  SafetyHalt = 'safety_halt',
}

/**
 * Retry configuration for tool execution.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries (ms) */
  baseDelayMs: number;
  /** Maximum delay cap (ms) */
  maxDelayMs: number;
  /** Multiplier applied to delay after each retry */
  backoffMultiplier: number;
  /** Random jitter added to delay to prevent thundering herd (ms) */
  jitterMs: number;
  /** Error categories that are eligible for retry */
  retryableErrors: readonly ErrorCategory[];
}

/**
 * Circuit breaker configuration for external service calls.
 * Prevents cascading failures by short-circuiting after repeated failures.
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time window for counting failures (ms) */
  failureWindowMs: number;
  /** Time to wait before attempting half-open state (ms) */
  halfOpenAfterMs: number;
  /** Max requests allowed in half-open state before deciding */
  halfOpenMaxAttempts: number;
}

/**
 * Timeout tiers for tool execution.
 */
export type TimeoutTier = 'fast' | 'standard' | 'extended' | 'long' | 'workflow';

/**
 * Timeout tier durations (ms).
 */
export const TIMEOUT_TIER_MS: Record<TimeoutTier, number> = {
  fast: 5_000,
  standard: 10_000,
  extended: 30_000,
  long: 60_000,
  workflow: 120_000,
};

/**
 * Timeout configuration for tool execution.
 */
export interface TimeoutConfig {
  /** Maximum execution time (ms) */
  executionMs: number;
  /** Named tier for categorization */
  tier: TimeoutTier;
}

/**
 * Fallback strategies when a tool fails after retries.
 */
export type FallbackStrategy =
  | 'cache'
  | 'queue'
  | 'alternative_tool'
  | 'manual_escalation'
  | 'skip';

/**
 * Fallback configuration for tool failures.
 */
export interface FallbackConfig {
  /** Strategy to use when tool fails */
  strategy: FallbackStrategy;
  /** Alternative tool to call (if strategy is 'alternative_tool') */
  alternativeTool?: string;
  /** Max age for cached data to be considered valid (ms) */
  cacheMaxAgeMs?: number;
  /** Delay before retrying queued operation (ms) */
  queueRetryAfterMs?: number;
}

/**
 * Idempotency configuration for tools with side effects.
 * Prevents duplicate execution of the same operation.
 */
export interface IdempotencyConfig {
  /** Whether idempotency protection is required */
  required: boolean;
  /** Fields from input used to generate idempotency key */
  keyFields: readonly string[];
  /** TTL for idempotency key (seconds) */
  ttlSeconds: number;
}

/**
 * Complete resilience configuration for a tool.
 * Defines how the tool handles failures at every level.
 */
export interface ToolResilience {
  /** Retry behavior on failure */
  retry: RetryConfig;
  /** Circuit breaker for external service (optional for internal tools) */
  circuitBreaker?: CircuitBreakerConfig;
  /** Execution timeout */
  timeout: TimeoutConfig;
  /** Fallback when all retries exhausted */
  fallback: FallbackConfig;
  /** Idempotency protection */
  idempotency: IdempotencyConfig;
}

/**
 * Shared resilience presets for common tool patterns.
 */
export const RESILIENCE_PRESETS: Record<string, Omit<ToolResilience, 'circuitBreaker'>> = {
  /** Read-only queries — fast timeout, cache fallback */
  query: {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 4_000,
      backoffMultiplier: 2,
      jitterMs: 200,
      retryableErrors: [ErrorCategory.Transient, ErrorCategory.Degraded],
    },
    timeout: { executionMs: 5_000, tier: 'fast' as TimeoutTier },
    fallback: { strategy: 'cache' as FallbackStrategy, cacheMaxAgeMs: 300_000 },
    idempotency: { required: false, keyFields: [], ttlSeconds: 0 },
  },

  /** Standard actions — moderate retry, manual escalation */
  action: {
    retry: {
      maxAttempts: 2,
      baseDelayMs: 2_000,
      maxDelayMs: 4_000,
      backoffMultiplier: 2,
      jitterMs: 500,
      retryableErrors: [ErrorCategory.Transient],
    },
    timeout: { executionMs: 10_000, tier: 'standard' as TimeoutTier },
    fallback: { strategy: 'manual_escalation' as FallbackStrategy },
    idempotency: { required: true, keyFields: [], ttlSeconds: 3_600 },
  },

  /** Generation tasks — longer timeout, circuit breaker on LLM */
  generate: {
    retry: {
      maxAttempts: 2,
      baseDelayMs: 3_000,
      maxDelayMs: 6_000,
      backoffMultiplier: 2,
      jitterMs: 500,
      retryableErrors: [ErrorCategory.Transient, ErrorCategory.Degraded],
    },
    timeout: { executionMs: 30_000, tier: 'extended' as TimeoutTier },
    fallback: { strategy: 'manual_escalation' as FallbackStrategy },
    idempotency: { required: false, keyFields: [], ttlSeconds: 0 },
  },

  /** External integrations — aggressive retry, queue fallback */
  integration: {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 5_000,
      maxDelayMs: 45_000,
      backoffMultiplier: 3,
      jitterMs: 1_000,
      retryableErrors: [ErrorCategory.Transient, ErrorCategory.Degraded],
    },
    timeout: { executionMs: 30_000, tier: 'extended' as TimeoutTier },
    fallback: { strategy: 'queue' as FallbackStrategy, queueRetryAfterMs: 300_000 },
    idempotency: { required: true, keyFields: [], ttlSeconds: 3_600 },
  },

  /** Payment operations — minimal retry, never duplicate */
  payment: {
    retry: {
      maxAttempts: 1,
      baseDelayMs: 5_000,
      maxDelayMs: 5_000,
      backoffMultiplier: 1,
      jitterMs: 0,
      retryableErrors: [ErrorCategory.Transient],
    },
    timeout: { executionMs: 30_000, tier: 'extended' as TimeoutTier },
    fallback: { strategy: 'manual_escalation' as FallbackStrategy },
    idempotency: { required: true, keyFields: [], ttlSeconds: 86_400 },
  },
};
