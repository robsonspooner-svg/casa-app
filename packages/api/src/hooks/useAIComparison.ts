// Mission 11: AI Entry/Exit Inspection Comparison Hook
// Fetches and triggers AI comparison between entry and exit inspections

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { InspectionAIComparisonRow, InspectionAIIssueRow } from '../types/database';

export interface AIComparisonState {
  comparison: InspectionAIComparisonRow | null;
  issues: InspectionAIIssueRow[];
  loading: boolean;
  error: string | null;
}

export interface AIComparisonResult {
  comparison_id: string;
  total_issues: number;
  tenant_responsible: number;
  wear_and_tear: number;
  improvements: number;
  estimated_total_cost: number;
  bond_deduction_recommended: number;
  summary: string;
  tenancy_duration_months: number;
  issues: Array<{
    room_name: string;
    item_name: string;
    entry_condition: string;
    exit_condition: string;
    change_type: 'wear_and_tear' | 'tenant_damage' | 'improvement' | 'unchanged';
    description: string;
    estimated_cost: number;
    confidence: number;
    requires_manual_review: boolean;
  }>;
}

export function useAIComparison(inspectionId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<AIComparisonState>({
    comparison: null,
    issues: [],
    loading: false,
    error: null,
  });

  const fetchComparison = useCallback(async () => {
    if (!inspectionId || !user) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      // Check for existing comparison where this inspection is the exit
      const { data: comparison, error: compError } = await supabase
        .from('inspection_ai_comparisons')
        .select('*')
        .or(`entry_inspection_id.eq.${inspectionId},exit_inspection_id.eq.${inspectionId}`)
        .order('comparison_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (compError) throw compError;

      if (comparison) {
        // Fetch issues for this comparison
        const comp = comparison as InspectionAIComparisonRow;
        const { data: issues, error: issuesError } = await supabase
          .from('inspection_ai_issues')
          .select('*')
          .eq('comparison_id', comp.id)
          .order('display_order');

        if (issuesError) throw issuesError;

        setState({
          comparison,
          issues: issues || [],
          loading: false,
          error: null,
        });
      } else {
        setState({
          comparison: null,
          issues: [],
          loading: false,
          error: null,
        });
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to fetch comparison';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [inspectionId, user]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  return {
    ...state,
    refreshComparison: fetchComparison,
  };
}

export function useAIComparisonMutations() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);

  const triggerComparison = useCallback(async (
    entryInspectionId: string,
    exitInspectionId: string
  ): Promise<AIComparisonResult> => {
    if (!user) throw new Error('Not authenticated');

    setRunning(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) throw new Error('No active session');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/compare-inspections`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entry_inspection_id: entryInspectionId,
            exit_inspection_id: exitInspectionId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Comparison failed' })) as { error?: string };
        throw new Error(errorData.error || `Comparison failed: ${response.status}`);
      }

      const result = await response.json() as { success: boolean; error?: string; data: AIComparisonResult };
      if (!result.success) {
        throw new Error(result.error || 'Comparison failed');
      }

      return result.data;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'AI comparison failed';
      throw new Error(message);
    } finally {
      setRunning(false);
    }
  }, [user]);

  const updateIssueClassification = useCallback(async (
    issueId: string,
    changeType: 'wear_and_tear' | 'tenant_damage' | 'improvement' | 'unchanged',
    estimatedCost?: number
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();
    const update: Record<string, unknown> = {
      change_type: changeType,
      owner_override: true,
    };

    if (estimatedCost !== undefined) {
      update.estimated_cost = estimatedCost;
    }

    const { error } = await (supabase
      .from('inspection_ai_issues') as ReturnType<typeof supabase.from>)
      .update(update)
      .eq('id', issueId);

    if (error) throw error;
  }, [user]);

  return {
    triggerComparison,
    updateIssueClassification,
    running,
  };
}
