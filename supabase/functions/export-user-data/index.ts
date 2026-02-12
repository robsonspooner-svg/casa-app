// Export User Data - Supabase Edge Function
// Casa - Mission 18: Security Audit
//
// Processes data export requests by aggregating all user data from the platform,
// generating a JSON export package, uploading it to Supabase Storage,
// and notifying the user when the export is ready.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

interface ExportRequest {
  request_id: string;
}

interface ExportPackage {
  export_metadata: {
    export_id: string;
    user_id: string;
    requested_at: string;
    generated_at: string;
    platform: string;
    data_categories: string[];
  };
  profile: Record<string, unknown> | null;
  properties: Record<string, unknown>[];
  tenancies: Record<string, unknown>[];
  tenancy_tenants: Record<string, unknown>[];
  maintenance_requests: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  inspections: Record<string, unknown>[];
  agent_conversations: Record<string, unknown>[];
  agent_decisions: Record<string, unknown>[];
  notification_preferences: Record<string, unknown>[];
  notification_settings: Record<string, unknown>[];
}

// Safely query a table, returning an empty array if the table does not exist
async function safeQuery(
  supabase: ReturnType<typeof getServiceClient>,
  table: string,
  column: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await (supabase.from(table) as any)
      .select('*')
      .eq(column, userId);

    if (error) {
      console.warn(`Warning: failed to query ${table}: ${error.message}`);
      return [];
    }
    return (data as Record<string, unknown>[]) || [];
  } catch (err) {
    console.warn(`Warning: table ${table} may not exist: ${err}`);
    return [];
  }
}

async function aggregateUserData(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  requestId: string,
  requestedAt: string,
): Promise<ExportPackage> {
  // Fetch profile
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('*')
    .eq('id', userId)
    .single();

  // Fetch all user data in parallel where possible
  const [
    properties,
    tenancies,
    tenancyTenants,
    maintenanceRequests,
    tasks,
    documents,
    payments,
    inspections,
    agentConversations,
    agentDecisions,
    notificationPreferences,
    notificationSettings,
  ] = await Promise.all([
    safeQuery(supabase, 'properties', 'owner_id', userId),
    safeQuery(supabase, 'tenancies', 'owner_id', userId),
    safeQuery(supabase, 'tenancy_tenants', 'tenant_id', userId),
    safeQuery(supabase, 'maintenance_requests', 'reported_by', userId),
    safeQuery(supabase, 'agent_tasks', 'user_id', userId),
    safeQuery(supabase, 'documents', 'owner_id', userId),
    safeQuery(supabase, 'payments', 'tenant_id', userId),
    safeQuery(supabase, 'inspections', 'created_by', userId),
    safeQuery(supabase, 'agent_conversations', 'user_id', userId),
    safeQuery(supabase, 'agent_decisions', 'user_id', userId),
    safeQuery(supabase, 'notification_preferences', 'user_id', userId),
    safeQuery(supabase, 'notification_settings', 'user_id', userId),
  ]);

  const dataCategories: string[] = [];
  if (profile) dataCategories.push('profile');
  if (properties.length > 0) dataCategories.push('properties');
  if (tenancies.length > 0) dataCategories.push('tenancies');
  if (tenancyTenants.length > 0) dataCategories.push('tenancy_tenants');
  if (maintenanceRequests.length > 0) dataCategories.push('maintenance_requests');
  if (tasks.length > 0) dataCategories.push('tasks');
  if (documents.length > 0) dataCategories.push('documents');
  if (payments.length > 0) dataCategories.push('payments');
  if (inspections.length > 0) dataCategories.push('inspections');
  if (agentConversations.length > 0) dataCategories.push('agent_conversations');
  if (agentDecisions.length > 0) dataCategories.push('agent_decisions');
  if (notificationPreferences.length > 0) dataCategories.push('notification_preferences');
  if (notificationSettings.length > 0) dataCategories.push('notification_settings');

  return {
    export_metadata: {
      export_id: requestId,
      user_id: userId,
      requested_at: requestedAt,
      generated_at: new Date().toISOString(),
      platform: 'Casa - AI Property Management',
      data_categories: dataCategories,
    },
    profile: profile || null,
    properties,
    tenancies,
    tenancy_tenants: tenancyTenants,
    maintenance_requests: maintenanceRequests,
    tasks,
    documents,
    payments,
    inspections,
    agent_conversations: agentConversations,
    agent_decisions: agentDecisions,
    notification_preferences: notificationPreferences,
    notification_settings: notificationSettings,
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { request_id } = (await req.json()) as ExportRequest;
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // Fetch the export request record
    const { data: request, error: requestError } = await (supabase.from('data_deletion_requests') as any)
      .select('*')
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      return new Response(JSON.stringify({ error: 'Export request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = request.user_id;

    // Mark request as processing
    await (supabase.from('data_deletion_requests') as any)
      .update({ status: 'processing' })
      .eq('id', request_id);

    // Aggregate all user data
    const exportPackage = await aggregateUserData(
      supabase,
      userId,
      request_id,
      request.created_at,
    );

    // Generate JSON export
    const exportJson = JSON.stringify(exportPackage, null, 2);
    const exportBytes = new TextEncoder().encode(exportJson);

    // Upload to Supabase Storage (bucket: exports)
    const storagePath = `${userId}/${request_id}.json`;

    // Ensure the exports bucket exists
    const { error: bucketError } = await supabase.storage.createBucket('exports', {
      public: false,
      fileSizeLimit: 104857600, // 100MB
    });
    if (bucketError && !bucketError.message.includes('already exists')) {
      console.warn('Bucket creation warning:', bucketError.message);
    }

    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(storagePath, exportBytes, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      await (supabase.from('data_deletion_requests') as any)
        .update({
          status: 'failed',
          notes: `Upload failed: ${uploadError.message}`,
          processed_at: new Date().toISOString(),
        })
        .eq('id', request_id);

      return new Response(JSON.stringify({ error: 'Failed to upload export' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate a signed URL valid for 7 days
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('exports')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
    }

    const exportUrl = signedUrlData?.signedUrl || null;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Update request as completed
    await (supabase.from('data_deletion_requests') as any)
      .update({
        status: 'completed',
        export_url: exportUrl,
        export_expires_at: expiresAt,
        processed_at: new Date().toISOString(),
        notes: `Export contains ${exportPackage.export_metadata.data_categories.length} data categories. File size: ${exportBytes.length} bytes.`,
      })
      .eq('id', request_id);

    // Send notification to the user that export is ready
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    try {
      await fetch(`${supabaseUrl}/functions/v1/dispatch-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          user_id: userId,
          type: 'data_export_ready',
          title: 'Your Data Export is Ready',
          body: 'Your data export has been generated and is ready for download. The download link will expire in 7 days.',
          data: {
            request_id,
            export_url: exportUrl,
            expires_at: expiresAt,
          },
          channels: ['push', 'email'],
        }),
      });
    } catch (notifErr) {
      // Notification failure should not fail the export
      console.warn('Failed to send export ready notification:', notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id,
        export_url: exportUrl,
        expires_at: expiresAt,
        file_size_bytes: exportBytes.length,
        data_categories: exportPackage.export_metadata.data_categories,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Export user data error:', error);

    // Attempt to mark the request as failed if we have the request_id
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.request_id) {
        const supabase = getServiceClient();
        await (supabase.from('data_deletion_requests') as any)
          .update({
            status: 'failed',
            notes: `Export error: ${error.message}`,
            processed_at: new Date().toISOString(),
          })
          .eq('id', body.request_id);
      }
    } catch {
      // Best-effort status update
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
