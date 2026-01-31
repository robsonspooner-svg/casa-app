// useReminderTemplates Hook - Arrears Reminder Templates
// Mission 08: Arrears & Late Payment Management

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  ReminderTemplate,
  ReminderTemplateInsert,
  ReminderTemplateUpdate,
} from '../types/database';

export interface ReminderTemplatesState {
  templates: ReminderTemplate[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useReminderTemplates(): ReminderTemplatesState & {
  refreshTemplates: () => Promise<void>;
  systemTemplates: ReminderTemplate[];
  customTemplates: ReminderTemplate[];
  getTemplateForDays: (daysOverdue: number) => ReminderTemplate | null;
  createTemplate: (data: ReminderTemplateInsert) => Promise<string | null>;
  updateTemplate: (id: string, data: ReminderTemplateUpdate) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ReminderTemplatesState>({
    templates: [],
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchTemplates = useCallback(async (isRefresh = false) => {
    if (!user) {
      setState({ templates: [], loading: false, error: null, refreshing: false });
      return;
    }

    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const supabase = getSupabaseClient();

      // Fetch system templates (owner_id IS NULL) and user's custom templates
      const { data, error } = await supabase
        .from('reminder_templates')
        .select('*')
        .or(`owner_id.is.null,owner_id.eq.${user.id}`)
        .eq('is_active', true)
        .order('days_overdue', { ascending: true });

      if (error) throw error;

      setState({
        templates: (data || []) as ReminderTemplate[],
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch templates';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTemplates();
    }
  }, [fetchTemplates, isAuthenticated]);

  const refreshTemplates = useCallback(async () => {
    await fetchTemplates(true);
  }, [fetchTemplates]);

  // Split into system and custom templates
  const systemTemplates = state.templates.filter(t => t.owner_id === null);
  const customTemplates = state.templates.filter(t => t.owner_id !== null);

  // Get the appropriate template for a given number of days overdue
  const getTemplateForDays = useCallback((daysOverdue: number): ReminderTemplate | null => {
    // Find templates that match this threshold, preferring custom over system
    const customMatch = customTemplates
      .filter(t => daysOverdue >= t.days_overdue && !t.is_breach_notice)
      .sort((a, b) => b.days_overdue - a.days_overdue)[0];

    if (customMatch) return customMatch;

    const systemMatch = systemTemplates
      .filter(t => daysOverdue >= t.days_overdue && !t.is_breach_notice)
      .sort((a, b) => b.days_overdue - a.days_overdue)[0];

    return systemMatch || null;
  }, [systemTemplates, customTemplates]);

  // Create a custom template
  const createTemplate = useCallback(async (data: ReminderTemplateInsert): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();

      const { data: template, error } = await (supabase
        .from('reminder_templates') as any)
        .insert({
          ...data,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh the list
      await fetchTemplates();

      return (template as any).id;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to create template';
      setState(prev => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, [user, fetchTemplates]);

  // Update a custom template
  const updateTemplate = useCallback(async (id: string, data: ReminderTemplateUpdate): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('reminder_templates') as any)
        .update(data)
        .eq('id', id)
        .eq('owner_id', user.id); // Ensure user can only update their own

      if (error) throw error;

      // Refresh the list
      await fetchTemplates();

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to update template';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, fetchTemplates]);

  // Delete a custom template (soft delete by setting is_active = false)
  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('reminder_templates') as any)
        .update({ is_active: false })
        .eq('id', id)
        .eq('owner_id', user.id); // Ensure user can only delete their own

      if (error) throw error;

      // Refresh the list
      await fetchTemplates();

      return true;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to delete template';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user, fetchTemplates]);

  return {
    ...state,
    refreshTemplates,
    systemTemplates,
    customTemplates,
    getTemplateForDays,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}

// Helper function to render a template with variables
export function renderTemplate(
  template: ReminderTemplate,
  variables: Record<string, string | number>
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  // Replace all {{variable}} placeholders
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject = subject.replace(regex, String(value));
    body = body.replace(regex, String(value));
  });

  return { subject, body };
}
