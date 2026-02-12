// useDocumentUpload Hook — File upload to Supabase Storage
// Handles uploading files (PDFs, images, documents) to the documents bucket

import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import type { CasaDocumentType, DocumentRow } from '../types/database';

export interface UploadProgress {
  uploading: boolean;
  progress: number;
  fileName: string | null;
  error: string | null;
}

export interface UseDocumentUploadReturn {
  upload: UploadProgress;
  uploadDocument: (params: UploadDocumentParams) => Promise<DocumentRow | null>;
  uploadMultipleDocuments: (paramsList: UploadDocumentParams[]) => Promise<DocumentRow[]>;
}

export interface UploadDocumentParams {
  fileUri: string;
  fileName: string;
  mimeType: string;
  propertyId?: string;
  tenancyId?: string;
  folderId?: string;
  documentType?: CasaDocumentType;
  title?: string;
  description?: string;
  tags?: string[];
  documentDate?: string;
  expiryDate?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Infer document type from mime type and file name
 */
function inferDocumentType(mimeType: string, fileName: string): CasaDocumentType {
  const lower = fileName.toLowerCase();

  if (lower.includes('lease') || lower.includes('tenancy agreement')) return 'lease';
  if (lower.includes('condition') || lower.includes('inspection')) return 'condition_report';
  if (lower.includes('compliance') || lower.includes('safety') || lower.includes('certificate')) return 'compliance_certificate';
  if (lower.includes('notice') || lower.includes('breach') || lower.includes('vacate')) return 'notice';
  if (lower.includes('invoice') || lower.includes('receipt') || lower.includes('financial')) return 'financial_report';
  if (lower.includes('tax') || lower.includes('depreciation')) return 'tax_report';
  if (lower.includes('insurance') || lower.includes('policy')) return 'compliance_certificate';

  if (mimeType.startsWith('image/')) return 'evidence_report';

  return 'other';
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function useDocumentUpload(): UseDocumentUploadReturn {
  const [upload, setUpload] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
    fileName: null,
    error: null,
  });

  const uploadDocument = useCallback(async (
    params: UploadDocumentParams,
  ): Promise<DocumentRow | null> => {
    setUpload({ uploading: true, progress: 0, fileName: params.fileName, error: null });

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch the file as blob
      const response = await fetch(params.fileUri);
      const blob = await response.blob();

      if (blob.size > MAX_FILE_SIZE) {
        throw new Error(`File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.`);
      }

      setUpload(prev => ({ ...prev, progress: 20 }));

      // Generate unique storage path: userId/timestamp_random.ext
      const ext = getFileExtension(params.fileName);
      const storagePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext ? '.' + ext : ''}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, blob, {
          contentType: params.mimeType,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;
      setUpload(prev => ({ ...prev, progress: 60 }));

      // Get signed URL (private bucket — use signed URLs)
      const { data: signedUrlData } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

      const fileUrl = signedUrlData?.signedUrl || null;

      // Determine document type
      const documentType = params.documentType || inferDocumentType(params.mimeType, params.fileName);

      // Create document record
      const { data: docData, error: docError } = await (supabase
        .from('documents') as ReturnType<typeof supabase.from>)
        .insert({
          owner_id: user.id,
          property_id: params.propertyId || null,
          tenancy_id: params.tenancyId || null,
          folder_id: params.folderId || null,
          document_type: documentType,
          title: params.title || params.fileName,
          html_content: '',
          file_name: storagePath,
          original_name: params.fileName,
          storage_path: storagePath,
          file_url: fileUrl,
          mime_type: params.mimeType,
          file_size: blob.size,
          file_extension: ext || null,
          description: params.description || null,
          tags: params.tags || null,
          document_date: params.documentDate || null,
          expiry_date: params.expiryDate || null,
          created_by: 'owner',
          uploaded_by: user.id,
          is_archived: false,
        })
        .select()
        .single();

      if (docError) throw docError;
      setUpload({ uploading: false, progress: 100, fileName: params.fileName, error: null });

      return docData as DocumentRow;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setUpload({ uploading: false, progress: 0, fileName: params.fileName, error: message });
      return null;
    }
  }, []);

  const uploadMultipleDocuments = useCallback(async (
    paramsList: UploadDocumentParams[],
  ): Promise<DocumentRow[]> => {
    const results: DocumentRow[] = [];
    for (const params of paramsList) {
      const doc = await uploadDocument(params);
      if (doc) results.push(doc);
    }
    return results;
  }, [uploadDocument]);

  return {
    upload,
    uploadDocument,
    uploadMultipleDocuments,
  };
}
