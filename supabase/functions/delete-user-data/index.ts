// Delete User Data - Supabase Edge Function
// Casa - Mission 18: Security Audit
//
// Processes account deletion requests. First creates a backup export of all
// user data, then deletes user data from all tables in reverse dependency
// order, and finally removes the Supabase Auth user via the admin API.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

interface DeleteRequest {
  request_id: string;
}

// Safely delete from a table, logging warnings if the table does not exist
async function safeDelete(
  supabase: ReturnType<typeof getServiceClient>,
  table: string,
  column: string,
  userId: string,
): Promise<number> {
  try {
    const { data, error } = await (supabase.from(table) as any)
      .delete()
      .eq(column, userId)
      .select('id');

    if (error) {
      console.warn(`Warning: failed to delete from ${table}: ${error.message}`);
      return 0;
    }
    const count = data?.length || 0;
    if (count > 0) {
      console.log(`Deleted ${count} rows from ${table}`);
    }
    return count;
  } catch (err) {
    console.warn(`Warning: table ${table} may not exist: ${err}`);
    return 0;
  }
}

// Delete from a table matching a list of IDs
async function safeDeleteByIds(
  supabase: ReturnType<typeof getServiceClient>,
  table: string,
  column: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  try {
    const { data, error } = await (supabase.from(table) as any)
      .delete()
      .in(column, ids)
      .select('id');

    if (error) {
      console.warn(`Warning: failed to delete from ${table} by ${column}: ${error.message}`);
      return 0;
    }
    const count = data?.length || 0;
    if (count > 0) {
      console.log(`Deleted ${count} rows from ${table}`);
    }
    return count;
  } catch (err) {
    console.warn(`Warning: table ${table} may not exist: ${err}`);
    return 0;
  }
}

// Fetch IDs from a table for a given user
async function fetchIds(
  supabase: ReturnType<typeof getServiceClient>,
  table: string,
  column: string,
  userId: string,
): Promise<string[]> {
  try {
    const { data, error } = await (supabase.from(table) as any)
      .select('id')
      .eq(column, userId);

    if (error) {
      console.warn(`Warning: failed to fetch IDs from ${table}: ${error.message}`);
      return [];
    }
    return (data || []).map((row: { id: string }) => row.id);
  } catch {
    return [];
  }
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { request_id } = (await req.json()) as DeleteRequest;
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // Fetch the deletion request record
    const { data: request, error: requestError } = await (supabase.from('data_deletion_requests') as any)
      .select('*')
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      return new Response(JSON.stringify({ error: 'Deletion request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the request is a deletion request and is pending
    if (request.request_type !== 'delete') {
      return new Response(JSON.stringify({ error: 'Request is not a deletion request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Request status is '${request.status}', expected 'pending'` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const userId = request.user_id;

    // Mark request as processing
    await (supabase.from('data_deletion_requests') as any)
      .update({ status: 'processing' })
      .eq('id', request_id);

    // Step 1: Create a backup export before deletion
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create an export request record for the backup
    const { data: exportRequest, error: exportInsertError } = await (supabase.from('data_deletion_requests') as any)
      .insert({
        user_id: userId,
        request_type: 'export',
        status: 'pending',
        data_types: request.data_types,
        notes: `Automatic backup before account deletion (deletion request: ${request_id})`,
      })
      .select()
      .single();

    if (exportInsertError) {
      console.error('Failed to create backup export request:', exportInsertError);
      await (supabase.from('data_deletion_requests') as any)
        .update({
          status: 'failed',
          notes: `Failed to create backup export: ${exportInsertError.message}`,
          processed_at: new Date().toISOString(),
        })
        .eq('id', request_id);

      return new Response(JSON.stringify({ error: 'Failed to create backup export' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call export-user-data to generate the backup
    try {
      const exportResponse = await fetch(`${supabaseUrl}/functions/v1/export-user-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ request_id: exportRequest.id }),
      });

      if (!exportResponse.ok) {
        const exportErr = await exportResponse.text();
        console.error('Backup export failed:', exportErr);
        // Continue with deletion even if backup fails, but log it
        console.warn('Proceeding with deletion despite backup failure');
      } else {
        console.log('Backup export completed successfully');
      }
    } catch (exportErr) {
      console.warn('Backup export call failed, proceeding with deletion:', exportErr);
    }

    // Step 2: Delete user data in reverse dependency order
    const deletionLog: Record<string, number> = {};

    // Gather IDs we need for cascading deletes
    const propertyIds = await fetchIds(supabase, 'properties', 'owner_id', userId);
    const tenancyIds = await fetchIds(supabase, 'tenancies', 'owner_id', userId);
    const conversationIds = await fetchIds(supabase, 'agent_conversations', 'user_id', userId);

    // --- Agent system tables (deepest dependencies first) ---
    deletionLog.agent_outcomes = await safeDelete(supabase, 'agent_outcomes', 'user_id', userId);
    deletionLog.agent_trajectories = await safeDelete(supabase, 'agent_trajectories', 'user_id', userId);
    deletionLog.agent_corrections = await safeDelete(supabase, 'agent_corrections', 'user_id', userId);
    deletionLog.agent_decisions = await safeDelete(supabase, 'agent_decisions', 'user_id', userId);
    deletionLog.agent_pending_actions = await safeDelete(supabase, 'agent_pending_actions', 'user_id', userId);
    deletionLog.agent_background_tasks = await safeDelete(supabase, 'agent_background_tasks', 'user_id', userId);
    deletionLog.agent_preferences = await safeDelete(supabase, 'agent_preferences', 'user_id', userId);
    deletionLog.agent_rules = await safeDelete(supabase, 'agent_rules', 'user_id', userId);

    // Delete agent messages via conversation IDs
    if (conversationIds.length > 0) {
      deletionLog.agent_messages = await safeDeleteByIds(
        supabase,
        'agent_messages',
        'conversation_id',
        conversationIds,
      );
    }
    deletionLog.agent_conversations = await safeDelete(supabase, 'agent_conversations', 'user_id', userId);
    deletionLog.agent_tasks = await safeDelete(supabase, 'agent_tasks', 'user_id', userId);

    // --- Notification tables ---
    deletionLog.notifications = await safeDelete(supabase, 'notifications', 'user_id', userId);
    deletionLog.notification_settings = await safeDelete(supabase, 'notification_settings', 'user_id', userId);
    deletionLog.notification_preferences = await safeDelete(supabase, 'notification_preferences', 'user_id', userId);
    deletionLog.notification_logs = await safeDelete(supabase, 'notification_logs', 'user_id', userId);
    deletionLog.scheduled_notifications = await safeDelete(supabase, 'scheduled_notifications', 'user_id', userId);
    deletionLog.push_tokens = await safeDelete(supabase, 'push_tokens', 'user_id', userId);

    // --- Email queue entries ---
    deletionLog.email_queue = await safeDelete(supabase, 'email_queue', 'user_id', userId);
    deletionLog.email_notifications = await safeDelete(supabase, 'email_notifications', 'user_id', userId);

    // --- Maintenance requests (owned properties) ---
    if (propertyIds.length > 0) {
      deletionLog.maintenance_requests_by_property = await safeDeleteByIds(
        supabase,
        'maintenance_requests',
        'property_id',
        propertyIds,
      );
    }
    // Also delete maintenance requests reported by user
    deletionLog.maintenance_requests_by_user = await safeDelete(
      supabase,
      'maintenance_requests',
      'reported_by',
      userId,
    );

    // --- Inspections (owned properties) ---
    if (propertyIds.length > 0) {
      deletionLog.inspections_by_property = await safeDeleteByIds(
        supabase,
        'inspections',
        'property_id',
        propertyIds,
      );
    }
    deletionLog.inspections_by_user = await safeDelete(supabase, 'inspections', 'created_by', userId);

    // --- Documents ---
    deletionLog.document_signatures = await safeDelete(supabase, 'document_signatures', 'signer_id', userId);
    deletionLog.document_annotations = await safeDelete(supabase, 'document_annotations', 'created_by', userId);
    deletionLog.document_shares = await safeDelete(supabase, 'document_shares', 'shared_by', userId);
    deletionLog.document_access_log = await safeDelete(supabase, 'document_access_log', 'user_id', userId);
    deletionLog.saved_signatures = await safeDelete(supabase, 'saved_signatures', 'user_id', userId);
    deletionLog.documents = await safeDelete(supabase, 'documents', 'owner_id', userId);

    // --- Financial tables ---
    deletionLog.payments = await safeDelete(supabase, 'payments', 'tenant_id', userId);
    if (tenancyIds.length > 0) {
      deletionLog.rent_schedules = await safeDeleteByIds(supabase, 'rent_schedules', 'tenancy_id', tenancyIds);
      deletionLog.autopay_settings = await safeDeleteByIds(supabase, 'autopay_settings', 'tenancy_id', tenancyIds);
    }
    if (propertyIds.length > 0) {
      deletionLog.arrears_records = await safeDeleteByIds(supabase, 'arrears_records', 'property_id', propertyIds);
    }
    deletionLog.generated_reports = await safeDelete(supabase, 'generated_reports', 'owner_id', userId);

    // --- Tenancy tables ---
    if (tenancyIds.length > 0) {
      deletionLog.tenancy_documents = await safeDeleteByIds(supabase, 'tenancy_documents', 'tenancy_id', tenancyIds);
      deletionLog.rent_increases = await safeDeleteByIds(supabase, 'rent_increases', 'tenancy_id', tenancyIds);
      deletionLog.bond_lodgements = await safeDeleteByIds(supabase, 'bond_lodgements', 'tenancy_id', tenancyIds);
      deletionLog.bond_claims = await safeDeleteByIds(supabase, 'bond_claims', 'tenancy_id', tenancyIds);
      deletionLog.lease_signing_events = await safeDeleteByIds(supabase, 'lease_signing_events', 'tenancy_id', tenancyIds);
    }
    deletionLog.tenancy_tenants = await safeDelete(supabase, 'tenancy_tenants', 'tenant_id', userId);
    deletionLog.tenancies = await safeDelete(supabase, 'tenancies', 'owner_id', userId);

    // --- Listings ---
    if (propertyIds.length > 0) {
      deletionLog.listing_features = await safeDeleteByIds(supabase, 'listing_features', 'property_id', propertyIds);
      deletionLog.listings = await safeDeleteByIds(supabase, 'listings', 'property_id', propertyIds);
    }

    // --- Property tables ---
    if (propertyIds.length > 0) {
      deletionLog.property_images = await safeDeleteByIds(supabase, 'property_images', 'property_id', propertyIds);
      deletionLog.property_compliance = await safeDeleteByIds(supabase, 'property_compliance', 'property_id', propertyIds);
      deletionLog.property_health_scores = await safeDeleteByIds(supabase, 'property_health_scores', 'property_id', propertyIds);
    }
    deletionLog.properties = await safeDelete(supabase, 'properties', 'owner_id', userId);

    // --- Marketplace tables ---
    deletionLog.saved_searches = await safeDelete(supabase, 'saved_searches', 'user_id', userId);
    deletionLog.favourite_listings = await safeDelete(supabase, 'favourite_listings', 'user_id', userId);

    // --- Compliance and learning ---
    deletionLog.user_learning_progress = await safeDelete(supabase, 'user_learning_progress', 'user_id', userId);
    deletionLog.autonomy_graduation_tracking = await safeDelete(supabase, 'autonomy_graduation_tracking', 'user_id', userId);
    deletionLog.user_consents = await safeDelete(supabase, 'user_consents', 'user_id', userId);

    // --- Stripe accounts ---
    deletionLog.owner_stripe_accounts = await safeDelete(supabase, 'owner_stripe_accounts', 'owner_id', userId);
    deletionLog.tenant_stripe_customers = await safeDelete(supabase, 'tenant_stripe_customers', 'tenant_id', userId);
    deletionLog.payment_methods = await safeDelete(supabase, 'payment_methods', 'tenant_id', userId);
    deletionLog.add_on_purchases = await safeDelete(supabase, 'add_on_purchases', 'owner_id', userId);

    // --- Security and audit tables ---
    deletionLog.user_sessions = await safeDelete(supabase, 'user_sessions', 'user_id', userId);
    deletionLog.login_attempts = await safeDelete(supabase, 'login_attempts', 'user_id', userId);
    deletionLog.security_alerts = await safeDelete(supabase, 'security_alerts', 'user_id', userId);
    deletionLog.audit_log = await safeDelete(supabase, 'audit_log', 'user_id', userId);
    deletionLog.sensitive_data_access = await safeDelete(supabase, 'sensitive_data_access', 'user_id', userId);

    // --- Profile (must be last before auth user) ---
    deletionLog.profiles = await safeDelete(supabase, 'profiles', 'id', userId);

    // --- Delete the Supabase Auth user via admin API ---
    try {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
      if (authDeleteError) {
        console.error('Failed to delete auth user:', authDeleteError);
        deletionLog.auth_user = 0;
      } else {
        console.log('Auth user deleted successfully');
        deletionLog.auth_user = 1;
      }
    } catch (authErr) {
      console.error('Auth user deletion error:', authErr);
      deletionLog.auth_user = 0;
    }

    // Step 3: Update the deletion request as completed
    // The data_deletion_requests record itself is preserved as an audit trail
    const totalDeleted = Object.values(deletionLog).reduce((sum, count) => sum + count, 0);

    await (supabase.from('data_deletion_requests') as any)
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        notes: `Account deletion completed. ${totalDeleted} total records deleted across ${Object.keys(deletionLog).filter(k => deletionLog[k] > 0).length} tables. Backup export request: ${exportRequest?.id || 'failed'}.`,
      })
      .eq('id', request_id);

    return new Response(
      JSON.stringify({
        success: true,
        request_id,
        user_id: userId,
        backup_export_id: exportRequest?.id || null,
        deletion_summary: deletionLog,
        total_records_deleted: totalDeleted,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Delete user data error:', error);

    // Attempt to mark the request as failed
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.request_id) {
        const supabase = getServiceClient();
        await (supabase.from('data_deletion_requests') as any)
          .update({
            status: 'failed',
            notes: `Deletion error: ${error.message}`,
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
