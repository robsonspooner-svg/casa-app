// useDocumentShares Hook — Document sharing management
// Share documents with tenants, create share links, track access

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type {
  DocumentShareRow,
  DocumentShareInsert,
  DocumentAccessLogRow,
} from '../types/database';

export interface DocumentSharesState {
  shares: DocumentShareRow[];
  accessLog: DocumentAccessLogRow[];
  loading: boolean;
  error: string | null;
}

export interface UseDocumentSharesReturn extends DocumentSharesState {
  refreshShares: () => Promise<void>;
  shareWithUser: (documentId: string, userId: string, options?: ShareOptions) => Promise<DocumentShareRow | null>;
  createShareLink: (documentId: string, options?: ShareOptions) => Promise<DocumentShareRow | null>;
  revokeShare: (shareId: string) => Promise<boolean>;
  logAccess: (documentId: string, action: 'view' | 'download' | 'print' | 'share', shareId?: string) => Promise<void>;
  getAccessLog: (documentId: string) => Promise<DocumentAccessLogRow[]>;
}

export interface ShareOptions {
  canDownload?: boolean;
  canPrint?: boolean;
  expiresInDays?: number;
}

function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function useDocumentShares(documentId?: string): UseDocumentSharesReturn {
  const [state, setState] = useState<DocumentSharesState>({
    shares: [],
    accessLog: [],
    loading: true,
    error: null,
  });

  const fetchShares = useCallback(async () => {
    if (!documentId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('document_shares') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setState({
        shares: (data as DocumentShareRow[]) || [],
        accessLog: [],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load shares';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [documentId]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const shareWithUser = useCallback(async (
    docId: string,
    userId: string,
    options?: ShareOptions,
  ): Promise<DocumentShareRow | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const expiresAt = options?.expiresInDays
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const shareData: DocumentShareInsert = {
        document_id: docId,
        share_type: 'user',
        shared_with_id: userId,
        shared_by: user.id,
        can_download: options?.canDownload ?? true,
        can_print: options?.canPrint ?? true,
        expires_at: expiresAt,
      };

      const { data, error } = await (supabase
        .from('document_shares') as ReturnType<typeof supabase.from>)
        .insert(shareData)
        .select()
        .single();

      if (error) throw error;
      const share = data as DocumentShareRow;

      setState(prev => ({
        ...prev,
        shares: [share, ...prev.shares],
      }));
      return share;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to share document';
      setState(prev => ({ ...prev, error: message }));
      return null;
    }
  }, []);

  const createShareLink = useCallback(async (
    docId: string,
    options?: ShareOptions,
  ): Promise<DocumentShareRow | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const expiresAt = options?.expiresInDays
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const shareData: DocumentShareInsert = {
        document_id: docId,
        share_type: 'link',
        share_token: generateShareToken(),
        shared_by: user.id,
        can_download: options?.canDownload ?? true,
        can_print: options?.canPrint ?? true,
        expires_at: expiresAt,
      };

      const { data, error } = await (supabase
        .from('document_shares') as ReturnType<typeof supabase.from>)
        .insert(shareData)
        .select()
        .single();

      if (error) throw error;
      const share = data as DocumentShareRow;

      setState(prev => ({
        ...prev,
        shares: [share, ...prev.shares],
      }));
      return share;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create share link';
      setState(prev => ({ ...prev, error: message }));
      return null;
    }
  }, []);

  const revokeShare = useCallback(async (shareId: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();

      const { error } = await (supabase
        .from('document_shares') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        shares: prev.shares.filter(s => s.id !== shareId),
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke share';
      setState(prev => ({ ...prev, error: message }));
      return false;
    }
  }, []);

  const logAccess = useCallback(async (
    docId: string,
    action: 'view' | 'download' | 'print' | 'share',
    shareId?: string,
  ): Promise<void> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      await (supabase
        .from('document_access_log') as ReturnType<typeof supabase.from>)
        .insert({
          document_id: docId,
          accessed_by: user?.id || null,
          share_id: shareId || null,
          action,
        });
    } catch {
      // Access logging is fire-and-forget; don't throw
    }
  }, []);

  const getAccessLog = useCallback(async (docId: string): Promise<DocumentAccessLogRow[]> => {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('document_access_log') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('document_id', docId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      const logs = (data as DocumentAccessLogRow[]) || [];

      setState(prev => ({ ...prev, accessLog: logs }));
      return logs;
    } catch {
      return [];
    }
  }, []);

  return {
    ...state,
    refreshShares: fetchShares,
    shareWithUser,
    createShareLink,
    revokeShare,
    logAccess,
    getAccessLog,
  };
}
