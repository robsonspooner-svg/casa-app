// useDocuments Hook — Document Hub list
// Lists all documents for the current user (owner or tenant)

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type { DocumentRow, CasaDocumentType, CasaDocumentStatus } from '../types/database';

export interface DocumentsFilter {
  document_type?: CasaDocumentType;
  document_types?: CasaDocumentType[];
  status?: CasaDocumentStatus;
  property_id?: string;
}

export interface DocumentsState {
  documents: DocumentRow[];
  loading: boolean;
  error: string | null;
}

export interface UseDocumentsReturn extends DocumentsState {
  refreshDocuments: () => Promise<void>;
  setFilter: (filter: DocumentsFilter) => void;
  filter: DocumentsFilter;
}

export function useDocuments(initialFilter?: DocumentsFilter): UseDocumentsReturn {
  const [state, setState] = useState<DocumentsState>({
    documents: [],
    loading: true,
    error: null,
  });
  const [filter, setFilter] = useState<DocumentsFilter>(initialFilter || {});

  const fetchDocuments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = (supabase.from('documents') as ReturnType<typeof supabase.from>)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter.document_types && filter.document_types.length > 0) {
        query = query.in('document_type', filter.document_types);
      } else if (filter.document_type) {
        query = query.eq('document_type', filter.document_type);
      }
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      if (filter.property_id) {
        query = query.eq('property_id', filter.property_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setState({
        documents: (data as DocumentRow[]) || [],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [filter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    ...state,
    refreshDocuments: fetchDocuments,
    setFilter,
    filter,
  };
}
