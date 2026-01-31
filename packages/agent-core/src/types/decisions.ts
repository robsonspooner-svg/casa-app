import { AutonomyLevel } from './autonomy';

/**
 * Agent decision — audit trail entry for every tool execution.
 * Stored with pgvector embedding for precedent search.
 */
export interface AgentDecision {
  id: string;
  userId: string;
  conversationId?: string;
  propertyId?: string;
  decisionType: string;
  toolName: string;
  inputData: unknown;
  outputData?: unknown;
  reasoning?: string;
  confidence?: number;
  autonomyLevel: AutonomyLevel;
  ownerFeedback?: 'approved' | 'rejected' | 'corrected';
  ownerCorrection?: string;
  createdAt: string;
}

/**
 * Agent trajectory — recorded execution path for learning.
 * Each step in the trajectory records tool name, input, output, and duration.
 */
export interface AgentTrajectory {
  id: string;
  userId: string;
  conversationId?: string;
  toolSequence: TrajectoryStep[];
  totalDurationMs: number;
  success: boolean;
  efficiencyScore?: number;
  createdAt: string;
}

/**
 * Single step in a trajectory.
 */
export interface TrajectoryStep {
  tool: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  success: boolean;
}

/**
 * Pending action — awaiting owner approval.
 */
export interface AgentPendingAction {
  id: string;
  userId: string;
  conversationId?: string;
  propertyId?: string;
  actionType: string;
  title: string;
  description?: string;
  previewData?: unknown;
  toolName: string;
  toolParams: unknown;
  autonomyLevel: AutonomyLevel;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  resolvedAt?: string;
  createdAt: string;
}

/**
 * Background task — scheduled or triggered work.
 */
export interface AgentBackgroundTask {
  id: string;
  userId: string;
  propertyId?: string;
  taskType: string;
  triggerType: 'cron' | 'webhook' | 'event';
  schedule?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  resultData?: unknown;
  error?: string;
  createdAt: string;
}
