// Mission 16: Document Processing Edge Function
// Processes uploaded documents to extract metadata:
// - PDFs: extracts page count via heuristic, file size, mime type
// - Images: extracts dimensions from content-type headers
// - Updates document record with extracted metadata and processing status

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

interface ProcessRequest {
  documentId: string;
  userId: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = getServiceClient();

  try {
    const { documentId, userId }: ProcessRequest = await req.json();

    if (!documentId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: documentId and userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as processing
    await supabase
      .from('documents')
      .update({ metadata: { processing_status: 'processing' } })
      .eq('id', documentId)
      .eq('owner_id', userId);

    // Fetch document metadata from DB
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('id, storage_path, file_name, mime_type, file_size, metadata')
      .eq('id', documentId)
      .eq('owner_id', userId)
      .single();

    if (fetchError || !doc) {
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!doc.storage_path) {
      // Document has HTML content but no uploaded file -- mark as completed
      const existingMetadata = (doc.metadata as Record<string, unknown>) || {};
      await supabase
        .from('documents')
        .update({
          metadata: { ...existingMetadata, processing_status: 'completed', processed_at: new Date().toISOString() },
        })
        .eq('id', documentId);

      return new Response(
        JSON.stringify({ success: true, message: 'No file to process (HTML document)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      await markFailed(supabase, documentId, doc, `Failed to download file: ${downloadError?.message || 'Unknown error'}`);
      return new Response(
        JSON.stringify({ error: 'Failed to download file from storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileBytes = await fileData.arrayBuffer();
    const fileSize = fileBytes.byteLength;
    const detectedMimeType = doc.mime_type || fileData.type || 'application/octet-stream';

    const updates: Record<string, unknown> = {
      file_size: fileSize,
      mime_type: detectedMimeType,
    };

    const metadataUpdates: Record<string, unknown> = {
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    };

    // Process based on file type
    if (detectedMimeType === 'application/pdf') {
      const pageCount = estimatePdfPageCount(new Uint8Array(fileBytes));
      metadataUpdates.page_count = pageCount;
    } else if (detectedMimeType.startsWith('image/')) {
      const dimensions = extractImageDimensions(new Uint8Array(fileBytes), detectedMimeType);
      if (dimensions) {
        metadataUpdates.width = dimensions.width;
        metadataUpdates.height = dimensions.height;
      }
    }

    // Merge with existing metadata
    const existingMetadata = (doc.metadata as Record<string, unknown>) || {};
    updates.metadata = { ...existingMetadata, ...metadataUpdates };

    // Update document record
    const { error: updateError } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId);

    if (updateError) {
      await markFailed(supabase, documentId, doc, `Failed to update document: ${updateError.message}`);
      return new Response(
        JSON.stringify({ error: 'Failed to update document record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        file_size: fileSize,
        mime_type: detectedMimeType,
        metadata: metadataUpdates,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    console.error('Document processing error:', err);

    // Attempt to mark as failed if we have the documentId
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.documentId) {
        const { data: doc } = await supabase
          .from('documents')
          .select('metadata')
          .eq('id', body.documentId)
          .single();
        await markFailed(supabase, body.documentId, doc, message);
      }
    } catch {
      // Best effort -- don't let cleanup errors mask the original error
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Estimate PDF page count by counting occurrences of /Type /Page in the binary.
 * This is a lightweight heuristic that avoids pulling in a full PDF parsing library.
 * It searches for the pattern "/Type /Page" (not "/Type /Pages") which appears once
 * per page in the PDF cross-reference structure.
 */
function estimatePdfPageCount(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes);

  // Method 1: Look for /Type /Page (not /Pages) -- each page object has one
  const pagePattern = /\/Type\s*\/Page(?!s)/g;
  const matches = text.match(pagePattern);
  if (matches && matches.length > 0) {
    return matches.length;
  }

  // Method 2: Look for /Count N in the Pages dictionary
  const countPattern = /\/Count\s+(\d+)/;
  const countMatch = text.match(countPattern);
  if (countMatch) {
    return parseInt(countMatch[1], 10);
  }

  // Fallback: at least 1 page if it's a valid PDF
  if (text.startsWith('%PDF')) {
    return 1;
  }

  return 0;
}

/**
 * Extract image dimensions from common image format headers.
 * Supports PNG, JPEG, and GIF.
 */
function extractImageDimensions(
  bytes: Uint8Array,
  mimeType: string
): { width: number; height: number } | null {
  if (mimeType === 'image/png' && bytes.length >= 24) {
    // PNG: width at bytes 16-19, height at bytes 20-23 (big-endian)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (width > 0 && height > 0 && width < 100000 && height < 100000) {
      return { width, height };
    }
  }

  if (mimeType === 'image/jpeg' && bytes.length >= 2) {
    // JPEG: scan for SOF0/SOF2 markers (0xFF 0xC0 or 0xFF 0xC2)
    for (let i = 0; i < bytes.length - 9; i++) {
      if (bytes[i] === 0xFF && (bytes[i + 1] === 0xC0 || bytes[i + 1] === 0xC2)) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const height = view.getUint16(i + 5);
        const width = view.getUint16(i + 7);
        if (width > 0 && height > 0 && width < 100000 && height < 100000) {
          return { width, height };
        }
      }
    }
  }

  if (mimeType === 'image/gif' && bytes.length >= 10) {
    // GIF: width at bytes 6-7, height at bytes 8-9 (little-endian)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  return null;
}

/**
 * Mark a document's processing status as failed with an error message.
 */
async function markFailed(
  supabase: ReturnType<typeof getServiceClient>,
  documentId: string,
  doc: { metadata?: unknown } | null,
  errorMessage: string
): Promise<void> {
  const existingMetadata = ((doc?.metadata as Record<string, unknown>) || {});
  await supabase
    .from('documents')
    .update({
      metadata: {
        ...existingMetadata,
        processing_status: 'failed',
        processing_error: errorMessage,
        failed_at: new Date().toISOString(),
      },
    })
    .eq('id', documentId);
}
