/**
 * Autonomy Levels (L0-L4)
 *
 * Defines how much the agent can do without owner approval.
 * Starts conservative, graduates based on trust signals.
 */

export enum AutonomyLevel {
  /** Notify only — no action taken */
  Inform = 0,
  /** Recommend action, owner confirms or rejects */
  Suggest = 1,
  /** Prepare draft for review, owner edits/approves */
  Draft = 2,
  /** Execute action, report after completion */
  Execute = 3,
  /** Silent execution, logged only */
  Autonomous = 4,
}

export type AutonomyLevelNumber = 0 | 1 | 2 | 3 | 4;

/**
 * Risk levels for agent actions.
 * Higher risk = lower default autonomy.
 */
export enum RiskLevel {
  None = 'none',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

/**
 * Maps risk level to maximum default autonomy.
 * Owner can override upward after demonstrating trust.
 */
export const RISK_TO_MAX_AUTONOMY: Record<RiskLevel, AutonomyLevel> = {
  [RiskLevel.None]: AutonomyLevel.Autonomous,
  [RiskLevel.Low]: AutonomyLevel.Execute,
  [RiskLevel.Medium]: AutonomyLevel.Draft,
  [RiskLevel.High]: AutonomyLevel.Suggest,
  [RiskLevel.Critical]: AutonomyLevel.Inform,
};

/**
 * Graduation thresholds.
 * After N successful uses with 0 corrections, suggest autonomy upgrade.
 */
export const GRADUATION_THRESHOLD = 10;
export const GRADUATION_CORRECTION_TOLERANCE = 0;

/**
 * Rule confidence bounds.
 * Rules below MIN are deactivated.
 * Rules at MAX are considered established.
 */
export const RULE_CONFIDENCE_INITIAL = 0.7;
export const RULE_CONFIDENCE_MIN = 0.3;
export const RULE_CONFIDENCE_MAX = 1.0;
export const RULE_CONFIDENCE_INCREMENT = 0.05;
export const RULE_CONFIDENCE_DECREMENT = 0.15;

/**
 * Correction pattern threshold.
 * After N similar corrections, generate a rule.
 */
export const CORRECTION_PATTERN_THRESHOLD = 3;

/**
 * Re-export ErrorCategory from resilience for convenience.
 */
export { ErrorCategory } from './resilience';
