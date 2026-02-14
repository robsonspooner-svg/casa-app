// Mission 13: Reports Management Hook
// Generated reports + scheduled reports CRUD

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type {
  GeneratedReportRow,
  GeneratedReportInsert,
  ScheduledReportRow,
  ScheduledReportInsert,
  ScheduledReportUpdate,
} from '../types/database';

export interface ReportsState {
  generatedReports: GeneratedReportRow[];
  scheduledReports: ScheduledReportRow[];
  loading: boolean;
  error: string | null;
}

export function useReports() {
  const [state, setState] = useState<ReportsState>({
    generatedReports: [],
    scheduledReports: [],
    loading: true,
    error: null,
  });

  const fetchReports = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [generatedResult, scheduledResult] = await Promise.all([
        (supabase.from('generated_reports') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        (supabase.from('scheduled_reports') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (generatedResult.error) throw generatedResult.error;
      if (scheduledResult.error) throw scheduledResult.error;

      setState({
        generatedReports: (generatedResult.data as GeneratedReportRow[]) || [],
        scheduledReports: (scheduledResult.data as ScheduledReportRow[]) || [],
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load reports',
      }));
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Generate a new report
  const generateReport = useCallback(async (input: Omit<GeneratedReportInsert, 'owner_id'>) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase.from('generated_reports') as ReturnType<typeof supabase.from>)
      .insert({
        ...input,
        owner_id: user.id,
        status: 'generating',
      })
      .select()
      .single();
    if (error) throw error;

    const reportRow = data as GeneratedReportRow;

    // Trigger the Edge Function to generate the report file
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-report', {
        body: { report_id: reportRow.id },
      });

      if (fnError) {
        // Mark as failed if the Edge Function call fails
        await (supabase.from('generated_reports') as ReturnType<typeof supabase.from>)
          .update({
            status: 'failed',
            error_message: fnError.message || 'Report generation failed',
          })
          .eq('id', reportRow.id);
      }
    } catch (invokeErr: any) {
      // Mark as failed when the Edge Function invocation throws
      await (supabase.from('generated_reports') as ReturnType<typeof supabase.from>)
        .update({
          status: 'failed',
          error_message: invokeErr.message || 'Report generation failed',
        })
        .eq('id', reportRow.id);
    }

    await fetchReports();
    return reportRow;
  }, [fetchReports]);

  // Delete a generated report
  const deleteReport = useCallback(async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await (supabase.from('generated_reports') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchReports();
  }, [fetchReports]);

  // Retry a failed report generation
  const retryReport = useCallback(async (id: string) => {
    const supabase = getSupabaseClient();

    // Reset status to 'generating'
    const { error: updateErr } = await (supabase.from('generated_reports') as ReturnType<typeof supabase.from>)
      .update({ status: 'generating', error_message: null })
      .eq('id', id);
    if (updateErr) throw updateErr;

    // Re-trigger the Edge Function
    try {
      const { error: fnError } = await supabase.functions.invoke('generate-report', {
        body: { report_id: id },
      });
      if (fnError) {
        await (supabase.from('generated_reports') as ReturnType<typeof supabase.from>)
          .update({ status: 'failed', error_message: fnError.message || 'Retry failed' })
          .eq('id', id);
      }
    } catch (invokeErr: any) {
      await (supabase.from('generated_reports') as ReturnType<typeof supabase.from>)
        .update({ status: 'failed', error_message: invokeErr.message || 'Retry failed' })
        .eq('id', id);
    }

    await fetchReports();
  }, [fetchReports]);

  // Create a scheduled report
  const createScheduledReport = useCallback(async (input: Omit<ScheduledReportInsert, 'owner_id'>) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase.from('scheduled_reports') as ReturnType<typeof supabase.from>)
      .insert({ ...input, owner_id: user.id })
      .select()
      .single();
    if (error) throw error;
    await fetchReports();
    return data as ScheduledReportRow;
  }, [fetchReports]);

  // Update a scheduled report
  const updateScheduledReport = useCallback(async (id: string, updates: ScheduledReportUpdate) => {
    const supabase = getSupabaseClient();
    const { error } = await (supabase.from('scheduled_reports') as ReturnType<typeof supabase.from>)
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    await fetchReports();
  }, [fetchReports]);

  // Delete a scheduled report
  const deleteScheduledReport = useCallback(async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await (supabase.from('scheduled_reports') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchReports();
  }, [fetchReports]);

  // Toggle scheduled report active/inactive
  const toggleScheduledReport = useCallback(async (id: string, isActive: boolean) => {
    await updateScheduledReport(id, { is_active: isActive });
  }, [updateScheduledReport]);

  return {
    ...state,
    refreshReports: fetchReports,
    generateReport,
    deleteReport,
    retryReport,
    createScheduledReport,
    updateScheduledReport,
    deleteScheduledReport,
    toggleScheduledReport,
  };
}
