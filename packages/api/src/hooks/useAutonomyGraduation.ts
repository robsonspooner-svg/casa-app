// Mission 15: Autonomy Graduation Hook
// Tracks approval history and graduation eligibility per tool category

import { useState, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '../client';
import type { AutonomyGraduationTracking } from '../types/database';

export interface GraduationProgress {
  category: string;
  current_level: number;
  consecutive_approvals: number;
  threshold: number;
  eligible: boolean;
  progress_pct: number;
}

export interface UseAutonomyGraduationReturn {
  tracking: AutonomyGraduationTracking[];
  progress: GraduationProgress[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  acceptGraduation: (category: string) => Promise<void>;
  declineGraduation: (category: string) => Promise<void>;
}

export function useAutonomyGraduation(): UseAutonomyGraduationReturn {
  const [tracking, setTracking] = useState<AutonomyGraduationTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchErr } = await supabase
        .from('autonomy_graduation_tracking')
        .select('*')
        .eq('user_id', user.id)
        .order('category', { ascending: true });

      if (fetchErr) throw fetchErr;
      setTracking((data as AutonomyGraduationTracking[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch graduation tracking');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  const progress: GraduationProgress[] = tracking.map(t => {
    const threshold = t.graduation_threshold * t.backoff_multiplier;
    return {
      category: t.category,
      current_level: t.current_level,
      consecutive_approvals: t.consecutive_approvals,
      threshold,
      eligible: t.consecutive_approvals >= threshold && t.current_level < 4,
      progress_pct: Math.min(100, Math.round((t.consecutive_approvals / threshold) * 100)),
    };
  });

  const callLearningFunction = useCallback(async (action: string, params: Record<string, unknown>) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/agent-learning`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...params }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({} as Record<string, string>));
      throw new Error((errData as Record<string, string>).error || 'Learning function failed');
    }

    return res.json();
  }, []);

  const acceptGraduation = useCallback(async (category: string) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await callLearningFunction('accept_graduation', {
      user_id: user.id,
      category,
    });

    await fetchTracking();
  }, [callLearningFunction, fetchTracking]);

  const declineGraduation = useCallback(async (category: string) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await callLearningFunction('decline_graduation', {
      user_id: user.id,
      category,
    });

    await fetchTracking();
  }, [callLearningFunction, fetchTracking]);

  return {
    tracking,
    progress,
    loading,
    error,
    refetch: fetchTracking,
    acceptGraduation,
    declineGraduation,
  };
}
