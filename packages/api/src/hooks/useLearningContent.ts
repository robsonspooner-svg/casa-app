// useLearningContent Hook — Learning Hub content browsing, bookmarks, progress
// Mission 15: Learning Engine & Compliance

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface LearningArticle {
  id: string;
  title: string;
  slug: string;
  content_markdown: string;
  category: string;
  state: string | null;
  tags: string[];
  reading_time_minutes: number;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserLearningProgress {
  id: string;
  user_id: string;
  content_id: string;
  completed: boolean;
  bookmarked: boolean;
  checklist_progress: Record<string, boolean>;
  last_read_at: string | null;
  completed_at: string | null;
}

export interface LearningContentState {
  articles: LearningArticle[];
  bookmarks: LearningArticle[];
  progress: Record<string, UserLearningProgress>;
  loading: boolean;
  error: string | null;
}

export interface UseLearningContentReturn extends LearningContentState {
  fetchArticles: (filters?: { category?: string; state?: string; search?: string }) => Promise<void>;
  fetchBookmarks: () => Promise<void>;
  getArticle: (slug: string) => Promise<LearningArticle | null>;
  toggleBookmark: (contentId: string) => Promise<void>;
  markRead: (contentId: string) => Promise<void>;
  markCompleted: (contentId: string) => Promise<void>;
  updateChecklistProgress: (contentId: string, checklistKey: string, checked: boolean) => Promise<void>;
}

export function useLearningContent(): UseLearningContentReturn {
  const { user } = useAuth();
  const [state, setState] = useState<LearningContentState>({
    articles: [],
    bookmarks: [],
    progress: {},
    loading: true,
    error: null,
  });

  const fetchProgress = useCallback(async () => {
    if (!user) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase
        .from('user_learning_progress') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const progressMap: Record<string, UserLearningProgress> = {};
      for (const p of (data || [])) {
        progressMap[p.content_id] = p as UserLearningProgress;
      }

      setState(prev => ({ ...prev, progress: progressMap }));
    } catch {
      // Non-critical — progress load failure is silent
    }
  }, [user]);

  const fetchArticles = useCallback(async (filters?: { category?: string; state?: string; search?: string }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      let query = (supabase
        .from('learning_content') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.state) {
        query = query.eq('state', filters.state);
      }
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,tags.cs.{${filters.search}}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setState(prev => ({
        ...prev,
        articles: (data || []) as LearningArticle[],
        loading: false,
        error: null,
      }));
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Failed to fetch articles';
      setState(prev => ({ ...prev, loading: false, error: msg }));
    }
  }, []);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = getSupabaseClient();

      // Get bookmarked content IDs
      const { data: progressData, error: progressError } = await (supabase
        .from('user_learning_progress') as ReturnType<typeof supabase.from>)
        .select('content_id')
        .eq('user_id', user.id)
        .eq('bookmarked', true);

      if (progressError) throw progressError;

      const contentIds = (progressData || []).map((p: { content_id: string }) => p.content_id);
      if (contentIds.length === 0) {
        setState(prev => ({ ...prev, bookmarks: [] }));
        return;
      }

      const { data: articlesData, error: articlesError } = await (supabase
        .from('learning_content') as ReturnType<typeof supabase.from>)
        .select('*')
        .in('id', contentIds);

      if (articlesError) throw articlesError;

      setState(prev => ({
        ...prev,
        bookmarks: (articlesData || []) as LearningArticle[],
      }));
    } catch {
      // Non-critical
    }
  }, [user]);

  const getArticle = useCallback(async (slug: string): Promise<LearningArticle | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase
        .from('learning_content') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;
      return data as LearningArticle;
    } catch {
      return null;
    }
  }, []);

  const ensureProgressRow = useCallback(async (contentId: string) => {
    if (!user) return;
    const supabase = getSupabaseClient();

    const { data } = await (supabase
      .from('user_learning_progress') as ReturnType<typeof supabase.from>)
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .maybeSingle();

    if (!data) {
      await (supabase
        .from('user_learning_progress') as ReturnType<typeof supabase.from>)
        .insert({ user_id: user.id, content_id: contentId });
    }
  }, [user]);

  const toggleBookmark = useCallback(async (contentId: string) => {
    if (!user) return;

    const currentlyBookmarked = state.progress[contentId]?.bookmarked ?? false;
    const newValue = !currentlyBookmarked;

    // Optimistic update
    setState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [contentId]: {
          ...(prev.progress[contentId] || { id: '', user_id: user.id, content_id: contentId, completed: false, checklist_progress: {}, last_read_at: null, completed_at: null }),
          bookmarked: newValue,
        },
      },
    }));

    try {
      await ensureProgressRow(contentId);
      const supabase = getSupabaseClient();
      const { error } = await (supabase
        .from('user_learning_progress') as ReturnType<typeof supabase.from>)
        .update({ bookmarked: newValue })
        .eq('user_id', user.id)
        .eq('content_id', contentId);

      if (error) throw error;
    } catch {
      // Revert
      setState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          [contentId]: {
            ...(prev.progress[contentId] || {} as UserLearningProgress),
            bookmarked: currentlyBookmarked,
          },
        },
      }));
    }
  }, [user, state.progress, ensureProgressRow]);

  const markRead = useCallback(async (contentId: string) => {
    if (!user) return;
    try {
      await ensureProgressRow(contentId);
      const supabase = getSupabaseClient();
      await (supabase
        .from('user_learning_progress') as ReturnType<typeof supabase.from>)
        .update({ last_read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('content_id', contentId);
    } catch {
      // Non-critical
    }
  }, [user, ensureProgressRow]);

  const markCompleted = useCallback(async (contentId: string) => {
    if (!user) return;
    try {
      await ensureProgressRow(contentId);
      const supabase = getSupabaseClient();
      await (supabase
        .from('user_learning_progress') as ReturnType<typeof supabase.from>)
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('content_id', contentId);

      setState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          [contentId]: {
            ...(prev.progress[contentId] || {} as UserLearningProgress),
            completed: true,
            completed_at: new Date().toISOString(),
          },
        },
      }));
    } catch {
      // Non-critical
    }
  }, [user, ensureProgressRow]);

  const updateChecklistProgress = useCallback(async (contentId: string, checklistKey: string, checked: boolean) => {
    if (!user) return;
    const current = state.progress[contentId]?.checklist_progress || {};
    const updated = { ...current, [checklistKey]: checked };

    setState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [contentId]: {
          ...(prev.progress[contentId] || {} as UserLearningProgress),
          checklist_progress: updated,
        },
      },
    }));

    try {
      await ensureProgressRow(contentId);
      const supabase = getSupabaseClient();
      await (supabase
        .from('user_learning_progress') as ReturnType<typeof supabase.from>)
        .update({ checklist_progress: updated })
        .eq('user_id', user.id)
        .eq('content_id', contentId);
    } catch {
      // Non-critical
    }
  }, [user, state.progress, ensureProgressRow]);

  // Initial load
  useEffect(() => {
    fetchArticles();
    fetchProgress();
  }, [fetchArticles, fetchProgress]);

  return {
    ...state,
    fetchArticles,
    fetchBookmarks,
    getArticle,
    toggleBookmark,
    markRead,
    markCompleted,
    updateChecklistProgress,
  };
}
