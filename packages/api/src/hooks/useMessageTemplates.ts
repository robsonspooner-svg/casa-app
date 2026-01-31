// useMessageTemplates Hook - Message Templates
// Mission 12: In-App Communications

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type { MessageTemplateRow } from '../types/database';

export interface MessageTemplatesState {
  templates: MessageTemplateRow[];
  loading: boolean;
  error: string | null;
}

export function useMessageTemplates(category?: string): MessageTemplatesState & {
  refreshTemplates: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<MessageTemplatesState>({
    templates: [],
    loading: true,
    error: null,
  });

  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setState({ templates: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      let query = (supabase
        .from('message_templates') as ReturnType<typeof supabase.from>)
        .select('*')
        .order('usage_count', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;

      setState({
        templates: (data || []) as MessageTemplateRow[],
        loading: false,
        error: null,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch templates';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
    }
  }, [user, category]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTemplates();
    }
  }, [fetchTemplates, isAuthenticated]);

  const refreshTemplates = useCallback(async () => {
    await fetchTemplates();
  }, [fetchTemplates]);

  return {
    ...state,
    refreshTemplates,
  };
}

/**
 * Render a template with variable substitution.
 * Variables are in {{variable_name}} format.
 */
export function renderMessageTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}
