// useDocument Hook — Single document with signatures & signing
// Fetches a document by ID, handles signing and saved signatures

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getSupabaseClient } from '../client';
import type {
  DocumentRow,
  DocumentSignatureRow,
  SavedSignatureRow,
  DocumentWithSignatures,
  CasaDocumentStatus,
} from '../types/database';

export interface DocumentState {
  document: DocumentWithSignatures | null;
  savedSignature: SavedSignatureRow | null;
  loading: boolean;
  signing: boolean;
  error: string | null;
}

export interface UseDocumentReturn extends DocumentState {
  refreshDocument: () => Promise<void>;
  signDocument: (signatureImage: string, saveSignature: boolean) => Promise<boolean>;
  getSavedSignature: () => Promise<SavedSignatureRow | null>;
  deleteSavedSignature: () => Promise<boolean>;
}

export function useDocument(documentId: string | undefined): UseDocumentReturn {
  const [state, setState] = useState<DocumentState>({
    document: null,
    savedSignature: null,
    loading: true,
    signing: false,
    error: null,
  });

  const fetchDocument = useCallback(async (isRefresh = false) => {
    if (!documentId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: !isRefresh, error: null }));
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch document
      const { data: docData, error: docError } = await (supabase
        .from('documents') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;

      // Fetch signatures for this document
      const { data: sigData, error: sigError } = await (supabase
        .from('document_signatures') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('document_id', documentId)
        .order('signed_at', { ascending: true });

      if (sigError) throw sigError;

      // Fetch saved signature for current user
      const { data: savedSigData } = await (supabase
        .from('saved_signatures') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const doc: DocumentWithSignatures = {
        ...(docData as DocumentRow),
        signatures: (sigData as DocumentSignatureRow[]) || [],
      };

      setState({
        document: doc,
        savedSignature: (savedSigData as SavedSignatureRow) || null,
        loading: false,
        signing: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load document';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, [documentId]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Refresh data when screen gains focus (e.g. navigating back)
  useFocusEffect(
    useCallback(() => {
      if (documentId) {
        fetchDocument(true);
      }
    }, [fetchDocument, documentId])
  );

  const getSavedSignature = useCallback(async (): Promise<SavedSignatureRow | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await (supabase
        .from('saved_signatures') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const saved = (data as SavedSignatureRow) || null;
      setState(prev => ({ ...prev, savedSignature: saved }));
      return saved;
    } catch {
      return null;
    }
  }, []);

  const signDocument = useCallback(async (
    signatureImage: string,
    saveSignature: boolean,
  ): Promise<boolean> => {
    if (!documentId || !state.document) return false;

    setState(prev => ({ ...prev, signing: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Determine signer role from document
      const isOwner = state.document.owner_id === user.id;
      const isTenant = state.document.tenant_id === user.id;
      if (!isOwner && !isTenant) throw new Error('Not authorized to sign this document');

      const signerRole = isOwner ? 'owner' : 'tenant';

      // Get user profile for signer name
      const { data: profileData } = await (supabase
        .from('profiles') as ReturnType<typeof supabase.from>)
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      const signerName = (profileData as { full_name: string | null; email: string })?.full_name
        || (profileData as { full_name: string | null; email: string })?.email
        || 'Unknown';

      // Insert signature record
      const { error: sigError } = await (supabase
        .from('document_signatures') as ReturnType<typeof supabase.from>)
        .insert({
          document_id: documentId,
          signer_id: user.id,
          signer_role: signerRole,
          signer_name: signerName,
          signature_image: signatureImage,
        });

      if (sigError) throw sigError;

      // Update document status based on who signed and who still needs to sign
      const existingSignatures = state.document.signatures || [];
      const allSignerIds = new Set(existingSignatures.map(s => s.signer_id));
      allSignerIds.add(user.id); // Include current signer

      let newStatus: CasaDocumentStatus;
      const needsOwnerSig = state.document.owner_id && !allSignerIds.has(state.document.owner_id);
      const needsTenantSig = state.document.tenant_id && !allSignerIds.has(state.document.tenant_id);

      if (needsOwnerSig) {
        newStatus = 'pending_owner_signature';
      } else if (needsTenantSig) {
        newStatus = 'pending_tenant_signature';
      } else {
        newStatus = 'signed';
      }

      const { error: updateError } = await (supabase
        .from('documents') as ReturnType<typeof supabase.from>)
        .update({ status: newStatus })
        .eq('id', documentId);

      if (updateError) throw updateError;

      // Save signature for reuse if requested
      if (saveSignature) {
        const { error: saveSigError } = await (supabase
          .from('saved_signatures') as ReturnType<typeof supabase.from>)
          .upsert({
            user_id: user.id,
            signature_image: signatureImage,
          }, { onConflict: 'user_id' });

        if (saveSigError) {
          console.warn('Failed to save signature for reuse:', saveSigError.message);
        }
      }

      // Refresh document to show updated state
      await fetchDocument();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign document';
      setState(prev => ({ ...prev, signing: false, error: message }));
      return false;
    }
  }, [documentId, state.document, fetchDocument]);

  const deleteSavedSignature = useCallback(async (): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await (supabase
        .from('saved_signatures') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setState(prev => ({ ...prev, savedSignature: null }));
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    ...state,
    refreshDocument: fetchDocument,
    signDocument,
    getSavedSignature,
    deleteSavedSignature,
  };
}
