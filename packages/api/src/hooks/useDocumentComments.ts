// useDocumentComments Hook — Fetch and manage document comments / revision requests
// Supports creating revision requests and marking them as resolved

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getSupabaseClient } from '../client';
import type { DocumentCommentRow, DocumentCommentType } from '../types/database';

export interface DocumentCommentsState {
  comments: DocumentCommentRow[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
}

export interface UseDocumentCommentsReturn extends DocumentCommentsState {
  refreshComments: () => Promise<void>;
  addComment: (content: string, commentType: DocumentCommentType) => Promise<boolean>;
  resolveComment: (commentId: string) => Promise<boolean>;
}

export function useDocumentComments(
  documentId: string | undefined,
  commentType?: DocumentCommentType,
): UseDocumentCommentsReturn {
  const [state, setState] = useState<DocumentCommentsState>({
    comments: [],
    loading: true,
    submitting: false,
    error: null,
  });

  const fetchComments = useCallback(async (isRefresh = false) => {
    if (!documentId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: !isRefresh, error: null }));
      const supabase = getSupabaseClient();

      let query = (supabase
        .from('document_comments') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (commentType) {
        query = query.eq('comment_type', commentType);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setState({
        comments: (data as DocumentCommentRow[]) || [],
        loading: false,
        submitting: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load comments';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [documentId, commentType]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useFocusEffect(
    useCallback(() => {
      if (documentId) {
        fetchComments(true);
      }
    }, [fetchComments, documentId])
  );

  const addComment = useCallback(async (
    content: string,
    type: DocumentCommentType,
  ): Promise<boolean> => {
    if (!documentId) return false;

    setState(prev => ({ ...prev, submitting: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await (supabase
        .from('document_comments') as ReturnType<typeof supabase.from>)
        .insert({
          document_id: documentId,
          author_id: user.id,
          content,
          comment_type: type,
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      await fetchComments(true);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add comment';
      setState(prev => ({ ...prev, submitting: false, error: message }));
      return false;
    }
  }, [documentId, fetchComments]);

  const resolveComment = useCallback(async (commentId: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: updateError } = await (supabase
        .from('document_comments') as ReturnType<typeof supabase.from>)
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', commentId);

      if (updateError) throw updateError;

      await fetchComments(true);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve comment';
      setState(prev => ({ ...prev, error: message }));
      return false;
    }
  }, [fetchComments]);

  return {
    ...state,
    refreshComments: fetchComments,
    addComment,
    resolveComment,
  };
}
