// Mission 15: Agent Rules Management Hook
// Manages learned rules from correction-to-rule pipeline and manual owner rules

import { useState, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '../client';
import type { AgentRule, AgentRuleInsert, AgentRuleUpdate, RuleCategory } from '../types/database';

export interface AgentRulesState {
  rules: AgentRule[];
  loading: boolean;
  error: string | null;
}

export interface UseAgentRulesReturn extends AgentRulesState {
  refetch: () => Promise<void>;
  toggleRule: (ruleId: string, active: boolean) => Promise<void>;
  updateRule: (ruleId: string, updates: AgentRuleUpdate) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  createRule: (rule: { rule_text: string; category: RuleCategory; property_id?: string }) => Promise<AgentRule | null>;
}

export function useAgentRules(): UseAgentRulesReturn {
  const [rules, setRules] = useState<AgentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: fetchErr } = await supabase
        .from('agent_rules' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('active', { ascending: false })
        .order('confidence', { ascending: false });

      if (fetchErr) throw fetchErr;
      setRules((data as AgentRule[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const toggleRule = useCallback(async (ruleId: string, active: boolean) => {
    const supabase = getSupabaseClient();
    const rulesTable = supabase.from('agent_rules' as any) as any;
    const { error: err } = await rulesTable
      .update({ active })
      .eq('id', ruleId);

    if (err) throw err;

    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, active } : r));
  }, []);

  const updateRule = useCallback(async (ruleId: string, updates: AgentRuleUpdate) => {
    const supabase = getSupabaseClient();
    const rulesTable = supabase.from('agent_rules' as any) as any;
    const { error: err } = await rulesTable
      .update(updates)
      .eq('id', ruleId);

    if (err) throw err;

    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  }, []);

  const deleteRule = useCallback(async (ruleId: string) => {
    const supabase = getSupabaseClient();
    const { error: err } = await supabase
      .from('agent_rules' as any)
      .delete()
      .eq('id', ruleId);

    if (err) throw err;

    setRules(prev => prev.filter(r => r.id !== ruleId));
  }, []);

  const createRule = useCallback(async (rule: { rule_text: string; category: RuleCategory; property_id?: string }): Promise<AgentRule | null> => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const insert: AgentRuleInsert = {
      user_id: user.id,
      rule_text: rule.rule_text,
      category: rule.category,
      property_id: rule.property_id || null,
      confidence: 1.0, // Manual rules start at max confidence
      source: 'explicit',
      active: true,
    };

    const rulesTable = supabase.from('agent_rules' as any) as any;
    const { data, error: err } = await rulesTable
      .insert(insert)
      .select()
      .single();

    if (err) throw err;

    const newRule = data as AgentRule;
    setRules(prev => [newRule, ...prev]);
    return newRule;
  }, []);

  return {
    rules,
    loading,
    error,
    refetch: fetchRules,
    toggleRule,
    updateRule,
    deleteRule,
    createRule,
  };
}
