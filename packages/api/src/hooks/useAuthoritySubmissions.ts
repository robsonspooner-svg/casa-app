// useAuthoritySubmissions Hook — Authority Submission Tracking
// Tracks submissions to state authorities (bond lodgement, tribunal applications, etc.)

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  AuthoritySubmissionRow,
  AuthoritySubmissionInsert,
  AuthoritySubmissionUpdate,
} from '../types/database';

export interface AuthoritySubmissionsState {
  submissions: AuthoritySubmissionRow[];
  loading: boolean;
  error: string | null;
}

export interface UseAuthoritySubmissionsReturn extends AuthoritySubmissionsState {
  createSubmission: (input: AuthoritySubmissionInsert) => Promise<string | null>;
  updateSubmission: (id: string, updates: AuthoritySubmissionUpdate) => Promise<boolean>;
  getSubmissionsForProperty: (propertyId: string) => AuthoritySubmissionRow[];
  getPendingSubmissions: () => AuthoritySubmissionRow[];
  refresh: () => Promise<void>;
}

export function useAuthoritySubmissions(propertyId?: string): UseAuthoritySubmissionsReturn {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<AuthoritySubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      let query = (supabase
        .from('authority_submissions') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setSubmissions((data as AuthoritySubmissionRow[]) || []);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to fetch submissions';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, propertyId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const createSubmission = useCallback(async (input: AuthoritySubmissionInsert): Promise<string | null> => {
    if (!user) return null;

    try {
      const supabase = getSupabaseClient();
      const { data, error: insertError } = await (supabase
        .from('authority_submissions') as ReturnType<typeof supabase.from>)
        .insert({ ...input, owner_id: user.id })
        .select('id')
        .single();

      if (insertError) throw insertError;
      await fetchSubmissions();
      return (data as any)?.id || null;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to create submission';
      setError(message);
      return null;
    }
  }, [user, fetchSubmissions]);

  const updateSubmission = useCallback(async (id: string, updates: AuthoritySubmissionUpdate): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await (supabase
        .from('authority_submissions') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', id)
        .eq('owner_id', user.id);

      if (updateError) throw updateError;
      await fetchSubmissions();
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update submission';
      setError(message);
      return false;
    }
  }, [user, fetchSubmissions]);

  const getSubmissionsForProperty = useCallback((propId: string) => {
    return submissions.filter(s => s.property_id === propId);
  }, [submissions]);

  const getPendingSubmissions = useCallback(() => {
    return submissions.filter(s => s.status === 'pending' || s.status === 'submitted');
  }, [submissions]);

  return {
    submissions,
    loading,
    error,
    createSubmission,
    updateSubmission,
    getSubmissionsForProperty,
    getPendingSubmissions,
    refresh: fetchSubmissions,
  };
}
