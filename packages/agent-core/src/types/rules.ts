/**
 * Agent correction — owner's correction of an agent action.
 * Accumulated corrections trigger rule generation.
 */
export interface AgentCorrection {
  id: string;
  userId: string;
  decisionId?: string;
  originalAction: string;
  correction: string;
  contextSnapshot: CorrectionContext;
  patternMatched: boolean;
  createdAt: string;
}

/**
 * Context captured at the time of correction.
 * Used for pattern matching across corrections.
 */
export interface CorrectionContext {
  toolName: string;
  toolCategory: string;
  propertyId?: string;
  inputData: unknown;
  outputData: unknown;
  conversationContext?: string;
}

/**
 * Rule generation request — sent to Claude when pattern threshold is met.
 */
export interface RuleGenerationInput {
  corrections: AgentCorrection[];
  commonContext: {
    toolName: string;
    category: string;
    propertyId?: string;
  };
}

/**
 * Generated rule from correction patterns.
 */
export interface GeneratedRule {
  ruleText: string;
  category: string;
  confidence: number;
  correctionIds: string[];
}
