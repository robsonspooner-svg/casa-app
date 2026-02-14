// useDocumentFolders Hook — Document folder management
// CRUD operations for document folder system per property

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getSupabaseClient } from '../client';
import type { DocumentFolderRow, DocumentFolderInsert, DocumentFolderUpdate } from '../types/database';

export interface DocumentFoldersState {
  folders: DocumentFolderRow[];
  loading: boolean;
  error: string | null;
}

export interface UseDocumentFoldersReturn extends DocumentFoldersState {
  refreshFolders: () => Promise<void>;
  createFolder: (data: Omit<DocumentFolderInsert, 'owner_id'>) => Promise<DocumentFolderRow | null>;
  updateFolder: (folderId: string, data: DocumentFolderUpdate) => Promise<boolean>;
  deleteFolder: (folderId: string) => Promise<boolean>;
  getFolderTree: () => FolderTreeNode[];
}

export interface FolderTreeNode extends DocumentFolderRow {
  children: FolderTreeNode[];
  documentCount?: number;
}

export function useDocumentFolders(propertyId?: string): UseDocumentFoldersReturn {
  const [state, setState] = useState<DocumentFoldersState>({
    folders: [],
    loading: true,
    error: null,
  });

  const fetchFolders = useCallback(async (isRefresh = false) => {
    try {
      setState(prev => ({ ...prev, loading: !isRefresh, error: null }));
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = (supabase.from('document_folders') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('owner_id', user.id)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setState({
        folders: (data as DocumentFolderRow[]) || [],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load folders';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [propertyId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Refresh data when screen gains focus (e.g. navigating back)
  useFocusEffect(
    useCallback(() => {
      fetchFolders(true);
    }, [fetchFolders])
  );

  const createFolder = useCallback(async (
    data: Omit<DocumentFolderInsert, 'owner_id'>,
  ): Promise<DocumentFolderRow | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: newFolder, error } = await (supabase
        .from('document_folders') as ReturnType<typeof supabase.from>)
        .insert({ ...data, owner_id: user.id })
        .select()
        .single();

      if (error) throw error;
      const folder = newFolder as DocumentFolderRow;

      setState(prev => ({
        ...prev,
        folders: [...prev.folders, folder],
      }));
      return folder;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create folder';
      setState(prev => ({ ...prev, error: message }));
      return null;
    }
  }, []);

  const updateFolder = useCallback(async (
    folderId: string,
    data: DocumentFolderUpdate,
  ): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase
        .from('document_folders') as ReturnType<typeof supabase.from>)
        .update(data)
        .eq('id', folderId)
        .eq('owner_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        folders: prev.folders.map(f =>
          f.id === folderId ? { ...f, ...data } : f,
        ),
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update folder';
      setState(prev => ({ ...prev, error: message }));
      return false;
    }
  }, []);

  const deleteFolder = useCallback(async (folderId: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if it's a system folder
      const folder = state.folders.find(f => f.id === folderId);
      if (folder?.is_system) {
        setState(prev => ({ ...prev, error: 'Cannot delete system folders' }));
        return false;
      }

      const { error } = await (supabase
        .from('document_folders') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('id', folderId)
        .eq('owner_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        folders: prev.folders.filter(f => f.id !== folderId),
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete folder';
      setState(prev => ({ ...prev, error: message }));
      return false;
    }
  }, [state.folders]);

  const getFolderTree = useCallback((): FolderTreeNode[] => {
    const folderMap = new Map<string, FolderTreeNode>();
    const roots: FolderTreeNode[] = [];

    // Create nodes
    for (const folder of state.folders) {
      folderMap.set(folder.id, { ...folder, children: [] });
    }

    // Build tree
    for (const folder of state.folders) {
      const node = folderMap.get(folder.id);
      if (!node) continue;

      if (folder.parent_id && folderMap.has(folder.parent_id)) {
        folderMap.get(folder.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }, [state.folders]);

  return {
    ...state,
    refreshFolders: fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    getFolderTree,
  };
}
