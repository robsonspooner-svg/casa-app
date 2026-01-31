// Application mutation operations - Mission 05
import { useState } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import { ApplicationInsert, ApplicationUpdate, Application, ApplicationReference, ApplicationDocument } from '../types/database';

interface UploadDocumentParams {
  applicationId: string;
  documentType: ApplicationDocument['document_type'];
  fileName: string;
  fileUri: string;
  mimeType: string;
  fileSize: number;
}

export function useApplicationMutations() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const createApplication = async (data: Omit<ApplicationInsert, 'tenant_id'>): Promise<Application> => {
    if (!user) throw new Error('Not authenticated');

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: app, error } = await (supabase
        .from('applications') as ReturnType<typeof supabase.from>)
        .insert({ ...data, tenant_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return app as any;
    } finally {
      setSaving(false);
    }
  };

  const updateApplication = async (id: string, data: ApplicationUpdate): Promise<Application> => {
    if (!user) throw new Error('Not authenticated');

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: app, error } = await (supabase
        .from('applications') as ReturnType<typeof supabase.from>)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return app as any;
    } finally {
      setSaving(false);
    }
  };

  const submitApplication = async (id: string): Promise<Application> => {
    return updateApplication(id, {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    });
  };

  const withdrawApplication = async (id: string): Promise<Application> => {
    return updateApplication(id, { status: 'withdrawn' });
  };

  // Owner actions
  const reviewApplication = async (id: string): Promise<Application> => {
    if (!user) throw new Error('Not authenticated');
    return updateApplication(id, {
      status: 'under_review',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    });
  };

  const shortlistApplication = async (id: string): Promise<Application> => {
    if (!user) throw new Error('Not authenticated');
    return updateApplication(id, {
      status: 'shortlisted',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    });
  };

  const approveApplication = async (id: string): Promise<Application> => {
    if (!user) throw new Error('Not authenticated');
    return updateApplication(id, {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    });
  };

  const rejectApplication = async (id: string, reason: string): Promise<Application> => {
    if (!user) throw new Error('Not authenticated');
    return updateApplication(id, {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      rejection_reason: reason,
    });
  };

  // References
  const addReference = async (
    applicationId: string,
    data: Omit<ApplicationReference, 'id' | 'application_id' | 'created_at' | 'contacted_at' | 'notes'>
  ): Promise<ApplicationReference> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();
    const { data: ref, error } = await (supabase
      .from('application_references') as ReturnType<typeof supabase.from>)
      .insert({ ...data, application_id: applicationId })
      .select()
      .single();

    if (error) throw error;
    return ref as any;
  };

  const removeReference = async (referenceId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();
    const { error } = await (supabase
      .from('application_references') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('id', referenceId);

    if (error) throw error;
  };

  // Documents
  const uploadDocument = async (params: UploadDocumentParams): Promise<ApplicationDocument> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();
    const storagePath = `${user.id}/${params.applicationId}/${Date.now()}_${params.fileName}`;

    // Upload file to storage
    const response = await fetch(params.fileUri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('application-documents')
      .upload(storagePath, blob, { contentType: params.mimeType });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('application-documents')
      .getPublicUrl(storagePath);

    // Create document record
    const { data: doc, error: docError } = await (supabase
      .from('application_documents') as ReturnType<typeof supabase.from>)
      .insert({
        application_id: params.applicationId,
        document_type: params.documentType,
        file_name: params.fileName,
        storage_path: storagePath,
        url: urlData.publicUrl,
        mime_type: params.mimeType,
        file_size: params.fileSize,
      })
      .select()
      .single();

    if (docError) throw docError;
    return doc as any;
  };

  const removeDocument = async (documentId: string, storagePath: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const supabase = getSupabaseClient();

    // Delete from storage
    await supabase.storage.from('application-documents').remove([storagePath]);

    // Delete record
    const { error } = await (supabase
      .from('application_documents') as ReturnType<typeof supabase.from>)
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  };

  return {
    saving,
    createApplication,
    updateApplication,
    submitApplication,
    withdrawApplication,
    reviewApplication,
    shortlistApplication,
    approveApplication,
    rejectApplication,
    addReference,
    removeReference,
    uploadDocument,
    removeDocument,
  };
}
